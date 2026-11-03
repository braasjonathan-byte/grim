import { describe, it, expect } from "vitest";
import { planTemplates, templateMeta } from "@/data/planTemplates";
import { extraPlanTemplates, buildBlockProgram } from "@/data/planTemplatesExtra";

describe("nya scheman", () => {
  it("ingår i planTemplates och genererar rätt antal pass", () => {
    for (const t of extraPlanTemplates) {
      expect(planTemplates).toContain(t);
      const days = t.generateFromProfile!({ max_distance_km: null, time_10km_min: null, experience_level: "medel", training_days_per_week: null });
      const meta = templateMeta(t);
      expect(days.length).toBe(t.weeks * meta.daysPerWeek!);
      expect(days.every((d) => d.details.length > 0)).toBe(true);
    }
  });
  it("deload v4 halverar set", () => {
    const d = buildBlockProgram([{ day: "Mån", name: "A", ex: [{ name: "Knäböj", sets: 4, reps: "5", main: true }] }]);
    expect(d[0].details).toMatch(/^Knäböj 4×5 @ RPE/);
    expect(d[3].session_name).toContain("Deload");
    expect(d[3].details).toMatch(/^Knäböj 2×5/);
    expect(d[4].details).toMatch(/^Knäböj 5×5/);
  });
  it("templateMeta läser pass/vecka ur beskrivningen", () => {
    const t = planTemplates.find((p) => p.name.includes("PPL 6 dagar"))!;
    expect(templateMeta(t).daysPerWeek).toBe(6);
  });
});
