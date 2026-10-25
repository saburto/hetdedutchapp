interface Props {
  current: number; // 0-based
  total: number;
  results: Array<'correct' | 'wrong' | null>; // historical results for this batch
}

/** Simple 10-dot indicator for the current session batch. */
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
        return <div key={i} className={cls} />;
      })}
    </div>
  );
}