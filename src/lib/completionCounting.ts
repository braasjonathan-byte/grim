/**
 * Single source of truth for deciding whether a workout row should count as a
 * genuinely completed session ("Genomfört").
 *
 * A row only counts when the user has actively marked it done AND there is
 * real evidence of activity: a checked set, a completed/logged conditioning
 * exercise, or logged cardio data. Scheduled-but-untouched days, days that
 * only carry a planned weight, and rows created by the planner never count.
 */

export interface CountableCompletion {
  done?: boolean | null;
  skipped?: boolean | null;
  logged_distance_km?: number | null;
  logged_tempo?: string | null;
  logged_pulse?: number | null;
  logged_weights?: unknown;
}

const hasSetValues = (value: unknown): boolean => {
  let arr: any;
  try {
    arr = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return false;
  }
  if (!Array.isArray(arr)) return false;
  return arr.some(
    (s: any) =>
      s &&
      ((Number(s.reps) || 0) > 0 || (Number(s.kg) || 0) > 0 || (typeof s.time === "string" && s.time.trim() !== "")),
  );
};

const hasCondPayload = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "" && value.trim() !== "{}";
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some((v) => v !== null && v !== undefined && String(v).trim() !== "");
  return false;
};

/** True when the row contains proof that the user actually trained. */
export const hasCompletionEvidence = (c: CountableCompletion): boolean => {
  if (c.logged_distance_km || c.logged_tempo || c.logged_pulse) return true;
  const weights = c.logged_weights as Record<string, unknown> | null | undefined;
  if (!weights || typeof weights !== "object") return false;
  for (const [key, value] of Object.entries(weights)) {
    if (key.startsWith("__sets__")) {
      if (String(value ?? "").includes("1")) return true;
    } else if (key.startsWith("__cond_done__")) {
      if (String(value) === "1") return true;
    } else if (key.startsWith("__cond__")) {
      if (hasCondPayload(value)) return true;
    } else if (key.startsWith("__setdata__")) {
      if (hasSetValues(value)) return true;
    }
  }
  return false;
};

/** True only for sessions the user actively completed. */
export const isCompletedWorkout = (c: CountableCompletion): boolean =>
  Boolean(c?.done) && hasCompletionEvidence(c);
