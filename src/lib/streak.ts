import { toLocalDateKey } from "@/lib/dateUtils";

const DAY_ABBR = ["mån", "tis", "ons", "tors", "fre", "lör", "sön"];

/** "Tors_ab12" -> "tors", "Tor" -> "tors" */
const normalizeDay = (value: string) => {
  const base = value.trim().replace(/_[a-z0-9]+$/i, "").toLowerCase();
  return base === "tor" ? "tors" : base;
};

/**
 * The day a workout was actually performed. Planned workouts are dated from the
 * plan week/day (the log can be saved later), single sessions carry the date in
 * the day key, otherwise we fall back to when it was last saved.
 */
export const completionTrainingDate = (
  row: { week?: number | null; day?: string | null; updated_at?: string | null },
  planStartMonday: Date | null,
): string | null => {
  const day = (row.day || "").trim();
  const week = Number(row.week) || 0;

  // Single ("enskilt") session: day starts with a YYYY-MM-DD key.
  const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(day);
  if (dateMatch) return dateMatch[1];

  if (week > 0 && planStartMonday) {
    const idx = DAY_ABBR.indexOf(normalizeDay(day));
    if (idx >= 0) {
      const d = new Date(planStartMonday);
      d.setDate(d.getDate() + (week - 1) * 7 + idx);
      return toLocalDateKey(d);
    }
  }

  if (row.updated_at) {
    const d = new Date(row.updated_at);
    if (!Number.isNaN(d.getTime())) return toLocalDateKey(d);
  }
  return null;
};

/** Current streak of consecutive days (today or yesterday anchors it). */
export const currentStreakFromDates = (dates: Iterable<string>): number => {
  const set = dates instanceof Set ? (dates as Set<string>) : new Set(dates);
  if (set.size === 0) return 0;
  const cursor = new Date();
  if (!set.has(toLocalDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (set.has(toLocalDateKey(cursor)) && count < 3000) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
};

/** Longest run of consecutive training days ever. */
export const longestStreakFromDates = (dates: Iterable<string>): number => {
  const sorted = Array.from(new Set(dates)).sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const key of sorted) {
    const t = new Date(`${key}T12:00:00`).getTime();
    if (Number.isNaN(t)) continue;
    if (prev !== null && Math.round((t - prev) / 86400000) === 1) run += 1;
    else run = 1;
    prev = t;
    if (run > best) best = run;
  }
  return best;
};
