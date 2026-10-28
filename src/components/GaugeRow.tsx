interface Props {
  attempts: number;
  distinctNouns: number;
  /** Last N results (true = correct, false = wrong). Used for rolling accuracy. */
  recentResults: boolean[];
}

const R = 17;
const C = 2 * Math.PI * R; // ~106.8

/**
 * Three circular gauges showing the level-up criteria:
 * - ≥16 pogingen (total attempts)
 * - ≥8 zelfstandige naamwoorden (distinct nouns correct)
 * - ≥80% juist (rolling accuracy over last 20 answers)
 */
export function GaugeRow({ attempts, distinctNouns, recentResults }: Props) {
  const recentCorrect = recentResults.filter(Boolean).length;
  const rollingAccuracy =
    recentResults.length >= 8
      ? recentCorrect / recentResults.length
      : attempts > 0
        ? recentCorrect / Math.max(1, recentResults.length)
        : 0;

  const accuracyMet =
    recentResults.length >= 8
      ? rollingAccuracy >= 0.8
      : attempts >= 16 && rollingAccuracy >= 0.8;

  const gauges = [
    {
      name: 'Pogingen',
      value: attempts,
      target: 16,
      met: attempts >= 16,
      unit: '',
      color: 'var(--accent)',
    },
    {
      name: 'Naamwoorden',
      value: distinctNouns,
      target: 8,
      met: distinctNouns >= 8,
      unit: '',
      color: '#0ea5e9',
    },
    {
      name: 'Juist',
      value: Math.round(rollingAccuracy * 100),
      target: 80,
      met: accuracyMet,
      unit: '%',
      color: '#10b981',
    },
  ];

  return (
    <div className="gauge-row">
      {gauges.map((g, i) => {
        const pct = Math.min(100, (g.value / g.target) * 100);
        const offset = C - (pct / 100) * C;
        const stroke = g.met ? 'var(--correct)' : g.color;
        return (
          <div key={g.name} className={`gauge${g.met ? ' met' : ''}`}>
            <div className="gauge-ring">
              <svg width="42" height="42" viewBox="0 0 42 42">
                <circle className="gauge-track" cx="21" cy="21" r={R} />
                <circle
                  className="gauge-fill"
                  data-gauge={i}
                  cx="21"
                  cy="21"
                  r={R}
                  stroke={stroke}
                  strokeDasharray={C.toFixed(2)}
                  strokeDashoffset={offset.toFixed(2)}
                />
              </svg>
              <div className="gauge-inner" style={{ color: stroke }}>
                {g.value}
                {g.unit}
              </div>
            </div>
            <div className="gauge-copy">
              <span className="gauge-name">{g.name}</span>
              <span className="gauge-sub">doel {g.target}{g.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
