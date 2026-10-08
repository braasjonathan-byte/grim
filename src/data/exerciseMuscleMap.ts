/**
 * Primära och sekundära muskler per övning.
 *
 * Reglerna matchar på övningsnamn (delsträngar, skiftlägesokänsligt) så att de
 * även täcker maskinvarianter ("Chest Press (Life Fitness)") och egna övningar
 * med liknande namn. Först matchande regel vinner, därför ligger de mest
 * specifika namnen överst i varje block.
 *
 * Endast muskler där kopplingen är tydlig och allmänt accepterad är med –
 * osäkra fall lämnas till övningens huvudmuskelgrupp.
 */

export type MuscleRegion =
  | "chest" | "traps" | "lats" | "lowerBack" | "delts"
  | "biceps" | "triceps" | "forearms" | "abs" | "obliques"
  | "quads" | "hamstrings" | "glutes" | "calves";

export interface ExerciseRegions {
  primary: MuscleRegion[];
  secondary: MuscleRegion[];
}

interface Rule {
  /** Delsträngar i övningsnamnet (gemener) som aktiverar regeln. */
  match: string[];
  primary: MuscleRegion[];
  secondary: MuscleRegion[];
}

const R = (match: string[], primary: MuscleRegion[], secondary: MuscleRegion[] = []): Rule => ({
  match,
  primary,
  secondary,
});

/** Ordningen är betydelsefull: specifika namn före generella. */
const RULES: Rule[] = [
  // ---------- Bröst ----------
  R(["close-grip bänk", "close grip bänk", "close-grip bench"], ["triceps"], ["chest", "delts"]),
  R(["incline bänk", "incline press", "incline chest", "incline bench"], ["chest"], ["delts", "triceps"]),
  R(["decline press", "decline bench"], ["chest"], ["triceps"]),
  R(["pec fly", "pectoral", "kabelflyes", "hantlar flyes", "flyes", "pec deck", "chest fly"], ["chest"], ["delts"]),
  R(["bänkpress", "bench press", "chest press", "pausbänk", "bröstpress"], ["chest"], ["delts", "triceps"]),
  R(["armhävning", "push-up", "push up", "pushup"], ["chest"], ["delts", "triceps", "abs"]),
  R(["tricep dip"], ["triceps"], ["chest", "delts"]),
  R(["dips"], ["chest"], ["triceps", "delts"]),

  // ---------- Rygg ----------
  R(["face pull"], ["traps", "delts"], ["biceps"]),
  R(["shrug"], ["traps"], ["forearms"]),
  R(["upright row"], ["delts", "traps"], ["biceps"]),
  R(["hyperextension", "back extension", "ryggresning"], ["lowerBack"], ["glutes", "hamstrings"]),
  R(["good morning"], ["hamstrings", "lowerBack"], ["glutes"]),
  R(["rumänsk marklyft", "romanian deadlift", "stiff-leg", "stiff leg"], ["hamstrings"], ["glutes", "lowerBack", "forearms"]),
  R(["sumo marklyft", "sumo deadlift"], ["glutes", "quads"], ["hamstrings", "lowerBack", "traps", "forearms"]),
  R(["marklyft", "deadlift"], ["lowerBack", "hamstrings"], ["glutes", "traps", "lats", "forearms", "quads"]),
  R(["latsdrag", "lat pulldown", "lat machine", "pulldown"], ["lats"], ["biceps", "traps", "forearms"]),
  R(["chins", "chin-up", "pull-up", "pull up", "pullup"], ["lats"], ["biceps", "traps", "forearms", "abs"]),
  R(["high row"], ["lats", "traps"], ["biceps", "forearms"]),
  R(["rodd", "row"], ["lats", "traps"], ["biceps", "forearms", "lowerBack"]),
  R(["reverse fly", "rear delt"], ["delts", "traps"], []),

  // ---------- Axlar ----------
  R(["sidolyft", "lateral raise", "side raise"], ["delts"], ["traps"]),
  R(["framlyfning", "front raise"], ["delts"], ["chest"]),
  R(["arnold press", "axelpress", "shoulder press", "militärpress", "military press", "overhead press"], ["delts"], ["triceps", "traps", "abs"]),

  // ---------- Armar ----------
  R(["preacher curl", "concentration curl", "bicepscurl", "bicep curl", "arm curl", "biceps curl"], ["biceps"], ["forearms"]),
  R(["hammarcurl", "hammer curl"], ["biceps", "forearms"], []),
  R(["handledscurl", "wrist curl"], ["forearms"], []),
  R(["skallkross", "skull crusher", "tricepspress", "triceps pushdown", "tricep pushdown", "tricep extension", "triceps extension", "tricep press", "triceps press", "overhead extension", "kickback triceps"], ["triceps"], []),

  // ---------- Ben ----------
  R(["hack squat", "v-squat"], ["quads"], ["glutes", "hamstrings"]),
  R(["frontböj", "front squat"], ["quads"], ["glutes", "abs", "lowerBack"]),
  R(["goblet squat"], ["quads"], ["glutes", "abs"]),
  R(["sumo squat"], ["glutes", "quads"], ["hamstrings"]),
  R(["box squat", "pausböj", "knäböj", "squat"], ["quads", "glutes"], ["hamstrings", "lowerBack", "abs", "calves"]),
  R(["benpress", "leg press"], ["quads"], ["glutes", "hamstrings", "calves"]),
  R(["benextension", "leg extension"], ["quads"], []),
  R(["bencurl", "leg curl", "glute ham raise"], ["hamstrings"], ["glutes", "calves"]),
  R(["vadpress", "calf raise", "vadlyft"], ["calves"], []),
  R(["utfall", "lunge", "step-up", "steg-up", "step up", "split squat"], ["quads", "glutes"], ["hamstrings", "calves", "abs"]),

  // ---------- Rumpa ----------
  R(["hip thrust", "glute drive", "glute bridge", "frog pump", "pendlay hip extension"], ["glutes"], ["hamstrings", "quads"]),
  R(["kickback", "benspark bakåt", "donkey kick", "fire hydrant"], ["glutes"], ["hamstrings"]),
  R(["abduktion", "abduction", "band walk", "clamshell"], ["glutes"], []),
  R(["adduction", "adduktion"], ["quads"], ["glutes"]),
  R(["cable pull-through", "pull-through"], ["glutes", "hamstrings"], ["lowerBack"]),
  R(["glute"], ["glutes"], ["hamstrings"]),

  // ---------- Core ----------
  R(["sidoplanka", "side plank"], ["obliques"], ["abs", "delts"]),
  R(["planka", "plank"], ["abs"], ["obliques", "delts", "glutes"]),
  R(["russian twist", "bålrotation", "torso rotation", "rotary torso", "sneda"], ["obliques"], ["abs"]),
  R(["hängande benlyft", "hanging leg raise", "benlyft", "leg raise"], ["abs"], ["obliques", "forearms"]),
  R(["ab wheel"], ["abs"], ["obliques", "lats", "lowerBack"]),
  R(["kabeldrag", "cable crunch", "ab crunch", "crunch", "sit-up", "sit up", "dead bug"], ["abs"], ["obliques"]),

  // ---------- Kondition ----------
  R(["roddmaskin", "rowing machine", "skierg"], ["lats", "quads"], ["traps", "biceps", "lowerBack", "abs", "hamstrings", "glutes"]),
  R(["airbike", "skillmill", "arc trainer", "crosstrainer", "elliptical"], ["quads", "delts"], ["hamstrings", "glutes", "calves", "lats", "abs"]),
  R(["simning", "swimming", "paddling", "kajak", "kayak"], ["lats", "delts"], ["traps", "triceps", "abs", "obliques"]),
  R(["skidåkning", "skiing"], ["quads", "lats"], ["glutes", "hamstrings", "triceps", "abs"]),
  R(["skridsko", "skating"], ["quads", "glutes"], ["hamstrings", "calves", "obliques"]),
  R(["trappmaskin", "stairclimber", "stair"], ["quads", "glutes"], ["calves", "hamstrings"]),
  R(["cykling", "cykel", "cycling", "spinning", "motionscykel", "bike"], ["quads"], ["glutes", "hamstrings", "calves"]),
  R(["hopprep", "jump rope"], ["calves"], ["quads", "delts", "forearms"]),
  R(["löpband", "treadmill", "löpning", "running", "tröskellöpning", "långpass", "promenad", "vandring", "walk", "jogg"], ["quads", "calves"], ["hamstrings", "glutes", "abs"]),
];

const cache = new Map<string, ExerciseRegions | null>();

/** Normaliserar namn: gemener, utan tempo/antal-suffix och extra blanksteg. */
const normalize = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Slår upp primära och sekundära muskler för en övning.
 * Returnerar null när ingen regel matchar (då används muskelgruppen i stället).
 */
export function lookupExerciseRegions(name: string): ExerciseRegions | null {
  const key = normalize(name);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  let found: ExerciseRegions | null = null;
  for (const rule of RULES) {
    if (rule.match.some((m) => key.includes(m))) {
      found = { primary: rule.primary, secondary: rule.secondary };
      break;
    }
  }
  cache.set(key, found);
  return found;
}

/** Alla muskler övningen belastar (primära + sekundära). */
export function exerciseAllRegions(name: string): MuscleRegion[] {
  const hit = lookupExerciseRegions(name);
  if (!hit) return [];
  return Array.from(new Set([...hit.primary, ...hit.secondary]));
}

/** Muskelgrupp → regioner, för egna övningar som bara anger en grupp. */
export const GROUP_REGIONS: Record<string, MuscleRegion[]> = {
  "Bröst": ["chest"],
  "Rygg": ["traps", "lats", "lowerBack"],
  "Ben": ["quads", "hamstrings", "calves"],
  "Rumpa": ["glutes"],
  "Axlar": ["delts"],
  "Armar": ["biceps", "triceps", "forearms"],
  "Underarmar": ["forearms"],
  "Core": ["abs", "obliques"],
  "Kondition": [],
  "Helkropp": [],
};

/** Svenska muskelnamn (t.ex. från egna övningars sekundära muskler) till region. */
export const LABEL_TO_REGION: Record<string, MuscleRegion> = {
  "bröst": "chest",
  "chest": "chest",
  "trapezius": "traps",
  "traps": "traps",
  "övre rygg": "traps",
  "lats": "lats",
  "latissimus": "lats",
  "rygg": "lats",
  "nedre rygg": "lowerBack",
  "ländrygg": "lowerBack",
  "axlar": "delts",
  "främre delt": "delts",
  "sidodelt": "delts",
  "bakre delt": "delts",
  "delts": "delts",
  "biceps": "biceps",
  "triceps": "triceps",
  "underarmar": "forearms",
  "forearms": "forearms",
  "mage": "abs",
  "magmuskler": "abs",
  "core": "abs",
  "abs": "abs",
  "sneda magmuskler": "obliques",
  "sneda bukmuskler": "obliques",
  "obliques": "obliques",
  "quadriceps": "quads",
  "quads": "quads",
  "framsida lår": "quads",
  "adduktorer": "quads",
  "hamstrings": "hamstrings",
  "baksida lår": "hamstrings",
  "rumpa": "glutes",
  "säte": "glutes",
  "gluteus maximus": "glutes",
  "gluteus medius": "glutes",
  "glutes": "glutes",
  "vader": "calves",
  "calves": "calves",
};

/** Översätter en lista med muskelnamn till regioner. */
export function labelsToRegions(labels: unknown): MuscleRegion[] {
  if (!Array.isArray(labels)) return [];
  const out: MuscleRegion[] = [];
  const add = (value: unknown) => {
    const region = LABEL_TO_REGION[String(value).toLowerCase().trim()];
    if (region && !out.includes(region)) out.push(region);
  };
  for (const raw of labels) {
    // Egna övningar sparar sekundära muskler som { muscle, submuscles }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as { muscle?: unknown; submuscles?: unknown };
      const subs = Array.isArray(obj.submuscles) ? obj.submuscles : [];
      if (subs.length) subs.forEach(add);
      else if (obj.muscle !== undefined) GROUP_REGIONS[String(obj.muscle)]?.forEach(add);
      continue;
    }
    add(raw);
  }
  return out;
}
