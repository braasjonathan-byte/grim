/**
 * Kartor visas bara för pass som importerats med en rutt (Health Connect,
 * en GPX/TCX/FIT-fil eller tidigare Strava-import). Grim spelar inte längre in
 * pass med GPS; gamla egna GPS-pass behåller sin data men visas utan karta.
 */
export type RoutePoint = [number, number]; // [lat, lng]

export const IMPORTED_ROUTE_SOURCES = ["health_connect", "file", "strava"] as const;
export type ImportedRouteSource = (typeof IMPORTED_ROUTE_SOURCES)[number];

/** Max antal punkter som sparas per pass (håller logged_weights litet). */
export const MAX_ROUTE_POINTS = 500;

const isValidPoint = (lat: unknown, lng: unknown): boolean =>
  typeof lat === "number" && typeof lng === "number" &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** Jämnt nedsamplad rutt; första och sista punkten behålls alltid. */
export function downsampleRoute(points: RoutePoint[], max = MAX_ROUTE_POINTS): RoutePoint[] {
  if (points.length <= max) return points;
  const out: RoutePoint[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5; // ~1 m

/** Gör om punkter med lat/lng (Health Connect, GPX-parser) till en sparbar rutt. */
export function toRoutePoints(
  raw: ReadonlyArray<{ lat?: unknown; lng?: unknown; lon?: unknown }> | null | undefined,
  max = MAX_ROUTE_POINTS,
): RoutePoint[] | null {
  if (!Array.isArray(raw)) return null;
  const pts: RoutePoint[] = [];
  for (const p of raw) {
    const lat = p?.lat;
    const lng = p?.lng ?? p?.lon;
    if (isValidPoint(lat, lng)) pts.push([round(lat as number), round(lng as number)]);
  }
  return pts.length > 1 ? downsampleRoute(pts, max) : null;
}

/** Rutten som ska ritas på kartan – bara för importerade pass. */
export function importedRoute(data: { route?: unknown; routeSource?: unknown } | null | undefined): RoutePoint[] | undefined {
  if (!data || !IMPORTED_ROUTE_SOURCES.includes(data.routeSource as ImportedRouteSource)) return undefined;
  const r = data.route;
  if (!Array.isArray(r) || r.length < 2) return undefined;
  const ok = r.every((p) => Array.isArray(p) && isValidPoint(p[0], p[1]));
  return ok ? (r as RoutePoint[]) : undefined;
}
