import { describe, expect, it } from "vitest";
import { computeWeekProgress } from "@/lib/homeDashboard";

const now = new Date("2026-11-13T10:00:00Z"); // fredag

describe("computeWeekProgress", () => {
  it("räknar bara genomförda pass den här veckan och summerar minuter och km", () => {
    const res = computeWeekProgress(
      [
        { week: 1, day: "Mån", done: true, updated_at: "2026-11-09T17:00:00Z", logged_distance_km: 5, logged_weights: { __cond__Löpning: JSON.stringify({ time: "30", dist: "5" }) } },
        { week: 1, day: "Ons", done: true, updated_at: "2026-11-11T17:00:00Z", logged_weights: {} },
        { week: 0, day: "Sön", done: true, updated_at: "2026-11-01T17:00:00Z", logged_distance_km: 10 },
        { week: 1, day: "Tors", done: false, updated_at: "2026-11-12T17:00:00Z" },
      ],
      (_w, day) => (day === "Ons" ? "Styrka — 45 min" : "Löpning"),
      now,
    );
    // Ons saknar belägg (tom logg) och räknas inte – samma regel som Statistik.
    expect(res).toEqual({ sessions: 1, minutes: 30, km: 5 });
  });
  it("tom vecka ger nollor", () => {
    expect(computeWeekProgress([], () => null, now)).toEqual({ sessions: 0, minutes: 0, km: 0 });
  });
});
