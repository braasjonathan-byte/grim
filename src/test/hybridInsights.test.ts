import { describe, it, expect } from "vitest";
import { hybridAnswers } from "@/lib/hybridInsights";
import type { HistorySession } from "@/lib/workoutHistory";
const s = (id: string, date: string, lw: Record<string, unknown>): HistorySession => ({ id, date, day: date, week: 0, name: id, details: "", source: { kind: "active", planIds: [] }, completion: { logged_weights: lw }, exercises: [], setCount: 0, volume: 0, distanceKm: null, tempo: null, pulse: null });
const leg = (id: string, date: string, time?: string) => s(id, date, { __setdata__Knäböj: '[{"kg":"100","reps":"10"}]', __sets__Knäböj: "1", ...(time ? { __first_set_at__: time } : {}) });
const run = (id: string, date: string, minutes = 30, distance = 5) => s(id, date, { __first_set_at__: `${date}T12:00:00Z`, __cond__Löpning: JSON.stringify({ time: String(minutes), dist: String(distance) }), __cond_done__Löpning: "1" });
describe("hybrid evidence", () => {
  it("uses four seven-day UTC periods and checked volume only", () => {
    const unchecked = leg("no", "2026-11-16"); unchecked.completion.logged_weights.__sets__Knäböj = "0";
    const a = hybridAnswers([leg("a", "2026-11-16"), leg("old", "2026-10-19"), unchecked, run("r", "2026-11-16", 30)], "2026-11-16");
    expect(a[0].items).toHaveLength(4);
    expect(a[0].items[3].detail).toContain("1 ton lyft · 30 min kondition · 5 km");
  });
  it("requires three runs in each matched-distance group", () => {
    const rows = [leg("l1", "2026-11-02", "2026-11-02T12:00:00Z"), leg("l2", "2026-11-06", "2026-11-06T12:00:00Z"), leg("l3", "2026-11-10", "2026-11-10T12:00:00Z"), run("a1", "2026-11-04", 30), run("a2", "2026-11-08", 30), run("a3", "2026-11-12", 30), run("b1", "2026-10-20", 25), run("b2", "2026-10-24", 25), run("b3", "2026-10-28", 25)];
    expect(hybridAnswers(rows, "2026-11-16")[1].items[0].detail).toContain("6 min/km");
    expect(hybridAnswers(rows.slice(0, -1), "2026-11-16")[1].items[0].title).toBe("För lite underlag");
    rows[5] = run("different", "2026-11-12", 30, 10);
    expect(hybridAnswers(rows, "2026-11-16")[1].items[0].title).toBe("För lite underlag");
  });
  it("does not infer 48-hour exposure from date-only leg sessions", () => {
    const rows = [leg("l", "2026-11-10"), run("a", "2026-11-11")];
    expect(hybridAnswers(rows, "2026-11-16")[1].items[0].title).toBe("För lite underlag");
  });
});