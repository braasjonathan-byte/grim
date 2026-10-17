import { describe, expect, it } from "vitest";
import { offFood } from "../../supabase/functions/_shared/offProduct";
import { searchFoods } from "@/lib/foodSearch";

describe("barcode and text search product parity", () => {
  it("keeps protein powder with incomplete macros searchable", () => {
    const food = offFood({ product_name_sv: "Protein vassle Cortado", brands: "Tyngre", nutriments: { "energy-kcal_100g": 386, proteins_100g: 77 } });
    expect(food?.kcal).toBe(386);
    expect(food?.protein_g).toBe(77);
    expect(food?.fat_g).toBe(0);
    expect(searchFoods(food ? [{ ...food, source: "off" }] : [], "proteinpulver")).toHaveLength(1);
  });
  it("keeps zero-calorie products found by barcode", () => {
    expect(offFood({ product_name: "Zero dryck", nutriments: { "energy-kcal_100g": 0 } })?.kcal).toBe(0);
  });
  it("uses generic names and brands just like barcode lookup", () => {
    expect(offFood({ generic_name_sv: "Vassleprotein", brands: "Tyngre, Annat" })?.name).toBe("Vassleprotein (Tyngre)");
  });
});