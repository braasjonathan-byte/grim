import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { Loader2, ArrowDown } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 110;

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

/** Diskret pull-to-refresh för scrollade fliksidor (Hem, Statistik, Social). */
const PullToRefresh = ({ onRefresh, children, disabled }: PullToRefreshProps) => {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const atTop = () =>
    (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

  const handleStart = (e: TouchEvent) => {
    if (disabled || refreshing || !atTop()) return;
    startY.current = e.touches[0].clientY;
  };

  const handleMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0 || !atTop()) {
      setPull(0);
      startY.current = null;
      return;
    }
    // Resistance
    setPull(Math.min(MAX_PULL, delta * 0.5));
  };

  const handleEnd = async () => {
    const shouldRefresh = pull >= THRESHOLD;
    startY.current = null;
    if (!shouldRefresh) {
      setPull(0);
      return;
    }
    setRefreshing(true);
    setPull(THRESHOLD * 0.6);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, 400);
    }
  };

  const active = pull > 0 || refreshing;

  return (
    <div
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      <div
        className="overflow-hidden flex items-end justify-center transition-[height] duration-200"
        style={{ height: active ? Math.max(pull, refreshing ? 36 : 0) : 0 }}
        aria-hidden={!active}
      >
        <div
          className="mb-2 h-7 w-7 rounded-full bg-card border border-border/70 shadow-sm flex items-center justify-center text-primary"
          style={{ opacity: Math.min(1, pull / THRESHOLD + (refreshing ? 1 : 0)) }}
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowDown
              className="w-3.5 h-3.5 transition-transform duration-200"
              style={{ transform: pull >= THRESHOLD ? "rotate(180deg)" : "none" }}
            />
          )}
        </div>
      </div>
      {/* No transform here: any transform (even identity) makes this element a
          containing block for `position: fixed` children, which would detach the
          chat composer from the viewport bottom. */}
      <div>{children}</div>

      <span className="sr-only" role="status">
        {refreshing ? "Uppdaterar…" : ""}
      </span>
    </div>
  );
};

export default PullToRefresh;
