import { summarizeCompletion } from "@/lib/workoutSummary";
import { getWorkoutDistanceByCategory, type CardioCategoryKey } from "@/lib/workoutDistance";

export interface PeriodCompletionRow {
  week: number;
  day: string;
  done?: boolean | null;
  updated_at?: string | null;
  logged_distance_km?: number | null;
  logged_weights?: unknown;
}

export interface PeriodStats {
  passCount: number;
  sets: number;
  volumeKg: number;
  minutes: number;
  distanceKm: number;
  byCategory: Partial<Record<CardioCategoryKey, number>>;
  /** Exercise name -> number of sessions it appeared in, sorted desc */
  topExercises: { name: string; count: number }[];
  /** Number of distinct days with at least one logged workout */
  activeDays: number;
  /** Longest run of consecutive days with a workout inside the period */
  bestStreak: number;
  /** Weekday with most sessions (0 = Sunday) or null */
  favoriteWeekday: number | null;
  /** Busiest single day in the period, as an ISO date, or null */
  busiestDate: string | null;
}

const EMPTY: PeriodStats = {
  passCount: 0, sets: 0, volumeKg: 0, minutes: 0, distanceKm: 0,
  byCategory: {}, topExercises: [], activeDays: 0, bestStreak: 0,
  favoriteWeekday: null, busiestDate: null,
};

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (key: string, days: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return dateKey(date);
};

/**
 * Aggregates everything that was logged between two dates (inclusive).
 * The logging timestamp (`updated_at`) is what places a session in a period,
 * which matches how the user experiences "what did I do in September".
 */
export function computePeriodStats(
  rows: PeriodCompletionRow[],
  from: Date,
  to: Date,
  planDetailsByKey: Record<string, string> = {},
): PeriodStats {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();

  const stats: PeriodStats = { ...EMPTY, byCategory: {}, topExercises: [] };
  const exerciseCounts = new Map<string, number>();
  const perDay = new Map<string, number>();
  const weekdayCounts = new Array(7).fill(0);

  for (const row of rows) {
    if (!row.done) continue;
    const ts = row.updated_at ? new Date(row.updated_at).getTime() : NaN;
    if (!isFinite(ts) || ts < start || ts > end) continue;

    const summary = summarizeCompletion(row.logged_weights);
    const hasContent = summary.sets > 0 || !!summary.cardio;
    if (!hasContent && !row.logged_distance_km) continue;

    stats.passCount += 1;
    stats.sets += summary.sets;
    stats.volumeKg += summary.volumeKg;
    stats.minutes += summary.cardio?.minutes ?? 0;

    const planDetails = planDetailsByKey[`${row.week}-${row.day}`] ?? null;
    const byCat = getWorkoutDistanceByCategory({
      loggedDistanceKm: row.logged_distance_km,
      loggedWeights: row.logged_weights as any,
      planDetails,
    });
    for (const [cat, km] of Object.entries(byCat)) {
      if (!km) continue;
      stats.byCategory[cat as CardioCategoryKey] = (stats.byCategory[cat as CardioCategoryKey] ?? 0) + km;
      stats.distanceKm += km;
    }
    if (stats.distanceKm === 0 && row.logged_distance_km) stats.distanceKm += Number(row.logged_distance_km) || 0;

    for (const name of summary.exercises) {
      const clean = name.trim();
      if (!clean) continue;
      exerciseCounts.set(clean, (exerciseCounts.get(clean) ?? 0) + 1);
    }

    const day = new Date(ts);
    const key = dateKey(day);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    weekdayCounts[day.getDay()] += 1;
  }

  stats.topExercises = [...exerciseCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "sv"))
    .slice(0, 5);

  stats.activeDays = perDay.size;

  const days = [...perDay.keys()].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    if (run > best) best = run;
    previous = day;
  }
  stats.bestStreak = best;

  const maxWeekday = Math.max(...weekdayCounts);
  stats.favoriteWeekday = maxWeekday > 0 ? weekdayCounts.indexOf(maxWeekday) : null;

  let busiest: string | null = null;
  let busiestCount = 0;
  for (const [day, count] of perDay) {
    if (count > busiestCount) { busiest = day; busiestCount = count; }
  }
  stats.busiestDate = busiest;

  return stats;
}

/** Total volume expressed as tonnes, the unit used elsewhere in the app. */
export const toTons = (volumeKg: number) => volumeKg / 1000;
