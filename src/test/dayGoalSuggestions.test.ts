import { describe, expect, it } from "vitest";
import { buildDayGoalSuggestions, suggestionTotals } from "@/lib/dayGoalSuggestions";
import type { PickedItem } from "@/components/FoodPickerDialog";
const food = (n: number, kcal = 100, protein = 10): PickedItem => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, source: "food", name: `Mat ${n}`, amount: 100, unit: "g", kcal, protein_g: protein, fat_g: 2, carbs_g: 10 });
const remaining = { kcal: 350, protein_g: 30, fat_g: 15, carbs_g: 50 };
describe("day goal suggestions", () => {
  it("offers up to three distinct combinations from real candidates", () => {
    const result = buildDayGoalSuggestions([1, 2, 3, 4, 5, 6].map(n => food(n)), remaining);
    expect(result).toHaveLength(3);
    expect(new Set(result.flat().map(item => item.id)).size).toBe(result.flat().length);
  });
  it("never exceeds remaining calories", () => {
    const result = buildDayGoalSuggestions([food(1, 230), food(2, 160)], { ...remaining, kcal: 123 });
    expect(result.length).toBeGreaterThan(0);
    for (const items of result) expect(suggestionTotals(items).kcal).toBeLessThanOrEqual(123);
  });
  it("does not prescribe more food when calories are already met", () => {
    expect(buildDayGoalSuggestions([food(1)], { ...remaining, kcal: 0 })).toEqual([]);
    expect(buildDayGoalSuggestions([food(1)], { ...remaining, kcal: -100 })).toEqual([]);
  });
  it("prioritizes protein when protein is missing", () => {
    const result = buildDayGoalSuggestions([food(1, 100, 0), food(2, 100, 30)], { ...remaining, kcal: 100 });
    expect(result[0].some(item => item.id === food(2).id)).toBe(true);
  });
  it("does not invent unlinked foods or count invalid history", () => {
    expect(buildDayGoalSuggestions([{ ...food(1), id: "hist-test" }, { ...food(2), kcal: -1 }], remaining)).toEqual([]);
  });
  it("does not bring excluded candidates back", () => {
    const candidates = [food(1), food(2), food(3)].filter(item => item.id !== food(2).id);
    expect(buildDayGoalSuggestions(candidates, remaining).flat().map(item => item.id)).not.toContain(food(2).id);
  });
  it("keeps whole portions whole", () => {
    const result = buildDayGoalSuggestions([{ ...food(1, 200), amount: 1, unit: "portion" }], { ...remaining, kcal: 300 });
    expect(result[0][0].amount).toBe(1);
    expect(result[0][0].kcal).toBe(200);
  });
  it("calculates edited combination totals rather than retaining removed nutrition", () => {
    expect(suggestionTotals([food(1, 120, 15)])).toEqual({ kcal: 120, protein_g: 15, fat_g: 2, carbs_g: 10 });
  });
  it("offers a bounded meal instead of filling a whole unlogged day", () => {
    const result = buildDayGoalSuggestions([food(1, 400), food(2, 300)], { ...remaining, kcal: 2000 });
    expect(result.length).toBeGreaterThan(0);
    result.forEach(items => expect(suggestionTotals(items).kcal).toBeLessThanOrEqual(600));
  });
  it("never offers multiple servings of a full recipe", () => {
    const result = buildDayGoalSuggestions([{ ...food(1, 300), source: "recipe", amount: 3, unit: "portion" }], { ...remaining, kcal: 2000 });
    expect(result[0][0].amount).toBe(1);
  });
  it("does not suggest raw meat as ready-to-eat food", () => {
    expect(buildDayGoalSuggestions([{ ...food(1), name: "Kyckling rå" }], remaining)).toEqual([]);
  });
});