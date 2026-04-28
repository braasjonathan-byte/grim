import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, Minimize2 } from "lucide-react";

const MiniTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"stopwatch" | "countdown">("stopwatch");
  const [label, setLabel] = useState("Timer");
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (mode === "countdown") {
            if (s <= 1) {
              setRunning(false);
              return 0;
            }
            return s - 1;
          }
          return s + 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  useEffect(() => {
    const startRestTimer = (event: Event) => {
      const detail = (event as CustomEvent<{ seconds?: number; label?: string }>).detail;
      const configuredSeconds = localStorage.getItem("grim_set_rest_timer_seconds") || "90";
      const startSeconds = Math.max(1, Math.round(Number(detail?.seconds ?? configuredSeconds) || 0));
      if (!startSeconds) return;
      setMode("countdown");
      setLabel(detail?.label || "Vila");
      setSeconds(startSeconds);
      setRunning(true);
      setExpanded(false);
    };
    window.addEventListener("grim:start-rest-timer", startRestTimer);
    return () => window.removeEventListener("grim:start-rest-timer", startRestTimer);
  }, []);

  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">{mode === "countdown" ? label : "Timer"}</p>
            <p className="text-sm font-semibold text-primary">{running ? "Aktiv" : "Pausad"}</p>
          </div>
          <button
            onClick={() => setFullscreen(false)}
            className="flex h-12 w-12 items-center justify-center border border-border bg-secondary text-foreground"
            aria-label="Minimera timer"
          >
            <Minimize2 className="h-6 w-6" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-10 px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
          <span className={`font-mono text-7xl font-black tracking-wider sm:text-8xl ${running ? "text-primary" : "text-foreground"}`}>
            {fmt(seconds)}
          </span>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <button
              onClick={() => setRunning(!running)}
              className={`flex h-24 flex-col items-center justify-center gap-2 border text-lg font-black ${
                running ? "border-primary bg-primary/20 text-primary" : "border-primary bg-primary text-primary-foreground"
              }`}
            >
              {running ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
              {running ? "Pausa" : "Starta"}
            </button>
            <button
              onClick={() => { setRunning(false); setSeconds(0); setMode("stopwatch"); setLabel("Timer"); }}
              className="flex h-24 flex-col items-center justify-center gap-2 border border-border bg-secondary text-lg font-black text-foreground"
            >
              <RotateCcw className="h-8 w-8" />
              Nollställ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Collapsed: single thin bar
  if (!expanded) {
    return (
      <div
        className="fixed left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-1.5 bg-card/95 backdrop-blur border-t border-primary/20 cursor-pointer"
        style={{
          bottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
          transform: "translate3d(0,0,0)",
          WebkitTransform: "translate3d(0,0,0)",
          willChange: "transform",
        }}
        onClick={() => setExpanded(true)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setRunning(!running); }}
          className="w-6 h-6 bg-primary/20 text-primary flex items-center justify-center"
        >
          {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-px" />}
        </button>
        <span className={`font-mono text-sm font-bold tracking-wider ${running ? "text-primary" : "text-foreground"}`}>
          {fmt(seconds)}
        </span>
        {mode === "countdown" && <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>}
        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    );
  }

  // Expanded
  return (
    <div
      className="fixed left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-primary/20 px-4 py-3 cursor-pointer"
      style={{
        bottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
        transform: "translate3d(0,0,0)",
        WebkitTransform: "translate3d(0,0,0)",
        willChange: "transform",
      }}
      onClick={() => setExpanded(false)}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="text-muted-foreground p-1">
          <ChevronDown className="w-4 h-4" />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); setRunning(!running); }}
            className={`w-12 h-12 flex items-center justify-center transition-colors ${
              running ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground"
            }`}
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="text-center">
            {mode === "countdown" && <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>}
            <span className={`font-mono text-2xl font-black tracking-wider ${running ? "text-primary" : "text-foreground"}`}>
              {fmt(seconds)}
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setRunning(false); setSeconds(0); setMode("stopwatch"); setLabel("Timer"); }}
            className="w-10 h-10 bg-secondary text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
          className="flex h-10 w-10 items-center justify-center bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Maximera timer"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default MiniTimer;
