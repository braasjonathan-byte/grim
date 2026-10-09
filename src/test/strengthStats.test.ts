import { describe, it, expect } from "vitest";
import { computeStrengthStats, dotsScore, epley1RM, epleyWeightForReps } from "@/lib/strengthStats";

const sets = (n: number, kg: number, reps: number) => JSON.stringify(Array.from({ length: n }, () => ({ kg: String(kg), reps: String(reps) })));
describe("strengthStats", () => {
  it("SBD 450 från 5×5@140, 3×3@110, 1×1@200", () => {
    const lw = {
      __setdata__Knäböj: sets(5, 140, 5), __sets__Knäböj: "11111",
      __setdata__Bänkpress: sets(3, 110, 3), __sets__Bänkpress: "111",
      __setdata__Marklyft: sets(1, 200, 1), __sets__Marklyft: "1",
    };
    const r = computeStrengthStats([{ logged_weights: lw, date: new Date("2026-10-05") }]);
    expect(r.sbdTotal).toBe(450);
    expect(Object.keys(r.best).length).toBe(3);
    expect(r.weeks[0].tonnage.squat).toBe(3500);
  });
  it("Epley och omvänd", () => {
    expect(Math.round(epley1RM(100, 5))).toBe(117);
    expect(Math.round(epleyWeightForReps(epley1RM(100, 5), 5))).toBe(100);
  });
  it("DOTS", () => {
    expect(dotsScore(450, 80, "man")).toBeGreaterThan(300);
    expect(dotsScore(450, 0, "man")).toBeNull();
  });
});
