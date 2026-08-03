import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData } = await authClient.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { barcode } = await req.json();
    if (!barcode || typeof barcode !== "string" || !/^\d{6,14}$/.test(barcode)) {
      return new Response(JSON.stringify({ error: "Ogiltig streckkod" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Open Food Facts lookup
    let off: any = null;
    try {
      const offRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        headers: { "User-Agent": "GrimApp/1.0", "Accept": "application/json" },
      });
      const ct = offRes.headers.get("content-type") || "";
      if (offRes.ok && ct.includes("application/json")) {
        off = await offRes.json();
      } else {
        const txt = await offRes.text();
        console.log("OFF non-JSON response", offRes.status, ct, txt.slice(0, 200));
      }
    } catch (e) {
      console.log("OFF fetch failed", String(e));
    }
    if (!off || off.status !== 1 || !off.product) {
      return new Response(JSON.stringify({ found: false, message: "Produkt hittades inte" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const p = off.product;
    const name: string = p.product_name_sv || p.product_name || p.generic_name_sv || p.generic_name || "Okänd produkt";
    const brand: string = (p.brands || "").split(",")[0]?.trim() || "";
    const n = p.nutriments || {};

    const offFood = {
      name: brand ? `${name} (${brand})` : name,
      kcal: Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0),
      protein_g: Number(n.proteins_100g) || 0,
      fat_g: Number(n.fat_100g) || 0,
      carbs_g: Number(n.carbohydrates_100g) || 0,
      fiber_g: Number(n.fiber_100g) || 0,
    };

    // Use Open Food Facts data directly — it's keyed to the actual barcode.
    // Fuzzy-matching against Livsmedelsverket by a single token gave wildly
    // unrelated results (e.g. a yogurt matching the first row containing "van").
    return new Response(JSON.stringify({
      found: true,
      source: "openfoodfacts",
      barcode,
      product_name: offFood.name,
      brand,
      food: { id: null, ...offFood },
      off: offFood,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
