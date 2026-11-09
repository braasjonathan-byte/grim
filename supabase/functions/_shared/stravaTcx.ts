// Pure helpers for exporting a Grim workout to Strava (no Deno/Node APIs → testable in vitest).

export type StravaExportInput = {
  completionId: string;
  name: string;
  /** Strava sport_type, e.g. Run, Ride, WeightTraining, Workout */
  sportType: string;
  startIso: string;
  /** Lokal väggklocktid utan zon, t.ex. "2026-11-09T18:30:00" (Strava start_date_local) */
  startLocal?: string | null;
  elapsedSec: number;
  distanceM?: number | null;
  calories?: number | null;
  description?: string | null;
  /** Pulsvärden med tidsstämpel (ms) */
  hr?: { t: number; bpm: number }[] | null;
  /** GPS-rutt [lat, lng] utan tider – fördelas jämnt över passet */
  route?: [number, number][] | null;
};

const SPORT_TYPES = new Set([
  "Run", "TrailRun", "VirtualRun", "Walk", "Hike", "Ride", "VirtualRide", "MountainBikeRide", "GravelRide", "EBikeRide",
  "Swim", "Rowing", "VirtualRow", "Kayaking", "Canoeing", "StandUpPaddling", "NordicSki", "AlpineSki", "BackcountrySki",
  "Snowboard", "IceSkate", "InlineSkate", "Elliptical", "StairStepper", "WeightTraining", "Workout", "Crossfit", "HighIntensityIntervalTraining",
  "Yoga", "Pilates", "Soccer", "Tennis", "Padel", "Badminton", "Squash", "TableTennis", "Golf", "RockClimbing",
]);

export const safeSportType = (s: string | null | undefined) => (s && SPORT_TYPES.has(s) ? s : "Workout");

/** Grim-text → Strava sport_type. Styrka är standard när inget annat matchar. */
export function stravaSportType(text: string, hasStrengthSets: boolean): string {
  const t = (text || "").toLowerCase();
  if (/löpband|treadmill/.test(t)) return "Run";
  if (/trail|terräng/.test(t)) return "TrailRun";
  if (/löp|jogg|\brun/.test(t)) return "Run";
  if (/mtb|mountainbike/.test(t)) return "MountainBikeRide";
  if (/gravel/.test(t)) return "GravelRide";
  if (/zwift|motionscykel|motioncykel|spinning|trainer/.test(t)) return "VirtualRide";
  if (/cykl|cykel|ride|bike/.test(t)) return "Ride";
  if (/simn|sim\b|swim|crawl/.test(t)) return "Swim";
  if (/rodd|row|concept/.test(t)) return "Rowing";
  if (/promenad|gång|walk/.test(t)) return "Walk";
  if (/vandr|hike/.test(t)) return "Hike";
  if (/längdskid|langdskid|skidor|ski/.test(t)) return "NordicSki";
  if (/crosstrainer|cross-trainer|elliptical/.test(t)) return "Elliptical";
  if (/trapp|stair/.test(t)) return "StairStepper";
  if (/yoga/.test(t)) return "Yoga";
  if (/crossfit|wod\b/.test(t)) return "Crossfit";
  if (/hiit|intervall/.test(t)) return "HighIntensityIntervalTraining";
  if (/padel/.test(t)) return "Padel";
  if (hasStrengthSets) return "WeightTraining";
  return "Workout";
}

const TCX_SPORT: Record<string, string> = { Run: "Running", TrailRun: "Running", VirtualRun: "Running", Walk: "Running", Hike: "Running", Ride: "Biking", VirtualRide: "Biking", MountainBikeRide: "Biking", GravelRide: "Biking", EBikeRide: "Biking" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Haversine i meter. */
function distM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** True när passet har data som bara går att få in via filuppladdning (puls/GPS). */
export function needsFileUpload(input: StravaExportInput): boolean {
  return (input.hr?.length ?? 0) >= 2 || (input.route?.length ?? 0) >= 2;
}

/**
 * Bygger en TCX-fil (Garmin Training Center) med pulsserie och ev. GPS-rutt.
 * Strava läser sporten ur Activity Sport (Running/Biking/Other); exakt sport_type sätts efteråt.
 */
export function buildTcx(input: StravaExportInput): string {
  const start = new Date(input.startIso).getTime();
  const elapsed = Math.max(1, Math.round(input.elapsedSec));
  const end = start + elapsed * 1000;
  const sport = TCX_SPORT[input.sportType] || "Other";
  const hr = (input.hr || []).filter((x) => x.t >= start - 60000 && x.t <= end + 60000 && x.bpm > 0).sort((a, b) => a.t - b.t);
  const route = (input.route || []).filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]));

  // Tidpunkter för trackpoints: pulsens tider, annars jämnt fördelat över rutten
  type Tp = { t: number; bpm?: number; pos?: [number, number]; dist?: number };
  const points: Tp[] = [];
  const routeCum: number[] = [];
  let total = 0;
  route.forEach((p, i) => { if (i) total += distM(route[i - 1], p); routeCum.push(total); });
  const posAt = (t: number): { pos: [number, number]; dist: number } | null => {
    if (route.length < 2) return null;
    const frac = Math.min(1, Math.max(0, (t - start) / (end - start)));
    const idx = Math.min(route.length - 1, Math.round(frac * (route.length - 1)));
    return { pos: route[idx], dist: routeCum[idx] };
  };
  if (hr.length >= 2) {
    for (const h of hr) { const p = posAt(h.t); points.push({ t: Math.min(Math.max(h.t, start), end), bpm: Math.round(h.bpm), ...(p ? { pos: p.pos, dist: p.dist } : {}) }); }
  } else if (route.length >= 2) {
    route.forEach((pos, i) => points.push({ t: start + Math.round(((end - start) * i) / (route.length - 1)), pos, dist: routeCum[i] }));
  } else {
    points.push({ t: start }, { t: end });
  }
  const distanceM = input.distanceM && input.distanceM > 0 ? input.distanceM : total;
  // Skala GPS-distansen så att den stämmer med passets loggade distans
  const scale = total > 0 && distanceM > 0 ? distanceM / total : 1;

  const bpms = hr.map((h) => h.bpm);
  const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
  const tps = points.map((p) => [
    "          <Trackpoint>",
    `            <Time>${iso(p.t)}</Time>`,
    p.pos ? `            <Position><LatitudeDegrees>${p.pos[0].toFixed(6)}</LatitudeDegrees><LongitudeDegrees>${p.pos[1].toFixed(6)}</LongitudeDegrees></Position>` : null,
    p.dist !== undefined ? `            <DistanceMeters>${(p.dist * scale).toFixed(1)}</DistanceMeters>` : null,
    p.bpm ? `            <HeartRateBpm><Value>${p.bpm}</Value></HeartRateBpm>` : null,
    "          </Trackpoint>",
  ].filter(Boolean).join("\n")).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">',
    "  <Activities>",
    `    <Activity Sport="${sport}">`,
    `      <Id>${iso(start)}</Id>`,
    `      <Lap StartTime="${iso(start)}">`,
    `        <TotalTimeSeconds>${elapsed}</TotalTimeSeconds>`,
    `        <DistanceMeters>${(distanceM || 0).toFixed(1)}</DistanceMeters>`,
    `        <Calories>${Math.max(0, Math.round(input.calories || 0))}</Calories>`,
    bpms.length ? `        <AverageHeartRateBpm><Value>${Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)}</Value></AverageHeartRateBpm>` : null,
    bpms.length ? `        <MaximumHeartRateBpm><Value>${Math.max(...bpms)}</Value></MaximumHeartRateBpm>` : null,
    "        <Intensity>Active</Intensity>",
    "        <TriggerMethod>Manual</TriggerMethod>",
    "        <Track>",
    tps,
    "        </Track>",
    "      </Lap>",
    `      <Notes>${esc((input.description || "").slice(0, 1000))}</Notes>`,
    "    </Activity>",
    "  </Activities>",
    "</TrainingCenterDatabase>",
  ].filter((l) => l !== null).join("\n");
}

/** Parametrar för Stravas POST /activities (manuellt pass utan puls/GPS). */
export function manualActivityParams(input: StravaExportInput): Record<string, string> {
  const p: Record<string, string> = {
    name: input.name.slice(0, 100) || "Grim-pass",
    sport_type: safeSportType(input.sportType),
    start_date_local: localStart(input),
    elapsed_time: String(Math.max(60, Math.round(input.elapsedSec))),
    external_id: `grim-${input.completionId}`,
  };
  if (input.distanceM && input.distanceM > 0) p.distance = String(Math.round(input.distanceM));
  if (input.description) p.description = input.description.slice(0, 1000);
  return p;
}

/** Strava tolkar start_date_local som användarens väggklocka. Utan lokal tid skickas UTC med Z. */
function localStart(input: StravaExportInput): string {
  if (input.startLocal && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input.startLocal)) return input.startLocal;
  return new Date(input.startIso).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export const externalIdFor = (completionId: string) => `grim-${completionId}`;
