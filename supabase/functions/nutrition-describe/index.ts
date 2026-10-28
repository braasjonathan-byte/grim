// "Beskriv måltiden": text + foton (mat och/eller meny) -> namn + gram. Näringsvärden slås upp i appen (ingen AI-kaloriuppskattning).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/aiJson.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `Du tolkar måltidsbeskrivningar i en svensk kostloggningsapp. Du ska INTE uppskatta kalorier eller näringsvärden – appen slår upp dem själv i sin livsmedelsbank och restaurangmenyer.
Användaren beskriver en måltid med text och/eller bilder. Bilder kan vara foto på maten eller foto på en restaurangmeny/menytavla.
Regler:
- Dela upp måltiden i separata livsmedel/rätter med korta, sökbara namn (svenska för vanliga livsmedel, t.ex. "ägg", "knäckebröd"; behåll rätt-/varumärkesnamn som "Big Mac"). Uppskatta mängd i gram (1 ägg ≈ 55 g, Big Mac ≈ 219 g).
- Om en bild är en MENY: lista rätterna på menyn som items med kind="menu" (exakt rättnamn från menyn). selected=true BARA för rätter som texten säger att användaren åt/beställde. Ange restaurangens namn i "restaurant" om det syns eller nämns.
- Ätet från text eller matfoto: kind="eaten", selected=true.
- Max 40 items.
Svara ENDAST med JSON: {"restaurant": string|null, "items":[{"name":string,"grams":number,"kind":"eaten"|"menu","selected":boolean,"price":string|null}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Ej inloggad" }, 401);
    // AI-funktioner: endast hedersmedlemmar/admin (samma källa som appens useAccessLevel)
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
    const { data: acc } = await sb.rpc("get_my_access_status");
    const row = Array.isArray(acc) ? acc[0] : acc;
    if (!(row?.is_honorary || row?.role === "admin")) return json({ error: "Endast tillgänglig för hedersmedlemmar" }, 403);
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI ej konfigurerad" }, 500);

    const b = await req.json().catch(() => ({}));
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 2000) : "";
    const images: string[] = Array.isArray(b.images) ? b.images.filter((x: unknown) => typeof x === "string" && x.startsWith("data:image/")).slice(0, 4) : [];
    const meal = typeof b.meal === "string" ? b.meal.slice(0, 30) : "";
    if (!text && !images.length) return json({ error: "Skriv vad du ätit eller lägg till ett foto" }, 400);

    const content: any[] = [{ type: "text", text: `${meal ? `Måltid: ${meal}.\n` : ""}${text ? `Användarens beskrivning: ${text}` : "Ingen text – tolka bilderna."}` }];
    for (const img of images) content.push({ type: "image_url", image_url: { url: img } });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content }],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) return json({ error: "För många förfrågningar just nu, försök igen om en stund." }, 429);
      if (res.status === 402) return json({ error: "AI-krediterna är slut." }, 402);
      return json({ error: "AI-anropet misslyckades", detail: await res.text() }, 502);
    }
    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "Kunde inte tolka AI-svaret" }, 502);
    const parsed = JSON.parse(m[0]);
    const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 40).map((it: any) => ({
      name: String(it.name || "").slice(0, 80),
      grams: Math.max(0, Number(it.grams) || 0) || 100,
      kind: it.kind === "menu" ? "menu" : "eaten",
      selected: it.kind === "menu" ? !!it.selected : it.selected !== false,
      price: it.price ? String(it.price).slice(0, 20) : null,
    })).filter((it: any) => it.name);
    return json({ restaurant: parsed.restaurant || null, items });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
