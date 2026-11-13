import { describe, expect, it } from "vitest";
import { insightAnswers, trainingInsights, weightInsight } from "@/lib/trainingInsights";
import type { HistorySession } from "@/lib/workoutHistory";
const session = (id: string, date: string, kg: number, name = "Bänkpress", marks = "1"): HistorySession => ({ id, date, source: { kind: "active", planIds: [] }, week: 0, day: date, name, details: "", completion: { logged_weights: { [`__setdata__${name}`]: JSON.stringify([{ kg: String(kg), reps: "10" }]), [`__sets__${name}`]: marks } }, exercises: [], setCount: 1, volume: kg * 10, distanceKm: null, tempo: null, pulse: null });
describe("Measured training insights", () => {
  it("bounds regularity to 28 days and counts unique training dates", () => {
    const answers = insightAnswers([session("a", "2026-11-13", 60), session("b", "2026-11-13", 50), session("c", "2026-10-16", 50), session("d", "2026-11-14", 50)], [], "2026-11-13");
    expect(answers[0].items[0].detail).toContain("2 genomförda pass, 1 träningsdagar");
    expect(answers[0].items[0].detail).toContain("0 / 0 / 0 / 1");
  });
  it("does not compare results or weights older than 90 days", () => {
    const answers = insightAnswers([session("a", "2026-11-13", 60), session("b", "2026-08-15", 50)], [{ log_date: "2026-08-15", weight_kg: 100 }, { log_date: "2026-11-13", weight_kg: 99 }], "2026-11-13");
    expect(answers[1].items[0].kind).toBeUndefined();
    expect(answers[2].items[0].kind).toBeUndefined();
  });
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
  it("compares cardio only at the same distance and exercise", () => {
    const a = session("a", "2026-11-13", 0, "unused", "0"), b = session("b", "2026-11-10", 0, "unused", "0");
    a.completion.logged_weights = { __cond__Löpning: JSON.stringify({ time: "25", dist: "5" }), __cond_done__Löpning: "1" };
    b.completion.logged_weights = { __cond__Löpning: JSON.stringify({ time: "30", dist: "5" }), __cond_done__Löpning: "1" };
    expect(trainingInsights([a, b])[0].title).toBe("Löpning: 5 min snabbare");
    b.completion.logged_weights = { __cond__Cykling: JSON.stringify({ time: "30", dist: "5" }), __cond_done__Cykling: "1" };
    expect(trainingInsights([a, b])).toHaveLength(1);
  });
  it("reports actual weighed change, not a projected weight", () => {
    expect(weightInsight([{ log_date: "2026-11-01", weight_kg: 100 }, { log_date: "2026-11-13", weight_kg: 99 }])?.title).toBe("Vikt: −1 kg");
  });
});