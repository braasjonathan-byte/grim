/**
 * Omvandlar AI-tolkade övningar från en skärmdump till riktiga övningsrader:
 * en detaljrad per övning + färdigifyllda loggvärden (__setdata__ / __cond__)
 * så att passet registreras som riktiga övningar och inte bara som text.
 */
import { getCardioModes, getCardioDistUnit, type CardioMode } from "@/lib/cardioUnits";

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
}

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
      const hold = num(ex.hold_seconds);
      const setData = rawSets.map((s) => ({
        kg: num(s?.kg) !== null ? String(round(num(s?.kg)!, 2)) : "",
        reps: num(s?.reps) !== null ? String(Math.round(num(s?.reps)!)) : hold ? String(Math.round(hold)) : "",
      }));
      const setCount = setData.length || 1;
      const repsLabel = hold
        ? `${Math.round(hold)}s`
        : String(setData.find((s) => s.reps)?.reps || "10");
      const kgValues = setData.map((s) => parseFloat(s.kg)).filter((n) => Number.isFinite(n));
      const kgLabel = kgValues.length ? ` @ ${round(Math.max(...kgValues), 2)} kg` : "";
      lines.push(`${name} ${setCount}×${repsLabel}${kgLabel}`);
      if (setData.length > 0) {
        weights[`__setdata__${name}`] = JSON.stringify(setData);
      }
      continue;
    }

    // Kondition
    const mode = resolveMode(name);
    const distUnit = getCardioDistUnit(name);
    const minutes = num(ex.duration_min);
    const km = num(ex.distance_km);
    let kmh = num(ex.speed_kmh);
    let paceMinPerKm = parsePace(ex.pace_min_per_km ?? null);
    if (!kmh && paceMinPerKm) kmh = 60 / paceMinPerKm;
    if (!kmh && km && minutes) kmh = km / (minutes / 60);
    if (!paceMinPerKm && kmh) paceMinPerKm = 60 / kmh;

    let tempo = "";
    if (mode === "minkm" && paceMinPerKm) tempo = fmtPace(paceMinPerKm);
    else if (mode === "kmh" && kmh) tempo = String(round(kmh, 1));
    else if (mode === "min100m" && paceMinPerKm) tempo = fmtPace(paceMinPerKm * 0.1);
    else if (mode === "min500m" && paceMinPerKm) tempo = fmtPace(paceMinPerKm * 0.5);
    else if (mode === "watt" && num(ex.watt)) tempo = String(Math.round(num(ex.watt)!));

    const distValue = km !== null ? (distUnit === "m" ? Math.round(km * 1000) : round(km, 2)) : null;
    const payload: Record<string, string> = {};
    if (minutes) payload.time = String(round(minutes, 2));
    if (distValue !== null && distUnit !== null) payload.dist = String(distValue);
    if (tempo) payload.tempo = tempo;
    if (num(ex.pulse)) payload.pulse = String(Math.round(num(ex.pulse)!));

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
    if (num(ex.pulse)) info.push(`${Math.round(num(ex.pulse)!)} bpm`);
    lines.push(info.length > 0 ? `${name} — ${info.join(", ")}` : name);
  }

  return { details: lines.join("\n"), loggedWeights: weights };
}
