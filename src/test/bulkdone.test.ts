import { describe, it, expect } from "vitest";
import { summarizeCompletion } from "@/lib/workoutSummary";
describe("bulk done", () => {
  it("counts sets and volume", () => {
    const lw = {
      "__sets__Bänkpress": "111",
      "__setdata__Bänkpress": JSON.stringify([{kg:"60",reps:"10"},{kg:"60",reps:"10"},{kg:"60",reps:"8"}]),
      "__sets__Chins": "111",
      "__setdata__Chins": JSON.stringify([{kg:"",reps:"10"},{kg:"",reps:"10"},{kg:"",reps:"10"}]),
    };
    const s = summarizeCompletion(lw as any, undefined, new Date());
    expect(s.sets).toBe(6);
    expect(s.exercises.length).toBe(2);
    expect(s.volumeKg).toBe(1680);
  });
});
