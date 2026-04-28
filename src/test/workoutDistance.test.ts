import { describe, expect, it } from "vitest";
import { getWorkoutDistanceKm, parseMinPerKm } from "@/lib/workoutDistance";

describe("workout distance", () => {
  it("räknar intervallpass som löpdistans även när plantexten bara säger intervall", () => {
    const distance = getWorkoutDistanceKm({
      loggedDistanceKm: null,
      planDetails: "Intervallträning\n6 x 3 min",
      loggedWeights: {
        "__cond__Intervallträning 6 x 3 min": JSON.stringify({
          intervals: Array.from({ length: 6 }, () => ({ time: "3", tempo: "5:00", dist: "" })),
        }),
      },
    });

    expect(distance).toBeCloseTo(3.6, 2);
  });

  it("tolkar svenskt kommatecken i tempo som minuter och sekunder", () => {
    expect(parseMinPerKm("5,30/km")).toBeCloseTo(5.5, 2);
  });

  it("summerar endast klarmarkerade intervall-set in i statistiken", () => {
    const distance = getWorkoutDistanceKm({
      loggedDistanceKm: null,
      planDetails: JSON.stringify({ details: "Intervallträning 6 x 3 min", tempo: "5:00/km" }),
      loggedWeights: {
        "__sets__interval_Intervallträning 6 x 3 min": "101010",
      },
    });

    expect(distance).toBeCloseTo(1.8, 2);
  });
});