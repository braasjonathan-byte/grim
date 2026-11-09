import { describe, it, expect } from "vitest";
import { computeWeeklySummary, mondayOf, pctChange, prsInRange } from "@/lib/weeklySummary";

const lw = (name: string, sets: [number, number][]) => ({
  [`__setdata__${name}`]: JSON.stringify(sets.map(([kg, reps]) => ({ kg: String(kg), reps: String(reps) }))),
  [`__sets__${name}`]: "1".repeat(sets.length),
});
const d = (s: string) => new Date(`${s}T12:00:00`);

describe("weeklySummary", () => {
  it("mondayOf hittar måndagen", () => {
    expect(mondayOf(d("2026-11-09")).getDate()).toBe(9); // måndag
    expect(mondayOf(d("2026-11-15")).getDate()).toBe(9); // söndag
  });

  it("räknar pass, volym och jämför med förra veckan", () => {
    const comps = [
      { date: d("2026-11-03"), logged_weights: lw("Bänkpress", [[80, 5]]) },
      { date: d("2026-11-10"), logged_weights: lw("Bänkpress", [[85, 5], [80, 5]]) },
      { date: d("2026-11-11"), logged_weights: lw("Knäböj", [[100, 5]]) },
    ];
    const s = computeWeeklySummary(comps, [], [], d("2026-11-12"));
    expect(s.weekStart).toBe("2026-11-09");
    expect(s.current.sessions).toBe(2);
    expect(s.current.volumeKg).toBe(85 * 5 + 80 * 5 + 500);
    expect(s.previous.sessions).toBe(1);
    expect(s.current.prs.map((p) => p.exercise)).toEqual(["Bänkpress"]); // knäböj första gången räknas ej
  });

  it("e1RM-rekord räknas på reps också", () => {
    const comps = [
      { date: d("2026-11-02"), logged_weights: lw("Marklyft", [[140, 3]]) },
      { date: d("2026-11-10"), logged_weights: lw("Marklyft", [[140, 5]]) },
    ];
    const prs = prsInRange(comps, d("2026-11-09"), d("2026-11-16"));
    expect(prs).toHaveLength(1);
    expect(prs[0].e1rm).toBeGreaterThan(prs[0].previous);
  });

  it("kost- och viktsnitt", () => {
    const meals = [
      { log_date: "2026-11-09", kcal: 2000, protein_g: 150 },
      { log_date: "2026-11-10", kcal: 2400, protein_g: 170 },
      { log_date: "2026-11-11", kcal: 100, protein_g: 5 }, // för lite – räknas ej
      { log_date: "2026-11-02", kcal: 2600, protein_g: 120 },
    ];
    const weights = [
      { log_date: "2026-11-03", weight_kg: 81 },
      { log_date: "2026-11-10", weight_kg: 80 },
      { log_date: "2026-11-12", weight_kg: 79.6 },
    ];
    const s = computeWeeklySummary([], meals, weights, d("2026-11-12"));
    expect(s.current.avgKcal).toBe(2200);
    expect(s.current.loggedDays).toBe(2);
    expect(s.previous.avgKcal).toBe(2600);
    expect(s.current.avgWeightKg).toBeCloseTo(79.8);
    expect(s.previous.avgWeightKg).toBe(81);
  });

  it("pctChange", () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(5, 0)).toBeNull();
  });
});
