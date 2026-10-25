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
});
export type Noun = z.infer<typeof NounSchema>;

/** The six level types */
export const LevelType = z.enum([
  'article_basic',         // Level 01: de/het
  'possessive_pivot',      // Level 02: ons/onze
  'adjective_snag',        // Level 03: een groot/grote
  'demonstrative_shift',   // Level 04: dit/deze, dat/die
  'diminutive_trap',       // Level 05: de→het via -je
  'compound_clash',        // Level 06: end-word gender
]);
export type LevelType = z.infer<typeof LevelType>;

/** A single context challenge */
export const ChallengeSchema = z.object({
  challengeId: z.string().regex(/^ch_[a-z]+_\d{2}$/, "challengeId must match ch_X_NN"),
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

/** The full data file schemas */
export const NounsFileSchema = z.object({
  version: z.literal(1),
  nouns: z.array(NounSchema),
});

export const ChallengesFileSchema = z.object({
  version: z.literal(1),
  challenges: z.array(ChallengeSchema),
});

/** Progress store (localStorage) */
export const ProgressStoreSchema = z.object({
  version: z.literal(1),
  nouns: z.record(z.string(), z.object({
    mastery: z.number().min(0).max(1),
    correct: z.number().int().min(0),
    wrong: z.number().int().min(0),
    lastSeen: z.string(),
    mistakeStage: z.number().int().min(0).max(3), // 0=learned, 1-3=stages active
    mistakeType: LevelType.optional(), // which level type they failed on
  })),
  sessionQueue: z.array(z.string()), // challengeIds
  currentLevel: z.number().int().min(1).max(6),
  theme: z.enum(['light', 'dark', 'system']),
  audioEnabled: z.boolean(),
  showTranslation: z.boolean(),
});
export type ProgressStore = z.infer<typeof ProgressStoreSchema>;