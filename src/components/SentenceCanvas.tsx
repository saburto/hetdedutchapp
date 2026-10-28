import { useMemo, useState, useCallback, type ReactNode } from 'react';
import type { Challenge } from '../../data/schema.ts';
import nounsRaw from '../../data/nouns.json' with { type: 'json' };

const ALL_NOUNS = (nounsRaw as { version: number; nouns: Array<{ id: string; article: 'de' | 'het' }> }).nouns;

interface Props {
  challenge: Challenge;
  selectedAnswer: string | null;
  phase: 'selecting' | 'answered' | 'repairing';
  sentenceTranslation?: string;
}

/**
 * Renders a challenge sentence with the modifier highlighted.
 * On wrong answers, the noun gets a large animated article badge
 * and a colored background glow to burn in the correct gender.
 * The EN badge toggles an inline English translation line.
 */
export function SentenceCanvas({ challenge, selectedAnswer, phase, sentenceTranslation }: Props) {
  const nodes: ReactNode[] = useMemo(() => {
    const { sentenceTemplate, options } = challenge;

    const nounEntry = ALL_NOUNS.find((n) => n.id === challenge.nounId);
    const article = nounEntry?.article ?? 'de';

    let modStatus: 'pending' | 'correct' | 'incorrect' | 'locked' = 'pending';
    let isWrong = false;
    if (phase === 'answered' && selectedAnswer) {
      if (selectedAnswer === options.correct) {
        modStatus = 'correct';
      } else {
        modStatus = 'incorrect';
        isWrong = true;
      }
    }

    const modifierText =
      selectedAnswer === null
        ? '___'
        : phase === 'answered' && selectedAnswer !== options.correct
          ? selectedAnswer
          : options.correct;

    const parts = sentenceTemplate.split('[modifier]');

    const result: ReactNode[] = [];

    // Before modifier
    if (parts[0]) {
      result.push(
        <span key="before" className="sentence-word static pending enter">
          {parts[0]}
        </span>,
      );
    }

    // Modifier slot
    result.push(
      <span
        key="modifier"
        className={`sentence-word modifier enter ${modStatus}${isWrong ? ' strikethrough' : ''}`}
      >
        {modifierText}
      </span>,
    );

    if (isWrong) {
      // ── Wrong answer: dramatic correction ──

      // Correction arrow + correct form
      result.push(
        <span key="correction" className="sentence-word correction-hint">
          → <strong>{options.correct}</strong>
        </span>,
      );

      // Split after-part into noun + rest so we can highlight the noun
      if (parts[1]) {
        const trimmed = parts[1].trimStart();
        const firstSpace = trimmed.indexOf(' ');
        const nounWord = firstSpace > -1 ? trimmed.slice(0, firstSpace) : trimmed;
        const rest = firstSpace > -1 ? ' ' + trimmed.slice(firstSpace + 1) : '';

        // Noun with colored background glow + large badge
        result.push(
          <span key="noun-badged" className={`noun-highlight ${article}`}>
            <span className="sentence-word noun badged">{nounWord}</span>
            <span className={`article-badge ${article}`}>
              {article}-woord
            </span>
          </span>,
        );

        if (rest) {
          result.push(
            <span key="after" className="sentence-word static pending enter">
              {rest}
            </span>,
          );
        }
      }
    } else {
      // Normal rendering
      if (parts[1]) {
        result.push(
          <span key="after" className="sentence-word static pending enter">
            {parts[1]}
          </span>,
        );
      }
    }

    return result;
  }, [challenge, selectedAnswer, phase]);

  const [translationOpen, setTranslationOpen] = useState(false);

  const toggleTranslation = useCallback(() => {
    setTranslationOpen((prev) => !prev);
  }, []);

  return (
    <>
      <div className="card-head">
        <span className="card-title">Oefening</span>
        {sentenceTranslation && (
          <div className="translation-trigger">
            <button
              className={`translation-badge${translationOpen ? ' on' : ''}`}
              onClick={toggleTranslation}
              aria-label="Toon Engelse vertaling"
              aria-expanded={translationOpen}
            >
              EN
            </button>
          </div>
        )}
      </div>
      <div className="sentence-canvas-wrapper">
        <div className="sentence-canvas">{nodes}</div>
        {sentenceTranslation && translationOpen && (
          <div className="translation-inline">— {sentenceTranslation} —</div>
        )}
      </div>
    </>
  );
}
