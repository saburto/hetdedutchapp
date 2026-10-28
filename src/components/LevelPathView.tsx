import { getLevelMasteries } from '../engine/levelMastery.ts';

interface Props {
  currentLevel: number;
  onSelectLevel: (level: number) => void;
}

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R; // ~113.1

/** Leerpad view: all seven levels with progress rings. Every level is selectable. */
export function LevelPathView({ currentLevel, onSelectLevel }: Props) {
  const levels = getLevelMasteries();

  return (
    <div className="view-inner">
      <div className="path-title">🗺️ Leerpad</div>
      <div className="level-list">
        {levels.map((l) => (
          <div
            key={l.level}
            className={`level-row${l.completed ? ' done' : ''}${l.current ? ' current' : ''}`}
            onClick={() => onSelectLevel(l.level)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectLevel(l.level);
              }
            }}
          >
            <div className="ring">
              <svg width="40" height="40" viewBox="0 0 40 40">
                <circle className="track" cx="20" cy="20" r={RING_R} />
                <circle
                  className="fill"
                  cx="20"
                  cy="20"
                  r={RING_R}
                  strokeDasharray={RING_C.toFixed(1)}
                  strokeDashoffset={(RING_C - (l.pct / 100) * RING_C).toFixed(1)}
                />
              </svg>
              <div className="center">{l.completed ? '✓' : l.level}</div>
            </div>
            <div className="level-copy">
              <div className="name">Niveau {l.level}</div>
              <div className="sub">
                {l.completed
                  ? 'Voltooid!'
                  : l.pct > 0
                    ? `${l.pct}% beheerst`
                    : 'Nog niet gestart'}
              </div>
            </div>
            <span className="level-status">
              {l.completed ? '🏅' : l.current ? '▶' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
