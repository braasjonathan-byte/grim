/**
 * Settyper för styrka v2. Lagras per övning i logged_weights:
 *   __settypes__<övning> = "wnnd"  (w = uppvärmning, n = vanligt, d = dropset)
 *   __superset__<övning> = "A"     (övningar med samma bokstav körs som superset)
 */
export type SetType = "n" | "w" | "d";

export const SET_TYPE_KEY = (exercise: string) => `__settypes__${exercise}`;
export const SUPERSET_KEY = (exercise: string) => `__superset__${exercise}`;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function findKey(weights: Record<string, any> | null | undefined, prefix: string, exercise: string): string | undefined {
  if (!weights) return undefined;
  const direct = weights[`${prefix}${exercise}`];
  if (typeof direct === "string") return direct;
  const wanted = norm(exercise);
  for (const [k, v] of Object.entries(weights)) {
    if (k.startsWith(prefix) && norm(k.slice(prefix.length)) === wanted && typeof v === "string") return v;
  }
  return undefined;
}

export function getSetTypes(weights: Record<string, any> | null | undefined, exercise: string): string {
  return findKey(weights, "__settypes__", exercise) || "";
}

export function getSetType(weights: Record<string, any> | null | undefined, exercise: string, setIndex: number): SetType {
  const c = getSetTypes(weights, exercise)[setIndex];
  return c === "w" || c === "d" ? c : "n";
}

/** Nästa typ vid tryck på setnumret: vanligt → uppvärmning → dropset → vanligt. */
export function nextSetType(t: SetType): SetType {
  return t === "n" ? "w" : t === "w" ? "d" : "n";
}

export function withSetType(current: string, setIndex: number, type: SetType, totalSets: number): string {
  const arr = Array.from({ length: Math.max(totalSets, setIndex + 1) }, (_, i) => current[i] === "w" || current[i] === "d" ? current[i] : "n");
  arr[setIndex] = type;
  const s = arr.join("");
  return /^n*$/.test(s) ? "" : s;
}

/** Etikett i setkolumnen: uppvärmning = "U", dropset = "D", annars löpnummer bland arbetsset. */
export function setLabel(types: string, setIndex: number): string {
  const t = types[setIndex];
  if (t === "w") return "U";
  if (t === "d") return "D";
  let n = 0;
  for (let i = 0; i <= setIndex; i++) if (types[i] !== "w" && types[i] !== "d") n++;
  return String(n);
}

export function getSuperset(weights: Record<string, any> | null | undefined, exercise: string): string | null {
  const v = findKey(weights, "__superset__", exercise);
  return v && /^[A-Z]$/.test(v) ? v : null;
}

/** Nästa lediga supersetbokstav givet befintliga grupper. */
export function nextSupersetLetter(used: Iterable<string>): string {
  const set = new Set(used);
  for (let c = 65; c <= 90; c++) if (!set.has(String.fromCharCode(c))) return String.fromCharCode(c);
  return "Z";
}

/**
 * Ska vilotimern starta efter att ett set bockats?
 *  - uppvärmning: nej (kort paus sköts manuellt)
 *  - dropset: nej (direkt vidare)
 *  - superset: bara efter sista övningen i gruppen
 */
export function shouldStartRest(opts: { setType: SetType; exercise: string; supersetOrder?: string[] | null }): boolean {
  if (opts.setType === "w" || opts.setType === "d") return false;
  const order = opts.supersetOrder;
  if (order && order.length > 1) {
    return norm(order[order.length - 1]) === norm(opts.exercise);
  }
  return true;
}

/** Övningarna (i passets ordning) som ingår i samma superset som `exercise`. */
export function supersetMembers(weights: Record<string, any> | null | undefined, exercise: string, orderedExercises: string[]): string[] | null {
  const g = getSuperset(weights, exercise);
  if (!g) return null;
  const members = orderedExercises.filter((e) => getSuperset(weights, e) === g);
  return members.length > 1 ? members : null;
}
