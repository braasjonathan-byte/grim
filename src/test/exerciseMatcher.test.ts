import { describe, it, expect } from "vitest";
import { matchExercises, type MatchableExercise } from "@/lib/exerciseMatcher";

const items: MatchableExercise[] = [
  { name: "Cykling", englishName: "Cycling" },
  { name: "Pike push-ups" },
  { name: "Marklyft", englishName: "Deadlift" },
  { name: "Rumänsk Marklyft", englishName: "Romanian Deadlift" },
  { name: "Löpning", englishName: "Running" },
  { name: "Low Row (Technogym)" },
  { name: "Iso-Lateral Low Row (Hammer Strength)" },
  { name: "Spinning" },
  { name: "Simning", englishName: "Swimming" },
  { name: "Hip Thrust" },
];

describe("matchExercises", () => {
  it("bike -> Cykling", () => {
    const r = matchExercises(items, "bike");
    expect(r[0]?.name).toBe("Cykling");
  });

  it("deadlift -> Marklyft", () => {
    const r = matchExercises(items, "deadlift");
    expect(r[0]?.name).toBe("Marklyft");
  });

  it("RDL -> Rumänsk Marklyft", () => {
    const r = matchExercises(items, "RDL");
    expect(r[0]?.name).toBe("Rumänsk Marklyft");
  });

  it("lö -> Löpning first, not Low Row", () => {
    const r = matchExercises(items, "lö");
    expect(r[0]?.name).toBe("Löpning");
  });

  it("spinning -> Spinning, not Simning", () => {
    const r = matchExercises(items, "spinning");
    expect(r[0]?.name).toBe("Spinning");
    expect(r.some(e => e.name === "Simning")).toBe(false);
  });

  it("höft -> Hip Thrust", () => {
    const r = matchExercises(items, "höft");
    expect(r[0]?.name).toBe("Hip Thrust");
  });
});
