import { loadProgress } from '../engine/progress.ts';
import { getLevelMasteries } from '../engine/levelMastery.ts';

interface Props {
  /** Current session streak. */
  streak: number;
}

/** Voortgang view: lifetime stats + per-level mastery bars. */
export function StatsView({ streak }: Props) {
  const progress = loadProgress();
  const levels = getLevelMasteries();

  return (
    <div className="view-inner">
      <div className="stats-grid">
        <div className="stat-card g">
          <div className="num">{progress.totalCorrect}</div>
          <div className="lbl">Goed</div>
        </div>
        <div className="stat-card f">
          <div className="num">{progress.totalWrong}</div>
          <div className="lbl">Fout</div>
        </div>
        <div className="stat-card s">
          <div className="num">{streak}</div>
          <div className="lbl">Reeks</div>
        </div>
      </div>

      <div className="mastery-list">
        {levels.map((l) => (
          <div key={l.level} className={`mastery-row${l.completed ? ' full' : ''}`}>
            <div className="mastery-top">
              <span>Niveau {l.level}</span>
              <span className="pct">{l.pct}%</span>
            </div>
            <div className="mastery-bar">
              <i style={{ width: `${Math.max(4, l.pct)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
