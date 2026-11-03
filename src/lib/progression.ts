/** Progression & e1RM-hjälpare (Epley). Rena funktioner – testade i progression.test.ts. */
export interface PSet { kg: number; reps: number }

export function e1rm(kg: number, reps: number): number {
  if (!(kg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return kg;
  return Math.round(kg * (1 + Math.min(reps, 12) / 30) * 10) / 10;
}

export function bestE1rm(sets: PSet[]): number {
  return sets.reduce((m, s) => Math.max(m, e1rm(s.kg, s.reps)), 0);
}

/**
 * Nästa-pass-förslag (dubbel progression):
 * - alla set nådde målreps (eller ≥ toppreps i range) → +2,5 kg (≥ 1,25 kg för lätta vikter ≤ 20 kg)
 * - annars → +1 rep på samma vikt
 * - kroppsvikt (kg 0) → +1 rep
 */
export function suggestProgression(last: PSet[], targetReps?: number): { kg: number; reps: number; label: string } | null {
  const work = last.filter((s) => s.reps > 0);
  if (work.length === 0) return null;
  const topKg = Math.max(...work.map((s) => s.kg));
  const top = work.filter((s) => s.kg === topKg);
  const minReps = Math.min(...top.map((s) => s.reps));
  if (topKg <= 0) return { kg: 0, reps: minReps + 1, label: `+1 rep (${minReps + 1})` };
  const target = targetReps && targetReps > 0 ? targetReps : minReps;
  const hitAll = top.every((s) => s.reps >= target) && (!targetReps || minReps >= targetReps);
  if (hitAll && targetReps) {
    const inc = topKg <= 20 ? 1.25 : 2.5;
    const kg = Math.round((topKg + inc) * 100) / 100;
    return { kg, reps: targetReps, label: `+${String(inc).replace(".", ",")} kg (${String(kg).replace(".", ",")} kg)` };
  }
  return { kg: topKg, reps: minReps + 1, label: `+1 rep (${String(topKg).replace(".", ",")} kg × ${minReps + 1})` };
}
