import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, Minimize2, Settings, Hourglass, TimerReset, Heart, HeartOff } from "lucide-react";
import { hapticAlarm } from "@/lib/haptics";
import { useHeartRate } from "@/hooks/useHeartRate";

type Mode = "stopwatch" | "countdown";

const MODE_KEY = "grim_mini_timer_mode";
const COUNTDOWN_KEY = "grim_mini_timer_countdown_seconds";

const playAlarmBeep = () => {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = freq;
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    };
    // Alarm pattern: 4 short loud beeps
    [0, 0.25, 0.5, 0.75].forEach((s) => playTone(1100, s, 0.18));
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* ignore */ }
};

const triggerLocalNotification = async (label: string) => {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts: NotificationOptions = {
      body: `${label} – tiden är ute!`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "grim-timer-alarm",
      requireInteraction: true,
      data: { url: "/" },
    };
    if ("vibrate" in navigator) {
      (opts as any).vibrate = [400, 200, 400, 200, 400];
    }
    if (reg && reg.showNotification) {
      await reg.showNotification("⏰ Timern är klar", opts);
    } else {
      new Notification("⏰ Timern är klar", opts);
    }
  } catch { /* ignore */ }
};

const MiniTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) as Mode) || "stopwatch");
  const [label, setLabel] = useState("Timer");
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [countdownDefault, setCountdownDefault] = useState<number>(() => {
    const v = Number(localStorage.getItem(COUNTDOWN_KEY));
    return Number.isFinite(v) && v > 0 ? v : 60;
  });
  const intervalRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const hr = useHeartRate();

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(COUNTDOWN_KEY, String(countdownDefault));
  }, [countdownDefault]);

  // Initialize seconds when mode changes (and not running)
  useEffect(() => {
    if (running) return;
    setSeconds(mode === "countdown" ? countdownDefault : 0);
  }, [mode, countdownDefault, running]);

  const handleAlarm = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    hapticAlarm();
    if (document.visibilityState === "visible") {
      playAlarmBeep();
    } else {
      triggerLocalNotification(label || "Timer");
      // Also try to beep in case audio context still alive
      playAlarmBeep();
    }
  };

  // Broadcast active state for the bottom-nav pulse indicator
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("grim:timer-state", { detail: { running, mode } }));
  }, [running, mode]);

  useEffect(() => {
    if (running) {
      finishedRef.current = false;
      intervalRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (mode === "countdown") {
            if (s <= 1) {
              setRunning(false);
              handleAlarm();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  // Request notification permission lazily when user picks countdown mode
  useEffect(() => {
    if (mode === "countdown" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [mode]);

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

  const resetTimer = () => {
    setRunning(false);
    finishedRef.current = false;
    if (mode === "countdown") {
      setSeconds(countdownDefault);
      setLabel("Timer");
    } else {
      setSeconds(0);
      setLabel("Timer");
    }
  };

  const switchMode = (next: Mode) => {
    setRunning(false);
    finishedRef.current = false;
    setMode(next);
    setLabel(next === "countdown" ? "Timer" : "Timer");
  };

  // Settings panel content (shared between expanded + fullscreen)
  const SettingsPanel = () => {
    const [mins, setMins] = useState(Math.floor(countdownDefault / 60));
    const [secs, setSecs] = useState(countdownDefault % 60);
    const apply = () => {
      const total = Math.max(1, mins * 60 + secs);
      setCountdownDefault(total);
      if (mode === "countdown" && !running) setSeconds(total);
      setSettingsOpen(false);
    };
    return (
      <div className="space-y-3 border border-border bg-card p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchMode("stopwatch")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold border ${
              mode === "stopwatch" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border"
            }`}
          >
            <TimerReset className="w-3.5 h-3.5" /> Stoppur
          </button>
          <button
            onClick={() => switchMode("countdown")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-bold border ${
              mode === "countdown" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border"
            }`}
          >
            <Hourglass className="w-3.5 h-3.5" /> Timer
          </button>
        </div>
        {mode === "countdown" && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Räkna ned från</p>
            <div className="flex items-center gap-2">
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" value={String(mins)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  setMins(Math.max(0, Math.min(999, Number(cleaned) || 0)));
                }}
                className="w-16 bg-background border border-border px-2 py-1.5 text-center font-mono text-sm"
              />
              <span className="text-xs text-muted-foreground">min</span>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" value={String(secs)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  setSecs(Math.max(0, Math.min(59, Number(cleaned) || 0)));
                }}
                className="w-16 bg-background border border-border px-2 py-1.5 text-center font-mono text-sm"
              />
              <span className="text-xs text-muted-foreground">sek</span>
              <button onClick={apply} className="ml-auto px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold">Spara</button>
            </div>
            <p className="text-[10px] text-muted-foreground">När tiden är ute pipar appen om du är inne, annars kommer en notis som larm.</p>
          </div>
        )}
      </div>
    );
  };

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground">{mode === "countdown" ? label : "Stoppur"}</p>
            <p className="text-sm font-semibold text-primary">{running ? "Aktiv" : "Pausad"}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className="flex h-12 w-12 items-center justify-center border border-border bg-secondary text-foreground"
              aria-label="Inställningar"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => setFullscreen(false)}
              className="flex h-12 w-12 items-center justify-center border border-border bg-secondary text-foreground"
              aria-label="Minimera timer"
            >
              <Minimize2 className="h-6 w-6" />
            </button>
          </div>
        </div>
        {settingsOpen && (
          <div className="px-4 pt-3"><SettingsPanel /></div>
        )}
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
              onClick={resetTimer}
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
        className="fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        style={{
          bottom: `calc(72px + env(safe-area-inset-bottom, 0px))`,
          transform: "translate3d(0,0,0)",
          WebkitTransform: "translate3d(0,0,0)",
          willChange: "transform",
        }}
      >
        <div
          className="pointer-events-auto w-full max-w-md flex items-center gap-3 px-3 py-2 rounded-full bg-card/95 backdrop-blur border border-border shadow-lg shadow-black/20 cursor-pointer transition-shadow"
          onClick={() => setExpanded(true)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setRunning(!running); }}
            className={`w-8 h-8 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center transition-colors ${running ? "timer-play-pulse" : ""}`}
            aria-label={running ? "Pausa timer" : "Starta timer"}
          >
            {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-px" />}
          </button>
          <span className={`font-mono text-sm font-bold tracking-wider tabular-nums ${running ? "text-primary" : "text-foreground"}`}>
            {fmt(seconds)}
          </span>
          <span className="text-[10px] font-semibold uppercase text-muted-foreground truncate">
            {mode === "countdown" ? label : "Stoppur"}
          </span>
          {hr.connected && (
            <span className="ml-auto flex items-center gap-1 text-destructive">
              <Heart className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span className="font-mono text-sm font-bold tabular-nums">
                {hr.bpm ?? "--"}
              </span>
            </span>
          )}
          <ChevronUp className={`w-3.5 h-3.5 text-muted-foreground ${hr.connected ? "" : "ml-auto"}`} />
        </div>
      </div>

    );
  }

  // Expanded
  return (
    <div
      className="fixed left-0 right-0 z-50 mx-auto max-w-lg w-[calc(100%-2rem)] rounded-2xl bg-card/95 backdrop-blur border border-border shadow-lg shadow-black/20 px-4 py-3 cursor-pointer"
      style={{
        bottom: `calc(72px + env(safe-area-inset-bottom, 0px))`,
        transform: "translate3d(0,0,0)",
        WebkitTransform: "translate3d(0,0,0)",
        willChange: "transform",
      }}
      onClick={() => setExpanded(false)}
    >
      <div className="max-w-lg mx-auto space-y-2">

        <div className="flex items-center justify-between">
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
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                {mode === "countdown" ? label : "Stoppur"}
              </div>
              <span className={`font-mono text-2xl font-black tracking-wider ${running ? "text-primary" : "text-foreground"}`}>
                {fmt(seconds)}
              </span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); resetTimer(); }}
              className="w-10 h-10 bg-secondary text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setSettingsOpen((v) => !v); }}
              className={`flex h-10 w-10 items-center justify-center ${settingsOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              aria-label="Timer-inställningar"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
              className="flex h-10 w-10 items-center justify-center bg-secondary text-muted-foreground hover:text-foreground"
              aria-label="Maximera timer"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hr.connected) hr.disconnect();
            else hr.connect();
          }}
          disabled={hr.connecting}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold border ${
            hr.connected
              ? "bg-destructive/10 text-destructive border-destructive"
              : "bg-secondary text-foreground border-border"
          }`}
        >
          {hr.connected ? (
            <>
              <Heart className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span className="font-mono">{hr.bpm ?? "--"} bpm</span>
              <span className="text-muted-foreground font-normal">· {hr.deviceName}</span>
              <HeartOff className="w-3 h-3 ml-1" />
            </>
          ) : (
            <>
              <Heart className="w-3.5 h-3.5" />
              {hr.connecting ? "Söker pulsmätare…" : "Anslut pulsmätare"}
            </>
          )}
        </button>
        {hr.error && !hr.connected && (
          <p className="text-[10px] text-destructive font-semibold">{hr.error}</p>
        )}

        {settingsOpen && <SettingsPanel />}
      </div>
    </div>
  );
};

export default MiniTimer;
