/**
 * Importerar genomförda pass från Apple Health / Health Connect (t.ex. Samsung Health)
 * som riktiga, klarmarkerade pass i Grim.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildWorkoutFromAiExercises } from "@/lib/aiWorkoutImport";
import { healthLog, withTimeout, type HealthWorkout } from "@/lib/healthSync";
import { DAYS, daysBetweenCalendarDates, getMonday, parseDateKey, toLocalDateKey } from "@/lib/workoutDayUtils";
import { notifyWorkoutsChanged } from "@/lib/workoutHistory";

/** Ingen nätverksförfrågan får hänga och låsa knappen i laddningsläge. */
const DB_TIMEOUT_MS = 15000;

/** Lokalt datum (yyyy-MM-dd) då passet startade – inte UTC-datumet i ISO-strängen. */
export const healthWorkoutLocalDate = (w: Pick<HealthWorkout, "start">): string => {
  const d = new Date(w.start);
  return Number.isNaN(d.getTime()) ? w.start.slice(0, 10) : toLocalDateKey(d);
};

/** Kanonisk nyckel för fristående pass (vecka 0) – används även som id i UI:t. */
export const healthWorkoutDayKey = (w: HealthWorkout) =>
  `${healthWorkoutLocalDate(w)}_hc${w.key}`;

export type PlanContext = { planStartDate: string; maxWeek: number } | null;

/**
 * Var passet ska hamna. Följer användaren ett program (vecka > 0) visar
 * träningsfliken bara programmets veckor – då måste passet läggas som ett extra
 * pass på rätt programdag (samma format som "Lägg till pass" på en dag), annars
 * syns det aldrig i dagens träningskort.
 */
export function healthWorkoutTarget(
  w: HealthWorkout,
  plan: PlanContext,
): { week: number; day: string } {
  if (plan) {
    const start = parseDateKey(plan.planStartDate);
    const target = parseDateKey(healthWorkoutLocalDate(w));
    if (start && target) {
      const diff = daysBetweenCalendarDates(getMonday(start), target);
      const week = Math.floor(diff / 7) + 1;
      if (diff >= 0 && week >= 1 && week <= plan.maxWeek) {
        const dayName = DAYS[(target.getUTCDay() + 6) % 7];
        return { week, day: `${dayName}_hc${w.key}` };
      }
    }
  }
  return { week: 0, day: healthWorkoutDayKey(w) };
}

async function loadPlanContext(userId: string): Promise<PlanContext> {
  try {
    const [{ data: profile }, { data: weeks }] = await withTimeout(
      Promise.all([
        Promise.resolve(supabase.from("profiles").select("plan_start_date").eq("user_id", userId).maybeSingle()),
        Promise.resolve(
          supabase.from("workout_plans").select("week").eq("user_id", userId).gt("week", 0)
            .order("week", { ascending: false }).limit(1),
        ),
      ]),
      DB_TIMEOUT_MS,
      "Ingen kontakt med servern – försök igen.",
    );
    const planStartDate = (profile as any)?.plan_start_date as string | null | undefined;
    const maxWeek = Number((weeks as any)?.[0]?.week ?? 0);
    return planStartDate && maxWeek > 0 ? { planStartDate, maxWeek } : null;
  } catch (err: any) {
    healthLog("plan context failed", err?.message);
    return null;
  }
}

/** Vilka pass som redan finns i Grim (för att slippa dubbletter). */
export async function findImportedHealthWorkouts(
  userId: string,
  workouts: HealthWorkout[],
): Promise<Set<string>> {
  if (workouts.length === 0) return new Set();
  healthLog("looking up imported workouts", workouts.length);
  // Pass kan ligga i vecka 0 (fristående) eller i en programvecka – leta på suffixet.
  const { data } = await withTimeout(
    Promise.resolve(
      supabase
        .from("workout_plans")
        .select("day")
        .eq("user_id", userId)
        .like("day", "%\\_hc%"),
    ),
    DB_TIMEOUT_MS,
    "Ingen kontakt med servern – försök igen.",
  );
  const suffixes = new Set(
    (data ?? []).map((row) => String((row as any).day).replace(/^.*_hc/, "")),
  );
  return new Set(workouts.filter((w) => suffixes.has(w.key)).map(healthWorkoutDayKey));
}

export const HC_META_KEY = "__hc_meta__";

export function healthWorkoutMeta(w: HealthWorkout): string | null {
  const m: Record<string, string | number> = {};
  if (w.calories) m.kcal = w.calories;
  if (w.maxHeartRate) m.maxPulse = w.maxHeartRate;
  if (w.steps) m.steps = w.steps;
  if (w.source) m.source = w.source;
  return Object.keys(m).length ? JSON.stringify(m) : null;
}

/** Rader som äldre importer felaktigt lade i details (renderades som styrkeövningar). */
const LEGACY_EXTRA_LINE = /^(Aktiva kalorier|Maxpuls|Steg|Källa):/i;
export const stripLegacyHealthLines = (details: string): string =>
  details.split("\n").filter((l) => !LEGACY_EXTRA_LINE.test(l.trim())).join("\n");

/** Städa redan importerade pass så att de ser ut som manuellt registrerade (idempotent). */
export async function cleanupHealthImportDetails(userId: string): Promise<number> {
  let fixed = 0;
  try {
    const { data } = await withTimeout(
      Promise.resolve(supabase.from("workout_plans").select("week,day,details").eq("user_id", userId).like("day", "%\\_hc%")),
      DB_TIMEOUT_MS,
      "Ingen kontakt med servern – försök igen.",
    );
    for (const r of (data ?? []) as any[]) {
      const details = String(r.details ?? "");
      const clean = stripLegacyHealthLines(details);
      if (clean === details) continue;
      const { error } = await supabase.from("workout_plans").update({ details: clean } as never)
        .eq("user_id", userId).eq("week", r.week).eq("day", r.day);
      if (!error) fixed += 1;
    }
  } catch (err: any) {
    healthLog("cleanup failed", err?.message);
  }
  if (fixed > 0) notifyWorkoutsChanged(userId);
  return fixed;
}

export type ImportResult = { imported: number; skipped: number; failed: number };

export async function importHealthWorkouts(
  userId: string,
  workouts: HealthWorkout[],
): Promise<ImportResult> {
  const existing = await findImportedHealthWorkouts(userId, workouts);
  const plan = await loadPlanContext(userId);
  const seen = new Set(existing);
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const w of workouts) {
    const key = healthWorkoutDayKey(w);
    const { week, day } = healthWorkoutTarget(w, plan);
    // seen fångar även dubbletter inom samma anrop (t.ex. dubbelklick på importera).
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    const { details, loggedWeights } = buildWorkoutFromAiExercises([
      {
        type: "cardio",
        name: w.label,
        duration_min: w.minutes || null,
        distance_km: w.distanceKm,
        pulse: w.avgHeartRate,
      },
    ]);

    // Samma format som manuell registrering av t.ex. Promenad/Löpning: en enda
    // konditionsövning. Övriga värden sparas som dold metadata – aldrig som egna
    // rader i details (varje rad tolkas annars som en styrkeövning).
    const meta = healthWorkoutMeta(w);
    if (meta) loggedWeights[HC_META_KEY] = meta;

    try {
      const { error: planError } = await withTimeout(
        Promise.resolve(
          supabase.from("workout_plans").insert({
            user_id: userId,
            week,
            day,
            session_name: w.label,
            details,
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
              week,
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

  if (imported > 0) notifyWorkoutsChanged(userId);
  return { imported, skipped, failed };
}


/**
 * Pass som importerades innan programdags-mappningen fanns ligger i vecka 0 och
 * syns inte i programvyn. Flytta dem till rätt programdag (engångsfix, idempotent).
 */
export async function relocateHealthImports(userId: string, workouts: HealthWorkout[]): Promise<number> {
  if (workouts.length === 0) return 0;
  const plan = await loadPlanContext(userId);
  if (!plan) return 0;
  let moved = 0;
  try {
    const { data } = await withTimeout(
      Promise.resolve(
        supabase.from("workout_plans").select("day").eq("user_id", userId).eq("week", 0).like("day", "%\\_hc%"),
      ),
      DB_TIMEOUT_MS,
      "Ingen kontakt med servern – försök igen.",
    );
    const oldDays = new Map((data ?? []).map((r: any) => [String(r.day).replace(/^.*_hc/, ""), String(r.day)]));
    for (const w of workouts) {
      const oldDay = oldDays.get(w.key);
      if (!oldDay) continue;
      const target = healthWorkoutTarget(w, plan);
      if (target.week === 0) continue;
      const { error } = await supabase.from("workout_plans").update({ week: target.week, day: target.day } as never)
        .eq("user_id", userId).eq("week", 0).eq("day", oldDay);
      if (error) { healthLog("relocate failed", error.message); continue; }
      await supabase.from("workout_completions").update({ week: target.week, day: target.day } as never)
        .eq("user_id", userId).eq("week", 0).eq("day", oldDay);
      moved += 1;
    }
  } catch (err: any) {
    healthLog("relocate failed", err?.message);
  }
  if (moved > 0) notifyWorkoutsChanged(userId);
  return moved;
}
