/**
 * Safety net against accidental loss of logged training data.
 *
 * A "checkmark" is any explicit user confirmation stored in
 * workout_completions: a checked set ("__sets__" bitstring), a completed
 * conditioning exercise ("__cond_done__"), a logged conditioning payload
 * ("__cond__"), per-set data ("__setdata__"), or the workout being done.
 *
 * We keep a per-user/week/day count of the highest number of checkmarks we
 * have ever confirmed as saved. Any write that would reduce this count by
 * more than one (i.e. more than a single deliberate un-check) is treated as
 * suspicious and must be verified against the backend before it is allowed.
 */

export type LoggedWeights = Record<string, unknown> | null | undefined;

export function countCheckmarks(weights: LoggedWeights, done?: boolean): number {
  let count = done ? 1 : 0;
  if (!weights || typeof weights !== "object") return count;
  for (const [key, value] of Object.entries(weights)) {
    if (key.startsWith("__sets__")) {
      count += String(value ?? "").split("").filter((c) => c === "1").length;
    } else if (key.startsWith("__cond_done__")) {
      if (String(value) === "1") count += 1;
    } else if (key.startsWith("__cond__")) {
      count += 1;
    } else if (key.startsWith("__setdata__")) {
      try {
        const arr = JSON.parse(String(value));
        if (Array.isArray(arr)) {
          count += arr.filter((s: any) => s && (s.kg || s.reps || s.time)).length;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return count;
}

const knownCounts = new Map<string, number>();

const mapKey = (userId: string, week: number, day: string) => `${userId}|${week}|${day}`;

/** Record a count we know is persisted in the backend. */
export function rememberCheckmarkCount(userId: string, week: number, day: string, count: number) {
  knownCounts.set(mapKey(userId, week, day), count);
}

export function getKnownCheckmarkCount(userId: string, week: number, day: string): number | undefined {
  return knownCounts.get(mapKey(userId, week, day));
}

/** Seed the guard from a freshly fetched set of completion rows. */
export function seedCheckmarkCounts(userId: string, rows: Array<{ week: number; day: string; done?: boolean | null; logged_weights?: LoggedWeights }>) {
  for (const row of rows) {
    rememberCheckmarkCount(userId, row.week, row.day, countCheckmarks(row.logged_weights, !!row.done));
  }
}

/**
 * A write is destructive when it removes more than one checkmark compared to
 * what we know is already stored. Returns null when the write is safe.
 */
export function detectDestructiveWrite(
  previousCount: number | undefined,
  nextCount: number
): { previousCount: number; nextCount: number } | null {
  if (previousCount === undefined) return null;
  if (nextCount >= previousCount - 1) return null;
  return { previousCount, nextCount };
}

export function logDestructiveWrite(
  context: string,
  userId: string,
  week: number,
  day: string,
  info: { previousCount: number; nextCount: number },
  blocked: boolean
) {
  const entry = {
    at: new Date().toISOString(),
    context,
    userId,
    week,
    day,
    ...info,
    blocked,
  };
  console.warn(`[Grim][data-guard] ${blocked ? "BLOCKED" : "allowed"} shrinking write`, entry);
  try {
    const raw = localStorage.getItem("grim_data_guard_log");
    const log = raw ? (JSON.parse(raw) as unknown[]) : [];
    log.push(entry);
    localStorage.setItem("grim_data_guard_log", JSON.stringify(log.slice(-50)));
  } catch {
    /* ignore */
  }
}
