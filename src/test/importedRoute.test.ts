import { describe, expect, it } from "vitest";
import { downsampleRoute, importedRoute, toRoutePoints, MAX_ROUTE_POINTS } from "@/lib/importedRoute";

describe("imported routes", () => {
  const route: [number, number][] = [[59.3, 18.0], [59.31, 18.01]];

  it("shows the map only for imported passes", () => {
    expect(importedRoute({ route, routeSource: "health_connect" })).toEqual(route);
    expect(importedRoute({ route, routeSource: "file" })).toEqual(route);
    expect(importedRoute({ route, routeSource: "strava" })).toEqual(route);
  });

  it("hides the map for old GPS-recorded passes (no route source)", () => {
    expect(importedRoute({ route })).toBeUndefined();
    expect(importedRoute({ route, routeSource: "gps" })).toBeUndefined();
    expect(importedRoute(undefined)).toBeUndefined();
  });

  it("rejects broken routes", () => {
    expect(importedRoute({ route: [[59.3, 18.0]], routeSource: "health_connect" })).toBeUndefined();
    expect(importedRoute({ route: [[59.3, "x"], [1, 2]], routeSource: "health_connect" })).toBeUndefined();
  });

  it("converts Health Connect / GPX points and drops invalid ones", () => {
    expect(toRoutePoints([
      { lat: 59.123456789, lng: 18.987654321 },
      { lat: 0, lng: 0 },
      { lat: 91, lng: 18 },
      { lat: 59.2, lon: 18.1 },
    ])).toEqual([[59.12346, 18.98765], [59.2, 18.1]]);
    expect(toRoutePoints([{ lat: 59, lng: 18 }])).toBeNull();
    expect(toRoutePoints(undefined)).toBeNull();
  });

  it("downsamples long routes and keeps both ends", () => {
    const long = Array.from({ length: 5000 }, (_, i) => [59 + i / 1e4, 18] as [number, number]);
    const out = downsampleRoute(long);
    expect(out).toHaveLength(MAX_ROUTE_POINTS);
    expect(out[0]).toEqual(long[0]);
    expect(out[out.length - 1]).toEqual(long[long.length - 1]);
  });
});
