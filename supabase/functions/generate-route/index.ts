// Genererar rundslingor (loopar) via Google Routes API.
// Input: { lat, lng, distanceKm, activity: "cycling" | "running" | "walking" | "hiking", asphaltOnly?: boolean }
// Output: { routes: [{ distanceKm, points, pavedRatio, surfaces, elevationGainM, elevationLossM }] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LatLng = [number, number];

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

const gatewayHeaders = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY ?? "",
  "Content-Type": "application/json",
  ...extra,
});

const haversine = (a: LatLng, b: LatLng) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/** Flyttar en punkt radiusM meter i given bäring. */
const offset = (origin: LatLng, bearingDeg: number, radiusM: number): LatLng => {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin[0] * Math.PI) / 180;
  const lng1 = (origin[1] * Math.PI) / 180;
  const dr = radiusM / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br));
  const lng2 =
    lng1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
  return [(lat2 * 180) / Math.PI, (((lng2 * 180) / Math.PI + 540) % 360) - 180];
};

/** Google encoded polyline → punkter. */
const decodePolyline = (encoded: string): LatLng[] => {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

const travelModeFor = (activity: string, asphaltOnly: boolean) =>
  activity === "cycling" ? "BICYCLE" : asphaltOnly ? "WALK" : "WALK";

interface RouteResult {
  distanceKm: number;
  points: LatLng[];
}

/** Ber Google om en rundslinga genom ett antal waypoints. */
const computeLoop = async (
  start: LatLng,
  waypoints: LatLng[],
  activity: string,
  asphaltOnly: boolean,
): Promise<RouteResult | null> => {
  const body = {
    origin: { location: { latLng: { latitude: start[0], longitude: start[1] } } },
    destination: { location: { latLng: { latitude: start[0], longitude: start[1] } } },
    intermediates: waypoints.map((w) => ({ location: { latLng: { latitude: w[0], longitude: w[1] } } })),
    travelMode: travelModeFor(activity, asphaltOnly),
    polylineQuality: "HIGH_QUALITY",
    languageCode: "sv-SE",
    units: "METRIC",
  };
  const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: gatewayHeaders({ "X-Goog-FieldMask": "routes.distanceMeters,routes.polyline.encodedPolyline" }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    console.error("routes failed", res.status, (await res.text()).slice(0, 400));
    return null;
  }
  const json = await res.json();
  const route = json?.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if (!encoded) return null;
  const points = decodePolyline(encoded);
  if (points.length < 4) return null;
  return { distanceKm: Number(route.distanceMeters ?? 0) / 1000, points };
};

/** Höjdprofil via Google Elevation API. */
const fetchElevation = async (points: LatLng[]): Promise<{ gain: number; loss: number } | null> => {
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY || points.length < 2) return null;
  const step = Math.max(1, Math.ceil(points.length / 25));
  const sampled = points.filter((_, i) => i % step === 0);
  const path = sampled.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join("|");
  try {
    const res = await fetch(
      `${GATEWAY}/maps/api/elevation/json?path=${encodeURIComponent(path)}&samples=64`,
      { headers: gatewayHeaders(), signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const results: any[] = json?.results ?? [];
    if (results.length < 2) return null;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < results.length; i++) {
      const d = Number(results[i].elevation) - Number(results[i - 1].elevation);
      if (d > 0.7) gain += d;
      else if (d < -0.7) loss += -d;
    }
    return { gain: Math.round(gain), loss: Math.round(loss) };
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "Karttjänsten är inte konfigurerad" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const distanceKm = Number(body.distanceKm);
    const activity = String(body.activity ?? "running");
    const asphaltOnly = Boolean(body.asphaltOnly);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return new Response(JSON.stringify({ error: "Ogiltig position" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(distanceKm) || distanceKm < 0.5 || distanceKm > 200) {
      return new Response(JSON.stringify({ error: "Distansen måste vara 0,5–200 km" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const t0 = Date.now();
    const start: LatLng = [lat, lng];
    const targetKm = distanceKm;

    // Sex riktningar per slinga → jämnare, mer "rund" bana med bättre flyt.
    const baseRadius = (targetKm * 1000) / (2 * Math.PI) * 0.78;
    const dirs = [0, 1, 2, 3].map((i) => (Math.random() * 40 + i * 90) % 360);

    const buildWaypoints = (dir: number, radiusM: number): LatLng[] =>
      [0, 60, 120, 180, 240, 300].map((d, i) =>
        offset(start, dir + d, radiusM * (i % 2 === 0 ? 1 : 0.9)),
      );

    /** Andel av rutten som körs fram och tillbaka på samma sträcka (0 = perfekt flyt). */
    const overlapRatio = (points: LatLng[]): number => {
      const cell = 40; // meter
      const seen = new Map<string, number>();
      let repeats = 0;
      for (const p of points) {
        const key = `${Math.round((p[0] * 111320) / cell)}:${Math.round(
          (p[1] * 111320 * Math.cos((p[0] * Math.PI) / 180)) / cell,
        )}`;
        const n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        if (n > 1) repeats++;
      }
      return repeats / Math.max(points.length, 1);
    };

    /** Antal skarpa vändningar (>150°) – typiskt återvändsgränder. */
    const uTurns = (points: LatLng[]): number => {
      const bearing = (a: LatLng, b: LatLng) =>
        (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      let count = 0;
      const step = Math.max(1, Math.floor(points.length / 200));
      for (let i = step; i < points.length - step; i += step) {
        const a = points[i - step];
        const b = points[i];
        const c = points[i + step];
        if (haversine(a, b) < 15 || haversine(b, c) < 15) continue;
        let diff = Math.abs(bearing(a, b) - bearing(b, c)) % 360;
        if (diff > 180) diff = 360 - diff;
        if (diff > 150) count++;
      }
      return count;
    };

    /** Lägre = bättre: längdavvikelse + straff för överlapp och vändningar. */
    const score = (r: RouteResult): number =>
      Math.abs(r.distanceKm - targetKm) / targetKm +
      overlapRatio(r.points) * 2.5 +
      Math.min(uTurns(r.points), 10) * 0.05;

    const attempt = async (dir: number): Promise<RouteResult | null> => {
      let radius = baseRadius;
      let best: RouteResult | null = null;
      for (let i = 0; i < 3; i++) {
        const r = await computeLoop(start, buildWaypoints(dir, radius), activity, asphaltOnly);
        if (!r) return best;
        if (!best || score(r) < score(best)) best = r;
        const ratio = targetKm / Math.max(r.distanceKm, 0.1);
        const good = ratio > 0.85 && ratio < 1.15 && overlapRatio(r.points) < 0.15;
        if (good) break;
        radius = Math.max(150, Math.min(radius * (ratio > 0.85 && ratio < 1.15 ? 1.05 : ratio), 40000));
      }
      return best;
    };

    const settled = await Promise.all(dirs.map((d) => attempt(d).catch(() => null)));
    console.log("routes ms", Date.now() - t0);

    const found = settled
      .filter((r): r is RouteResult => !!r)
      // Släng uppenbara ut-och-tillbaka-rutter om vi har bättre alternativ
      .sort((a, b) => score(a) - score(b));

    const clean = found.filter((r) => overlapRatio(r.points) < 0.4);
    const pool = clean.length > 0 ? clean : found;

    // Ta bort dubbletter (liknande mittpunkt)
    const unique: RouteResult[] = [];
    for (const r of pool) {
      const mid = r.points[Math.floor(r.points.length / 2)];
      const dup = unique.some((u) => haversine(u.points[Math.floor(u.points.length / 2)], mid) < 300);
      if (!dup) unique.push(r);
      if (unique.length >= 4) break;
    }


    if (unique.length === 0) {
      return new Response(
        JSON.stringify({ routes: [], message: "Hittade inga rundor här just nu. Prova en annan distans." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const elevations = await Promise.all(unique.map((r) => fetchElevation(r.points).catch(() => null)));

    const routes = unique.map((r, i) => ({
      distanceKm: Math.round(r.distanceKm * 100) / 100,
      points: r.points,
      pavedRatio: null,
      surfaces: [],
      elevationGainM: elevations[i]?.gain ?? null,
      elevationLossM: elevations[i]?.loss ?? null,
    }));

    console.log("total ms", Date.now() - t0, "routes", routes.length);

    return new Response(JSON.stringify({ routes, target: distanceKm }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-route error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
