import { isPrWeight, type PrIndex } from "@/lib/prBadges";
import {
  getCardioDistUnit,
  getStoredCardioMode,
  computeTempoValue,
  modeDisplaySuffix,
  type CardioMode,
} from "@/lib/cardioUnits";

export interface CardioSummary {
  /** Total distance in km across all logged cardio exercises */
  distanceKm: number;
  /** Total logged cardio minutes */
  minutes: number;
  /** Weighted average pulse (bpm), or null when nothing logged */
  pulse: number | null;
  /** Name of the cardio exercise with the most time (drives unit choice) */
  primaryName: string;
  /** Number of distinct cardio exercises logged */
  count: number;
}

export interface WorkoutSummary {
  sets: number;
  volumeKg: number;
  exercises: string[];
  prExercises: string[];
  /** Session length in minutes, or null when it can't be determined */
  durationMin: number | null;
  /** Aggregated cardio metrics, or null when no cardio was logged */
  cardio: CardioSummary | null;
}

const cleanName = (n: string) => n.replace(/( —)+$/, "").trim();

const toNum = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return isFinite(n) ? n : 0;
  }
  return 0;
};

const parsePayload = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value);
      return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch { return null; }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
};

/** min/km from a tempo string like "5:30" or "5,30" */
const paceMinPerKm = (tempo: unknown): number => {
  const raw = String(tempo ?? "").trim().replace(",", ":").replace(".", ":");
  const pair = raw.match(/^(\d+):(\d{1,2})/);
  if (pair) return parseInt(pair[1], 10) + parseInt(pair[2].padEnd(2, "0"), 10) / 60;
  const single = raw.match(/^(\d+)$/);
  return single ? parseInt(single[1], 10) : 0;
};

const entryDistanceKm = (data: Record<string, unknown>): number => {
  const intervals = Array.isArray(data.intervals) ? data.intervals : [];
  if (intervals.length) {
    let sum = 0;
    for (const raw of intervals) {
      const iv = parsePayload(raw) || {};
      const d = toNum(iv.dist ?? iv.distance);
      if (d > 0) { sum += d; continue; }
      const mins = toNum(iv.time);
      const pace = paceMinPerKm(iv.tempo);
      if (mins > 0 && pace > 0) sum += mins / pace;
    }
    if (sum > 0) return sum;
  }
  const direct = toNum(data.dist ?? data.distance);
  if (direct > 0) return direct;
  const mins = toNum(data.time);
  const pace = paceMinPerKm(data.tempo);
  return mins > 0 && pace > 0 ? mins / pace : 0;
};

const entryMinutes = (data: Record<string, unknown>): number => {
  const direct = toNum(data.time);
  if (direct > 0) return direct;
  const intervals = Array.isArray(data.intervals) ? data.intervals : [];
  return intervals.reduce((s, raw) => s + toNum((parsePayload(raw) || {}).time), 0);
};

/** Aggregates every logged cardio exercise in the session. */
function collectCardio(lw: Record<string, unknown>): CardioSummary | null {
  let minutes = 0;
  let distanceKm = 0;
  let pulseWeighted = 0;
  let pulseWeight = 0;
  let bestMinutes = -1;
  let primaryName = "";
  const seen = new Set<string>();
  let count = 0;

  for (const [key, value] of Object.entries(lw)) {
    if (!key.startsWith("__cond__") || key.startsWith("__cond_done__")) continue;
    const name = cleanName(key.substring("__cond__".length));
    const doneFlag = lw[`__cond_done__${key.substring("__cond__".length)}`];
    if (doneFlag !== undefined && doneFlag !== "1") continue;
    const data = parsePayload(value);
    if (!data) continue;

    const sig = JSON.stringify([data.time ?? "", data.dist ?? data.distance ?? "", data.tempo ?? "", data.intervals ?? null]);
    if (seen.has(sig)) continue;
    seen.add(sig);

    const mins = entryMinutes(data);
    const km = entryDistanceKm(data);
    if (mins <= 0 && km <= 0) continue;
    count += 1;
    minutes += mins;
    distanceKm += km;

    const pulse = toNum(data.pulse);
    if (pulse > 0) {
      const w = mins > 0 ? mins : 1;
      pulseWeighted += pulse * w;
      pulseWeight += w;
    }
    if (mins > bestMinutes) { bestMinutes = mins; primaryName = name; }
  }

  if (count === 0) return null;
  return {
    distanceKm,
    minutes,
    pulse: pulseWeight > 0 ? Math.round(pulseWeighted / pulseWeight) : null,
    primaryName,
    count,
  };
}

/**
 * Session duration in minutes.
 * Strength: from the first checked set until the workout was marked done.
 * Cardio: the sum of logged cardio minutes.
 * Both: the longer of the two, so overlapping time isn't counted twice.
 */
function computeDuration(lw: Record<string, unknown>, cardioMin: number, endAt?: Date | number | string | null): number | null {
  const startRaw = lw["__first_set_at__"];
  let strengthMin = 0;
  if (typeof startRaw === "string") {
    const start = new Date(startRaw).getTime();
    const end = endAt ? new Date(endAt as string).getTime() : Date.now();
    if (isFinite(start) && isFinite(end) && end > start) {
      strengthMin = Math.round((end - start) / 60000);
    }
  }
  const total = Math.max(strengthMin, Math.round(cardioMin));
  return total > 0 ? total : null;
}

/** Formats total distance for display, in the unit that suits the sport. */
export function formatCardioDistance(km: number, sportName: string): string {
  if (!(km > 0)) return "–";
  const unit = getCardioDistUnit(sportName);
  if (unit === "m") return `${Math.round(km * 1000)} m`;
  if (km >= 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${km.toFixed(2).replace(".", ",")} km`;
}

/** Weighted average pace/speed across the session, in the sport's unit. */
export function formatCardioPace(minutes: number, km: number, sportName: string): { value: string; label: string } {
  const mode: CardioMode = getStoredCardioMode(sportName);
  const label = mode === "kmh" ? "Snittfart" : "Snittempo";
  if (!(minutes > 0) || !(km > 0)) return { value: "–", label };
  const value = computeTempoValue(mode, minutes, km);
  if (!value) return { value: "–", label };
  return { value: `${value}${modeDisplaySuffix(mode)}`, label };
}


export function formatDurationMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Summarise a single completion's `logged_weights` blob into set count,
 * total volume, exercise list and which exercises hit a personal record.
 */
export function summarizeCompletion(
  loggedWeights: unknown,
  prIndex?: PrIndex,
  endAt?: Date | number | string | null,
): WorkoutSummary {
  const empty: WorkoutSummary = { sets: 0, volumeKg: 0, exercises: [], prExercises: [], durationMin: null, cardio: null };
  if (!loggedWeights || typeof loggedWeights !== "object") return empty;


  const lw = loggedWeights as Record<string, unknown>;
  const exercises = new Set<string>();
  const prExercises = new Set<string>();
  let sets = 0;
  let volumeKg = 0;

  // Which set indexes are checked off, per exercise
  const doneByExercise = new Map<string, string>();
  for (const [key, value] of Object.entries(lw)) {
    if (key.startsWith("__sets__")) {
      doneByExercise.set(cleanName(key.substring("__sets__".length)), String(value ?? ""));
    }
  }

  for (const [key, value] of Object.entries(lw)) {
    if (!key.startsWith("__setdata__")) continue;
    const name = cleanName(key.substring("__setdata__".length));
    let rows: Array<{ kg?: string | number; reps?: string | number }> = [];
    if (typeof value === "string") {
      try { rows = JSON.parse(value); } catch { continue; }
    } else if (Array.isArray(value)) {
      rows = value as typeof rows;
    } else continue;
    if (!Array.isArray(rows)) continue;

    const doneFlags = doneByExercise.get(name) || "";
    rows.forEach((row, i) => {
      const isDone = doneFlags[i] === "1";
      const kg = Number(row?.kg);
      const reps = Number(row?.reps);
      if (!isDone && !isFinite(kg) && !isFinite(reps)) return;
      if (!isDone) return;
      sets += 1;
      exercises.add(name);
      if (isFinite(kg) && kg > 0 && isFinite(reps) && reps > 0) volumeKg += kg * reps;
      if (prIndex && isPrWeight(prIndex, name, kg)) prExercises.add(name);
    });
  }

  // Exercises tracked only via the done flags (bodyweight / conditioning)
  for (const [name, flags] of doneByExercise) {
    const doneCount = (flags.match(/1/g) || []).length;
    if (doneCount > 0 && !exercises.has(name)) {
      exercises.add(name);
      if (!Object.prototype.hasOwnProperty.call(lw, `__setdata__${name}`)) sets += doneCount;
    }
  }

  const cardio = collectCardio(lw);

  return {
    sets,
    volumeKg: Math.round(volumeKg),
    exercises: [...exercises],
    prExercises: [...prExercises],
    durationMin: computeDuration(lw, cardio?.minutes ?? 0, endAt),
    cardio,
  };
}

export function formatVolumeKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace(".", ",")} ton`;
  return `${kg} kg`;
}
