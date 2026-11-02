import { KCAL_PER_KG_FAT } from "./nutritionCalc";

/**
 * Adaptiv TDEE (MacroFactor-inspirerad): faktisk förbrukning skattas från
 * snittintag minus energin i vikttrendens förändring.
 *   TDEE ≈ snittintag − (trendlutning kg/dag × 7700)
 * Dagar med < MIN_DAY_KCAL räknas som ofullständigt loggade och hoppas över.
 */
export const ADAPTIVE_WINDOW_DAYS = 28;
export const MIN_INTAKE_DAYS = 14;
export const MIN_WEIGH_INS = 3;
export const MIN_WEIGHT_SPAN_DAYS = 10;
export const MIN_DAY_KCAL = 800;

export interface WeightPoint { date: string; kg: number }
export interface AdaptiveTdeeResult {
  ok: boolean;
  reason?: string;
  tdee?: number;
  avgIntake?: number;
  kgPerWeek?: number; // negativ = nedgång
  intakeDays: number;
  weighIns: number;
}

const dayNum = (d: string) => Math.round(new Date(d + "T12:00:00").getTime() / 864e5);

export function computeAdaptiveTdee(weights: WeightPoint[], intakeByDay: Record<string, number>): AdaptiveTdeeResult {
  const days = Object.entries(intakeByDay).filter(([, k]) => k >= MIN_DAY_KCAL);
  const w = weights.filter((p) => p.kg > 25 && p.kg < 350).sort((a, b) => a.date.localeCompare(b.date));
  const base = { intakeDays: days.length, weighIns: w.length };
  if (days.length < MIN_INTAKE_DAYS) return { ok: false, reason: `Logga kost minst ${MIN_INTAKE_DAYS} dagar (${days.length} hittills)`, ...base };
  if (w.length < MIN_WEIGH_INS) return { ok: false, reason: `Väg dig minst ${MIN_WEIGH_INS} gånger (${w.length} hittills)`, ...base };
  const xs = w.map((p) => dayNum(p.date));
  const span = xs[xs.length - 1] - xs[0];
  if (span < MIN_WEIGHT_SPAN_DAYS) return { ok: false, reason: `Vägningarna behöver spänna minst ${MIN_WEIGHT_SPAN_DAYS} dagar`, ...base };
  // Linjär regression = robust trend mot dagliga vätskesvängningar.
  const n = w.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = w.reduce((a, p) => a + p.kg, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (w[i].kg - my); den += (xs[i] - mx) ** 2; }
  const slope = den > 0 ? num / den : 0; // kg/dag
  const avgIntake = days.reduce((a, [, k]) => a + k, 0) / days.length;
  const tdee = Math.round(Math.min(5500, Math.max(1100, avgIntake - slope * KCAL_PER_KG_FAT)));
  return { ok: true, tdee, avgIntake: Math.round(avgIntake), kgPerWeek: Math.round(slope * 7 * 100) / 100, ...base };
}

/** Nytt kcal-mål från skattad TDEE och användarens mål. */
export function adaptiveTarget(tdee: number, goalType: string, weeklyLossKg: number | null | undefined): number {
  if (weeklyLossKg) return Math.max(1200, Math.round(tdee - (weeklyLossKg * KCAL_PER_KG_FAT) / 7));
  const mult: Record<string, number> = { lose_fast: 0.8, lose_slow: 0.9, lean_bulk: 1.08, bulk: 1.15, strength: 1.05, power: 1.05 };
  return Math.max(1200, Math.round(tdee * (mult[goalType] ?? 1)));
}

export const ADAPTIVE_APPLIED_KEY = "grim_adaptive_tdee_applied";
