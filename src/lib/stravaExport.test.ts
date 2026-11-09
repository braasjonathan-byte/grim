import { describe, it, expect } from "vitest";
import { buildStravaActivity, stravaDescription } from "@/lib/stravaExport";
import { buildTcx, manualActivityParams, needsFileUpload, stravaSportType } from "../../supabase/functions/_shared/stravaTcx";
import { hasWriteScope, stravaCredsFromRecord } from "../../supabase/functions/_shared/stravaConfig";

const lw = {
  "__setdata__Bänkpress": JSON.stringify([{ kg: "80", reps: "5" }, { kg: "80", reps: "5" }]),
  "__sets__Bänkpress": "11",
  __first_set_at__: "2026-11-09T17:00:00.000Z",
};
const completion = {
  id: "abc", week: 1, day: "Måndag", done: true, updated_at: "2026-11-09T18:00:00.000Z",
  logged_weights: lw, logged_distance_km: null, logged_pulse: null, user_comment: "Bra pass",
};

describe("Strava-export", () => {
  it("sport_type från Grim-text", () => {
    expect(stravaSportType("Löpning 5 km", false)).toBe("Run");
    expect(stravaSportType("Cykling", false)).toBe("Ride");
    expect(stravaSportType("Överkropp", true)).toBe("WeightTraining");
    expect(stravaSportType("Rörlighet", false)).toBe("Workout");
  });

  it("bygger aktivitet för styrkepass", () => {
    const a = buildStravaActivity(completion as any, { week: 1, day: "Måndag", session_name: "Överkropp", details: "Bänkpress 3x5" }, null)!;
    expect(a.sportType).toBe("WeightTraining");
    expect(a.elapsedSec).toBe(3600);
    expect(a.name).toBe("Överkropp");
    expect(a.description).toContain("Bänkpress: 5×80 kg, 5×80 kg");
    expect(a.description).toContain("Bra pass");
    expect(needsFileUpload({ completionId: "abc", ...a })).toBe(false);
    const p = manualActivityParams({ completionId: "abc", ...a });
    expect(p.external_id).toBe("grim-abc");
    expect(p.elapsed_time).toBe("3600");
  });

  it("importerade pass exporteras inte", () => {
    expect(buildStravaActivity({ ...completion, day: "2026-11-09_strava_123" } as any, undefined, null)).toBeNull();
  });

  it("TCX innehåller puls", () => {
    const t0 = Date.parse("2026-11-09T17:00:00Z");
    const hr = Array.from({ length: 20 }, (_, i) => ({ t: t0 + i * 5000, bpm: 120 + i }));
    const xml = buildTcx({ completionId: "x", name: "Pass", sportType: "Run", startIso: new Date(t0).toISOString(), elapsedSec: 100, hr, route: [[59.3, 18.0], [59.31, 18.01]], distanceM: 1500 });
    expect(xml).toContain('Sport="Running"');
    expect(xml).toContain("<HeartRateBpm><Value>120</Value></HeartRateBpm>");
    expect(xml).toContain("<MaximumHeartRateBpm><Value>139</Value></MaximumHeartRateBpm>");
    expect(xml).toContain("<LatitudeDegrees>");
    expect(xml.match(/<Trackpoint>/g)?.length).toBe(20);
  });

  it("beskrivning hoppar över Strava-kommentar", () => {
    expect(stravaDescription({}, "Strava: Morgonlöpning")).not.toContain("Morgonlöpning");
  });

  it("config och scope", () => {
    expect(stravaCredsFromRecord({ STRAVA_CLIENT_ID: "1", STRAVA_CLIENT_SECRET: " s " })).toEqual({ clientId: "1", clientSecret: "s" });
    expect(stravaCredsFromRecord({ STRAVA_CLIENT_ID: "1" })).toBeNull();
    expect(hasWriteScope("read,activity:read_all,activity:write")).toBe(true);
    expect(hasWriteScope("read,activity:read_all")).toBe(false);
  });
});
