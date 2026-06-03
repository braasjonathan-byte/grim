import { describe, expect, it } from "vitest";
import { getWorkoutDistanceByCategory, getWorkoutDistanceKm } from "@/lib/workoutDistance";

describe("treadmill → löpning", () => {
  it("löpband i blandat pass räknas som löpning, inte cykling", () => {
    const args = {
      loggedDistanceKm: null,
      planDetails: JSON.stringify({
        details: "Motioncykel — 30 min\nLöpband (Precor) — 30 min, 6.35/km, 4.56 km",
        tempo: "",
      }),
      loggedWeights: {
        "__cond__Motioncykel": JSON.stringify({ time: "30" }),
        "__cond__Löpband (Precor)": JSON.stringify({ time: "30", dist: "4.56", tempo: "6.35" }),
      },
    };
    const breakdown = getWorkoutDistanceByCategory(args);
    expect(breakdown.löpning).toBeCloseTo(4.56, 2);
    expect(breakdown.cykling ?? 0).toBe(0);
    // Total fortsatt 4.56
    expect(getWorkoutDistanceKm(args)).toBeCloseTo(4.56, 2);
  });

  it("rent löpbandspass i ett 'Vila / promenad'-pass räknas som löpning", () => {
    const breakdown = getWorkoutDistanceByCategory({
      loggedDistanceKm: null,
      planDetails: JSON.stringify({
        details: "Löpband (Life Fitness) — 17 min, 5:40/km, 3 km\nIso-Lateral Bench Press — 3×10 @ 30 kg",
        tempo: "",
      }),
      loggedWeights: {
        "__cond__Löpband (Life Fitness)": JSON.stringify({ time: "17", dist: "3", tempo: "5:40" }),
      },
    });
    expect(breakdown.löpning).toBeCloseTo(3, 2);
  });
});
