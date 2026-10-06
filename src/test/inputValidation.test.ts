import { describe, it, expect } from "vitest";
import { parseDecimal, validateNumber, isPlausibleSet, toStorageString, formatDecimal, kcalDeviation } from "@/lib/inputValidation";

describe("inputValidation", () => {
  it("tolkar decimalkomma och punkt", () => {
    expect(parseDecimal("82,5")).toBe(82.5);
    expect(parseDecimal("82.5")).toBe(82.5);
    expect(toStorageString("82,5")).toBe("82.5");
    expect(formatDecimal("82.5")).toBe("82,5");
  });
  it("avvisar ogiltiga värden med svenska fel", () => {
    expect(validateNumber("99999", "setKg").error).toBe("Ange ett tal mellan 0 och 500 kg.");
    expect(validateNumber("-5", "setKg").error).toBe("Negativa värden går inte att spara.");
    expect(validateNumber("abc", "setKg").error).toMatch(/Ange ett tal/);
    expect(validateNumber("-100", "foodGrams").error).toBe("Negativa värden går inte att spara.");
    expect(validateNumber("0", "foodGrams").error).not.toBeNull();
    expect(validateNumber("", "foodGrams").error).not.toBeNull();
    expect(validateNumber("-500", "goalKcal").error).not.toBeNull();
    expect(validateNumber("", "goalFiber").error).toBeNull();
    expect(validateNumber("82,5", "setKg").value).toBe(82.5);
  });
  it("märker orimliga set", () => {
    expect(isPlausibleSet("99999", "5")).toBe(false);
    expect(isPlausibleSet("82.5", "8")).toBe(true);
  });
  it("kcal mot makron", () => {
    expect(kcalDeviation(50, 50, 0, 10)).toBeGreaterThan(0.2);
  });
});
