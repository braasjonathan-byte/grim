/**
 * GRIM_HC_WRITE: speglar genomförda Grim-pass till Health Connect.
 *
 * Synken är en avstämning, inte en händelsekö: varje körning bygger önskat läge
 * från databasen (genomförda pass senaste N dagarna) och jämför med vad som
 * redan skrivits (sparat lokalt). Då täcks alla ställen i appen där pass
 * klarmarkeras, redigeras eller tas bort – utan att varje ställe behöver anropa
 * Health Connect själv.
 *
 *  - Nytt pass        → writeWorkout (clientRecordId = grim-<completion.id>)
 *  - Redigerat pass   → writeWorkout med samma id och högre version (ersätter)
 *  - Borttaget pass   → deleteWorkouts med clientRecordId
 *  - Importerat pass  → hoppas över (Health Connect/Strava – annars loop/dubblett)
 *  - Pass som överlappar ett pass från klocka/annan app → hoppas över (dubblett)
 */
import { supabase } from "@/integrations/supabase/client";
import { estimateCalories } from "@/lib/workoutCalories";
import { isCompletedWorkout } from "@/lib/completionCounting";
import {
  checkHealthWriteAccess,
  classifyNativeHealthError,
  deleteWorkoutsFromHealth,
  enqueuePendingHealthWrites,
  healthLog,
  isHealthWriteSupported,
  readHealthWorkouts,
  withTimeout,
  writeWorkoutToHealth,
  type HealthWorkout,
  type HealthWriteInput,
} from "@/lib/healthSync";

export const WRITE_WINDOW_DAYS = 30;
const DEFAULT_MINUTES = 45;
const MAX_MINUTES = 6 * 60;
const STORE_KEY = "grim_health_written_v1";
const ENABLED_KEY = "grim_health_write_enabled";

export type CompletionRow = {
  id: string;
  week: number;
  day: string;
  done: boolean;
  skipped?: boolean | null;
  updated_at: string;
  logged_weights: Record<string, unknown> | null;
  logged_distance_km: number | null;
  logged_pulse: number | null;
  logged_tempo?: string | null;
  user_comment?: string | null;
};
export type PlanRow = { week: number; day: string; details: string | null; session_name?: string | null };
export type ProfileRow = { weight_kg: number | null; gender: string | null; age: number | null };

/** Vad som skrivits: id → version + tider (tiderna hålls stabila vid redigering). */
export type WrittenEntry = { version: number; start: string; end: string };
export type WrittenStore = Record<string, WrittenEntry>;

/* ---------------- Rena hjälpfunktioner (testade) ---------------- */

/** Pass som kommer utifrån får inte skrivas tillbaka. */
export function isExternalImport(c: Pick<CompletionRow, "day" | "logged_weights">): boolean {
  if (/_hc[a-z0-9]+$/i.test(c.day) || /_strava_/i.test(c.day)) return true;
  const lw = c.logged_weights;
  if (lw && typeof lw === "object") {
    for (const k of Object.keys(lw)) if (k.startsWith("__strava")) return true;
  }
  return false;
}

const TYPE_RULES: Array<[RegExp, string]> = [
  [/löpband|treadmill/i, "treadmill"],
  [/löp|jogg|spring|\brun/i, "running"],
  [/spinning|indoor.?cykel|motionscykel|stationary/i, "biking_stationary"],
  [/cykl|cykel|bike|cycling/i, "biking"],
  [/öppet vatten|open water/i, "swimming_open_water"],
  [/sim|swim/i, "swimming"],
  [/vandr|hike|hiking/i, "hiking"],
  [/promenad|(?<![-\w])gång(?![-\w])|walk/i, "walking"],
  [/rodd|row/i, "rowing"],
  [/crosstrainer|elliptic/i, "elliptical"],
  [/trapp|stair/i, "stairs"],
  [/yoga/i, "yoga"],
  [/hiit|intervall|tabata|wod|crossfit/i, "hiit"],
  [/skid|ski/i, "skiing"],
  [/calisthenics|kroppsvikt/i, "calisthenics"],
  [/styrka|strength|gym|knäböj|bänkpress|marklyft|squat|bench|deadlift|sets?\b|\d+\s*x\s*\d+/i, "strength"],
];

/** Grims passtyp → nyckel som Kotlin översätter till ExerciseSessionRecord.EXERCISE_TYPE_*. */
export function grimExerciseType(text: string): string {
  const t = text || "";
  for (const [re, key] of TYPE_RULES) if (re.test(t)) return key;
  return "other";
}

/** Passlängd i minuter från "NN min"-rader i planen, annars null. */
export function minutesFromDetails(details: string): number | null {
  let sum = 0;
  for (const m of (details || "").matchAll(/(\d{1,3})\s*min\b/gi)) sum += Number(m[1]);
  return sum > 0 ? Math.min(sum, MAX_MINUTES) : null;
}

export const clientRecordIdFor = (completionId: string) => `grim-${completionId}`;

export function buildHealthExport(
  c: CompletionRow,
  plan: PlanRow | undefined,
  profile: ProfileRow | null,
  previous?: WrittenEntry,
): HealthWriteInput | null {
  if (!isCompletedWorkout(c as never) || isExternalImport(c)) return null;
  const end = new Date(c.updated_at);
  if (!Number.isFinite(end.getTime())) return null;
  const details = plan?.details || "";
  const lw = (c.logged_weights || {}) as Record<string, unknown>;

  let startIso: string;
  let endIso: string;
  const firstSet = typeof lw.__first_set_at__ === "string" ? new Date(lw.__first_set_at__) : null;
  if (previous) {
    // Behåll tiderna från första skrivningen – redigering ska inte flytta passet.
    startIso = previous.start;
    endIso = previous.end;
  } else if (firstSet && Number.isFinite(firstSet.getTime()) && firstSet < end && end.getTime() - firstSet.getTime() <= MAX_MINUTES * 60000) {
    startIso = firstSet.toISOString();
    endIso = end.toISOString();
  } else {
    const minutes = minutesFromDetails(details) ?? DEFAULT_MINUTES;
    startIso = new Date(end.getTime() - minutes * 60000).toISOString();
    endIso = end.toISOString();
  }

  const weight = Number(profile?.weight_kg) || 75;
  let kcal = estimateCalories(details, lw as never, c.logged_pulse ?? null, weight, profile?.gender ?? null, profile?.age ?? null);
  const km = Number(c.logged_distance_km) || 0;
  if (kcal <= 0 && km > 0) {
    const f = /cykl|cykel|bike/i.test(details) ? 0.3 : /sim|swim/i.test(details) ? 2.5 : /promenad|gång|walk/i.test(details) ? 0.6 : 1.0;
    kcal = km * weight * f;
  }

  const title = (plan?.session_name || details.split(/[;\n]/)[0] || "Grim-pass").trim().slice(0, 100);
  return {
    clientRecordId: clientRecordIdFor(c.id),
    version: Math.max(1, end.getTime()),
    startTime: startIso,
    endTime: endIso,
    exerciseType: grimExerciseType(`${plan?.session_name ?? ""} ${details}`),
    title,
    notes: (c.user_comment || "").slice(0, 1000) || undefined,
    calories: kcal > 0 ? Math.round(kcal) : null,
    distanceMeters: km > 0 ? Math.round(km * 1000) : null,
  };
}

/** Överlappar passet (≥50 % av det kortaste) ett pass från klocka/annan app? */
export function overlapsForeignWorkout(input: Pick<HealthWriteInput, "startTime" | "endTime">, foreign: Pick<HealthWorkout, "start" | "end">[]): boolean {
  const aS = Date.parse(input.startTime);
  const aE = Date.parse(input.endTime);
  return foreign.some((w) => {
    const bS = Date.parse(w.start);
    const bE = Date.parse(w.end);
    const overlap = Math.min(aE, bE) - Math.max(aS, bS);
    const shortest = Math.min(aE - aS, bE - bS);
    return shortest > 0 && overlap / shortest >= 0.5;
  });
}

/** Vad som ska skrivas och tas bort jämfört med förra körningen. */
export function planHealthWrites(desired: HealthWriteInput[], written: WrittenStore, windowStartMs: number) {
  const upserts = desired.filter((d) => (written[d.clientRecordId]?.version ?? -1) < d.version);
  const wanted = new Set(desired.map((d) => d.clientRecordId));
  const deletes = Object.entries(written)
    .filter(([id, e]) => !wanted.has(id) && Date.parse(e.end) >= windowStartMs)
    .map(([id]) => id);
  return { upserts, deletes };
}

/* ---------------- Lagring ---------------- */

export function loadWritten(): WrittenStore {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") as WrittenStore;
  } catch {
    return {};
  }
}
function saveWritten(store: WrittenStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}
export function isHealthWriteEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}
export function setHealthWriteEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/* ---------------- Själva synken ---------------- */

export type HealthWriteResult = { written: number; deleted: number; skippedOverlap: number; failed: number; queued?: number; reason?: string };
let running: Promise<HealthWriteResult> | null = null;

export function syncGrimWorkoutsToHealth(userId: string): Promise<HealthWriteResult> {
  // Flera triggers (start, resume, manuell) kan krocka – kör aldrig parallellt.
  if (!running) running = doSync(userId).finally(() => (running = null));
  return running;
}

async function doSync(userId: string): Promise<HealthWriteResult> {
  const none = (reason: string): HealthWriteResult => ({ written: 0, deleted: 0, skippedOverlap: 0, failed: 0, reason });
  if (!isHealthWriteEnabled()) return none("disabled");
  if (!(await isHealthWriteSupported())) return none("unsupported");
  const access = await checkHealthWriteAccess();
  if (!access.workouts) return none("no-permission");

  const windowStart = new Date(Date.now() - WRITE_WINDOW_DAYS * 86400000);
  const [{ data: comps, error: compErr }, { data: plans }, { data: profile }] = await withTimeout(
    Promise.all([
      supabase
        .from("workout_completions")
        .select("id, week, day, done, skipped, updated_at, logged_weights, logged_distance_km, logged_pulse, logged_tempo, user_comment")
        .eq("user_id", userId)
        .eq("done", true)
        .gte("updated_at", windowStart.toISOString()),
      supabase.from("workout_plans").select("week, day, details, session_name").eq("user_id", userId),
      supabase.from("profiles").select("weight_kg, gender, age").eq("user_id", userId).maybeSingle(),
    ]),
    15000,
    "Kunde inte läsa passen från Grim.",
  );
  // Utan pass från databasen vet vi inte vad som tagits bort – avbryt hellre än att radera.
  if (compErr) throw compErr;

  const planMap = new Map((plans || []).map((p) => [`${p.week}-${p.day}`, p as PlanRow]));
  const written = loadWritten();
  const desired: HealthWriteInput[] = [];
  for (const c of (comps || []) as unknown as CompletionRow[]) {
    const input = buildHealthExport(c, planMap.get(`${c.week}-${c.day}`), profile as ProfileRow | null, written[clientRecordIdFor(c.id)]);
    if (input) desired.push(input);
  }

  // Dubblettskydd mot klocka/Samsung/Strava som redan skrivit samma pass.
  let foreign: HealthWorkout[] = [];
  try {
    foreign = await readHealthWorkouts(WRITE_WINDOW_DAYS + 1);
  } catch (err) {
    healthLog("write: could not read foreign workouts for dedupe", (err as Error)?.message);
  }
  const notYetWritten = desired.filter((d) => !written[d.clientRecordId]);
  const overlapping = new Set(notYetWritten.filter((d) => overlapsForeignWorkout(d, foreign)).map((d) => d.clientRecordId));
  const toWrite = desired.filter((d) => !overlapping.has(d.clientRecordId));

  const { upserts, deletes } = planHealthWrites(toWrite, written, windowStart.getTime());
  const result: HealthWriteResult = { written: 0, deleted: 0, skippedOverlap: overlapping.size, failed: 0 };
  healthLog("write plan", { upserts: upserts.length, deletes: deletes.length, overlap: overlapping.size });

  for (const u of upserts) {
    try {
      await writeWorkoutToHealth(u);
      written[u.clientRecordId] = { version: u.version, start: u.startTime, end: u.endTime };
      result.written += 1;
    } catch (err) {
      const e = classifyNativeHealthError(err);
      healthLog("write failed", { id: u.clientRecordId, message: e.message });
      result.failed += 1;
      if (e.code === "denied") break;
      // Health Connect svarade inte – låt bakgrundsjobbet försöka igen.
      if (await enqueuePendingHealthWrites([u])) result.queued = (result.queued ?? 0) + 1;
    }
  }
  if (deletes.length) {
    try {
      await deleteWorkoutsFromHealth(deletes);
      for (const id of deletes) delete written[id];
      result.deleted = deletes.length;
    } catch (err) {
      healthLog("delete failed", classifyNativeHealthError(err).message);
      result.failed += deletes.length;
    }
  }
  saveWritten(written);
  return result;
}
