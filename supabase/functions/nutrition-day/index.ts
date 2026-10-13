import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiJson, AiError, FOOD_ITEM_SCHEMA, requireUser } from "../_shared/aiJson.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function transcribe(file: File, key: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, file.name || "recording.wav");
  fd.append("model", "openai/gpt-transcribe");
  fd.append("languages", "sv");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(res.status, body?.error?.message || body?.message || "Kunde inte transkribera ljudet");
  return String(body.text || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Ej inloggad" }, 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: prof }, { data: role }] = await Promise.all([
      sb.from("profiles").select("is_honorary").eq("user_id", user.id).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
    ]);
    if (!prof?.is_honorary && !role) return json({ error: "Endast för hedersmedlemmar" }, 403);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI ej konfigurerad" }, 500);

    let transcript = "";
    let slotsRaw = "";
    let dateRaw = "";
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      slotsRaw = String(form.get("slots") || "");
      dateRaw = String(form.get("date") || "");
      if (file instanceof File) {
        if (file.size > 15 * 1024 * 1024) return json({ error: "Inspelningen är för lång" }, 400);
        transcript = await transcribe(file, key);
      } else {
        transcript = String(form.get("text") || "").trim().slice(0, 3000);
      }
    } else {
      const b = await req.json().catch(() => ({}));
      transcript = typeof b.text === "string" ? b.text.trim().slice(0, 3000) : "";
      slotsRaw = Array.isArray(b.slots) ? JSON.stringify(b.slots) : "";
      dateRaw = typeof b.date === "string" ? b.date : "";
    }
    if (!transcript) return json({ error: "Hörde inget – försök igen och prata tydligt." }, 400);

    let slots: string[] = [];
    try { slots = (JSON.parse(slotsRaw) as unknown[]).filter((s) => typeof s === "string").slice(0, 12) as string[]; } catch { /* ignore */ }
    if (!slots.length) slots = ["frukost", "lunch", "middag", "mellanmål"];

    // Previous days' logs so the user can say "samma frukost som igår".
    const today = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : new Date().toISOString().slice(0, 10);
    const from = new Date(today + "T00:00:00Z"); from.setUTCDate(from.getUTCDate() - 14);
    const { data: hist } = await sb.from("meal_logs")
      .select("log_date,meal_type,item_name,amount,unit,kcal,protein_g,fat_g,carbs_g,fiber_g")
      .eq("user_id", user.id).gte("log_date", from.toISOString().slice(0, 10)).lt("log_date", today)
      .order("log_date", { ascending: false }).limit(300);
    const weekday = (d: string) => ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"][new Date(d + "T00:00:00Z").getUTCDay()];
    const daysAgo = (d: string) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
    const per100 = (v: number, g: number) => (g > 0 ? Math.round((Number(v) / g) * 1000) / 10 : 0);
    const histText = (hist || []).map((r: any) => {
      const g = r.unit === "g" || r.unit === "ml" ? Number(r.amount) : 0;
      const grams = g || 100;
      const f = g ? null : 1;
      const k = (v: number) => (f ? Math.round(Number(v) * 10) / 10 : per100(v, grams));
      return `${r.log_date} (${weekday(r.log_date)}, ${daysAgo(r.log_date)} dagar sedan) | ${r.meal_type} | ${r.item_name} | grams=${grams} | kcal_100g=${k(r.kcal)} protein_100g=${k(r.protein_g)} fat_100g=${k(r.fat_g)} carbs_100g=${k(r.carbs_g)} fiber_100g=${k(r.fiber_g || 0)}`;
    }).join("\n");

    const out = await aiJson<{ meals: { meal: string; items: any[] }[] }>({
      instructions:
        `Du är en svensk kostexpert. Användaren beskriver vad hen äter under en dag, uppdelat på måltider (t.ex. "till frukost äter jag ... till lunch ..."). ` +
        `Dela upp texten per måltid. Använd EXAKT ett av dessa måltidsnamn för varje måltid: ${slots.map((s) => `"${s}"`).join(", ")}. ` +
        `Om användaren nämner en måltid som inte finns i listan, välj den närmaste (t.ex. kvällsmat → middag, fika → mellanmål). ` +
        `Om ingen måltid nämns, gissa utifrån sammanhanget. Inom varje måltid: dela upp i separata livsmedel, uppskatta realistisk mängd i gram ` +
        `(1 skiva bröd ≈ 35 g, smör på en macka ≈ 5 g, 1 ägg ≈ 55 g, en tallrik pasta ≈ 250 g) och ange näringsvärden PER 100 g enligt typiska svenska värden (Livsmedelsverket). ` +
        `Namn på svenska, korta. Utelämna måltider utan livsmedel. ` +
        `Idag är ${today} (${weekday(today)}). HISTORIK nedan visar vad användaren loggat tidigare dagar (igår = 1 dag sedan, i förrgår = 2 dagar sedan). ` +
        `Om användaren hänvisar till en tidigare måltid ("samma frukost som igår", "samma lunch som i förrgår", "det jag åt i måndags till middag") ska du kopiera EXAKT de livsmedel, gram och näringsvärden från historiken för den dagen och måltiden, och lägga dem i den måltid användaren anger för idag (annars samma måltidstyp). ` +
        `Om användaren nämner restaurang- eller kedjeprodukter (t.ex. Big Mac på McDonald's, Whopper på Burger King, Max, Subway, Pizza Hut) använd kedjans officiella svenska näringsvärden och standardportionsvikter. "Big Mac och company" / "meny" betyder burgare + mellan pommes frites + mellan läsk (vanlig Coca-Cola om inget annat sägs). Namnge med kedjan, t.ex. "Big Mac (McDonald's)".`,
      input: `HISTORIK:\n${histText || "(ingen)"}\n\nANVÄNDAREN SÄGER:\n${transcript}`,
      schemaName: "day_foods",
      schema: {
        type: "object", additionalProperties: false, required: ["meals"],
        properties: {
          meals: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["meal", "items"],
              properties: { meal: { type: "string" }, items: { type: "array", items: FOOD_ITEM_SCHEMA } },
            },
          },
        },
      },
      signal: req.signal,
    });
    const meals = (out.meals || []).map((m) => ({
      meal: slots.find((s) => s.toLowerCase() === String(m.meal).toLowerCase()) ?? slots[0],
      items: m.items || [],
    })).filter((m) => m.items.length);
    return json({ transcript, meals });
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message }, e.status);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
