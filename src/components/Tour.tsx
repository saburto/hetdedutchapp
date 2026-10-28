import { useState, useEffect, useCallback, useRef } from 'react';

// ---- Tour step definition ------------------------------------------------

export interface TourStep {
  /** CSS selector for the element to highlight */
  target: string;
  title: string;
  body: string;
  /** Where to place the tooltip relative to the target: top | bottom | left | right */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

// ---- Default tour steps ------------------------------------------------

const DEFAULT_STEPS: TourStep[] = [
  {
    target: '.brand-mark',
    title: 'Welcome to De/Het Trainer! 👋',
    body: 'This app helps you master Dutch noun genders (de/het) through contextual sentence exercises. Let me show you around!',
    placement: 'bottom',
  },
  {
    target: '.level-chip',
    title: 'Your Level',
    body: 'There are 6 levels, each focusing on a different Dutch grammatical rule. This chip shows the level you are practising right now.',
    placement: 'bottom',
  },
  {
    target: '.settings-btn',
    title: 'Settings & Theme',
    body: 'Click the gear icon for settings: theme (light/dark/system), Dutch audio, English translations, and export/import. The 🌓 button next to it quickly cycles the theme.',
    placement: 'bottom',
  },
  {
    target: '.gauge-row',
    title: 'Level-Up Gauges',
    body: 'Three circular gauges show what you need to unlock the next level: at least 16 attempts, 8 distinct nouns answered correctly, and 80% accuracy. Each gauge turns green when its goal is met!',
    placement: 'bottom',
  },
  {
    target: '.challenge-card',
    title: 'The Challenge',
    body: 'Each exercise shows a Dutch sentence with a missing modifier. Choose the correct form based on the hidden noun\'s gender.',
    placement: 'top',
  },
  {
    target: '.translation-badge',
    title: 'English Translation',
    body: 'Stuck on a sentence? Click the EN badge to reveal the English translation inline, right under the sentence.',
    placement: 'bottom',
  },
  {
    target: '.modifier-options',
    title: 'Pick an Option',
    body: 'Two options are shown in random order. Pick the one that agrees with the noun — or press 1 or 2 on your keyboard. If you\'re wrong, a 3-stage repair loop will help you learn the rule.',
    placement: 'top',
  },
  {
    target: '.level-strip',
    title: 'Level Progress',
    body: 'This shimmer bar shows your overall progress on the current level — the average of the three gauges above.',
    placement: 'top',
  },
  {
    target: '.tabbar',
    title: 'Three Views',
    body: 'Switch between Oefenen (practice), Leerpad (the six levels — click any level to jump straight to it), and Voortgang (your lifetime stats and per-level mastery).',
    placement: 'top',
  },
  {
    target: '.app-footer',
    title: 'Ready to Go! 🎉',
    body: 'That\'s it! Click the "?" button anytime to replay this tour. Veel success — good luck mastering de and het!',
    placement: 'top',
  },
];

// ---- Hook: check if element is visible ----------------------------------

function useIsVisible(selector: string | null): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!selector) {
      setVisible(false);
      return;
    }
    // Small delay so DOM has settled after step change
    const id = setTimeout(() => {
      const el = document.querySelector(selector);
      setVisible(!!el);
    }, 50);
    return () => clearTimeout(id);
  }, [selector]);

  return visible;
}

// ---- Component ----------------------------------------------------------

interface Props {
  steps?: TourStep[];
  /** Called when the user closes the tour (click X, Done, or backdrop) */
  onDone: () => void;
}

export function Tour({ steps = DEFAULT_STEPS, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const currentStep = steps[index] ?? null;
  const targetVisible = useIsVisible(currentStep?.target ?? null);

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Scroll target into view when step changes
  useEffect(() => {
    if (!currentStep) return;
    const id = setTimeout(() => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    return () => clearTimeout(id);
  }, [currentStep]);

  // Keyboard: Esc = close, arrows = nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDone();
      if (e.key === 'ArrowRight' && !isLast) setIndex((i) => i + 1);
      if (e.key === 'ArrowLeft' && !isFirst) setIndex((i) => i - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone, isFirst, isLast]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  }, [isLast, onDone]);

  // ---- Position the tooltip near the target ----------------------------

  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!currentStep || !targetVisible) return;
    const id = setTimeout(() => {
      const target = document.querySelector(currentStep.target);
      const tooltip = tooltipRef.current;
      if (!target || !tooltip) return;

      const tRect = target.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();
      const placement = currentStep.placement ?? 'bottom';
      const gap = 16;

      let top: number;
      let left: number;

      switch (placement) {
        case 'top':
          top = tRect.top - tipRect.height - gap;
          left = tRect.left + tRect.width / 2 - tipRect.width / 2;
          break;
        case 'bottom':
          top = tRect.bottom + gap;
          left = tRect.left + tRect.width / 2 - tipRect.width / 2;
          break;
        case 'left':
          top = tRect.top + tRect.height / 2 - tipRect.height / 2;
          left = tRect.left - tipRect.width - gap;
          break;
        case 'right':
          top = tRect.top + tRect.height / 2 - tipRect.height / 2;
          left = tRect.right + gap;
          break;
      }

      // Keep tooltip within viewport
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 12;
      if (left < margin) left = margin;
      if (left + tipRect.width > vw - margin) left = vw - tipRect.width - margin;
      if (top < margin) top = margin;
      if (top + tipRect.height > vh - margin) top = vh - tipRect.height - margin;

      setTooltipStyle({
        position: 'fixed',
        top: Math.round(top),
        left: Math.round(left),
        zIndex: 10002,
      });
    }, 100);
    return () => clearTimeout(id);
  }, [currentStep, targetVisible]);

  // ---- Render ----------------------------------------------------------

  if (!currentStep) return null;

  return (
    <>
      {/* Backdrop — closes on click */}
      <div
        className="tour-backdrop"
        onClick={onDone}
        onKeyDown={undefined}
        role="presentation"
      />

      {/* Highlight ring around target */}
      {targetVisible && (
        <TargetHighlight selector={currentStep.target} />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="tour-tooltip"
        style={tooltipStyle}
        role="dailog"
        aria-label={currentStep.title}
      >
        <div className="tour-tooltip-header">
          <span className="tour-step-counter">
            {index + 1} / {steps.length}
          </span>
          <button className="tour-close-btn" onClick={onDone} aria-label="Close tour">
            ✕
          </button>
        </div>
        <h3 className="tour-tooltip-title">{currentStep.title}</h3>
        <p className="tour-tooltip-body">{currentStep.body}</p>
        <div className="tour-tooltip-footer">
          {!isFirst ? (
            <button className="tour-nav-btn tour-prev" onClick={prev}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button className="tour-nav-btn tour-next" onClick={next}>
            {isLast ? 'Done ✓' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Target highlight (ring overlay) -------------------------------

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

function TargetHighlight({ selector }: { selector: string }) {
  const [rect, setRect] = useState<HighlightRect | null>(null);

  useEffect(() => {
    function update() {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        const br = parseInt(getComputedStyle(el).borderRadius) || 0;
        setRect({
          top: r.top - 6,
          left: r.left - 6,
          width: r.width + 12,
          height: r.height + 12,
          borderRadius: br + 6,
        });
      }
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    const id = setInterval(update, 200); // poll for layout shifts
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      clearInterval(id);
    };
  }, [selector]);

  if (!rect) return null;

  return (
    <div
      className="tour-highlight"
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: rect.borderRadius,
        zIndex: 10001,
      }}
    />
  );
}