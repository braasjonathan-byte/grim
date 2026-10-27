import { describe, it, expect } from "vitest";
import { importedKeysFromRows, healthWorkoutDayKey, hasRemainingExercise } from "@/lib/healthWorkoutImport";
const w = (key: string) => ({ key, start: "2026-10-27T10:00:00", label: "Promenad" } as any);
describe("importerat-markering", () => {
  it("räknar pass med övning som importerat", () => {
    expect(importedKeysFromRows([{ day: "Tis_hca1", details: "Promenad 30 min" }], [w("a1")]).has(healthWorkoutDayKey(w("a1")))).toBe(true);
  });
  it("tom rad efter borttagen övning => Importera igen", () => {
    expect(importedKeysFromRows([{ day: "Tis_hca1", details: "" }], [w("a1")]).size).toBe(0);
    expect(hasRemainingExercise(" \n ")).toBe(false);
  });
  it("borttagen rad => Importera igen", () => {
    expect(importedKeysFromRows([], [w("a1")]).size).toBe(0);
  });
});
