import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NutritionHero from "@/components/NutritionHero";

const targets = { kcal: 2000, protein_g: 120, fat_g: 70, carbs_g: 250, fiber_g: 30 };

describe("NutritionHero (punkt 14)", () => {
  it("visar kompakt kcal-mätare, tre makrostaplar och protein kvar", () => {
    render(<NutritionHero kcal={1240} burned={300} protein={80} fat={40} carbs={150} fiber={12} targets={targets} />);
    expect(screen.getByText("760")).toBeTruthy();
    expect(screen.getByTestId("protein-left").textContent).toContain("40 g protein kvar idag");
    const bars = screen.getAllByRole("progressbar").map((b) => b.getAttribute("aria-label"));
    expect(bars).toEqual(["Kalorier", "Protein", "Kolhydrater", "Fett"]);
  });
  it("visar att proteinmålet är nått", () => {
    render(<NutritionHero kcal={2100} burned={0} protein={130} fat={40} carbs={150} fiber={12} targets={targets} />);
    expect(screen.getByTestId("protein-left").textContent).toBe("Proteinmålet är nått idag");
    expect(screen.getByText("över", { exact: false })).toBeTruthy();
  });
});
