import { describe, expect, it } from "vitest";
import { scanPick, type ScanRow } from "./foodScan";
import { bestFoodMatch } from "../../supabase/functions/nutrition-ai-scan/matching";

const row: ScanRow = { source: "livsmedelsverket", selected: true, grams: "160", portion_g: 160, food: { id: "real-id", name: "Kycklingfilé stekt", kcal: 165, protein_g: 30, fat_g: 4, carbs_g: 0 } };
describe("photo meal review", () => {
  it("scales only the edited ingredient, accepting decimal comma", () => {
    const edited = scanPick({ ...row, grams: "80,5" }, 0);
    expect(edited).toMatchObject({ amount: 80.5, id: "real-id" });
    expect(edited?.kcal).toBeCloseTo(132.825, 6);
    expect(edited?.protein_g).toBeCloseTo(24.15, 6);
    expect(scanPick(row, 0)?.kcal).toBe(264);
  });
  it("rejects invalid portions rather than silently logging zero", () => {
    for (const grams of ["", "0", "-1", "5001", "abc"]) expect(scanPick({ ...row, grams }, 0)).toBeNull();
  });
  it("rejects invalid AI nutrition", () => {
    expect(scanPick({ ...row, food: { ...row.food, kcal: NaN } }, 0)).toBeNull();
    expect(scanPick({ ...row, food: { ...row.food, protein_g: 101 } }, 0)).toBeNull();
  });
  it("matches ingredient and preparation, not an unrelated shared word", () => {
    const foods = [{ name: "Sidfläsk stekt" }, { name: "Kycklingfilé rå" }, { name: "Kycklingfilé stekt" }];
    expect(bestFoodMatch("kycklingfilé stekt", foods)).toEqual(foods[2]);
    expect(bestFoodMatch("kycklingfilé kokt", foods)).toBeNull();
  });
  it("does not choose among equally plausible alternatives", () => {
    expect(bestFoodMatch("ris kokt", [{ name: "Ris kokt salt" }, { name: "Ris kokt osaltat" }])).toBeNull();
  });
});