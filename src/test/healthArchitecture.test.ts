import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dedupeWorkouts,
  healthErrorCode,
  HEALTH_ERROR_REFS,
  HealthError,
  MAX_SYNC_DAYS,
  MIN_SYNC_DAYS,
  syncWindowDays,
  workoutKey,
  type HealthWorkout,
} from "@/lib/healthSync";

const workout = (over: Partial<HealthWorkout>): HealthWorkout => ({
  key: "k",
  start: "2026-09-20T08:00:00.000Z",
  end: "2026-09-20T09:00:00.000Z",
  type: "running",
  label: "Löpning",
  source: "Samsung Health",
  minutes: 60,
  distanceKm: null,
  calories: null,
  steps: null,
  avgHeartRate: null,
  maxHeartRate: null,
  ...over,
});

describe("syncWindowDays", () => {
  const now = new Date("2026-09-21T10:00:00.000Z");

  it("hämtar en vecka när ingen synk gjorts", () => {
    expect(syncWindowDays(null, now)).toBe(7);
  });

  it("hämtar aldrig färre än minsta fönstret", () => {
    expect(syncWindowDays("2026-09-21T09:00:00.000Z", now)).toBe(MIN_SYNC_DAYS);
  });

  it("täcker hela luckan sedan senaste synk", () => {
    expect(syncWindowDays("2026-09-11T10:00:00.000Z", now)).toBe(11);
  });

  it("begränsas uppåt", () => {
    expect(syncWindowDays("2025-01-01T10:00:00.000Z", now)).toBe(MAX_SYNC_DAYS);
  });
});

describe("workoutKey", () => {
  it("är stabil och unik nog", () => {
    const a = workoutKey({ id: undefined, startDate: "2026-09-20T08:00:00Z", workoutType: "running" });
    const b = workoutKey({ id: undefined, startDate: "2026-09-20T08:00:00Z", workoutType: "running" });
    const c = workoutKey({ id: undefined, startDate: "2026-09-20T08:00:01Z", workoutType: "running" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.length).toBeGreaterThan(6);
  });

  it("använder hälsoappens id när det finns", () => {
    const a = workoutKey({ id: "abc", startDate: "x", workoutType: "running" });
    const b = workoutKey({ id: "abc", startDate: "y", workoutType: "cycling" });
    expect(a).toBe(b);
  });
});

describe("dedupeWorkouts", () => {
  it("slår ihop överlappande pass av samma typ och behåller det med mest data", () => {
    const list = [
      workout({ source: "Klocka" }),
      workout({
        source: "Samsung Health",
        start: "2026-09-20T08:05:00.000Z",
        end: "2026-09-20T09:00:00.000Z",
        distanceKm: 10,
        avgHeartRate: 150,
      }),
    ];
    const res = dedupeWorkouts(list);
    expect(res).toHaveLength(1);
    expect(res[0].distanceKm).toBe(10);
  });

  it("behåller separata pass som inte överlappar", () => {
    const res = dedupeWorkouts([
      workout({}),
      workout({ start: "2026-09-20T18:00:00.000Z", end: "2026-09-20T19:00:00.000Z" }),
    ]);
    expect(res).toHaveLength(2);
  });

  it("behåller olika typer vid samma tid", () => {
    const res = dedupeWorkouts([workout({}), workout({ type: "cycling", label: "Cykling" })]);
    expect(res).toHaveLength(2);
  });
});

describe("healthErrorCode", () => {
  it("läser koden från HealthError", () => {
    expect(healthErrorCode(new HealthError("not-installed", "x"))).toBe("not-installed");
  });

  it("faller tillbaka på okänt", () => {
    expect(healthErrorCode(new Error("x"))).toBe("unknown");
  });

  it("har specifika koder för hela synkkedjan", () => {
    expect(HEALTH_ERROR_REFS).toEqual({
      "not-installed": "HC-01",
      "update-required": "HC-02",
      "launcher-setup": "HC-03",
      "launch-failed": "HC-03b",
      "intent-unresolved": "HC-03c",
      "dialog-closed": "HC-04c",
      "sync-timeout": "HC-09",
      "dialog-timeout": "HC-04",
      "callback-invalid": "HC-04b",
      denied: "HC-05",
      partial: "HC-06",
      "data-timeout": "HC-07",
      "save-failed": "HC-08",
      unknown: "HC-99",
    });
  });
});

describe("AndroidManifest package visibility", () => {
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");

  it("deklarerar Health Connect-paket och permission-intents (HC_QUERIES_V2)", () => {
    expect(manifest).toContain("HC_QUERIES_V2");
    expect(manifest).toContain("com.google.android.apps.healthdata");
    expect(manifest).toContain("androidx.health.ACTION_REQUEST_PERMISSIONS");
    expect(manifest).toContain("android.health.connect.action.REQUEST_HEALTH_PERMISSIONS");
  });

  it("deklarerar varje behörighet som begärs vid körning", () => {
    for (const p of [
      "READ_STEPS",
      "READ_ACTIVE_CALORIES_BURNED",
      "READ_DISTANCE",
      "READ_EXERCISE",
      "READ_HEART_RATE",
      "READ_SLEEP",
    ]) {
      expect(manifest).toContain(`android.permission.health.${p}`);
    }
  });
});
