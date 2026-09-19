import { describe, expect, it } from "vitest";
import { exerciseAllRegions, labelsToRegions, lookupExerciseRegions } from "@/data/exerciseMuscleMap";

describe("muskler per övning", () => {
  it("räknar bänkpress som triceps- och axelträning", () => {
    expect(exerciseAllRegions("Bänkpress")).toContain("triceps");
    expect(exerciseAllRegions("Chest Press (Life Fitness)")).toContain("triceps");
  });

  it("räknar inte bicepscurl som tricepsträning", () => {
    expect(exerciseAllRegions("Bicepscurl")).not.toContain("triceps");
  });

  it("ger marklyft både rygg, baksida lår och rumpa", () => {
    const regions = exerciseAllRegions("Marklyft");
    expect(regions).toEqual(expect.arrayContaining(["lowerBack", "hamstrings", "glutes", "traps"]));
  });

  it("låter specifika namn gå före generella", () => {
    expect(lookupExerciseRegions("Close-Grip Bänkpress")?.primary).toEqual(["triceps"]);
    expect(lookupExerciseRegions("Latsdrag")?.primary).toEqual(["lats"]);
  });

  it("tolkar egna övningars sekundära muskler", () => {
    expect(labelsToRegions([{ muscle: "Armar", submuscles: ["Biceps"] }])).toEqual(["biceps"]);
    expect(labelsToRegions([{ muscle: "Armar", submuscles: [] }])).toEqual(["biceps", "triceps", "forearms"]);
    expect(labelsToRegions(["Rumpa"])).toEqual(["glutes"]);
  });
});
