import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, ChevronUp, ChevronDown, Maximize2, Minimize2, Settings, Hourglass, TimerReset, Heart, HeartOff, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
      <div className="space-y-3 rounded-2xl bg-muted/40 p-3" onClick={(e) => e.stopPropagation()}>
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

  const total = mode === "countdown" ? Math.max(1, countdownDefault) : 60;
  const progress = mode === "countdown"
    ? Math.min(1, Math.max(0, 1 - seconds / total))
    : (seconds % 60) / 60;

  const isIdle = !running && (mode === "countdown" ? seconds === countdownDefault : seconds === 0);
  const dockStyle = {
    bottom: `calc(80px + env(safe-area-inset-bottom, 0px))`,
    transform: "translate3d(0,0,0)",
    WebkitTransform: "translate3d(0,0,0)",
    willChange: "transform",
  } as React.CSSProperties;

  if (fullscreen) {
    const R = 120;
    const C = 2 * Math.PI * R;
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {mode === "countdown" ? label : "Stoppur"}
            </p>
            <p className="text-sm font-semibold text-primary">{running ? "Aktiv" : "Pausad"}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors active:scale-95 ${settingsOpen ? "bg-primary/15 text-primary" : "bg-muted/60 text-foreground hover:bg-muted"}`}
              aria-label="Inställningar"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => setFullscreen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60 text-foreground hover:bg-muted transition-colors active:scale-95"
              aria-label="Minimera timer"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        {settingsOpen && (
          <div className="px-5 pt-1 animate-fade-in"><SettingsPanel /></div>
        )}
        <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
          <div className="relative flex items-center justify-center">
            <svg width={2 * R + 20} height={2 * R + 20} className="-rotate-90">
              <circle
                cx={R + 10} cy={R + 10} r={R} fill="none" strokeWidth={6}
                className="stroke-muted"
              />
              <circle
                cx={R + 10} cy={R + 10} r={R} fill="none" strokeWidth={6} strokeLinecap="round"
                className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-linear"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
              />
            </svg>
            <span className={`absolute font-sans text-6xl font-semibold tabular-nums tracking-tight ${running ? "text-primary" : "text-foreground"}`}>
              {fmt(seconds)}
            </span>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <button
              onClick={() => setRunning(!running)}
              className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-soft transition-transform active:scale-[0.97] ${
                running ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground"
              }`}
            >
              {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {running ? "Pausa" : "Starta"}
            </button>
            <button
              onClick={resetTimer}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-transparent text-sm font-semibold text-muted-foreground transition-transform active:scale-[0.97] hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              Nollställ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Collapsed & idle: tiny floating round button
  if (!expanded && isIdle) {
    return (
      <div className="fixed right-4 z-50 pointer-events-none" style={dockStyle}>
        <button
          onClick={() => setExpanded(true)}
          aria-label="Öppna stoppur"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-soft text-primary transition-transform active:scale-95 animate-fade-in"
        >
          <TimerReset className="h-5 w-5" />
        </button>
      </div>
    );
  }

  // Collapsed: slim floating pill
  if (!expanded) {
    return (
      <div
        className="fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        style={dockStyle}
      >
        <div
          className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-card/95 backdrop-blur px-2.5 py-1.5 shadow-soft cursor-pointer animate-fade-in"
          onClick={() => setExpanded(true)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setRunning(!running); }}
            className={`w-8 h-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center transition-colors ${running ? "timer-play-pulse" : ""}`}
            aria-label={running ? "Pausa timer" : "Starta timer"}
          >
            {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-px" />}
          </button>
          <span className={`font-sans text-sm font-semibold tabular-nums ${running ? "text-primary" : "text-foreground"}`}>
            {fmt(seconds)}
          </span>
          {!running && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 truncate">
              {mode === "countdown" ? label : "Stoppur"}
            </span>
          )}
          {hr.connected && (
            <span className="flex items-center gap-1 text-destructive">
              <Heart className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span className="font-sans text-sm font-semibold tabular-nums">{hr.bpm ?? "--"}</span>
            </span>
          )}
          <ChevronUp className="w-4 h-4 text-muted-foreground/70" />
        </div>
      </div>
    );
  }

  // Mid state: compact rounded card, max 2 rows
  return (
    <div
      className="fixed left-0 right-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card/95 backdrop-blur px-3 py-2.5 shadow-soft animate-fade-in"
      style={dockStyle}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setRunning(!running)}
          className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
            running ? "bg-primary/15 text-primary timer-play-pulse" : "bg-primary text-primary-foreground"
          }`}
          aria-label={running ? "Pausa timer" : "Starta timer"}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 truncate">
            {mode === "countdown" ? label : "Stoppur"}
          </p>
          <span className={`font-sans text-2xl font-semibold tabular-nums tracking-tight ${running ? "text-primary" : "text-foreground"}`}>
            {fmt(seconds)}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Fler val"
              className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onClick={resetTimer}>
              <RotateCcw className="w-4 h-4 mr-2" /> Nollställ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSettingsOpen(v => !v)}>
              <Settings className="w-4 h-4 mr-2" /> Inställningar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => (hr.connected ? hr.disconnect() : hr.connect())}>
              {hr.connected ? <HeartOff className="w-4 h-4 mr-2" /> : <Heart className="w-4 h-4 mr-2" />}
              {hr.connected ? `Koppla ifrån (${hr.bpm ?? "--"} bpm)` : hr.connecting ? "Söker pulsmätare…" : "Anslut pulsmätare"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() => setFullscreen(true)}
          className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Maximera timer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Minimera timer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {settingsOpen && (
        <div className="pt-2 animate-fade-in">
          <SettingsPanel />
        </div>
      )}
      {hr.error && !hr.connected && (
        <p className="pt-1 text-[10px] font-semibold text-destructive">{hr.error}</p>
      )}
    </div>
  );
};

export default MiniTimer;

