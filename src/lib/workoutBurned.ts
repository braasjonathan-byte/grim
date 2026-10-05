import { supabase } from "@/integrations/supabase/client";
import { estimateCalories } from "@/lib/workoutCalories";
import { getPlanDayDateValue, toUtcDateKey } from "@/lib/workoutDayUtils";
import { isCompletedWorkout } from "@/lib/completionCounting";

/** Summerar uppskattade förbrända kalorier från alla genomförda pass ett visst datum (YYYY-MM-DD). */
export async function loadWorkoutBurned(userId: string, dateKey: string): Promise<number> {
  const [{ data: comps }, { data: plans }, { data: profile }] = await Promise.all([
    supabase.from("workout_completions").select("week, day, done, skipped, logged_weights, logged_pulse").eq("user_id", userId).eq("done", true),
    supabase.from("workout_plans").select("week, day, details").eq("user_id", userId),
    supabase.from("profiles").select("plan_start_date, weight_kg, gender, age").eq("user_id", userId).maybeSingle(),
  ]);
  const start = profile?.plan_start_date ?? null;
  const weight = Number(profile?.weight_kg) || 75;
  const details = new Map((plans || []).map((p) => [`${p.week}-${p.day}`, p.details || ""]));
  let total = 0;
  for (const c of comps || []) {
    if (!isCompletedWorkout(c as any)) continue;
    let key: string | null = null;
    if (c.week === 0 && /^\d{4}-\d{2}-\d{2}/.test(c.day)) key = c.day.slice(0, 10);
    else if (c.week > 0) {
      const d = getPlanDayDateValue(start, c.week, c.day.replace(/_[a-z0-9]+$/i, ""));
      key = d ? toUtcDateKey(d) : null;
    }
    if (key !== dateKey) continue;
    total += estimateCalories(details.get(`${c.week}-${c.day}`) || "", c.logged_weights as any, c.logged_pulse ?? null, weight, profile?.gender ?? null, profile?.age ?? null);
  }
  return Math.round(total);
}
