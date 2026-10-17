import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { offFood, type OFFProduct } from "../_shared/offProduct.ts";

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !key) return respond({ error: "Sökningen är inte tillgänglig." }, 503);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    const { data, error } = await createClient(url, key).auth.getUser(token);
    if (error || !data.user) return respond({ error: "Unauthorized" }, 401);
    const { query } = await req.json();
    if (typeof query !== "string" || query.trim().length < 2 || query.trim().length > 120) {
      return respond({ error: "Sök med 2–120 tecken." }, 400);
    }
    const term = query.trim();
    const fields = "code,product_name,product_name_sv,generic_name,generic_name_sv,brands,nutriments,nova_group";
    const base = "https://world.openfoodfacts.org/cgi/search.pl";
    const common = `action=process&json=1&page_size=50&sort_by=popularity_key&fields=${fields}`;
    const sal = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(term)}&page_size=50&langs=sv,en&fields=${fields}`;
    const words = term.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter((w) => w.length >= 2);
    const last = words[words.length - 1];
    const prefix = (q: string) => `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=50&langs=sv,en&fields=${fields}`;
    const urls = [
      sal,
      ...(last ? [prefix(`brands:${last}*`), prefix(`product_name.sv:${last}*`), prefix(`product_name.en:${last}*`)] : []),
      `${base}?${common}&search_terms=${encodeURIComponent(term)}&search_simple=1`,
      `${base}?${common}&tagtype_0=brands&tag_contains_0=contains&tag_0=${encodeURIComponent(term)}`,
    ];
    const responses = await Promise.allSettled(urls.map(async (url) => {
      const response = await fetch(url, {
        headers: { "User-Agent": "GrimApp/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Product search unavailable");
      const json = await response.json() as { products?: OFFProduct[]; hits?: Array<OFFProduct & { brands?: string | string[] }> };
      if (Array.isArray(json.hits)) {
        return { products: json.hits.map((h) => ({ ...h, brands: Array.isArray(h.brands) ? h.brands.join(",") : h.brands })) as OFFProduct[] };
      }
      return json;
    }));
    const products = new Map<string, OFFProduct>();
    let succeeded = false;
    for (const response of responses) {
      if (response.status !== "fulfilled") continue;
      if (!Array.isArray(response.value.products)) continue;
      succeeded = true;
      for (const product of response.value.products) {
        const food = product.code ? offFood(product) : null;
        if (!food) continue;
        const hay = food.name.toLowerCase();
        if (words.length && !words.every((w) => hay.includes(w))) continue;
        products.set(product.code!, product);
      }
    }
    if (!succeeded) return respond({ error: "Märkesprodukterna kunde inte hämtas. Försök igen eller skanna streckkoden." }, 503);
    return respond({ products: [...products.values()].map((product) => ({
      id: `off-${product.code}`, source: "off", ...offFood(product),
      nutriments: product.nutriments || {}, nova_group: product.nova_group || null,
    })) });
  } catch {
    return respond({ error: "Märkesprodukterna kunde inte hämtas. Försök igen eller skanna streckkoden." }, 503);
  }
});