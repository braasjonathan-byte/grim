import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, X } from "lucide-react";
import { useHeartRate } from "@/hooks/useHeartRate";

const POS_KEY = "grim_hr_widget_pos_v1";
const SIZE = { w: 108, h: 64 };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const loadPos = () => {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p?.x === "number" && typeof p?.y === "number") return p as { x: number; y: number };
    }
  } catch { /* ignore */ }
  return null;
};

/** Flyttbar pulsruta som visas globalt när en pulsmätare är ansluten. */
const HeartRateWidget = () => {
  const hr = useHeartRate();
  const [pos, setPos] = useState<{ x: number; y: number }>(() => loadPos() ?? { x: 12, y: 120 });
  const dragging = useRef<{ dx: number; dy: number } | null>(null);
  const moved = useRef(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (hr.connected) setHidden(false);
  }, [hr.connected]);

  // Håll rutan innanför skärmen vid rotation/resize
  useEffect(() => {
    const onResize = () =>
      setPos((p) => ({
        x: clamp(p.x, 4, Math.max(4, window.innerWidth - SIZE.w - 4)),
        y: clamp(p.y, 4, Math.max(4, window.innerHeight - SIZE.h - 4)),
      }));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    moved.current = true;
    setPos({
      x: clamp(e.clientX - dragging.current.dx, 4, window.innerWidth - SIZE.w - 4),
      y: clamp(e.clientY - dragging.current.dy, 4, window.innerHeight - SIZE.h - 4),
    });
  };

  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = null;
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
  };

  if (!hr.connected || hidden || typeof document === "undefined") return null;

  const bpm = hr.bpm;

  return createPortal(
    <div
      role="status"
      aria-label={`Puls ${bpm ?? "–"} slag per minut`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ left: pos.x, top: pos.y, width: SIZE.w, touchAction: "none" }}
      className="fixed z-[80] select-none rounded-2xl border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-lg cursor-grab active:cursor-grabbing"
    >
      <button
        type="button"
        aria-label="Dölj pulsruta"
        onClick={() => { if (!moved.current) setHidden(true); }}
        className="absolute -right-2 -top-2 rounded-full bg-muted text-muted-foreground p-1 shadow"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-center gap-2">
        <Heart
          className="h-5 w-5 text-destructive"
          style={bpm ? { animation: `pulse-beat ${Math.max(0.35, 60 / bpm)}s ease-in-out infinite` } : undefined}
          fill="currentColor"
        />
        <div className="leading-none">
          <div className="text-xl font-bold text-foreground tabular-nums">{bpm ?? "–"}</div>
          <div className="text-[10px] text-muted-foreground">bpm</div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HeartRateWidget;
