import type { PickedItem } from "@/components/FoodPickerDialog";
import { isPlausibleMealLog } from "@/lib/inputValidation";
import { scaleMicros } from "@/lib/micronutrients";

export type GoalNutrition = { kcal: number; protein_g: number; fat_g: number; carbs_g: number };
export function suggestionTotals(items: PickedItem[]): GoalNutrition {
  return items.reduce((sum, item) => ({
    kcal: sum.kcal + item.kcal, protein_g: sum.protein_g + item.protein_g,
    fat_g: sum.fat_g + item.fat_g, carbs_g: sum.carbs_g + item.carbs_g,
  }), { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 });
}

/** Portions are bounded; no food is invented and calories never exceed the remaining goal. */
export function buildDayGoalSuggestions(candidates: PickedItem[], remaining: GoalNutrition): PickedItem[][] {
  if (!Number.isFinite(remaining.kcal) || remaining.kcal <= 0) return [];
  // This is a meal suggestion, not an attempt to eat an entire missing day's budget at once.
  const mealBudget = Math.min(remaining.kcal, 600);
  const seen = new Set<string>();
  const valid = candidates.filter(item => {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key) || /(?:^|[^\p{L}])rå(?:a|tt)?(?:$|[^\p{L}])/iu.test(item.name) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id) || !isPlausibleMealLog(item) || ![item.kcal, item.protein_g, item.fat_g, item.carbs_g].every(Number.isFinite) || item.kcal <= 0) return false;
    seen.add(key); return true;
  }).slice(0, 32);
  const options: { items: PickedItem[]; score: number }[] = [];
  const score = (items: PickedItem[]) => {
    const total = suggestionTotals(items);
    return Math.abs(remaining.kcal - total.kcal) / remaining.kcal
      + (remaining.protein_g > 0 ? 2 * Math.max(0, remaining.protein_g - total.protein_g) / remaining.protein_g : 0)
      + Math.max(0, total.fat_g - remaining.fat_g) / Math.max(remaining.fat_g, 20) * 0.15
      + Math.max(0, total.carbs_g - remaining.carbs_g) / Math.max(remaining.carbs_g, 50) * 0.15;
  };
  for (let i = 0; i < valid.length; i++) {
    for (let j = i; j < valid.length; j++) {
      const base = i === j ? [valid[i]] : [valid[i], valid[j]];
      // Avoid combining two full recipes or two protein main ingredients as a supposed meal.
      if (base.length === 2 && (base.every(item => item.source === "recipe") || base.every(item => item.protein_g * 4 / item.kcal > 0.4))) continue;
      const total = suggestionTotals(base);
      const factor = Math.min(1.5, mealBudget / total.kcal);
      const items = base.map(item => {
        // Whole pieces/portions are not scaled into impossible fractions.
        const amount = item.unit === "g" ? Math.floor(Math.min(250, item.amount * factor) / 5) * 5 : Math.min(item.source === "recipe" ? 1 : 2, Math.floor(item.amount * factor));
        const scale = amount / item.amount;
        return { ...item, amount, kcal: item.kcal * scale, protein_g: item.protein_g * scale,
          fat_g: item.fat_g * scale, carbs_g: item.carbs_g * scale,
          fiber_g: (item.fiber_g ?? 0) * scale, sugar_g: item.sugar_g == null ? null : item.sugar_g * scale,
          micros: item.micros ? scaleMicros(item.micros, scale) : undefined };
      });
      if (items.some(item => item.amount <= 0 || !isPlausibleMealLog(item))) continue;
      if (suggestionTotals(items).kcal > mealBudget + 0.001) continue;
      options.push({ items, score: score(items) });
    }
  }
  options.sort((a, b) => a.score - b.score);
  const result: PickedItem[][] = [];
  const used = new Set<string>();
  for (const option of options) {
    if (option.items.some(item => used.has(`${item.source}:${item.id}`))) continue;
    result.push(option.items);
    option.items.forEach(item => used.add(`${item.source}:${item.id}`));
    if (result.length === 3) break;
  }
  return result;
}