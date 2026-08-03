import { normalizeExerciseName } from "@/lib/exerciseNormalization";

export type PrIndex = Map<string, { best: number; secondBest: number }>;

type AnyCompletion = { logged_weights?: unknown } | null | undefined;

/**
 * Build an index of the best and second-best logged weight per exercise
 * across all of the user's workout completions.
 *
 * A set qualifies as a PR when its weight equals `best` and is strictly
 * greater than every other logged weight for that exercise.
 */
export function buildPrIndex(completions: AnyCompletion[]): PrIndex {
  const weightsByExercise = new Map<string, number[]>();

  const push = (name: string, kg: number) => {
    if (!isFinite(kg) || kg <= 0) return;
    const norm = normalizeExerciseName(name.replace(/( —)+$/, "").trim());
    if (!norm) return;
    const arr = weightsByExercise.get(norm);
    if (arr) arr.push(kg);
    else weightsByExercise.set(norm, [kg]);
  };

  for (const c of completions) {
    const lw = (c as any)?.logged_weights;
    if (!lw || typeof lw !== "object") continue;
    for (const [key, value] of Object.entries(lw as Record<string, unknown>)) {
      if (key.startsWith("__setdata__")) {
        const name = key.substring("__setdata__".length);
        let sets: Array<{ kg?: string | number }> = [];
        if (typeof value === "string") {
          try { sets = JSON.parse(value); } catch { continue; }
        } else if (Array.isArray(value)) {
          sets = value as Array<{ kg?: string | number }>;
        } else continue;
        if (!Array.isArray(sets)) continue;
        for (const s of sets) push(name, Number(s?.kg));
        continue;
      }
      if (key.startsWith("__")) continue;
      // Legacy format: exerciseName -> weight
      if (typeof value === "number") push(key, value);
    }
  }

  const index: PrIndex = new Map();
  for (const [name, list] of weightsByExercise) {
    let best = -Infinity;
    let secondBest = -Infinity;
    for (const w of list) {
      if (w > best) {
        secondBest = best;
        best = w;
      } else if (w > secondBest && w < best) {
        secondBest = w;
      } else if (w === best) {
        secondBest = best;
      }
    }
    index.set(name, {
      best: best === -Infinity ? 0 : best,
      secondBest: secondBest === -Infinity ? 0 : secondBest,
    });
  }
  return index;
}

/** True when this weight is a new all-time best for the exercise. */
export function isPrWeight(index: PrIndex, exerciseName: string, kg: number | string | undefined | null): boolean {
  const w = Number(kg);
  if (!isFinite(w) || w <= 0) return false;
  const entry = index.get(normalizeExerciseName(String(exerciseName).replace(/( —)+$/, "").trim()));
  if (!entry) return false;
  return w >= entry.best && w > entry.secondBest;
}
