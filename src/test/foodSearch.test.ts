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
  it("butiksnamn mappas till Livsmedelsverkets namn", () => {
    const extra = [
      "Kyckling lår rå", "Mussla", "Isbergssallat", "Squash", "Champinjon", "Rödbeta", "Lök röd",
      "Bröd fullkorn", "Spagetti", "Ris basmati", "Pannkaka tunn", "Solrosfrö", "Läsk cola",
      "Mykoprotein", "Grädde visp", "Sylt hallon", "Soja", "Tortilla", "Kyckling färs", "Makaroner",
    ].map((name, i) => ({ id: `x${i}`, name, source: "food" }));
    const all = [...names, ...extra];
    const f = (q: string) => searchFoods(all, q)[0]?.name;
    expect(f("kycklinglårfilé")).toMatch(/^Kyckling lår/);
    expect(f("musslor")).toBe("Mussla");
    expect(f("isbergssallad")).toBe("Isbergssallat");
    expect(f("zucchini")).toBe("Squash");
    expect(f("champinjoner")).toBe("Champinjon");
    expect(f("rödbetor")).toBe("Rödbeta");
    expect(f("rödlök")).toBe("Lök röd");
    expect(f("fullkornsbröd")).toMatch(/^Bröd fullkorn/);
    expect(f("spaghetti")).toBe("Spagetti");
    expect(f("basmatiris")).toBe("Ris basmati");
    expect(f("pannkakor")).toMatch(/^Pannkaka/);
    expect(f("solroskärnor")).toBe("Solrosfrö");
    expect(f("coca-cola")).toBe("Läsk cola");
    expect(f("quorn")).toBe("Mykoprotein");
    expect(f("vispgrädde")).toMatch(/^Grädde visp/);
    expect(f("hallonsylt")).toBe("Sylt hallon");
    expect(f("sojasås")).toBe("Soja");
    expect(f("vetetortilla")).toBe("Tortilla");
    expect(f("kycklingfärs")).toMatch(/^Kyckling färs/);
    expect(f("makaroner")).toBe("Makaroner");
  });
});
