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

/** Convert amount+unit to grams (approximate household measures). */
export function toGrams(amount: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "g" || u === "gram") return amount;
  if (u === "kg") return amount * 1000;
  if (u === "dl") return amount * 100;       // approx for water-like
  if (u === "ml") return amount;
  if (u === "l") return amount * 1000;
  if (u === "msk") return amount * 15;
  if (u === "tsk") return amount * 5;
  if (u === "krm") return amount * 1;
  if (u === "st" || u === "styck") return amount * 50; // rough default
  if (u === "portion") return amount * 250;
  return amount;
}

export const UNITS = ["g", "kg", "dl", "ml", "msk", "tsk", "st", "portion"] as const;
