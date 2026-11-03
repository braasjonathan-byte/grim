/** Vilotid för en övning: per-övning-inställning > global > 90 s. 0 = av. */
export function getRestSecondsFor(exercise: string | undefined, storage: Pick<Storage, "getItem"> = localStorage): number {
  if (storage.getItem("grim_set_rest_timer_enabled") === "false") return 0;
  let perExercise: string | number | undefined;
  if (exercise) {
    try { perExercise = JSON.parse(storage.getItem("grim_rest_seconds_by_exercise") || "{}")[exercise.toLowerCase()]; } catch { /* ignore */ }
  }
  const raw = perExercise || storage.getItem("grim_set_rest_timer_seconds") || "90";
  const n = Math.round(Number(raw) || 0);
  return n > 0 ? n : 0;
}
