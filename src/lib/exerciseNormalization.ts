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

/**
 * Strip trailing set/rep/weight notation from an exercise name so that
 * "Bänkpress 4x8", "Bänkpress 3 x 10", "Bänkpress 5×5 80kg", etc. all
 * collapse to just "Bänkpress". Also strips trailing numbers like
 * "Bänkpress 4". Returns the trimmed base name.
 */
export function stripSetRepSuffix(name: string): string {
  let result = name.trim();
  // Remove trailing weight like "80kg", "80 kg", "80lb"
  result = result.replace(/\s+\d+(?:[.,]\d+)?\s*(?:kg|lb|lbs)\b\.?$/i, "").trim();
  // Remove trailing set x rep notation: "4x8", "3 x 10", "5×5", "4*8", optionally followed by extra
  result = result.replace(/\s+\d+\s*[x×*]\s*\d+(?:\s*[-–]\s*\d+)?\s*$/i, "").trim();
  // Remove trailing "@RPE 8" style
  result = result.replace(/\s+@\s*\S+$/i, "").trim();
  // Remove trailing parenthetical sets info, e.g. "(4x8)"
  result = result.replace(/\s*\(\s*\d+\s*[x×*]\s*\d+[^)]*\)\s*$/i, "").trim();
  // Remove a single trailing standalone number (e.g. "Bänkpress 4")
  result = result.replace(/\s+\d+(?:[.,]\d+)?$/u, "").trim();
  return result;
}

/**
 * Deduplicate a list of exercises by their base name (set/rep suffixes stripped).
 * When a duplicate is found, the variant WITHOUT a set/rep suffix wins.
 * Custom (non-built-in) entries are preferred over built-in only when no
 * clean built-in exists, so admin overrides keep working.
 */
export function dedupeExerciseList<T extends { name: string; isCustom?: boolean }>(
  list: T[]
): T[] {
  const byBase = new Map<string, T>();
  for (const item of list) {
    const base = stripSetRepSuffix(item.name);
    const baseKey = base.toLowerCase();
    const isClean = item.name.trim().toLowerCase() === baseKey;
    const existing = byBase.get(baseKey);
    if (!existing) {
      byBase.set(baseKey, { ...item, name: base });
      continue;
    }
    const existingIsClean = existing.name.trim().toLowerCase() === baseKey;
    // Prefer the clean (no set/rep suffix) entry
    if (isClean && !existingIsClean) {
      byBase.set(baseKey, { ...item, name: base });
    }
    // Otherwise keep existing
  }
  return Array.from(byBase.values());
}

/**
 * Normalize a single exercise line so that set/rep notation embedded in
 * the name (e.g. "Bänkpress 4×8" or "Bänkpress 4x8 80kg") is converted
 * to the canonical structured form "Bänkpress — 4×8" (or with weight:
 * "Bänkpress — 4×8 @ 80 kg"). Lines that already use the em-dash
 * separator, conditioning lines, vila/runda lines and unparseable lines
 * are returned unchanged.
 */
export function normalizeExerciseLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;

  // Already has em-dash separator → leave alone
  if (/\s—\s/.test(trimmed)) return line;

  // Skip vila / rounds / conditioning markers
  if (/^vila\b/i.test(trimmed)) return line;
  if (/^\d+\s*rundor/i.test(trimmed)) return line;
  if (/\bmin\b|\/km|\bkm\b/i.test(trimmed)) return line;

  // Match trailing "N x M" (with optional weight after)
  const m = trimmed.match(
    /^(.+?)\s+(\d+)\s*[x×*]\s*(\d+)(?:\s*(?:@\s*)?(\d+(?:[.,]\d+)?)\s*(kg|lb|lbs)?)?\s*$/i
  );
  if (!m) return line;

  const baseName = m[1].trim();
  const sets = m[2];
  const reps = m[3];
  const weightVal = m[4];
  const weightUnit = (m[5] || "kg").toLowerCase();

  if (!baseName) return line;

  if (weightVal) {
    return `${baseName} — ${sets}×${reps} @ ${weightVal.replace(",", ".")} ${weightUnit}`;
  }
  return `${baseName} — ${sets}×${reps}`;
}

/**
 * Normalize a multi-line `details` string by applying normalizeExerciseLine
 * to each non-empty line. Preserves blank lines and original separators.
 */
export function normalizeImportedDetails(details: string): string {
  if (!details) return details;
  return details
    .split("\n")
    .map((l) => (l.trim() ? normalizeExerciseLine(l) : l))
    .join("\n");
}
