// Nutrition helpers: BMR, macro distributions, common unit conversions.

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType =
  | "lose_fast" | "lose_slow" | "recomp" | "maintain"
  | "lean_bulk" | "bulk" | "strength" | "power" | "endurance" | "keto" | "custom";

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Stillasittande (lite/ingen träning)",
  light: "Lätt aktiv (1–3 pass/v)",
  moderate: "Måttligt aktiv (3–5 pass/v)",
  active: "Aktiv (6–7 pass/v)",
  very_active: "Mycket aktiv (2 pass/dag, tungt jobb)",
};

export const GOAL_LABEL: Record<GoalType, string> = {
  lose_fast: "Gå ner i vikt snabbt",
  lose_slow: "Gå ner i vikt långsamt",
  recomp: "Kroppsrekomp (bygg muskler & förlora fett)",
  maintain: "Bibehålla vikt",
  lean_bulk: "Lean bulk (lugn muskelökning)",
  bulk: "Bygg muskelmassa (bulk)",
  strength: "Bli starkare",
  power: "Explosiv styrka / power",
  endurance: "Optimera uthållighet",
  keto: "Keto / lågkolhydrat",
  custom: "Egna makros",
};

/** Mifflin-St Jeor */
export function calcBMR(weightKg: number, heightCm: number, age: number, gender: "male" | "female"): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === "female" ? base - 161 : base + 5);
}

export function calcTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTOR[activity]);
}

export interface MacroTargets { kcal: number; protein_g: number; fat_g: number; carbs_g: number; }

const GOAL_PARAMS: Record<Exclude<GoalType, "custom" | "keto">, { kcalMult: number; proteinPerKg: number; fatPct: number }> = {
  lose_fast:  { kcalMult: 0.80, proteinPerKg: 2.4, fatPct: 0.30 },
  lose_slow:  { kcalMult: 0.90, proteinPerKg: 2.2, fatPct: 0.28 },
  recomp:     { kcalMult: 1.00, proteinPerKg: 2.2, fatPct: 0.28 },
  maintain:   { kcalMult: 1.00, proteinPerKg: 1.6, fatPct: 0.30 },
  lean_bulk:  { kcalMult: 1.08, proteinPerKg: 2.0, fatPct: 0.25 },
  bulk:       { kcalMult: 1.15, proteinPerKg: 2.0, fatPct: 0.25 },
  strength:   { kcalMult: 1.05, proteinPerKg: 2.0, fatPct: 0.25 },
  power:      { kcalMult: 1.05, proteinPerKg: 1.8, fatPct: 0.25 },
  endurance:  { kcalMult: 1.00, proteinPerKg: 1.4, fatPct: 0.25 },
};

export function distributeMacros(tdee: number, weightKg: number, goal: GoalType): MacroTargets {
  if (goal === "custom") {
    const kcal = tdee;
    return { kcal, protein_g: Math.round((kcal * 0.25) / 4), fat_g: Math.round((kcal * 0.3) / 9), carbs_g: Math.round((kcal * 0.45) / 4) };
  }
  if (goal === "keto") {
    const kcal = tdee;
    const protein_g = Math.round(2.0 * weightKg);
    const carbs_g = Math.round((kcal * 0.05) / 4);
    const fat_g = Math.max(0, Math.round((kcal - protein_g * 4 - carbs_g * 4) / 9));
    return { kcal, protein_g, fat_g, carbs_g };
  }
  const p = GOAL_PARAMS[goal];
  const kcal = Math.round(tdee * p.kcalMult);
  const protein_g = Math.round(p.proteinPerKg * weightKg);
  const fat_g = Math.round((kcal * p.fatPct) / 9);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  return { kcal, protein_g, fat_g, carbs_g };
}

/** Typical weight per piece (g) for common foods, matched against the food name. */
const PIECE_WEIGHTS: [RegExp, number][] = [
  [/(^|[^a-zåäö])ägg/i, 53],
  [/banan/i, 120],
  [/äpple/i, 150],
  [/päron/i, 170],
  [/apelsin/i, 140],
  [/clementin|mandarin/i, 70],
  [/kiwi/i, 75],
  [/knäckebröd/i, 12],
  [/bröd|skiva|toast|limpa/i, 30],
  [/frukostfralla|fralla|bulle/i, 60],
  [/potatis/i, 150],
  [/sötpotatis/i, 200],
  [/morot|morötter/i, 70],
  [/gul lök|rödlök|(^|[^a-zåäö])lök/i, 100],
  [/vitlök/i, 5],
  [/tomat/i, 100],
  [/gurka/i, 300],
  [/paprika/i, 150],
  [/avokado/i, 170],
  [/korv|prinskorv/i, 50],
  [/kycklingfilé|kycklingbröst/i, 150],
];
export const DEFAULT_PIECE_G = 50;

/** Best piece weight: database value > name lookup > 50 g fallback. */
export function pieceWeightFor(name?: string | null, dbWeight?: number | null): number {
  if (dbWeight && dbWeight > 0) return Number(dbWeight);
  if (name) {
    // sötpotatis before potatis, vitlök before lök
    const ordered = [...PIECE_WEIGHTS].sort((a, b) => b[0].source.length - a[0].source.length);
    for (const [re, g] of ordered) if (re.test(name)) return g;
  }
  return DEFAULT_PIECE_G;
}

/**
 * Density (g per ml) for common foods, matched against the name.
 * Volume units (dl/ml/msk/tsk) must be converted with density – 1 dl havregryn ≈ 35 g, not 100 g.
 * Longest pattern wins, so "havremjölk" (liquid) beats "havre" (flakes).
 */
const DENSITIES: [RegExp, number][] = [
  // Liquids
  [/mjölk|filmjölk|fil\b|yoghurt|kefir|grädde|juice|saft|läsk|vatten|buljong|soppa|dryck|öl\b|vin\b|kaffe|\bte\b/i, 1.03],
  [/havremjölk|havredryck|sojadryck|mandeldryck|oatly/i, 1.03],
  [/kvarg|keso|kesella|crème fraiche|creme fraiche|gräddfil|turkisk/i, 1.05],
  [/olja|olivolja|rapsolja/i, 0.92],
  [/smör|margarin|bregott/i, 0.95],
  [/honung|sirap/i, 1.4],
  [/sylt|marmelad/i, 1.3],
  [/ketchup|senap|majonnäs|dressing|sås/i, 1.05],
  [/jordnötssmör|nötsmör/i, 1.05],
  // Dry goods
  [/havregryn|havrefras|gryn\b|grötgryn|\bhavre/i, 0.35],
  [/müsli|granola/i, 0.4],
  [/cornflakes|flingor|puffat|rice krispies|special k/i, 0.13],
  [/vetemjöl|rågmjöl|dinkelmjöl|mjöl\b|mjöl /i, 0.6],
  [/florsocker/i, 0.6],
  [/socker|strösocker|farin/i, 0.85],
  [/kakao|o'boy|oboy/i, 0.45],
  [/proteinpulver|whey|kaseinpulver|pulver/i, 0.4],
  [/ris basmati|basmatiris|jasminris|ris\b|basmati|jasmin/i, 0.85],
  [/bulgur|matvete|quinoa|couscous/i, 0.75],
  [/pasta|makaroner|spaghetti|penne|fusilli/i, 0.4],
  [/linser|bönor|kikärtor/i, 0.8],
  [/ärtor|majs/i, 0.65],
  [/nötter|mandlar|cashew|jordnötter|valnöt|hasselnöt/i, 0.6],
  [/frön|chiafrö|linfrö|solrosfrö|pumpafrö|sesam/i, 0.6],
  [/riven ost|ost riven|parmesan/i, 0.4],
  [/bär|blåbär|hallon|jordgubb|lingon/i, 0.6],
  [/russin|torkad frukt|dadlar/i, 0.65],
  [/kokosflingor|kokos/i, 0.35],
  [/salt\b|bakpulver|bikarbonat/i, 1.2],
  [/kanel|krydd|peppar|paprikapulver/i, 0.5],
  [/sallad|spenat|ruccola|grönkål/i, 0.2],
  // More dry goods
  [/kli\b|vetekli|havrekli|kruskakli/i, 0.25],
  [/kross|groddar|flakes/i, 0.4],
  [/grynsgröt|gröt\b|välling/i, 1.05],
  [/mannagryn|semolina|polenta|majsmjöl/i, 0.65],
  [/nudlar/i, 0.35],
  [/torkad|malen|mald\b|pulver/i, 0.5],
  [/jäst torkad|näringsjäst/i, 0.3],
  [/chips potatis|potatischips|chips|bågar|popcorn|salta pinnar|räkchips/i, 0.1],
  [/hårt bröd|knäcke|skorpor|kex\b|rån\b/i, 0.25],
  [/gelégodis|godis|karameller|kola\b|choklad/i, 0.6],
  [/hampafrö|vallmofrö|pinjefrö|psyllium/i, 0.55],
  [/kastanj|sötmandel/i, 0.6],
  // Solid fresh foods (chopped/diced into a measure)
  [/hårdost|ost\b|mesost|smältost|mögelost/i, 0.45],
  [/cottage cheese|färskost/i, 1.0],
  [/potatis|pommes/i, 0.65],
  [/morot|kålrot|palsternacka|rotselleri|rödbeta|grönsak|kål\b|broccoli|blomkål|svamp|champinjon|lök/i, 0.55],
  [/frukt|äpple|päron|ananas|melon|mango|druv|citrus|aprikos|persika|plommon/i, 0.6],
  [/tofu|sojaprotein|veteprotein|quorn|färs|köttfärs/i, 0.85],
  [/(^|\s)rå($|[\s,])|\bkokt\b|\bstekt\b|filé/i, 0.8],
  [/glass/i, 0.55],
  [/äppelmos|mos\b/i, 1.05],
];
export const DEFAULT_DENSITY = 1.0;

/** Best density (g/ml) for a food name; 1.0 (water) fallback. */
export function densityFor(name?: string | null): number {
  if (!name) return DEFAULT_DENSITY;
  const ordered = [...DENSITIES].sort((a, b) => b[0].source.length - a[0].source.length);
  let best: { len: number; d: number } | null = null;
  for (const [re, d] of ordered) {
    const m = name.match(re);
    if (m && (!best || m[0].length > best.len)) best = { len: m[0].length, d };
  }
  return best ? best.d : DEFAULT_DENSITY;
}

const ML_PER_UNIT: Record<string, number> = { ml: 1, dl: 100, l: 1000, msk: 15, tsk: 5, krm: 1 };

/** Convert amount+unit to grams (approximate household measures). */
export function toGrams(amount: number, unit: string, pieceG: number = DEFAULT_PIECE_G, density: number = DEFAULT_DENSITY): number {
  const u = unit.toLowerCase();
  if (u === "g" || u === "gram") return amount;
  if (u === "kg") return amount * 1000;
  if (ML_PER_UNIT[u]) return amount * ML_PER_UNIT[u] * density;
  if (u === "st" || u === "styck") return amount * pieceG;
  if (u === "portion") return amount * 250;
  return amount;
}

/** Grams for a named food – uses piece weight and density lookups. Use this everywhere food is logged. */
export function gramsForFood(amount: number, unit: string, name?: string | null, dbPieceG?: number | null): number {
  return toGrams(amount, unit, pieceWeightFor(name, dbPieceG), densityFor(name));
}

/** Short hint like "1 dl ≈ 35 g" for non-gram units, or null. */
export function unitHint(unit: string, name?: string | null, dbPieceG?: number | null): string | null {
  const u = unit.toLowerCase();
  if (u === "g" || u === "kg" || u === "portion") return null;
  const g = gramsForFood(1, u, name, dbPieceG);
  return `1 ${u} ≈ ${g < 10 ? g.toFixed(1).replace(".", ",") : Math.round(g)} g`;
}

export const UNITS = ["g", "kg", "dl", "ml", "msk", "tsk", "st", "portion"] as const;
