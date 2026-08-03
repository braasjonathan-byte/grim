import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";

export function mapGroupToRegions(group: string): string[] {
  switch (group) {
    case "Bröst": return ["chest"];
    case "Rygg": return ["traps", "lats", "lowerBack"];
    case "Ben": return ["quads", "calves", "hamstrings"];
    case "Rumpa": return ["glutes"];
    case "Axlar": return ["delts"];
    case "Armar": return ["biceps", "triceps", "forearms"];
    case "Core": return ["abs", "obliques"];
    case "Helkropp": return ["chest", "traps", "lats", "quads", "calves", "delts", "biceps", "abs"];
    default: return [];
  }
}

const MUSCLE_GROUP_MAP: Record<string, string[]> = {};
for (const ex of exerciseLibrary) {
  MUSCLE_GROUP_MAP[ex.name.toLowerCase()] = mapGroupToRegions(ex.muscleGroup);
}
// Knäböj tränar även rumpa
MUSCLE_GROUP_MAP["knäböj"] = ["quads", "calves", "hamstrings", "glutes"];
MUSCLE_GROUP_MAP["böj"] = ["quads", "calves", "hamstrings", "glutes"];
MUSCLE_GROUP_MAP["mark"] = MUSCLE_GROUP_MAP["marklyft"] || ["traps", "lats", "lowerBack"];

export const REGION_LABELS: Record<string, string> = {
  chest: "Bröst", traps: "Trapezius", lats: "Latissimus", lowerBack: "Nedre rygg",
  delts: "Axlar", biceps: "Biceps", triceps: "Triceps", forearms: "Underarmar",
  abs: "Mage", obliques: "Sneda bukmuskler", quads: "Quadriceps",
  hamstrings: "Baksida lår", glutes: "Rumpa", calves: "Vader",
};

export const REGION_TO_GROUP: Record<string, string> = {
  chest: "Bröst", traps: "Rygg", lats: "Rygg", lowerBack: "Rygg",
  delts: "Axlar", biceps: "Armar", triceps: "Armar", forearms: "Armar",
  abs: "Core", obliques: "Core", quads: "Ben", hamstrings: "Ben",
  glutes: "Rumpa", calves: "Ben",
};

export const REGION_EXERCISES: Record<string, string[]> = {
  chest: ["Bänkpress", "Hantlar Flyes", "Armhävningar"],
  traps: ["Shrugs", "Face Pulls"],
  lats: ["Latsdrag", "Chins", "Kabelrodd"],
  lowerBack: ["Hyperextension", "Marklyft"],
  delts: ["Axelpress", "Sidolyft", "Reverse Fly"],
  biceps: ["Bicepscurl", "Hammarcurl"],
  triceps: ["Triceps Pushdown", "Skallkross"],
  forearms: ["Hammarcurl", "Handledscurl"],
  abs: ["Planka", "Hängande Benlyft", "Ab Wheel"],
  obliques: ["Russian Twist", "Sidoplanka", "Bålrotation"],
  quads: ["Knäböj", "Benpress", "Benextension"],
  hamstrings: ["Bencurl", "Rumänsk Marklyft"],
  glutes: ["Hip Thrust Maskin", "Glute Bridge", "Cable Kickback"],
  calves: ["Vadpress"],
};

function extractExerciseNames(details: string): string[] {
  const names: string[] = [];
  for (const line of details.split("\n")) {
    const trimmed = line.replace(/^[-•*]\s*/, "").trim();
    if (!trimmed || /^\d/.test(trimmed)) continue;
    const match = trimmed.match(/^([A-Za-zÅÄÖåäö\s\-()]+)/);
    if (match) {
      const name = match[1].trim().replace(/\s*—\s*$/, "");
      if (name.length > 2) names.push(name);
    }
  }
  return names;
}

function findPartialMatch(name: string, map: Record<string, string[]>): string[] | null {
  for (const [key, regions] of Object.entries(map)) {
    if (name.includes(key) || key.includes(name)) return regions;
  }
  return null;
}

/** Regions trained during the last `days` days, based on completed workouts. */
export async function loadTrainedRegions(userId: string, days = 7): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const [{ data: completions }, { data: plans }, { data: customExercises }] = await Promise.all([
    supabase.from("workout_completions").select("week, day, done, logged_weights")
      .eq("user_id", userId).eq("done", true).gte("updated_at", since.toISOString()),
    supabase.from("workout_plans").select("week, day, details").eq("user_id", userId),
    supabase.from("custom_exercises").select("name, muscle_group"),
  ]);

  const customMap: Record<string, string[]> = {};
  if (customExercises) for (const ce of customExercises) customMap[ce.name.toLowerCase()] = mapGroupToRegions(ce.muscle_group);
  const planMap = new Map<string, string>();
  if (plans) for (const p of plans) planMap.set(`${p.week}-${p.day}`, p.details);

  const regions = new Set<string>();
  const addFor = (rawName: string) => {
    const lower = rawName.toLowerCase();
    const mapped = MUSCLE_GROUP_MAP[lower] || customMap[lower]
      || findPartialMatch(lower, MUSCLE_GROUP_MAP) || findPartialMatch(lower, customMap);
    if (mapped) mapped.forEach(r => regions.add(r));
  };

  for (const c of completions || []) {
    if (!c.done) continue;
    const details = planMap.get(`${c.week}-${c.day}`);
    if (details) for (const name of extractExerciseNames(details)) addFor(name);
    if (c.logged_weights && typeof c.logged_weights === "object") {
      for (const key of Object.keys(c.logged_weights as Record<string, unknown>)) {
        if (key.startsWith("__")) continue;
        addFor(key);
      }
    }
  }
  return regions;
}

/** Untrained regions (last `days` days), ordered as in REGION_LABELS. */
export async function loadUntrainedRegions(userId: string, days = 7): Promise<string[]> {
  const trained = await loadTrainedRegions(userId, days);
  return Object.keys(REGION_LABELS).filter(r => !trained.has(r));
}

/** Suggest a focus for today based on untrained regions. */
export function buildSuggestion(untrained: string[]) {
  if (untrained.length === 0) return null;
  // Pick the largest muscle groups first for a meaningful session
  const priority = ["quads", "lats", "chest", "glutes", "hamstrings", "delts", "lowerBack", "traps", "biceps", "triceps", "abs", "obliques", "calves", "forearms"];
  const sorted = [...untrained].sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
  const focus = sorted.slice(0, 3);
  const groups = Array.from(new Set(focus.map(r => REGION_TO_GROUP[r]).filter(Boolean)));
  const exercises = Array.from(new Set(focus.flatMap(r => (REGION_EXERCISES[r] || []).slice(0, 2)))).slice(0, 4);
  return {
    regions: focus,
    labels: focus.map(r => REGION_LABELS[r]),
    groups,
    primaryGroup: groups[0] || null,
    exercises,
    title: groups.join(" & "),
  };
}
