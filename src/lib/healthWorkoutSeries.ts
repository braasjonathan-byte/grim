import { parseWorkoutSeries, seriesRichness, type WorkoutSeries } from "@/lib/workoutSeries";

/**
 * Lägger till (eller uppgraderar) tidsserien på en redan importerad
 * Health Connect-rad. Bara när den nya serien har fler datakanaler än den
 * sparade; alla andra värden lämnas orörda.
 */
export function missingHealthSeriesPatch(
  completion: { logged_weights?: unknown },
  series: WorkoutSeries | null | undefined,
): { logged_weights: Record<string, unknown> } | null {
  if (!series || !completion.logged_weights || typeof completion.logged_weights !== "object") return null;
  const weights = { ...completion.logged_weights } as Record<string, unknown>;
  const keys = Object.keys(weights).filter((k) => k.startsWith("__cond__"));
  // En hälsoimport har exakt en konditionsrad; gissa inte efter manuella ändringar.
  if (keys.length !== 1) return null;
  const key = keys[0];
  try {
    const cardio = JSON.parse(String(weights[key]));
    if (!cardio || typeof cardio !== "object") return null;
    if (seriesRichness(parseWorkoutSeries(cardio.series)) >= seriesRichness(series)) return null;
    weights[key] = JSON.stringify({ ...cardio, series });
    return { logged_weights: weights };
  } catch { return null; }
}
