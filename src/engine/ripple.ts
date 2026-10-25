import type { Challenge } from '../../data/schema.ts';

/** A single word or token in a rendered sentence */
export interface SentenceSegment {
  text: string;
  type: 'static' | 'modifier' | 'noun';
  /** Visual state driven by answer feedback */
  status: 'pending' | 'correct' | 'incorrect' | 'locked';
}

/**
 * Interpolates a challenge template with a user answer,
 * returning word-level segments the UI can style independently.
 */
export function renderSentence(
  challenge: Challenge,
  selectedAnswer: string | null, // null = unanswered
): SentenceSegment[] {
  const { sentenceTemplate, options } = challenge;

  // Determine which modifier text to show
  const modifierText =
    selectedAnswer === null
      ? '___'
      : selectedAnswer === options.correct
        ? options.correct
        : options.correct; // show the correct form so they see the ripple

  // Split template around [modifier]
  const parts = sentenceTemplate.split('[modifier]');

  const segments: SentenceSegment[] = [];

  // Before modifier
  if (parts[0]) {
    const words = parts[0].trim().split(/\s+/);
    for (const w of words) {
      segments.push({ text: w, type: 'static', status: 'pending' });
    }
  }

  // The modifier slot
  segments.push({
    text: modifierText,
    type: 'modifier',
    status:
      selectedAnswer === null
        ? 'pending'
        : selectedAnswer === options.correct
          ? 'correct'
          : 'incorrect',
  });

  // After modifier
  if (parts[1]) {
    const words = parts[1].trim().split(/\s+/);
    // The first word after [modifier] is typically the noun
    for (let i = 0; i < words.length; i++) {
      const type: SentenceSegment['type'] =
        i === 0 && words[i].match(/[a-z]/i) ? 'noun' : 'static';
      segments.push({
        text: words[i],
        type,
        status:
          selectedAnswer === null
            ? 'pending'
            : selectedAnswer === options.correct
              ? 'correct'
              : 'incorrect',
      });
    }
  }

  return segments;
}

/**
 * Generates the "correction ripple" variant where the distractor
 * is shown to highlight what the user got wrong.
 */
export function renderErrorRipple(
  challenge: Challenge,
  userAnswer: string,
): SentenceSegment[] {
  const { sentenceTemplate, options } = challenge;
  const parts = sentenceTemplate.split('[modifier]');

  const segments: SentenceSegment[] = [];

  if (parts[0]) {
    for (const w of parts[0].trim().split(/\s+/)) {
      segments.push({ text: w, type: 'static', status: 'pending' });
    }
  }

  // Show what they picked (wrong), struck-through
  segments.push({
    text: userAnswer,
    type: 'modifier',
    status: 'incorrect',
  });

  if (parts[1]) {
    const words = parts[1].trim().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      segments.push({
        text: words[i],
        type: i === 0 ? 'noun' : 'static',
        status: 'pending',
      });
    }
  }

  return segments;
}