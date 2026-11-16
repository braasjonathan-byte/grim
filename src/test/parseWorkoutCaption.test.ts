import { describe, expect, it } from "vitest";
import { parseWorkoutCaption } from "@/lib/parseWorkoutCaption";

describe("workout caption measurement separation", () => {
  it("keeps running measurements separate from whole-session strength totals", () => {
    const result = parseWorkoutCaption("🏋️ Tröskellöpning – Vecka 10\n📏 5,00 km · ⏱ 27 min · 🚀 5:20/km · ❤️ 146 bpm · 💪 6 set · 🏋️‍♂️ 1.8k kg volym\n• Bicepscurl: 2x6@40kg");
    expect(result.cardioStats.map(stat => stat.label)).toEqual(["5,00 km", "27 min", "5:20/km", "146 bpm"]);
    expect(result.chips.map(stat => stat.label)).toEqual(["6 set", "1.8k kg"]);
    expect(result.exercises[0].name).toBe("Bicepscurl");
    expect(result.text).toBe("");
  });
  it("preserves personal notes instead of labelling them as totals", () => {
    expect(parseWorkoutCaption("🏋️ Löpning\n📏 5 km · 🚀 5:20/km\nKändes bra idag").text).toBe("Kändes bra idag");
  });
});