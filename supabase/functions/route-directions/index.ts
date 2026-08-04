// Vägbeskrivning (sväng-för-sväng) för en genererad runda via Google Routes API.
// Input: { points: [[lat,lng], ...], activity: "cycling" | "running" | "walking" | "hiking" }
// Output: { steps: [{ instruction, maneuver, distanceM, end: [lat,lng] }], distanceM, durationS, polyline: [[lat,lng]] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LatLng = [number, number];

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const decodePolyline = (encoded: string): LatLng[] => {
  const points: LatLng[] = [];
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
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

const travelModeFor = (activity: string) => (activity === "cycling" ? "BICYCLE" : "WALK");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "Kartnyckel saknas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const raw: LatLng[] = Array.isArray(body?.points) ? body.points : [];
    const activity = String(body?.activity ?? "running");
    const points = raw
      .filter((p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
      .map((p) => [Number(p[0]), Number(p[1])] as LatLng);
    if (points.length < 2) {
      return new Response(JSON.stringify({ error: "Rutten saknar punkter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Routes API tillåter max 25 mellanpunkter – sampla jämnt längs rundan.
    const maxIntermediates = 23;
    const inner = points.slice(1, -1);
    const step = Math.max(1, Math.ceil(inner.length / maxIntermediates));
    const intermediates = inner.filter((_, i) => i % step === 0).slice(0, maxIntermediates);

    const toWaypoint = (p: LatLng) => ({ location: { latLng: { latitude: p[0], longitude: p[1] } } });

    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.endLocation",
      },
      body: JSON.stringify({
        origin: toWaypoint(points[0]),
        destination: toWaypoint(points[0]),
        intermediates: intermediates.map(toWaypoint),
        travelMode: travelModeFor(activity),
        languageCode: "sv-SE",
        units: "METRIC",
        polylineQuality: "HIGH_QUALITY",
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error("routes api failed", res.status, details);
      return new Response(
        JSON.stringify({ error: "Kunde inte hämta vägbeskrivning", status: res.status, details }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route) {
      return new Response(JSON.stringify({ error: "Ingen vägbeskrivning hittades" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const steps: any[] = [];
    for (const leg of route.legs ?? []) {
      for (const s of leg.steps ?? []) {
        const instruction = s?.navigationInstruction?.instructions;
        if (!instruction) continue;
        steps.push({
          instruction,
          maneuver: s?.navigationInstruction?.maneuver ?? null,
          distanceM: Number(s?.distanceMeters ?? 0),
          end: [Number(s?.endLocation?.latLng?.latitude), Number(s?.endLocation?.latLng?.longitude)],
        });
      }
    }

    const polyline = route?.polyline?.encodedPolyline ? decodePolyline(route.polyline.encodedPolyline) : points;

    return new Response(
      JSON.stringify({
        steps,
        distanceM: Number(route.distanceMeters ?? 0),
        durationS: Number(String(route.duration ?? "0s").replace("s", "")),
        polyline,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("route-directions error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
