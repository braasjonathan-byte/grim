import { describe, it, expect } from "vitest";
import { computeReadiness } from "./readiness";

const d = (day: string, o: Partial<{ r: number; s: number; a: number }>) => ({ day, steps: 0, activeCalories: o.a ?? 0, sleepMinutes: o.s ?? 0, restingHeartRate: o.r ?? null });

describe("computeReadiness", () => {
  it("null utan tillräckligt med signaler", () => {
    expect(computeReadiness([d("2026-11-02", { s: 480 })], "2026-11-02")).toBeNull();
  });
  it("Ta det lugnt vid hög vilopuls och kort sömn", () => {
    const days = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"].map((x) => d(x, { r: 50, a: 400 }));
    days.push(d("2026-11-02", { r: 58, s: 300 }));
    expect(computeReadiness(days, "2026-11-02")?.label).toBe("Ta det lugnt");
  });
  it("Kör tungt vid låg vilopuls och bra sömn", () => {
    const days = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"].map((x) => d(x, { r: 52, a: 400 }));
    days.push(d("2026-11-02", { r: 50, s: 480 }));
    expect(computeReadiness(days, "2026-11-02")?.label).toBe("Kör tungt");
  });
});
