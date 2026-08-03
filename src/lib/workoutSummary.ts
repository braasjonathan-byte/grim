import { isPrWeight, type PrIndex } from "@/lib/prBadges";

export interface WorkoutSummary {
  sets: number;
  volumeKg: number;
  exercises: string[];
  prExercises: string[];
}

const cleanName = (n: string) => n.replace(/( —)+$/, "").trim();

/**
 * Summarise a single completion's `logged_weights` blob into set count,
 * total volume, exercise list and which exercises hit a personal record.
 */
export function summarizeCompletion(loggedWeights: unknown, prIndex?: PrIndex): WorkoutSummary {
  const empty: WorkoutSummary = { sets: 0, volumeKg: 0, exercises: [], prExercises: [] };
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

  return {
    sets,
    volumeKg: Math.round(volumeKg),
    exercises: [...exercises],
    prExercises: [...prExercises],
  };
}

export function formatVolumeKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace(".", ",")} ton`;
  return `${kg} kg`;
}
