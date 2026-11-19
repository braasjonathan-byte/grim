import { describe, expect, it } from "vitest";
import { missingHealthDistancePatch } from "@/lib/healthWorkoutDistance";

const completion = (dist?: string) => ({
  logged_distance_km: null,
  logged_weights: {
    __cond__Cykling: JSON.stringify({ time: "59.15", pulse: "143", hr: [120, 143], ...(dist ? { dist } : {}) }),
    __hc_meta__: '{"kcal":581}', __cond_done__Cykling: "1",
  },
});
describe("missing Health workout distance", () => {
  it("stores real distance in both the statistic and cardio row, preserving time and pulse", () => {
    const original = completion();
    const patch = missingHealthDistancePatch(original, 32.5);
    expect(patch?.logged_distance_km).toBe(32.5);
    expect(JSON.parse(String(patch?.logged_weights.__cond__Cykling))).toEqual({ time: "59.15", pulse: "143", hr: [120,143], dist: "32.5" });
    expect(original.logged_distance_km).toBeNull();
    expect(patch?.logged_weights.__hc_meta__).toBe('{"kcal":581}');
  });
  it("does not overwrite an existing total distance", () => {
    expect(missingHealthDistancePatch({ ...completion(), logged_distance_km: 27 }, 32.5)).toBeNull();
  });
  it("does not overwrite manually edited cardio distance", () => {
    expect(missingHealthDistancePatch(completion("27"), 32.5)).toBeNull();
  });
  it("does not invent distance when the source has none", () => {
    expect(missingHealthDistancePatch(completion(), null)).toBeNull();
  });
  it("rejects invalid distance", () => {
    expect(missingHealthDistancePatch(completion(), -1)).toBeNull();
    expect(missingHealthDistancePatch(completion(), 301)).toBeNull();
  });
  it("does not guess how to distribute distance after an extra cardio row is added", () => {
    const c = completion();
    expect(missingHealthDistancePatch({ ...c, logged_weights: { ...c.logged_weights, __cond__Löpning: '{}' } }, 32.5)).toBeNull();
  });
});