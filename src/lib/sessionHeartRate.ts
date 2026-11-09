import { downsampleHr } from "@/lib/hrCurve";
import type { HrSample } from "@/lib/heartRate";

/** Pulsdata för ett helt pass, sparas i logged_weights under SESSION_HR_KEY. */
export interface SessionHeartRate {
  avg: number;
  max: number;
  min: number;
  /** Nedsamplad serie (max 90 punkter) för pulskurvan */
  series: number[];
  /** Full serie (≈1 värde/5 s) för export till t.ex. Strava, max 2 h */
  raw?: { t: number; bpm: number }[];
  start: string;
  end: string;
}

export const SESSION_HR_KEY = "__hr_session__";
const MIN_SAMPLES = 12; // ≈1 minut
const RAW_MAX = 1440; // 2 h à 5 s

/** Sammanfattar pulsvärden från passets start till slut. Null om för lite data. */
export function summarizeSessionHr(samples: HrSample[]): SessionHeartRate | null {
  const s = samples.filter((x) => Number.isFinite(x.bpm) && x.bpm > 25 && x.bpm < 240).sort((a, b) => a.t - b.t);
  if (s.length < MIN_SAMPLES) return null;
  const bpms = s.map((x) => x.bpm);
  const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  const series = downsampleHr(s.map((x) => ({ timestamp: String(x.t).padStart(15, "0"), bpm: x.bpm })));
  const rawSrc = s.length > RAW_MAX ? s.filter((_, i) => i % Math.ceil(s.length / RAW_MAX) === 0) : s;
  return {
    avg,
    max: Math.max(...bpms),
    min: Math.min(...bpms),
    series,
    raw: rawSrc.map((x) => ({ t: x.t, bpm: Math.round(x.bpm) })),
    start: new Date(s[0].t).toISOString(),
    end: new Date(s[s.length - 1].t).toISOString(),
  };
}

/** Läser sparad pass-puls ur logged_weights (tål gamla/trasiga värden). */
export function readSessionHr(lw: unknown): SessionHeartRate | null {
  const v = (lw as any)?.[SESSION_HR_KEY];
  const obj = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v;
  if (!obj || !Array.isArray(obj.series) || !(obj.avg > 0)) return null;
  return obj as SessionHeartRate;
}
