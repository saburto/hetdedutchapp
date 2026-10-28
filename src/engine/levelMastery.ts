import type { Challenge } from '../../data/schema.ts';
import challengesRaw from '../../data/challenges.json' with { type: 'json' };
import { loadProgress } from './progress.ts';
import { getPhraseMasteryPct } from './phrases.ts';

const ALL_CHALLENGES = (challengesRaw as { version: number; challenges: Challenge[] }).challenges;

export interface LevelMastery {
  level: number;
  /** Average mastery (0–1) of the nouns used in this level. */
  mastery: number;
  /** 0–100 rounded percentage for display. */
  pct: number;
  /** Level is completed (behind the current level). */
  completed: boolean;
  /** This is the level the user is currently practising. */
  current: boolean;
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'De / Het',
  2: 'Ons / Onze',
  3: 'Bijvoeglijk',
  4: 'Dit / Dat',
  5: 'Verkleinwoord',
  6: 'Samenstelling',
  7: 'Absurde zinnen',
};

export function getLevelName(level: number): string {
  return LEVEL_NAMES[level] ?? `Niveau ${level}`;
}

/** Compute per-level mastery from the progress store. */
export function getLevelMasteries(): LevelMastery[] {
  const progress = loadProgress();
  const currentLevel = progress.currentLevel;

  const result: LevelMastery[] = [];
  for (let level = 1; level <= 7; level++) {
    if (level === 7) {
      const pct = getPhraseMasteryPct(progress);
      result.push({
        level,
        mastery: pct / 100,
        pct,
        completed: level < currentLevel,
        current: level === currentLevel,
      });
      continue;
    }

    const nounIds = new Set(
      ALL_CHALLENGES
        .filter((c) => c.levelNumber === level)
        .map((c) => c.nounId),
    );
    const ids = [...nounIds];
    const masterySum = ids.reduce(
      (sum, id) => sum + (progress.nouns[id]?.mastery ?? 0),
      0,
    );
    const mastery = ids.length > 0 ? masterySum / ids.length : 0;
    result.push({
      level,
      mastery,
      pct: Math.round(mastery * 100),
      completed: level < currentLevel,
      current: level === currentLevel,
    });
  }
  return result;
}
