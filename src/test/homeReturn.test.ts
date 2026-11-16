import { describe, expect, it } from "vitest";
import { homeReturnSummary, nextPlannedWorkout } from "@/lib/homeReturn";
import type { HistorySession } from "@/lib/workoutHistory";

const plan = (week: number, day: string, details = "Bänkpress 3 × 10") => ({ week, day, details, session_name: "Styrka" });
const session = (id: string, date: string, kg = 50): HistorySession => ({ id, date, source: { kind: "active", planIds: [] }, week: 0, day: date, name: "Styrka", details: "", completion: { logged_weights: { __setdata__Bänkpress: JSON.stringify([{ kg: String(kg), reps: "10" }]), __sets__Bänkpress: "1" } }, exercises: [], setCount: 1, volume: kg * 10, distanceKm: null, tempo: null, pulse: null });

describe("Home return evidence", () => {
  it("includes today and crosses a calibrated plan week", () => {
    expect(nextPlannedWorkout([plan(1, "Mån"), plan(2, "Mån")], [], "2026-11-09", "2026-11-16")?.week).toBe(2);
  });
  it("excludes completed and skipped exact slots, but keeps another workout on that day", () => {
    expect(nextPlannedWorkout([plan(2, "Mån_a"), plan(2, "Mån_b"), plan(2, "Mån_c")], [{ week: 2, day: "Mån_a", done: true }, { week: 2, day: "Mån_b", skipped: true }], "2026-11-09", "2026-11-16")?.day).toBe("Mån_c");
  });
  it("includes dated single workouts, excludes rest and past workouts", () => {
    expect(nextPlannedWorkout([plan(0, "2026-11-15_a"), plan(0, "2026-11-16_a", "Vila"), plan(0, "2026-11-17_a")], [], null, "2026-11-16")?.date).toBe("2026-11-17");
  });
  it("does not invent a schedule without calibration", () => {
    expect(nextPlannedWorkout([plan(1, "Mån")], [], null, "2026-11-16")).toBeNull();
  });
  it("counts seven UTC dates, unique sessions and training days including archives", () => {
    const archived = { ...session("archive", "2026-11-10"), source: { kind: "archive" as const, archiveId: "a", index: 0, archivedAt: "2026-11-16" } };
    const result = homeReturnSummary([archived, archived, session("a", "2026-11-16"), session("b", "2026-11-16"), session("c", "2026-11-09"), session("d", "2026-11-03"), session("old", "2026-11-02"), session("future", "2026-11-17")], "2026-11-16");
    expect(result.sessions).toBe(3);
    expect(result.days).toBe(2);
    expect(result.previousSessions).toBe(2);
  });
  it("only reports comparisons with a newest measurement in the current seven days", () => {
    expect(homeReturnSummary([session("a", "2026-11-09", 60), session("b", "2026-11-03", 50)], "2026-11-16").insight).toBeNull();
    expect(homeReturnSummary([session("a", "2026-11-16", 60), session("b", "2026-11-09", 50)], "2026-11-16").insight?.title).toBe("20 % mer lyft");
  });
});