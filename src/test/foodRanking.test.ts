import { describe, it, expect } from "vitest";
import { rankFoods, usageKey } from "@/lib/foodRanking";

describe("rankFoods", () => {
  const items = [
    { id: "1", name: "Mjölk 3%", source: "food" },
    { id: "2", name: "Mjölk 0,5%", source: "food" },
    { id: "3", name: "Havremjölk", source: "food" },
    { id: "4", name: "Kvarg mjölkfri", source: "custom_food" },
  ];
  it("boosts previously used foods above unused ones", () => {
    const usage = new Map([[usageKey("food", "3"), { count: 3, last: Date.now() }]]);
    const r = rankFoods(items, "mjölk", usage).map((i) => i.id);
    expect(r[0]).toBe("3"); // used + contains beats unused + starts with
    expect(r.slice(1, 3)).toEqual(["2", "1"]);
  });
  it("used + starts with ranks first", () => {
    const usage = new Map([
      [usageKey("food", "3"), { count: 3, last: 1 }],
      [usageKey("food", "1"), { count: 1, last: 1 }],
    ]);
    expect(rankFoods(items, "mjölk", usage).map((i) => i.id).slice(0, 2)).toEqual(["1", "3"]);
  });
});
