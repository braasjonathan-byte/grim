import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extraColumns,
  HEALTH_EXTRA_COLUMNS,
  healthDaysFromSummary,
  isMissingColumnError,
  parseHealthAccess,
  PERMISSION_GROUPS,
  BACKGROUND_PERMISSIONS,
} from "@/lib/healthSync";

describe("healthDaysFromSummary", () => {
  it("översätter native-raderna och rundar av", () => {
    const rows = healthDaysFromSummary({
      days: [
        { day: "2026-10-24", steps: 8170.4, activeCalories: 512.6, totalCalories: 2980.2, distanceM: 6210.7, sleepMinutes: 431, avgHr: 71.2, minHr: 48, maxHr: 162, restingHr: 52, weightKg: 102.04 },
        { day: "2026-10-23" },
      ],
    });
    expect(rows.map((r) => r.day)).toEqual(["2026-10-23", "2026-10-24"]);
    expect(rows[1]).toMatchObject({ steps: 8170, activeCalories: 513, totalCalories: 2980, distanceM: 6211, avgHeartRate: 71, minHeartRate: 48, maxHeartRate: 162, restingHeartRate: 52, weightKg: 102 });
  });
  it("saknade värden blir null, inte 0, för extravärdena", () => {
    const [row] = healthDaysFromSummary({ days: [{ day: "2026-10-23", steps: 10 }] });
    expect(row.steps).toBe(10);
    expect(row.activeCalories).toBe(0);
    expect(row.weightKg).toBeNull();
    expect(row.restingHeartRate).toBeNull();
  });
  it("tål tomt svar och ogiltiga datum", () => {
    expect(healthDaysFromSummary(undefined)).toEqual([]);
    expect(healthDaysFromSummary({ days: [{ day: "igår" }] })).toEqual([]);
  });
});

describe("extraColumns", () => {
  it("skickar bara kolumner med värde så gammal data inte nollas", () => {
    expect(
      extraColumns({ day: "2026-10-24", steps: 1, activeCalories: 1, sleepMinutes: 0, totalCalories: 2500, weightKg: null, restingHeartRate: 55 }),
    ).toEqual({ total_calories: 2500, resting_heart_rate: 55 });
  });
});

describe("isMissingColumnError", () => {
  it("känner igen att migrationen inte är körd", () => {
    expect(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'total_calories' column of 'health_daily' in the schema cache" })).toBe(true);
    expect(isMissingColumnError({ code: "42703", message: 'column health_daily.weight_kg does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe("behörigheter för nya datatyper", () => {
  it("puls räcker med enbart vilopuls (delvis beviljat)", () => {
    expect(parseHealthAccess({ permissions: { READ_STEPS: true, READ_RESTING_HEART_RATE: true } }).heartRate).toBe(true);
  });
  it("vikt är en egen grupp", () => {
    expect(PERMISSION_GROUPS.weight).toEqual(["READ_WEIGHT"]);
    expect(parseHealthAccess({ permissions: { READ_WEIGHT: true } }).weight).toBe(true);
  });
  it("aktivitet räcker med totala kalorier", () => {
    expect(parseHealthAccess({ permissions: { READ_TOTAL_CALORIES: true } }).activity).toBe(true);
  });
  it("bakgrundsläsning frågas separat och ingår inte i läsflödet", () => {
    const read = Object.values(PERMISSION_GROUPS).flat() as string[];
    for (const p of BACKGROUND_PERMISSIONS) expect(read).not.toContain(p);
  });
});

describe("migrationen för health_daily", () => {
  const dir = resolve(process.cwd(), "supabase/migrations");
  const file = readdirSync(dir).find((f) => f.endsWith("_health_daily_extras.sql"));
  it("finns och lägger till alla kolumner appen skriver", () => {
    expect(file).toBeTruthy();
    const sql = readFileSync(resolve(dir, file!), "utf8");
    for (const column of Object.values(HEALTH_EXTRA_COLUMNS)) expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column} `);
  });
});

describe("dygnsindelning vid sommartid/vintertid", () => {
  it("ger sju unika kalenderdagar över bytet till vintertid", async () => {
    const { localDayStart, dayKey } = await import("@/lib/healthSync");
    const now = new Date(2026, 9, 27, 12, 0); // 27 okt, efter bytet 25 okt
    const start = localDayStart(now, 6);
    expect(dayKey(start)).toBe("2026-10-21");
    const keys = Array.from({ length: 7 }, (_, i) => dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    expect(new Set(keys).size).toBe(7);
    expect(keys[6]).toBe("2026-10-27");
  });
});
