import type { Challenge, Noun, ProgressStore, LevelType } from '../../data/schema.ts';
import challengesRaw from '../../data/challenges.json' with { type: 'json' };
import nounsRaw from '../../data/nouns.json' with { type: 'json' };
import { loadProgress, saveProgress } from './progress.ts';

const ALL_CHALLENGES = (challengesRaw as { version: number; challenges: Challenge[] }).challenges;
const ALL_NOUNS = (nounsRaw as { version: number; nouns: Noun[] }).nouns;

// ── Adaptive Queue ──────────────────────────────────────────────

/** Half-life in days for mastery decay (14 days → mastery halves). */
const MASTERY_DECAY_DAYS = 14;

/** Compute effective mastery with exponential decay based on time since last seen. */
function getDecayedMastery(
  nounId: string,
  progress: ProgressStore,
): number {
  const data = progress.nouns[nounId];
  const rawMastery = data?.mastery ?? 0;
  if (!data?.lastSeen) return rawMastery;

  const lastSeen = new Date(data.lastSeen).getTime();
  if (isNaN(lastSeen)) return rawMastery;

  const daysSince = (Date.now() - lastSeen) / (1000 * 60 * 60 * 24);
  if (daysSince <= 0) return rawMastery;

  const decayed = rawMastery * Math.exp(-daysSince / MASTERY_DECAY_DAYS);
  return clampMastery(decayed);
}

/** Window size for rolling accuracy calculation. Only the last N answers count. */
const ROLLING_WINDOW = 20;

/**
 * Build a session queue weighted by per-noun mastery (with time decay).
 *
 * Effective mastery tiers (after decay):
 *   < 0.3  → struggling: up to 2 challenges (capped)
 *   0.3–0.7 → learning:   ~75% of challenges, capped at 2
 *   0.7–0.9 → proficient:  1–2 challenges
 *   > 0.9  → mastered:     33% chance of 1 refresher challenge
 *
 * Within a noun, challenges matching the noun's mistakeType are
 * preferred (the mechanic they last failed on gets more reps).
 *
 * Max 2 challenges per noun per session to prevent cramming.
 */
function buildAdaptiveQueue(level: number, progress: ProgressStore): string[] {
  const levelChallenges = ALL_CHALLENGES.filter((c) => c.levelNumber === level);

  // Group challenges by nounId
  const byNoun = new Map<string, Challenge[]>();
  for (const ch of levelChallenges) {
    const arr = byNoun.get(ch.nounId);
    if (arr) arr.push(ch);
    else byNoun.set(ch.nounId, [ch]);
  }

  const queue: string[] = [];

  for (const [nounId, challenges] of byNoun) {
    const effectiveMastery = getDecayedMastery(nounId, progress);
    const data = progress.nouns[nounId];
    const mistakeType = data?.mistakeType as LevelType | undefined;

    // How many challenges to include for this noun?
    let count: number;
    if (effectiveMastery < 0.3) {
      count = Math.min(2, challenges.length);          // capped at 2
    } else if (effectiveMastery < 0.7) {
      count = Math.min(2, Math.max(1, Math.ceil(challenges.length * 0.75)));
    } else if (effectiveMastery < 0.9) {
      count = Math.min(2, challenges.length);          // 1–2
    } else {
      count = Math.random() < 0.33 ? 1 : 0;            // occasional refresher
    }

    if (count === 0) continue;

    // Sort: challenges matching the mistakeType come first
    const sorted = [...challenges].sort((a, b) => {
      const aMatch = a.levelType === mistakeType ? 0 : 1;
      const bMatch = b.levelType === mistakeType ? 0 : 1;
      // Secondary sort: shuffle within same priority
      return aMatch - bMatch || Math.random() - 0.5;
    });

    for (let i = 0; i < count && i < sorted.length; i++) {
      queue.push(sorted[i].challengeId);
    }
  }

  // Shuffle enforcing spacing (≥4 other nouns between same noun)
  return spacedShuffle(queue);
}

export interface SessionState {
  currentChallenge: Challenge | null;
  currentNoun: Noun | null;
  queue: string[]; // challengeIds
  level: number;
  score: { correct: number; wrong: number };
  correctNouns: string[]; // nounIds answered correctly this session
  recentResults: boolean[]; // last ROLLING_WINDOW results (true = correct)
  streak: number;
  isRepairing: boolean;
  repairChallenge: Challenge | null;
}

/**
 * Shuffle an array in-place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Map a challengeId to its nounId for spacing enforcement. */
function getNounIdForChallenge(challengeId: string): string {
  const ch = ALL_CHALLENGES.find((c) => c.challengeId === challengeId);
  return ch?.nounId ?? challengeId;
}

/**
 * Shuffle with constraint: at least MIN_SPACING other nouns between
 * occurrences of the same nounId. Falls back to Fisher-Yates if the
 * constraint is impossible (e.g. too few distinct nouns).
 */
const MIN_SPACING = 4;

function spacedShuffle(queue: string[]): string[] {
  // Quick path: if very short queue, just shuffle normally
  if (queue.length <= MIN_SPACING + 1) return shuffle(queue);

  // Try spaced shuffle up to 20 attempts; fall back to random if impossible
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = [...queue];
    shuffle(result);

    let valid = true;
    // Check spacing: for each pair of same nounId, distance must be >= MIN_SPACING
    const lastPos = new Map<string, number>();
    for (let i = 0; i < result.length; i++) {
      const nounId = getNounIdForChallenge(result[i]);
      const prev = lastPos.get(nounId);
      if (prev !== undefined && i - prev < MIN_SPACING) {
        valid = false;
        break;
      }
      lastPos.set(nounId, i);
    }

    if (valid) return result;
  }

  // Fallback: plain shuffle
  return shuffle([...queue]);
}

/**
 * Build a session for the given level.
 * If the progress store has a saved queue, use it.
 */
export function createSession(level: number): SessionState {
  const progress = loadProgress();

  // If there's a saved queue and level matches, resume it
  if (progress.sessionQueue.length > 0 && progress.currentLevel === level) {
    return resumeFromQueue(level);
  }

  // Build a fresh adaptive queue
  const queue = buildAdaptiveQueue(level, progress);

  return {
    currentChallenge: null,
    currentNoun: null,
    queue,
    level,
    score: { correct: 0, wrong: 0 },
    correctNouns: [],
    recentResults: [],
    streak: 0,
    isRepairing: false,
    repairChallenge: null,
  };
}

function resumeFromQueue(level: number): SessionState {
  const progress = loadProgress();
  return {
    currentChallenge: null,
    currentNoun: null,
    queue: [...progress.sessionQueue],
    level,
    score: { correct: 0, wrong: 0 },
    correctNouns: [],
    recentResults: [],
    streak: 0,
    isRepairing: false,
    repairChallenge: null,
  };
}

/**
 * Get the next challenge from the queue.
 */
export function nextChallenge(state: SessionState): SessionState {
  if (state.isRepairing && state.repairChallenge) {
    const noun = ALL_NOUNS.find((n) => n.id === state.repairChallenge!.nounId) ?? null;
    return {
      ...state,
      currentChallenge: state.repairChallenge,
      currentNoun: noun,
      isRepairing: false,
    };
  }

  if (state.queue.length === 0) {
    return { ...state, currentChallenge: null, currentNoun: null };
  }

  const nextId = state.queue[0];
  const challenge = ALL_CHALLENGES.find((c) => c.challengeId === nextId) ?? null;
  const noun = challenge ? ALL_NOUNS.find((n) => n.id === challenge.nounId) ?? null : null;

  return {
    ...state,
    currentChallenge: challenge,
    currentNoun: noun,
    queue: state.queue.slice(1),
    repairChallenge: null,
  };
}

/**
 * Submit an answer. Returns the new state and whether the answer was correct.
 */
export function submitAnswer(
  state: SessionState,
  answer: string,
): { state: SessionState; correct: boolean } {
  if (!state.currentChallenge) {
    return { state, correct: false };
  }

  const correct = answer === state.currentChallenge.options.correct;
  const progress = loadProgress();

  // Update noun progress
  const nounId = state.currentChallenge.nounId;
  const nounData = progress.nouns[nounId] ?? {
    mastery: 0,
    correct: 0,
    wrong: 0,
    lastSeen: new Date().toISOString(),
    mistakeStage: 0,
    mistakeType: undefined,
  };

  const newNounData = {
    ...nounData,
    correct: nounData.correct + (correct ? 1 : 0),
    wrong: nounData.wrong + (correct ? 0 : 1),
    lastSeen: new Date().toISOString(),
    mastery: clampMastery(
      nounData.mastery + (correct ? 0.07 : -0.14),
    ),
    // Stage logic:
    // - Correct in normal play: reset to 0 (they've demonstrated knowledge)
    // - Wrong: increment stage (1→2→3, capped at 3)
    // - The RepairShop's onRepairComplete handles advancing/resetting
    //   stages during the repair loop; this only fires for the initial
    //   challenge answer that may trigger the repair.
    mistakeStage: correct
      ? 0
      : Math.min(3, (nounData.mistakeStage || 0) + 1),
    mistakeType: correct
      ? undefined
      : state.currentChallenge.levelType,
  };

  progress.nouns[nounId] = newNounData;

  // Save queue state
  progress.sessionQueue = state.queue;
  progress.currentLevel = state.level;
  saveProgress(progress);

  // Track distinct nouns answered correctly this session
  const newCorrectNouns = correct && !state.correctNouns.includes(nounId)
    ? [...state.correctNouns, nounId]
    : state.correctNouns;

  // Rolling window of recent results
  const newRecent = [...state.recentResults, correct];
  if (newRecent.length > ROLLING_WINDOW) {
    newRecent.shift();
  }

  // Keep currentChallenge set so the explanation/feedback can reference it.
  // The caller (ChallengeScreen) clears it when advancing to the next challenge.
  const newState: SessionState = {
    ...state,
    score: {
      correct: state.score.correct + (correct ? 1 : 0),
      wrong: state.score.wrong + (correct ? 0 : 1),
    },
    correctNouns: newCorrectNouns,
    recentResults: newRecent,
    streak: correct ? state.streak + 1 : 0,
    isRepairing: false,
    repairChallenge: state.currentChallenge,
  };

  return { state: newState, correct };
}

/**
 * Progress to the next level when the user:
 * - Has made ≥16 attempts
 * - Has ≥80% accuracy over the rolling window (last 20 answers)
 * - Has answered at least 8 distinct nouns correctly
 */
export function shouldLevelUp(
  score: { correct: number; wrong: number },
  correctNouns: string[],
  recentResults: boolean[],
): boolean {
  const total = score.correct + score.wrong;
  if (total < 16) return false;
  if (new Set(correctNouns).size < 8) return false;

  // Rolling accuracy: if window has < 8 answers, use total accuracy instead
  if (recentResults.length >= 8) {
    const recentCorrect = recentResults.filter(Boolean).length;
    if (recentCorrect / recentResults.length < 0.8) return false;
  } else {
    // Not enough recent data yet — fall back to total accuracy
    if (score.correct / total < 0.8) return false;
  }

  return true;
}

function clampMastery(v: number): number {
  return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
}

export function getNounById(id: string): Noun | undefined {
  return ALL_NOUNS.find((n) => n.id === id);
}
export { ALL_NOUNS };