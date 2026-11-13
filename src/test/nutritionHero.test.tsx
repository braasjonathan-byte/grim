import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NutritionHero from "@/components/NutritionHero";

const targets = { kcal: 2000, protein_g: 120, fat_g: 70, carbs_g: 250, fiber_g: 30 };

describe("NutritionHero calorie accounting", () => {
  it("subtracts food from the goal without adding exercise calories", () => {
    render(<NutritionHero kcal={1240} burned={300} protein={80} fat={40} carbs={150} fiber={12} targets={targets} />);
    expect(screen.getByText("760")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Kalorier" }).getAttribute("aria-valuenow")).toBe("1240");
  });
  it("shows the amount exceeding the goal", () => {
    render(<NutritionHero kcal={2100} burned={0} protein={130} fat={40} carbs={150} fiber={12} targets={targets} />);
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("över")).toBeTruthy();
  });
});
