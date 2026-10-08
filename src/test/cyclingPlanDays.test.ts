import { describe, it, expect } from "vitest";
import { reorderDaysToPreferred, padWeeksTo7Days, type TemplatePlanDay } from "@/data/planTemplates";

describe("reorderDaysToPreferred – endast valda dagar får pass", () => {
  it("4 valda dagar -> exakt 4 pass/vecka på just de dagarna", () => {
    // Simulerar en vecka med 5 pass (som cykelplanen: Mån, Tis, Ons, Fre, Lör)
    const rawDays: TemplatePlanDay[] = [
      { week: 1, day: "Mån", session_name: "Cykling – Lugnt", details: "x", tempo: "" },
      { week: 1, day: "Tis", session_name: "Styrka – Ben & Core", details: "x", tempo: "" },
      { week: 1, day: "Ons", session_name: "Cykling – Intervaller", details: "x", tempo: "" },
      { week: 1, day: "Tors", session_name: "Vila / Stretching", details: "", tempo: "" },
      { week: 1, day: "Fre", session_name: "Cykling – Tempokörning", details: "x", tempo: "" },
      { week: 1, day: "Lör", session_name: "Cykling – Långpass", details: "x", tempo: "" },
      { week: 1, day: "Sön", session_name: "", details: "", tempo: "" },
    ];

    const preferred = ["Tis", "Tors", "Lör", "Sön"];
    const result = padWeeksTo7Days(reorderDaysToPreferred(padWeeksTo7Days(rawDays), preferred));

    const sessions = result.filter(d => d.session_name && !d.session_name.toLowerCase().includes("vila"));
    expect(sessions.length).toBe(4);
    for (const s of sessions) {
      expect(preferred).toContain(s.day);
    }

    // Monday must not have received a session
    const monday = result.find(d => d.day === "Mån");
    expect(monday?.session_name.toLowerCase()).not.toContain("cykling");
    expect(monday?.session_name === "" || monday?.session_name.toLowerCase().includes("vila")).toBe(true);
  });
});
