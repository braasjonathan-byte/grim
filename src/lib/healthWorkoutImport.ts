/**
 * Importerar genomförda pass från Apple Health / Health Connect (t.ex. Samsung Health)
 * som riktiga, klarmarkerade pass i Grim.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildWorkoutFromAiExercises } from "@/lib/aiWorkoutImport";
import { healthLog, withTimeout, type HealthWorkout } from "@/lib/healthSync";

/** Ingen nätverksförfrågan får hänga och låsa knappen i laddningsläge. */
const DB_TIMEOUT_MS = 15000;

export const healthWorkoutDayKey = (w: HealthWorkout) =>
  `${w.start.slice(0, 10)}_hc${w.key}`;

/** Vilka pass som redan finns i Grim (för att slippa dubbletter). */
export async function findImportedHealthWorkouts(
  userId: string,
  workouts: HealthWorkout[],
): Promise<Set<string>> {
  if (workouts.length === 0) return new Set();
  const keys = workouts.map(healthWorkoutDayKey);
  healthLog("looking up imported workouts", keys.length);
  const { data } = await withTimeout(
    Promise.resolve(
      supabase
        .from("workout_plans")
        .select("day")
        .eq("user_id", userId)
        .eq("week", 0)
        .in("day", keys),
    ),
    DB_TIMEOUT_MS,
    "Ingen kontakt med servern – försök igen.",
  );
  return new Set((data ?? []).map((row) => row.day as string));
}

export type ImportResult = { imported: number; skipped: number; failed: number };

export async function importHealthWorkouts(
  userId: string,
  workouts: HealthWorkout[],
): Promise<ImportResult> {
  const existing = await findImportedHealthWorkouts(userId, workouts);
  const seen = new Set(existing);
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const w of workouts) {
    const day = healthWorkoutDayKey(w);
    // seen fångar även dubbletter inom samma anrop (t.ex. dubbelklick på importera).
    if (seen.has(day)) {
      skipped += 1;
      continue;
    }
    seen.add(day);

    const { details, loggedWeights } = buildWorkoutFromAiExercises([
      {
        type: "cardio",
        name: w.label,
        duration_min: w.minutes || null,
        distance_km: w.distanceKm,
        pulse: w.avgHeartRate,
      },
    ]);

    const extraLines: string[] = [];
    if (w.calories) extraLines.push(`Aktiva kalorier: ${w.calories} kcal`);
    if (w.maxHeartRate) extraLines.push(`Maxpuls: ${w.maxHeartRate} bpm`);
    if (w.steps) extraLines.push(`Steg: ${w.steps}`);
    extraLines.push(`Källa: ${w.source}`);

    try {
      const { error: planError } = await withTimeout(
        Promise.resolve(
          supabase.from("workout_plans").insert({
            user_id: userId,
            week: 0,
            day,
            session_name: w.label,
            details: [details, ...extraLines].filter(Boolean).join("\n"),
            is_circuit: false,
          } as never),
        ),
        DB_TIMEOUT_MS,
        "Ingen kontakt med servern – försök igen.",
      );
      if (planError) {
        healthLog("plan insert failed", planError.message);
        failed += 1;
        continue;
      }

      const { error: completionError } = await withTimeout(
        Promise.resolve(
          supabase.from("workout_completions").upsert(
            {
              user_id: userId,
              week: 0,
              day,
              done: true,
              skipped: false,
              logged_weights: loggedWeights as never,
              logged_distance_km: w.distanceKm,
              logged_pulse: w.avgHeartRate,
              updated_at: w.end,
            } as never,
            { onConflict: "user_id,week,day" },
          ),
        ),
        DB_TIMEOUT_MS,
        "Ingen kontakt med servern – försök igen.",
      );
      if (completionError) {
        healthLog("completion upsert failed", completionError.message);
        failed += 1;
        continue;
      }
      imported += 1;
    } catch (err: any) {
      healthLog("import failed", err?.message);
      failed += 1;
    }
  }

  return { imported, skipped, failed };
}

