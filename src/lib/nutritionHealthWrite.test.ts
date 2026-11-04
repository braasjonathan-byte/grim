import { describe, it, expect } from "vitest";
import { buildNutritionExport } from "./nutritionHealthWrite";

describe("buildNutritionExport", () => {
  it("summerar per dag och måltid, stabil version", () => {
    const rows = [
      { log_date: "2026-11-04", meal_type: "Lunch", kcal: 400, protein_g: 30, fat_g: 10, carbs_g: 40, fiber_g: 5, sugar_g: null },
      { log_date: "2026-11-04", meal_type: "lunch", kcal: 100.4, protein_g: 5, fat_g: 1, carbs_g: 10, fiber_g: null, sugar_g: 2 },
    ];
    const a = buildNutritionExport(rows, [{ log_date: "2026-11-04", amount_ml: 1500 }, { log_date: "2026-11-03", amount_ml: 0 }]);
    expect(a.meals).toHaveLength(1);
    expect(a.meals[0]).toMatchObject({ clientRecordId: "grim-nutr-2026-11-04-lunch", kcal: 500, protein: 35 });
    expect(a.water).toHaveLength(1);
    expect(buildNutritionExport(rows, []).meals[0].version).toBe(a.meals[0].version);
  });
});
