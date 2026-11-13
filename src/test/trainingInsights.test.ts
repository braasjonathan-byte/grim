import { describe, expect, it } from "vitest";
import { trainingInsights } from "@/lib/trainingInsights";
import type { HistorySession } from "@/lib/workoutHistory";
const session = (id: string, date: string, kg: number, name = "Bänkpress", marks = "1"): HistorySession => ({ id, date, source: { kind: "active", planIds: [] }, week: 0, day: date, name, details: "", completion: { logged_weights: { [`__setdata__${name}`]: JSON.stringify([{ kg: String(kg), reps: "10" }]), [`__sets__${name}`]: marks } }, exercises: [], setCount: 1, volume: kg * 10, distanceKm: null, tempo: null, pulse: null });
describe("Measured training insights", () => {
  it("compares identical exercise and rep layouts using counted volume", () => {
    expect(trainingInsights([session("a", "2026-11-13", 60), session("b", "2026-11-10", 50)])[0].title).toBe("20 % mer lyft");
  });
  it("does not credit a different exercise", () => {
    expect(trainingInsights([session("a", "2026-11-13", 60), session("b", "2026-11-10", 50, "Knäböj")])).toHaveLength(1);
  });
  it("does not count unchecked sets for improvement", () => {
    expect(trainingInsights([session("a", "2026-11-13", 60, "Bänkpress", "0"), session("b", "2026-11-10", 50)])).toHaveLength(1);
  });
  it("counts multiple sessions on one date as one training day", () => {
    expect(trainingInsights([session("a", "2026-11-13", 60), session("b", "2026-11-13", 50)])[0].title).toBe("1 träningsdagar registrerade");
  });
});