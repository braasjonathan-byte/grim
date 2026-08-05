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
    const baseRadius = (targetKm * 1000) / (2 * Math.PI) * 0.78;
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
    const baseWaypointCount = targetKm > 30 ? 12 : targetKm > 15 ? 10 : 8;

    // zig = blomformad bana (in och ut mot centrum) → längre runda på samma radie,
    // används när större radie bara ger vattenpassager (kustnära lägen).
    const buildWaypoints = (dir: number, radiusM: number, zig = false, count = baseWaypointCount): LatLng[] => {
      const n = zig ? Math.max(12, count) : count;
      const step = 360 / n;
      return Array.from({ length: n }, (_, i) =>
        offset(start, dir + i * step, radiusM * (zig ? (i % 2 === 0 ? 1 : 0.45) : i % 2 === 0 ? 1 : 0.92)),
      );
    };



    /**
     * Andel av rutten som körs fram och tillbaka på samma sträcka (0 = perfekt flyt).
     * Endast unika cellbesök räknas – på så vis straffas verkliga återbesök,
     * inte tät punktupplösning inom samma cell.
     */
    const overlapRatio = (points: LatLng[]): number => {
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
    const analyseOutAndBack = (points: LatLng[]): { ratio: number; spikes: Spike[] } => {

      const STEP = 25; // m mellan samplade punkter
      const NEAR = 35; // m maxavstånd för att räknas som "samma sträcka"
      const MIN_GAP = 200; // m minsta avstånd längs rutten mellan de två passagerna
      const MIN_RUN = 6; // minst 6 samplingar (~150 m) i följd för att räknas


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
      if (n < 8) return 0;

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
      for (let i = 0; i < n; i++) {
        const p = sampled[i];
        let hit = false;
        for (const j of neighbours(p)) {
          if (Math.abs(along[j] - along[i]) < MIN_GAP) continue;
          if (haversine(p, sampled[j]) > NEAR) continue;
          let diff = Math.abs(heading[i] - heading[j]) % 360;
          if (diff > 180) diff = 360 - diff;
          if (diff > 160) {
            hit = true;
            break;
          }
        }
        flags.push(hit);
      }

      // Endast sammanhängande sträckor räknas – enstaka träffar är korsningar,
      // rondeller eller parallellgator, inte en verklig återvändsgränd.
      let flagged = 0;
      let run = 0;
      for (let i = 0; i <= n; i++) {
        if (i < n && flags[i]) {
          run++;
        } else {
          if (run >= MIN_RUN) flagged += run;
          run = 0;
        }
      }
      return flagged / n;
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

    // Tröskel för hur mycket ut-och-tillbaka som accepteras alls.
    const OUT_AND_BACK_MAX = 0.3;

    /** Lägre = bättre. Ut-och-tillbaka straffas mycket hårdare än allmän overlap. */
    const score = (r: RouteResult): number =>
      Math.abs(r.distanceKm - targetKm) / targetKm +
      overlapRatio(r.points) * 2.5 +
      outAndBackRatio(r.points) * 12 +
      Math.min(uTurns(r.points), 10) * 0.05;

    /**
     * Konvergerar radien mot måldistansen. Håller reda på den minsta radie som
     * gav för lång rutt och den största som gav för kort rutt – när båda finns
     * används binärsökning (snabb konvergens), annars en dämpad ratio-skalning.
     */
    const attempt = async (dir: number): Promise<RouteResult | null> => {
      let radius = baseRadius;
      let best: RouteResult | null = null;
      let lowRadius: number | null = null; // ger för kort rutt
      let highRadius: number | null = null; // ger för lång rutt
      let failures = 0;
      let absurd = 0;
      let zig = false;

      for (let i = 0; i < 8; i++) {
        let r: RouteResult | null = null;
        try {
          r = await computeLoop(start, buildWaypoints(dir, radius, zig), activity, asphaltOnly);
        } catch (err) {
          console.log(`dir ${Math.round(dir)}° radie ${Math.round(radius)} m: nätverksfel`, String(err));
        }
        if (!r) {
          failures++;
          console.log(
            `dir ${Math.round(dir)}° radie ${Math.round(radius)} m: ingen rutt (troligen waypoint i vatten) – försök ${failures}`,
          );
          if (failures >= 3) return best;
          // Mindre radie ökar chansen att waypoints hamnar på land.
          radius = Math.max(120, radius * 0.6);
          continue;
        }
        const ov = overlapRatio(r.points);
        const ob = outAndBackRatio(r.points);
        console.log(
          `dir ${Math.round(dir)}° försök ${i + 1}${zig ? " (zig)" : ""}: radie ${Math.round(radius)} m → ${r.distanceKm.toFixed(2)} km ` +
            `(mål ${targetKm} km, avvikelse ${(((r.distanceKm - targetKm) / targetKm) * 100).toFixed(1)} %, ` +
            `overlap ${(ov * 100).toFixed(0)} %, ut-och-tillbaka ${(ob * 100).toFixed(0)} %)`,
        );

        // Orimligt lång rutt = waypoint hamnade i vatten och Google rutade runt
        // hela viken/över bron. Använd den varken som förslag eller som bracket –
        // krymp radien försiktigt istället för att binärsöka mot ett skenvärde.
        if (r.distanceKm > targetKm * 2.2) {
          absurd++;
          console.log(
            `dir ${Math.round(dir)}° radie ${Math.round(radius)} m: orimlig rutt (${r.distanceKm.toFixed(0)} km) – troligen vattenpassage`,
          );
          if (absurd >= 2 && !zig) {
            // Större radie går bara ut i vattnet – förläng rundan inåt istället.
            zig = true;
            radius = Math.max(120, lowRadius ?? radius * 0.6);
            console.log(`dir ${Math.round(dir)}°: byter till blomformad bana (radie ${Math.round(radius)} m)`);
          } else {
            radius = Math.max(120, lowRadius != null ? (radius + lowRadius) / 2 : radius * 0.85);
          }
          continue;
        }


        if (!best || score(r) < score(best)) best = r;

        const rel = (r.distanceKm - targetKm) / targetKm;
        if (Math.abs(rel) < 0.07 && ov < 0.15 && ob < OUT_AND_BACK_MAX) break;

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

    /** Kör ett helt lager av riktningar och returnerar det som hittades. */
    const runPass = async (dirsToTry: number[]): Promise<{ dir: number; route: RouteResult }[]> => {
      const settled = await Promise.all(
        dirsToTry.map(async (d) => {
          const route = await attempt(d).catch((e) => {
            console.log(`dir ${Math.round(d)}° kraschade:`, String(e));
            return null;
          });
          return route ? { dir: d, route } : null;
        }),
      );
      return settled.filter((x): x is { dir: number; route: RouteResult } => !!x);
    };

    const isClean = (r: RouteResult) =>
      Math.abs(r.distanceKm - targetKm) / targetKm <= 0.2 &&
      overlapRatio(r.points) < 0.25 &&
      outAndBackRatio(r.points) < OUT_AND_BACK_MAX;

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

    // Lager 3: inga rutter klarade kvalitetströskeln → nya bäringar, undvik de dåliga.
    if (!allResults.some((r) => isClean(r.route))) {
      badDirs.push(...allResults.map((r) => r.dir));
      console.log(
        "inga rena rundor efter första lagret – kör om med nya bäringar (undviker",
        badDirs.map((d) => Math.round(d)).join(", "),
        "°)",
      );
      pass = await runPass(randomDirs(6, badDirs));
      allResults.push(...pass);
    }

    console.log("routes ms", Date.now() - t0);

    const found = allResults.map((r) => r.route).sort((a, b) => score(a) - score(b));

    // Endast träffsäkra rutter utan tydliga återvändsgränder. Ingen tyst fallback.
    const pool = found.filter(isClean);

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
          ? `${closest.distanceKm.toFixed(2)} km (mål ${targetKm}), overlap ${(overlapRatio(closest.points) * 100).toFixed(0)} %, ut-och-tillbaka ${(outAndBackRatio(closest.points) * 100).toFixed(0)} %`
          : "ingen",
      );
      const hadDeadEnds = closest ? outAndBackRatio(closest.points) >= OUT_AND_BACK_MAX : false;
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
