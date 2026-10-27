import { useState, useRef, useEffect } from 'react';
import type { Challenge } from '../../data/schema.ts';
import { ALL_NOUNS } from '../engine/session.ts';
import { loadProgress } from '../engine/progress.ts';
import {
  playCorrectChime,
  playIncorrectThud,
  speakChallengeSentence,
} from '../audio/audio.ts';

interface Props {
  challenge: Challenge;
  repairStage: number; // 1, 2, or 3
  onComplete: (correct: boolean) => void;
}

/**
 * 3-stage repair sequence displayed after a wrong answer.
 *
 * Stage 1: Explicit correction — type the phrase.
 * Stage 2: Structural shift — binary choice with different mechanic.
 * Stage 3: Contrast duel — binary choice with opposite-gender noun.
 */
export function RepairShop({ challenge, repairStage, onComplete }: Props) {
  const [typedPhrase, setTypedPhrase] = useState('');
  const [typedStatus, setTypedStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [choiceState, setChoiceState] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [chosenAnswer, setChosenAnswer] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract the noun from the challenge for the correct phrase
  const noun = ALL_NOUNS.find((n) => n.id === challenge.nounId);
  const progress = loadProgress();
  const ruleHint = noun?.ruleHint ?? null;

  const correctPhrase = `${challenge.options.correct} ${(() => {
    const parts = challenge.sentenceTemplate.split('[modifier]');
    if (parts[1]) {
      const words = parts[1].trim().split(/\s+/);
      return words[0] || '';
    }
    return '';
  })()}`.trim();

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  function handleSubmit() {
    const prog = loadProgress();
    const userPhrase = typedPhrase.trim().toLowerCase();
    const expected = correctPhrase.toLowerCase();

    // Allow both "mooi boek" and "een mooi boek" to be correct
    const isCorrect =
      userPhrase === expected ||
      userPhrase.endsWith(expected) ||
      userPhrase.replace(/^een\s+/, '') === expected;

    if (isCorrect) {
      setTypedStatus('correct');
      if (prog.audioEnabled) {
        playCorrectChime();
        speakChallengeSentence(
          challenge.sentenceTemplate,
          challenge.options.correct,
        );
      }
      setTimeout(() => onComplete(true), 800);
    } else {
      setTypedStatus('incorrect');
      if (prog.audioEnabled) playIncorrectThud();
      setTimeout(() => setTypedStatus('idle'), 600);
    }
  }

  function handleChoice(answer: string) {
    const prog = loadProgress();
    const isCorrect = answer === challenge.options.correct;
    setChosenAnswer(answer);
    setChoiceState(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      if (prog.audioEnabled) {
        playCorrectChime();
        speakChallengeSentence(
          challenge.sentenceTemplate,
          challenge.options.correct,
        );
      }
      setTimeout(() => onComplete(true), 800);
    } else {
      if (prog.audioEnabled) playIncorrectThud();
      setTimeout(() => {
        setChoiceState('idle');
        setChosenAnswer(null);
      }, 600);
    }
  }

  const stageLabels: Record<number, string> = {
    1: 'Directe correctie',
    2: 'Andere structuur',
    3: 'Contrast duel',
  };

  // Randomise button order for stages 2 & 3
  const [leftOpt, rightOpt] = (() => {
    const opts = [challenge.options.correct, challenge.options.distractor];
    return Math.random() > 0.5 ? opts : [opts[1], opts[0]];
  })();

  function getBtnClassName(opt: string): string {
    if (!chosenAnswer) return 'option-btn';
    if (opt === challenge.options.correct) {
      if (chosenAnswer === opt) return 'option-btn chosen-correct';
      return 'option-btn reveal-correct';
    }
    if (chosenAnswer === opt) return 'option-btn chosen-incorrect';
    return 'option-btn';
  }

  return (
    <div className="repair-shop">
      <h4>🔧 Zinsherstel — Fase {repairStage}</h4>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
        {stageLabels[repairStage]}
      </p>

      {repairStage === 1 ? (
        <>
          <p style={{ fontSize: '.95rem', marginBottom: '1rem' }}>
            Typ de juiste zin:{' '}
            <strong style={{ color: 'var(--correct)' }}>
              "{correctPhrase}"
            </strong>
          </p>
          {ruleHint && (
            <p style={{ fontSize: '.8rem', color: 'var(--accent)', marginBottom: '.75rem' }}>
              💡 <em>{ruleHint}</em>
            </p>
          )}
          <div className="repair-input-row">
            <input
              ref={inputRef}
              className={`repair-input ${typedStatus}`}
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={correctPhrase}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="next-btn" onClick={handleSubmit}>
              Kijk na
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: '.95rem', marginBottom: '1rem' }}>
            {repairStage === 2
              ? `Zelfde woord, andere structuur. Kies het juiste woord.`
              : `Vergelijk met een ander woord. Kies de juiste vorm.`}
          </p>
          {/* Show the sentence with [modifier] replaced by ___ */}
          <p style={{ fontSize: '1.1rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            {challenge.sentenceTemplate.split('[modifier]').map((part, i) => (
              i === 0
                ? (
                  <span key={i}>
                    {part}
                    <span style={{
                      borderBottom: '2px solid var(--accent)',
                      padding: '0 .25rem',
                      fontWeight: 600,
                    }}>
                      ___
                    </span>
                  </span>
                )
                : <span key={i}>{part}</span>
            ))}
          </p>
          <div className="modifier-options">
            <button
              className={getBtnClassName(leftOpt)}
              disabled={choiceState === 'correct'}
              onClick={() => handleChoice(leftOpt)}
            >
              {leftOpt}
            </button>
            <button
              className={getBtnClassName(rightOpt)}
              disabled={choiceState === 'correct'}
              onClick={() => handleChoice(rightOpt)}
            >
              {rightOpt}
            </button>
          </div>
          {choiceState === 'incorrect' && chosenAnswer && (
            <p style={{ color: 'var(--incorrect)', marginTop: '.5rem', fontSize: '.9rem' }}>
              ❌ {challenge.explanation}
            </p>
          )}
        </>
      )}
    </div>
  );
}