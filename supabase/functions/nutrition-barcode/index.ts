import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
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

    // Try to match against Livsmedelsverket "foods" table by name tokens
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tokens = name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length >= 3).slice(0, 4);

    let lvMatch: any = null;
    if (tokens.length) {
      // Try most specific token first
      for (const t of tokens) {
        const { data } = await supabase.from("foods").select("id,name,kcal,protein_g,fat_g,carbs_g,fiber_g").ilike("name", `%${t}%`).limit(5);
        if (data && data.length) {
          lvMatch = data[0];
          break;
        }
      }
    }

    return new Response(JSON.stringify({
      found: true,
      source: lvMatch ? "livsmedelsverket" : "openfoodfacts",
      barcode,
      product_name: offFood.name,
      brand,
      food: lvMatch ?? { id: null, ...offFood },
      off: offFood,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
