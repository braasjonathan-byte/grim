import { ReactNode, useRef, useState, useEffect } from "react";
import { Check, Trophy, Undo2 } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

interface SwipeableSetRowProps {
  done: boolean;
  onToggle: () => void;
  isPR?: boolean;
  children: ReactNode;
}

const THRESHOLD = 64;

/**
 * Wraps a set row and makes it swipeable:
 *  - swipe right on an open set  -> mark as done
 *  - swipe left on a done set    -> undo
 * Triggers a scale + green colour pulse and haptic feedback on completion.
 */
const SwipeableSetRow = ({ done, onToggle, isPR, children }: SwipeableSetRowProps) => {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<null | "x" | "y">(null);
  const [dx, setDx] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [prPulse, setPrPulse] = useState(false);
  const prevPr = useRef(!!isPR);

  useEffect(() => {
    if (isPR && !prevPr.current) {
      setPrPulse(true);
      const t = setTimeout(() => setPrPulse(false), 700);
      prevPr.current = true;
      return () => clearTimeout(t);
    }
    prevPr.current = !!isPR;
  }, [isPR]);

  const isInteractive = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el?.closest("input, button, textarea, select, [role='checkbox']");
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (isInteractive(e.target)) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    locked.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;
    if (locked.current === null) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      locked.current = Math.abs(deltaX) > Math.abs(deltaY) * 1.4 ? "x" : "y";
    }
    if (locked.current !== "x") return;
    const allowed = done ? Math.min(0, deltaX) : Math.max(0, deltaX);
    setDx(Math.max(-110, Math.min(110, allowed)));
  };

  const finish = () => {
    if (locked.current === "x" && Math.abs(dx) >= THRESHOLD) {
      hapticLight();
      setPulse(true);
      setTimeout(() => setPulse(false), 450);
      onToggle();
    }
    setDx(0);
    startX.current = null;
    startY.current = null;
    locked.current = null;
  };

  const active = Math.abs(dx) >= THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded">
      {/* Reveal layer behind the row – only visible while swiping */}
      {dx !== 0 && (
        <div
          className={`absolute inset-0 flex items-center px-3 transition-colors ${
            done ? "justify-end bg-muted" : "justify-start bg-success/25"
          } ${active ? (done ? "bg-muted" : "bg-success/45") : ""}`}
          aria-hidden
        >
          {done ? (
            <Undo2 className={`w-4 h-4 text-muted-foreground transition-transform ${active ? "scale-110" : "scale-90"}`} />
          ) : (
            <Check className={`w-4 h-4 text-success transition-transform ${active ? "scale-125" : "scale-90"}`} />
          )}
        </div>
      )}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={finish}
        onTouchCancel={finish}
        style={{ transform: `translateX(${dx}px)` }}
        className={`relative touch-pan-y ${dx !== 0 ? "bg-secondary" : "transition-transform duration-200"} ${
          pulse ? "set-complete-pulse" : ""
        }`}
      >
        <div className="flex items-center">
          <div className="flex-1 min-w-0">{children}</div>
          {isPR && (
            <span
              className={`mr-1 flex-shrink-0 inline-flex items-center gap-0.5 rounded-full bg-success/20 text-success text-[9px] font-bold px-1.5 py-0.5 ${
                prPulse ? "pr-badge-pop" : ""
              }`}
              title="Nytt personligt rekord"
            >
              <Trophy className="w-2.5 h-2.5" />
              PR
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwipeableSetRow;
