import { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";

const WorkoutTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const formatTime = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary">
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Timer</h3>
      </div>

      <div className="text-center">
        <span className="text-4xl font-mono font-black tracking-wider text-foreground">
          {formatTime(seconds)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setRunning(!running)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            running
              ? "bg-warning text-warning-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setSeconds(0);
          }}
          className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default WorkoutTimer;
