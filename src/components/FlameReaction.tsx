import { useState } from "react";
import { Flame } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

interface FlameReactionProps {
  active: boolean;
  count: number;
  onToggle: () => void;
}

const PARTICLES = [-70, -45, -20, 0, 20, 45, 70];

const FlameReaction = ({ active, count, onToggle }: FlameReactionProps) => {
  const [burst, setBurst] = useState(0);

  const handleClick = () => {
    if (!active) {
      hapticLight();
      const reduced = typeof window !== "undefined"
        && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        setBurst((n) => n + 1);
        window.setTimeout(() => setBurst(0), 700);
      }
    }
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label="Elda passet"
      className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
        active
          ? "border-warning/40 bg-warning/15 text-warning"
          : "border-border bg-secondary/60 text-muted-foreground hover:bg-accent"
      }`}
    >
      <span className="relative inline-flex">
        <Flame className={`w-4 h-4 ${active ? "fill-current" : ""} ${burst ? "flame-pop" : ""}`} />
        {burst > 0 && (
          <span key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {PARTICLES.map((deg, i) => (
              <span
                key={i}
                className="flame-spark"
                style={{ ["--spark-angle" as string]: `${deg}deg`, animationDelay: `${i * 20}ms` }}
              />
            ))}
          </span>
        )}
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
};

export default FlameReaction;
