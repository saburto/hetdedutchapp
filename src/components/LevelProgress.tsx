interface Props {
  attempts: number;
  distinctNouns: number;
  /** Last N results (true = correct, false = wrong). Used for rolling accuracy. */
  recentResults: boolean[];
}

/**
 * Three stacked progress bars showing level-up criteria:
 * - ≥16 pogingen (total attempts)
 * - ≥8 zelfstandige naamwoorden (distinct nouns correct)
 * - ≥80% juist (rolling accuracy over last 20 answers)
 *
 * Each bar fills left-to-right and turns green when its threshold is met.
 */
export function LevelProgress({ attempts, distinctNouns, recentResults }: Props) {
  // Rolling accuracy: last 20 answers, or total if fewer than 8
  const recentCorrect = recentResults.filter(Boolean).length;
  const rollingAccuracy =
    recentResults.length >= 8
      ? recentCorrect / recentResults.length
      : attempts > 0
        ? (recentCorrect / Math.max(1, recentResults.length))
        : 0;

  const criteria = [
    {
      label: 'Pogingen',
      current: attempts,
      target: 16,
      met: attempts >= 16,
      display: `${Math.min(attempts, 16)}/16`,
    },
    {
      label: 'Naamwoorden',
      current: distinctNouns,
      target: 8,
      met: distinctNouns >= 8,
      display: `${Math.min(distinctNouns, 8)}/8`,
    },
    {
      label: 'Juist',
      current: Math.round(rollingAccuracy * 100),
      target: 80,
      met: recentResults.length >= 8
        ? rollingAccuracy >= 0.8
        : attempts >= 16 && rollingAccuracy >= 0.8,
      display: `${Math.round(rollingAccuracy * 100)}%`,
    },
  ];

  return (
    <div className="level-progress">
      {criteria.map((c) => {
        const pct = Math.min(100, Math.round((c.current / c.target) * 100));
        return (
          <div key={c.label} className={`lp-row${c.met ? ' met' : ''}`}>
            <span className="lp-label">{c.label}</span>
            <div className="lp-track">
              <div
                className="lp-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="lp-value">{c.display}</span>
          </div>
        );
      })}
      {recentResults.length >= 8 && (
        <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '.15rem' }}>
          Op basis van de laatste {recentResults.length} antwoorden
        </div>
      )}
    </div>
  );
}