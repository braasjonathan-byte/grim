import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ACHIEVEMENTS } from "@/lib/achievements";

describe("svenska texter (punkt 21)", () => {
  it("utmärkelser använder «Svit» i stället för «Streak»", () => {
    expect(ACHIEVEMENTS.some((a) => /streak/i.test(a.title))).toBe(false);
    expect(ACHIEVEMENTS.find((a) => a.id === "streak-7")?.title).toBe("Svit 7 dagar i rad");
  });
  it("inga «Achievement upplåst»-toasts finns kvar", () => {
    for (const f of ["components/WorkoutView.tsx", "components/SocialView.tsx", "components/WorkoutPostThread.tsx"]) {
      const src = readFileSync(resolve(__dirname, "..", f), "utf8");
      expect(src).not.toContain("Achievement upplåst");
      expect(src).toContain("Utmärkelse upplåst");
    }
  });
});
