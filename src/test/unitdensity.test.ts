import { gramsForFood } from "@/lib/nutritionCalc";
import { it, expect } from "vitest";
it("d", () => {
  for (const n of ["Havregryn Garant","Havremjölk","Mjölk 3%","Vetemjöl","Ris basmati okokt","Cornflakes","Olivolja","Ägg","Banan","Okänd"]) console.log(n, gramsForFood(1,"dl",n), gramsForFood(1,"st",n));
  expect(gramsForFood(3,"dl","Havregryn Garant")).toBeCloseTo(105);
});
