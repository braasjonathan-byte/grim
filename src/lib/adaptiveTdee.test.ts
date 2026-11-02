import { describe, it, expect } from "vitest";
import { computeAdaptiveTdee, adaptiveTarget } from "./adaptiveTdee";

const day = (i: number) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);

describe("adaptiveTdee", () => {
  it("skattar TDEE från intag och viktnedgång", () => {
    const intake: Record<string, number> = {};
    for (let i = 0; i < 28; i++) intake[day(i)] = 2000;
    // −0,5 kg/vecka ≈ −550 kcal/dag → TDEE ≈ 2550
    const weights = [0, 7, 14, 21, 27].map((i) => ({ date: day(i), kg: 80 - (0.5 * i) / 7 }));
    const r = computeAdaptiveTdee(weights, intake);
    expect(r.ok).toBe(true);
    expect(r.tdee).toBeGreaterThan(2500);
    expect(r.tdee).toBeLessThan(2600);
    expect(r.kgPerWeek).toBeCloseTo(-0.5, 1);
  });
  it("kräver tillräckligt med data", () => {
    const r = computeAdaptiveTdee([{ date: day(0), kg: 80 }], { [day(0)]: 2000 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Logga kost/);
  });
  it("ignorerar ofullständiga dagar", () => {
    const intake: Record<string, number> = {};
    for (let i = 0; i < 20; i++) intake[day(i)] = i % 2 ? 300 : 2200;
    expect(computeAdaptiveTdee([], intake).intakeDays).toBe(10);
  });
  it("målet följer veckotakt", () => {
    expect(adaptiveTarget(2500, "lose_slow", 0.5)).toBe(1950);
    expect(adaptiveTarget(2500, "maintain", null)).toBe(2500);
  });
});
