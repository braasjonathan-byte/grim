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

describe("ai import – robusta fält", () => {
  it("tolkar tid som hh:mm:ss, puls och höjdmeter", () => {
    const r = buildWorkoutFromAiExercises([
      { type: "cardio", name: "Cykling", duration: "1:02:15", distance_km: 20, average_heartrate: 148, elevation_gain_m: 211 } as any,
    ]);
    const p = JSON.parse(r.loggedWeights["__cond__Cykling"]);
    expect(Number(p.time)).toBeCloseTo(62.25, 1);
    expect(p.pulse).toBe("148");
    expect(p.elev).toBe("211");
    expect(p.tempo).toBeTruthy();
  });
  it("tolkar '40 min 31 s'", () => {
    const r = buildWorkoutFromAiExercises([{ type: "cardio", name: "Löpning", duration: "40 min 31 s", distance_km: 8 } as any]);
    const p = JSON.parse(r.loggedWeights["__cond__Löpning"]);
    expect(Number(p.time)).toBeCloseTo(40.52, 1);
  });
});
