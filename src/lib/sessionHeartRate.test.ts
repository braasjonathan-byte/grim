import { describe, it, expect } from "vitest";
import { summarizeSessionHr, readSessionHr, SESSION_HR_KEY } from "@/lib/sessionHeartRate";
import { __pushHeartRateSampleForTest, getHeartRateSamplesBetween } from "@/lib/heartRate";

describe("sessionHeartRate", () => {
  it("kräver minst en minut data", () => {
    expect(summarizeSessionHr([{ t: 1, bpm: 100 }])).toBeNull();
  });
  it("räknar snitt/max/min och serie", () => {
    const base = Date.now() - 60 * 60 * 1000;
    const samples = Array.from({ length: 200 }, (_, i) => ({ t: base + i * 5000, bpm: 100 + (i % 40) }));
    const r = summarizeSessionHr(samples)!;
    expect(r.max).toBe(139);
    expect(r.min).toBe(100);
    expect(r.series.length).toBeLessThanOrEqual(90);
    expect(r.raw!.length).toBe(200);
    expect(readSessionHr({ [SESSION_HR_KEY]: r })?.avg).toBe(r.avg);
    expect(readSessionHr({})).toBeNull();
  });
  it("rullande pulslogg sparar ett värde per 5 s", () => {
    const t0 = Date.now() - 100000;
    __pushHeartRateSampleForTest(120, t0);
    __pushHeartRateSampleForTest(121, t0 + 1000); // för tätt – hoppas över
    __pushHeartRateSampleForTest(122, t0 + 6000);
    expect(getHeartRateSamplesBetween(t0 - 1, t0 + 7000).map((x) => x.bpm)).toEqual([120, 122]);
  });
});
