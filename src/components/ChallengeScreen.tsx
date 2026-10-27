import { useState, useEffect, useCallback } from 'react';
import type { Challenge } from '../../data/schema.ts';
import { SentenceCanvas } from './SentenceCanvas.tsx';
import { ModifierSlot } from './ModifierSlot.tsx';
import { RepairShop } from './RepairShop.tsx';
import { ProgressDots } from './ProgressDots.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import { Tour } from './Tour.tsx';
import {
  createSession,
  nextChallenge,
  submitAnswer,
  shouldLevelUp,
  type SessionState,
} from '../engine/session.ts';
import { getRepairChallenge } from '../engine/mistakes.ts';
import { loadProgress, saveProgress } from '../engine/progress.ts';
import {
  playCorrectChime,
  playIncorrectThud,
  speakChallengeSentence,
} from '../audio/audio.ts';

type Phase =
  | 'selecting'
  | 'answered'
  | 'repairing'
  | 'levelup'
  | 'done';

interface Answer {
  chosen: string;
  correct: boolean;
}

export function ChallengeScreen() {
  const [phase, setPhase] = useState<Phase>('selecting');
  const [session, setSession] = useState<SessionState>(() => {
    const prog = loadProgress();
    return createSession(prog.currentLevel);
  });
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [repairStage, setRepairStage] = useState(1);
  const [repairChallenge, setRepairChallenge] = useState<Challenge | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // Auto-load first challenge on boot and after queue refills.
  // Only when we don't have a challenge AND the user is selecting (not reviewing an answer).
  useEffect(() => {
    if (!session.currentChallenge && session.queue.length > 0 && phase === 'selecting') {
      setSession((s) => nextChallenge(s));
    }
  }, [session.currentChallenge, session.queue.length, phase]);

  // Handle the edge case where onNextLevel creates a session with a queue but
  // we need to trigger the first load. The effect above will catch it, but only
  // if currentChallenge is null. Since onNextLevel calls nextChallenge inline,
  // this is handled.
  //
  // For the "Start Over" button from the 'done' state, we set session without
  // loading first challenge. The effect catches it.
  //
  // For onRepairComplete when queue is empty, we rebuild the session but don't
  // load first challenge. The effect catches it.

  const onSelect = useCallback(
    (chosen: string) => {
      if (phase !== 'selecting' || !session.currentChallenge) return;

      const { state, correct } = submitAnswer(session, chosen);
      setAnswer({ chosen, correct });
      setPhase('answered');
      setSession(state);

      const prog = loadProgress();
      if (prog.audioEnabled) {
        if (correct) {
          playCorrectChime();
          speakChallengeSentence(
            session.currentChallenge.sentenceTemplate,
            session.currentChallenge.options.correct,
          );
        } else {
          playIncorrectThud();
        }
      }
    },
    [phase, session],
  );

  const advanceOrRefill = useCallback(
    (s: SessionState): { session: SessionState; newPhase?: Phase } => {
      const ns = nextChallenge(s);
      if (!ns.currentChallenge && ns.queue.length === 0) {
        // Queue exhausted — check level up first
        if (shouldLevelUp(ns.score, ns.correctNouns)) {
          const prog = loadProgress();
          const nextLvl = Math.min(6, ns.level + 1);
          prog.currentLevel = nextLvl;
          prog.sessionQueue = [];
          saveProgress(prog);
          if (nextLvl > 6) {
            return { session: { ...ns, level: nextLvl }, newPhase: 'done' };
          }
          return { session: { ...ns, level: nextLvl }, newPhase: 'levelup' };
        }
        // Rebuild the queue for the same level
        const prog = loadProgress();
        const rebuilt = createSession(prog.currentLevel);
        return { session: rebuilt, newPhase: 'selecting' };
      }
      return { session: ns };
    },
    [],
  );

  const onNext = useCallback(() => {
    setAnswer(null);

    // Check if wrong answer needs repair
    if (answer && !answer.correct && session.currentChallenge) {
      const prog = loadProgress();
      const nounData = prog.nouns[session.currentChallenge.nounId];
      const stage = nounData?.mistakeStage ?? 1;

      if (stage <= 3) {
        const repair = getRepairChallenge(
          session.currentChallenge.nounId,
          stage,
          session.currentChallenge.levelType,
          session.level,
        );
        if (repair) {
          setRepairChallenge(repair);
          setRepairStage(stage);
          setPhase('repairing');
          return;
        }
      }
    }

    const { session: newSess, newPhase } = advanceOrRefill(session);
    setSession(newSess);
    setPhase(newPhase ?? 'selecting');
  }, [answer, session, advanceOrRefill]);

  const onRepairComplete = useCallback(
    (stageCorrect: boolean) => {
      const prog = loadProgress();
      const nounData = session.currentChallenge
        ? prog.nouns[session.currentChallenge.nounId]
        : null;

      if (nounData) {
        if (stageCorrect) {
          // Advance through stages: 1→2→3→0
          if (nounData.mistakeStage >= 3) {
            nounData.mistakeStage = 0;
            nounData.mistakeType = undefined;
          } else {
            nounData.mistakeStage = (nounData.mistakeStage || 1) + 1;
            // Keep mistakeType so stage 2/3 can use it
          }
        }
        // On incorrect in stage 1: stay at same stage (don't advance)
        // mistakeStage remains unchanged
        saveProgress(prog);
      }
      setRepairChallenge(null);
      const { session: newSess, newPhase } = advanceOrRefill(session);
      setSession(newSess);
      setPhase(newPhase ?? 'selecting');
      setAnswer(null);
    },
    [session, advanceOrRefill],
  );

  const onNextLevel = useCallback(() => {
    const ns = createSession(session.level);
    // Load first challenge immediately so we don't flash "Loading..."
    const withFirst = ns.queue.length > 0 ? nextChallenge(ns) : ns;
    setSession(withFirst);
    setPhase('selecting');
    setAnswer(null);
  }, [session.level]);

  const ch =
    phase === 'repairing' && repairChallenge
      ? repairChallenge
      : session.currentChallenge;

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <h1>De/Het Trainer</h1>
          <span className="level-badge">Niveau {session.level}</span>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <button
            className="tour-btn"
            onClick={() => setShowTour(true)}
            title="Tour"
            aria-label="Open tour"
          >
            ?
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowSettings((s) => !s)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Score bar */}
      <div className="score-bar">
        <span className="correct">✓ {session.score.correct}</span>
        <span className="wrong">✗ {session.score.wrong}</span>
        <span>
          Reeks: <span className="streak">{session.streak}</span>
        </span>
        <span style={{ marginLeft: 'auto' }}>Nog: {session.queue.length}</span>
      </div>

      {/* Progress dots */}
      <ProgressDots
        current={
          session.queue.length > 0
            ? (session.score.correct + session.score.wrong) % 10
            : 0
        }
        total={10}
        results={[]}
      />

      {/* Main content */}
      {phase === 'levelup' ? (
        <div className="level-complete">
          <h2>🎉 Niveau {session.level - 1} voltooid!</h2>
          <p>Je kent de regels van dit niveau.</p>
          <div className="stats">
            <span style={{ color: 'var(--correct)' }}>
              ✓ {session.score.correct}
            </span>
            <span style={{ color: 'var(--incorrect)' }}>
              ✗ {session.score.wrong}
            </span>
          </div>
          <button className="next-btn" onClick={onNextLevel}>
            Begin niveau {session.level} →
          </button>
        </div>
      ) : phase === 'done' ? (
        <div className="level-complete">
          <h2>🏆 Alle niveaus voltooid!</h2>
          <p>
            Je beheerst alle zes geslachtsregels. Begin opnieuw of exporteer
            je voortgang.
          </p>
          <button
            className="next-btn"
            onClick={() => {
              const prog = loadProgress();
              prog.currentLevel = 1;
              prog.sessionQueue = [];
              saveProgress(prog);
              setSession(createSession(1));
              setPhase('selecting');
            }}
          >
            Opnieuw beginnen
          </button>
        </div>
      ) : !ch ? (
        <div className="empty-state">
          <h2>Oefeningen laden...</h2>
          <p>Je oefensessie wordt klaargezet.</p>
        </div>
      ) : phase === 'repairing' ? (
        <RepairShop
          challenge={ch}
          repairStage={repairStage}
          onComplete={onRepairComplete}
        />
      ) : (
        <div
          className={`challenge-card ${answer ? (answer.correct ? 'correct' : 'incorrect') : ''}`}
        >
          {/* Sentence display */}
          <SentenceCanvas
            challenge={ch}
            selectedAnswer={answer?.chosen ?? null}
            phase={phase}
            sentenceTranslation={
              loadProgress().showTranslation ? ch.sentenceTranslation : undefined
            }
          />

          {/* Options */}
          <ModifierSlot
            challenge={ch}
            disabled={phase !== 'selecting'}
            chosenAnswer={answer?.chosen ?? null}
            onSelect={onSelect}
          />

          {/* Explanation */}
          {phase === 'answered' && answer && (
            <div className="explanation">
              {answer.correct ? (
                <>
                  ✅ <strong>{ch.options.correct}</strong> is juist!{' '}
                  {ch.explanation}
                </>
              ) : (
                <>
                  ❌ Je koos <strong>{answer.chosen}</strong>.{' '}
                  {ch.explanation}
                </>
              )}
              {/* Compound stem breakdown for Level 6 */}
              {ch.levelType === 'compound_clash' && (
                <CompoundStems template={ch.sentenceTemplate} />
              )}
            </div>
          )}

          {/* Next / Continue button */}
          {phase === 'answered' && (
            <button className="next-btn" onClick={onNext}>
              {answer?.correct ? 'Volgende →' : 'Herstel →'}
            </button>
          )}
        </div>
      )}

      {showTour && <Tour onDone={() => setShowTour(false)} />}
    </div>
  );
}

/**
 * Parse a compound challenge template (e.g. "De appel + De boom = De appelboom.")
 * and render a visual stem breakdown highlighting which word determines gender.
 */
function CompoundStems({ template }: { template: string }) {
  // Template format: "De appel + De boom = De appelboom. [modifier] appelboom..."
  const match = template.match(/^([^.]+)\./);
  if (!match) return null;

  const formula = match[1].trim(); // "De appel + De boom = De appelboom"
  const parts = formula.split('=');
  if (parts.length !== 2) return null;

  const leftSide = parts[0].trim(); // "De appel + De boom"
  const rightSide = parts[1].trim(); // "De appelboom"

  const stems = leftSide.split('+').map(s => s.trim());

  // Extract the last stem's article and noun (it determines gender)
  const lastStem = stems[stems.length - 1];
  const lastArticleMatch = lastStem.match(/^(De|Het)\s+(.+)$/);
  const decisiveArticle = lastArticleMatch?.[1] ?? '';

  return (
    <div className="compound-stems">
      {stems.map((stem, i) => {
        const isLast = i === stems.length - 1;
        const artMatch = stem.match(/^(De|Het)\s+(.+)$/);
        const art = artMatch?.[1] ?? '';
        const word = artMatch?.[2] ?? stem;
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
            <span style={{
              fontSize: '.75rem',
              color: 'var(--text-muted)',
              marginRight: '.15rem',
            }}>
              {art}
            </span>
            <span style={{
              fontWeight: isLast ? 700 : 400,
              color: isLast ? 'var(--accent)' : 'var(--text)',
              textDecoration: isLast ? 'underline' : 'none',
              textUnderlineOffset: '3px',
            }}>
              {word}
            </span>
            {i < stems.length - 1 && (
              <span style={{ margin: '0 .35rem', color: 'var(--text-muted)' }}>+</span>
            )}
          </span>
        );
      })}
      <span style={{ margin: '0 .5rem', color: 'var(--text-muted)', fontWeight: 700 }}>=</span>
      <span style={{
        fontWeight: 700,
        color: decisiveArticle === 'Het' ? 'var(--het-accent, #9b59b6)' : 'var(--de-accent, #2980b9)',
      }}>
        {rightSide}
      </span>
      <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.35rem' }}>
        ⬆️ Het <strong>laatste woord</strong> ({decisiveArticle}) bepaalt het geslacht
      </div>
    </div>
  );
}