import { isCompletedWorkout } from "@/lib/completionCounting";
import { summarizeCompletion } from "@/lib/workoutSummary";
import { getWorkoutDistanceByCategory } from "@/lib/workoutDistance";
import { minutesFromDetails } from "@/lib/healthWriteSync";

export interface HomeCompletion {
  week: number;
  day: string;
  done: boolean | null;
  skipped?: boolean | null;
  updated_at?: string | null;
  logged_distance_km?: number | null;
  logged_weights?: Record<string, unknown> | null;
}

export interface WeekProgress {
  sessions: number;
  minutes: number;
  km: number;
}

const normalizeDay = (value: string) => {
  const base = value.trim().replace(/_[a-z0-9]+$/i, "").toLowerCase();
  return base === "tor" ? "tors" : base;
};

/** Måndag 00:00 UTC för veckan som `now` ligger i (samma veckodefinition som Statistik). */
export const utcWeekStart = (now: Date) => {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.getTime();
};

/**
 * Veckans framsteg på Hem: genomförda pass, träningsminuter och kilometer
 * den här kalenderveckan. Bygger bara på loggad data (och planens «NN min»
 * som reserv för passlängd) – inga påhittade värden.
 */
export function computeWeekProgress(
  completions: HomeCompletion[],
  planDetails: (week: number, day: string) => string | null | undefined,
  now = new Date(),
): WeekProgress {
  const start = utcWeekStart(now);
  const end = start + 7 * 86400000;
  const seen = new Set<string>();
  let minutes = 0;
  let km = 0;
  for (const c of completions) {
    if (!isCompletedWorkout(c as never)) continue;
    const t = c.updated_at ? new Date(c.updated_at).getTime() : NaN;
    if (!(t >= start && t < end)) continue;
    const key = `${c.week}-${normalizeDay(c.day)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const details = planDetails(c.week, c.day) ?? "";
    const summary = summarizeCompletion(c.logged_weights ?? null, undefined, c.updated_at ?? null);
    const m = summary.durationMin ?? (summary.cardio?.minutes || null) ?? minutesFromDetails(details);
    if (m && m > 0) minutes += m;
    const byCat = getWorkoutDistanceByCategory({ loggedDistanceKm: c.logged_distance_km, loggedWeights: (c.logged_weights ?? null) as never, planDetails: details });
    for (const v of Object.values(byCat)) km += v || 0;
  }
  return { sessions: seen.size, minutes: Math.round(minutes), km: Math.round(km * 10) / 10 };
}
