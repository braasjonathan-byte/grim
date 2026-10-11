import { describe, it, expect } from "vitest";
import { formatPaceDisplay, resolveTempoDisplay } from "@/lib/cardioUnits";

describe("snitttempo efter löpning", () => {
  it("visar min/km från tid och distans, inte km/h", () => {
    // 63 min på 10,3 km = 6:07/km. Det sparade värdet "9.7" är hastigheten i km/h.
    expect(resolveTempoDisplay("minkm", "63", 10.3, "9.7")).toBe("6:07");
  });

  it("räknar om tempo även när det sparade värdet är ett giltigt klockslag", () => {
    expect(resolveTempoDisplay("minkm", "50", "7.5", "5:00")).toBe("6:40");
  });

  it("faller tillbaka på sparat värde när tid eller distans saknas", () => {
    expect(resolveTempoDisplay("minkm", "", Number.NaN, "5:30")).toBe("5:30");
    expect(resolveTempoDisplay("minkm", "63", Number.NaN, "6:07")).toBe("6:07");
  });

  it("rör inte hastighet, effekt eller andra enheter", () => {
    expect(resolveTempoDisplay("kmh", "63", 10.3, "9.7")).toBe("9.7");
    expect(resolveTempoDisplay("watt", "63", 10.3, "180")).toBe("180");
  });

  it("använder enheten för simning och rodd (min/100m, min/500m)", () => {
    // 60 min på 2 000 m = 3:00/100m
    expect(resolveTempoDisplay("min100m", "60", 2, "")).toBe("3:00");
    // 30 min på 5 000 m = 3:00/500m
    expect(resolveTempoDisplay("min500m", "30", 5, "")).toBe("3:00");
  });
});

describe("ogiltiga klockslag räknas om", () => {
  it("tolkar decimalminuter rätt", () => {
    expect(formatPaceDisplay("9.7", "minkm")).toBe("9:42");
    expect(formatPaceDisplay("9,7", "minkm")).toBe("9:42");
  });

  it("normaliserar sekunder över 59", () => {
    expect(formatPaceDisplay("9:70", "minkm")).toBe("10:10");
  });

  it("behåller giltiga tempovärden", () => {
    expect(formatPaceDisplay("5.47", "minkm")).toBe("5:47");
    expect(formatPaceDisplay("5:07", "minkm")).toBe("5:07");
    expect(formatPaceDisplay("6", "minkm")).toBe("6:00");
  });
});
