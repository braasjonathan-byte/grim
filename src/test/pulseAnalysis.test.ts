import { describe, expect, it } from "vitest";
import { buildWorkoutSeries, parseWorkoutSeries, recoveryPoint, seriesFromEvenHr, seriesFromTimedHr, seriesRichness, type WorkoutSeries } from "@/lib/workoutSeries";
import {
  computeSplits, formatPace, hrStats, loadLabel, recoveryFrom, similarTrend, speedSeries, sportKind,
  trainingLoad, zoneIndex, zoneSeconds, type CardioSummary,
} from "@/lib/pulseAnalysis";
import { missingHealthSeriesPatch } from "@/lib/healthWorkoutSeries";

const T0 = Date.UTC(2026, 10, 20, 7, 0, 0);
const sec = (s: number) => T0 + s * 1000;

/** 30 min jämn löpning 5:00/km (3,333 m/s) med puls 150, en mätning per sekund. */
function steadyRun(minutes = 30) {
  const n = minutes * 60;
  return {
    start: T0,
    end: sec(n),
    hr: Array.from({ length: n }, (_, i) => ({ t: sec(i), v: 150 })),
    speed: Array.from({ length: n + 1 }, (_, i) => ({ t: sec(i), v: 1000 / 300 })),
  };
}

describe("buildWorkoutSeries", () => {
  it("samplar ner till högst 600 fack med minst 5 s per fack", () => {
    const s = buildWorkoutSeries(steadyRun(30))!;
    expect(s.step).toBe(5);
    expect(s.hr.length).toBe(360);
    expect(s.hr.every((b) => b === 150)).toBe(true);
    const long = buildWorkoutSeries(steadyRun(180))!;
    expect(long.hr.length).toBeLessThanOrEqual(600);
    expect(long.step).toBe(18);
  });

  it("räknar distans ur fart och ger rätt total", () => {
    const s = buildWorkoutSeries(steadyRun(30))!;
    expect(s.d![s.d!.length - 1]).toBeGreaterThan(5990);
    expect(s.d![s.d!.length - 1]).toBeLessThan(6010);
  });

  it("använder detaljerade distansposter men inte en enda bred post (påhittat jämnt tempo)", () => {
    const base = { start: T0, end: sec(1800), hr: steadyRun(30).hr };
    const fine = buildWorkoutSeries({ ...base, distRecords: Array.from({ length: 30 }, (_, i) => ({ s: sec(i * 60), e: sec(i * 60 + 60), m: 200 })) })!;
    expect(fine.d![fine.d!.length - 1]).toBe(6000);
    const broad = buildWorkoutSeries({ ...base, distRecords: [{ s: T0, e: sec(1800), m: 6000 }] })!;
    expect(broad.d).toBeUndefined();
  });

  it("räknar distans ur rutt med tidsstämplar och hoppar över GPS-hopp", () => {
    // ~111 m per 0,001° latitud, en punkt var 30:e sekund.
    const route = Array.from({ length: 61 }, (_, i) => ({ t: sec(i * 30), lat: 59 + i * 0.001, lng: 18 }));
    route[30] = { ...route[30], lat: 70 }; // orimligt hopp
    const s = buildWorkoutSeries({ start: T0, end: sec(1800), route })!;
    const total = s.d![s.d!.length - 1];
    expect(total).toBeGreaterThan(6000);
    expect(total).toBeLessThan(6700);
  });

  it("tar med watt och kadens när de finns och returnerar null utan puls och distans", () => {
    const power = Array.from({ length: 600 }, (_, i) => ({ t: sec(i), v: 200 }));
    const cadence = Array.from({ length: 600 }, (_, i) => ({ t: sec(i), v: 90 }));
    const s = buildWorkoutSeries({ start: T0, end: sec(600), hr: steadyRun(10).hr, power, cadence })!;
    expect(s.pw!.filter((x) => x === 200).length).toBe(s.hr.length);
    expect(s.cad![0]).toBe(90);
    expect(buildWorkoutSeries({ start: T0, end: sec(600), power })).toBeNull();
  });

  it("sparar återhämtning bara när det finns puls efter passet", () => {
    const run = steadyRun(10);
    const withAfter = buildWorkoutSeries({ ...run, hrAfter: [{ t: run.end + 60000, v: 120 }] })!;
    expect(withAfter.rec).toEqual({ end: 150, at60: 120 });
    expect(buildWorkoutSeries(run)!.rec).toBeUndefined();
    expect(recoveryPoint(run.end, run.hr, [{ t: run.end + 20000, v: 120 }])).toBeNull();
  });
});

describe("sparade serier", () => {
  it("parseWorkoutSeries tål JSON-strängar och avvisar trasiga värden", () => {
    const s = buildWorkoutSeries(steadyRun(10))!;
    expect(parseWorkoutSeries(JSON.stringify(s))?.hr.length).toBe(s.hr.length);
    expect(parseWorkoutSeries({ ...s, v: 2 })).toBeNull();
    expect(parseWorkoutSeries({ ...s, d: [1, 2] })?.d).toBeUndefined();
    expect(parseWorkoutSeries("inte json")).toBeNull();
  });

  it("äldre jämnt fördelad puls och pulsband med tider blir serier", () => {
    const even = seriesFromEvenHr([120, 130, 140, 150], 20)!;
    expect(even.t0).toBe(0);
    expect(even.step).toBe(300);
    const timed = seriesFromTimedHr(Array.from({ length: 120 }, (_, i) => ({ t: sec(i * 5), bpm: 140 })))!;
    expect(timed.t0).toBe(T0);
    expect(hrStats(timed)?.avg).toBe(140);
  });

  it("seriesRichness räknar datakanaler", () => {
    const hrOnly = buildWorkoutSeries({ start: T0, end: sec(600), hr: steadyRun(10).hr });
    const full = buildWorkoutSeries(steadyRun(10));
    expect(seriesRichness(null)).toBe(0);
    expect(seriesRichness(full)).toBeGreaterThan(seriesRichness(hrOnly));
  });
});

describe("zoner och belastning", () => {
  it("zonindex följer % av maxpuls, under Z1 räknas till Z1", () => {
    expect(zoneIndex(80, 200)).toBe(0);
    expect(zoneIndex(119, 200)).toBe(0);
    expect(zoneIndex(120, 200)).toBe(1);
    expect(zoneIndex(165, 200)).toBe(3);
    expect(zoneIndex(185, 200)).toBe(4);
  });

  it("sekunder i zon och Edwards TRIMP", () => {
    const series: Pick<WorkoutSeries, "hr" | "step"> = { step: 60, hr: [...Array(45).fill(125), null] };
    const z = zoneSeconds(series, 200);
    expect(z).toEqual([0, 2700, 0, 0, 0]);
    expect(trainingLoad(z)).toBe(90);
    expect(trainingLoad([600, 600, 600, 600, 600])).toBe(150);
    expect(loadLabel(90)).toBe("Måttlig");
    expect(loadLabel(250)).toBe("Mycket tuff");
  });
});

describe("delsträckor och tempo", () => {
  it("löpning per km med tempo och puls", () => {
    const s = buildWorkoutSeries(steadyRun(30))!;
    const splits = computeSplits(s, 1000);
    expect(splits.length).toBe(6);
    for (const sp of splits) {
      expect(Math.abs(sp.paceSecPerKm - 300)).toBeLessThanOrEqual(2);
      expect(sp.avgHr).toBe(150);
      expect(sp.maxHr).toBe(150);
    }
    expect(formatPace(splits[0].paceSecPerKm)).toMatch(/^(4:59|5:00|5:01)$/);
  });

  it("cykel per 5 km, sista korta delen tas med", () => {
    // 12 km på 24 min = 30 km/h
    const n = 24 * 60;
    const s = buildWorkoutSeries({ start: T0, end: sec(n), speed: Array.from({ length: n + 1 }, (_, i) => ({ t: sec(i), v: 12000 / n })), hr: Array.from({ length: n }, (_, i) => ({ t: sec(i), v: 140 })) })!;
    const splits = computeSplits(s, 5000);
    expect(splits.length).toBe(3);
    expect(splits[0].kmh).toBeCloseTo(30, 0);
    expect(splits[2].distM).toBeGreaterThan(1900);
    expect(splits[2].distM).toBeLessThan(2100);
  });

  it("negativ split syns i tempot", () => {
    const n = 600;
    const speed = Array.from({ length: n + 1 }, (_, i) => ({ t: sec(i), v: i < 300 ? 1000 / 360 : 1000 / 240 }));
    const s = buildWorkoutSeries({ start: T0, end: sec(n), speed, hr: steadyRun(10).hr })!;
    const splits = computeSplits(s, 1000);
    expect(splits[0].paceSecPerKm).toBeGreaterThan(splits[splits.length - 1].paceSecPerKm);
    const v = speedSeries(s)!;
    expect(v[2]! < v[v.length - 3]!).toBe(true);
  });

  it("utan distans blir det inga delsträckor", () => {
    expect(computeSplits({ hr: [150, 150], step: 5 }, 1000)).toEqual([]);
  });
});

describe("återhämtning", () => {
  it("pulsfall första minuten med etikett", () => {
    expect(recoveryFrom({ end: 170, at60: 140 })).toMatchObject({ drop: 30, label: "Mycket bra" });
    expect(recoveryFrom({ end: 160, at60: 145 })).toMatchObject({ drop: 15, label: "Normal" });
    expect(recoveryFrom({ end: 150, at60: 144 })?.label).toBe("Låg");
    expect(recoveryFrom(undefined)).toBeNull();
    expect(recoveryFrom({ end: 150, at60: 40 })).toBeNull();
  });
});

describe("jämförelse med liknande pass", () => {
  const run = (id: string, date: string, avgHr: number, distanceKm = 10, minutes = 50): CardioSummary => ({ id, date, sport: "run", distanceKm, minutes, avgHr });

  it("visar lägre puls än vanligt vid samma tempo som formförbättring", () => {
    const history = [run("a", "2026-10-01", 160), run("b", "2026-10-10", 158), run("c", "2026-10-20", 156),
      run("fast", "2026-10-25", 150, 10, 40), run("bike", "2026-10-26", 130), run("short", "2026-10-27", 140, 3, 15)];
    history[4] = { ...history[4], sport: "bike" };
    const t = similarTrend(run("now", "2026-11-01", 150), history)!;
    expect(t.baselineHr).toBe(158);
    expect(t.deltaBpm).toBe(-8);
    expect(t.verdict).toBe("better");
    expect(t.points.map((p) => p.id)).toEqual(["a", "b", "c", "now"]);
    expect(t.points[3].current).toBe(true);
  });

  it("kräver minst två tidigare liknande pass", () => {
    expect(similarTrend(run("now", "2026-11-01", 150), [run("a", "2026-10-01", 160)])).toBeNull();
    expect(similarTrend(run("now", "2026-11-01", 0), [run("a", "2026-10-01", 160), run("b", "2026-10-02", 160)])).toBeNull();
  });

  it("högre puls än vanligt blir 'worse'", () => {
    const t = similarTrend(run("now", "2026-11-01", 165), [run("a", "2026-10-01", 158), run("b", "2026-10-10", 160)])!;
    expect(t.verdict).toBe("worse");
  });
});

describe("sport", () => {
  it("känner igen löpning och cykling, inte promenad", () => {
    expect(sportKind("Löpning")).toBe("run");
    expect(sportKind("Löpband")).toBe("run");
    expect(sportKind("Cykling")).toBe("bike");
    expect(sportKind("Spinning")).toBe("bike");
    expect(sportKind("Promenad")).toBeNull();
    expect(sportKind("Simning")).toBeNull();
  });
});

describe("omhämtning av gamla hälsopass", () => {
  const cond = (extra: Record<string, unknown> = {}) => JSON.stringify({ time: "30", dist: "6", pulse: "150", ...extra });

  it("lägger till serien på en import som saknar den och rör inget annat", () => {
    const series = buildWorkoutSeries(steadyRun(30))!;
    const patch = missingHealthSeriesPatch({ logged_weights: { "__cond__Löpning": cond(), __hc_meta__: "{}" } }, series)!;
    const c = JSON.parse(String(patch.logged_weights["__cond__Löpning"]));
    expect(c.series.d.length).toBe(series.hr.length);
    expect(c.pulse).toBe("150");
    expect(patch.logged_weights.__hc_meta__).toBe("{}");
  });

  it("skriver inte om när serien redan är lika rik eller raden har ändrats manuellt", () => {
    const series = buildWorkoutSeries(steadyRun(30))!;
    expect(missingHealthSeriesPatch({ logged_weights: { "__cond__Löpning": cond({ series }) } }, series)).toBeNull();
    expect(missingHealthSeriesPatch({ logged_weights: { "__cond__Löpning": cond(), "__cond__Uppvärmning": cond() } }, series)).toBeNull();
    expect(missingHealthSeriesPatch({ logged_weights: { "__cond__Löpning": cond() } }, null)).toBeNull();
  });

  it("uppgraderar en serie med bara puls när distans tillkommer (ny APK)", () => {
    const hrOnly = buildWorkoutSeries({ start: T0, end: sec(1800), hr: steadyRun(30).hr })!;
    const full = buildWorkoutSeries(steadyRun(30))!;
    expect(missingHealthSeriesPatch({ logged_weights: { "__cond__Löpning": cond({ series: hrOnly }) } }, full)).not.toBeNull();
  });
});
