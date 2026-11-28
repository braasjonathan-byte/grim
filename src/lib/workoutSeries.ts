/**
 * Tidsserie för ett helt konditionspass: puls, distans, watt och kadens i
 * jämna tidsfack. Sparas kompakt i konditionsraden (`series`) så att
 * pulsanalysen kan visa hela passet utan att lagra varje råvärde.
 */

export interface WorkoutSeries {
  v: 1;
  /** Starttid (epoch ms) för fack 0. 0 = okänd starttid (äldre data). */
  t0: number;
  /** Sekunder per fack. */
  step: number;
  /** Snittpuls per fack (null = ingen mätning). */
  hr: (number | null)[];
  /** Kumulativ distans i meter vid varje facks slut. */
  d?: number[];
  /** Snittwatt per fack. */
  pw?: (number | null)[];
  /** Snittkadens (varv/min eller steg/min) per fack. */
  cad?: (number | null)[];
  /** Puls vid passets slut och 60 s senare (återhämtning). */
  rec?: { end: number; at60: number };
}

export interface TimedValue { t: number; v: number }

export interface SeriesInput {
  start: number;
  end: number;
  hr?: TimedValue[];
  /** Puls efter passets slut (för återhämtning). */
  hrAfter?: TimedValue[];
  /** Kumulativ distans i meter (t.ex. från en FIT/TCX-fil). */
  distPoints?: { t: number; m: number }[];
  /** Distansposter (start, slut, meter) från Health Connect. */
  distRecords?: { s: number; e: number; m: number }[];
  /** Fart i m/s. */
  speed?: TimedValue[];
  power?: TimedValue[];
  cadence?: TimedValue[];
  route?: { t: number; lat: number; lng: number }[];
}

export const SERIES_MAX_POINTS = 600;
const MIN_STEP_S = 5;
const MIN_HR_BUCKETS = 6;
/** Rimlig maxfart (m/s) när distans räknas ur fart eller rutt. */
const MAX_SPEED_MS = 30;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function bucketAverage(samples: TimedValue[] | undefined, t0: number, stepMs: number, n: number, lo: number, hi: number): (number | null)[] | null {
  if (!samples?.length) return null;
  const sum = new Float64Array(n);
  const cnt = new Uint32Array(n);
  for (const s of samples) {
    if (!finite(s.t) || !finite(s.v) || s.v < lo || s.v > hi) continue;
    const i = Math.floor((s.t - t0) / stepMs);
    if (i < 0 || i >= n) continue;
    sum[i] += s.v;
    cnt[i] += 1;
  }
  const out: (number | null)[] = new Array(n);
  let filled = 0;
  for (let i = 0; i < n; i++) {
    out[i] = cnt[i] ? Math.round(sum[i] / cnt[i]) : null;
    if (cnt[i]) filled += 1;
  }
  return filled ? out : null;
}

/** Fördelar en distansökning över facken proportionellt mot överlappet. */
function spread(inc: Float64Array, t0: number, stepMs: number, value: number, s: number, e: number) {
  const n = inc.length;
  const end = t0 + n * stepMs;
  if (!(value > 0)) return;
  if (e <= s) {
    const i = Math.floor((s - t0) / stepMs);
    if (i >= 0 && i < n) inc[i] += value;
    return;
  }
  const cs = Math.max(s, t0);
  const ce = Math.min(e, end);
  if (ce <= cs) return;
  const perMs = value / (e - s);
  let i = Math.max(0, Math.floor((cs - t0) / stepMs));
  while (i < n) {
    const bs = t0 + i * stepMs;
    const be = bs + stepMs;
    if (bs >= ce) break;
    const ov = Math.min(be, ce) - Math.max(bs, cs);
    if (ov > 0) inc[i] += ov * perMs;
    i += 1;
  }
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distanceIncrements(input: SeriesInput, t0: number, stepMs: number, n: number): Float64Array | null {
  const sessionMs = n * stepMs;
  const total = (inc: Float64Array) => inc.reduce((a, b) => a + b, 0);
  const sorted = <T extends { t: number }>(xs: T[]) => xs.filter((x) => finite(x.t)).sort((a, b) => a.t - b.t);

  // 1. Kumulativ distans ur fil.
  if (input.distPoints && input.distPoints.length > 1) {
    const inc = new Float64Array(n);
    const pts = sorted(input.distPoints).filter((p) => finite(p.m));
    for (let i = 1; i < pts.length; i++) {
      const dm = pts[i].m - pts[i - 1].m;
      const dt = (pts[i].t - pts[i - 1].t) / 1000;
      if (dm <= 0 || (dt > 0 && dm / dt > MAX_SPEED_MS)) continue;
      spread(inc, t0, stepMs, dm, pts[i - 1].t, pts[i].t);
    }
    if (total(inc) > 0) return inc;
  }

  // 2. Detaljerade distansposter. En eller ett par breda poster ger bara ett
  //    jämnt snittempo, vilket vore påhittade delsträckor – hoppa då över.
  const recs = (input.distRecords ?? []).filter((r) => finite(r.s) && finite(r.e) && finite(r.m) && r.m > 0);
  const broad = recs.some((r) => r.e - r.s > sessionMs * 0.25);
  if (recs.length >= 3 && !broad) {
    const inc = new Float64Array(n);
    for (const r of recs) spread(inc, t0, stepMs, r.m, r.s, r.e);
    if (total(inc) > 0) return inc;
  }

  // 3. Fart (m/s) integrerad över tid.
  if (input.speed && input.speed.length > 1) {
    const inc = new Float64Array(n);
    const pts = sorted(input.speed).filter((p) => finite(p.v) && p.v >= 0 && p.v <= MAX_SPEED_MS);
    for (let i = 1; i < pts.length; i++) {
      const dt = (pts[i].t - pts[i - 1].t) / 1000;
      if (dt <= 0 || dt > 30) continue;
      spread(inc, t0, stepMs, ((pts[i].v + pts[i - 1].v) / 2) * dt, pts[i - 1].t, pts[i].t);
    }
    if (total(inc) > 0) return inc;
  }

  // 4. Rutt med tidsstämplar.
  if (input.route && input.route.length > 1) {
    const inc = new Float64Array(n);
    const pts = sorted(input.route).filter((p) => finite(p.lat) && finite(p.lng));
    for (let i = 1; i < pts.length; i++) {
      const dm = haversineM(pts[i - 1], pts[i]);
      const dt = (pts[i].t - pts[i - 1].t) / 1000;
      if (dt <= 0 || dm / dt > MAX_SPEED_MS) continue;
      spread(inc, t0, stepMs, dm, pts[i - 1].t, pts[i].t);
    }
    if (total(inc) > 0) return inc;
  }
  return null;
}

function avgIn(samples: TimedValue[] | undefined, from: number, to: number): number | null {
  let sum = 0;
  let cnt = 0;
  for (const s of samples ?? []) {
    if (s.t < from || s.t > to || !finite(s.v) || s.v <= 25 || s.v >= 240) continue;
    sum += s.v;
    cnt += 1;
  }
  return cnt ? Math.round(sum / cnt) : null;
}

/** Puls vid slutet (sista 15 s) och 60 s efter (50–70 s). Null om data saknas. */
export function recoveryPoint(end: number, hr: TimedValue[] | undefined, hrAfter: TimedValue[] | undefined): { end: number; at60: number } | null {
  const all = [...(hr ?? []), ...(hrAfter ?? [])];
  const atEnd = avgIn(all, end - 15000, end);
  const at60 = avgIn(all, end + 50000, end + 70000);
  return atEnd && at60 ? { end: atEnd, at60 } : null;
}

/** Bygger en jämnt nedsamplad serie för passets tidsintervall. Null om varken puls eller distans finns. */
export function buildWorkoutSeries(input: SeriesInput, maxPoints = SERIES_MAX_POINTS): WorkoutSeries | null {
  const { start, end } = input;
  if (!finite(start) || !finite(end) || end - start < 60000) return null;
  const durS = (end - start) / 1000;
  const step = Math.max(MIN_STEP_S, Math.ceil(durS / maxPoints));
  const stepMs = step * 1000;
  const n = Math.ceil(durS / step);

  let hr = bucketAverage(input.hr, start, stepMs, n, 26, 239);
  if (hr && hr.filter((x) => x != null).length < MIN_HR_BUCKETS) hr = null;
  const inc = distanceIncrements(input, start, stepMs, n);
  const pw = bucketAverage(input.power, start, stepMs, n, 0, 2500);
  const cad = bucketAverage(input.cadence, start, stepMs, n, 0, 260);
  if (!hr && !inc && !pw && !cad) return null;

  const series: WorkoutSeries = { v: 1, t0: start, step, hr: hr ?? new Array(n).fill(null) };
  if (inc) {
    const d: number[] = new Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += inc[i]; d[i] = Math.round(acc); }
    series.d = d;
  }
  if (pw && pw.some((x) => x != null && x > 0)) series.pw = pw;
  if (cad && cad.some((x) => x != null && x > 0)) series.cad = cad;
  const rec = hr ? recoveryPoint(end, input.hr, input.hrAfter) : null;
  if (rec) series.rec = rec;
  return series;
}

const numOrNullArray = (a: unknown, n: number, lo: number, hi: number): (number | null)[] | null => {
  if (!Array.isArray(a) || a.length !== n) return null;
  return a.map((x) => (finite(x) && x >= lo && x <= hi ? x : null));
};

/** Läser en sparad serie och tål trasiga eller främmande värden. */
export function parseWorkoutSeries(raw: unknown): WorkoutSeries | null {
  const obj = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.v !== 1 || !finite(o.step) || o.step <= 0 || !finite(o.t0) || !Array.isArray(o.hr)) return null;
  const n = o.hr.length;
  if (n < 2 || n > 5000) return null;
  const hr = numOrNullArray(o.hr, n, 1, 260);
  if (!hr) return null;
  const s: WorkoutSeries = { v: 1, t0: o.t0, step: o.step, hr };
  if (Array.isArray(o.d) && o.d.length === n && o.d.every(finite)) s.d = o.d as number[];
  const pw = numOrNullArray(o.pw, n, 0, 3000);
  if (pw) s.pw = pw;
  const cad = numOrNullArray(o.cad, n, 0, 300);
  if (cad) s.cad = cad;
  const rec = o.rec as Record<string, unknown> | undefined;
  if (rec && finite(rec.end) && finite(rec.at60)) s.rec = { end: rec.end, at60: rec.at60 };
  if (!hr.some((x) => x != null) && !s.d && !pw?.some(x => x != null) && !cad?.some(x => x != null)) return null;
  return s;
}

/** Äldre pass har bara en jämnt fördelad pulslista utan tider. */
export function seriesFromEvenHr(hr: unknown, minutes: number | null): WorkoutSeries | null {
  if (!Array.isArray(hr)) return null;
  const vals = hr.map((x) => (finite(x) && x > 25 && x < 240 ? Math.round(x) : null));
  if (vals.filter((x) => x != null).length < 2) return null;
  const totalS = minutes && minutes > 0 ? minutes * 60 : vals.length * 60;
  return { v: 1, t0: 0, step: totalS / vals.length, hr: vals };
}

/** Puls inspelad i Grim (t.ex. pulsband) med tidsstämplar. */
export function seriesFromTimedHr(raw: unknown): WorkoutSeries | null {
  if (!Array.isArray(raw)) return null;
  const hr = raw
    .map((x) => ({ t: Number((x as any)?.t), v: Number((x as any)?.bpm) }))
    .filter((x) => finite(x.t) && finite(x.v))
    .sort((a, b) => a.t - b.t);
  if (hr.length < 2) return null;
  return buildWorkoutSeries({ start: hr[0].t, end: hr[hr.length - 1].t + 1000, hr });
}

/** Antal datakanaler – används för att avgöra om en omhämtning ger mer data. */
export function seriesRichness(s: WorkoutSeries | null): number {
  if (!s) return 0;
  return (s.hr.some((x) => x != null) ? 1 : 0) + (s.d ? 2 : 0) + (s.pw ? 1 : 0) + (s.cad ? 1 : 0) + (s.rec ? 1 : 0);
}
