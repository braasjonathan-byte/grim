import { describe, it, expect } from "vitest";
import { Activity, Bike, Waves, Footprints } from "lucide-react";
import { cardioIconFor } from "@/lib/cardioIcons";
import { parsePlanCardioForExercise } from "@/lib/workoutIntervalUtils";

describe("cardioIconFor", () => {
  it("väljer ikon per gren", () => {
    expect(cardioIconFor("Cykling – tempo")).toBe(Bike);
    expect(cardioIconFor("Simning teknik")).toBe(Waves);
    expect(cardioIconFor("Löpning lugnt")).toBe(Footprints);
  });
  it("okänd gren ger neutral ikon i stället för fotsteg", () => {
    expect(cardioIconFor("Mobilitet")).toBe(Activity);
  });
});

describe("radens egna planvärden (punkt 12)", () => {
  it("utan passets tempo härleds ingen distans/tempo för en tidsrad", () => {
    const r = parsePlanCardioForExercise("Uppvärmning", "10 min");
    expect(r.time).toBe("10");
    expect(r.dist).toBe("");
    expect(r.tempo).toBe("");
  });
});
