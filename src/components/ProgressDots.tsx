interface Props {
  current: number; // 0-based
  total: number;
  results: Array<'correct' | 'wrong' | null>; // historical results for this batch
}

const R = 5; // circle radius
const C = 31.4; // circumference = 2π × 5 ≈ 31.4

/** Animated SVG dot indicator for the current session batch. */
export function ProgressDots({ current, total, results }: Props) {
  return (
    <div className="progress-dots">
      {Array.from({ length: total }, (_, i) => {
        let cls = 'progress-dot';
        if (i < current) {
          const res = results[i] ?? 'correct';
          cls += ` ${res}`;
        } else if (i === current) {
          cls += ' active';
        }
        return (
          <div key={i} className={cls}>
            <svg viewBox="0 0 12 12" width="12" height="12">
              <circle className="track" cx="6" cy="6" r={R} />
              <circle className="fill" cx="6" cy="6" r={R} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}