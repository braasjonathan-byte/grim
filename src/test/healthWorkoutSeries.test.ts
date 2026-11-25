import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const native = vi.hoisted(() => ({ queryWorkouts: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
  registerPlugin: () => native,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { readHealthWorkouts } from "@/lib/healthSync";
import { cardioSummaryFromSession, findSessionForEntry, mainCardioEntry } from "@/lib/cardioHistory";
import type { HistorySession } from "@/lib/workoutHistory";

const START = "2026-11-20T07:00:00.000Z";
const t0 = Date.parse(START);
const iso = (s: number) => new Date(t0 + s * 1000).toISOString();

describe("hela pulsserien från Health Connect", () => {
  it("bygger serien ur pulsens tidsstämplar även med äldre APK (utan grimSeries)", async () => {
    native.queryWorkouts.mockResolvedValue({ workouts: [{
      id: "run-1", startDate: START, endDate: iso(1800), workoutType: "RUNNING", sourceName: "Galaxy Watch",
      sourceBundleId: "com.sec.android.app.shealth", duration: 1800, calories: 400, distance: 6000,
      heartRate: Array.from({ length: 360 }, (_, i) => ({ timestamp: iso(i * 5), bpm: 140 + (i % 10) })),
    }] });
    const [w] = await readHealthWorkouts(30);
    expect(native.queryWorkouts).toHaveBeenCalledWith(expect.objectContaining({ includeGrimSeries: true, includeHeartRate: true }));
    expect(w.series?.t0).toBe(t0);
    expect(w.series?.hr.filter((b) => b != null).length).toBeGreaterThan(300);
    expect(w.series?.d).toBeUndefined();
    expect(w.hrCurve?.length).toBeLessThanOrEqual(90);
  });

  it("använder distans, watt, kadens och efterpuls från nyare APK", async () => {
    native.queryWorkouts.mockResolvedValue({ workouts: [{
      id: "ride-1", startDate: START, endDate: iso(3600), workoutType: "BIKING", sourceName: "Garmin",
      sourceBundleId: "com.garmin.android.apps.connectmobile", duration: 3600, calories: 800, distance: 30000,
      heartRate: Array.from({ length: 720 }, (_, i) => ({ timestamp: iso(i * 5), bpm: 150 })),
      grimSeries: {
        distance: Array.from({ length: 60 }, (_, i) => [t0 + i * 60000, t0 + (i + 1) * 60000, 500]),
        power: Array.from({ length: 360 }, (_, i) => [t0 + i * 10000, 210]),
        cadence: Array.from({ length: 360 }, (_, i) => [t0 + i * 10000, 88]),
        hrAfter: [[t0 + 3600000 + 60000, 118]],
      },
    }] });
    const [w] = await readHealthWorkouts(30);
    expect(w.series?.d?.[w.series.d.length - 1]).toBe(30000);
    expect(w.series?.pw?.some((x) => x === 210)).toBe(true);
    expect(w.series?.cad?.some((x) => x === 88)).toBe(true);
    expect(w.series?.rec).toEqual({ end: 150, at60: 118 });
  });

  it("ett pass utan puls och distansserie får ingen serie", async () => {
    native.queryWorkouts.mockResolvedValue({ workouts: [{
      id: "x", startDate: START, endDate: iso(1800), workoutType: "RUNNING", sourceName: "", duration: 1800, calories: 0,
    }] });
    const [w] = await readHealthWorkouts(30);
    expect(w.series).toBeNull();
  });
});

describe("native läsare av serier (GRIM_WORKOUT_SERIES_V1)", () => {
  it("patchskriptet kopierar läsaren, är idempotent och verifieras i CI", () => {
    const kt = readFileSync("scripts/android/GrimWorkoutSeries.kt", "utf8");
    expect(kt).toContain("GRIM_WORKOUT_SERIES_V1");
    // Varje del kräver sin egen beviljade läsbehörighet.
    for (const p of ["READ_DISTANCE", "READ_HEART_RATE", "READ_SPEED", "READ_POWER", "READ_CYCLING_PEDALING_CADENCE"]) {
      expect(kt).toContain(`android.permission.health.${p}`);
    }
    // Ursprung summeras aldrig (de dubblerar varandra).
    expect(kt).toContain("maxByOrNull");
    const patch = readFileSync("scripts/patch-capacitor-health.cjs", "utf8");
    expect(patch).toContain('if (!kt.includes("GRIM_WORKOUT_SERIES_V1"))');
    expect(patch).toContain('call.getBoolean("includeGrimSeries", false)');
    expect(patch).toContain("GrimWorkoutSeries.kt");
    const verify = readFileSync("scripts/verify-android-plugins.cjs", "utf8");
    expect(verify).toContain("GRIM_WORKOUT_SERIES_V1");
    expect(verify).toContain("GrimWorkoutSeries.kt missing");
  });

  it("begär inga nya Health Connect-behörigheter (kräver annars ny Play-deklaration)", () => {
    const manifest = readFileSync("scripts/patch-android-manifest.cjs", "utf8");
    for (const p of ["READ_SPEED", "READ_POWER", "READ_CYCLING_PEDALING_CADENCE"]) expect(manifest).not.toContain(p);
  });
});

describe("historik för jämförelsen", () => {
  const session = (over: Partial<HistorySession>): HistorySession => ({
    id: "a-1", source: { kind: "active", planIds: [] }, week: 0, day: "2026-11-20", date: "2026-11-20", name: "Löpning",
    details: "", completion: { logged_weights: {} }, exercises: [], setCount: 0, volume: 0, distanceKm: null, tempo: null, pulse: null, ...over,
  });

  it("läser huvudraden för löpning ur konditionsraderna", () => {
    const lw = {
      "__cond__Uppvärmning": JSON.stringify({ time: "10", dist: "1.5", pulse: "120" }),
      "__cond__Löpning": JSON.stringify({ time: "50", dist: "10", pulse: "155" }),
    };
    expect(mainCardioEntry(lw, "Tempopass")?.name).toBe("Löpning");
    const s = cardioSummaryFromSession(session({ completion: { logged_weights: lw } }));
    expect(s).toMatchObject({ sport: "run", distanceKm: 10, minutes: 50, avgHr: 155 });
  });

  it("tidigare Strava-import utan konditionsrad använder värden på passnivå", () => {
    const s = cardioSummaryFromSession(session({ name: "Cykling", distanceKm: 30, tempo: "2:00 min/km", pulse: 140 }));
    expect(s).toMatchObject({ sport: "bike", distanceKm: 30, minutes: 60, avgHr: 140 });
    expect(cardioSummaryFromSession(session({ name: "Löpning", distanceKm: 10 }))).toBeNull();
  });

  it("hittar passet som en konditionsrad tillhör", () => {
    const data = { time: "50", dist: "10", pulse: "155" };
    const a = session({ id: "a", completion: { logged_weights: { "__cond__Löpning": JSON.stringify({ time: "30", dist: "6", pulse: "150" }) } } });
    const b = session({ id: "b", completion: { logged_weights: { "__cond__Löpning": JSON.stringify(data) } } });
    expect(findSessionForEntry([a, b], "Löpning", data)?.id).toBe("b");
    expect(findSessionForEntry([a], "Löpning", data)).toBeNull();
  });
});
