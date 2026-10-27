interface Props {
  attempts: number;
  distinctNouns: number;
  accuracy: number; // 0–1
}

/**
 * Three stacked progress bars showing level-up criteria:
 * - ≥16 pogingen (attempts)
 * - ≥8 zelfstandige naamwoorden (distinct nouns correct)
 * - ≥80% juist (accuracy)
 *
 * Each bar fills left-to-right and turns green when its threshold is met.
 */
export function LevelProgress({ attempts, distinctNouns, accuracy }: Props) {
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
      current: Math.round(accuracy * 100),
      target: 80,
      met: accuracy >= 0.8,
      display: `${Math.round(accuracy * 100)}%`,
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
    </div>
  );
}