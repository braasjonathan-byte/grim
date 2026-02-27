/** Canonical name aliases – maps common short/alternate names to the official name */
const EXERCISE_ALIASES: Record<string, string> = {
  "mark": "Marklyft",
  "Mark": "Marklyft",
  "böj": "Knäböj",
  "Böj": "Knäböj",
  "lätta böj": "Knäböj",
  "Lätta böj": "Knäböj",
  "Lätta Böj": "Knäböj",
};

/** Normalize an exercise name to its canonical form */
export function normalizeExerciseName(name: string): string {
  const trimmed = name.trim();
  return EXERCISE_ALIASES[trimmed] || trimmed;
}
