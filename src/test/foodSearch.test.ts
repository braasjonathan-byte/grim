import { describe, it, expect } from "vitest";
import { searchFoods } from "@/lib/foodSearch";

const names = [
  "Mjölk fett 3% berikad", "Mjöl vete", "Öl lättöl vol. % 2,3", "Öl starköl el. exportöl vol. % 5,4",
  "Apelsinjuice kris", "Ris basmati okokt", "Socker", "Sockerärtor", "Lasagne m. cottage cheese veg.",
  "Färskost cottage cheese naturell fett 4%", "Nöt färs rå fett 10%", "Fläsk färs", "Kyckling lår rå u. skinn",
  "Hårt bröd fullkorn råg fibrer ca 13%", "Crème fraiche fett 32%", "Räka kokt", "Sötmandel", "Banan",
].map((name, i) => ({ id: String(i), name, source: "food" }));
const first = (q: string) => searchFoods(names, q)[0]?.name;

describe("searchFoods", () => {
  it("hittar baslivsmedel först", () => {
    expect(first("socker")).toBe("Socker");
    expect(first("keso")).toMatch(/^Färskost cottage/);
    expect(first("nötfärs")).toMatch(/^Nöt färs/);
    expect(first("kycklinglår")).toMatch(/^Kyckling lår/);
    expect(first("knäckebröd")).toMatch(/^Hårt bröd/);
    expect(first("creme fraiche")).toMatch(/^Crème fraiche/);
    expect(first("räkor")).toBe("Räka kokt");
    expect(first("mandlar")).toBe("Sötmandel");
  });
  it("öl före mjöl, ris före apelsinjuice", () => {
    const ol = searchFoods(names, "öl").map((r) => r.name);
    expect(ol[0]).toMatch(/^Öl/);
    expect(ol.indexOf("Mjöl vete")).toBeGreaterThan(1);
    expect(first("ris")).toBe("Ris basmati okokt");
  });
  it("alla ord i valfri ordning", () => {
    expect(first("färs nöt")).toMatch(/^Nöt färs/);
  });
});
