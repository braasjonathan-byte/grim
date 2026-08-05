// Ruttgenerator – modulär, leverantörsoberoende.
//
// Leverantör väljs via miljövariabeln ROUTE_PROVIDER ("ors" | "google").
// Standard: "ors" om ORS_API_KEY finns, annars "google" (connector-gateway).
//
// Input:
//   {
//     lat, lng,                     // startpunkt
//     distanceKm,                   // önskad längd (loop)
//     activity,                     // running | cycling | mtb | walking | hiking
//     routeType,                    // "loop" | "point"
//     destLat?, destLng?,           // krävs för routeType "point"
//     asphaltOnly?, seed?           // seed => ny unik slinga
//   }
// Output:
//   { route: { distanceKm, durationMin, points, elevations, elevationGainM,
//              elevationLossM, pavedRatio, surfaces }, provider }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LatLng = [number, number];

export type Activity = "running" | "cycling" | "mtb" | "walking" | "hiking";

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  points: LatLng[];
  elevations: number[] | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  pavedRatio: number | null;
  surfaces: string[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------- geometri

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

const haversine = (a: LatLng, b: LatLng) => {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

const pathLength = (pts: LatLng[]) => {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
  return d;
};

/** Andel av rutten som går fram och tillbaka på samma sträcka (0–1). */
const overlapRatio = (pts: LatLng[]) => {
  const cell = 0.00035; // ~35 m
  const seen = new Map<string, number>();
  let repeated = 0;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = haversine(pts[i - 1], pts[i]);
    total += len;
    const mLat = (pts[i - 1][0] + pts[i][0]) / 2;
    const mLng = (pts[i - 1][1] + pts[i][1]) / 2;
    const key = `${Math.round(mLat / cell)}:${Math.round(mLng / cell)}`;
    const prev = seen.get(key) ?? 0;
    if (prev > 0) repeated += len;
    seen.set(key, prev + 1);
  }
  return total > 0 ? repeated / total : 0;
};

const elevationStats = (elevs: number[] | null) => {
  if (!elevs || elevs.length < 2) return { gain: null, loss: null };
  let gain = 0;
  let loss = 0;
  let ref = elevs[0];
  for (const e of elevs) {
    const d = e - ref;
    if (Math.abs(d) < 2) continue; // brusfilter
    if (d > 0) gain += d;
    else loss -= d;
    ref = e;
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
};

/** Glesar ut punkter för mindre payload utan att tappa form. */
const simplify = (pts: LatLng[], elevs: number[] | null, maxPoints = 900) => {
  if (pts.length <= maxPoints) return { pts, elevs };
  const step = Math.ceil(pts.length / maxPoints);
  const outP: LatLng[] = [];
  const outE: number[] = [];
  for (let i = 0; i < pts.length; i += step) {
    outP.push(pts[i]);
    if (elevs) outE.push(elevs[i]);
  }
  const last = pts.length - 1;
  if (outP[outP.length - 1] !== pts[last]) {
    outP.push(pts[last]);
    if (elevs) outE.push(elevs[last]);
  }
  return { pts: outP, elevs: elevs ? outE : null };
};

// ------------------------------------------------------- OpenRouteService

const ORS_BASE = "https://api.openrouteservice.org";

const ORS_PROFILE: Record<Activity, string> = {
  running: "foot-walking",
  walking: "foot-walking",
  hiking: "foot-hiking",
  cycling: "cycling-road",
  mtb: "cycling-mountain",
};

const ORS_SURFACE: Record<number, string> = {
  1: "okänt",
  2: "paved",
  3: "unpaved",
  4: "asphalt",
  5: "concrete",
  6: "cobblestone",
  7: "metal",
  8: "wood",
  9: "compacted",
  10: "fine_gravel",
  11: "gravel",
  12: "dirt",
  13: "ground",
  14: "ice",
  15: "paving_stones",
  16: "sand",
  17: "woodchips",
  18: "grass",
  19: "grass_paver",
};

const PAVED_CODES = new Set([2, 4, 5, 15, 6]);

const orsRequest = async (profile: string, body: unknown, key: string) => {
  const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
      Accept: "application/geo+json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORS ${res.status}: ${text.slice(0, 300)}`);
  }
  return await res.json();
};

const parseOrsFeature = (feature: any): RouteResult | null => {
  const coords: number[][] = feature?.geometry?.coordinates ?? [];
  if (coords.length < 2) return null;
  const has3d = coords[0].length > 2;
  const points: LatLng[] = coords.map((c) => [c[1], c[0]] as LatLng);
  const elevs = has3d ? coords.map((c) => Number(c[2])) : null;
  const summary = feature?.properties?.summary ?? {};

  // Underlagsfördelning (extra_info.surface: [fromIdx, toIdx, value])
  let pavedRatio: number | null = null;
  const surfaces: string[] = [];
  const surfaceInfo = feature?.properties?.extras?.surface?.values as number[][] | undefined;
  if (surfaceInfo?.length) {
    let paved = 0;
    let total = 0;
    const counts = new Map<string, number>();
    for (const [from, to, value] of surfaceInfo) {
      const seg = pathLength(points.slice(from, Math.min(to + 1, points.length)));
      total += seg;
      if (PAVED_CODES.has(value)) paved += seg;
      const name = ORS_SURFACE[value] ?? "okänt";
      counts.set(name, (counts.get(name) ?? 0) + seg);
    }
    if (total > 0) pavedRatio = paved / total;
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([name]) => surfaces.push(name));
  }

  const { gain, loss } = elevationStats(elevs);
  const distanceM = Number(summary.distance ?? pathLength(points));
  const durationS = Number(summary.duration ?? 0);
  const s = simplify(points, elevs);

  return {
    distanceKm: distanceM / 1000,
    durationMin: durationS / 60,
    points: s.pts,
    elevations: s.elevs,
    elevationGainM: gain,
    elevationLossM: loss,
    pavedRatio,
    surfaces,
  };
};

const orsOptions = (activity: Activity, asphaltOnly: boolean) => {
  const avoid: string[] = ["ferries"];
  if (asphaltOnly && (activity === "running" || activity === "walking" || activity === "hiking")) {
    avoid.push("steps");
  }
  return { avoid_features: avoid };
};

const orsLoop = async (
  key: string,
  start: LatLng,
  distanceKm: number,
  activity: Activity,
  asphaltOnly: boolean,
  seed: number,
): Promise<RouteResult> => {
  const profile = ORS_PROFILE[activity];
  const targetM = distanceKm * 1000;
  const viaPoints = Math.max(3, Math.min(12, Math.round(distanceKm / 1.5) + 2));

  let best: RouteResult | null = null;
  let bestScore = Infinity;

  // Flera försök: olika seed + längdjustering tills vi ligger inom ±10 %.
  const attempts = [
    { scale: 1, s: seed },
    { scale: 1, s: seed + 977 },
    { scale: 1, s: seed + 4241 },
    { scale: 1, s: seed + 8123 },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const att = attempts[i];
    try {
      const data = await orsRequest(
        profile,
        {
          coordinates: [[start[1], start[0]]],
          elevation: true,
          instructions: false,
          extra_info: ["surface"],
          preference: "recommended",
          units: "m",
          options: {
            ...orsOptions(activity, asphaltOnly),
            round_trip: {
              length: Math.round(targetM * att.scale),
              points: viaPoints,
              seed: att.s,
            },
          },
        },
        key,
      );
      const route = parseOrsFeature(data?.features?.[0]);
      if (!route) continue;

      const deviation = Math.abs(route.distanceKm - distanceKm) / distanceKm;
      const overlap = overlapRatio(route.points);
      const score = deviation * 3 + overlap * 2;
      if (score < bestScore) {
        bestScore = score;
        best = route;
      }
      // Bra nog: inom ±10 % och lite tillbakagång.
      if (deviation <= 0.1 && overlap <= 0.2) break;

      // Justera längden inför nästa försök så vi närmar oss målet.
      const ratio = distanceKm / route.distanceKm;
      if (i + 1 < attempts.length) {
        attempts[i + 1].scale = Math.max(0.6, Math.min(1.6, att.scale * ratio));
      }
    } catch (e) {
      console.error("ORS loop attempt failed", (e as Error).message);
    }
  }

  if (!best) throw new Error("NO_ROUTE");
  return best;
};

const orsPointToPoint = async (
  key: string,
  start: LatLng,
  dest: LatLng,
  activity: Activity,
  asphaltOnly: boolean,
): Promise<{ route: RouteResult; alternatives: RouteResult[] }> => {
  const baseBody = {
    coordinates: [
      [start[1], start[0]],
      [dest[1], dest[0]],
    ],
    elevation: true,
    instructions: false,
    extra_info: ["surface"],
    preference: "recommended",
    units: "m",
    options: orsOptions(activity, asphaltOnly),
  };

  let features: any[] = [];
  try {
    // Be om alternativa vägval så användaren kan jämföra.
    const data = await orsRequest(
      ORS_PROFILE[activity],
      {
        ...baseBody,
        alternative_routes: { target_count: 3, share_factor: 0.6, weight_factor: 1.4 },
      },
      key,
    );
    features = data?.features ?? [];
  } catch (e) {
    console.error("ORS alternatives failed, retrying without", (e as Error).message);
  }

  if (!features.length) {
    const data = await orsRequest(ORS_PROFILE[activity], baseBody, key);
    features = data?.features ?? [];
  }

  const parsed = features
    .map((f) => parseOrsFeature(f))
    .filter((r): r is RouteResult => Boolean(r))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!parsed.length) throw new Error("NO_ROUTE");
  return { route: parsed[0], alternatives: parsed.slice(1) };
};


// ------------------------------------------------------------- Google Maps

const GOOGLE_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const decodePolyline = (encoded: string): LatLng[] => {
  const pts: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
};

const googleHeaders = (lovableKey: string, mapsKey: string, fieldMask: string) => ({
  Authorization: `Bearer ${lovableKey}`,
  "X-Connection-Api-Key": mapsKey,
  "Content-Type": "application/json",
  "X-Goog-FieldMask": fieldMask,
});

const googleElevation = async (
  lovableKey: string,
  mapsKey: string,
  points: LatLng[],
): Promise<number[] | null> => {
  try {
    const sampleCount = Math.min(200, points.length);
    const step = Math.max(1, Math.floor(points.length / sampleCount));
    const sample = points.filter((_, i) => i % step === 0);
    const path = sample.map((p) => `${p[0]},${p[1]}`).join("|");
    const res = await fetch(`${GOOGLE_GATEWAY}/maps/api/elevation/json?locations=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": mapsKey },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const elevs: number[] = (data?.results ?? []).map((r: any) => Number(r.elevation));
    if (!elevs.length) return null;
    // Interpolera tillbaka till full punktlista.
    return points.map((_, i) => elevs[Math.min(elevs.length - 1, Math.floor((i / points.length) * elevs.length))]);
  } catch {
    return null;
  }
};

const googleRoute = async (
  lovableKey: string,
  mapsKey: string,
  waypoints: LatLng[],
  activity: Activity,
): Promise<RouteResult> => {
  const travelMode = activity === "cycling" || activity === "mtb" ? "BICYCLE" : "WALK";
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p[0], longitude: p[1] } } });
  const res = await fetch(`${GOOGLE_GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: googleHeaders(
      lovableKey,
      mapsKey,
      "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    ),
    body: JSON.stringify({
      origin: wp(waypoints[0]),
      destination: wp(waypoints[waypoints.length - 1]),
      intermediates: waypoints.slice(1, -1).slice(0, 23).map(wp),
      travelMode,
      languageCode: "sv-SE",
      units: "METRIC",
      polylineQuality: "HIGH_QUALITY",
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route?.polyline?.encodedPolyline) throw new Error("NO_ROUTE");
  const points = decodePolyline(route.polyline.encodedPolyline);
  const elevs = await googleElevation(lovableKey, mapsKey, points);
  const { gain, loss } = elevationStats(elevs);
  const s = simplify(points, elevs);
  return {
    distanceKm: Number(route.distanceMeters ?? 0) / 1000,
    durationMin: Number(String(route.duration ?? "0s").replace("s", "")) / 60,
    points: s.pts,
    elevations: s.elevs,
    elevationGainM: gain,
    elevationLossM: loss,
    pavedRatio: null,
    surfaces: [],
  };
};

const destinationPoint = (from: LatLng, bearingDeg: number, distM: number): LatLng => {
  const br = toRad(bearingDeg);
  const lat1 = toRad(from[0]);
  const lng1 = toRad(from[1]);
  const dr = distM / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br));
  const lng2 =
    lng1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
  return [(lat2 * 180) / Math.PI, (((lng2 * 180) / Math.PI + 540) % 360) - 180];
};

const googleLoop = async (
  lovableKey: string,
  mapsKey: string,
  start: LatLng,
  distanceKm: number,
  activity: Activity,
  seed: number,
): Promise<RouteResult> => {
  const targetM = distanceKm * 1000;
  let best: RouteResult | null = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < 4; attempt++) {
    const base = ((seed * 73 + attempt * 97) % 360) + attempt * 17;
    const n = Math.max(4, Math.min(8, Math.round(distanceKm / 2) + 3));
    const radius = (targetM / (2 * Math.PI)) * (0.85 + attempt * 0.12);
    const wps: LatLng[] = [start];
    for (let i = 1; i <= n; i++) {
      const bearing = base + (360 / (n + 1)) * i;
      wps.push(destinationPoint(start, bearing, radius));
    }
    wps.push(start);
    try {
      const route = await googleRoute(lovableKey, mapsKey, wps, activity);
      const deviation = Math.abs(route.distanceKm - distanceKm) / distanceKm;
      const score = deviation * 3 + overlapRatio(route.points) * 2;
      if (score < bestScore) {
        bestScore = score;
        best = route;
      }
      if (deviation <= 0.1) break;
    } catch (e) {
      console.error("Google loop attempt failed", (e as Error).message);
    }
  }
  if (!best) throw new Error("NO_ROUTE");
  return best;
};

// ------------------------------------------------------------------ server

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return json({ error: "Ogiltig startpunkt" }, 400);
    }

    const allowed: Activity[] = ["running", "cycling", "mtb", "walking", "hiking"];
    const activity: Activity = allowed.includes(body?.activity) ? body.activity : "running";
    const routeType: "loop" | "point" = body?.routeType === "point" ? "point" : "loop";
    const asphaltOnly = Boolean(body?.asphaltOnly);
    const seed = Number.isFinite(Number(body?.seed)) ? Math.abs(Math.round(Number(body.seed))) : 1;

    const distanceKm = Math.max(0.5, Math.min(200, Number(body?.distanceKm) || 5));

    const start: LatLng = [lat, lng];
    let dest: LatLng | null = null;
    if (routeType === "point") {
      const dLat = Number(body?.destLat);
      const dLng = Number(body?.destLng);
      if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
        return json({ error: "Destination saknas" }, 400);
      }
      dest = [dLat, dLng];
    }

    const ORS_API_KEY = Deno.env.get("ORS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const configured = (Deno.env.get("ROUTE_PROVIDER") ?? "").toLowerCase();
    const provider = configured || (ORS_API_KEY ? "ors" : "google");

    let route: RouteResult;
    let alternatives: RouteResult[] = [];
    try {
      if (provider === "ors") {
        if (!ORS_API_KEY) return json({ error: "Ruttjänsten är inte konfigurerad (ORS_API_KEY saknas)" }, 500);
        if (routeType === "point") {
          const res = await orsPointToPoint(ORS_API_KEY, start, dest!, activity, asphaltOnly);
          route = res.route;
          alternatives = res.alternatives;
        } else {
          route = await orsLoop(ORS_API_KEY, start, distanceKm, activity, asphaltOnly, seed);
        }
      } else {
        if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
          return json({ error: "Karttjänsten är inte konfigurerad" }, 500);
        }
        route =
          routeType === "point"
            ? await googleRoute(LOVABLE_API_KEY, GOOGLE_MAPS_API_KEY, [start, dest!], activity)
            : await googleLoop(LOVABLE_API_KEY, GOOGLE_MAPS_API_KEY, start, distanceKm, activity, seed);
      }

    } catch (e) {
      const msg = (e as Error).message ?? "";
      console.error("route generation failed", msg);
      if (routeType === "loop") {
        const suggestion = distanceKm > 6 ? Math.round(distanceKm / 2) : Math.round(distanceKm * 2);
        return json(
          {
            error: "NO_ROUTE",
            message: `Hittade ingen bra slinga på ${distanceKm} km här. Prova ${suggestion} km eller en annan aktivitet.`,
            suggestedDistanceKm: suggestion,
          },
          404,
        );
      }
      return json({ error: "NO_ROUTE", message: "Hittade ingen rutt till destinationen." }, 404);
    }

    const deviation =
      routeType === "loop" ? Math.abs(route.distanceKm - distanceKm) / distanceKm : 0;

    return json({
      provider,
      route,
      alternatives,

      withinTolerance: deviation <= 0.1,
      message:
        deviation > 0.1
          ? `Närmaste slingan blev ${route.distanceKm.toFixed(1)} km – vägnätet här tillåter inte exakt ${distanceKm} km.`
          : null,
    });
  } catch (e) {
    console.error("generate-route error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
