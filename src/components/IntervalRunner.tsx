import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, Square, MapPin, Volume2, Settings as SettingsIcon } from "lucide-react";
import { useGpsTracker } from "@/hooks/useGpsTracker";
import { toast } from "sonner";

// ---------------- Voice helpers (Web Speech API) ----------------
// Note: do NOT call cancel() before every speak — it kills queued utterances
// and breaks the user-gesture chain on mobile, causing total silence.
const speak = (text: string, opts: { flush?: boolean } = {}) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    if (opts.flush) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "sv-SE";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { console.warn("[voice] speak failed", e); }
};

// Queue an utterance and resolve when it actually finishes (with a max fallback).
const speakAndWait = (text: string, maxMs = 5000) =>
  new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setTimeout(resolve, 150);
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "sv-SE";
      u.rate = 1;
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
      setTimeout(finish, maxMs);
    } catch {
      setTimeout(resolve, 150);
    }
  });

// Prime the speech engine inside the user gesture (required on iOS/Android Chrome).
const primeSpeech = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(" ");
    u.lang = "sv-SE";
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {}
};

const fmtTempoSpoken = (tempo: string): string => {
  // tempo like "4:30" -> "fyra minuter trettio sekunder per kilometer"
  const m = tempo.trim().match(/^(\d+)[:.](\d+)$/);
  if (m) return `${parseInt(m[1])} minuter ${parseInt(m[2])} sekunder per kilometer`;
  const n = parseFloat(tempo.replace(",", "."));
  if (Number.isFinite(n)) return `${n} per kilometer`;
  return tempo;
};

// ---------------- Types ----------------
export type IntervalRunnerResult = {
  intervals: { time: string; dist: string; tempo: string }[];
  totalDistKm: number;
  totalTimeMin: number;
  tempo: string; // average / target tempo string
  gpsDistanceKm?: number;
  route?: [number, number][];
};

type Phase = "idle" | "warmup" | "interval" | "rest" | "cooldown" | "done";

type Props = {
  open: boolean;
  onClose: () => void;
  exerciseName?: string;
  onComplete?: (data: IntervalRunnerResult) => void | Promise<void>;
  /** Pre-filled intervals from the workout card. time = minutes, dist = km, tempo = min/km (e.g. "4:30"). */
  presetIntervals?: Array<{ time: string; tempo: string; dist: string }>;
};

// ---------------- Voice prefs (persisted) ----------------
type VoicePrefs = {
  enabled: boolean;
  announceTempo: boolean;
  announceIntervalNumber: boolean;
  announceRest: boolean;
  countdown: boolean;
};
const VP_KEY = "grim_interval_voice_prefs";
const loadPrefs = (): VoicePrefs => {
  try {
    const raw = localStorage.getItem(VP_KEY);
    if (raw) return { enabled: true, announceTempo: true, announceIntervalNumber: true, announceRest: true, countdown: true, ...JSON.parse(raw) };
  } catch {}
  return { enabled: true, announceTempo: true, announceIntervalNumber: true, announceRest: true, countdown: true };
};

const fmtClock = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, Math.floor(sec % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const IntervalRunner = ({ open, onClose, exerciseName = "Löpning – Intervaller", onComplete, presetIntervals }: Props) => {
  const hasPreset = !!(presetIntervals && presetIntervals.length > 0);
  // Config (only used when no preset)
  const [numIntervals, setNumIntervals] = useState(hasPreset ? presetIntervals!.length : 6);
  const [distM, setDistM] = useState(400); // meters per interval
  const [tempo, setTempo] = useState("4:30"); // min/km
  const [restSec, setRestSec] = useState(90);
  const [warmupMin, setWarmupMin] = useState(hasPreset ? 0 : 10);
  const [cooldownMin, setCooldownMin] = useState(hasPreset ? 0 : 5);
  const [useGps, setUseGps] = useState(false);

  // Voice settings dialog
  const [showVoicePrefs, setShowVoicePrefs] = useState(false);
  const [prefs, setPrefs] = useState<VoicePrefs>(loadPrefs);
  useEffect(() => {
    try { localStorage.setItem(VP_KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  // Runtime
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentIdx, setCurrentIdx] = useState(0); // 0-based current interval
  const [phaseEnd, setPhaseEnd] = useState<number>(0); // epoch ms
  const [now, setNow] = useState<number>(Date.now());
  const [paused, setPaused] = useState(false);
  const pauseAcc = useRef(0);
  const pauseStarted = useRef<number | null>(null);
  const gps = useGpsTracker();

  // Tick
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  // Compute interval target time (sec) from tempo + dist
  const tempoToSecPerKm = (t: string): number => {
    const m = t.trim().match(/^(\d+)[:.](\d+)$/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
    const n = parseFloat(t.replace(",", "."));
    return Number.isFinite(n) ? n * 60 : 0;
  };

  // Effective per-interval plan (preset wins, otherwise N copies of config)
  const effective = (() => {
    if (hasPreset) {
      return presetIntervals!.map((r) => {
        const tMin = parseFloat(r.time) || 0;
        const dKm = parseFloat((r.dist || "").replace(",", ".")) || 0;
        const tempoStr = (r.tempo || "").trim();
        let durSec = Math.round(tMin * 60);
        if (durSec <= 0 && dKm > 0 && tempoStr) durSec = Math.round(dKm * tempoToSecPerKm(tempoStr));
        return { durSec: Math.max(5, durSec), tempoStr: tempoStr || tempo, distKm: dKm };
      });
    }
    const sec = Math.max(5, Math.round((distM / 1000) * tempoToSecPerKm(tempo)));
    return Array.from({ length: numIntervals }, () => ({ durSec: sec, tempoStr: tempo, distKm: distM / 1000 }));
  })();
  const totalIntervals = effective.length;

  // Phase orchestration
  const startPhase = async (nextPhase: Phase, idx: number) => {
    setCurrentIdx(idx);
    const voice = prefs.enabled;
    let durSec = 0;
    if (nextPhase === "warmup") {
      durSec = warmupMin * 60;
      if (voice) speak(`Uppvärmning ${warmupMin} minuter. Börja lugnt.`);
    } else if (nextPhase === "interval") {
      const cur = effective[idx] || effective[0];
      durSec = cur.durSec;
      // Read tempo BEFORE the start signal
      if (voice && prefs.announceIntervalNumber) {
        await speakAndWait(`Intervall ${idx + 1} av ${totalIntervals}.`, 1800);
      }
      if (voice && prefs.announceTempo && cur.tempoStr) {
        const distPart = cur.distKm > 0 ? `, distans ${cur.distKm} kilometer` : "";
        await speakAndWait(`Mål-tempo ${fmtTempoSpoken(cur.tempoStr)}${distPart}.`, 3200);
      }
      if (voice && prefs.countdown) {
        await speakAndWait("3, 2, 1, kör!", 1900);
      } else if (voice) {
        await speakAndWait("Kör!", 700);
      }
    } else if (nextPhase === "rest") {
      durSec = restSec;
      if (voice && prefs.announceRest) speak(`Vila ${restSec} sekunder.`);
    } else if (nextPhase === "cooldown") {
      durSec = cooldownMin * 60;
      if (voice) speak(`Nedvarvning ${cooldownMin} minuter. Bra jobbat.`);
    } else if (nextPhase === "done") {
      if (voice) speak("Passet är klart. Snyggt jobbat!");
    }
    pauseAcc.current = 0;
    pauseStarted.current = null;
    setPhase(nextPhase);
    if (durSec > 0) setPhaseEnd(Date.now() + durSec * 1000);
    else setPhaseEnd(Date.now());
  };

  // Auto-advance when phase ends (unless paused)
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    if (paused) return;
    if (now < phaseEnd) return;
    // advance
    if (phase === "warmup") {
      void startPhase("interval", 0);
    } else if (phase === "interval") {
      if (currentIdx + 1 < totalIntervals) {
        void startPhase("rest", currentIdx);
      } else if (cooldownMin > 0) {
        void startPhase("cooldown", currentIdx);
      } else {
        void startPhase("done", currentIdx);
      }
    } else if (phase === "rest") {
      void startPhase("interval", currentIdx + 1);
    } else if (phase === "cooldown") {
      void startPhase("done", currentIdx);
    }
  }, [now, phase, paused, phaseEnd, currentIdx, totalIntervals, cooldownMin]);

  const handleStart = () => {
    // Prime synth inside the user gesture so audio is allowed later
    if (prefs.enabled) primeSpeech();
    setShowVoicePrefs(true);
  };

  const actuallyStart = async () => {
    // Prime again inside this click gesture (the "Starta passet" button)
    if (prefs.enabled) {
      primeSpeech();
      // tiny audible nudge confirms voice works
      speak("Redo.");
    }
    setShowVoicePrefs(false);
    setPaused(false);
    setCurrentIdx(0);
    if (useGps) {
      try { await gps.start(); } catch {}
    }
    if (warmupMin > 0) void startPhase("warmup", 0);
    else void startPhase("interval", 0);
  };

  const handlePause = () => {
    if (paused) {
      // resume — shift phaseEnd by paused duration
      const pausedFor = pauseStarted.current ? Date.now() - pauseStarted.current : 0;
      setPhaseEnd(prev => prev + pausedFor);
      pauseAcc.current += pausedFor;
      pauseStarted.current = null;
      setPaused(false);
      if (gps.isPaused) gps.resume();
    } else {
      pauseStarted.current = Date.now();
      setPaused(true);
      try { window.speechSynthesis?.cancel(); } catch {}
      if (gps.isTracking && !gps.isPaused) gps.pause();
    }
  };

  const buildResult = (): IntervalRunnerResult => {
    const intervals = effective.map((e) => ({
      time: String(Math.round((e.durSec / 60) * 100) / 100),
      dist: e.distKm > 0 ? String(Math.round(e.distKm * 1000) / 1000) : "",
      tempo: e.tempoStr,
    }));
    const warm = warmupMin > 0 ? { time: String(warmupMin), dist: "", tempo: "" } : null;
    const cool = cooldownMin > 0 ? { time: String(cooldownMin), dist: "", tempo: "" } : null;
    const all = [warm, ...intervals, cool].filter(Boolean) as { time: string; dist: string; tempo: string }[];
    const totalDistKm = effective.reduce((acc, e) => acc + (e.distKm || 0), 0);
    const totalSec = effective.reduce((acc, e) => acc + e.durSec, 0);
    const totalTimeMin = (warmupMin + cooldownMin) + totalSec / 60 + Math.max(0, effective.length - 1) * (restSec / 60);
    const avgTempo = effective[0]?.tempoStr || tempo;
    let gpsDistanceKm: number | undefined;
    let route: [number, number][] | undefined;
    if (gps.isTracking) {
      const res = gps.stop();
      gpsDistanceKm = res.distanceKm;
      route = res.route;
    }
    return { intervals: all, totalDistKm, totalTimeMin, tempo: avgTempo, gpsDistanceKm, route };
  };

  const handleFinish = async () => {
    try { window.speechSynthesis?.cancel(); } catch {}
    const result = buildResult();
    if (onComplete) {
      try { await onComplete(result); } catch (e) { console.error(e); }
    }
    const km = result.gpsDistanceKm && result.gpsDistanceKm > 0 ? result.gpsDistanceKm : result.totalDistKm;
    toast.success(`Intervallpass klart – ${km.toFixed(2)} km loggat`);
    setPhase("idle");
    onClose();
  };

  const handleAbort = () => {
    try { window.speechSynthesis?.cancel(); } catch {}
    if (gps.isTracking) gps.stop();
    setPhase("idle");
    onClose();
  };

  const remaining = Math.max(0, Math.ceil((phaseEnd - now) / 1000));
  const running = phase !== "idle" && phase !== "done";

  const phaseLabel = (() => {
    switch (phase) {
      case "warmup": return "Uppvärmning";
      case "interval": return `Intervall ${currentIdx + 1} / ${numIntervals}`;
      case "rest": return "Vila";
      case "cooldown": return "Nedvarvning";
      case "done": return "Klart!";
      default: return "";
    }
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleAbort(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              {running ? phaseLabel : "Intervallpass"}
            </DialogTitle>
          </DialogHeader>

          {!running && phase !== "done" && !hasPreset && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{exerciseName}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Antal intervaller</Label>
                  <Input type="number" min={1} max={30} value={numIntervals} onChange={(e) => setNumIntervals(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} />
                </div>
                <div>
                  <Label className="text-xs">Distans / intervall (m)</Label>
                  <Input type="number" min={50} step={50} value={distM} onChange={(e) => setDistM(Math.max(50, parseInt(e.target.value) || 50))} />
                </div>
                <div>
                  <Label className="text-xs">Mål-tempo (min/km)</Label>
                  <Input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="4:30" />
                </div>
                <div>
                  <Label className="text-xs">Vila (sek)</Label>
                  <Input type="number" min={0} step={5} value={restSec} onChange={(e) => setRestSec(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div>
                  <Label className="text-xs">Uppvärmning (min)</Label>
                  <Input type="number" min={0} value={warmupMin} onChange={(e) => setWarmupMin(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div>
                  <Label className="text-xs">Nedvarvning (min)</Label>
                  <Input type="number" min={0} value={cooldownMin} onChange={(e) => setCooldownMin(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                Pass: {numIntervals} × {distM} m @ {tempo}/km, vila {restSec}s
                {(warmupMin > 0 || cooldownMin > 0) && <> · {warmupMin} min upp / {cooldownMin} min ner</>}
                <br />Total löpdistans: <strong>{(numIntervals * distM / 1000).toFixed(2)} km</strong> · mål per intervall: {fmtClock(effective[0]?.durSec || 0)}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={useGps} onCheckedChange={(v) => setUseGps(!!v)} />
                <MapPin className="w-4 h-4" /> Spela in med GPS
              </label>
            </div>
          )}

          {!running && phase !== "done" && hasPreset && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{exerciseName}</p>
              <div className="text-xs bg-muted/40 p-2 rounded space-y-1">
                <div className="font-semibold">{totalIntervals} intervaller från din planering</div>
                {effective.map((e, i) => (
                  <div key={i} className="flex justify-between font-mono">
                    <span>#{i + 1}</span>
                    <span>{fmtClock(e.durSec)} @ {e.tempoStr || "—"}/km · {e.distKm ? e.distKm + " km" : "—"}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-border/50">Vila mellan: {restSec}s</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Vila (sek)</Label>
                  <Input type="number" min={0} step={5} value={restSec} onChange={(e) => setRestSec(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div>
                  <Label className="text-xs">Uppvärmning (min)</Label>
                  <Input type="number" min={0} value={warmupMin} onChange={(e) => setWarmupMin(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={useGps} onCheckedChange={(v) => setUseGps(!!v)} />
                <MapPin className="w-4 h-4" /> Spela in med GPS
              </label>
            </div>
          )}

          {running && (
            <div className="space-y-4 text-center py-4">
              <div className="text-6xl font-bold tabular-nums">{fmtClock(remaining)}</div>
              <div className="text-sm text-muted-foreground">
                {phase === "interval" && (() => { const cur = effective[currentIdx] || effective[0]; return <>Mål-tempo: <strong>{cur.tempoStr || tempo}/km</strong>{cur.distKm > 0 ? <> · {cur.distKm} km</> : null}</>; })()}
                {phase === "rest" && <>Vila innan intervall {currentIdx + 2}</>}
              </div>
              {gps.isTracking && (
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" /> GPS: {gps.distanceKm.toFixed(2)} km
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handlePause}>
                  {paused ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                  {paused ? "Fortsätt" : "Paus"}
                </Button>
                <Button variant="destructive" onClick={handleFinish}>
                  <Square className="w-4 h-4 mr-1" /> Avsluta & spara
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {!running && phase !== "done" && (
              <>
                <Button variant="ghost" onClick={onClose}>Avbryt</Button>
                <Button variant="outline" onClick={() => setShowVoicePrefs(true)}>
                  <SettingsIcon className="w-4 h-4 mr-1" /> Röst
                </Button>
                <Button onClick={handleStart}>
                  <Play className="w-4 h-4 mr-1" /> Starta
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVoicePrefs} onOpenChange={setShowVoicePrefs}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Röstguidning</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={prefs.enabled} onCheckedChange={(v) => setPrefs(p => ({ ...p, enabled: !!v }))} />
              Slå på röstguidning
            </label>
            <div className={`space-y-2 pl-6 ${!prefs.enabled ? "opacity-50 pointer-events-none" : ""}`}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={prefs.announceIntervalNumber} onCheckedChange={(v) => setPrefs(p => ({ ...p, announceIntervalNumber: !!v }))} />
                Säg intervallnummer (t.ex. "Intervall 1 av 6")
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={prefs.announceTempo} onCheckedChange={(v) => setPrefs(p => ({ ...p, announceTempo: !!v }))} />
                Läs upp mål-tempo före start
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={prefs.countdown} onCheckedChange={(v) => setPrefs(p => ({ ...p, countdown: !!v }))} />
                Nedräkning 3-2-1 innan start
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={prefs.announceRest} onCheckedChange={(v) => setPrefs(p => ({ ...p, announceRest: !!v }))} />
                Säg när vilan börjar
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowVoicePrefs(false)}>Stäng</Button>
            <Button onClick={actuallyStart}>
              <Play className="w-4 h-4 mr-1" /> Starta passet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IntervalRunner;
