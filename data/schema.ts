import { z } from 'zod';

/** A Dutch noun with grammatical metadata */
export const NounSchema = z.object({
  id: z.string().regex(/^noun_\d{4}$/, "id must match noun_NNNN"),
  noun: z.string().min(1),
  article: z.enum(['de', 'het']),
  translation: z.string().min(1),
  category: z.string().min(1),
  diminutive: z.string().optional(), // e.g. "autootje"
  grammaticalRules: z.array(z.string()),
  ruleHint: z.string().optional(), // e.g. "-ing woorden zijn altijd de"
});
export type Noun = z.infer<typeof NounSchema>;

/** The six challenge level types (levels 1–6). Level 7 is the phrase trainer. */
export const LevelType = z.enum([
  'article_basic',         // Level 01: de/het
  'possessive_pivot',      // Level 02: ons/onze
  'adjective_snag',        // Level 03: een groot/grote
  'demonstrative_shift',   // Level 04: dit/deze, dat/die
  'diminutive_trap',       // Level 05: de→het via -je
  'compound_clash',        // Level 06: end-word gender
]);
export type LevelType = z.infer<typeof LevelType>;

/** Highest level number (Level 7 = absurd phrase trainer). */
export const MAX_LEVEL = 7;

/** A single context challenge */
export const ChallengeSchema = z.object({
  challengeId: z.string().regex(/^ch_[a-z]+_\d{2,}$/, "challengeId must match ch_X_NN"),
  nounId: z.string(),
  levelType: LevelType,
  levelNumber: z.number().int().min(1).max(6),
  sentenceTemplate: z.string().min(1).refine(
    (s) => s.includes('[modifier]'),
    "sentenceTemplate must contain [modifier]"
  ),
  options: z.object({
    correct: z.string().min(1),
    distractor: z.string().min(1),
  }),
  explanation: z.string().min(1).refine(
    (s) => s.includes("'") || s.includes("\u2018") || s.includes("\u2019") || s.includes('"') || true,
    "explanation should quote the noun"
  ),
  sentenceTranslation: z.string().optional(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

/** One absurd phrase with the article words marked as targets. */
export const PhraseSchema = z.object({
  id: z.string().regex(/^phr_\d{3}$/, "id must match phr_NNN"),
  words: z.array(z.string().min(1)).min(3),
  targets: z.array(z.number().int().min(0)).min(1).refine(
    (t) => new Set(t).size === t.length,
    'target indices must be unique',
  ),
  translation: z.string().min(1),
});
export type Phrase = z.infer<typeof PhraseSchema>;

export const PhrasesFileSchema = z.object({
  version: z.literal(1),
  phrases: z.array(PhraseSchema),
}).superRefine((file, ctx) => {
  for (const p of file.phrases) {
    for (const idx of p.targets) {
      if (idx >= p.words.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `target index ${idx} out of range (${p.words.length} words)`,
          path: ['phrases', p.id, 'targets'],
        });
      } else if (!/^(de|het)$/i.test(p.words[idx].replace(/[.,!?;:]$/, ''))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `target word "${p.words[idx]}" is not an article (de/het)`,
          path: ['phrases', p.id, 'targets'],
        });
      }
    }
  }
});

/** The full data file schemas */
export const NounsFileSchema = z.object({
  version: z.literal(1),
  nouns: z.array(NounSchema),
});

export const ChallengesFileSchema = z.object({
  version: z.literal(1),
  challenges: z.array(ChallengeSchema),
});

/** Per-phrase spoken-attempt progress (v3). */
export const PhraseProgressSchema = z.object({
  correctTargets: z.number().int().min(0),
  totalTargets: z.number().int().min(0),
  lastSeen: z.string(),
});

/** Progress store (localStorage) */
export const ProgressStoreSchema = z.object({
  version: z.literal(3),
  nouns: z.record(z.string(), z.object({
    mastery: z.number().min(0).max(1),
    correct: z.number().int().min(0),
    wrong: z.number().int().min(0),
    lastSeen: z.string(),
    mistakeStage: z.number().int().min(0).max(3), // 0=learned, 1-3=stages active
    mistakeType: LevelType.optional(), // which level type they failed on
  })),
  sessionQueue: z.array(z.string()), // challengeIds
  currentLevel: z.number().int().min(1).max(MAX_LEVEL),
  theme: z.enum(['light', 'dark', 'system']),
  audioEnabled: z.boolean(),
  showTranslation: z.boolean(),
  // Lifetime totals (v2)
  totalCorrect: z.number().int().min(0),
  totalWrong: z.number().int().min(0),
  // Absurd phrase trainer (v3): per phrase, best target count
  phrases: z.record(z.string(), PhraseProgressSchema),
});
export type ProgressStore = z.infer<typeof ProgressStoreSchema>;