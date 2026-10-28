// Unified "Beskriv måltiden": free text + optional photos (meal and/or restaurant menu) -> food items.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/aiJson.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `Du är en svensk kostexpert i en kostloggningsapp. Användaren beskriver en måltid med text och/eller bilder.
Bilder kan vara (a) foto på maten, (b) foto på en restaurangmeny/menytavla, (c) näringsdeklaration.
Regler:
- Dela upp måltiden i separata livsmedel/rätter. Uppskatta realistisk mängd i gram och näringsvärden PER 100 g (svenska typvärden, Livsmedelsverket; kända kedjors officiella värden om restaurangen är känd, t.ex. McDonald's Big Mac ≈ 215 g).
- Om en bild är en MENY: lista rätterna på menyn som items med kind="menu". Sätt selected=true BARA för rätter som texten säger att användaren åt/beställde; annars selected=false. Lägg menyns restaurangnamn i "restaurant" om synligt.
- Ätna livsmedel från text eller matfoto: kind="eaten", selected=true.
- Text som "halva", "stor", "2 st" ska påverka gram.
- Namn på svenska (behåll varumärkesnamn som "Big Mac"), korta. Max 40 items.
Svara ENDAST med JSON: {"summary": string, "restaurant": string|null, "items":[{"name":string,"grams":number,"kcal_100g":number,"protein_100g":number,"fat_100g":number,"carbs_100g":number,"fiber_100g":number,"kind":"eaten"|"menu","selected":boolean,"price":string|null}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Ej inloggad" }, 401);
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
    const num = (v: unknown) => Math.max(0, Number(v) || 0);
    const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 40).map((it: any) => ({
      name: String(it.name || "Livsmedel").slice(0, 80),
      grams: num(it.grams) || 100,
      kcal_100g: num(it.kcal_100g), protein_100g: num(it.protein_100g), fat_100g: num(it.fat_100g),
      carbs_100g: num(it.carbs_100g), fiber_100g: num(it.fiber_100g),
      kind: it.kind === "menu" ? "menu" : "eaten",
      selected: it.kind === "menu" ? !!it.selected : it.selected !== false,
      price: it.price ? String(it.price).slice(0, 20) : null,
    }));
    return json({ summary: String(parsed.summary || ""), restaurant: parsed.restaurant || null, items });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
