import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await sb.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Ej autentiserad" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: prof } = await sb.from("profiles").select("is_honorary").eq("user_id", user.id).maybeSingle();
    if (!prof?.is_honorary) {
      return new Response(JSON.stringify({ error: "Endast tillgänglig för hedersmedlemmar" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { image, mode } = await req.json();
    const scanMode: "dish" | "label" = mode === "label" ? "label" : "dish";
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Bild saknas" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI ej konfigurerad" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = scanMode === "label"
      ? "Du är en svensk kostexpert som läser näringsvärdestabeller (Nutrition Facts/Näringsdeklaration) på livsmedelsförpackningar. Läs av värdena PER 100 g (eller per 100 ml). Om tabellen bara visar per portion, räkna om till per 100 g. Returnera ENDAST giltig JSON: name (svenska, produktnamn om synligt annars 'Produkt'), portion_g (en rimlig portionsstorlek i gram, default 100), kcal (per 100 g), protein_g (per 100 g), fat_g (per 100 g), carbs_g (per 100 g), confidence (0-1)."
      : "Du är en svensk kostexpert. Identifiera livsmedlet på bilden så specifikt som möjligt (t.ex. 'kokt ägg', 'stekt kycklingfilé', 'havregrynsgröt med mjölk'). Returnera ENDAST giltig JSON med fälten: name (svenska, kort), portion_g (uppskattad mängd i gram i bilden), kcal (per 100 g), protein_g (per 100 g), fat_g (per 100 g), carbs_g (per 100 g), confidence (0-1).";

    const userText = scanMode === "label"
      ? "Läs av näringsvärdestabellen och returnera värden per 100 g som JSON."
      : "Vad är detta livsmedel? Ge bara JSON.";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI-anrop misslyckades", detail: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiData = await aiRes.json();
    const content: string = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Kunde inte tolka AI-svaret", raw: content }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // For label mode, use AI values directly (don't try to match Livsmedelsverket — label is the source of truth)
    if (scanMode === "label") {
      return new Response(JSON.stringify({
        identified: parsed,
        source: "ai",
        mode: "label",
        food: {
          id: null,
          name: parsed.name || "Produkt",
          kcal: Number(parsed.kcal) || 0,
          protein_g: Number(parsed.protein_g) || 0,
          fat_g: Number(parsed.fat_g) || 0,
          carbs_g: Number(parsed.carbs_g) || 0,
          fiber_g: 0,
        },
        portion_g: Number(parsed.portion_g) || 100,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tokens = String(parsed.name || "").toLowerCase().split(/\s+/).filter((t: string) => t.length >= 3).slice(0, 4);
    let lvMatch: any = null;
    for (const t of tokens) {
      const { data } = await sb.from("foods").select("id,name,kcal,protein_g,fat_g,carbs_g,fiber_g").ilike("name", `%${t}%`).limit(5);
      if (data && data.length) { lvMatch = data[0]; break; }
    }

    return new Response(JSON.stringify({
      identified: parsed,
      source: lvMatch ? "livsmedelsverket" : "ai",
      mode: "dish",
      food: lvMatch ?? {
        id: null,
        name: parsed.name,
        kcal: Number(parsed.kcal) || 0,
        protein_g: Number(parsed.protein_g) || 0,
        fat_g: Number(parsed.fat_g) || 0,
        carbs_g: Number(parsed.carbs_g) || 0,
        fiber_g: 0,
      },
      portion_g: Number(parsed.portion_g) || 100,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
