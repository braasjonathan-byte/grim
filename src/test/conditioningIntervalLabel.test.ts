import { describe, it, expect } from "vitest";
import { buildConditioningIntervalLabel, parseConditioningIntervalLabel } from "@/lib/workoutIntervalUtils";

describe("conditioning interval label", () => {
  it("round-trips 4×2 min, vila 2 min @ 35 km/h", () => {
    const label = buildConditioningIntervalLabel(4, "2", "2", "kmh", "35");
    const p = parseConditioningIntervalLabel(`Cykling ${label}`);
    expect(p).toEqual({ count: 4, durationMin: 2, restMin: "2", mode: "kmh", value: "35" });
  });
  it("parses legacy joggvila format", () => {
    const p = parseConditioningIntervalLabel("Löpning 3×10 min (2 min joggvila)");
    expect(p?.count).toBe(3);
    expect(p?.restMin).toBe("2");
  });
});
