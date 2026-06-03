import { describe, expect, it } from "vitest";
import { getCardioCategory } from "@/lib/cardioVisibility";
import { getWorkoutDistanceKm } from "@/lib/workoutDistance";

describe("treadmill cat", () => {
  it("löpband endast i details", () => {
    const txt = "Bänkpress — 3×8; Löpband (Life Fitness) — 30 min, 5 km";
    expect(getCardioCategory(txt)).toBe("löpning");
  });
  it("löpband med ; separator", () => {
    const d = getWorkoutDistanceKm({
      loggedDistanceKm: null,
      planDetails: "Bänkpress — 3×8; Löpband (Life Fitness) — 30 min, 5 km, 5:00/km",
      loggedWeights: { "__cond__Löpband (Life Fitness)": JSON.stringify({ time: "30", dist: "5", tempo: "5:00" }) }
    });
    expect(d).toBeCloseTo(5, 2);
  });
  it("löpband utan __cond__ men med distance i details", () => {
    const d = getWorkoutDistanceKm({
      loggedDistanceKm: null,
      planDetails: "Löpband (Life Fitness) — 5 km",
      loggedWeights: null
    });
    expect(d).toBeCloseTo(5, 2);
  });
});
