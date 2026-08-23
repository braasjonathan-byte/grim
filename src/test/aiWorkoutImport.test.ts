import { describe, it, expect } from "vitest";
import { buildWorkoutFromAiExercises } from "@/lib/aiWorkoutImport";
describe("ai import", () => {
  it("bygger konditionsövning", () => {
    const r = buildWorkoutFromAiExercises([{ type: "cardio", name: "Cykling", duration_min: 40.5, distance_km: 15.73, speed_kmh: 23.3, watt: 161 }]);
    expect(r.details).toContain("Cykling —");
    const p = JSON.parse(r.loggedWeights["__cond__Cykling"]);
    expect(p.dist).toBe("15.73");
    expect(r.loggedWeights["__cond_done__Cykling"]).toBe("1");
  });
  it("bygger styrkeövning med set", () => {
    const r = buildWorkoutFromAiExercises([{ type: "strength", name: "Bänkpress", sets: [{ reps: 10, kg: 60 }, { reps: 8, kg: 65 }] }]);
    expect(r.details).toBe("Bänkpress 2×10 @ 65 kg");
    expect(JSON.parse(r.loggedWeights["__setdata__Bänkpress"]).length).toBe(2);
  });
});
