import { describe, expect, it } from "vitest";
import { hiddenSections, normalizeOrder } from "@/lib/statsSettings";

describe("stats layout", () => {
  it("keeps a merged block when only one of the old cards was hidden", () => {
    expect(hiddenSections(["periodList", "quote"])).toEqual(["quote"]);
    expect(hiddenSections(["summary", "periodList"])).toEqual(["overview"]);
    expect(hiddenSections(["muscleBalance", "untrained"])).toEqual(["muscles"]);
    expect(hiddenSections(["weightProgression"])).toEqual([]);
  });

  it("puts unknown and new cards into the default order without duplicates", () => {
    expect(normalizeOrder(["quote", "overview", "nope", "overview"])[0]).toBe("quote");
    expect(normalizeOrder(["quote"])).toContain("strength");
    expect(new Set(normalizeOrder(["quote", "overview"])).size).toBe(normalizeOrder([]).length);
  });
});
