import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Phrase } from '../../data/schema.ts';
import { loadProgress } from '../engine/progress.ts';
import {
  buildPhraseQueue,
  recordPhraseAttempt,
  scoreTranscript,
  type PhraseResult,
} from '../engine/phrases.ts';
import { speakDutch, speakDutchWord, cancelSpeech } from '../audio/audio.ts';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from '../audio/speech.ts';

type PhrasePhase = 'revealing' | 'ready' | 'listening' | 'result' | 'done';

const WORD_INTERVAL_MS = 420;
/** Reveal the next word if speech `onend` never fires (background tab, bug). */
const WORD_SAFETY_TIMEOUT_MS = 3000;

function articleOf(word: string): 'de' | 'het' {
  return word.replace(/[.,!?;:]$/, '').toLowerCase() === 'de' ? 'de' : 'het';
}

export function PhraseScreen() {
  const progress = loadProgress();
  const [queue, setQueue] = useState<Phrase[]>(() => buildPhraseQueue(progress));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<PhrasePhase>('revealing');
  const [revealed, setRevealed] = useState(0);
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState<PhraseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const ignoreOnendRef = useRef(false);
  // How many words of the current phrase have already been read aloud.
  const spokenRef = useRef<{ phraseId: string; count: number }>({ phraseId: '', count: 0 });

  const phrase = queue[idx];
  const fullText = phrase ? phrase.words.join(' ') : '';
  const supported = useMemo(() => isSpeechRecognitionSupported(), []);
  const targetSet = useMemo(
    () => new Set(phrase?.targets ?? []),
    [phrase],
  );

  // Word-by-word reveal, synced to the audio: the next word appears only
  // after the current word has finished playing. Without audio (or when
  // speech synthesis is unavailable) a fixed interval is used instead.
  useEffect(() => {
    if (phase !== 'revealing' || !phrase) return;
    if (spokenRef.current.phraseId !== phrase.id) {
      spokenRef.current = { phraseId: phrase.id, count: 0 };
    }

    const total = phrase.words.length;
    if (revealed >= total) {
      // Sentence complete: read the whole phrase, then allow recording.
      if (progress.audioEnabled) speakDutch(fullText);
      setPhase('ready');
      return;
    }

    let cancelled = false;
    let advanced = false;
    let timer: number | null = null;
    let spokeWord = false;

    const advance = () => {
      if (cancelled || advanced) return;
      advanced = true;
      setRevealed((r) => Math.min(r + 1, total));
    };

    if (progress.audioEnabled && revealed > spokenRef.current.count) {
      // Read the word that just appeared and reveal the next one when it ends.
      spokeWord = speakDutchWord(phrase.words[revealed - 1], advance);
      if (spokeWord) {
        spokenRef.current.count = revealed;
        timer = window.setTimeout(advance, WORD_SAFETY_TIMEOUT_MS);
      }
    }
    if (!spokeWord) {
      timer = window.setTimeout(advance, WORD_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      // Stop the word that is still playing when the phrase is skipped or
      // the screen is left.
      if (spokeWord) cancelSpeech();
    };
  }, [phase, revealed, phrase, fullText, progress.audioEnabled]);

  function ensureRecognition(): SpeechRecognitionLike | null {
    if (!recRef.current) recRef.current = createSpeechRecognition();
    return recRef.current;
  }

  const finishWithTranscript = useCallback(
    (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) {
        setError('Ik heb je niet gehoord. Probeer het opnieuw.');
        setPhase((p) => (p === 'listening' ? 'ready' : p));
        return;
      }
      const scored = scoreTranscript(phrase, trimmed);
      recordPhraseAttempt(phrase.id, scored);
      setResult(scored);
      setInterim(trimmed);
      setPhase('result');
    },
    [phrase],
  );

  function startRecording() {
    const rec = ensureRecognition();
    if (!rec) {
      setError('Spraakherkenning wordt niet ondersteund in deze browser. Gebruik Chrome.');
      return;
    }

    cancelSpeech();
    setError(null);
    setResult(null);
    setInterim('');
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    ignoreOnendRef.current = false;
    setPhase('listening');

    rec.onstart = () => {};
    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0]?.transcript ?? '';
        if (r.isFinal) finalTranscriptRef.current += `${text} `;
        else interimText += text;
      }
      interimTranscriptRef.current = interimText;
      setInterim((finalTranscriptRef.current + interimText).trim());

      // For a single-sentence exercise, stop as soon as a final result is
      // captured. On desktop this gives instant scoring; on Android the
      // onend handler still finalizes if only interim results were delivered.
      if (finalTranscriptRef.current.trim()) {
        rec.stop();
      }
    };
    rec.onerror = (event) => {
      // Mirror the Google Chrome demo: ignore the onend that follows these
      // errors so the UI can settle back into the ready state.
      if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'not-allowed') {
        ignoreOnendRef.current = true;
      }
      setError(
        event.error === 'not-allowed'
          ? 'Geen toegang tot de microfoon. Sta de microfoon toe en probeer opnieuw.'
          : event.error === 'no-speech'
            ? 'Ik hoorde niets. Probeer het opnieuw.'
            : event.error === 'audio-capture'
              ? 'Geen microfoon gevonden. Controleer je microfoon.'
              : 'Spraakherkenning lukte niet. Probeer het opnieuw.',
      );
      setPhase((p) => (p === 'listening' ? 'ready' : p));
    };
    rec.onend = () => {
      if (ignoreOnendRef.current) {
        ignoreOnendRef.current = false;
        setPhase((p) => (p === 'listening' ? 'ready' : p));
        return;
      }
      // Android Chrome often ends the session with only interim results —
      // finalize on end so the spoken phrase is never thrown away.
      const transcript = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
      finishWithTranscript(transcript);
    };

    try {
      rec.lang = 'nl-NL';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.start();
    } catch {
      setError('Spraakherkenning kon niet starten.');
      setPhase('ready');
    }
  }

  function stopRecording() {
    const rec = recRef.current;
    if (!rec) return;
    // onend handles scoring with whatever was captured (final or interim).
    rec.stop();
  }

  function replay() {
    cancelSpeech();
    if (progress.audioEnabled) speakDutch(fullText);
  }

  function nextPhrase() {
    if (idx + 1 >= queue.length) {
      setPhase('done');
      return;
    }
    setIdx((i) => i + 1);
    setRevealed(0);
    setResult(null);
    setInterim('');
    setError(null);
    setPhase('revealing');
  }

  function restart() {
    const p = loadProgress();
    setQueue(buildPhraseQueue(p));
    setIdx(0);
    setRevealed(0);
    setResult(null);
    setInterim('');
    setError(null);
    setPhase('revealing');
  }

  if (!phrase) {
    return (
      <div className="empty-state">
        <h2>Geen zinnen gevonden</h2>
        <p>De zinnendataset is leeg.</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="level-complete">
        <h2>🎉 Alle absurde zinnen geoefend!</h2>
        <p>
          Je hebt de artikelen hardop geoefend. Blijf herhalen om de
          de/het-regels te automatiseren.
        </p>
        <button className="next-btn" onClick={restart}>
          Opnieuw beginnen
        </button>
      </div>
    );
  }

  const visibleWords = phrase.words.slice(0, revealed);
  const showTranslation = progress.showTranslation;

  return (
    <div className="phrase-screen" data-phrase-id={phrase.id}>
      <div className="phrase-head">
        <span className="card-title">Absurde zinnen</span>
        <span className="phrase-counter">
          {idx + 1} / {queue.length}
        </span>
      </div>

      {/* Word-by-word sentence */}
      <div className="phrase-canvas" aria-label={fullText}>
        {visibleWords.map((word, i) => {
          const isTarget = targetSet.has(i);
          const targetResult = result?.results.find((r) => r.index === i);
          let cls = 'phrase-word';
          if (isTarget) {
            cls += ` target ${articleOf(word)}`;
            if (targetResult) cls += ` ${targetResult.status}`;
          }
          return (
            <span key={i} className={cls}>
              {word}
              {targetResult && (
                <i className={`spoken-tag ${targetResult.status}`}>
                  {targetResult.status === 'correct'
                    ? '✓'
                    : targetResult.status === 'wrong'
                      ? targetResult.spoken
                      : 'gemist'}
                </i>
              )}
            </span>
          );
        })}
        {revealed < phrase.words.length && (
          <span className="phrase-cursor" aria-hidden="true" />
        )}
      </div>

      {showTranslation && phase !== 'revealing' && (
        <div className="translation-inline">— {phrase.translation} —</div>
      )}

      {/* Live transcript while listening */}
      {phase === 'listening' && (
        <div className="phrase-transcript">
          <span className="mic-pulse" aria-hidden="true" />
          <span>{interim || 'Luister...'}</span>
        </div>
      )}

      {error && <div className="phrase-error">{error}</div>}

      {/* Result summary */}
      {phase === 'result' && result && (
        <div className="phrase-result">
          <div className="phrase-result-score">
            {result.correctCount === result.total ? (
              <>🎯 Perfect! Alle artikelen goed.</>
            ) : (
              <>
                {result.correctCount} van de {result.total} artikelen goed.
              </>
            )}
          </div>
          <div className="phrase-result-actions">
            <button className="phrase-btn ghost" onClick={() => {
              setResult(null);
              setInterim('');
              setError(null);
              setPhase('ready');
            }}>
              🔁 Opnieuw
            </button>
            <button className="next-btn" onClick={nextPhrase}>
              {idx + 1 >= queue.length ? 'Klaar ✓' : 'Volgende zin →'}
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      {phase === 'revealing' && (
        <button
          className="phrase-btn ghost"
          onClick={() => setRevealed(phrase.words.length)}
        >
          ⏩ Toon alles
        </button>
      )}

      {phase === 'ready' && (
        <div className="phrase-controls">
          <button className="phrase-btn ghost" onClick={replay}>
            🔊 Luister
          </button>
          <button
            className={`phrase-btn mic${supported ? '' : ' disabled'}`}
            onClick={startRecording}
            disabled={!supported}
            title={supported ? 'Start opname' : 'Alleen in Chrome'}
          >
            🎤 Opnemen
          </button>
        </div>
      )}

      {phase === 'listening' && (
        <div className="phrase-controls">
          <button className="phrase-btn mic recording" onClick={stopRecording}>
            ⏹ Stop
          </button>
        </div>
      )}

      {!supported && (
        <p className="phrase-note">
          Spraakherkenning werkt alleen in Chrome (desktop of Android).
        </p>
      )}
    </div>
  );
}
