import { validateNumber } from "@/lib/inputValidation";
import { MICROS, type Micros, type MicroKey } from "@/lib/micronutrients";

export type MealAllocation = Record<string, { kcal: number; protein: number }>;
const DEFAULT_SHARES: Record<string, number> = { frukost: 25, lunch: 35, middag: 30, mellanmål: 10 };

export function defaultAllocation(slots: string[]): MealAllocation {
  const weights = slots.map((s) => DEFAULT_SHARES[s.toLowerCase()] ?? 15);
  const total = weights.reduce((s, x) => s + x, 0);
  let used = 0;
  return Object.fromEntries(slots.map((s, i) => {
    const pct = i === slots.length - 1 ? 100 - used : Math.floor(weights[i] / total * 100);
    used += pct;
    return [s, { kcal: pct, protein: pct }];
  }));
}

export function allocationError(allocation: MealAllocation): string | null {
  for (const share of Object.values(allocation)) {
    for (const value of [share.kcal, share.protein]) {
      const { error } = validateNumber(value, "mealShare");
      if (error) return error;
    }
  }
  if (["kcal", "protein"].some((key) => Object.values(allocation).reduce((s, x) => s + x[key as "kcal" | "protein"], 0) !== 100)) {
    return "Kalorier och protein måste vardera summera till 100 %.";
  }
  return null;
}

export function allocationForSlots(saved: MealAllocation, slots: string[]): MealAllocation {
  if (slots.length !== Object.keys(saved).length || slots.some((s) => !saved[s]) || allocationError(saved)) return defaultAllocation(slots);
  return saved;
}

/** Integer targets with no rounding drift: each column adds up to its daily target. */
export function mealTargets(allocation: MealAllocation, dailyKcal: number, dailyProtein: number) {
  const entries = Object.entries(allocation);
  let usedKcal = 0, usedProtein = 0;
  return Object.fromEntries(entries.map(([slot, share], i) => {
    const last = i === entries.length - 1;
    const kcal = last ? Math.round(dailyKcal) - usedKcal : Math.floor(dailyKcal * share.kcal / 100);
    const protein = last ? Math.round(dailyProtein) - usedProtein : Math.floor(dailyProtein * share.protein / 100);
    usedKcal += kcal; usedProtein += protein;
    return [slot, { kcal, protein }];
  }));
}

export function nutrientCoverage(rows: Micros[]): Partial<Record<MicroKey, { value: number | null; known: number; total: number }>> {
  return Object.fromEntries(MICROS.map(({ key }) => {
    const values = rows.map((r) => r[key]).filter((v): v is number => v != null && Number.isFinite(Number(v)));
    return [key, { value: values.length ? values.reduce((s, v) => s + Number(v), 0) : null, known: values.length, total: rows.length }];
  }));
}

export function completeDayAverage(days: { key: string; kcal: number; complete: boolean }[]): number | null {
  const complete = days.filter((d) => d.complete);
  return complete.length ? complete.reduce((s, d) => s + d.kcal, 0) / complete.length : null;
}

export function nutritionSource(row: { nutrition_source?: string | null; source?: string; id?: string; code?: string }): string {
  if (row.nutrition_source) return row.nutrition_source;
  if (row.source === "off" || row.source === "openfoodfacts" || row.id?.startsWith("off-")) return "Open Food Facts · förpackningsuppgifter, ej verifierade";
  if (row.source === "recipe" || row.source === "recept") return "Recept · beräknat från ingredienser";
  if (row.source === "ai") return "AI-uppskattat";
  if (row.source === "restaurang" || row.id?.startsWith("menu-") || row.code?.startsWith("menu-")) return "Restaurang · ungefärliga menyvärden";
  if (row.source === "food" || row.source === "livsmedelsverket") return "Livsmedelsbanken · ursprung ej angivet";
  if (row.source === "custom_food" || row.source === "egen") return "Användarinmatat · ursprung ej angivet";
  return "Ursprung ej angivet";
}