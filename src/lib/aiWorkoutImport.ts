/**
 * Omvandlar AI-tolkade övningar från en skärmdump till riktiga övningsrader:
 * en detaljrad per övning + färdigifyllda loggvärden (__setdata__ / __cond__)
 * så att passet registreras som riktiga övningar och inte bara som text.
 */
import { getCardioModes, getCardioDistUnit, showCardioElevation, type CardioMode } from "@/lib/cardioUnits";

export interface AiExercise {
  type?: string | null;
  name: string;
  sets?: Array<{ reps?: number | string | null; kg?: number | string | null }> | null;
  hold_seconds?: number | null;
  duration_min?: number | null;
  distance_km?: number | null;
  speed_kmh?: number | null;
  pace_min_per_km?: string | number | null;
  watt?: number | null;
  pulse?: number | null;
  elevation_gain_m?: number | null;
  /** AI:n kan använda andra fältnamn – de plockas upp dynamiskt. */
  [key: string]: unknown;
}

/** Plockar första ifyllda värdet bland flera möjliga fältnamn. */
const pick = (ex: AiExercise, keys: string[]): unknown => {
  for (const k of keys) {
    const v = (ex as Record<string, unknown>)[k];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return null;
};

/** Tolkar tid i format 40.5, "40:31", "1:02:15", "40 min 31 s", "2430" (sek). */
const parseDurationMin = (ex: AiExercise): number | null => {
  const direct = pick(ex, ["duration_min", "durationMin", "time_min", "minutes", "duration_minutes"]);
  if (typeof direct === "number" && direct > 0) return direct;
  const sec = pick(ex, ["duration_sec", "duration_seconds", "seconds", "moving_time_seconds", "elapsed_time_seconds"]);
  if (sec !== null) {
    const n = typeof sec === "number" ? sec : parseNum(String(sec));
    if (Number.isFinite(n) && n > 0) return n / 60;
  }
  const raw = direct ?? pick(ex, ["duration", "time", "duration_hms", "elapsed_time", "moving_time"]);
  if (raw === null) return null;
  const t = String(raw).trim().toLowerCase();
  const colon = t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    const a = parseInt(colon[1]), b = parseInt(colon[2]), c = colon[3] ? parseInt(colon[3]) : null;
    return c !== null ? a * 60 + b + c / 60 : a + b / 60;
  }
  const h = t.match(/(\d+(?:[.,]\d+)?)\s*(?:h|tim|timmar)/);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m|min|minuter)(?![a-zåäö])/);
  const s = t.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sek|sekunder)(?![a-zåäö])/);
  if (h || m || s) {
    const f = (x: RegExpMatchArray | null) => (x ? parseFloat(x[1].replace(",", ".")) : 0);
    return f(h) * 60 + f(m) + f(s) / 60;
  }
  const plain = parseFloat(t.replace(",", "."));
  return Number.isFinite(plain) && plain > 0 ? plain : null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

const fmtPace = (minPerUnit: number) => {
  const m = Math.floor(minPerUnit);
  const s = Math.round((minPerUnit - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const parsePace = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  const mm = t.match(/^(\d+)[:.](\d{1,2})$/);
  if (mm) return parseInt(mm[1]) + parseInt(mm[2]) / 60;
  return num(t);
};

/** Vilken tempoenhet användaren har vald för sporten (annars sportens standard). */
const resolveMode = (name: string): CardioMode => {
  const modes = getCardioModes(name);
  try {
    const key = `grim_tempo_mode__${(name || "default").toLowerCase().replace(/\s+/g, "_")}`;
    const stored = localStorage.getItem(key) as CardioMode | null;
    if (stored && modes.includes(stored)) return stored;
  } catch {
    /* ignorera */
  }
  return modes[0];
};

const fmtMinutes = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  const s = Math.round((min % 1) * 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} tim`);
  if (m > 0) parts.push(`${m} min`);
  if (h === 0 && s > 0) parts.push(`${s}s`);
  return parts.join(" ") || `${round(min, 1)} min`;
};

export interface BuiltWorkout {
  details: string;
  loggedWeights: Record<string, string>;
}

export function buildWorkoutFromAiExercises(exercises: AiExercise[]): BuiltWorkout {
  const lines: string[] = [];
  const weights: Record<string, string> = {};

  for (const ex of exercises) {
    const name = (ex.name || "").trim();
    if (!name) continue;
    const isCardio = (ex.type || "").toLowerCase() === "cardio";

    if (!isCardio) {
      const rawSets = Array.isArray(ex.sets) ? ex.sets : [];
      const hold = num(pick(ex, ["hold_seconds", "seconds", "duration_sec"]));
      const setData = rawSets.map((s) => ({
        kg: num(s?.kg) !== null ? String(round(num(s?.kg)!, 2)) : "",
        reps: num(s?.reps) !== null ? String(Math.round(num(s?.reps)!)) : hold ? String(Math.round(hold)) : "",
      }));
      const setCount = setData.length || 1;
      const repsLabel = hold
        ? `${Math.round(hold)}s`
        : String(setData.find((s) => s.reps)?.reps || "10");
      const kgValues = setData.map((s) => parseNum(s.kg)).filter((n) => Number.isFinite(n));
      const kgLabel = kgValues.length ? ` @ ${round(Math.max(...kgValues), 2)} kg` : "";
      lines.push(`${name} ${setCount}×${repsLabel}${kgLabel}`);
      if (setData.length > 0) {
        weights[`__setdata__${name}`] = JSON.stringify(setData);
        // Importerade set är redan genomförda – markera dem som avprickade så att
        // pass-summeringen (och därmed inlägget i social) räknar med dem.
        weights[`__sets__${name}`] = "1".repeat(setData.length);
      }
      continue;
    }

    // Kondition
    const mode = resolveMode(name);
    const distUnit = getCardioDistUnit(name);
    const minutes = parseDurationMin(ex);
    let km = num(pick(ex, ["distance_km", "distanceKm", "distance"]));
    const meters = num(pick(ex, ["distance_m", "distance_meters"]));
    if (!km && meters) km = meters / 1000;
    let kmh = num(pick(ex, ["speed_kmh", "speed", "avg_speed_kmh", "average_speed_kmh"]));
    let paceMinPerKm = parsePace((pick(ex, ["pace_min_per_km", "pace", "pace_per_km"]) as string | number | null) ?? null);
    const watt = num(pick(ex, ["watt", "watts", "power", "power_w", "avg_power"]));
    const pulse = num(pick(ex, ["pulse", "heart_rate", "avg_heart_rate", "average_heartrate", "hr", "bpm"]));
    const elevation = num(pick(ex, ["elevation_gain_m", "elevation", "elevation_m", "ascent_m", "hojdmeter", "height_gain_m"]));
    if (!kmh && paceMinPerKm) kmh = 60 / paceMinPerKm;
    if (!kmh && km && minutes) kmh = km / (minutes / 60);
    if (!paceMinPerKm && kmh) paceMinPerKm = 60 / kmh;

    let tempo = "";
    if (mode === "minkm" && paceMinPerKm) tempo = fmtPace(paceMinPerKm);
    else if (mode === "kmh" && kmh) tempo = String(round(kmh, 1));
    else if (mode === "min100m" && paceMinPerKm) tempo = fmtPace(paceMinPerKm * 0.1);
    else if (mode === "min500m" && paceMinPerKm) tempo = fmtPace(paceMinPerKm * 0.5);
    else if (mode === "watt" && watt) tempo = String(Math.round(watt));

    const distValue = km !== null ? (distUnit === "m" ? Math.round(km * 1000) : round(km, 2)) : null;
    const payload: Record<string, string> = {};
    if (minutes) payload.time = String(round(minutes, 2));
    if (distValue !== null && distUnit !== null) payload.dist = String(distValue);
    if (tempo) payload.tempo = tempo;
    if (pulse) payload.pulse = String(Math.round(pulse));
    if (elevation && showCardioElevation(name)) payload.elev = String(Math.round(elevation));

    if (Object.keys(payload).length > 0) {
      weights[`__cond__${name}`] = JSON.stringify(payload);
      weights[`__cond_done__${name}`] = "1";
    }

    const info: string[] = [];
    if (minutes) info.push(fmtMinutes(minutes));
    if (tempo) {
      if (mode === "kmh") info.push(`${tempo} km/h`);
      else if (mode === "watt") info.push(`${tempo} W`);
      else if (mode === "min100m") info.push(`${tempo}/100m`);
      else if (mode === "min500m") info.push(`${tempo}/500m`);
      else info.push(`${tempo}/km`);
    }
    if (distValue !== null && distUnit !== null) info.push(`${distValue} ${distUnit}`);
    if (elevation && showCardioElevation(name)) info.push(`${Math.round(elevation)} m stigning`);
    if (pulse) info.push(`${Math.round(pulse)} bpm`);
    lines.push(info.length > 0 ? `${name} — ${info.join(", ")}` : name);
  }

  return { details: lines.join("\n"), loggedWeights: weights };
}
