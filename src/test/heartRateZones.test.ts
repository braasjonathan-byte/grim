import { describe, expect, it } from "vitest";
import { maxHeartRateForZones, zoneShares } from "@/lib/hrCurve";

describe("pulszoner från sparad maxpuls", () => {
  it("använder den registrerade maxpulsen före åldersuppskattningen", () => {
    expect(maxHeartRateForZones(180, 30, 175)).toBe(180);
  });

  it("räknar om samma gamla pulsserie när maxpulsen ändras", () => {
    const savedCurve = [120, 150, 170];
    expect(zoneShares(savedCurve, 200)).toEqual([0, 1 / 3, 1 / 3, 1 / 3, 0]);
    expect(zoneShares(savedCurve, 180)).toEqual([0, 1 / 3, 0, 1 / 3, 1 / 3]);
  });

  it("låter en sparad maxpuls styra zonen även när passet toppar högre", () => {
    expect(zoneShares([205], 190)).toEqual([0, 0, 0, 0, 1]);
  });

  it("behåller åldersuppskattningen när maxpuls saknas", () => {
    expect(maxHeartRateForZones(null, 40, 175)).toBe(180);
    expect(maxHeartRateForZones(null, null, 195)).toBe(195);
  });
});
