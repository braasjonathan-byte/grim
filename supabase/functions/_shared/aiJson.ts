// Streams a Responses call with a strict JSON schema and returns the parsed object.
const GATEWAY = "https://ai.gateway.lovable.dev";
export const AI_MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function aiJson<T>(opts: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<T> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new AiError(500, "AI ej konfigurerad");
  const res = await fetch(`${GATEWAY}/v1/responses`, {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: AI_MODEL,
      instructions: opts.instructions,
      input: opts.input,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema } },
    }),
  });
  if (!res.ok || !res.body) {
    let msg = "AI-anropet misslyckades";
    try { const j = await res.json(); msg = j?.error?.message || j?.message || msg; } catch { /* ignore */ }
    if (res.status === 429) msg = "För många förfrågningar just nu, försök igen om en stund.";
    if (res.status === 402) msg = "AI-krediterna är slut.";
    throw new AiError(res.status, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", failed: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") text += ev.delta || "";
        else if (ev.type === "response.failed" || ev.type === "error") failed = ev.response?.error?.message || ev.message || "AI-fel";
        else if (ev.type === "response.refusal.done") failed = "AI:n kunde inte tolka detta.";
      } catch { /* ignore */ }
    }
  }
  if (failed) throw new AiError(502, failed);
  if (!text.trim()) throw new AiError(502, "Tomt AI-svar");
  return JSON.parse(text) as T;
}

/** Strict schema for food items with per-100 g nutrition and estimated grams. */
export const FOOD_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "grams", "kcal_100g", "protein_100g", "fat_100g", "carbs_100g", "fiber_100g"],
  properties: {
    name: { type: "string" },
    grams: { type: "number" },
    kcal_100g: { type: "number" },
    protein_100g: { type: "number" },
    fat_100g: { type: "number" },
    carbs_100g: { type: "number" },
    fiber_100g: { type: "number" },
  },
};

export async function requireUser(req: Request) {
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data } = await sb.auth.getUser(jwt);
  return data?.user ?? null;
}
