import { describe, it, expect } from "vitest";
import { getWeightComparison, formatTons } from "@/lib/weightComparisons";

describe("weightComparisons", () => {
  it("väljer största posten <= värdet", () => {
    expect(getWeightComparison(0.2)).toBe("");
    expect(getWeightComparison(0.6)).toBe("en häst 🐴");
    expect(getWeightComparison(6)).toBe("en afrikansk elefant 🐘");
    expect(getWeightComparison(5.9)).toBe("en noshörning 🦏");
    expect(getWeightComparison(100000)).toBe("Titanic 🚢");
  });
  it("svensk decimal", () => {
    expect(formatTons(0.6)).toBe("0,6");
  });
});
