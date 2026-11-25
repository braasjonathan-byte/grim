/**
 * Beräkningar för pulsanalysen av löp- och cykelpass: zoner, belastning,
 * delsträckor, återhämtning och jämförelse med liknande pass.
 * Rena funktioner – inga nätverksanrop.
 */
import { HR_ZONES } from "@/lib/hrCurve";
import type { WorkoutSeries } from "@/lib/workoutSeries";

export type SportKind = "run" | "bike";

/** Löpning eller cykling utifrån övnings- eller passnamn. */
export function sportKind(name: string | null | undefined): SportKind | null {
  const n = (name || "").toLowerCase();
  if (/promenad|vandr|gång\b|walk|hike|sim|rodd|skid/.test(n)) return null;
  if (/cykl|cykel|spinning|bike|biking|ride|mtb|gravel|zwift|tacx|watt ?bike/.test(n)) return "bike";
  if (/löp|lop(ning|pass)|jogg|run|trail|terräng|tempopass|fartlek/.test(n)) return "run";
  return null;
}

/** Zonindex 0–4 (Z1–Z5). Under Z1 räknas till Z1, som i resten av appen. */
export function zoneIndex(bpm: number, maxHr: number): number {
  const pct = bpm / maxHr;
  for (let i = HR_ZONES.length - 1; i >= 0; i--) if (pct >= HR_ZONES[i].min) return i;
  return 0;
}

/** Sekunder i varje zon. */
export function zoneSeconds(series: Pick<WorkoutSeries, "hr" | "step">, maxHr: number): number[] {
  const out = [0, 0, 0, 0, 0];
  if (!(maxHr > 0)) return out;
  for (const b of series.hr) if (b != null && b > 0) out[zoneIndex(b, maxHr)] += series.step;
  return out;
}

/**
 * Träningsbelastning enligt Edwards TRIMP: minuter i zon × zonvikt (1–5).
 * 45 min jämnt i Z2 ≈ 90.
 */
export function trainingLoad(zoneSec: number[]): number {
  return Math.round(zoneSec.reduce((sum, s, i) => sum + (s / 60) * (i + 1), 0));
}

export function loadLabel(score: number): string {
  if (score < 50) return "Lätt";
  if (score < 120) return "Måttlig";
  if (score < 200) return "Tuff";
  return "Mycket tuff";
}

export function hrStats(series: Pick<WorkoutSeries, "hr">): { avg: number; max: number; min: number } | null {
  let sum = 0, cnt = 0, max = 0, min = Infinity;
  for (const b of series.hr) {
    if (b == null || !(b > 0)) continue;
    sum += b; cnt += 1;
    if (b > max) max = b;
    if (b < min) min = b;
  }
  return cnt ? { avg: Math.round(sum / cnt), max, min } : null;
}

/**
 * Fart (m/s) per fack ur kumulativ distans, utjämnad över ca ±15 s så att
 * GPS-brus inte ger hackig kurva. Null där distansen står still.
 */
export function speedSeries(series: Pick<WorkoutSeries, "d" | "step">): (number | null)[] | null {
  const d = series.d;
  if (!d || d.length < 2) return null;
  const w = Math.max(1, Math.round(15 / series.step));
  const out: (number | null)[] = new Array(d.length);
  for (let i = 0; i < d.length; i++) {
    const a = Math.max(0, i - w);
    const b = Math.min(d.length - 1, i + w);
    const dist = d[b] - (a > 0 ? d[a - 1] : 0);
    const sec = (b - a + 1) * series.step;
    const v = dist / sec;
    out[i] = v > 0.3 ? v : null;
  }
  return out;
}

export interface Split {
  index: number;
  /** Delsträckans längd i meter (sista kan vara kortare). */
  distM: number;
  sec: number;
  avgHr: number | null;
  maxHr: number | null;
  /** Sekunder per km. */
  paceSecPerKm: number;
  kmh: number;
}

/** Delsträckor om splitM meter. Sista delen tas med om den är minst 20 % av en hel. */
export function computeSplits(series: Pick<WorkoutSeries, "d" | "hr" | "step">, splitM: number): Split[] {
  const d = series.d;
  if (!d || !d.length || !(splitM > 0)) return [];
  const out: Split[] = [];
  let startT = 0;
  let startD = 0;
  let hrSum = 0, hrCnt = 0, hrMax = 0;
  let prevD = 0;
  const push = (endT: number, endD: number) => {
    const sec = endT - startT;
    const distM = endD - startD;
    if (sec <= 0 || distM <= 0) return;
    out.push({
      index: out.length + 1,
      distM: Math.round(distM),
      sec: Math.round(sec),
      avgHr: hrCnt ? Math.round(hrSum / hrCnt) : null,
      maxHr: hrCnt ? hrMax : null,
      paceSecPerKm: Math.round(sec / (distM / 1000)),
      kmh: Math.round((distM / sec) * 3.6 * 10) / 10,
    });
  };
  for (let i = 0; i < d.length; i++) {
    const bucketStart = i * series.step;
    const cur = d[i];
    const b = series.hr[i];
    if (b != null && b > 0) { hrSum += b; hrCnt += 1; if (b > hrMax) hrMax = b; }
    let lo = prevD;
    // En lång fack kan korsa flera gränser.
    while (cur >= startD + splitM) {
      const target = startD + splitM;
      const frac = cur > lo ? (target - lo) / (cur - lo) : 1;
      const t = bucketStart + frac * series.step;
      push(t, target);
      startT = t;
      startD = target;
      lo = target;
      hrSum = 0; hrCnt = 0; hrMax = 0;
      if (b != null && b > 0 && frac < 1) { hrSum = b; hrCnt = 1; hrMax = b; }
    }
    prevD = cur;
  }
  const lastD = d[d.length - 1];
  if (lastD - startD >= splitM * 0.2) push(d.length * series.step, lastD);
  return out;
}

export function splitLengthM(kind: SportKind): number {
  return kind === "bike" ? 5000 : 1000;
}

export interface Recovery { end: number; at60: number; drop: number; label: string }

/** Pulsfall första minuten efter passet. Null om data saknas eller är orimlig. */
export function recoveryFrom(rec: WorkoutSeries["rec"] | undefined | null): Recovery | null {
  if (!rec || !(rec.end > 0) || !(rec.at60 > 0)) return null;
  const drop = rec.end - rec.at60;
  if (drop < -10 || drop > 90) return null;
  const label = drop >= 30 ? "Mycket bra" : drop >= 20 ? "Bra" : drop >= 12 ? "Normal" : "Låg";
  return { end: rec.end, at60: rec.at60, drop: Math.max(0, drop), label };
}

/* ---------------- Jämförelse med liknande pass ---------------- */

export interface CardioSummary {
  id: string;
  date: string;
  sport: SportKind;
  distanceKm: number;
  minutes: number;
  avgHr: number;
}

export const summarySpeedKmh = (s: Pick<CardioSummary, "distanceKm" | "minutes">) => s.distanceKm / (s.minutes / 60);

export interface SimilarTrend {
  /** Liknande pass i datumordning, inklusive det aktuella. */
  points: Array<CardioSummary & { speedKmh: number; current: boolean }>;
  /** Median av snittpulsen i tidigare liknande pass. */
  baselineHr: number;
  /** Aktuellt pass minus baslinjen (negativt = lägre puls än vanligt). */
  deltaBpm: number;
  verdict: "better" | "same" | "worse";
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Pass av samma sport med liknande tempo/fart (±8 % löp, ±10 % cykel) och
 * distans (hälften till dubbla). Kräver minst två tidigare pass.
 */
export function similarTrend(current: CardioSummary, all: CardioSummary[], maxPoints = 12): SimilarTrend | null {
  const valid = (s: CardioSummary) => s.distanceKm > 0 && s.minutes > 0 && s.avgHr > 40 && s.avgHr < 230;
  if (!valid(current)) return null;
  const v0 = summarySpeedKmh(current);
  const tol = current.sport === "bike" ? 0.1 : 0.08;
  const similar = all.filter((s) =>
    s.id !== current.id && s.sport === current.sport && valid(s) &&
    Math.abs(summarySpeedKmh(s) - v0) / v0 <= tol &&
    s.distanceKm >= current.distanceKm * 0.5 && s.distanceKm <= current.distanceKm * 2,
  );
  const earlier = similar.filter((s) => s.date <= current.date);
  if (earlier.length < 2) return null;
  const baselineHr = Math.round(median(earlier.map((s) => s.avgHr)));
  const deltaBpm = current.avgHr - baselineHr;
  const pts = [...similar, current]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ ...s, speedKmh: Math.round(summarySpeedKmh(s) * 10) / 10, current: s.id === current.id }));
  const idx = pts.findIndex((p) => p.current);
  const from = Math.max(0, Math.min(idx - (maxPoints - 1), pts.length - maxPoints));
  return {
    points: pts.slice(from, from + maxPoints),
    baselineHr,
    deltaBpm,
    verdict: deltaBpm <= -3 ? "better" : deltaBpm >= 3 ? "worse" : "same",
  };
}

/* ---------------- Formatering ---------------- */

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "–";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatClock(totalSec: number): string {
  const t = Math.max(0, Math.round(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Tempo (min/km) för löpning, km/h för cykel. */
export function formatSpeed(ms: number | null | undefined, kind: SportKind): string {
  if (ms == null || !(ms > 0)) return "–";
  return kind === "bike" ? `${(ms * 3.6).toFixed(1).replace(".", ",")} km/h` : `${formatPace(1000 / ms)} /km`;
}
