import type { Challenge, Noun, ProgressStore, LevelType } from '../../data/schema.ts';
import challengesRaw from '../../data/challenges.json' with { type: 'json' };
import nounsRaw from '../../data/nouns.json' with { type: 'json' };
import { loadProgress, saveProgress } from './progress.ts';

const ALL_CHALLENGES = (challengesRaw as { version: number; challenges: Challenge[] }).challenges;
const ALL_NOUNS = (nounsRaw as { version: number; nouns: Noun[] }).nouns;

// ── Adaptive Queue ──────────────────────────────────────────────

/**
 * Build a session queue weighted by per-noun mastery.
 *
 * Mastery tiers:
 *   < 0.3  → struggling: all challenges for this noun at this level
 *   0.3–0.7 → learning:   ~75% of challenges
 *   0.7–0.9 → proficient:  1–2 challenges
 *   > 0.9  → mastered:     33% chance of 1 refresher challenge
 *
 * Within a noun, challenges matching the noun's mistakeType are
 * preferred (the mechanic they last failed on gets more reps).
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
    const data = progress.nouns[nounId];
    const mastery = data?.mastery ?? 0;
    const mistakeType = data?.mistakeType as LevelType | undefined;

    // How many challenges to include for this noun?
    let count: number;
    if (mastery < 0.3) {
      count = challenges.length;                      // all
    } else if (mastery < 0.7) {
      count = Math.max(1, Math.ceil(challenges.length * 0.75));
    } else if (mastery < 0.9) {
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

  // Shuffle the final queue so nouns are interleaved (not blocked by noun)
  return shuffle(queue);
}

export interface SessionState {
  currentChallenge: Challenge | null;
  currentNoun: Noun | null;
  queue: string[]; // challengeIds
  level: number;
  score: { correct: number; wrong: number };
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
      nounData.mastery + (correct ? 0.08 : -0.05),
    ),
    mistakeStage: correct ? 0 : Math.min(3, (nounData.mistakeStage || 0) + 1),
    mistakeType: correct
      ? (nounData.mistakeStage === 0 ? undefined : nounData.mistakeType)
      : state.currentChallenge.levelType,
  };

  progress.nouns[nounId] = newNounData;

  // Save queue state
  progress.sessionQueue = state.queue;
  progress.currentLevel = state.level;
  saveProgress(progress);

  // Keep currentChallenge set so the explanation/feedback can reference it.
  // The caller (ChallengeScreen) clears it when advancing to the next challenge.
  const newState: SessionState = {
    ...state,
    score: {
      correct: state.score.correct + (correct ? 1 : 0),
      wrong: state.score.wrong + (correct ? 0 : 1),
    },
    streak: correct ? state.streak + 1 : 0,
    isRepairing: false,
    repairChallenge: state.currentChallenge,
  };

  return { state: newState, correct };
}

/**
 * Progress to the next level when the user scores ≥80% with ≥8 attempts.
 */
export function shouldLevelUp(score: { correct: number; wrong: number }): boolean {
  const total = score.correct + score.wrong;
  if (total < 8) return false;
  return score.correct / total >= 0.8;
}

function clampMastery(v: number): number {
  return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
}

export function getNounById(id: string): Noun | undefined {
  return ALL_NOUNS.find((n) => n.id === id);
}
export { ALL_NOUNS };