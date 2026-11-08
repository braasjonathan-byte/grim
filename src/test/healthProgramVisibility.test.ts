import { describe, it, expect } from "vitest";
import { getProgramWeekPlans, getWorkoutDisplayDay, isWorkoutDayDone } from "@/lib/healthProgramVisibility";
const today = "2026-11-08";
const hc = { week: 0, day: "2026-11-08_hcabc" };
const base = { week: 4, day: "Sön" };
describe("standalone HC visibility in program mode", () => {
  it("shows today's fallback in the active clamped week, but not another week or date", () => {
    const rows = [base, hc, { week: 0, day: "2026-11-07_hcold" }, { week: 0, day: "2026-11-08_manual" }];
    expect(getProgramWeekPlans(rows, 4, 4, today)).toEqual([base, hc]);
    expect(getProgramWeekPlans(rows, 3, 4, today)).toEqual([]);
    expect(getWorkoutDisplayDay(hc)).toBe("Sön");
    expect(hc.day).toBe("2026-11-08_hcabc");
  });
  it("marks a tab done if a matching HC row is done even if the base row is not", () => {
    expect(isWorkoutDayDone([base, hc], { "0-2026-11-08_hcabc": { done: true } }, "Sön")).toBe(true);
    expect(isWorkoutDayDone([base, hc], { "0-2026-11-08_hcabc": { done: true } }, "Lör")).toBe(false);
    expect(isWorkoutDayDone([base, hc], {}, "Sön")).toBe(false);
  });
});
