import { useMemo } from 'react';

interface Particle {
  left: number; // vw
  size: number; // px
  duration: number; // s
  delay: number; // s (negative to start mid-flight)
  sway: number; // px
  opacity: number;
  colorIndex: number;
}

const PARTICLE_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--gold)'];
const PARTICLE_COUNT = 14;

/** Ambient animated background: three drifting blobs + subtle rising particles. */
export function BackgroundFX() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const duration = 22 + Math.random() * 22;
      return {
        left: Math.random() * 100,
        size: 3 + Math.random() * 5,
        duration,
        delay: -Math.random() * duration,
        sway: (Math.random() - 0.5) * 140,
        opacity: 0.15 + Math.random() * 0.25,
        colorIndex: i % PARTICLE_COLORS.length,
      };
    });
  }, []);

  return (
    <div className="ambient" aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      {particles.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={
            {
              left: `${p.left}vw`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: PARTICLE_COLORS[p.colorIndex],
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--p-sway': `${p.sway}px`,
              '--p-opacity': p.opacity,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
