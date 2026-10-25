import { useState, useRef, useEffect } from 'react';
import type { Challenge } from '../../data/schema.ts';
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
 * Stage 2: Structural shift — same noun, different mechanic (auto-advance).
 * Stage 3: Contrast duel — opposite-gender noun face-off (auto-advance).
 */
export function RepairShop({ challenge, repairStage, onComplete }: Props) {
  const [typedPhrase, setTypedPhrase] = useState('');
  const [typedStatus, setTypedStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const correctPhrase = `${challenge.options.correct} ${(() => {
    // Extract the noun from the template for the phrase "option noun"
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

  const stageLabels: Record<number, string> = {
    1: 'Explicit Correction',
    2: 'Structural Shift',
    3: 'Contrast Duel',
  };

  return (
    <div className="repair-shop">
      <h4>🔧 Sentence Repair Shop — Stage {repairStage}</h4>
      <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
        {stageLabels[repairStage]}
      </p>

      {repairStage === 1 ? (
        <>
          <p style={{ fontSize: '.95rem', marginBottom: '1rem' }}>
            Type the correct phrase:{' '}
            <strong style={{ color: 'var(--correct)' }}>
              "{correctPhrase}"
            </strong>
          </p>
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
              Check
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: '.95rem', marginBottom: '1rem' }}>
            {repairStage === 2
              ? `Same noun, different structure. Think about what you learned and try again.`
              : `Compare this noun with an opposite-gender word to feel the contrast.`}
          </p>
          <button className="next-btn" onClick={() => onComplete(true)}>
            I Understand → 
          </button>
        </>
      )}
    </div>
  );
}