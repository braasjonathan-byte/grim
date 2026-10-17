import { describe, expect, it } from "vitest";
import { ingredientAmountIn, ingredientUnitOptions } from "@/lib/recipeIngredientUnits";

describe("recipe ingredient display units", () => {
  it("converts oats using their density, not water", () => {
    expect(ingredientAmountIn({ name: "Havregryn", amount: 140, unit: "g" }, "dl")).toBe(4);
  });
  it("uses corrected food density for volume measures", () => {
    const ingredient = { name: "Proteinpulver", amount: 100, unit: "g" };
    const food = { density_g_per_dl: 40 };
    expect(ingredientAmountIn(ingredient, "dl", food)).toBe(2.5);
    expect(ingredientAmountIn(ingredient, "msk", food)).toBeCloseTo(100 / 6);
    expect(ingredientAmountIn(ingredient, "tsk", food)).toBe(50);
    expect(ingredient.amount).toBe(100);
  });
  it("uses configured weight per piece", () => {
    expect(ingredientAmountIn({ name: "Ägg", amount: 100, unit: "g" }, "st", { default_piece_weight_g: 50 })).toBe(2);
  });
  it("honors suitable units and retains the saved unit", () => {
    expect(ingredientUnitOptions({ name: "Ägg", amount: 100, unit: "g" }, { suitable_units: ["st"] })).toEqual(["g", "st"]);
  });
  it("does not invent conversions for unknown measures", () => {
    expect(ingredientUnitOptions({ name: "Vitlök", amount: 2, unit: "klyfta" })).toEqual(["klyfta"]);
  });
});