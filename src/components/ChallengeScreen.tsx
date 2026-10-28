import { useState, useEffect, useCallback, useRef } from 'react';
import type { Challenge, ProgressStore } from '../../data/schema.ts';
import { MAX_LEVEL } from '../../data/schema.ts';
import { SentenceCanvas } from './SentenceCanvas.tsx';
import { ModifierSlot } from './ModifierSlot.tsx';
import { RepairShop } from './RepairShop.tsx';
import { GaugeRow } from './GaugeRow.tsx';
import { LevelShimmerBar } from './LevelShimmerBar.tsx';
import { TabBar, type ActiveTab } from './TabBar.tsx';
import { LevelPathView } from './LevelPathView.tsx';
import { StatsView } from './StatsView.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import { Tour } from './Tour.tsx';
import { PhraseScreen } from './PhraseScreen.tsx';
import { getLevelName } from '../engine/levelMastery.ts';
import {
  createSession,
  nextChallenge,
  submitAnswer,
  shouldLevelUp,
  type SessionState,
} from '../engine/session.ts';
import { getRepairChallenge } from '../engine/mistakes.ts';
import { loadProgress, saveProgress, updateTheme } from '../engine/progress.ts';
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

const CARD_LEAVE_MS = 300;

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('oefenen');
  const [cardAnim, setCardAnim] = useState<'entering' | 'leaving' | ''>('entering');
  const [theme, setThemeState] = useState<ProgressStore['theme']>(
    () => loadProgress().theme,
  );
  const advanceTimer = useRef<number | null>(null);
  const advancing = useRef(false);

  // Clear pending advance timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimer.current !== null) {
        window.clearTimeout(advanceTimer.current);
      }
    };
  }, []);

  // Auto-load first challenge on boot and after queue refills.
  // Only when we don't have a challenge AND the user is selecting (not reviewing an answer).
  useEffect(() => {
    if (!session.currentChallenge && session.queue.length > 0 && phase === 'selecting') {
      setSession((s) => nextChallenge(s));
    }
  }, [session.currentChallenge, session.queue.length, phase]);

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
      // Check level-up FIRST — even if queue has items left.
      // Once all three criteria are met, there's no need to finish the queue.
      if (shouldLevelUp(s.score, s.correctNouns, s.recentResults)) {
        const prog = loadProgress();
        const nextLvl = Math.min(MAX_LEVEL, s.level + 1);
        prog.currentLevel = nextLvl;
        prog.sessionQueue = [];
        saveProgress(prog);
        if (nextLvl > MAX_LEVEL) {
          return { session: { ...s, level: nextLvl }, newPhase: 'done' };
        }
        return { session: { ...s, level: nextLvl }, newPhase: 'levelup' };
      }

      const ns = nextChallenge(s);
      if (!ns.currentChallenge && ns.queue.length === 0) {
        // Queue exhausted without meeting level-up — rebuild for same level
        const prog = loadProgress();
        const rebuilt = createSession(prog.currentLevel);
        return { session: rebuilt, newPhase: 'selecting' };
      }
      return { session: ns };
    },
    [],
  );

  /**
   * Animate the card out, then run the session transition.
   * Used for normal advances; repair completion advances instantly.
   */
  const animateAdvance = useCallback(
    (advance: () => void) => {
      if (advancing.current) return;
      advancing.current = true;
      setCardAnim('leaving');
      advanceTimer.current = window.setTimeout(() => {
        advance();
        setCardAnim('entering');
        advancing.current = false;
        advanceTimer.current = null;
      }, CARD_LEAVE_MS);
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
          animateAdvance(() => setPhase('repairing'));
          return;
        }
      }
    }

    animateAdvance(() => {
      const { session: newSess, newPhase } = advanceOrRefill(session);
      setSession(newSess);
      setPhase(newPhase ?? 'selecting');
    });
  }, [answer, session, advanceOrRefill, animateAdvance]);

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
      // Instant advance (RepairShop already has its own completion delay)
      const { session: newSess, newPhase } = advanceOrRefill(session);
      setSession(newSess);
      setPhase(newPhase ?? 'selecting');
      setAnswer(null);
      setCardAnim('entering');
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
    setCardAnim('entering');
  }, [session.level]);

  const onSelectLevel = useCallback(
    (level: number) => {
      if (level === session.level) {
        setActiveTab('oefenen');
        return;
      }
      const prog = loadProgress();
      prog.currentLevel = level;
      prog.sessionQueue = [];
      saveProgress(prog);
      const ns = createSession(level);
      const withFirst = ns.queue.length > 0 ? nextChallenge(ns) : ns;
      setSession(withFirst);
      setPhase('selecting');
      setAnswer(null);
      setRepairChallenge(null);
      setCardAnim('entering');
      setActiveTab('oefenen');
    },
    [session.level],
  );

  // Theme quick-toggle cycle: light → dark → system → light
  const cycleTheme = useCallback(() => {
    setThemeState((cur) => {
      const next: ProgressStore['theme'] =
        cur === 'light' ? 'dark' : cur === 'dark' ? 'system' : 'light';
      updateTheme(next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  // Keyboard shortcuts: 1/2 answer, Enter/Space advance.
  // Match on e.code (layout-independent) so non-US keyboards work too.
  useEffect(() => {
    const DIGITS: Record<string, number> = {
      Digit1: 1,
      Digit2: 2,
      Numpad1: 1,
      Numpad2: 2,
    };

    function onKey(e: KeyboardEvent) {
      if (showTour || showSettings || activeTab !== 'oefenen') return;
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (typing) return;

      if (phase === 'selecting') {
        const n = DIGITS[e.code] ?? parseInt(e.key, 10);
        if (n >= 1 && n <= 2) {
          const btns = document.querySelectorAll<HTMLButtonElement>('.option-btn');
          const btn = btns[n - 1];
          if (btn && !btn.disabled) {
            e.preventDefault();
            btn.click();
          }
        }
      } else if (phase === 'answered') {
        if (e.key === 'Enter' || e.code === 'Enter' || e.key === ' ' || e.code === 'Space' || e.code === 'NumpadEnter') {
          e.preventDefault();
          onNext();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onKey);
    };
  }, [showTour, showSettings, activeTab, phase, onNext]);

  const ch =
    phase === 'repairing' && repairChallenge
      ? repairChallenge
      : session.currentChallenge;

  // Expose current challenge for E2E tests
  (window as unknown as Record<string, unknown>).__currentChallenge = ch;

  const attempts = session.score.correct + session.score.wrong;
  const distinctNouns = new Set(session.correctNouns).size;

  const themeIcon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻';
  const themeLabel =
    theme === 'light' ? 'Licht' : theme === 'dark' ? 'Donker' : 'Systeem';

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">DH</div>
          <div className="brand-copy">
            <h1>De/Het Trainer</h1>
            <p>Nederlandse geslachtsregels</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="level-chip"
            onClick={() => setActiveTab('leerpad')}
            aria-label="Open leerpad"
            title={`Niveau ${session.level} · ${getLevelName(session.level)}`}
          >
            <span className="dot" aria-hidden="true" />
            <span>Niveau {session.level}</span>
          </button>
          <button
            className="icon-btn"
            onClick={cycleTheme}
            title={`Thema: ${themeLabel}`}
            aria-label={`Thema: ${themeLabel}`}
          >
            {themeIcon}
          </button>
          <button
            className="icon-btn tour-btn"
            onClick={() => setShowTour(true)}
            title="Tour"
            aria-label="Open tour"
          >
            ?
          </button>
          <button
            className="icon-btn settings-btn"
            onClick={() => setShowSettings((s) => !s)}
            title="Settings"
            aria-label="Instellingen"
          >
            ⚙️
          </button>
        </div>
      </header>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Views */}
      <div className="views">
        {/* ===== Oefenen ===== */}
        <div className={`view${activeTab === 'oefenen' ? ' active' : ''}`}>
          {session.level === MAX_LEVEL ? (
            <PhraseScreen />
          ) : (
            <>
          <GaugeRow
            attempts={attempts}
            distinctNouns={distinctNouns}
            recentResults={session.recentResults}
          />

          <LevelShimmerBar
            level={session.level}
            attempts={attempts}
            distinctNouns={distinctNouns}
            recentResults={session.recentResults}
          />

          <div className="card-stage">
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
                  Je beheerst alle zeven niveaus. Begin opnieuw of
                  exporteer je voortgang.
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
                    setCardAnim('entering');
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
                key={ch.challengeId}
                className={`challenge-card ${cardAnim} ${
                  answer ? (answer.correct ? 'correct' : 'incorrect') : ''
                }`}
              >
                {/* Sentence display */}
                <SentenceCanvas
                  challenge={ch}
                  selectedAnswer={answer?.chosen ?? null}
                  phase={phase}
                  sentenceTranslation={
                    loadProgress().showTranslation
                      ? ch.sentenceTranslation
                      : undefined
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
                      <CompoundStems explanation={ch.explanation} />
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
          </div>
            </>
          )}
        </div>

        {/* ===== Leerpad ===== */}
        {activeTab === 'leerpad' && (
          <LevelPathView
            currentLevel={session.level}
            onSelectLevel={onSelectLevel}
          />
        )}

        {/* ===== Voortgang ===== */}
        {activeTab === 'voortgang' && <StatsView streak={session.streak} />}
      </div>

      {/* Bottom tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {showTour && <Tour onDone={() => setShowTour(false)} />}
    </div>
  );
}

/**
 * Parse a compound challenge explanation and render a visual stem breakdown.
 * Explanation format: '"tafellaken" is een samenstelling van tafel (de) + laken (het)...'
 */
function CompoundStems({ explanation }: { explanation: string }) {
  // Match: "X" is een samenstelling van Y (art) + Z (art)
  const match = explanation.match(/"(\w+)" is een samenstelling van (\w+) \((\w+)\) \+ (\w+) \((\w+)\)/);
  if (!match) {
    // Try reverse format: "Glas" is een het-woord... geen samenstelling
    // Or alternate format for non-compound explanations
    return null;
  }

  const [, compound, stem1, art1, stem2, art2] = match;
  const isLastHet = art2 === 'het' || art2.includes('het');
  const isLastDe = art2 === 'de' || art2.includes('de');
  const decisiveArt = isLastHet ? 'Het' : isLastDe ? 'De' : art2;

  return (
    <div className="compound-stems">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
        <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginRight: '.15rem' }}>
          {art1 === 'de' ? 'De' : 'Het'}
        </span>
        <span style={{ fontWeight: 400 }}>{stem1}</span>
      </span>
      <span style={{ margin: '0 .35rem', color: 'var(--text-muted)' }}>+</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
        <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginRight: '.15rem' }}>
          {isLastHet ? 'Het' : isLastDe ? 'De' : art2}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
          {stem2}
        </span>
      </span>
      <span style={{ margin: '0 .5rem', color: 'var(--text-muted)', fontWeight: 700 }}>=</span>
      <span style={{ fontWeight: 700, color: isLastHet ? 'var(--correct)' : 'var(--accent)' }}>
        {decisiveArt} {compound}
      </span>
      <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.35rem' }}>
        ⬆️ Het <strong>laatste woord</strong> ({stem2}) bepaalt het geslacht
      </div>
    </div>
  );
}
