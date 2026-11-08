/**
 * Importerar genomförda pass från Apple Health / Health Connect (t.ex. Samsung Health)
 * som riktiga, klarmarkerade pass i Grim.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildWorkoutFromAiExercises } from "@/lib/aiWorkoutImport";
import { healthLog, withTimeout, type HealthWorkout } from "@/lib/healthSync";
import { DAYS, daysBetweenCalendarDates, getMonday, getPlanDayDateValue, parseDateKey, toLocalDateKey, toUtcDateKey } from "@/lib/workoutDayUtils";
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
  knownPlan?: PlanContext,
): Promise<Set<string>> {
  if (workouts.length === 0) return new Set();
  healthLog("looking up imported workouts", workouts.length);
  // Pass kan ligga i vecka 0 (fristående) eller i en programvecka – leta på suffixet.
  const [{ data, error }, { data: completions, error: completionError }] = await withTimeout(
    Promise.all([Promise.resolve(
      supabase
        .from("workout_plans")
        .select("id,week,day,details")
        .eq("user_id", userId),
    ), Promise.resolve(
      supabase.from("workout_completions").select("week,day,done").eq("user_id", userId),
    )]),
    DB_TIMEOUT_MS,
    "Ingen kontakt med servern – försök igen.",
  );
  if (error || completionError) throw error || completionError;
  const doneKeys = new Set((completions ?? []).filter((c) => c.done).map((c) => `${c.week}-${c.day}`));
  // A plan row alone is not a successful import: completion may have failed.
  const imported = importedKeysFromRows((data ?? []).filter((p) => p.day.includes("_hc") && doneKeys.has(`${p.week}-${p.day}`)), workouts);
  if (imported.size === 0) return imported;
  const plan = knownPlan === undefined ? await loadPlanContext(userId) : knownPlan;
  // A failed replacement remains retryable after app restart / focus refresh too.
  return new Set(workouts.filter((w) => imported.has(healthWorkoutDayKey(w)) &&
    unfinishedPlannedIds(data ?? [], doneKeys, w, plan).length === 0).map(healthWorkoutDayKey));
}

/** Ett import räknas bara om raden fortfarande har en övning kvar i träningskortet. */
export const hasRemainingExercise = (details: unknown): boolean =>
  String(details ?? "").split(/\n|;/).some((l) => l.trim().length > 0);

export function importedKeysFromRows(
  rows: { day: string; details?: string | null }[],
  workouts: HealthWorkout[],
): Set<string> {
  const suffixes = new Set(
    rows.filter((r) => hasRemainingExercise(r.details)).map((r) => String(r.day).replace(/^.*_hc/, "")),
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

export type ImportResult = { imported: number; skipped: number; failed: number; successfulKeys: string[] };

function unfinishedPlannedIds(
  plans: { id: string; week: number; day: string }[], completed: Set<string>, w: HealthWorkout, plan: PlanContext,
): string[] {
  const dateKey = healthWorkoutLocalDate(w);
  return plans.filter((p) => {
    if (p.day.includes("_hc") || completed.has(`${p.week}-${p.day}`)) return false;
    const date = p.week === 0 ? parseDateKey(p.day) : getPlanDayDateValue(plan?.planStartDate ?? null, p.week, p.day);
    return date && toUtcDateKey(date) === dateKey;
  }).map((p) => p.id);
}

/** Only remove unfinished non-HC sessions on the actual local calendar date.
 * Called AFTER both HC writes succeed, including on retries of a completed import.
 */
async function removeUnfinishedPlannedWorkouts(userId: string, w: HealthWorkout, plan: PlanContext) {
  const [{ data: plans, error }, { data: completions, error: completionError }] = await withTimeout(
    Promise.all([
      Promise.resolve(supabase.from("workout_plans").select("id,week,day").eq("user_id", userId)),
      Promise.resolve(supabase.from("workout_completions").select("week,day,done").eq("user_id", userId)),
    ]), DB_TIMEOUT_MS, "Ingen kontakt med servern – försök igen.",
  );
  if (error || completionError) throw error || completionError;
  const completed = new Set((completions ?? []).filter((c) => c.done).map((c) => `${c.week}-${c.day}`));
  const ids = unfinishedPlannedIds(plans ?? [], completed, w, plan);
  if (!ids.length) return;
  const { error: deleteError } = await withTimeout(
    Promise.resolve(supabase.from("workout_plans").delete().eq("user_id", userId).in("id", ids)),
    DB_TIMEOUT_MS, "Ingen kontakt med servern – försök igen.",
  );
  if (deleteError) throw deleteError;
}

export async function importHealthWorkouts(
  userId: string,
  workouts: HealthWorkout[],
): Promise<ImportResult> {
  const plan = await loadPlanContext(userId);
  const existing = await findImportedHealthWorkouts(userId, workouts, plan);
  const seen = new Set<string>();
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const successfulKeys: string[] = [];

  for (const w of workouts) {
    const key = healthWorkoutDayKey(w);
    let { week, day } = healthWorkoutTarget(w, plan);
    // seen fångar även dubbletter inom samma anrop (t.ex. dubbelklick på importera).
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    if (existing.has(key)) {
      try {
        await removeUnfinishedPlannedWorkouts(userId, w, plan);
        successfulKeys.push(key);
        seen.add(key);
        skipped += 1;
      } catch (err: any) {
        healthLog("replacement failed", err?.message);
        failed += 1;
      }
      continue;
    }

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
    // Rikare puls-vy: max/lägsta + nedsamplad kurva sparas med konditionsraden.
    const condKey = `__cond__${w.label}`;
    if (loggedWeights[condKey] && (w.maxHeartRate || w.hrCurve?.length)) {
      try {
        const c = JSON.parse(loggedWeights[condKey]);
        if (w.maxHeartRate) c.pulseMax = String(w.maxHeartRate);
        if (w.minHeartRate) c.pulseMin = String(w.minHeartRate);
        if (w.hrCurve && w.hrCurve.length > 1) c.hr = w.hrCurve;
        loggedWeights[condKey] = JSON.stringify(c);
      } catch { /* behåll originalet */ }
    }
    const meta = healthWorkoutMeta(w);
    if (meta) loggedWeights[HC_META_KEY] = meta;

    try {
      // Retry the existing HC identity even if plan context changed after a
      // partial write. Do not leave a second orphan in week 0 / another week.
      const { data: partialRows, error: lookupError } = await withTimeout(
        Promise.resolve(supabase.from("workout_plans").select("week,day").eq("user_id", userId).like("day", `%\\_hc${w.key}`)),
        DB_TIMEOUT_MS, "Ingen kontakt med servern – försök igen.",
      );
      if (lookupError) throw lookupError;
      const slot = partialRows?.find((p) => p.week === week && p.day === day) ?? partialRows?.[0];
      if (slot) { week = slot.week; day = slot.day; }
      const { error: planError } = await withTimeout(
        Promise.resolve(
          supabase.from("workout_plans").upsert({
            user_id: userId,
            week,
            day,
            session_name: w.label,
            details,
            is_circuit: false,
          } as never, { onConflict: "user_id,week,day" }),
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
      await removeUnfinishedPlannedWorkouts(userId, w, plan);
      imported += 1;
      successfulKeys.push(key);
      seen.add(key);
    } catch (err: any) {
      healthLog("import failed", err?.message);
      failed += 1;
    }
  }

  if (successfulKeys.length > 0 || failed > 0) notifyWorkoutsChanged(userId);
  return { imported, skipped, failed, successfulKeys };
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
