// Nutrition helpers: BMR, macro distributions, common unit conversions.

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "strength" | "maintain" | "endurance" | "custom";

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Stillasittande (lite/ingen träning)",
  light: "Lätt aktiv (1–3 pass/v)",
  moderate: "Måttligt aktiv (3–5 pass/v)",
  active: "Aktiv (6–7 pass/v)",
  very_active: "Mycket aktiv (2 pass/dag, tungt jobb)",
};

export const GOAL_LABEL: Record<GoalType, string> = {
  strength: "Bli starkare",
  maintain: "Bibehålla vikt",
  endurance: "Optimera uthållighet",
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

export interface MacroTargets {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

/**
 * Distribute kcal into macros depending on goal.
 * - strength: 2.0 g protein/kg, 25% fat, rest carbs (slight surplus)
 * - maintain: 1.6 g protein/kg, 30% fat, rest carbs
 * - endurance: 1.4 g protein/kg, 25% fat, rest carbs (carb-heavy)
 */
export function distributeMacros(
  tdee: number,
  weightKg: number,
  goal: GoalType,
): MacroTargets {
  let kcal = tdee;
  let proteinPerKg = 1.6;
  let fatPct = 0.3;

  if (goal === "strength") { kcal = Math.round(tdee * 1.05); proteinPerKg = 2.0; fatPct = 0.25; }
  if (goal === "endurance") { proteinPerKg = 1.4; fatPct = 0.25; }
  if (goal === "maintain") { proteinPerKg = 1.6; fatPct = 0.3; }
  if (goal === "custom") { return { kcal, protein_g: Math.round((kcal * 0.25) / 4), fat_g: Math.round((kcal * 0.3) / 9), carbs_g: Math.round((kcal * 0.45) / 4) }; }

  const protein_g = Math.round(proteinPerKg * weightKg);
  const fat_g = Math.round((kcal * fatPct) / 9);
  const proteinKcal = protein_g * 4;
  const fatKcal = fat_g * 9;
  const carbs_g = Math.max(0, Math.round((kcal - proteinKcal - fatKcal) / 4));
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
