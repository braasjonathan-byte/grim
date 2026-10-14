import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiJson, AiError, requireUser } from "../_shared/aiJson.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kcal", "protein_g", "fat_g", "carbs_g", "fiber_g", "sugar_g", "confidence", "comment"],
        properties: {
          id: { type: "string" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          fat_g: { type: "number" },
          carbs_g: { type: "number" },
          fiber_g: { type: "number" },
          sugar_g: { type: ["number", "null"] },
          confidence: { type: "string", enum: ["hög", "medel", "låg"] },
          comment: { type: "string" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Ej inloggad" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: role } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Endast för admins" }, 403);

    const body = await req.json().catch(() => null);
    const foods = Array.isArray(body?.foods) ? body.foods.slice(0, 25) : null;
    if (!foods?.length) return json({ error: "Inga livsmedel skickades" }, 400);
    const clean = foods.map((f: any) => ({
      id: String(f.id ?? "").slice(0, 64),
      name: String(f.name ?? "").slice(0, 160),
      kcal: Number(f.kcal) || 0, protein_g: Number(f.protein_g) || 0, fat_g: Number(f.fat_g) || 0,
      carbs_g: Number(f.carbs_g) || 0, fiber_g: Number(f.fiber_g) || 0, sugar_g: f.sugar_g == null ? null : Number(f.sugar_g),
    })).filter((f: any) => f.id && f.name);

    const out = await aiJson<{ items: any[] }>({
      instructions:
        "Du är en svensk nutritionsexpert. För varje livsmedel: ge korrekta näringsvärden per 100 g ätbar vara, " +
        "i första hand enligt Livsmedelsverkets livsmedelsdatabas. Energin ska stämma med makrona (4/9/4 kcal per g, fiber 2). " +
        "Ändra inte värden som redan är rimliga. Skriv en kort kommentar på svenska om vad som var fel, eller 'OK'. Behåll id.",
      input: JSON.stringify(clean),
      schemaName: "food_fix",
      schema: SCHEMA,
    });
    return json({ items: out.items });
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Något gick fel" }, 500);
  }
});
