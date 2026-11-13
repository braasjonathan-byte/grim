import { describe, expect, it } from "vitest";
import { classifyToday } from "@/components/HomeView";

describe("classifyToday (Hem: dagens pass)", () => {
  it("inget planerat är vilodag", () => {
    expect(classifyToday([])).toBe("rest");
  });
  it("«Vila» utan övningar är vilodag, inte ett pass som saknar övningar", () => {
    expect(classifyToday([{ session_name: "Vila", details: "" }])).toBe("rest");
    expect(classifyToday([{ session_name: "Återhämtning", details: null }])).toBe("rest");
  });
  it("planerat pass utan övningar ger läget för att lägga till övningar", () => {
    expect(classifyToday([{ session_name: "Ben", details: "  " }])).toBe("empty");
  });
  it("pass med innehåll är ett träningspass", () => {
    expect(classifyToday([{ session_name: "Vila", details: "Promenad — 30 min" }])).toBe("workout");
    expect(classifyToday([{ session_name: "Push", details: "Bänkpress — 3×8" }])).toBe("workout");
  });
});
