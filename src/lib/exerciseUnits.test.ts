import { describe, expect, it } from "vitest";
import { resolveExerciseWeightMode, type UnitOverride } from "./exerciseUnits";

describe("resolveExerciseWeightMode", () => {
  it("enables weighted bodyweight (+/- kg) by default for Pull-Ups and Dips", () => {
    const empty = new Map<string, UnitOverride>();
    expect(resolveExerciseWeightMode("Pull-Ups", empty)).toEqual({ isBodyweight: false, isWeightedBw: true });
    expect(resolveExerciseWeightMode("Dips", empty)).toEqual({ isBodyweight: false, isWeightedBw: true });
  });

  it("keeps pure bodyweight exercises without kg input by default", () => {
    const empty = new Map<string, UnitOverride>();
    expect(resolveExerciseWeightMode("Armhävningar", empty)).toEqual({ isBodyweight: true, isWeightedBw: false });
  });

  it("allows admin to enable weighted bodyweight (+/- kg) on any exercise", () => {
    const overrides = new Map<string, UnitOverride>([
      ["armhävningar", { exercise_name: "Armhävningar", unit: null, bodyweight: null, weighted_bodyweight: true }],
    ]);
    expect(resolveExerciseWeightMode("Armhävningar", overrides)).toEqual({ isBodyweight: false, isWeightedBw: true });
  });

  it("allows admin to disable weighted bodyweight (+/- kg) on Pull-Ups", () => {
    const overrides = new Map<string, UnitOverride>([
      ["pull-ups", { exercise_name: "Pull-Ups", unit: null, bodyweight: true, weighted_bodyweight: false }],
    ]);
    expect(resolveExerciseWeightMode("Pull-Ups", overrides)).toEqual({ isBodyweight: true, isWeightedBw: false });
  });
});