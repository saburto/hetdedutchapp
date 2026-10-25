import { useMemo, type ReactNode } from 'react';
import type { Challenge } from '../../data/schema.ts';

interface Props {
  challenge: Challenge;
  selectedAnswer: string | null;
  phase: 'selecting' | 'answered' | 'repairing';
}

/**
 * Renders a challenge sentence with the modifier highlighted.
 * Static text flows naturally (spaces intact); only the modifier gets a styled span.
 */
export function SentenceCanvas({ challenge, selectedAnswer, phase }: Props) {
  const nodes: ReactNode[] = useMemo(() => {
    const { sentenceTemplate, options } = challenge;

    // Determine status classes for the modifier
    let modStatus = 'pending';
    let showCorrect = false;
    if (phase === 'answered' && selectedAnswer) {
      if (selectedAnswer === options.correct) {
        modStatus = 'correct';
      } else {
        modStatus = 'incorrect';
        showCorrect = true; // reveal the correct form
      }
    }

    const modifierText =
      selectedAnswer === null
        ? '___'
        : phase === 'answered' && selectedAnswer !== options.correct
          ? selectedAnswer // show what they picked (struck-through)
          : options.correct;

    const parts = sentenceTemplate.split('[modifier]');

    const result: ReactNode[] = [];

    // Before modifier
    if (parts[0]) {
      result.push(<span key="before" className="sentence-word static pending">{parts[0]}</span>);
    }

    // Modifier slot
    result.push(
      <span
        key="modifier"
        className={`sentence-word modifier ${modStatus}${phase === 'answered' && modStatus === 'incorrect' ? ' strikethrough' : ''}`}
      >
        {modifierText}
      </span>,
    );

    // If they got it wrong, show the correct form as a hint
    if (showCorrect) {
      result.push(
        <span key="correction" className="sentence-word modifier locked" style={{ marginLeft: '.25rem' }}>
          → {options.correct}
        </span>,
      );
    }

    // After modifier
    if (parts[1]) {
      result.push(<span key="after" className="sentence-word static pending">{parts[1]}</span>);
    }

    return result;
  }, [challenge, selectedAnswer, phase]);

  return <div className="sentence-canvas">{nodes}</div>;
}