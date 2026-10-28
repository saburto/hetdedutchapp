import { getLevelName } from '../engine/levelMastery.ts';

interface Props {
  level: number;
  attempts: number;
  distinctNouns: number;
  recentResults: boolean[];
}

/**
 * Single animated shimmer bar showing overall progress of the current
 * level = average of the three level-up criteria.
 */
export function LevelShimmerBar({ level, attempts, distinctNouns, recentResults }: Props) {
  const attemptsPct = Math.min(100, (attempts / 16) * 100);
  const nounsPct = Math.min(100, (distinctNouns / 8) * 100);

  const recentCorrect = recentResults.filter(Boolean).length;
  const rollingAccuracy =
    recentResults.length >= 8
      ? recentCorrect / recentResults.length
      : attempts > 0
        ? recentCorrect / Math.max(1, recentResults.length)
        : 0;
  const accuracyPct = Math.min(100, (rollingAccuracy / 0.8) * 100);

  const overall = Math.round((attemptsPct + nounsPct + accuracyPct) / 3);

  return (
    <div className="level-strip">
      <div className="level-strip-head">
        <span>Niveau {level} · {getLevelName(level)}</span>
        <span className="pct">{overall}%</span>
      </div>
      <div className="level-bar">
        <i style={{ width: `${overall}%` }} />
      </div>
    </div>
  );
}
