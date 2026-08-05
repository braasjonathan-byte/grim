// Platsförslag (autocomplete) + geokodning via Google Places API (New) genom connector-gateway.
// Input: { query: string, lat?: number, lng?: number }            -> { suggestions: [{ placeId, text, secondary }] }
// Input: { placeId: string }                                       -> { lat, lng, name }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

const headers = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY ?? "",
  "Content-Type": "application/json",
  ...extra,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) return json({ error: "Karttjänsten är inte konfigurerad" }, 500);

    const body = await req.json().catch(() => ({}));
    const placeId = typeof body?.placeId === "string" ? body.placeId.trim() : "";

    // ---- Detaljer / geokodning ----
    if (placeId) {
      if (placeId.length > 300) return json({ error: "Ogiltigt plats-id" }, 400);
      const res = await fetch(`${GATEWAY}/places/v1/places/${encodeURIComponent(placeId)}`, {
        headers: headers({ "X-Goog-FieldMask": "location,displayName,formattedAddress" }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const details = await res.text();
        console.error("place details failed", res.status, details.slice(0, 300));
        return json({ error: "Kunde inte hämta platsen", status: res.status, details }, res.status);
      }
      const p = await res.json();
      const lat = Number(p?.location?.latitude);
      const lng = Number(p?.location?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "Platsen saknar koordinater" }, 404);
      return json({ lat, lng, name: p?.displayName?.text ?? p?.formattedAddress ?? "" });
    }

    // ---- Autocomplete ----
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (query.length < 2 || query.length > 200) return json({ suggestions: [] });

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const payload: Record<string, unknown> = { input: query, languageCode: "sv" };
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      payload.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
    }

    const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const details = await res.text();
      console.error("autocomplete failed", res.status, details.slice(0, 300));
      return json({ error: "Kunde inte söka platser", status: res.status, details }, res.status);
    }
    const data = await res.json();
    const suggestions = (data?.suggestions ?? [])
      .map((s: any) => s?.placePrediction)
      .filter(Boolean)
      .slice(0, 6)
      .map((p: any) => ({
        placeId: p.placeId,
        text: p?.structuredFormat?.mainText?.text ?? p?.text?.text ?? "",
        secondary: p?.structuredFormat?.secondaryText?.text ?? "",
      }));
    return json({ suggestions });
  } catch (e) {
    console.error("place-search error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
