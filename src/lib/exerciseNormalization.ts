/** Canonical name aliases – maps common short/alternate names to the official name */
const EXERCISE_ALIASES: Record<string, string> = {
  "mark": "Marklyft",
  "böj": "Knäböj",
  "knäböj": "Knäböj",
  "lätta böj": "Knäböj",
  "bänk": "Bänkpress",
  "frontböj": "Frontböj",
  "frontböj/goblet squat": "Frontböj",
};

/** Normalize an exercise name to its canonical form */
export function normalizeExerciseName(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (EXERCISE_ALIASES[lower]) return EXERCISE_ALIASES[lower];
  // Title case the trimmed name as fallback
  return trimmed;
}
