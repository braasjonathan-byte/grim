import { describe, expect, it } from "vitest";
import { parsePlanCardioForExercise } from "@/lib/workoutIntervalUtils";
import { getCardioModes, getCardioDistUnit } from "@/lib/cardioUnits";

describe("simloggning", () => {
  it("simning har bara meter och min/100m", () => {
    expect(getCardioModes("Simning")).toEqual(["min100m"]);
    expect(getCardioDistUnit("Simning")).toBe("m");
  });

  it("planens 1500m blir 1500 i simningens meterfält, inte tomt", () => {
    const r = parsePlanCardioForExercise("Simning", "30 min / 1500m");
    expect(r.dist).toBe("1500");
    expect(r.time).toBe("30");
    expect(r.tempo).toBe("2:00");
  });

  it("planens 1,5 km blir 1500 m för simning (inte 1.5 m)", () => {
    expect(parsePlanCardioForExercise("Simning", "1,5 km").dist).toBe("1500");
  });

  it("tempo /100m i planen ger tid och distans", () => {
    const r = parsePlanCardioForExercise("Simning", "1000m 1:45/100m");
    expect(r.dist).toBe("1000");
    expect(r.tempo).toBe("1:45");
    expect(r.time).toBe("17.5");
  });

  it("löpning beter sig som förut (km och min/km)", () => {
    const r = parsePlanCardioForExercise("Löpning", "30 min 5 km 150 bpm");
    expect(r).toEqual({ time: "30", dist: "5", tempo: "6:00", pulse: "150" });
  });
});
