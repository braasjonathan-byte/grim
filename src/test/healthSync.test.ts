import { describe, expect, it } from "vitest";
import { formatSleep, parseHealthAccess, PERMISSION_GROUPS } from "@/lib/healthSync";

describe("parseHealthAccess", () => {
  it("ger status per datatyp", () => {
    const access = parseHealthAccess({
      permissions: {
        READ_STEPS: true,
        READ_ACTIVE_CALORIES: true,
        READ_DISTANCE: true,
        READ_WORKOUTS: true,
        READ_HEART_RATE: false,
        READ_SLEEP: false,
      },
    });
    expect(access).toEqual({ activity: true, workouts: true, heartRate: false, sleep: false });
  });

  it("räcker med en av steg eller kalorier", () => {
    const access = parseHealthAccess({ permissions: { READ_STEPS: true } });
    expect(access.activity).toBe(true);
  });

  it("hanterar svar som kommer som lista", () => {
    const access = parseHealthAccess({
      permissions: [{ READ_STEPS: true }, { READ_ACTIVE_CALORIES: true, READ_DISTANCE: true }, { READ_SLEEP: true }],
    });
    expect(access.activity).toBe(true);
    expect(access.sleep).toBe(true);
  });

  it("tomt svar ger ingen åtkomst", () => {
    expect(parseHealthAccess(undefined)).toEqual({
      activity: false,
      workouts: false,
      heartRate: false,
      sleep: false,
    });
  });

  it("begär sömn som egen grupp", () => {
    expect(PERMISSION_GROUPS.sleep).toContain("READ_SLEEP");
  });
});

describe("formatSleep", () => {
  it("visar timmar och minuter", () => {
    expect(formatSleep(437)).toBe("7 h 17 min");
    expect(formatSleep(480)).toBe("8 h");
    expect(formatSleep(45)).toBe("45 min");
    expect(formatSleep(0)).toBe("0 min");
  });
});
