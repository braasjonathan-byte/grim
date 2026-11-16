import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { aiJson, AiError, FOOD_ITEM_SCHEMA, requireUser } from "../_shared/aiJson.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeUrl(raw: unknown): URL | null {
  try {
    const u = new URL(String(raw));
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h)) return null;
    return u;
  } catch { return null; }
}

const PRIVATE_V4 = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
async function resolvesPublic(host: string): Promise<boolean> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !PRIVATE_V4.test(host);
  try {
    const a = await Deno.resolveDns(host, "A").catch(() => [] as string[]);
    const aaaa = await Deno.resolveDns(host, "AAAA").catch(() => [] as string[]);
    if (!a.length && !aaaa.length) return false;
    if (a.some((ip) => PRIVATE_V4.test(ip))) return false;
    if (aaaa.some((ip) => /^(::1?$|f[cd]|fe80|::ffff:)/i.test(ip))) return false;
    return true;
  } catch { return false; }
}

/** Fetch that re-validates every redirect hop so it cannot be steered to internal hosts. */
async function safeFetch(start: URL, signal: AbortSignal): Promise<Response | null> {
  let current: URL | null = start;
  for (let hop = 0; hop < 5 && current; hop++) {
    if (!(await resolvesPublic(current.hostname))) return null;
    const res = await fetch(current, {
      headers: { "User-Agent": "Mozilla/5.0 (GrimRecipeImport)", Accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      current = loc ? safeUrl(new URL(loc, current).toString()) : null;
      continue;
    }
    return res;
  }
  return null;
}

/** Prefer schema.org Recipe JSON-LD; otherwise stripped visible text. */
function extract(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/Recipe/i.test(m[1])) parts.push(m[1].trim());
  }
  if (parts.length) return parts.join("\n").slice(0, 20000);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  return `${title}\n${text}`.slice(0, 20000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: "Ej inloggad" }, 401);
    const body = await req.json().catch(() => ({}));
    const url = safeUrl(body.url);
    if (!url) return json({ error: "Ogiltig länk" }, 400);

    const page = await safeFetch(url, req.signal);
    if (!page || !page.ok) return json({ error: "Kunde inte hämta sidan" }, 400);
    const html = (await page.text()).slice(0, 1_500_000);
    const content = extract(html);
    if (content.trim().length < 50) return json({ error: "Hittade inget recept på sidan" }, 400);

    const out = await aiJson<any>({
      instructions:
        "Du extraherar recept från webbsidor. Returnera receptets namn (svenska om möjligt), antal portioner, instruktioner som kort numrerad text, och varje ingrediens med mängd omräknad till gram (t.ex. 2 dl vetemjöl ≈ 120 g, 1 gul lök ≈ 100 g, 1 msk olja ≈ 13 g) samt typiska näringsvärden PER 100 g (Livsmedelsverket). Ingrediensnamn på svenska. Uppfinn inga ingredienser som inte står i receptet. Om sidan saknar recept: tomt namn och tom lista.",
      input: content,
      schemaName: "recipe_import",
      schema: {
        type: "object", additionalProperties: false,
        required: ["name", "servings", "instructions", "ingredients"],
        properties: {
          name: { type: "string" },
          servings: { type: "number" },
          instructions: { type: "string" },
          ingredients: { type: "array", items: FOOD_ITEM_SCHEMA },
        },
      },
      signal: req.signal,
    });
    if (!out.name && !(out.ingredients || []).length) return json({ error: "Hittade inget recept på sidan" }, 400);
    return json(out);
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message }, e.status);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
