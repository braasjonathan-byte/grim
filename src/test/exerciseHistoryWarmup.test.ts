import { describe, expect, it } from "vitest";
import { safelyParseSets } from "@/components/ExerciseHistoryPanel";
import { isPlausibleSet } from "@/lib/inputValidation";

describe("ExerciseHistoryPanel uppvärmningsset", () => {
  const weights = { "__setdata__Knäböj": [{ kg: 40, reps: 8 }, { kg: 100, reps: 5 }], "__settypes__Knäböj": "wwn" };

  it("märker uppvärmningsset som warmup, inte som orimliga", () => {
    const sets = safelyParseSets(weights["__setdata__Knäböj"], weights["__settypes__Knäböj"]);
    expect(sets[0].warmup).toBe(true);
    expect(sets[0].implausible).toBe(false);
    expect(sets[1].warmup).toBe(false);
    expect(sets[1].implausible).toBe(false);
  });

  it("exkluderar uppvärmning ur topp och volym", () => {
    const sets = safelyParseSets(weights["__setdata__Knäböj"], weights["__settypes__Knäböj"]);
    const counted = sets.filter((s) => !s.implausible && !s.warmup);
    expect(Math.max(0, ...counted.map((s) => s.kg))).toBe(100);
    expect(counted.reduce((sum, s) => sum + s.kg * s.reps, 0)).toBe(500);
  });

  it("riktigt orimliga set får fortfarande felmärket", () => {
    const bad = safelyParseSets([{ kg: 9999, reps: 5 }], "n");
    expect(bad[0].implausible).toBe(true);
    expect(isPlausibleSet(9999, 5)).toBe(false);
  });
});
