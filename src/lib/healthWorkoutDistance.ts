import { validateNumber } from "@/lib/inputValidation";

/** Fill a missing distance only; preserve manually edited cardio values and all other data. */
export function missingHealthDistancePatch(
  completion: { logged_distance_km?: unknown; logged_weights?: unknown },
  distanceKm: number | null,
): { logged_distance_km: number; logged_weights: Record<string, unknown> } | null {
  const km = validateNumber(distanceKm, "cardioDistanceKm").value;
  if (km == null || km <= 0 || Number(completion.logged_distance_km) > 0) return null;
  if (!completion.logged_weights || typeof completion.logged_weights !== "object") return null;
  const weights = { ...completion.logged_weights } as Record<string, unknown>;
  const keys = Object.keys(weights).filter(k => k.startsWith("__cond__"));
  // A Health import originally has exactly one cardio row; don't guess after edits.
  if (keys.length !== 1) return null;
  const key = keys[0];
  try {
    const cardio = JSON.parse(String(weights[key]));
    if (!cardio || typeof cardio !== "object" || Number(cardio.dist) > 0) return null;
    weights[key] = JSON.stringify({ ...cardio, dist: String(km) });
    return { logged_distance_km: km, logged_weights: weights };
  } catch { return null; }
}