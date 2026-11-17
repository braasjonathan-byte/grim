import { isPlausibleMealLog, validateNumber } from "./inputValidation";
import type { PickedItem } from "@/components/FoodPickerDialog";

export interface ScanItem {
  source: "livsmedelsverket" | "egen" | "ai" | "label";
  food: { id: string | null; name: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number | null };
  portion_g: number;
  identified?: { confidence?: number; name?: string };
}
export interface ScanRow extends ScanItem { selected: boolean; grams: string }

export function scanPick(row: ScanRow, index: number): PickedItem | null {
  const amount = validateNumber(row.grams, "foodGrams");
  if (amount.error || amount.value === null || !row.food.name.trim()) return null;
  if (validateNumber(row.food.kcal, "customKcal").error || [row.food.protein_g, row.food.fat_g, row.food.carbs_g].some(n => !Number.isFinite(n) || validateNumber(n, "customMacro").error)) return null;
  const factor = amount.value / 100;
  const item: PickedItem = { source: row.source === "livsmedelsverket" ? "food" : "custom_food", id: row.food.id ?? `ai-${index}`, name: row.food.name,
    amount: amount.value, unit: "g", kcal: row.food.kcal * factor, protein_g: row.food.protein_g * factor,
    fat_g: row.food.fat_g * factor, carbs_g: row.food.carbs_g * factor,
    ...(row.food.fiber_g != null ? { fiber_g: row.food.fiber_g * factor } : {}) };
  return isPlausibleMealLog(item) ? item : null;
}