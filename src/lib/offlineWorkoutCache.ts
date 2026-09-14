/**
 * Local snapshot of the training view so the whole page keeps working in a
 * basement gym without coverage. The cache is only used as a fallback when the
 * backend cannot be reached — a successful response always wins.
 */

const KEY_PREFIX = "grim_workout_cache_";
/** Older snapshots are still useful offline; a week is plenty. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface OfflineWorkoutSnapshot {
  plans: any[];
  completions: any[];
  savedAt: number;
}

export function readOfflineWorkoutCache(userId: string): OfflineWorkoutSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineWorkoutSnapshot;
    if (!parsed || !Array.isArray(parsed.plans)) return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOfflineWorkoutCache(userId: string, plans: any[], completions: any[]) {
  try {
    localStorage.setItem(
      KEY_PREFIX + userId,
      JSON.stringify({ plans, completions, savedAt: Date.now() } satisfies OfflineWorkoutSnapshot)
    );
  } catch {
    // Storage full or unavailable — the app still works online.
  }
}

/**
 * Apply a locally saved completion on top of the cached snapshot so a reload
 * while offline shows what the user just logged.
 */
export function patchOfflineWorkoutCache(userId: string, completion: Record<string, any>) {
  const snapshot = readOfflineWorkoutCache(userId);
  if (!snapshot) return;
  const rest = snapshot.completions.filter(
    (c) => !(c.week === completion.week && c.day === completion.day)
  );
  rest.push({ ...completion });
  writeOfflineWorkoutCache(userId, snapshot.plans, rest);
}
