import { useMemo } from 'react';
import type { Challenge } from '../../data/schema.ts';

interface Props {
  challenge: Challenge;
  disabled: boolean;
  chosenAnswer: string | null;
  onSelect: (answer: string) => void;
}

/** Renders the two clickable option buttons (correct vs distractor in random order). */
export function ModifierSlot({ challenge, disabled, chosenAnswer, onSelect }: Props) {
  // Randomise left/right order once per challenge — stable across re-renders
  const [left, right] = useMemo(() => {
    const options = [challenge.options.correct, challenge.options.distractor];
    if (Math.random() > 0.5) return options;
    return [options[1], options[0]];
  }, [challenge.challengeId]);

  function getClassName(opt: string): string {
    if (!chosenAnswer) return 'option-btn';
    if (opt === challenge.options.correct) {
      if (chosenAnswer === opt) return 'option-btn chosen-correct';
      return 'option-btn reveal-correct';
    }
    // distractor
    if (chosenAnswer === opt) return 'option-btn chosen-incorrect';
    return 'option-btn';
  }

  return (
    <div className="modifier-options">
      <button
        className={getClassName(left)}
        disabled={disabled}
        onClick={() => onSelect(left)}
      >
        {left}
      </button>
      <button
        className={getClassName(right)}
        disabled={disabled}
        onClick={() => onSelect(right)}
      >
        {right}
      </button>
    </div>
  );
}