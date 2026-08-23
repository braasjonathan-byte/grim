/**
 * Parsning av träningsfiler (GPX / TCX / FIT) från Garmin Connect, Strava,
 * Zwift m.fl. Modulen är helt fristående och innehåller ingen sparlogik –
 * den returnerar en normaliserad `ParsedActivity` som både manuell filimport
 * och "Dela till Grim" använder.
 */

export interface TrackPoint {
  lat?: number;
  lon?: number;
  /** Höjd i meter */
  ele?: number;
  /** Tidsstämpel (ms) */
  t?: number;
  /** Puls (bpm) */
  hr?: number;
}

export interface ParsedActivity {
  /** Rå aktivitetstyp ur filen, t.ex. "running", "Ride", "cycling" */
  rawType: string | null;
  /** Grims svenska övningsnamn, t.ex. "Löpning" */
  exerciseName: string;
  /** Passnamn ur filen om det finns */
  title: string | null;
  startTime: Date | null;
  /** Total tid i sekunder */
  durationSec: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgWatt: number | null;
  calories: number | null;
  points: TrackPoint[];
  /** Filformat som lästes */
  format: "gpx" | "tcx" | "fit";
  fileName: string;
}

/* ------------------------------------------------------------------ */
/* Aktivitetstyp → Grims övningsnamn                                    */
/* ------------------------------------------------------------------ */

const TYPE_MAP: Array<[RegExp, string]> = [
  [/trail\s*run/i, "Löpning"],
  [/treadmill/i, "Löpning"],
  [/\brun(ning)?\b|\bjog/i, "Löpning"],
  [/virtual\s*ride|indoor\s*cycl|spinning|zwift/i, "Cykling"],
  [/mountain\s*bike|mtb|gravel|e-?bike/i, "Cykling"],
  [/\bride\b|cycl(ing|e)?|biking|\bbike\b/i, "Cykling"],
  [/open\s*water|lap\s*swim|swim(ming)?/i, "Simning"],
  [/hik(e|ing)|trekking/i, "Vandring"],
  [/walk(ing)?/i, "Promenad"],
  [/row(ing|er)?|kayak|canoe|paddl/i, "Roddmaskin"],
  [/elliptical|cross\s*trainer/i, "Crosstrainer"],
  [/stair|step\s*machine/i, "Trappmaskin"],
  [/nordic\s*ski|cross\s*country\s*ski|\bski\b|skating/i, "Skidåkning"],
  [/löpning|springa/i, "Löpning"],
  [/cykl|cykel/i, "Cykling"],
  [/simning/i, "Simning"],
  [/vandring/i, "Vandring"],
  [/promenad/i, "Promenad"],
];

/** Mappar en aktivitetstyp ur filen mot Grims övningsnamn. */
export function mapActivityType(raw: string | null | undefined): string {
  const t = (raw || "").trim();
  if (!t) return "Löpning";
  for (const [re, name] of TYPE_MAP) if (re.test(t)) return name;
  return "Löpning";
}

/** Övningar som kan väljas manuellt om filens typ är fel eller saknas. */
export const IMPORT_EXERCISE_OPTIONS = [
  "Löpning",
  "Cykling",
  "Simning",
  "Vandring",
  "Promenad",
  "Roddmaskin",
  "Crosstrainer",
  "Trappmaskin",
  "Skidåkning",
];

/* ------------------------------------------------------------------ */
/* Hjälpare                                                            */
/* ------------------------------------------------------------------ */

const toRad = (d: number) => (d * Math.PI) / 180;

/** Haversine-avstånd i meter. */
function distanceM(a: TrackPoint, b: TrackPoint): number {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return 0;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function trackDistanceKm(points: TrackPoint[]): number | null {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += distanceM(points[i - 1], points[i]);
  return m > 0 ? m / 1000 : null;
}

/** Höjdökning/-minskning med enkel brusfiltrering (3 m tröskel). */
function elevationDelta(points: TrackPoint[]): { gain: number | null; loss: number | null } {
  const eles = points.map((p) => p.ele).filter((e): e is number => typeof e === "number");
  if (eles.length < 2) return { gain: null, loss: null };
  let gain = 0;
  let loss = 0;
  let ref = eles[0];
  for (const e of eles) {
    const d = e - ref;
    if (d > 3) {
      gain += d;
      ref = e;
    } else if (d < -3) {
      loss += -d;
      ref = e;
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

function avg(nums: number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n) && n > 0);
  if (!v.length) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

const numOrNull = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Filen kunde inte läsas som XML.");
  return doc;
}

/** Hämtar element oavsett namespace-prefix. */
function tags(root: ParentNode, local: string): Element[] {
  return Array.from(root.querySelectorAll("*")).filter(
    (el) => el.localName.toLowerCase() === local.toLowerCase(),
  );
}

function firstText(root: ParentNode, local: string): string | null {
  const el = tags(root, local)[0];
  return el?.textContent?.trim() || null;
}

/* ------------------------------------------------------------------ */
/* GPX                                                                 */
/* ------------------------------------------------------------------ */

function parseGpx(text: string, fileName: string): ParsedActivity {
  const doc = parseXml(text);
  const trkpts = tags(doc, "trkpt");
  const points: TrackPoint[] = trkpts.map((pt) => {
    const timeEl = tags(pt, "time")[0];
    const hrEl = tags(pt, "hr")[0] ?? tags(pt, "heartrate")[0];
    const t = timeEl?.textContent ? Date.parse(timeEl.textContent) : NaN;
    return {
      lat: numOrNull(pt.getAttribute("lat")) ?? undefined,
      lon: numOrNull(pt.getAttribute("lon")) ?? undefined,
      ele: numOrNull(firstText(pt, "ele")) ?? undefined,
      t: Number.isFinite(t) ? t : undefined,
      hr: numOrNull(hrEl?.textContent ?? null) ?? undefined,
    };
  });

  const trk = tags(doc, "trk")[0];
  const title = trk ? firstText(trk, "name") : null;
  const rawType = (trk ? firstText(trk, "type") : null) ?? firstText(doc, "type");

  const times = points.map((p) => p.t).filter((t): t is number => typeof t === "number");
  const startTime = times.length ? new Date(Math.min(...times)) : null;
  const durationSec = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 1000) : null;
  const { gain, loss } = elevationDelta(points);
  const hrs = points.map((p) => p.hr).filter((h): h is number => typeof h === "number");

  return {
    rawType,
    exerciseName: mapActivityType(rawType ?? title),
    title,
    startTime,
    durationSec,
    distanceKm: trackDistanceKm(points),
    elevationGainM: gain,
    elevationLossM: loss,
    avgHeartRate: avg(hrs),
    maxHeartRate: hrs.length ? Math.max(...hrs) : null,
    avgWatt: null,
    calories: null,
    points,
    format: "gpx",
    fileName,
  };
}

/* ------------------------------------------------------------------ */
/* TCX                                                                 */
/* ------------------------------------------------------------------ */

function parseTcx(text: string, fileName: string): ParsedActivity {
  const doc = parseXml(text);
  const activity = tags(doc, "Activity")[0] ?? doc;
  const rawType = activity instanceof Element ? activity.getAttribute("Sport") : null;

  const points: TrackPoint[] = tags(doc, "Trackpoint").map((tp) => {
    const pos = tags(tp, "Position")[0];
    const hrEl = tags(tp, "HeartRateBpm")[0];
    const t = firstText(tp, "Time");
    const ts = t ? Date.parse(t) : NaN;
    return {
      lat: pos ? numOrNull(firstText(pos, "LatitudeDegrees")) ?? undefined : undefined,
      lon: pos ? numOrNull(firstText(pos, "LongitudeDegrees")) ?? undefined : undefined,
      ele: numOrNull(firstText(tp, "AltitudeMeters")) ?? undefined,
      t: Number.isFinite(ts) ? ts : undefined,
      hr: hrEl ? numOrNull(firstText(hrEl, "Value")) ?? undefined : undefined,
    };
  });

  // Laps innehåller redan summerade värden – använd dem när de finns.
  const laps = tags(doc, "Lap");
  let totalSec = 0;
  let totalM = 0;
  let calories = 0;
  const lapHr: number[] = [];
  const lapWatt: number[] = [];
  for (const lap of laps) {
    totalSec += numOrNull(firstText(lap, "TotalTimeSeconds")) ?? 0;
    totalM += numOrNull(firstText(lap, "DistanceMeters")) ?? 0;
    calories += numOrNull(firstText(lap, "Calories")) ?? 0;
    const hrEl = tags(lap, "AverageHeartRateBpm")[0];
    const hr = hrEl ? numOrNull(firstText(hrEl, "Value")) : null;
    if (hr) lapHr.push(hr);
    const w = numOrNull(firstText(lap, "AvgWatts")) ?? numOrNull(firstText(lap, "Watts"));
    if (w) lapWatt.push(w);
  }

  const times = points.map((p) => p.t).filter((t): t is number => typeof t === "number");
  const startTime = laps.length
    ? (() => {
        const s = (laps[0] as Element).getAttribute("StartTime");
        const ms = s ? Date.parse(s) : NaN;
        return Number.isFinite(ms) ? new Date(ms) : times.length ? new Date(Math.min(...times)) : null;
      })()
    : times.length
      ? new Date(Math.min(...times))
      : null;

  const { gain, loss } = elevationDelta(points);
  const hrs = points.map((p) => p.hr).filter((h): h is number => typeof h === "number");

  return {
    rawType,
    exerciseName: mapActivityType(rawType),
    title: firstText(doc, "Notes"),
    startTime,
    durationSec: totalSec > 0 ? Math.round(totalSec) : times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 1000) : null,
    distanceKm: totalM > 0 ? totalM / 1000 : trackDistanceKm(points),
    elevationGainM: gain,
    elevationLossM: loss,
    avgHeartRate: avg(lapHr) ?? avg(hrs),
    maxHeartRate: hrs.length ? Math.max(...hrs) : null,
    avgWatt: avg(lapWatt),
    calories: calories > 0 ? Math.round(calories) : null,
    points,
    format: "tcx",
    fileName,
  };
}

/* ------------------------------------------------------------------ */
/* FIT                                                                 */
/* ------------------------------------------------------------------ */

const FIT_SPORT_NAMES: Record<number, string> = {
  1: "running",
  2: "cycling",
  5: "swimming",
  11: "walking",
  12: "cross country skiing",
  15: "rowing",
  17: "hiking",
};

async function parseFit(buffer: ArrayBuffer, fileName: string): Promise<ParsedActivity> {
  const { Decoder, Stream } = await import("@garmin/fitsdk");
  const stream = Stream.fromArrayBuffer(buffer);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT()) throw new Error("Filen är inte en giltig FIT-fil.");
  const { messages } = decoder.read();

  const sessions: Record<string, unknown>[] = (messages as Record<string, unknown[]>).sessionMesgs as never ?? [];
  const records: Record<string, unknown>[] = (messages as Record<string, unknown[]>).recordMesgs as never ?? [];
  const session = sessions[0] ?? {};

  const g = (obj: Record<string, unknown>, key: string): number | null => {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  };

  const points: TrackPoint[] = records.map((r) => {
    const ts = r.timestamp;
    const time = ts instanceof Date ? ts.getTime() : typeof ts === "number" ? ts * 1000 : undefined;
    return {
      lat: g(r, "positionLat") ?? undefined,
      lon: g(r, "positionLong") ?? undefined,
      ele: g(r, "altitude") ?? g(r, "enhancedAltitude") ?? undefined,
      t: time,
      hr: g(r, "heartRate") ?? undefined,
    };
  });

  const sportRaw = session.sport;
  const rawType =
    typeof sportRaw === "string"
      ? sportRaw
      : typeof sportRaw === "number"
        ? FIT_SPORT_NAMES[sportRaw] ?? null
        : null;
  const subSport = typeof session.subSport === "string" ? session.subSport : null;

  const distM = g(session, "totalDistance");
  const startTs = session.startTime;
  const { gain, loss } = elevationDelta(points);
  const hrs = points.map((p) => p.hr).filter((h): h is number => typeof h === "number");

  return {
    rawType: [subSport, rawType].filter(Boolean).join(" ") || null,
    exerciseName: mapActivityType([subSport, rawType].filter(Boolean).join(" ")),
    title: typeof session.eventType === "string" ? null : null,
    startTime:
      startTs instanceof Date
        ? startTs
        : typeof startTs === "number"
          ? new Date(startTs * 1000)
          : points.find((p) => p.t)?.t
            ? new Date(points.find((p) => p.t)!.t!)
            : null,
    durationSec: g(session, "totalTimerTime") ?? g(session, "totalElapsedTime"),
    distanceKm: distM ? distM / 1000 : trackDistanceKm(points),
    elevationGainM: g(session, "totalAscent") ?? gain,
    elevationLossM: g(session, "totalDescent") ?? loss,
    avgHeartRate: g(session, "avgHeartRate") ?? avg(hrs),
    maxHeartRate: g(session, "maxHeartRate") ?? (hrs.length ? Math.max(...hrs) : null),
    avgWatt: g(session, "avgPower"),
    calories: g(session, "totalCalories"),
    points,
    format: "fit",
    fileName,
  };
}

/* ------------------------------------------------------------------ */
/* Publik ingång                                                       */
/* ------------------------------------------------------------------ */

export function isSupportedActivityFile(name: string): boolean {
  return /\.(gpx|tcx|fit)$/i.test(name.trim());
}

/** Läser en fil (File eller {name, data}) och returnerar normaliserad aktivitet. */
export async function parseActivityFile(file: File): Promise<ParsedActivity> {
  const name = file.name || "aktivitet";
  const ext = (name.split(".").pop() || "").toLowerCase();

  if (ext === "fit") return parseFit(await file.arrayBuffer(), name);

  const text = await file.text();
  if (ext === "tcx" || /<TrainingCenterDatabase/i.test(text)) return parseTcx(text, name);
  if (ext === "gpx" || /<gpx/i.test(text)) return parseGpx(text, name);
  throw new Error("Formatet stöds inte. Välj en .gpx-, .tcx- eller .fit-fil.");
}

/** Läser en fil från base64 (används av delnings-intent på Android). */
export async function parseActivityFromBase64(name: string, base64: string): Promise<ParsedActivity> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return parseActivityFile(new File([bytes], name));
}
