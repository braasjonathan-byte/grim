import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";

const MiniTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Collapsed: single thin bar
  if (!expanded) {
    return (
      <div
        className="fixed left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-1.5 bg-card/95 backdrop-blur border-t border-primary/20 cursor-pointer"
        style={{ bottom: `calc(60px + env(safe-area-inset-bottom, 0px))` }}
        onClick={() => setExpanded(true)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setRunning(!running); }}
          className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center"
        >
          {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-px" />}
        </button>
        <span className={`font-mono text-sm font-bold tracking-wider ${running ? "text-primary" : "text-foreground"}`}>
          {fmt(seconds)}
        </span>
        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    );
  }

  // Expanded
  return (
    <div
      className="fixed left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-primary/20 px-4 py-3"
      style={{ bottom: `calc(60px + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <button onClick={() => setExpanded(false)} className="text-muted-foreground p-1">
          <ChevronDown className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning(!running)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              running ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground"
            }`}
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <span className={`font-mono text-2xl font-black tracking-wider ${running ? "text-primary" : "text-foreground"}`}>
            {fmt(seconds)}
          </span>

          <button
            onClick={() => { setRunning(false); setSeconds(0); }}
            className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-6" />
      </div>
    </div>
  );
};

export default MiniTimer;
