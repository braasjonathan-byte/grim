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

/**
 * RPE/RIR-styrt förslag för nästa pass (konservativt, autoreglering):
 * - toppsetets RPE ≤ 7 (RIR ≥ 3)   → +2,5 kg (+1,25 kg ≤ 20 kg), samma reps
 * - RPE 7,5–8,5 (RIR 1,5–2,5)      → samma vikt, +1 rep
 * - RPE 9 (RIR 1)                  → håll vikt och reps
 * - RPE ≥ 9,5 (RIR ≤ 0,5)          → −5 % (avrundat till 2,5 kg), samma reps
 * Kroppsvikt (kg 0): ≤ 8,5 → +1 rep, annars håll.
 * Returnerar null om RPE saknas för förra passets arbetsset.
 */
export function suggestFromRpe(
  last: PSet[],
  rpes: (number | null)[],
): { kg: number; reps: number; label: string; rpe: number } | null {
  const pairs = last
    .map((s, i) => ({ ...s, rpe: rpes[i] ?? null }))
    .filter((s) => s.reps > 0 && s.rpe !== null && (s.rpe as number) >= 5 && (s.rpe as number) <= 10);
  if (!pairs.length) return null;
  const topKg = Math.max(...pairs.map((s) => s.kg));
  const top = pairs.filter((s) => s.kg === topKg);
  const reps = Math.min(...top.map((s) => s.reps));
  const rpe = Math.max(...top.map((s) => s.rpe as number));
  const f = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  if (topKg <= 0) {
    return rpe <= 8.5
      ? { kg: 0, reps: reps + 1, rpe, label: `+1 rep (${reps + 1})` }
      : { kg: 0, reps, rpe, label: `Håll ${reps} reps` };
  }
  if (rpe <= 7) {
    const inc = topKg <= 20 ? 1.25 : 2.5;
    const kg = Math.round((topKg + inc) * 100) / 100;
    return { kg, reps, rpe, label: `+${f(inc)} kg → ${f(kg)} kg × ${reps}` };
  }
  if (rpe <= 8.5) return { kg: topKg, reps: reps + 1, rpe, label: `+1 rep → ${f(topKg)} kg × ${reps + 1}` };
  if (rpe < 9.5) return { kg: topKg, reps, rpe, label: `Håll ${f(topKg)} kg × ${reps}` };
  const kg = Math.max(0, Math.round((topKg * 0.95) / 2.5) * 2.5);
  return { kg, reps, rpe, label: `−5 % → ${f(kg)} kg × ${reps}` };
}
