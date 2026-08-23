import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `Du läser skärmdumpar från träningsappar (Strong, Hevy, Strava, Garmin, Apple Fitness m.fl.) och omvandlar dem till ett STRUKTURERAT träningspass på svenska.

Returnera ENDAST giltig JSON:
{
  "name": "kort passnamn på svenska",
  "tempo": "",
  "confidence": 0-1,
  "exercises": [
    {
      "type": "strength" | "cardio",
      "name": "övningens namn på svenska",
      // strength:
      "sets": [{ "reps": 10, "kg": 60 }],        // en post per set som syns i bilden
      "hold_seconds": null,                       // sätts istället för reps vid tidsbaserad övning (planka)
      // cardio:
      "duration_min": 40.5,                       // total tid i minuter (decimal)
      "distance_km": 15.73,
      "speed_kmh": 23.3,
      "pace_min_per_km": "5:30",
      "watt": 161,
      "pulse": 142
    }
  ]
}

Regler:
- Varje övning i bilden blir ETT objekt i exercises. Hitta aldrig på övningar.
- Utelämna (null) fält som inte syns i bilden.
- Konditionspass (löpning, cykling, simning, rodd, promenad m.m.) => type "cardio".
- Styrkeövningar => type "strength" med ett set-objekt per genomfört set (vikt i kg).
- Om bilden inte visar ett träningspass: confidence 0 och exercises [].`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Ej inloggad" }, 401);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await sb.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: "Ej autentiserad" }, 401);

    const { data: prof } = await sb.from("profiles").select("is_honorary").eq("user_id", user.id).maybeSingle();
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: { role: string }) => r.role === "admin");
    if (!prof?.is_honorary && !isAdmin) {
      return json({ error: "Endast tillgänglig för hedersmedlemmar" }, 403);
    }

    const body = await req.json().catch(() => null);
    const image = body?.image;
    if (!image || typeof image !== "string" || !image.startsWith("data:image/") || image.length > 12_000_000) {
      return json({ error: "Ogiltig bild" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI ej konfigurerad" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Läs av passet i skärmdumpen och returnera endast JSON." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "För många förfrågningar, försök igen om en stund" }, 429);
    if (aiRes.status === 402) return json({ error: "AI-krediter slut" }, 402);
    if (!aiRes.ok) return json({ error: "AI-anrop misslyckades", detail: await aiRes.text() }, 502);

    const aiData = await aiRes.json();
    const content: string = aiData.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Kunde inte tolka AI-svaret" }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return json({ error: "Kunde inte tolka AI-svaret" }, 502);
    }

    const exercises = Array.isArray(parsed.exercises)
      ? parsed.exercises.filter((e: any) => e && typeof e.name === "string" && e.name.trim())
      : [];
    if (exercises.length === 0) return json({ error: "Hittade inget träningspass i bilden" }, 422);

    return json({
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "Importerat pass",
      tempo: typeof parsed.tempo === "string" ? parsed.tempo.trim() : "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      exercises,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Okänt fel" }, 500);
  }
});
