// Genererar rundslingor (loopar) eller punkt-till-punkt-rutter via Google Routes API.
// Input loop: { lat, lng, distanceKm, activity: "cycling" | "running" | "walking" | "hiking", asphaltOnly?: boolean }
// Input destination: { lat, lng, destLat, destLng, activity, asphaltOnly? }
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

const travelModeFor = (activity: string) => (activity === "cycling" ? "BICYCLE" : "WALK");

interface RouteResult {
  distanceKm: number;
  points: LatLng[];
}

/** Anropar Google Routes API för en rutt (loop om destination === start). */
const computeRoute = async (
  start: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  activity: string,
  _asphaltOnly: boolean,
): Promise<RouteResult | null> => {
  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: start[0], longitude: start[1] } } },
    destination: { location: { latLng: { latitude: destination[0], longitude: destination[1] } } },
    intermediates: waypoints.map((w) => ({ location: { latLng: { latitude: w[0], longitude: w[1] } } })),
    travelMode: travelModeFor(activity),
    polylineQuality: "HIGH_QUALITY",
    languageCode: "sv-SE",
    units: "METRIC",
  };
  // Routes API stödjer inga avoid-modifiers för WALK/BICYCLE – lämnas därför tomt.
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

const computeLoop = (
  start: LatLng,
  waypoints: LatLng[],
  activity: string,
  asphaltOnly: boolean,
): Promise<RouteResult | null> => computeRoute(start, start, waypoints, activity, asphaltOnly);


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
    const destLat = Number(body.destLat);
    const destLng = Number(body.destLng);
    const hasDestination =
      Number.isFinite(destLat) && Number.isFinite(destLng) && Math.abs(destLat) <= 90 && Math.abs(destLng) <= 180;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return new Response(JSON.stringify({ error: "Ogiltig position" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const t0 = Date.now();
    const start: LatLng = [lat, lng];

    // ---- Punkt-till-punkt-rutt mot vald destination ----
    if (hasDestination) {
      const r = await computeRoute(start, [destLat, destLng], [], activity, asphaltOnly);
      if (!r) {
        return new Response(
          JSON.stringify({ routes: [], message: "Kunde inte hitta en väg till destinationen för den här aktiviteten." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const elev = await fetchElevation(r.points).catch(() => null);
      console.log("destination route", r.distanceKm.toFixed(2), "km,", Date.now() - t0, "ms");
      return new Response(
        JSON.stringify({
          routes: [
            {
              distanceKm: Math.round(r.distanceKm * 100) / 100,
              points: r.points,
              pavedRatio: null,
              surfaces: [],
              elevationGainM: elev?.gain ?? null,
              elevationLossM: elev?.loss ?? null,
            },
          ],
          mode: "destination",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Number.isFinite(distanceKm) || distanceKm < 0.5 || distanceKm > 200) {
      return new Response(JSON.stringify({ error: "Distansen måste vara 0,5–200 km" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetKm = distanceKm;

    // Slumpade riktningar → större chans att hitta ett vägnät med bra flyt.
    // Vägrutter blir betydligt längre än geometrins omkrets. En försiktig
    // startradie håller Malmös kust-waypoints på land; binärsökningen växer vid behov.
    const baseRadius = (targetKm * 1000) / (2 * Math.PI) * 0.52;
    const randomDirs = (n: number, avoid: number[] = []): number[] => {
      const out: number[] = [];
      const spread = 360 / n;
      for (let i = 0; i < n; i++) {
        let d = (Math.random() * spread * 0.8 + i * spread) % 360;
        // Håll avstånd till riktningar som redan gav dåligt resultat.
        if (avoid.some((a) => Math.min(Math.abs(a - d), 360 - Math.abs(a - d)) < 25)) {
          d = (d + spread / 2) % 360;
        }
        out.push(d);
      }
      return out;
    };

    // Fler waypoints = mer kontroll över Google Routes och färre spets-artefakter.
    // Risken för nål-spetsar ökar med distansen → adaptiv täthet.
    const baseWaypointCount = targetKm > 15 ? 10 : 8;

    // zig = svagt blomformad bana (in och ut mot centrum) → längre runda på samma
    // radie, används när större radie bara ger vattenpassager (kustnära lägen).
    // Inre faktorn hålls hög (0,7) – djupa "kronblad" skapar just de nål-spetsar
    // vi vill undvika.
    const buildWaypoints = (dir: number, radiusM: number, zig = false, count = baseWaypointCount): LatLng[] => {
      const n = zig ? Math.max(12, count) : count;
      const step = 360 / n;
      return Array.from({ length: n }, (_, i) =>
        offset(start, dir + i * step, radiusM * (zig ? (i % 2 === 0 ? 1 : 0.7) : i % 2 === 0 ? 1 : 0.92)),
      );
    };




    /**
     * Andel av rutten som körs fram och tillbaka på samma sträcka (0 = perfekt flyt).
     * Endast unika cellbesök räknas – på så vis straffas verkliga återbesök,
     * inte tät punktupplösning inom samma cell.
     */
    const ovCache = new WeakMap<object, number>();
    const overlapRatio = (points: LatLng[]): number => {
      const hit = ovCache.get(points);
      if (hit !== undefined) return hit;
      const val = computeOverlapRatio(points);
      ovCache.set(points, val);
      return val;
    };
    const computeOverlapRatio = (points: LatLng[]): number => {

      const cell = 40; // meter
      const seen = new Set<string>();
      let visits = 0;
      let repeats = 0;
      let lastKey = "";
      for (const p of points) {
        const key = `${Math.round((p[0] * 111320) / cell)}:${Math.round(
          (p[1] * 111320 * Math.cos((p[0] * Math.PI) / 180)) / cell,
        )}`;
        if (key === lastKey) continue;
        lastKey = key;
        visits++;
        if (seen.has(key)) repeats++;
        else seen.add(key);
      }
      return repeats / Math.max(visits, 1);
    };

    /** Kompassbäring mellan två punkter i grader (0–360). */
    const bearingOf = (a: LatLng, b: LatLng): number => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
      const x =
        Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
        Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
      return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
    };

    interface Spike {
      apex: LatLng; // yttersta punkten på spetsen
      lengthM: number; // längd på ut-och-tillbaka-sträckan (enkel riktning)
    }

    /**
     * Riktningsbaserad detektering av "ut på udde/återvändsgränd och tillbaka".
     * Resamplar rutten var 25:e meter och letar efter punkter som ligger nära
     * en annan del av rutten men färdas i nära motsatt riktning (>160°).
     * Returnerar både total andel och varje enskild spets (med apex + längd),
     * så att en kort men tydlig nål-spets kan underkänna en rutt på egen hand.
     */
    const obCache = new WeakMap<object, { ratio: number; spikes: Spike[] }>();
    const analyseOutAndBack = (points: LatLng[]): { ratio: number; spikes: Spike[] } => {
      const cached = obCache.get(points);
      if (cached) return cached;
      const result = computeOutAndBack(points);
      obCache.set(points, result);
      return result;
    };

    const computeOutAndBack = (points: LatLng[]): { ratio: number; spikes: Spike[] } => {


      const STEP = 25; // m mellan samplade punkter
      const NEAR = 60; // m maxavstånd för att räknas som "samma sträcka"
      const MIN_GAP = 150; // m minsta avstånd längs rutten mellan de två passagerna
      const MIN_RUN = 3; // ~75 m räcker: även en kort, tydlig nål ska hittas
      const NEEDLE_MAX_GAP = 4000; // tur och retur för en spets på högst 2 km enkel väg



      // Resampling med jämnt avstånd
      const sampled: LatLng[] = [];
      const along: number[] = [];
      let acc = 0;
      let carried = 0;
      sampled.push(points[0]);
      along.push(0);
      for (let i = 1; i < points.length; i++) {
        const seg = haversine(points[i - 1], points[i]);
        acc += seg;
        carried += seg;
        if (carried >= STEP) {
          carried = 0;
          sampled.push(points[i]);
          along.push(acc);
        }
      }
      const n = sampled.length;
      if (n < 8) return { ratio: 0, spikes: [] };

      const heading: number[] = sampled.map((_, i) =>
        bearingOf(sampled[Math.max(0, i - 1)], sampled[Math.min(n - 1, i + 1)]),
      );

      // Rumslig hash för snabb närhetssökning
      const cell = NEAR;
      const keyOf = (p: LatLng) =>
        `${Math.round((p[0] * 111320) / cell)}:${Math.round(
          (p[1] * 111320 * Math.cos((p[0] * Math.PI) / 180)) / cell,
        )}`;
      const grid = new Map<string, number[]>();
      sampled.forEach((p, i) => {
        const k = keyOf(p);
        const arr = grid.get(k);
        if (arr) arr.push(i);
        else grid.set(k, [i]);
      });
      const neighbours = (p: LatLng): number[] => {
        const lat = Math.round((p[0] * 111320) / cell);
        const lng = Math.round((p[1] * 111320 * Math.cos((p[0] * Math.PI) / 180)) / cell);
        const res: number[] = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const arr = grid.get(`${lat + dx}:${lng + dy}`);
            if (arr) res.push(...arr);
          }
        }
        return res;
      };

      const flags: boolean[] = [];
      const needleSpikes: Spike[] = [];
      for (let i = 0; i < n; i++) {
        const p = sampled[i];
        let hit = false;
        for (const j of neighbours(p)) {
          const routeGap = Math.abs(along[j] - along[i]);
          if (routeGap < MIN_GAP) continue;
          if (haversine(p, sampled[j]) > NEAR) continue;
          let diff = Math.abs(heading[i] - heading[j]) % 360;
          if (diff > 180) diff = 360 - diff;
          if (diff > 150) {
            hit = true;
            // Två närliggande passager i motsatt riktning omsluter spetsen.
            // Mittpunkten längs rutten mellan dem är dess apex. Registrera även
            // korta spetsar separat så de inte kan döljas av totalruttens längd.
            if (j > i && routeGap <= NEEDLE_MAX_GAP) {
              // Hitta den verkliga vändpunkten mellan de två motriktade
              // passagerna. Mittpunkten räcker inte när Google rundar av apex.
              let apexIdx = i;
              let sharpestTurn = 0;
              const turnWindow = 3; // cirka 75 m på vardera sida
              for (let k = i + turnWindow; k <= j - turnWindow; k++) {
                let turn = Math.abs(
                  bearingOf(sampled[k - turnWindow], sampled[k]) -
                    bearingOf(sampled[k], sampled[k + turnWindow]),
                ) % 360;
                if (turn > 180) turn = 360 - turn;
                if (turn > sharpestTurn) {
                  sharpestTurn = turn;
                  apexIdx = k;
                }
              }
              // Närliggande, motriktade stråk + en lokal vändning >150° krävs.
              // Det undviker falska träffar från vanliga parallellgator.
              if (sharpestTurn > 150) {
                const candidate = { apex: sampled[apexIdx], lengthM: routeGap / 2 };
                if (!needleSpikes.some((s) => haversine(s.apex, candidate.apex) < 150)) {
                  needleSpikes.push(candidate);
                }
              }
            }
            break;
          }
        }
        flags.push(hit);
      }

      // Endast sammanhängande sträckor räknas – enstaka träffar är korsningar,
      // rondeller eller parallellgator, inte en verklig återvändsgränd.
      let flagged = 0;
      let run = 0;
      const spikes: Spike[] = [];
      for (let i = 0; i <= n; i++) {
        if (i < n && flags[i]) {
          run++;
        } else {
          if (run >= MIN_RUN) {
            flagged += run;
            const from = i - run;
            const mid = Math.min(n - 1, from + Math.floor(run / 2));
            spikes.push({ apex: sampled[mid], lengthM: (run * STEP) / 2 });
          }
          run = 0;
        }
      }

      for (const spike of needleSpikes) {
        if (!spikes.some((s) => haversine(s.apex, spike.apex) < 150)) spikes.push(spike);
      }
      return { ratio: flagged / n, spikes };
    };

    const outAndBackRatio = (points: LatLng[]): number => analyseOutAndBack(points).ratio;

    /** Längsta enskilda nål-spetsen i meter (enkel riktning). */
    const longestSpikeM = (points: LatLng[]): number =>
      analyseOutAndBack(points).spikes.reduce((m, s) => Math.max(m, s.lengthM), 0);



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

    // Clean-nivån är förstahandsvalet. Acceptable används först efter att alla
    // Google-lager har körts och ingen clean-rutt hittats.
    const OUT_AND_BACK_MAX = 0.16;
    // En enda tydlig nål-spets räcker för att underkänna en rutt, oavsett andel.
    const SPIKE_MAX_M = 380;
    const ACCEPTABLE_OUT_AND_BACK_MAX = 0.22;
    const ACCEPTABLE_SPIKE_MAX_M = 500;

    type QualityLevel = "clean" | "acceptable" | "none";

    const qualityLevel = (r: RouteResult): QualityLevel => {
      const deviation = Math.abs(r.distanceKm - targetKm) / targetKm;
      const overlap = overlapRatio(r.points);
      const outAndBack = outAndBackRatio(r.points);
      const spike = longestSpikeM(r.points);
      if (
        deviation <= 0.25 &&
        overlap < 0.25 &&
        outAndBack < OUT_AND_BACK_MAX &&
        spike <= SPIKE_MAX_M
      ) return "clean";
      if (
        deviation <= 0.30 &&
        overlap < 0.35 &&
        outAndBack < ACCEPTABLE_OUT_AND_BACK_MAX &&
        spike <= ACCEPTABLE_SPIKE_MAX_M
      ) return "acceptable";
      return "none";
    };

    /** Lägre = bättre. Ut-och-tillbaka och nål-spetsar straffas mycket hårt. */
    const scoreCache = new WeakMap<object, number>();
    const score = (r: RouteResult): number => {
      const hit = scoreCache.get(r.points);
      if (hit !== undefined) return hit;
      const { ratio, spikes } = analyseOutAndBack(r.points);
      const longest = spikes.reduce((m, s) => Math.max(m, s.lengthM), 0);
      const qualityPenalty = qualityLevel(r) === "clean" ? 0 : qualityLevel(r) === "acceptable" ? 5 : 20;
      const val =
        qualityPenalty +
        Math.abs(r.distanceKm - targetKm) / targetKm +
        overlapRatio(r.points) * 2.5 +
        ratio * 12 +
        Math.min(longest / SPIKE_MAX_M, 8) * 1.5 +
        Math.min(uTurns(r.points), 10) * 0.05;
      scoreCache.set(r.points, val);
      return val;
    };



    /**
     * Konvergerar radien mot måldistansen. Håller reda på den minsta radie som
     * gav för lång rutt och den största som gav för kort rutt – när båda finns
     * används binärsökning (snabb konvergens), annars en dämpad ratio-skalning.
     */
    /**
     * Lägger till tre lokala waypoints runt en spets utan att ta bort någon av
     * grundpunkterna. Därmed behålls rundans form samtidigt som Google tvingas
     * förbi återvändsgränden i en båge.
     * vilket tvingar Google Routes att gå runt det problematiska området
     * istället för att gå in och vända.
     */
    const repairWaypoints = (wps: LatLng[], apex: LatLng, radiusM: number): LatLng[] => {
      let idx = 0;
      let bestD = Infinity;
      wps.forEach((w, i) => {
        const d = haversine(w, apex);
        if (d < bestD) {
          bestD = d;
          idx = i;
        }
      });
      const br = bearingOf(start, apex);
      const lateral = Math.min(Math.max(250, radiusM * 0.18), 750);
      // En sammanhängande halvbåge på insidan av apex tvingar rutten runt
      // återvändsgränden. Välj ordning efter föregående grund-waypoint så bågen
      // inte korsar sig eller tvingar fram ännu en U-sväng.
      // Alla tre punkter ligger på insidan av apex. ±90° låg kvar i samma
      // radialzon och kunde därför fortfarande ledas ut på udden.
      const sideA = offset(apex, (br + 120) % 360, lateral);
      const inside = offset(apex, (br + 180) % 360, lateral);
      const sideB = offset(apex, (br + 240) % 360, lateral);
      const previous = wps[(idx - 1 + wps.length) % wps.length];
      const [a, c] = haversine(previous, sideA) <= haversine(previous, sideB)
        ? [sideA, sideB]
        : [sideB, sideA];
      const out = [...wps];
      out.splice(idx, 0, a, inside, c);
      return out;
    };

    const attempt = async (dir: number): Promise<RouteResult | null> => {
      let radius = baseRadius;
      let best: RouteResult | null = null;
      let lowRadius: number | null = null; // ger för kort rutt
      let highRadius: number | null = null; // ger för lång rutt
      let failures = 0;
      let absurd = 0;
      let zig = false;
      let waypointCount = baseWaypointCount;
      let repairs: LatLng[] = []; // apex-punkter som ska rundas
      let repairRounds = 0;

      const waypointsFor = (): LatLng[] => {
        let wps = buildWaypoints(dir, radius, zig, waypointCount);
        for (const apex of repairs) wps = repairWaypoints(wps, apex, radius);
        return wps.slice(0, 25); // Routes API-tak för mellanpunkter
      };

      for (let i = 0; i < 12; i++) {
        let r: RouteResult | null = null;
        try {
          r = await computeLoop(start, waypointsFor(), activity, asphaltOnly);
        } catch (err) {
          console.log(`dir ${Math.round(dir)}° radie ${Math.round(radius)} m: nätverksfel`, String(err));
        }
        if (!r) {
          failures++;
          console.log(
            `dir ${Math.round(dir)}° radie ${Math.round(radius)} m: ingen rutt (troligen waypoint i vatten) – försök ${failures}`,
          );
          if (failures >= 4) return best;
          if (repairs.length) repairs = repairs.slice(0, -1);
          else radius = Math.max(120, radius * 0.6);
          continue;
        }
        const ov = overlapRatio(r.points);
        const { ratio: ob, spikes } = analyseOutAndBack(r.points);
        const longest = spikes.reduce((m, s) => Math.max(m, s.lengthM), 0);
        console.log(
          `dir ${Math.round(dir)}° försök ${i + 1}${zig ? " (zig)" : ""}: ${waypointCount} wp${repairs.length ? `+${repairs.length} rep` : ""}, radie ${Math.round(radius)} m → ${r.distanceKm.toFixed(2)} km ` +
            `(mål ${targetKm} km, avvikelse ${(((r.distanceKm - targetKm) / targetKm) * 100).toFixed(1)} %, ` +
            `overlap ${(ov * 100).toFixed(0)} %, ut-och-tillbaka ${(ob * 100).toFixed(0)} %, längsta spets ${Math.round(longest)} m)`,
        );

        // Orimligt lång rutt = waypoint hamnade i vatten och Google rutade runt
        // hela viken/över bron. Använd den varken som förslag eller som bracket –
        // krymp radien försiktigt istället för att binärsöka mot ett skenvärde.
        if (r.distanceKm > targetKm * 2.2) {
          absurd++;
          console.log(
            `dir ${Math.round(dir)}° radie ${Math.round(radius)} m: orimlig rutt (${r.distanceKm.toFixed(0)} km) – troligen vattenpassage`,
          );
          // Radien når ut i vattnet → lås taket och sök nedåt istället.
          highRadius = highRadius == null ? radius : Math.min(highRadius, radius);
          if (absurd >= 3 && !zig) {
            zig = true;
            radius = Math.max(120, lowRadius ?? radius * 0.6);
            console.log(`dir ${Math.round(dir)}°: byter till blomformad bana (radie ${Math.round(radius)} m)`);
          } else {
            radius = Math.max(120, lowRadius != null ? (radius + lowRadius) / 2 : radius * 0.8);
          }
          continue;
        }



        if (!best || score(r) < score(best)) best = r;

        const rel = (r.distanceKm - targetKm) / targetKm;
        const spikeFree = longest <= SPIKE_MAX_M && ob < OUT_AND_BACK_MAX;
        if (Math.abs(rel) < 0.07 && ov < 0.15 && spikeFree) break;

        // Distansen sitter men rutten har en nål-spets → sätt ut extra waypoints
        // kring spetsen istället för att ändra radie/bäring.
        // Reparera först när distansen är i rätt härad. Att lägga lokala bågar
        // på en 500–1100 km vattenomväg slösar annars alla tre reparationsvarv.
        if (!spikeFree && Math.abs(rel) <= 0.25 && repairRounds < 3) {
          repairRounds++;
          const worst = [...spikes].sort((a, b) => b.lengthM - a.lengthM)[0];
          if (worst) {
            // Reparera den aktuella värsta spetsen. Ersätt en gammal träff i
            // samma område i stället för att stapla identiska bågar ovanpå varandra.
            repairs = [
              ...repairs.filter((apex) => haversine(apex, worst.apex) >= 250),
              worst.apex,
            ].slice(-3);
          }
          const effectiveCount = Math.min(25, waypointCount + repairs.length * 3);
          console.log(
            `dir ${Math.round(dir)}°: spets hittad (${Math.round(longest)} m) – lägger till 3 extra waypoints runt den (reparation ${repairRounds}/3, totalt ${effectiveCount} wp)`,
          );
          continue;
        }


        if (rel < 0) lowRadius = Math.max(lowRadius ?? 0, radius);
        else highRadius = highRadius == null ? radius : Math.min(highRadius, radius);


        let next: number;
        if (lowRadius != null && highRadius != null && highRadius > lowRadius) {
          next = (lowRadius + highRadius) / 2;
        } else {
          // Dämpad skalning: undviker att skjuta förbi målet i glesa vägnät.
          const ratio = targetKm / Math.max(r.distanceKm, 0.1);
          next = radius * Math.max(0.4, Math.min(2.5, 1 + (ratio - 1) * 0.85));
        }
        radius = Math.max(120, Math.min(next, 60000));
      }
      return best;
    };


    /**
     * Kör alla riktningar, men högst fyra samtidigt. Det behåller envisheten och
     * anropsbudgeten utan att slå i edge-funktionens CPU-/minnesgräns.
     */
    const runPass = async (dirsToTry: number[]): Promise<{ dir: number; route: RouteResult }[]> => {
      const found: { dir: number; route: RouteResult }[] = [];
      for (let offset = 0; offset < dirsToTry.length; offset += 2) {
        const settled = await Promise.all(
          dirsToTry.slice(offset, offset + 2).map(async (d) => {
          const route = await attempt(d).catch((e) => {
            console.log(`dir ${Math.round(d)}° kraschade:`, String(e));
            return null;
          });
          return route ? { dir: d, route } : null;
          }),
        );
        found.push(...settled.filter((x): x is { dir: number; route: RouteResult } => !!x));
        if (found.some((x) => isClean(x.route))) break;
      }
      return found;
    };

    const isClean = (r: RouteResult) => qualityLevel(r) === "clean";
    const isAcceptable = (r: RouteResult) => qualityLevel(r) === "acceptable";

    const allResults: { dir: number; route: RouteResult }[] = [];
    const badDirs: number[] = [];

    // Lager 1
    let pass = await runPass(randomDirs(6));
    allResults.push(...pass);

    // Lager 2: för få riktningar gav något resultat alls → helt nya riktningar.
    if (allResults.length < 2) {
      console.log("för få riktningar lyckades – kör om med 8 nya bäringar");
      pass = await runPass(randomDirs(8, allResults.map((r) => r.dir)));
      allResults.push(...pass);
    }

    // Lager 3–4: envishet före felmeddelande – nya bäringar tills en ren runda hittas.
    for (const layer of [6, 6]) {
      if (allResults.some((r) => isClean(r.route))) break;
      badDirs.push(...allResults.map((r) => r.dir));
      console.log(
        `inga rena rundor ännu – kör om med ${layer} nya bäringar (undviker`,
        badDirs.map((d) => Math.round(d)).join(", "),
        "°)",
      );
      pass = await runPass(randomDirs(layer, badDirs));
      allResults.push(...pass);
    }


    console.log("routes ms", Date.now() - t0);

    const found = allResults.map((r) => r.route).sort((a, b) => score(a) - score(b));

    // Graderad fallback: acceptable får aldrig konkurrera ut en clean-rutt.
    let selectedQuality: QualityLevel = found.some(isClean)
      ? "clean"
      : found.some(isAcceptable)
        ? "acceptable"
        : "none";
    let selectedSource: "google" | "osrm" | "none" = selectedQuality === "none" ? "none" : "google";
    let pool = selectedQuality === "clean" ? found.filter(isClean) : found.filter(isAcceptable);

    /**
     * Sista säkerhetsnätet: OSRM Trip optimerar ordningen på punkterna till en
     * verklig rundtur. Google är alltid förstahandskälla och OSRM anropas bara
     * när samtliga Google-lager saknar både clean och acceptable resultat.
     */
    if (pool.length === 0) {
      const profile = activity === "cycling" ? "cycling" : "foot";
      const osrmWaypoints = buildWaypoints(Math.random() * 360, baseRadius, false, Math.max(8, baseWaypointCount));
      const coordinates = [start, ...osrmWaypoints]
        .map(([pointLat, pointLng]) => `${pointLng.toFixed(6)},${pointLat.toFixed(6)}`)
        .join(";");
      const osrmUrl =
        `https://router.project-osrm.org/trip/v1/${profile}/${coordinates}` +
        "?roundtrip=true&source=first&geometries=polyline&overview=full&steps=false";
      console.log(`OSRM fallback används (profil ${profile}) efter att Google saknade användbar rutt`);
      try {
        const osrmResponse = await fetch(osrmUrl, {
          headers: { "User-Agent": "GrimRouteBuilder/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (!osrmResponse.ok) {
          console.error("OSRM fallback misslyckades", osrmResponse.status, (await osrmResponse.text()).slice(0, 400));
        } else {
          const osrmJson = await osrmResponse.json();
          const trip = osrmJson?.trips?.[0];
          if (trip?.geometry && Number(trip.distance) > 0) {
            const osrmRoute: RouteResult = {
              distanceKm: Number(trip.distance) / 1000,
              points: decodePolyline(String(trip.geometry)),
            };
            // OSRM får samma rimlighetskontroll som acceptable. En trasig eller
            // extremt avvikande fallback ska inte döljas som ett lyckat resultat.
            if (osrmRoute.points.length >= 4 && qualityLevel(osrmRoute) !== "none") {
              selectedQuality = qualityLevel(osrmRoute);
              selectedSource = "osrm";
              pool = [osrmRoute];
              console.log(`OSRM levererade ${osrmRoute.distanceKm.toFixed(2)} km (${selectedQuality})`);
            } else {
              console.log(
                `OSRM-rutten underkändes: ${osrmRoute.distanceKm.toFixed(2)} km, ` +
                  `overlap ${(overlapRatio(osrmRoute.points) * 100).toFixed(0)} %, ` +
                  `ut-och-tillbaka ${(outAndBackRatio(osrmRoute.points) * 100).toFixed(0)} %, ` +
                  `längsta spets ${Math.round(longestSpikeM(osrmRoute.points))} m`,
              );
            }
          } else {
            console.error("OSRM fallback saknade en giltig trip", String(osrmJson?.code ?? "okänd kod"));
          }
        }
      } catch (osrmError) {
        console.error("OSRM fallback timeout/nätverksfel", String(osrmError));
      }
    }

    console.log("route selection", JSON.stringify({ quality: selectedQuality, source: selectedSource }));

    // Ta bort dubbletter (liknande mittpunkt)
    const unique: RouteResult[] = [];
    for (const r of pool) {
      const mid = r.points[Math.floor(r.points.length / 2)];
      const dup = unique.some((u) => haversine(u.points[Math.floor(u.points.length / 2)], mid) < 300);
      if (!dup) unique.push(r);
      if (unique.length >= 4) break;
    }

    if (unique.length === 0) {
      const closest = found[0];
      console.log(
        "inga träffsäkra rundor. bästa:",
        closest
          ? `${closest.distanceKm.toFixed(2)} km (mål ${targetKm}), overlap ${(overlapRatio(closest.points) * 100).toFixed(0)} %, ut-och-tillbaka ${(outAndBackRatio(closest.points) * 100).toFixed(0)} %, längsta spets ${Math.round(longestSpikeM(closest.points))} m`
          : "ingen",
      );
      const hadDeadEnds = closest
        ? outAndBackRatio(closest.points) >= OUT_AND_BACK_MAX || longestSpikeM(closest.points) > SPIKE_MAX_M
        : false;

      return new Response(
        JSON.stringify({
          routes: [],
          message: hadDeadEnds
            ? "Kunde inte hitta en bra runda utan återvändsgränder i det här området – prova en kortare distans eller en annan startpunkt."
            : `Kunde inte hitta en runda nära ${targetKm} km i det här området – prova en annan distans.`,
        }),
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

    console.log("total ms", Date.now() - t0, "routes", routes.length, "quality", selectedQuality, "source", selectedSource);

    return new Response(JSON.stringify({ routes, target: distanceKm, quality: selectedQuality, source: selectedSource }), {
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
