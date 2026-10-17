import { gramsForFood, naturalUnitsFor, UNITS } from "@/lib/nutritionCalc";

export interface IngredientMeasure {
  name: string;
  amount: number;
  unit: string;
}

export interface FoodMeasure {
  default_piece_weight_g?: number | null;
  density_g_per_dl?: number | null;
  suitable_units?: string[] | null;
}

const convertible = new Set<string>([...UNITS.filter((u) => u !== "portion"), "l", "krm", "gram", "styck", "skiva", "näve", "filé"]);

export function ingredientUnitOptions(ingredient: IngredientMeasure, food?: FoodMeasure): string[] {
  if (!convertible.has(ingredient.unit)) return [ingredient.unit];
  const options = food?.suitable_units?.length
    ? food.suitable_units
    : [...UNITS.filter((u) => u !== "portion"), "krm", ...naturalUnitsFor(ingredient.name)];
  return [...new Set([ingredient.unit, ...options.filter((u) => convertible.has(u))])];
}

/** Convert from the original quantity every time; display rounding never changes saved nutrition. */
export function ingredientAmountIn(ingredient: IngredientMeasure, unit: string, food?: FoodMeasure): number {
  if (unit === ingredient.unit || !convertible.has(ingredient.unit) || !convertible.has(unit)) return ingredient.amount;
  const grams = gramsForFood(ingredient.amount, ingredient.unit, ingredient.name, food?.default_piece_weight_g, food?.density_g_per_dl);
  const perUnit = gramsForFood(1, unit, ingredient.name, food?.default_piece_weight_g, food?.density_g_per_dl);
  return perUnit > 0 ? grams / perUnit : ingredient.amount;
}

/**
 * Convert an ingredient to a new unit for editing (recipe editor): the amount is
 * recalculated so the total grams — and therefore the nutrition — stay the same.
 * Non-convertible units keep their amount.
 */
export function convertedIngredient<T extends IngredientMeasure>(ingredient: T, unit: string, food?: FoodMeasure): T {
  if (unit === ingredient.unit || !convertible.has(ingredient.unit) || !convertible.has(unit)) return { ...ingredient, unit };
  const grams = gramsForFood(ingredient.amount, ingredient.unit, ingredient.name, food?.default_piece_weight_g, food?.density_g_per_dl);
  const perUnit = gramsForFood(1, unit, ingredient.name, food?.default_piece_weight_g, food?.density_g_per_dl);
  const amount = perUnit > 0 ? Math.round((grams / perUnit) * 100) / 100 : ingredient.amount;
  return { ...ingredient, amount, unit };
}