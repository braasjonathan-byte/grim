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