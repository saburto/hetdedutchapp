/**
 * Validates nouns.json and challenges.json against the Zod schema.
 * Run with: bun run validate
 */

import { NounsFileSchema, ChallengesFileSchema } from '../data/schema.ts';
import type { Noun, Challenge } from '../data/schema.ts';
import nounsRaw from '../data/nouns.json' with { type: 'json' };
import challengesRaw from '../data/challenges.json' with { type: 'json' };

const typedNouns = nounsRaw as { version: number; nouns: Noun[] };
const typedChallenges = challengesRaw as { version: number; challenges: Challenge[] };

function main() {
  let errors = 0;

  // Validate nouns
  const nounsResult = NounsFileSchema.safeParse(typedNouns);
  if (!nounsResult.success) {
    console.error('❌ nouns.json validation failed:');
    for (const issue of nounsResult.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      errors++;
    }
  } else {
    console.log(`✅ nouns.json valid — ${nounsResult.data.nouns.length} nouns`);
    const nounIds = new Set(nounsResult.data.nouns.map(n => n.id));
    const dupes = nounsResult.data.nouns.length - nounIds.size;
    if (dupes > 0) console.warn(`⚠ ${dupes} duplicate noun IDs`);

    // Validate challenges
    const challengesResult = ChallengesFileSchema.safeParse(typedChallenges);
    if (!challengesResult.success) {
      console.error('❌ challenges.json validation failed:');
      for (const issue of challengesResult.error.issues) {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
        errors++;
      }
    } else {
      const challenges = challengesResult.data.challenges;
      console.log(`✅ challenges.json valid — ${challenges.length} challenges`);

      // Cross-reference: every challenge must reference a valid noun
      const orphanChallenges = challenges.filter(c => !nounIds.has(c.nounId));
      if (orphanChallenges.length > 0) {
        console.error(`❌ ${orphanChallenges.length} challenges reference unknown nounIds:`);
        for (const c of orphanChallenges) {
          console.error(`  - ${c.challengeId} references ${c.nounId}`);
          errors++;
        }
      } else {
        console.log('✅ All challenges reference valid nouns');
      }

      // Check level distribution
      const byLevel = new Map<number, number>();
      for (const c of challenges) {
        byLevel.set(c.levelNumber, (byLevel.get(c.levelNumber) ?? 0) + 1);
      }
      console.log('📊 Challenges per level:', Object.fromEntries([...byLevel].sort()));

      // Check levelType matches levelNumber
      const typeMap: Record<number, string> = {
        1: 'possessive_pivot',
        2: 'adjective_snag',
        3: 'demonstrative_shift',
        4: 'diminutive_trap',
        5: 'compound_clash',
      };
      for (const c of challenges) {
        if (c.levelType !== typeMap[c.levelNumber]) {
          console.error(
            `❌ ${c.challengeId}: levelType "${c.levelType}" doesn't match levelNumber ${c.levelNumber} (expected "${typeMap[c.levelNumber]}")`,
          );
          errors++;
        }
      }

      // Validate options: correct must not equal distractor
      for (const c of challenges) {
        if (c.options.correct === c.options.distractor) {
          console.error(
            `❌ ${c.challengeId}: correct and distractor are both "${c.options.correct}"`,
          );
          errors++;
        }
      }
    }
  }

  if (errors > 0) {
    console.error(`\n❌ Validation failed with ${errors} error(s)`);
    throw new Error('Validation failed');
  } else {
    console.log('\n🎉 All validations passed!');
  }
}

main();