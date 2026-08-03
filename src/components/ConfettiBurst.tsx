import { useMemo } from "react";

interface ConfettiBurstProps {
  /** Number of particles */
  count?: number;
  /** Extra classes on the wrapper */
  className?: string;
}

const COLORS = [
  "hsl(var(--success))",
  "hsl(var(--primary))",
  "hsl(45 95% 55%)",
  "hsl(35 95% 60%)",
  "hsl(var(--foreground))",
];

/**
 * Lightweight DOM confetti burst. Absolutely positioned, pointer-events none.
 * Renders once and self-animates via CSS; unmount it after ~1s.
 */
const ConfettiBurst = ({ count = 14, className = "" }: ConfettiBurstProps) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * (0.15 + 0.7 * (i / Math.max(1, count - 1)))) * -1; // upward fan
        const dist = 26 + Math.random() * 46;
        return {
          x: Math.cos(angle) * dist * (Math.random() < 0.5 ? -1 : 1),
          y: Math.sin(angle) * dist,
          rot: Math.round(Math.random() * 360),
          delay: Math.random() * 90,
          color: COLORS[i % COLORS.length],
          size: 4 + Math.round(Math.random() * 4),
        };
      }),
    [count],
  );

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-visible ${className}`} aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              backgroundColor: p.color,
              width: p.size,
              height: p.size * 1.6,
              animationDelay: `${p.delay}ms`,
              ["--cx" as string]: `${p.x}px`,
              ["--cy" as string]: `${p.y}px`,
              ["--cr" as string]: `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};

export default ConfettiBurst;
