// Genererar rundslingor (loopar) utifrån registrerade vägar/stigar i OpenStreetMap.
// Input: { lat, lng, distanceKm, activity: "cycling" | "running" | "walking" | "hiking", asphaltOnly?: boolean }
// Output: { routes: [{ distanceKm, points: [[lat,lng]...], pavedRatio, surfaces: string[] }] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

type LatLng = [number, number];

interface Way {
  nodes: number[];
  tags: Record<string, string>;
}

const PAVED_SURFACES = new Set([
  "asphalt",
  "paved",
  "concrete",
  "concrete:plates",
  "concrete:lanes",
  "paving_stones",
  "chipseal",
  "sett",
]);

const haversine = (a: LatLng, b: LatLng) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const bearing = (a: LatLng, b: LatLng) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x =
    Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
    Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const angleDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const buildOverpassQuery = (
  lat: number,
  lng: number,
  radiusM: number,
  activity: string,
  asphaltOnly: boolean,
) => {
  const around = `(around:${Math.round(radiusM)},${lat},${lng})`;
  const parts: string[] = [];
  if (activity === "cycling") {
    // Cykelvägar och vägar där cykling är rimlig
    parts.push(
      `way["highway"~"^(cycleway|residential|living_street|unclassified|tertiary|secondary|service|track|path|footway)$"]["bicycle"!~"^(no|dismount)$"]["access"!~"^(private|no)$"]${around};`,
    );
  } else {
    // Löpning/gång/vandring: stigar, motionsslingor, gångvägar och lugna vägar
    parts.push(
      `way["highway"~"^(path|footway|track|pedestrian|cycleway|steps|bridleway|residential|living_street|unclassified|service|tertiary)$"]["access"!~"^(private|no)$"]${around};`,
    );
  }
  return `[out:json][timeout:14];(${parts.join("")});out geom qt;`;
};

const isPaved = (tags: Record<string, string>) => {
  const s = tags.surface;
  if (s) return PAVED_SURFACES.has(s);
  // Antaganden när surface saknas
  const hw = tags.highway;
  if (hw === "track" || hw === "path" || hw === "bridleway") return false;
  if (hw === "cycleway" || hw === "residential" || hw === "tertiary" || hw === "secondary" || hw === "living_street" || hw === "pedestrian" || hw === "footway") return true;
  return false;
};

interface Edge {
  to: number;
  dist: number;
  geom: LatLng[];
  paved: boolean;
  surface: string;
  wayId: number;
}

// Kör alla Overpass-speglar parallellt och använd det första svaret som lyckas.
const raceOverpass = async (query: string, timeoutMs: number) => {
  const attempts = OVERPASS_ENDPOINTS.map(async (url) => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "GrimApp/1.0 (route loop generator; contact: support@grim.lovable.app)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    const json = await res.json();
    if (!json?.elements?.length) throw new Error(`${url} tomt svar`);
    return json;
  });
  return await Promise.any(attempts);
};

const fetchOverpass = async (query: string) => {
  try {
    return await raceOverpass(query, 12000);
  } catch (e) {
    console.warn("overpass första försöket misslyckades, försöker igen", String(e));
    try {
      return await raceOverpass(query, 9000);
    } catch (e2) {
      throw new Error(
        `Overpass misslyckades – ${String((e2 as AggregateError)?.errors?.map(String).join(" | ") ?? e2)}`,
      );
    }
  }
};

// Kort minnescache per instans så att upprepade sökningar på samma plats går direkt.
const graphCache = new Map<string, { at: number; data: any }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const cachedOverpass = async (key: string, query: string) => {
  const hit = graphCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await fetchOverpass(query);
  graphCache.set(key, { at: Date.now(), data });
  if (graphCache.size > 20) graphCache.delete(graphCache.keys().next().value as string);
  return data;
};

/** Höjdprofil via Google Elevation API (genom Lovable-gatewayen). */
const fetchElevation = async (points: LatLng[]): Promise<{ gain: number; loss: number } | null> => {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY || points.length < 2) return null;
  const maxPts = 25;
  const step = Math.max(1, Math.ceil(points.length / maxPts));
  const sampled = points.filter((_, i) => i % step === 0);
  const path = sampled.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join("|");
  try {
    const res = await fetch(
      `https://connector-gateway.lovable.dev/google_maps/maps/api/elevation/json?path=${encodeURIComponent(path)}&samples=64`,
      {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      console.error("elevation failed", res.status, await res.text());
      return null;
    }
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
  } catch (e) {
    console.error("elevation error", e);
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const targetM = distanceKm * 1000;
    const radiusM = Math.min(Math.max(targetM * 0.3, 900), 8000);

    const t0 = Date.now();
    const cacheKey = `${lat.toFixed(3)}|${lng.toFixed(3)}|${activity}|${asphaltOnly}|${Math.round(radiusM / 500)}`;
    let data: any;
    try {
      data = await cachedOverpass(cacheKey, buildOverpassQuery(lat, lng, radiusM, activity, asphaltOnly));
    } catch (e) {
      console.error("overpass error", e);
      return new Response(
        JSON.stringify({
          routes: [],
          message: "Kartdatatjänsten svarar långsamt just nu. Försök igen om en liten stund.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const elements: any[] = data?.elements ?? [];
    console.log("overpass ms", Date.now() - t0, "elements", elements.length);

    // Bygg graf
    const coords = new Map<number, LatLng>();
    const nodeUse = new Map<number, number>();
    const ways: { id: number; nodes: number[]; tags: Record<string, string> }[] = [];

    for (const el of elements) {
      if (el.type !== "way" || !el.geometry || !el.nodes) continue;
      const tags: Record<string, string> = el.tags ?? {};
      if (asphaltOnly && !isPaved(tags)) continue;
      const ids: number[] = el.nodes;
      for (let i = 0; i < ids.length; i++) {
        const g = el.geometry[i];
        if (!g) continue;
        coords.set(ids[i], [g.lat, g.lon]);
        nodeUse.set(ids[i], (nodeUse.get(ids[i]) ?? 0) + 1);
      }
      ways.push({ id: el.id, nodes: ids, tags });
    }

    if (ways.length === 0) {
      return new Response(
        JSON.stringify({ routes: [], message: "Inga lämpliga vägar hittades i närheten." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Korsningar = noder som används av flera vägar, plus ändpunkter
    const isJunction = (id: number, way: { nodes: number[] }) =>
      (nodeUse.get(id) ?? 0) > 1 || way.nodes[0] === id || way.nodes[way.nodes.length - 1] === id;

    const graph = new Map<number, Edge[]>();
    const addEdge = (from: number, to: number, geom: LatLng[], tags: Record<string, string>, wayId: number) => {
      let dist = 0;
      for (let i = 1; i < geom.length; i++) dist += haversine(geom[i - 1], geom[i]);
      if (dist <= 0) return;
      const paved = isPaved(tags);
      const surface = tags.surface ?? (paved ? "asfalt" : "underlag okänt");
      if (!graph.has(from)) graph.set(from, []);
      if (!graph.has(to)) graph.set(to, []);
      graph.get(from)!.push({ to, dist, geom, paved, surface, wayId });
      graph.get(to)!.push({ to: from, dist, geom: [...geom].reverse(), paved, surface, wayId });
    };

    for (const way of ways) {
      let segStart = way.nodes[0];
      let geom: LatLng[] = coords.has(segStart) ? [coords.get(segStart)!] : [];
      for (let i = 1; i < way.nodes.length; i++) {
        const id = way.nodes[i];
        const c = coords.get(id);
        if (!c) continue;
        geom.push(c);
        if (isJunction(id, way) || i === way.nodes.length - 1) {
          if (geom.length > 1 && segStart !== id) addEdge(segStart, id, geom, way.tags, way.id);
          segStart = id;
          geom = [c];
        }
      }
    }

    // Närmaste startnod
    const start: LatLng = [lat, lng];
    let startNode = -1;
    let bestD = Infinity;
    for (const id of graph.keys()) {
      const c = coords.get(id);
      if (!c) continue;
      const d = haversine(start, c);
      if (d < bestD) {
        bestD = d;
        startNode = id;
      }
    }
    if (startNode === -1 || bestD > 1500) {
      return new Response(
        JSON.stringify({ routes: [], message: "Hittade ingen väg nära din position." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const startCoord = coords.get(startNode)!;
    console.log("graph ms", Date.now() - t0, "nodes", graph.size);

    // Enkel binär heap (min-heap) för Dijkstra
    class MinHeap {
      private a: [number, number][] = [];
      get size() { return this.a.length; }
      push(item: [number, number]) {
        const a = this.a;
        a.push(item);
        let i = a.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (a[p][0] <= a[i][0]) break;
          [a[p], a[i]] = [a[i], a[p]];
          i = p;
        }
      }
      pop(): [number, number] | undefined {
        const a = this.a;
        if (a.length === 0) return undefined;
        const top = a[0];
        const last = a.pop()!;
        if (a.length) {
          a[0] = last;
          let i = 0;
          for (;;) {
            const l = i * 2 + 1;
            const r = l + 1;
            let m = i;
            if (l < a.length && a[l][0] < a[m][0]) m = l;
            if (r < a.length && a[r][0] < a[m][0]) m = r;
            if (m === i) break;
            [a[m], a[i]] = [a[i], a[m]];
            i = m;
          }
        }
        return top;
      }
    }

    // Dijkstra tillbaka till start (med straff för redan använda vägar)
    const shortestBack = (from: number, usedWays: Set<number>, maxCost: number) => {
      const dist = new Map<number, number>([[from, 0]]);
      const prev = new Map<number, { node: number; edge: Edge }>();
      const visited = new Set<number>();
      const queue = new MinHeap();
      queue.push([0, from]);
      let found = from === startNode;
      while (queue.size) {
        const top = queue.pop()!;
        const [d, node] = top;
        if (visited.has(node)) continue;
        visited.add(node);
        if (node === startNode) { found = true; break; }
        if (d > maxCost) break;
        for (const e of graph.get(node) ?? []) {
          const penalty = usedWays.has(e.wayId) ? 3 : 1;
          const nd = d + e.dist * penalty;
          if (nd > maxCost) continue;
          if (nd < (dist.get(e.to) ?? Infinity)) {
            dist.set(e.to, nd);
            prev.set(e.to, { node, edge: e });
            queue.push([nd, e.to]);
          }
        }
      }
      if (!found) return null;
      const path: Edge[] = [];
      let cur = startNode;
      while (cur !== from) {
        const p = prev.get(cur);
        if (!p) return null;
        path.unshift(p.edge);
        cur = p.node;
      }
      return path;
    };


    interface Candidate {
      edges: Edge[];
      dist: number;
    }

    const candidates: Candidate[] = [];
    const directions = [0, 72, 144, 216, 288];
    const minTargetM = targetM * 0.8;
    const maxTargetM = targetM * 1.2;

    const buildCandidate = (dir: number, fraction: number): Candidate | null => {
      // Utåtvandring i vald riktning tills halva målet nåtts
      let node = startNode;
      const edges: Edge[] = [];
      const usedWays = new Set<number>();
      const visitedNodes = new Set<number>([startNode]);
      let traveled = 0;
      let guard = 0;
      while (traveled < targetM * fraction && guard++ < 400) {
        const options = (graph.get(node) ?? []).filter((e) => !visitedNodes.has(e.to));
        if (options.length === 0) break;
        const cur = coords.get(node)!;
        // Föredra riktning som pekar utåt i vald sektor och bort från start
        options.sort((a, b) => {
          const score = (e: Edge) => {
            const to = coords.get(e.to)!;
            const b1 = bearing(startCoord, to);
            const away = haversine(startCoord, to);
            return angleDiff(b1, dir) - away / 120 + (usedWays.has(e.wayId) ? 60 : 0) + angleDiff(bearing(cur, to), dir) * 0.3;
          };
          return score(a) - score(b);
        });
        const chosen = options[0];
        edges.push(chosen);
        usedWays.add(chosen.wayId);
        visitedNodes.add(chosen.to);
        traveled += chosen.dist;
        node = chosen.to;
      }
      if (edges.length === 0) return null;
      const back = shortestBack(node, usedWays, targetM * 1.3);
      if (!back) return null;
      const all = [...edges, ...back];
      const total = all.reduce((s, e) => s + e.dist, 0);
      return { edges: all, dist: total };
    };

    for (const dir of directions) {
      let fraction = 0.5;
      for (let attempt = 0; attempt < 2; attempt++) {
        const c = buildCandidate(dir, fraction);
        if (!c) break;
        candidates.push(c);
        if (c.dist >= minTargetM && c.dist <= maxTargetM) break;
        // Justera hur långt vi går utåt och försök igen
        const scale = targetM / Math.max(c.dist, 1);
        fraction = Math.min(Math.max(fraction * scale, 0.2), 0.9);
      }
    }

    console.log("candidates ms", Date.now() - t0, "n", candidates.length);
    // Filtrera på ±20 % och trimma dubbletter
    const minM = minTargetM;
    const maxM = maxTargetM;
    const within = candidates.filter((c) => c.dist >= minM && c.dist <= maxM);
    const pool = (within.length >= 3 ? within : candidates)
      .sort((a, b) => Math.abs(a.dist - targetM) - Math.abs(b.dist - targetM))
      .slice(0, 8);

    const routes = [] as any[];
    const seen: LatLng[][] = [];
    for (const c of pool) {
      const points: LatLng[] = [];
      for (const e of c.edges) {
        for (const p of e.geom) {
          const last = points[points.length - 1];
          if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p);
        }
      }
      if (points.length < 4) continue;
      // Enkel dubblettkontroll: liknande mittpunkt + liknande längd
      const mid = points[Math.floor(points.length / 2)];
      const dup = seen.some((s) => {
        const sm = s[Math.floor(s.length / 2)];
        return haversine(sm, mid) < 250;
      });
      if (dup) continue;
      seen.push(points);

      const pavedM = c.edges.filter((e) => e.paved).reduce((s, e) => s + e.dist, 0);
      const surfaces = Array.from(new Set(c.edges.map((e) => e.surface))).slice(0, 4);
      routes.push({
        distanceKm: Math.round((c.dist / 1000) * 100) / 100,
        points,
        pavedRatio: Math.round((pavedM / c.dist) * 100) / 100,
        surfaces,
      });
      if (routes.length >= 4) break;
    }

    // Höjdprofil för alla förslag parallellt
    const elevations = await Promise.all(routes.map((r) => fetchElevation(r.points)));
    routes.forEach((r, i) => {
      r.elevationGainM = elevations[i]?.gain ?? null;
      r.elevationLossM = elevations[i]?.loss ?? null;
    });

    return new Response(
      JSON.stringify({
        routes,
        target: distanceKm,
        message: routes.length ? undefined : "Kunde inte hitta en runda med den längden här. Prova en annan distans.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-route error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
