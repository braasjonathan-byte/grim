import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ queryWorkouts: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
  registerPlugin: () => native,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { readHealthWorkouts } from "@/lib/healthSync";

describe("distance from the native workout read", () => {
  it("keeps separate Tacx distance and converts meters to km without needing a GPS route", async () => {
    native.queryWorkouts.mockResolvedValue({ workouts: [{
      id: "tacx-17-nov", startDate: "2026-11-17T16:41:00Z", endDate: "2026-11-17T17:40:15Z",
      workoutType: "BIKING", sourceName: "Tacx", sourceBundleId: "com.garmin.android.apps.tacx",
      duration: 3555, distance: 32500, calories: 581,
    }] });
    const [workout] = await readHealthWorkouts(30);
    expect(workout.distanceKm).toBe(32.5);
    expect(workout.label).toBe("Cykling");
    expect(workout.minutes).toBe(59.25);
    expect(native.queryWorkouts).toHaveBeenCalledWith(expect.objectContaining({ includeRoute: false }));
  });
});
describe("distance diagnostics and native reader contract", () => {
  it("still imports a ride without distance and logs why the native reader found none", async () => {
    native.queryWorkouts.mockResolvedValue({ workouts: [{
      id: "tacx-nodist", startDate: "2026-11-18T16:41:00Z", endDate: "2026-11-18T17:40:00Z",
      workoutType: "BIKING_STATIONARY", sourceName: "Tacx", sourceBundleId: "com.garmin.android.apps.tacx",
      duration: 3540, calories: 500, distanceDiag: "no DistanceRecord overlaps session (skippedBroad=0)",
    }] });
    const [workout] = await readHealthWorkouts(30);
    expect(workout.label).toBe("Spinning");
    expect(workout.distanceKm).toBeNull();
  });

  it("native reader pro-rates overlapping records from all origins and prefers the session origin", async () => {
    const { readFileSync } = await import("node:fs");
    const kt = readFileSync("scripts/android/GrimWorkoutDistance.kt", "utf8");
    // Reads without a dataOriginFilter, so a distance written by another app than the session still counts.
    expect(kt).not.toMatch(/dataOriginFilter\s*=/);
    // Pro-rates by overlap instead of dropping records that stick out of the session.
    expect(kt).toContain("overlap.toDouble() / recMs.toDouble()");
    // Never sums different origins (they duplicate each other) and ignores broad records from other apps.
    expect(kt).toContain("perOrigin.entries.maxByOrNull");
    expect(kt).toContain("OTHER_MAX_RECORD_EXTRA_MS");
    expect(kt).toContain("GRIM_WORKOUT_DISTANCE_V2");
    const patch = readFileSync("scripts/patch-capacitor-health.cjs", "utf8");
    expect(patch).toContain('workoutObject.put("distanceDiag"');
    expect(patch).toContain("v1.test(kt)");
  });
});
