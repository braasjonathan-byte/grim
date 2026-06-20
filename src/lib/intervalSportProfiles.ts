// Per-sport profiles for the IntervalRunner / IntervalConfigDialog.
// Defines default units, labels and voice phrasing per cardio form.
// Used for all "– Intervaller" exercises.

export type IntervalUnit =
  | "distance_km"
  | "distance_m"
  | "time"
  | "calories"
  | "reps"
  | "laps";

export interface IntervalSportProfile {
  /** Short label used in voice and UI ("löpning", "cykling"…) */
  sport: string;
  /** Default measurement unit for an interval. */
  defaultUnit: IntervalUnit;
  /** Units the user can pick from in the config dialog. */
  availableUnits: IntervalUnit[];
  /** Default distance per interval (in the default unit). */
  defaultValue: number;
  /** Default rest between intervals (seconds). */
  defaultRestSec: number;
  /** Default warmup minutes. */
  defaultWarmupMin: number;
  /** Default cooldown minutes. */
  defaultCooldownMin: number;
  /** Label shown for the pace/effort column (e.g. "Tempo", "Fart", "Watt"). */
  paceLabel: string;
  /** Display unit suffix for pace (e.g. "/km", "km/h", "/100m", "/500m", "W"). */
  paceUnit: string;
  /** Spoken pace phrase, e.g. "per kilometer", "kilometer i timmen", "per 100 meter". */
  paceSpoken: string;
  /** Whether GPS makes sense for this sport (outdoor). */
  supportsGps: boolean;
}

const PROFILES: Array<{ match: RegExp; profile: IntervalSportProfile }> = [
  {
    match: /(?:^|[\s\-–])(löpning|löp|jogg|tröskellöp|långpass|sprint)/i,
    profile: { sport: "löpning", defaultUnit: "distance_m", availableUnits: ["distance_m","distance_km","time"], defaultValue: 400, defaultRestSec: 90, defaultWarmupMin: 10, defaultCooldownMin: 5, paceLabel: "Tempo", paceUnit: "/km", paceSpoken: "per kilometer", supportsGps: true },
  },
  {
    match: /cykling|cykel|spinning/i,
    profile: { sport: "cykling", defaultUnit: "distance_km", availableUnits: ["distance_km","distance_m","time"], defaultValue: 2, defaultRestSec: 120, defaultWarmupMin: 10, defaultCooldownMin: 5, paceLabel: "Fart", paceUnit: "km/h", paceSpoken: "kilometer i timmen", supportsGps: true },
  },
  {
    match: /simning|sim\b/i,
    profile: { sport: "simning", defaultUnit: "distance_m", availableUnits: ["distance_m","time","laps"], defaultValue: 100, defaultRestSec: 30, defaultWarmupMin: 5, defaultCooldownMin: 3, paceLabel: "Tempo", paceUnit: "/100m", paceSpoken: "per 100 meter", supportsGps: false },
  },
  {
    match: /roddmaskin|^rodd|skierg|ski erg/i,
    profile: { sport: "rodd", defaultUnit: "distance_m", availableUnits: ["distance_m","time","calories"], defaultValue: 500, defaultRestSec: 90, defaultWarmupMin: 5, defaultCooldownMin: 3, paceLabel: "Tempo", paceUnit: "/500m", paceSpoken: "per 500 meter", supportsGps: false },
  },
  {
    match: /crosstrainer/i,
    profile: { sport: "crosstrainer", defaultUnit: "time", availableUnits: ["time","distance_km","calories"], defaultValue: 60, defaultRestSec: 60, defaultWarmupMin: 5, defaultCooldownMin: 3, paceLabel: "Fart", paceUnit: "km/h", paceSpoken: "kilometer i timmen", supportsGps: false },
  },
  {
    match: /trappmaskin|stair\s*machine|stairclimber/i,
    profile: { sport: "trappmaskin", defaultUnit: "time", availableUnits: ["time","calories"], defaultValue: 60, defaultRestSec: 60, defaultWarmupMin: 5, defaultCooldownMin: 3, paceLabel: "Steg/min", paceUnit: "spm", paceSpoken: "steg per minut", supportsGps: false },
  },
  {
    match: /airbike|air bike|assault\s*bike/i,
    profile: { sport: "airbike", defaultUnit: "calories", availableUnits: ["calories","time","distance_km"], defaultValue: 10, defaultRestSec: 60, defaultWarmupMin: 3, defaultCooldownMin: 2, paceLabel: "Watt", paceUnit: "W", paceSpoken: "watt", supportsGps: false },
  },
  {
    match: /hopprep|jump rope/i,
    profile: { sport: "hopprep", defaultUnit: "time", availableUnits: ["time","reps"], defaultValue: 60, defaultRestSec: 30, defaultWarmupMin: 2, defaultCooldownMin: 2, paceLabel: "Frekvens", paceUnit: "/min", paceSpoken: "hopp per minut", supportsGps: false },
  },
  {
    match: /promenad|vandring|(?<![-\w])gång(?![-\w])/i,
    profile: { sport: "promenad", defaultUnit: "time", availableUnits: ["time","distance_km","distance_m"], defaultValue: 120, defaultRestSec: 60, defaultWarmupMin: 5, defaultCooldownMin: 5, paceLabel: "Tempo", paceUnit: "/km", paceSpoken: "per kilometer", supportsGps: true },
  },
  {
    match: /skidåkning|skidor|längdskid/i,
    profile: { sport: "skidåkning", defaultUnit: "distance_km", availableUnits: ["distance_km","distance_m","time"], defaultValue: 1, defaultRestSec: 90, defaultWarmupMin: 10, defaultCooldownMin: 5, paceLabel: "Tempo", paceUnit: "/km", paceSpoken: "per kilometer", supportsGps: true },
  },
  {
    match: /skridsko/i,
    profile: { sport: "skridsko", defaultUnit: "distance_m", availableUnits: ["distance_m","distance_km","time"], defaultValue: 400, defaultRestSec: 90, defaultWarmupMin: 5, defaultCooldownMin: 5, paceLabel: "Tempo", paceUnit: "/km", paceSpoken: "per kilometer", supportsGps: true },
  },
  {
    match: /paddling|kajak|kanot/i,
    profile: { sport: "paddling", defaultUnit: "distance_m", availableUnits: ["distance_m","distance_km","time"], defaultValue: 500, defaultRestSec: 90, defaultWarmupMin: 5, defaultCooldownMin: 5, paceLabel: "Tempo", paceUnit: "/500m", paceSpoken: "per 500 meter", supportsGps: true },
  },
];

const DEFAULT_PROFILE: IntervalSportProfile = PROFILES[0].profile;

export function getIntervalProfile(exerciseName: string | undefined | null): IntervalSportProfile {
  if (!exerciseName) return DEFAULT_PROFILE;
  for (const p of PROFILES) if (p.match.test(exerciseName)) return p.profile;
  return DEFAULT_PROFILE;
}

export const UNIT_LABELS: Record<IntervalUnit, string> = {
  distance_km: "Distans (km)",
  distance_m: "Distans (m)",
  time: "Tid",
  calories: "Kalorier",
  reps: "Antal",
  laps: "Längder",
};

export const UNIT_SHORT: Record<IntervalUnit, string> = {
  distance_km: "km",
  distance_m: "m",
  time: "sek",
  calories: "kcal",
  reps: "st",
  laps: "längder",
};

/** Convert a value+unit to a duration in seconds, using a target pace string if needed. */
export function valueToSeconds(value: number, unit: IntervalUnit, paceMinPerKm: number | null): number {
  if (unit === "time") return Math.max(5, Math.round(value));
  if (unit === "distance_km" && paceMinPerKm && paceMinPerKm > 0) return Math.max(5, Math.round(value * paceMinPerKm * 60));
  if (unit === "distance_m" && paceMinPerKm && paceMinPerKm > 0) return Math.max(5, Math.round((value / 1000) * paceMinPerKm * 60));
  // Fallback when no pace: 1 cal ≈ 6s, 1 rep ≈ 1s, 1 lap ≈ 30s
  if (unit === "calories") return Math.max(5, Math.round(value * 6));
  if (unit === "reps") return Math.max(5, Math.round(value));
  if (unit === "laps") return Math.max(5, Math.round(value * 30));
  return 60;
}

/** Compose a Swedish spoken phrase describing the target of an interval. */
export function spokenTarget(value: number, unit: IntervalUnit, profile: IntervalSportProfile): string {
  if (unit === "distance_m") return `${value} meter`;
  if (unit === "distance_km") return value === 1 ? `1 kilometer` : `${value} kilometer`;
  if (unit === "time") {
    const m = Math.floor(value / 60);
    const s = value % 60;
    if (m === 0) return `${s} sekunder`;
    if (s === 0) return `${m} minuter`;
    return `${m} minuter ${s} sekunder`;
  }
  if (unit === "calories") return `${value} kalorier`;
  if (unit === "reps") return `${value} ${profile.sport === "hopprep" ? "hopp" : "repetitioner"}`;
  if (unit === "laps") return value === 1 ? `1 längd` : `${value} längder`;
  return `${value}`;
}
