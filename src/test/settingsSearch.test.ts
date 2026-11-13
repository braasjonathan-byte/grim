import { describe, expect, it } from "vitest";
import { searchSettings } from "@/lib/settingsSearch";
describe("Settings discovery", () => {
  it("finds pulse settings by synonym", () => { expect(searchSettings("pulszoner")[0].category).toBe("profile"); });
  it("finds themes without Swedish accents", () => { expect(searchSettings("farg")[0].category).toBe("appearance"); });
});