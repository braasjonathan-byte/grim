import { describe, expect, it } from "vitest";
import { getWorkoutDistanceKm } from "@/lib/workoutDistance";

describe("treadmill", () => {
  it("räknar löpband-distans till löpning", () => {
    const d = getWorkoutDistanceKm({
      loggedDistanceKm: null,
      planDetails: "Bänkpress — 3×8\nLöpband (Life Fitness) — 30 min, 5 km, 5:00/km",
      loggedWeights: {
        "__cond__Löpband (Life Fitness)": JSON.stringify({ time: "30", dist: "5", tempo: "5:00" })
      }
    });
    expect(d).toBeCloseTo(5, 2);
  });
});
