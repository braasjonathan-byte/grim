import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
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
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI ej konfigurerad" }, 500);

    let transcript = "";
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "Ljudfil saknas" }, 400);
      if (file.size > 10 * 1024 * 1024) return json({ error: "Inspelningen är för lång" }, 400);
      transcript = await transcribe(file, key);
    } else {
      const b = await req.json().catch(() => ({}));
      transcript = typeof b.text === "string" ? b.text.trim().slice(0, 1000) : "";
    }
    if (!transcript) return json({ error: "Hörde inget – försök igen och prata tydligt." }, 400);

    const out = await aiJson<{ items: any[] }>({
      instructions:
        "Du är en svensk kostexpert. Användaren beskriver vad hen ätit. Dela upp i separata livsmedel (t.ex. 'en skiva bröd med smör och två ägg' → bröd, smör, ägg). Uppskatta realistisk mängd i gram för varje (1 skiva bröd ≈ 35 g, smör på en macka ≈ 5 g, 1 ägg ≈ 55 g) och ange näringsvärden PER 100 g enligt typiska svenska värden (Livsmedelsverket). Namn på svenska, korta. Returnera tom lista om inget livsmedel nämns.",
      input: transcript,
      schemaName: "voice_foods",
      schema: {
        type: "object", additionalProperties: false, required: ["items"],
        properties: { items: { type: "array", items: FOOD_ITEM_SCHEMA } },
      },
      signal: req.signal,
    });
    return json({ transcript, items: out.items || [] });
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message }, e.status);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
