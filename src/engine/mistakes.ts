import type { Challenge, LevelType, Noun } from '../../data/schema.ts';
import challengesRaw from '../../data/challenges.json' with { type: 'json' };
import nounsRaw from '../../data/nouns.json' with { type: 'json' };

const ALL_CHALLENGES = (challengesRaw as { version: number; challenges: Challenge[] }).challenges;
const ALL_NOUNS = (nounsRaw as { version: number; nouns: Noun[] }).nouns;

/**
 * 3-stage mistake repair loop.
 *
 * Stage 1: Explicit Correction — challenge them on the same noun with a
 *          different level type to force re-analysis.
 * Stage 2: Structural Shift — change to a different grammatical mechanic
 *          for the same noun.
 * Stage 3: Contrast Duel — pit the failed noun against an opposite-gender
 *          noun in the same sentence frame.
 */

const REPAIR_LEVELS: LevelType[] = [
  'possessive_pivot',
  'adjective_snag',
  'demonstrative_shift',
];

/**
 * Get a repair challenge for the given noun and mistake stage.
 */
export function getRepairChallenge(
  nounId: string,
  stage: number, // 1, 2, or 3
  failedLevelType: LevelType,
): Challenge | null {
  if (stage === 1) {
    return getStage1Repair(nounId, failedLevelType);
  }
  if (stage === 2) {
    return getStage2Repair(nounId);
  }
  if (stage === 3) {
    return getStage3ContrastDuel(nounId);
  }
  return null;
}

/** Stage 1: Re-test with explicit correction — same mechanic, different sentence. */
function getStage1Repair(nounId: string, failedType: LevelType): Challenge | null {
  const pool = ALL_CHALLENGES.filter(
    (c) => c.nounId === nounId && c.levelType === failedType,
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Stage 2: Structural shift — change the mechanic for the same noun. */
function getStage2Repair(nounId: string): Challenge | null {
  // Pick a different level type than the failed one (but stay in 01-03)
  const pool = ALL_CHALLENGES.filter(
    (c) => c.nounId === nounId && REPAIR_LEVELS.includes(c.levelType),
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Stage 3: Contrast duel — same mechanic, opposite-gender noun. */
function getStage3ContrastDuel(nounId: string): Challenge | null {
  // Find a challenge for the failed noun
  const failedChallenge = ALL_CHALLENGES.find((c) => c.nounId === nounId && c.levelNumber <= 3);
  if (!failedChallenge) return null;

  // Find the failed noun's article
  const failedNoun = ALL_NOUNS.find((n) => n.id === nounId);
  if (!failedNoun) return null;
  const oppositeArticle = failedNoun.article === 'de' ? 'het' : 'de';

  // Pick a different noun of the opposite gender with the same level type
  const pool = ALL_CHALLENGES.filter((c) => {
    if (c.challengeId === failedChallenge.challengeId) return false;
    if (c.levelType !== failedChallenge.levelType) return false;
    const otherNoun = ALL_NOUNS.find((n) => n.id === c.nounId);
    return otherNoun?.article === oppositeArticle;
  });

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}