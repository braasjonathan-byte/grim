import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `Du är en erfaren svensk styrketränare som analyserar teknik utifrån stillbilder tagna i kronologisk ordning ur en kort film på ETT set.

Returnera ENDAST giltig JSON:
{
  "exercise": "övningens namn på svenska",
  "overall": "en kort sammanfattande mening",
  "score": 1-10,
  "depth": { "rating": "bra" | "okej" | "behöver jobb", "comment": "kort kommentar" },
  "tempo": { "rating": "bra" | "okej" | "behöver jobb", "comment": "kort kommentar" },
  "symmetry": { "rating": "bra" | "okej" | "behöver jobb", "comment": "kort kommentar" },
  "cues": ["max 3 konkreta tips att tänka på nästa set"],
  "warnings": ["tydliga skaderisker, tom lista om inga"]
}

Regler:
- Skriv allt på svenska, kort och konkret, som en tränare som står bredvid.
- Bilderna är tagna i tidsordning genom rörelsen – använd dem för att bedöma rörelsebanan.
- Gissa aldrig detaljer du inte kan se; skriv då "syns inte i filmen" i kommentaren.
- Var ärlig men uppmuntrande. Peka alltid ut minst en sak som fungerar bra.
- Detta är träningsfeedback, inte medicinsk rådgivning.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Ej inloggad" }, 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await sb.auth.getUser(jwt);
    if (!userData?.user) return json({ error: "Ej autentiserad" }, 401);

    const body = await req.json().catch(() => null);
    const frames = Array.isArray(body?.frames) ? body.frames : [];
    const exercise = typeof body?.exercise === "string" ? body.exercise.trim().slice(0, 80) : "";

    const valid = frames.filter(
      (f: unknown) => typeof f === "string" && f.startsWith("data:image/") && f.length < 4_000_000,
    ).slice(0, 6);
    if (valid.length < 2) return json({ error: "För få bildrutor att analysera" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI ej konfigurerad" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        stream: true,
        instructions: SYSTEM_PROMPT,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: exercise
                  ? `Övningen är "${exercise}". Bildrutorna kommer i tidsordning. Bedöm djup, tempo och symmetri och returnera endast JSON.`
                  : "Bildrutorna kommer i tidsordning. Identifiera övningen, bedöm djup, tempo och symmetri och returnera endast JSON.",
              },
              ...valid.map((image: string) => ({ type: "input_image", image_url: image })),
            ],
          },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "För många förfrågningar, försök igen om en stund" }, 429);
    if (aiRes.status === 402) return json({ error: "AI-krediter slut" }, 402);
    if (!aiRes.ok || !aiRes.body) return json({ error: "AI-anrop misslyckades" }, 502);

    let content = "";
    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") content += evt.delta;
          else if (evt.type === "response.completed" && typeof evt.response?.output_text === "string" && !content) {
            content = evt.response.output_text;
          }
        } catch { /* ignorera ofullständiga event */ }
      }
    }

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Kunde inte tolka AI-svaret" }, 502);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return json({ error: "Kunde inte tolka AI-svaret" }, 502);
    }

    return json(parsed);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});
