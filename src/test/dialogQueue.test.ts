import { describe, it, expect, beforeEach } from "vitest";
import { getLastReadOrCreatedAt, isAccountYoungerThan24h } from "@/lib/dialogQueue";

describe("dialogQueue helpers", () => {
  beforeEach(() => localStorage.clear());
  it("faller tillbaka på created_at och sparar det", () => {
    const c = "2026-11-10T10:00:00.000Z";
    expect(getLastReadOrCreatedAt("k", c)).toBe(c);
    expect(localStorage.getItem("k")).toBe(c);
    expect(getLastReadOrCreatedAt("k", "2020-01-01T00:00:00Z")).toBe(c);
  });
  it("känner igen konton yngre än 24 h", () => {
    expect(isAccountYoungerThan24h(new Date().toISOString())).toBe(true);
    expect(isAccountYoungerThan24h(new Date(Date.now() - 25 * 3600e3).toISOString())).toBe(false);
    expect(isAccountYoungerThan24h(null)).toBe(false);
  });
});
