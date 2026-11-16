import { describe, expect, it } from "vitest";
import { initialSocialTab } from "@/lib/socialNavigation";

describe("Social entry", () => {
  it("opens Flöde on normal entry", () => {
    expect(initialSocialTab()).toBe("feed");
    expect(initialSocialTab(null)).toBe("feed");
  });
  it("preserves explicit friend destinations", () => {
    expect(initialSocialTab("friend-id")).toBe("friends");
  });
});