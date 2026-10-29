import { describe, expect, it } from "vitest";
import { restingHrSignal } from "@/lib/restingHr";
const d = (day: string, r: number | null) => ({ day, steps: 0, activeCalories: 0, sleepMinutes: 0, restingHeartRate: r });
describe("restingHrSignal", () => {
  it("flaggar +5 över snitt", () => {
    const s = restingHrSignal([d("2026-10-25", 50), d("2026-10-26", 52), d("2026-10-27", 51), d("2026-10-28", 51), d("2026-10-29", 57)], "2026-10-29");
    expect(s).toMatchObject({ today: 57, delta: 6, elevated: true });
  });
  it("ingen jämförelse utan baslinje", () => {
    expect(restingHrSignal([d("2026-10-28", 50), d("2026-10-29", 60)], "2026-10-29")).toMatchObject({ avg7: null, elevated: false });
    expect(restingHrSignal([d("2026-10-29", null)], "2026-10-29")).toBeNull();
  });
});
