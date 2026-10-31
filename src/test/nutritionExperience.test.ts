import { describe, expect, it } from "vitest";
import { allocationError, defaultAllocation, mealTargets, completeDayAverage, nutrientCoverage, nutritionSource } from "@/lib/nutritionExperience";
import { microsFromOFF } from "@/lib/micronutrients";
import { RESTAURANT_MENU } from "@/data/restaurantMenu";
import { menuChoices, customizedMenu } from "@/lib/restaurantCustomization";

describe("nutrition experience rules", () => {
  it("uses only complete days for the average, not a logged breakfast", () => {
    expect(completeDayAverage([{ key: "2026-10-30", kcal: 2000, complete: true }, { key: "2026-10-31", kcal: 300, complete: false }])).toBe(2000);
    expect(completeDayAverage([{ key: "2026-10-31", kcal: 300, complete: false }])).toBeNull();
  });
  it("keeps missing iron distinct from a known zero", () => {
    expect(microsFromOFF({ iron_100g: 0 }).iron_mg).toBe(0);
    expect(microsFromOFF({}).iron_mg).toBeUndefined();
    expect(nutrientCoverage([{}, {}]).iron_mg).toEqual({ value: null, known: 0, total: 2 });
    expect(nutrientCoverage([{ iron_mg: 0 }, {}]).iron_mg).toEqual({ value: 0, known: 1, total: 2 });
  });
  it("requires both meal allocations to total exactly 100 percent", () => {
    expect(allocationError({ lunch: { kcal: 100, protein: 99 } })).not.toBeNull();
    expect(allocationError({ lunch: { kcal: 100, protein: 100 } })).toBeNull();
    expect(allocationError({ lunch: { kcal: -1, protein: 100 }, dinner: { kcal: 101, protein: 0 } })).not.toBeNull();
  });
  it("keeps meal targets equal to the daily calorie and protein goals with extra slots", () => {
    const a = defaultAllocation(["frukost", "lunch", "middag", "mellanmål", "kvällsmat"]);
    expect(allocationError(a)).toBeNull();
    const targets = Object.values(mealTargets(a, 2000, 101));
    expect(targets.reduce((s, x) => s + x.kcal, 0)).toBe(2000);
    expect(targets.reduce((s, x) => s + x.protein, 0)).toBe(101);
  });
  it("recalculates restaurant menu calories from the selected drink, fries and extras", () => {
    const menu = RESTAURANT_MENU.find((m) => m.n === "Big Mac meny");
    if (!menu) throw new Error("Big Mac menu missing");
    const choices = menuChoices(menu);
    expect(menu.kcal).toBe(1006);
    const zero = customizedMenu(menu, choices.sides[2], choices.drinks[2], null);
    expect(zero.kcal).toBe(838);
    expect(customizedMenu(menu, null, null, null).kcal).toBe(508);
    expect(customizedMenu(menu, choices.sides[3], choices.drinks[2], choices.extras[0]).kcal).toBe(1208);
  });
  it("does not claim unknown provenance is verified", () => {
    expect(nutritionSource({ source: "ai" })).toBe("AI-uppskattat");
    expect(nutritionSource({ source: "food", nutrition_source: "Livsmedelsverket" })).toBe("Livsmedelsverket");
    expect(nutritionSource({ source: "custom_food" })).toContain("ursprung ej angivet");
  });
});