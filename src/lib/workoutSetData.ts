import { isPlausibleSet } from "@/lib/inputValidation";
import { normalizeExerciseKey } from "@/lib/workoutDayUtils";

export const parseExerciseWeight = (line: string | null | undefined): {name: string;weight: string | null;} => {
  if (!line) return { name: "", weight: null };
  const match = line.match(/^(.+?)\s*—\s*(.+)$/);
  if (match) return { name: match[1].trim(), weight: match[2].trim() };
  return { name: line.trim(), weight: null };
};

export type LoggedSetInfo = { kg: string; reps: string; mode?: "add" | "sub" };

export const getExerciseSetDataFromWeights = (weights: Record<string, any> | null | undefined, exerciseName: string): LoggedSetInfo[] => {
  if (!weights) return [];
  const wantedKey = normalizeExerciseKey(exerciseName);
  let storedName = exerciseName;
  let raw: any = null;

  for (const [key, value] of Object.entries(weights)) {
    if (!key.startsWith("__setdata__")) continue;
    const candidateName = key.substring("__setdata__".length);
    if (normalizeExerciseKey(candidateName) === wantedKey) {
      storedName = candidateName;
      raw = value;
      break;
    }
  }

  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];

    const storedKey = normalizeExerciseKey(storedName);
    return parsed.map((set, si) => {
      const kgRaw = set?.kg !== undefined && set?.kg !== null ? String(set.kg).trim() : "";
      const reps = set?.reps !== undefined && set?.reps !== null ? String(set.reps).trim() : "";
      const kgNum = parseFloat(kgRaw.replace(",", "."));
      const modeRaw = weights[`__bw_mode__${storedName}__${si}`] ?? weights[`__bw_mode__${storedKey}__${si}`] ?? weights[`__bw_mode__${exerciseName}__${si}`] ?? weights[`__bw_mode__${wantedKey}__${si}`] ?? weights[`__bw_mode__${storedName}`] ?? weights[`__bw_mode__${storedKey}`] ?? weights[`__bw_mode__${exerciseName}`] ?? weights[`__bw_mode__${wantedKey}`];
      const mode: LoggedSetInfo["mode"] = modeRaw === "sub" || (!isNaN(kgNum) && kgNum < 0) ? "sub" : modeRaw === "add" ? "add" : undefined;
      const kg = kgRaw && !isNaN(kgNum) ? String(Math.abs(kgNum)) : kgRaw;
      return { kg, reps, mode };
    }).filter((set) => set.kg || set.reps);
  } catch {
    return [];
  }
};

export const parseCondTempo = (t: string): number | null => {
  const trimmed = t.trim();
  if (!trimmed) return null;

  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) return parseInt(colonMatch[1]) + parseInt(colonMatch[2]) / 60;

  const dotTimeMatch = trimmed.match(/^(\d+)\.(\d{2})$/);
  if (dotTimeMatch && parseInt(dotTimeMatch[2]) < 60) {
    return parseInt(dotTimeMatch[1]) + parseInt(dotTimeMatch[2]) / 60;
  }

  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;

  const v = parseFloat(trimmed.replace(",", "."));
  return isNaN(v) ? null : v;
};

export const formatCondTempo = (minPerKm: number): string => {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Helper: check if exercise is a stair machine (Trappmaskin)
export const isStairMachine = (name: string) => name.toLowerCase().includes("trappmaskin");

export type CollectedSet = { kg: number; reps: number };

/**
 * Samla alla loggade set för en övning ur en logged_weights-post.
 * Matchar nyckeln oavsett skiftläge/mellanslag och stödjer även äldre
 * format där vikten sparats direkt på övningsnamnet.
 */
export const collectSetsForExercise = (
  weights: Record<string, any> | null | undefined,
  exerciseName: string,
): CollectedSet[] => {
  if (!weights) return [];
  const wanted = normalizeExerciseKey(exerciseName);
  const out: CollectedSet[] = [];

  for (const [key, value] of Object.entries(weights)) {
    if (key.startsWith("__setdata__")) {
      const storedName = key.substring("__setdata__".length);
      if (normalizeExerciseKey(storedName) !== wanted) continue;
      const storedKey = normalizeExerciseKey(storedName);
      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (!Array.isArray(parsed)) continue;
        parsed.forEach((s: any, si: number) => {
          if (!isPlausibleSet(s?.kg, s?.reps)) return;
          const rawKg = parseFloat(String(s?.kg ?? "").replace(",", "."));
          const mode =
            weights[`__bw_mode__${storedName}__${si}`] ??
            weights[`__bw_mode__${storedKey}__${si}`] ??
            weights[`__bw_mode__${storedName}`] ??
            weights[`__bw_mode__${storedKey}`];
          const kg = mode === "sub" && rawKg > 0 ? -rawKg : rawKg;
          const reps = parseInt(String(s?.reps ?? ""), 10);
          if (!isNaN(kg) && kg !== 0) out.push({ kg, reps: isNaN(reps) ? 0 : reps });
        });
      } catch {}
    } else if (!key.startsWith("__") && normalizeExerciseKey(key) === wanted) {
      // Äldre format: logged_weights["Knäböj"] = "80"
      const kg = parseFloat(String(value ?? "").replace(",", "."));
      if (!isNaN(kg) && kg !== 0 && isPlausibleSet(kg, 0)) out.push({ kg, reps: 0 });
    }
  }
  return out;
};
