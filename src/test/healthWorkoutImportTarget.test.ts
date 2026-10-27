import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { healthWorkoutTarget, healthWorkoutDayKey } from "@/lib/healthWorkoutImport";
import { getBaseDay } from "@/lib/workoutDayUtils";

const w = (start: string) => ({ key: "abc123", start, end: start, label: "Promenad" } as any);

describe("healthWorkoutTarget", () => {
  it("lägger passet på rätt programdag när ett program följs", () => {
    // Program startade måndag 2026-10-05 → 27 okt (tis) = vecka 4, Tis
    const t = healthWorkoutTarget(w("2026-10-27T10:00:00"), { planStartDate: "2026-10-05", maxWeek: 8 });
    expect(t).toEqual({ week: 4, day: "Tis_hcabc123" });
    expect(getBaseDay(t.day)).toBe("Tis");
  });
  it("faller tillbaka på fristående pass utan program", () => {
    expect(healthWorkoutTarget(w("2026-10-27T10:00:00"), null)).toEqual({ week: 0, day: "2026-10-27_hcabc123" });
  });
  it("faller tillbaka utanför programmets veckor", () => {
    expect(healthWorkoutTarget(w("2026-10-27T10:00:00"), { planStartDate: "2026-11-02", maxWeek: 8 }).week).toBe(0);
    expect(healthWorkoutTarget(w("2026-10-27T10:00:00"), { planStartDate: "2026-01-05", maxWeek: 4 }).week).toBe(0);
  });
  it("använder lokalt datum, inte UTC-datumet", () => {
    const d = new Date(2026, 9, 27, 0, 30); // 00:30 lokal tid
    expect(healthWorkoutDayKey(w(d.toISOString())).slice(0, 10)).toBe("2026-10-27");
  });
});
