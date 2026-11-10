import { supabase } from "@/integrations/supabase/client";
import { estimateCalories } from "@/lib/workoutCalories";
import { getPlanDayDateValue, toUtcDateKey } from "@/lib/workoutDayUtils";
import { isCompletedWorkout } from "@/lib/completionCounting";

export const DEFAULT_BURN_WEIGHT_KG = 75;

/** Uppskattad förbränning för ETT genomfört pass. Samma beräkning i Träning och Kost (åtgärd 9). */
export function estimateCompletionKcal(
  det: string,
  c: { logged_weights?: unknown; logged_pulse?: number | null; logged_distance_km?: number | string | null } | null | undefined,
  weight: number,
  gender: string | null,
  age: number | null,
): number {
  let kcal = estimateCalories(det, (c?.logged_weights ?? null) as any, c?.logged_pulse ?? null, weight, gender, age);
  const km = Number(c?.logged_distance_km) || 0;
  if (kcal <= 0 && km > 0) {
    // Reservberäkning från distans: löpning ≈ 1 kcal/kg/km, cykling ≈ 0,3, simning ≈ 2,5.
    const f = /cykl|cykel|bike/i.test(det) ? 0.3 : /sim|swim/i.test(det) ? 2.5 : /promenad|gång|walk/i.test(det) ? 0.6 : 1.0;
    kcal = km * weight * f;
  }
  // Cykling med watt: mekaniskt arbete i kJ ≈ förbrända kcal (verkningsgrad ~24 %).
  const w = det.match(/(\d{2,4})\s*W\b/); const mins = det.match(/(\d{1,3})\s*min\b/);
  if (w && mins && /cykl|cykel|bike|watt/i.test(det)) kcal = Math.max(kcal, Number(w[1]) * Number(mins[1]) * 60 / 1000);
  return kcal;
}

/** Summerar uppskattade förbrända kalorier från alla genomförda pass ett visst datum (YYYY-MM-DD). */
export async function loadWorkoutBurned(userId: string, dateKey: string): Promise<number> {
  const r = await loadWorkoutBurnedRange(userId, [dateKey]);
  return r[dateKey]?.kcal ?? 0;
}

/** Förbrända kcal + antal genomförda pass per datum (YYYY-MM-DD) för flera dagar på en gång. */
export async function loadWorkoutBurnedRange(userId: string, dateKeys: string[]): Promise<Record<string, { kcal: number; sessions: number }>> {
  const out: Record<string, { kcal: number; sessions: number }> = {};
  for (const k of dateKeys) out[k] = { kcal: 0, sessions: 0 };
  const [{ data: comps }, { data: plans }, { data: profile }] = await Promise.all([
    supabase.from("workout_completions").select("week, day, done, skipped, logged_weights, logged_pulse, logged_distance_km").eq("user_id", userId).eq("done", true),
    supabase.from("workout_plans").select("week, day, details").eq("user_id", userId),
    supabase.from("profiles").select("plan_start_date, weight_kg, gender, age").eq("user_id", userId).maybeSingle(),
  ]);
  const start = profile?.plan_start_date ?? null;
  const weight = Number(profile?.weight_kg) || DEFAULT_BURN_WEIGHT_KG;
  const details = new Map((plans || []).map((p) => [`${p.week}-${p.day}`, p.details || ""]));
  for (const c of comps || []) {
    if (!isCompletedWorkout(c as any)) continue;
    let key: string | null = null;
    if (c.week === 0 && /^\d{4}-\d{2}-\d{2}/.test(c.day)) key = c.day.slice(0, 10);
    else if (c.week > 0) {
      const d = getPlanDayDateValue(start, c.week, c.day.replace(/_[a-z0-9]+$/i, ""));
      key = d ? toUtcDateKey(d) : null;
    }
    if (!key || !(key in out)) continue;
    const det = details.get(`${c.week}-${c.day}`) || "";
    const kcal = estimateCompletionKcal(det, c as any, weight, profile?.gender ?? null, profile?.age ?? null);
    out[key].kcal += kcal;
    out[key].sessions += 1;
  }
  for (const k of dateKeys) out[k].kcal = Math.round(out[k].kcal);
  return out;
}
