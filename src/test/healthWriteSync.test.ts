import { describe, expect, it } from "vitest";
import {
  buildHealthExport,
  clientRecordIdFor,
  grimExerciseType,
  isExternalImport,
  minutesFromDetails,
  overlapsForeignWorkout,
  planHealthWrites,
  type CompletionRow,
} from "@/lib/healthWriteSync";
import { parseHealthWriteAccess, PERMISSION_GROUPS, WRITE_PERMISSIONS } from "@/lib/healthSync";

const base = (over: Partial<CompletionRow> = {}): CompletionRow => ({
  id: "c1",
  week: 0,
  day: "2026-10-20",
  done: true,
  skipped: false,
  updated_at: "2026-10-20T18:00:00.000Z",
  logged_weights: { "__sets__Knäböj": "111" },
  logged_distance_km: null,
  logged_pulse: null,
  ...over,
});
const profile = { weight_kg: 102, gender: "male", age: 28 };

describe("skrivbehörigheter", () => {
  it("ligger utanför läsbehörigheterna så läsflödet inte påverkas", () => {
    const read = Object.values(PERMISSION_GROUPS).flat() as string[];
    for (const p of WRITE_PERMISSIONS) expect(read).not.toContain(p);
  });
  it("tolkar delvis beviljade skrivbehörigheter", () => {
    expect(parseHealthWriteAccess({ permissions: { WRITE_WORKOUTS: true, WRITE_DISTANCE: false } })).toEqual({
      workouts: true,
      calories: false,
      distance: false,
    });
  });
});

describe("isExternalImport", () => {
  it("hoppar över pass importerade från Health Connect och Strava", () => {
    expect(isExternalImport(base({ day: "2026-10-20_hcabc123" }))).toBe(true);
    expect(isExternalImport(base({ day: "2026-10-20_strava_998" }))).toBe(true);
    expect(isExternalImport(base({ logged_weights: { __strava_calories: 500 } }))).toBe(true);
  });
  it("skriver vanliga Grim-pass", () => {
    expect(isExternalImport(base())).toBe(false);
    expect(isExternalImport(base({ week: 3, day: "Mån" }))).toBe(false);
  });
});

describe("grimExerciseType", () => {
  it.each([
    ["Löpning 5 km", "running"],
    ["Löpband 30 min", "treadmill"],
    ["Cykling 60 min", "biking"],
    ["Spinning 45 min", "biking_stationary"],
    ["Simning 1000 m", "swimming"],
    ["Promenad 40 min", "walking"],
    ["Knäböj 3x8; Bänkpress 3x5", "strength"],
    ["Intervallträning", "hiit"],
    ["Yoga", "yoga"],
    ["Något annat", "other"],
  ])("%s → %s", (text, key) => expect(grimExerciseType(text)).toBe(key));
});

describe("buildHealthExport", () => {
  it("använder första setet som start och updated_at som slut", () => {
    const out = buildHealthExport(
      base({ logged_weights: { "__sets__Knäböj": "11", __first_set_at__: "2026-10-20T17:00:00.000Z" } }),
      { week: 0, day: "2026-10-20", details: "Knäböj 3x8", session_name: "Ben" },
      profile,
    )!;
    expect(out.clientRecordId).toBe(clientRecordIdFor("c1"));
    expect(out.startTime).toBe("2026-10-20T17:00:00.000Z");
    expect(out.endTime).toBe("2026-10-20T18:00:00.000Z");
    expect(out.exerciseType).toBe("strength");
    expect(out.title).toBe("Ben");
    expect(out.version).toBe(Date.parse("2026-10-20T18:00:00.000Z"));
  });

  it("räknar längd från planens minuter och tar med distans", () => {
    const out = buildHealthExport(
      base({ logged_weights: null, logged_distance_km: 5 }),
      { week: 0, day: "2026-10-20", details: "Löpning 30 min" },
      profile,
    )!;
    expect(Date.parse(out.endTime) - Date.parse(out.startTime)).toBe(30 * 60000);
    expect(out.distanceMeters).toBe(5000);
    expect(out.calories).toBeGreaterThan(0);
    expect(out.exerciseType).toBe("running");
  });

  it("behåller tiderna vid redigering men höjer versionen", () => {
    const prev = { version: 1, start: "2026-10-20T10:00:00.000Z", end: "2026-10-20T11:00:00.000Z" };
    const out = buildHealthExport(base({ updated_at: "2026-10-21T08:00:00.000Z" }), undefined, profile, prev)!;
    expect(out.startTime).toBe(prev.start);
    expect(out.endTime).toBe(prev.end);
    expect(out.version).toBeGreaterThan(prev.version);
  });

  it("skriver inte pass utan bevis på träning eller importerade pass", () => {
    expect(buildHealthExport(base({ logged_weights: {} }), undefined, profile)).toBeNull();
    expect(buildHealthExport(base({ done: false }), undefined, profile)).toBeNull();
    expect(buildHealthExport(base({ day: "2026-10-20_hcxyz" }), undefined, profile)).toBeNull();
  });
});

describe("minutesFromDetails", () => {
  it("summerar minuter och saknar värde annars", () => {
    expect(minutesFromDetails("Uppvärmning 10 min; Löpning 30 min")).toBe(40);
    expect(minutesFromDetails("Knäböj 3x8")).toBeNull();
  });
});

describe("planHealthWrites", () => {
  const d = (id: string, version: number) => ({
    clientRecordId: id,
    version,
    startTime: "2026-10-20T10:00:00.000Z",
    endTime: "2026-10-20T11:00:00.000Z",
    exerciseType: "running",
  });
  const windowStart = Date.parse("2026-10-01T00:00:00.000Z");

  it("skriver nya och redigerade pass men inte oförändrade", () => {
    const written = { a: { version: 5, start: "", end: "2026-10-20T11:00:00.000Z" }, b: { version: 5, start: "", end: "2026-10-20T11:00:00.000Z" } };
    const { upserts } = planHealthWrites([d("a", 5), d("b", 6), d("c", 1)], written, windowStart);
    expect(upserts.map((u) => u.clientRecordId)).toEqual(["b", "c"]);
  });

  it("tar bort pass som försvunnit inom fönstret men rör inte äldre", () => {
    const written = {
      gone: { version: 1, start: "", end: "2026-10-15T11:00:00.000Z" },
      old: { version: 1, start: "", end: "2026-09-01T11:00:00.000Z" },
    };
    expect(planHealthWrites([], written, windowStart).deletes).toEqual(["gone"]);
  });
});

describe("overlapsForeignWorkout", () => {
  const mine = { startTime: "2026-10-20T10:00:00.000Z", endTime: "2026-10-20T11:00:00.000Z" };
  it("känner igen samma pass från klockan", () => {
    expect(overlapsForeignWorkout(mine, [{ start: "2026-10-20T10:05:00.000Z", end: "2026-10-20T10:55:00.000Z" }])).toBe(true);
  });
  it("ignorerar pass vid andra tider", () => {
    expect(overlapsForeignWorkout(mine, [{ start: "2026-10-20T15:00:00.000Z", end: "2026-10-20T16:00:00.000Z" }])).toBe(false);
  });
});
