import { describe, it, expect } from "vitest";
import { DEFAULT_HIDDEN } from "@/lib/statsSettings";

describe("Statistik-standard (punkt 17)", () => {
  it("döljer citatkortet som standard så färre kort visas", () => {
    expect(DEFAULT_HIDDEN).toContain("quote");
  });
});
