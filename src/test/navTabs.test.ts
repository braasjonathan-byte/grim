import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const index = readFileSync(resolve(__dirname, "../pages/Index.tsx"), "utf8");
const tour = readFileSync(resolve(__dirname, "../lib/tour.ts"), "utf8");

describe("bottenmeny (punkt 20)", () => {
  it("har fem flikar – Verktyg ligger i sidhuvudet", () => {
    const tabsBlock = index.slice(index.indexOf("const tabs:"), index.indexOf(".filter((t) =>", index.indexOf("const tabs:")));
    expect(tabsBlock).not.toContain('key: "calc"');
    expect((tabsBlock.match(/\{ key: "/g) || []).length).toBe(5);
  });
  it("behåller tour-ankaret och djuplänken till Verktyg", () => {
    expect(index).toContain('data-tour="tab-calc"');
    expect(index).toContain('urlTab === "calc"');
    const calcSteps = tour.split('[data-tour="tab-calc"]').slice(1).map((s) => s.slice(0, 400));
    expect(calcSteps.length).toBeGreaterThan(0);
    for (const s of calcSteps) expect(s).toContain('side: "bottom"');
  });
});
