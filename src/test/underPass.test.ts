import { describe, it, expect } from "vitest";
import { formatPrevSummary, withRpe, getRpe, warmupRamp, suggestSubstitutes, equipmentOf, isHeavyCompound } from "@/lib/underPass";
import { checkedSetsFor, sessionVolumeKg } from "@/lib/checkedSets";
import { summarizeCompletion } from "@/lib/workoutSummary";

describe("formatPrevSummary", () => {
  it("lika set", () => expect(formatPrevSummary([{ kg: "80", reps: "8" }, { kg: "80", reps: "8" }, { kg: "80", reps: "8" }])).toBe("3×8 @ 80 kg"));
  it("olika set", () => expect(formatPrevSummary([{ kg: "80", reps: "8" }, { kg: "77.5", reps: "6" }])).toBe("80×8 · 77,5×6"));
  it("tomt", () => expect(formatPrevSummary([])).toBeNull());
});

describe("RPE", () => {
  it("sätter och tar bort", () => {
    const s = withRpe([], 2, "8.5");
    expect(s).toBe(",,8.5");
    expect(getRpe({ __rpe__X: s }, "X", 2)).toBe("8.5");
    expect(withRpe(s.split(","), 2, null)).toBe("");
  });
});

describe("warmupRamp", () => {
  it("100 kg → 40/60/80", () => expect(warmupRamp(100).map((s) => s.kg)).toEqual([40, 60, 80]));
  it("lätt vikt → ingen rampa", () => expect(warmupRamp(30)).toEqual([]));
  it("minst stång", () => expect(warmupRamp(45)[0].kg).toBe(20));
  it("tunga basövningar", () => { expect(isHeavyCompound("Knäböj")).toBe(true); expect(isHeavyCompound("Bicepscurl")).toBe(false); });
});

describe("suggestSubstitutes", () => {
  const lib = [
    { name: "Bänkpress", muscleGroup: "Bröst", category: "styrka" },
    { name: "Hantlar Bänkpress", muscleGroup: "Bröst", category: "styrka" },
    { name: "Incline Bänkpress", muscleGroup: "Bröst", category: "styrka" },
    { name: "Hantlar Flyes", muscleGroup: "Bröst", category: "styrka" },
    { name: "Rodd", muscleGroup: "Rygg", category: "styrka" },
  ];
  it("samma muskel, samma utrustning först", () => {
    const r = suggestSubstitutes("Hantlar Flyes", lib);
    expect(r[0]).toBe("Hantlar Bänkpress");
    expect(r).not.toContain("Rodd");
    expect(r).not.toContain("Hantlar Flyes");
  });
  it("utrustning", () => expect(equipmentOf("Kabelrodd")).toBe("kabel"));
});

describe("uppvärmningsset räknas inte", () => {
  const lw = {
    "__setdata__Knäböj": JSON.stringify([{ kg: "60", reps: "5" }, { kg: "100", reps: "5" }]),
    "__sets__Knäböj": "11",
    "__settypes__Knäböj": "wn",
  };
  it("volym", () => expect(sessionVolumeKg(lw)).toBe(500));
  it("checkedSetsFor exkluderar U", () => expect(checkedSetsFor(lw, "Knäböj")).toHaveLength(1));
  it("includeWarmups", () => expect(checkedSetsFor(lw, "Knäböj", { includeWarmups: true })[0].warmup).toBe(true));
  it("sammanfattning", () => {
    const s = summarizeCompletion(lw as any);
    expect(s.volumeKg).toBe(500);
    expect(s.sets).toBe(2);
  });
});

import { prependWarmups, bumpLineSets } from "@/lib/underPass";
describe("prependWarmups", () => {
  it("flyttar arbetsset", () => {
    const lw = { "__setdata__B": JSON.stringify([{ kg: "100", reps: "5" }]), "__sets__B": "1", "__rpe__B": "8" };
    const out = prependWarmups(lw, "B", warmupRamp(100), 3);
    expect(JSON.parse(out["__setdata__B"]).map((r: any) => r.kg)).toEqual(["40", "60", "80", "100", "", ""]);
    expect(out["__sets__B"]).toBe("000100");
    expect(out["__settypes__B"]).toBe("wwwnnn");
    expect(out["__rpe__B"]).toBe(",,,8");
  });
  it("bumpLineSets", () => expect(bumpLineSets("Knäböj — 3×5 @ 100 kg", 3)).toBe("Knäböj — 6×5 @ 100 kg"));
});
