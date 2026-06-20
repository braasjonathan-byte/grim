import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, Square, MapPin, Volume2, Settings as SettingsIcon } from "lucide-react";
import { useGpsTracker } from "@/hooks/useGpsTracker";
import { toast } from "sonner";
import { getIntervalProfile, UNIT_LABELS, UNIT_SHORT, valueToSeconds, spokenTarget, type IntervalUnit } from "@/lib/intervalSportProfiles";
import { supabase } from "@/integrations/supabase/client";

// ---------------- Voice helpers (AI speech + native/web fallback) ----------------
// Primary speech is generated through the backend and played through WebAudio,
// so the AAB no longer depends on each phone's installed Swedish TTS data.

let _isNative: boolean | undefined;
const isNative = (): boolean => {
  if (_isNative !== undefined) return _isNative;
  try {
    // @ts-ignore
    const cap = (window as any).Capacitor;
    _isNative = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  } catch { _isNative = false; }
  return !!_isNative;
};

let _ttsMod: any | null = null;
const getNativeTts = async (): Promise<any | null> => {
  if (!isNative()) return null;
  if (_ttsMod) return _ttsMod;
  try {
    const mod = await import("@capacitor-community/text-to-speech");
    _ttsMod = mod.TextToSpeech;
    return _ttsMod;
  } catch (e) { console.warn("[voice] native TTS import failed", e); return null; }
};

const AI_TTS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interval-tts`;
const AI_TTS_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let _voicePlayhead = 0;
let _voicePendingBytes = new Uint8Array(0);
const _voiceSources = new Set<AudioBufferSourceNode>();
const _aiSpeechCache = new Map<string, Uint8Array>();

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};

const decodeBase64 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const stopAiSpeech = () => {
  for (const source of _voiceSources) {
    try { source.stop(); } catch {}
  }
  _voiceSources.clear();
  _voicePlayhead = 0;
  _voicePendingBytes = new Uint8Array(0);
};

const playPcmBytes = async (incoming: Uint8Array): Promise<number> => {
  const ctx = getAudioCtx();
  if (!ctx || incoming.length === 0) return 0;
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  const bytes = new Uint8Array(_voicePendingBytes.length + incoming.length);
  bytes.set(_voicePendingBytes);
  bytes.set(incoming, _voicePendingBytes.length);
  const usable = bytes.length - (bytes.length % 2);
  _voicePendingBytes = bytes.slice(usable);
  if (usable === 0) return 0;

  const samples = usable / 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset, usable);
  const floats = new Float32Array(samples);
  for (let i = 0; i < samples; i++) floats[i] = view.getInt16(i * 2, true) / 32768;

  const buffer = ctx.createBuffer(1, floats.length, 24000);
  buffer.copyToChannel(floats, 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => _voiceSources.delete(source);
  _voiceSources.add(source);
  if (_voicePlayhead === 0) _voicePlayhead = ctx.currentTime + 0.05;
  else _voicePlayhead = Math.max(_voicePlayhead, ctx.currentTime);
  source.start(_voicePlayhead);
  _voicePlayhead += buffer.duration;
  return Math.max(0, (_voicePlayhead - ctx.currentTime) * 1000);
};

const parseSseData = (block: string): string | null => {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  return data || null;
};

const speakAi = async (text: string): Promise<boolean> => {
  const cleanText = text.trim();
  if (!cleanText || !AI_TTS_ENDPOINT || !AI_TTS_ANON_KEY) return false;
  try {
    const cached = _aiSpeechCache.get(cleanText);
    if (cached) {
      stopAiSpeech();
      const waitMs = await playPcmBytes(cached);
      if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs + 60));
      return true;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(AI_TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: AI_TTS_ANON_KEY,
        Authorization: `Bearer ${session?.access_token || AI_TTS_ANON_KEY}`,
      },
      body: JSON.stringify({ text: cleanText }),
    });
    if (!res.ok || !res.body) throw new Error(`AI TTS ${res.status}`);

    stopAiSpeech();
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    const chunks: Uint8Array[] = [];
    let pending = "";
    let lastWaitMs = 0;

    const consumeBlock = async (block: string) => {
      const data = parseSseData(block);
      if (!data || data === "[DONE]") return;
      let payload: { type?: string; audio?: string };
      try { payload = JSON.parse(data); } catch { return; }
      if (payload.type !== "speech.audio.delta" || !payload.audio) return;
      const bytes = decodeBase64(payload.audio);
      chunks.push(bytes);
      lastWaitMs = await playPcmBytes(bytes);
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      const blocks = pending.split(/\r?\n\r?\n/);
      pending = blocks.pop() || "";
      for (const block of blocks) await consumeBlock(block);
    }
    if (pending.trim()) await consumeBlock(pending);
    if (chunks.length > 0) _aiSpeechCache.set(cleanText, concatBytes(chunks));
    if (lastWaitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, lastWaitMs + 60));
    return chunks.length > 0;
  } catch (e) {
    console.warn("[voice] AI speech failed, falling back", e);
    return false;
  }
};

let _nativeLang = "sv-SE";
let _nativeVoice: number | undefined;
let _nativeReadyPromise: Promise<boolean> | null = null;

const ensureNativeTtsReady = async (): Promise<boolean> => {
  if (!isNative()) return false;
  if (_nativeReadyPromise) return _nativeReadyPromise;
  _nativeReadyPromise = (async () => {
    const tts = await getNativeTts();
    if (!tts) return false;
    const started = Date.now();
    while (Date.now() - started < 3500) {
      try {
        const voicesResult = await tts.getSupportedVoices();
        const voices = Array.isArray(voicesResult?.voices) ? voicesResult.voices : [];
        const svIndex = voices.findIndex((v: any) => /^sv(-|$)/i.test(v?.lang || ""));
        const enIndex = voices.findIndex((v: any) => /^en(-|$)/i.test(v?.lang || ""));
        const pickedIndex = svIndex >= 0 ? svIndex : enIndex;
        if (pickedIndex >= 0) {
          _nativeVoice = pickedIndex;
          _nativeLang = voices[pickedIndex]?.lang || (svIndex >= 0 ? "sv-SE" : "en-US");
        }
        const check = await tts.isLanguageSupported({ lang: _nativeLang });
        if (check?.supported) return true;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
  })();
  return _nativeReadyPromise;
};

// Pick the most natural-sounding Swedish voice the device offers (web only).
let _pickedVoice: SpeechSynthesisVoice | null | undefined = undefined;
const pickSwedishVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (_pickedVoice !== undefined) return _pickedVoice;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (!voices.length) return null;
  const sv = voices.filter(v => /sv(-|_)?se/i.test(v.lang) || /^sv$/i.test(v.lang));
  if (!sv.length) return null;
  const score = (v: SpeechSynthesisVoice): number => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (n.includes("google")) s += 100;
    if (n.includes("natural")) s += 90;
    if (n.includes("online")) s += 60;
    if (/(hedvig|sofie|mattias)/.test(n)) s += 50;
    if (n.includes("premium")) s += 70;
    if (n.includes("enhanced")) s += 55;
    if (/(alva|klara|oskar)/.test(n)) s += 20;
    if (!v.localService) s += 40;
    if (/(alva|hedvig|sofie|klara|elin|maja|saga|astrid)/.test(n)) s += 5;
    return s;
  };
  const pick = [...sv].sort((a, b) => score(b) - score(a))[0] || sv[0];
  _pickedVoice = pick;
  try { console.info("[voice] picked", pick?.name, pick?.lang, "local:", pick?.localService); } catch {}
  return pick;
};

const applyVoice = (u: SpeechSynthesisUtterance) => {
  const v = pickSwedishVoice();
  if (v) u.voice = v;
  u.lang = "sv-SE";
  u.pitch = 1.0;
  u.rate = 1.0;
};

const speakNative = async (text: string, queueStrategy = 0): Promise<boolean> => {
  if (!(await ensureNativeTtsReady())) return false;
  const tts = await getNativeTts();
  if (!tts) return false;
  try {
    await tts.speak({
      text,
      lang: _nativeLang,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: "playback",
      queueStrategy,
      ...(_nativeVoice !== undefined ? { voice: _nativeVoice } : {}),
    });
    return true;
  } catch (e) {
    console.warn("[voice] native speak failed", e);
    return false;
  }
};

const cancelNative = async () => {
  const tts = await getNativeTts();
  if (tts) { try { await tts.stop(); } catch {} }
};

const cancelVoice = () => {
  stopAiSpeech();
  void cancelNative();
  try { window.speechSynthesis?.cancel(); } catch {}
};

const speakSystem = async (text: string, opts: { flush?: boolean } = {}): Promise<boolean> => {
  if (isNative()) {
    if (opts.flush) void cancelNative();
    return speakNative(text, opts.flush ? 0 : 1);
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    if (opts.flush) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    applyVoice(u);
    u.rate = 1;
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) { console.warn("[voice] speak failed", e); }
  return false;
};

const speak = (text: string, opts: { flush?: boolean } = {}) => {
  if (opts.flush) cancelVoice();
  void speakAi(text).then((ok) => { if (!ok) void speakSystem(text, opts); });
};

const speakAndWait = (text: string, maxMs = 5000) =>
  new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    const timer = setTimeout(finish, maxMs);
    speakAi(text).then((ok) => {
      if (done) return;
      if (ok) { clearTimeout(timer); finish(); return; }
      if (isNative()) {
        speakNative(text, 1).finally(() => { clearTimeout(timer); finish(); });
        return;
      }
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        clearTimeout(timer);
        setTimeout(finish, 150);
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(text);
        applyVoice(u);
        u.rate = 1;
        u.onend = () => { clearTimeout(timer); finish(); };
        u.onerror = () => { clearTimeout(timer); finish(); };
        window.speechSynthesis.speak(u);
      } catch {
        clearTimeout(timer);
        setTimeout(finish, 150);
      }
    }).catch(() => { clearTimeout(timer); finish(); });
  });

const waitForSpeechDone = (maxMs = 8000) =>
  new Promise<void>((resolve) => {
    if (_voicePlayhead > 0) {
      const ctx = getAudioCtx();
      const waitMs = ctx ? Math.max(0, (_voicePlayhead - ctx.currentTime) * 1000) : 0;
      setTimeout(resolve, Math.min(waitMs + 80, maxMs));
      return;
    }
    if (isNative()) {
      // Native speakAndWait already awaits completion; nothing extra to drain.
      return resolve();
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const ss = window.speechSynthesis;
    const start = Date.now();
    const tick = () => {
      if (!ss.speaking && !ss.pending) return resolve();
      if (Date.now() - start > maxMs) return resolve();
      setTimeout(tick, 80);
    };
    tick();
  });

const primeSpeech = () => {
  getAudioCtx();
  void ensureNativeTtsReady();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.getVoices?.();
    const u = new SpeechSynthesisUtterance(" ");
    u.lang = "sv-SE";
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {}
};

// ---------------- Beep (WebAudio) ----------------
let _audioCtx: AudioContext | null = null;
const getAudioCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!_audioCtx) _audioCtx = new Ctor();
    if (_audioCtx && _audioCtx.state === "suspended") _audioCtx.resume().catch(() => {});
    return _audioCtx;
  } catch { return null; }
};
const beep = (freq = 880, durMs = 180, volume = 0.25) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + durMs / 1000 - 0.03);
    gain.gain.linearRampToValueAtTime(0, now + durMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durMs / 1000 + 0.02);
  } catch {}
};


// Normalize tempo to mm:ss display string. "4" -> "4:00", "4:5" -> "4:05".
const fmtTempoDisplay = (tempo: string): string => {
  if (!tempo) return "";
  const m = tempo.trim().match(/^(\d+)[:.](\d+)$/);
  if (m) return `${parseInt(m[1])}:${String(parseInt(m[2])).padStart(2, "0")}`;
  const n = parseFloat(tempo.replace(",", "."));
  if (Number.isFinite(n)) {
    const mm = Math.floor(n);
    const ss = Math.round((n - mm) * 60);
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }
  return tempo;
};

// Sport-aware spoken pace string. For mm:ss-style paces (/km, /100m, /500m)
// reads as "X minuter Y sekunder per <enhet>". For numeric-only rates
// (km/h, /min, spm, W) reads the bare number followed by the spoken unit.
const fmtTempoSpokenForProfile = (tempo: string, paceUnit: string, paceSpoken: string): string => {
  const t = (tempo || "").trim();
  if (!t) return "";
  const isMmSs = /\/km|\/100m|\/500m/i.test(paceUnit);
  if (isMmSs) {
    const m = t.match(/^(\d+)[:.](\d+)$/);
    let mm = 0, ss = 0;
    if (m) { mm = parseInt(m[1]); ss = parseInt(m[2]); }
    else {
      const n = parseFloat(t.replace(",", "."));
      if (!Number.isFinite(n)) return t;
      mm = Math.floor(n); ss = Math.round((n - mm) * 60);
    }
    if (mm === 0) return `${ss} sekunder ${paceSpoken}`;
    if (ss === 0) return `${mm} minuter ${paceSpoken}`;
    return `${mm} minuter ${ss} sekunder ${paceSpoken}`;
  }
  // Numeric rate (km/h, /min, spm, W) — speak the bare number.
  const m = t.match(/^(\d+)[:.](\d+)$/);
  let num: number;
  if (m) num = parseInt(m[1]);
  else num = parseFloat(t.replace(",", "."));
  if (!Number.isFinite(num)) return t;
  const rounded = Math.round(num * 10) / 10;
  const str = Number.isInteger(rounded) ? `${rounded}` : `${rounded}`.replace(".", " komma ");
  return `${str} ${paceSpoken}`;
};

// ---------------- Types ----------------
export type IntervalRunnerResult = {
  intervals: { time: string; dist: string; tempo: string; kind?: "warmup" | "cooldown" }[];
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
  const profile = getIntervalProfile(exerciseName);
  const hasPreset = !!(presetIntervals && presetIntervals.length > 0);
  // Config (only used when no preset)
  const [numIntervals, setNumIntervals] = useState(hasPreset ? presetIntervals!.length : 6);
  const [unit, setUnit] = useState<IntervalUnit>(profile.defaultUnit);
  const [unitValue, setUnitValue] = useState<number>(profile.defaultValue);
  const [tempo, setTempo] = useState("4:30"); // min/km (only used when unit is distance-based)
  const [restSec, setRestSec] = useState(profile.defaultRestSec);
  const [warmupMin, setWarmupMin] = useState(hasPreset ? 0 : profile.defaultWarmupMin);
  const [cooldownMin, setCooldownMin] = useState(hasPreset ? 0 : profile.defaultCooldownMin);
  const [useGps, setUseGps] = useState(profile.supportsGps);

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
  const [plannedDurSec, setPlannedDurSec] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [paused, setPaused] = useState(false);
  const pauseAcc = useRef(0);
  const pauseStarted = useRef<number | null>(null);
  const gps = useGpsTracker();
  // Track each interval's start (for achieved-pace announcement)
  const intervalStartMs = useRef<number>(0);
  const intervalStartKm = useRef<number | null>(null);
  // Achieved sec/km per interval index (from GPS) — overrides saved tempo
  const achievedSecPerKm = useRef<number[]>([]);

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
        return { durSec: Math.max(5, durSec), tempoStr: tempoStr || tempo, distKm: dKm, unit: "time" as IntervalUnit, value: tMin };
      });
    }
    const paceMinPerKm = tempoToSecPerKm(tempo) / 60 || null;
    const sec = valueToSeconds(unitValue, unit, paceMinPerKm);
    const distKm =
      unit === "distance_km" ? unitValue :
      unit === "distance_m" ? unitValue / 1000 : 0;
    return Array.from({ length: numIntervals }, () => ({ durSec: sec, tempoStr: tempo, distKm, unit, value: unitValue }));
  })();
  const totalIntervals = effective.length;

  // Guard against the auto-advance effect re-firing while startPhase is still
  // awaiting speech (phase/phaseEnd aren't updated until the awaits finish).
  const advancingRef = useRef(false);

  // Compute the achieved sec/km for an interval (uses GPS distance if available,
  // otherwise the planned interval distance). Stores result in achievedSecPerKm
  // and returns the value (0 if it couldn't be measured).
  const captureAchievedPace = (idx: number): number => {
    const cur = effective[idx];
    if (!cur) return 0;
    if (!intervalStartMs.current) return 0;
    const elapsedSec = Math.max(1, (Date.now() - intervalStartMs.current) / 1000);
    let achPace = 0;
    if (intervalStartKm.current != null && gps.isTracking) {
      const dKm = gps.distanceKm - intervalStartKm.current;
      if (dKm > 0.01) achPace = elapsedSec / dKm;
    }
    if (achPace === 0 && cur.distKm > 0) {
      achPace = elapsedSec / cur.distKm;
    }
    if (achPace > 0) achievedSecPerKm.current[idx] = achPace;
    return achPace;
  };

  // Spoken phrase for an achieved pace, adapted to the sport profile.
  // achPace is always in seconds per kilometer.
  const spokenAchievedPace = (achPace: number): string => {
    const unit = profile.paceUnit;
    if (unit === "km/h") {
      const kmh = 3600 / achPace;
      return `${kmh.toFixed(1).replace(".", " komma ")} kilometer i timmen`;
    }
    if (unit === "/100m") {
      const sec = achPace / 10; // sec per 100 m
      const mm = Math.floor(sec / 60);
      const ss = Math.round(sec % 60);
      if (mm === 0) return `tempo ${ss} sekunder per 100 meter`;
      return `tempo ${mm} minuter ${ss} sekunder per 100 meter`;
    }
    if (unit === "/500m") {
      const sec = achPace / 2; // sec per 500 m
      const mm = Math.floor(sec / 60);
      const ss = Math.round(sec % 60);
      if (mm === 0) return `tempo ${ss} sekunder per 500 meter`;
      return `tempo ${mm} minuter ${ss} sekunder per 500 meter`;
    }
    // default /km (löpning, promenad, skidåkning, skridsko, ...)
    const mm = Math.floor(achPace / 60);
    const ss = Math.round(achPace % 60);
    return `tempo ${mm} minuter ${ss} sekunder per kilometer`;
  };


  // Phase orchestration
  const startPhase = async (nextPhase: Phase, idx: number) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    // Set phase + a far-future phaseEnd immediately so the auto-advance effect
    // stops firing while we play the voice prompts.
    setPhase(nextPhase);
    setPhaseEnd(Date.now() + 24 * 60 * 60 * 1000);
    setCurrentIdx(idx);
    const voice = prefs.enabled;
    let durSec = 0;
    try {
      if (nextPhase === "warmup") {
        durSec = warmupMin * 60;
        setPlannedDurSec(durSec);
        if (voice) speak(`Uppvärmning ${warmupMin} minuter. Börja lugnt.`);
      } else if (nextPhase === "interval") {
        const cur = effective[idx] || effective[0];
        durSec = cur.durSec;
        setPlannedDurSec(durSec);
        if (voice && prefs.announceIntervalNumber) {
          await speakAndWait(`Intervall ${idx + 1} av ${totalIntervals}.`, 4000);
        }
        if (voice && prefs.announceTempo) {
          const cur2: any = cur;
          let target = "";
          if (cur2.unit && cur2.value) {
            target = `Mål ${spokenTarget(cur2.value, cur2.unit, profile)}`;
          } else if (cur.distKm > 0) {
            target = `Mål ${spokenTarget(cur.distKm, "distance_km", profile)}`;
          }
          const paceSpoken = cur.tempoStr ? `, ${profile.paceLabel.toLowerCase()} ${fmtTempoSpokenForProfile(cur.tempoStr, profile.paceUnit, profile.paceSpoken)}` : "";
          if (target || paceSpoken) {
            await speakAndWait(`${target}${paceSpoken}.`, 6000);
          }
        }
        // Wait for the speech queue to fully drain before the start-beep,
        // so the pip never overlaps the spoken info.
        if (voice) await waitForSpeechDone(8000);
        // Beep marks the exact moment the timer starts (no spoken countdown)
        beep(1000, 200);
        intervalStartMs.current = Date.now();
        intervalStartKm.current = gps.isTracking ? gps.distanceKm : null;
      } else if (nextPhase === "rest") {
        durSec = restSec;
        setPlannedDurSec(durSec);
        if (voice && prefs.announceRest) speak(`Vila ${restSec} sekunder.`);
      } else if (nextPhase === "cooldown") {
        durSec = cooldownMin * 60;
        setPlannedDurSec(durSec);
        if (voice) speak(`Nedvarvning ${cooldownMin} minuter. Bra jobbat.`);
      } else if (nextPhase === "done") {
        setPlannedDurSec(0);
        if (voice) speak("Passet är klart. Snyggt jobbat!");
      }
      pauseAcc.current = 0;
      pauseStarted.current = null;
      if (durSec > 0) setPhaseEnd(Date.now() + durSec * 1000);
      else setPhaseEnd(Date.now());
    } finally {
      advancingRef.current = false;
    }
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
      // Stop-beep at end of interval
      beep(600, 220);
      // Capture achieved pace for the interval just finished
      const achPace = captureAchievedPace(currentIdx);
      if (prefs.enabled && achPace > 0) {
        speak(`Du höll ${spokenAchievedPace(achPace)}.`);
      }
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
    // Prime synth + audio inside the user gesture so audio is allowed later
    if (prefs.enabled) primeSpeech();
    getAudioCtx();
    void actuallyStart();
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
    // If the user finishes mid-interval, capture the current one too so its
    // measured tempo lands in the saved row.
    if (phase === "interval") {
      try { captureAchievedPace(currentIdx); } catch {}
    }

    const intervals = effective.map((e, i) => {
      const ach = achievedSecPerKm.current[i];
      let tempoStr = e.tempoStr;
      if (ach && ach > 0) {
        const mm = Math.floor(ach / 60);
        const ss = Math.round(ach % 60);
        tempoStr = `${mm}:${String(ss).padStart(2, "0")}`;
      }
      return {
        time: String(Math.round((e.durSec / 60) * 100) / 100),
        dist: e.distKm > 0 ? String(Math.round(e.distKm * 1000) / 1000) : "",
        tempo: tempoStr,
      };
    });
    const warm = warmupMin > 0 ? { time: String(warmupMin), dist: "", tempo: "", kind: "warmup" as const } : null;
    const cool = cooldownMin > 0 ? { time: String(cooldownMin), dist: "", tempo: "", kind: "cooldown" as const } : null;
    const all = [warm, ...intervals, cool].filter(Boolean) as { time: string; dist: string; tempo: string; kind?: "warmup" | "cooldown" }[];
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

  const displayNow = paused && pauseStarted.current ? pauseStarted.current : now;
  const rawRemaining = Math.max(0, Math.ceil((phaseEnd - displayNow) / 1000));
  const remaining = plannedDurSec > 0 ? Math.min(rawRemaining, plannedDurSec) : rawRemaining;
  const running = phase !== "idle" && phase !== "done";

  const phaseLabel = (() => {
    switch (phase) {
      case "warmup": return "Uppvärmning";
      case "interval": return `Intervall ${currentIdx + 1} / ${totalIntervals}`;
      case "rest": return "Vila";
      case "cooldown": return "Nedvarvning";
      case "done": return "Klart!";
      default: return "";
    }
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleAbort(); }}>
        <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-6 flex flex-col overflow-y-auto inset-0 left-0 top-0 translate-x-0 translate-y-0 sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              {running ? phaseLabel : "Intervallpass"}
            </DialogTitle>
          </DialogHeader>

          {!running && phase !== "done" && !hasPreset && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{exerciseName} <span className="opacity-60">· {profile.sport}</span></p>

              <div>
                <Label className="text-xs">Mät varje intervall i</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile.availableUnits.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        setUnit(u);
                        // Reset to a sensible default value when changing unit
                        if (u === "time") setUnitValue(60);
                        else if (u === "distance_km") setUnitValue(1);
                        else if (u === "distance_m") setUnitValue(profile.sport === "rodd" ? 500 : profile.sport === "simning" ? 100 : 400);
                        else if (u === "calories") setUnitValue(10);
                        else if (u === "reps") setUnitValue(50);
                        else if (u === "laps") setUnitValue(2);
                      }}
                      className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors ${unit === u ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary"}`}
                    >{UNIT_LABELS[u]}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Antal intervaller</Label>
                  <Input type="number" min={1} max={30} value={numIntervals} onChange={(e) => setNumIntervals(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} />
                </div>
                <div>
                  <Label className="text-xs">{UNIT_LABELS[unit]} / intervall</Label>
                  <Input type="number" min={1} step={unit === "distance_km" ? 0.1 : 1} value={unitValue} onChange={(e) => setUnitValue(Math.max(1, parseFloat(e.target.value) || 1))} />
                </div>
                {(unit === "distance_km" || unit === "distance_m") && (
                  <div>
                    <Label className="text-xs">{profile.paceLabel} ({profile.paceUnit})</Label>
                    <Input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="4:30" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Vila (sek)</Label>
                  <Input type="number" min={0} step={5} value={restSec} onChange={(e) => { const n = Math.max(0, parseInt(e.target.value) || 0); if (e.target.value !== String(n)) e.target.value = String(n); setRestSec(n); }} />
                </div>
                <div>
                  <Label className="text-xs">Uppvärmning (min)</Label>
                  <Input type="number" min={0} value={warmupMin} onChange={(e) => { const n = Math.max(0, parseInt(e.target.value) || 0); if (e.target.value !== String(n)) e.target.value = String(n); setWarmupMin(n); }} />
                </div>
                <div>
                  <Label className="text-xs">Nedvarvning (min)</Label>
                  <Input type="number" min={0} value={cooldownMin} onChange={(e) => { const n = Math.max(0, parseInt(e.target.value) || 0); if (e.target.value !== String(n)) e.target.value = String(n); setCooldownMin(n); }} />
                </div>
                {profile.supportsGps && (
                  <div className="col-span-2 flex items-center gap-2">
                    <Checkbox checked={useGps} onCheckedChange={(v) => setUseGps(!!v)} id="usegps" />
                    <label htmlFor="usegps" className="text-xs">Spela in GPS-spår under passet</label>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                Pass: {numIntervals} × {unitValue} {UNIT_SHORT[unit]}
                {(unit === "distance_km" || unit === "distance_m") && tempo ? <> @ {tempo}{profile.paceUnit}</> : null}
                , vila {restSec}s
                {(warmupMin > 0 || cooldownMin > 0) && <> · {warmupMin} min upp / {cooldownMin} min ner</>}
                <br />Mål per intervall: {fmtClock(effective[0]?.durSec || 0)}
              </div>

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
                    <span>{fmtClock(e.durSec)} @ {e.tempoStr ? fmtTempoDisplay(e.tempoStr) : "—"}/km · {e.distKm ? e.distKm + " km" : "—"}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-border/50">Vila mellan: {restSec}s</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Vila (sek)</Label>
                  <Input type="number" min={0} step={5} value={restSec} onChange={(e) => { const n = Math.max(0, parseInt(e.target.value) || 0); if (e.target.value !== String(n)) e.target.value = String(n); setRestSec(n); }} />
                </div>
                <div>
                  <Label className="text-xs">Uppvärmning (min)</Label>
                  <Input type="number" min={0} value={warmupMin} onChange={(e) => { const n = Math.max(0, parseInt(e.target.value) || 0); if (e.target.value !== String(n)) e.target.value = String(n); setWarmupMin(n); }} />
                </div>
              </div>
            </div>
          )}

          {running && (
            <div className="space-y-4 text-center py-4">
              <div className="text-6xl font-bold tabular-nums">{fmtClock(remaining)}</div>
              <div className="text-sm text-muted-foreground">
                {phase === "interval" && (() => { const cur = effective[currentIdx] || effective[0]; return <>Mål-tempo: <strong>{fmtTempoDisplay(cur.tempoStr || tempo)}/km</strong>{cur.distKm > 0 ? <> · {cur.distKm} km</> : null}</>; })()}
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

          {phase === "done" && (
            <div className="space-y-4 text-center py-4">
              <div className="text-2xl font-bold">Klart!</div>
              <p className="text-sm text-muted-foreground">Passet är genomfört. Spara för att logga det.</p>
              {gps.isTracking && (
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" /> GPS: {gps.distanceKm.toFixed(2)} km
                </div>
              )}
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
            {phase === "done" && (
              <>
                <Button variant="ghost" onClick={handleAbort}>Avbryt</Button>
                <Button onClick={handleFinish}>
                  <Square className="w-4 h-4 mr-1" /> Spara pass
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
