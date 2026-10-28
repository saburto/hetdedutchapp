import type { Phrase, ProgressStore } from '../../data/schema.ts';
import phrasesRaw from '../../data/phrases.json' with { type: 'json' };
import { loadProgress, saveProgress } from './progress.ts';

const ALL_PHRASES = (phrasesRaw as { version: number; phrases: Phrase[] }).phrases;

export interface TargetResult {
  /** Token index in the phrase (the article word). */
  index: number;
  /** The correct article, lowercase. */
  article: 'de' | 'het';
  /** The article the user actually said (lowercase), or null if not heard. */
  spoken: 'de' | 'het' | null;
  status: 'correct' | 'wrong' | 'missed';
}

export interface PhraseResult {
  phrase: Phrase;
  results: TargetResult[];
  correctCount: number;
  total: number;
}

/** Strip punctuation and lowercase a single token for comparison. */
function normToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'()«»…]/g, '')
    .trim();
}

/** Split a transcript into normalized, non-empty tokens. */
function tokenizeTranscript(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map(normToken)
    .filter(Boolean);
}

/**
 * Compare a speech-recognition transcript against the target articles in a
 * phrase. For each target article we look for the following noun in the
 * transcript and check the word spoken immediately before it.
 *
 * This tolerates extra/omitted filler words while still verifying the
 * de/het pairing that the phrase is trying to teach.
 */
export function scoreTranscript(phrase: Phrase, transcript: string): PhraseResult {
  const tokens = tokenizeTranscript(transcript);
  const used = new Set<number>();

  const results: TargetResult[] = phrase.targets.map((index) => {
    const article = normToken(phrase.words[index]) as 'de' | 'het';
    const noun = normToken(phrase.words[index + 1] ?? '');

    let spoken: 'de' | 'het' | null = null;
    let status: 'correct' | 'wrong' | 'missed' = 'missed';

    if (noun) {
      for (let p = 0; p < tokens.length; p++) {
        if (used.has(p) || tokens[p] !== noun) continue;
        const prev = p > 0 ? tokens[p - 1] : '';
        used.add(p);
        if (prev === 'de' || prev === 'het') {
          spoken = prev;
          used.add(p - 1);
          status = prev === article ? 'correct' : 'wrong';
        } else {
          status = 'missed';
        }
        break;
      }
    }

    return { index, article, spoken, status };
  });

  const correctCount = results.filter((r) => r.status === 'correct').length;
  return { phrase, results, correctCount, total: results.length };
}

/** Phrase progress ratio (0–1) for a single phrase id. */
export function phraseRatio(progress: ProgressStore, phraseId: string): number {
  const p = progress.phrases[phraseId];
  if (!p || p.totalTargets === 0) return 0;
  return p.correctTargets / p.totalTargets;
}

/**
 * Queue all phrases, ordering the least-mastered (or never attempted) first.
 * Ties are randomised so repeated sessions don't feel identical.
 */
export function buildPhraseQueue(progress: ProgressStore): Phrase[] {
  return [...ALL_PHRASES].sort((a, b) => {
    const aRatio = phraseRatio(progress, a.id);
    const bRatio = phraseRatio(progress, b.id);
    if (aRatio !== bRatio) return aRatio - bRatio;
    return Math.random() - 0.5;
  });
}

/** Average phrase mastery (0–100) used by the Level 7 progress ring. */
export function getPhraseMasteryPct(progress: ProgressStore): number {
  if (ALL_PHRASES.length === 0) return 0;
  const sum = ALL_PHRASES.reduce((acc, p) => acc + phraseRatio(progress, p.id), 0);
  return Math.round((sum / ALL_PHRASES.length) * 100);
}

/** Persist a speaking attempt for a phrase (keeps the best score per target). */
export function recordPhraseAttempt(phraseId: string, result: PhraseResult): void {
  const progress = loadProgress();
  const prev = progress.phrases[phraseId];
  const correctTargets = Math.max(prev?.correctTargets ?? 0, result.correctCount);
  progress.phrases[phraseId] = {
    correctTargets,
    totalTargets: result.total,
    lastSeen: new Date().toISOString(),
  };
  saveProgress(progress);
}

export { ALL_PHRASES };
