import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiJson, AiError, requireUser } from "../_shared/aiJson.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MICRO_COLS = ["iron_mg", "calcium_mg", "vitamin_d_ug", "vitamin_c_mg", "vitamin_b12_ug", "magnesium_mg", "potassium_mg", "sodium_mg", "sugar_g"] as const;
const FOOD_COLS = `id,name,kcal,protein_g,fat_g,carbs_g,fiber_g,nova_group,${MICRO_COLS.join(",")}`;

async function transcribe(file: File, key: string, prompt: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, file.name || "recording.wav");
  fd.append("model", "openai/gpt-transcribe");
  fd.append("languages", "sv");
  if (prompt) fd.append("prompt", prompt.slice(0, 800));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(res.status, body?.error?.message || body?.message || "Kunde inte transkribera ljudet");
  return String(body.text || "").trim();
}

const norm = (s: string) => (s || "").toLowerCase()
  .replace(/[éèêë]/g, "e").replace(/[áàâ]/g, "a").replace(/[^a-z0-9åäö%]+/g, " ").trim();

/** Best Livsmedelsverket match: every query word must occur in the name; shorter names win. */
async function matchFood(sb: any, query: string) {
  const words = norm(query).split(" ").filter((w) => w.length >= 2).slice(0, 4);
  if (!words.length) return null;
  const [a, b] = await Promise.all([
    sb.from("foods").select(FOOD_COLS).ilike("name", `${words[0]}%`).limit(150),
    sb.from("foods").select(FOOD_COLS).ilike("name", `%${words[0]}%`).limit(150),
  ]);
  const data = [...(a.data || []), ...(b.data || [])];
  let best: any = null, bestScore = Infinity;
  for (const f of data || []) {
    const n = norm(f.name);
    const tokens = n.split(" ").filter(Boolean);
    if (!words.every((w) => n.includes(w))) continue;
    let score = 0;
    if (tokens[0] !== words[0]) score += tokens[0]?.startsWith(words[0]) ? 30 : 200;
    words.forEach((w, i) => { if (tokens[i] !== w) score += tokens.includes(w) ? 5 : 25; });
    score += (tokens.length - words.length) * 8;
    if (/eko\.?$|glutenfri/.test(n)) score += 15;
    if (score < bestScore) { best = f; bestScore = score; }
  }
  return best;
}

/** Branded product lookup in Open Food Facts (Swedish products first). */
async function matchBrand(query: string) {
  try {
    const url = `https://se.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=8&fields=product_name,brands,nutriments`;
    const res = await fetch(url, { headers: { "User-Agent": "GrimApp/1.0", Accept: "application/json" } });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
    const d = await res.json();
    const words = norm(query).split(" ").filter((w) => w.length >= 2);
    for (const p of d.products || []) {
      const n = p.nutriments || {};
      const label = `${p.brands || ""} ${p.product_name || ""}`.trim();
      if (n["energy-kcal_100g"] == null || !p.product_name) continue;
      const hay = norm(label);
      if (!words.every((w) => hay.includes(w))) continue;
      return {
        name: label, kcal: Number(n["energy-kcal_100g"]) || 0, protein_g: Number(n.proteins_100g) || 0,
        fat_g: Number(n.fat_100g) || 0, carbs_g: Number(n.carbohydrates_100g) || 0, fiber_g: Number(n.fiber_100g) || 0,
        sugar_g: n.sugars_100g != null ? Number(n.sugars_100g) : null, sodium_mg: n.sodium_100g != null ? Number(n.sodium_100g) * 1000 : null,
      };
    }
  } catch { /* ignore */ }
  return null;
}

const ITEM_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "grams", "servings", "ref_type", "ref_id", "lv_query", "kcal_100g", "protein_100g", "fat_100g", "carbs_100g", "fiber_100g", "certain", "question", "options", "pieces", "piece_label", "brand_query", "chain"],
  properties: {
    pieces: { type: "number" },
    piece_label: { type: "string" },
    brand_query: { type: "string" },
    chain: { type: "string" },
    name: { type: "string" },
    grams: { type: "number" },
    servings: { type: "number" },
    ref_type: { type: "string", enum: ["none", "custom", "recipe", "food"] },
    ref_id: { type: "string" },
    lv_query: { type: "string" },
    kcal_100g: { type: "number" }, protein_100g: { type: "number" }, fat_100g: { type: "number" },
    carbs_100g: { type: "number" }, fiber_100g: { type: "number" },
    certain: { type: "boolean" },
    question: { type: "string" },
    options: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["label", "grams"], properties: { label: { type: "string" }, grams: { type: "number" } } },
    },
  },
};

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

    const form = await req.formData().catch(() => null);
    if (!form) return json({ error: "Ogiltig förfrågan" }, 400);
    const file = form.get("file");
    const slotsRaw = String(form.get("slots") || "");
    const dateRaw = String(form.get("date") || "");
    const currentRaw = String(form.get("current") || "").slice(0, 20000);

    let slots: string[] = [];
    try { slots = (JSON.parse(slotsRaw) as unknown[]).filter((s) => typeof s === "string").slice(0, 12) as string[]; } catch { /* ignore */ }
    if (!slots.length) slots = ["frukost", "lunch", "middag", "mellanmål"];
    const today = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : new Date().toISOString().slice(0, 10);
    const from = new Date(today + "T00:00:00Z"); from.setUTCDate(from.getUTCDate() - 14);

    // Personal context: own foods, recipes, templates, most used foods, learned portions, history.
    const [custom, recipes, templates, usage, memory, hist] = await Promise.all([
      sb.from("custom_foods").select("id,name").eq("user_id", user.id).limit(150),
      sb.from("recipes").select("id,name,servings").eq("user_id", user.id).limit(150),
      sb.from("meal_templates").select("name,items").eq("user_id", user.id).limit(30),
      sb.from("food_usage_stats").select("food_source,food_id,use_count").eq("user_id", user.id).order("use_count", { ascending: false }).limit(40),
      sb.from("food_portion_memory").select("name_lower,grams").eq("user_id", user.id).order("times", { ascending: false }).limit(150),
      sb.from("meal_logs").select("log_date,meal_type,item_name,amount,unit,kcal,protein_g,fat_g,carbs_g,fiber_g")
        .eq("user_id", user.id).gte("log_date", from.toISOString().slice(0, 10)).lt("log_date", today)
        .order("log_date", { ascending: false }).limit(300),
    ]);
    const usedFoodIds = (usage.data || []).filter((u: any) => u.food_source === "food").map((u: any) => u.food_id);
    const { data: usedFoods } = usedFoodIds.length ? await sb.from("foods").select("id,name").in("id", usedFoodIds) : { data: [] as any[] };

    let transcript = "";
    if (file instanceof File) {
      if (file.size > 15 * 1024 * 1024) return json({ error: "Inspelningen är för lång" }, 400);
      const vocab = [...(custom.data || []).map((c: any) => c.name), ...(recipes.data || []).map((r: any) => r.name),
        "kvarg", "keso", "knäckebröd", "havregryn", "fil", "smörgås", "macka", "proteinshake"].join(", ");
      transcript = await transcribe(file, key, `Matlogg på svenska. Vanliga ord: ${vocab}`);
    } else {
      transcript = String(form.get("text") || "").trim().slice(0, 3000);
    }
    if (!transcript) return json({ error: "Hörde inget – försök igen och prata tydligt." }, 400);

    const weekday = (d: string) => ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"][new Date(d + "T00:00:00Z").getUTCDay()];
    const daysAgo = (d: string) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
    const r1 = (v: number) => Math.round(Number(v) * 10) / 10;
    const histText = (hist.data || []).map((r: any) => {
      const g = r.unit === "g" || r.unit === "ml" ? Number(r.amount) : 0;
      const grams = g || 100;
      const k = (v: number) => (g ? r1((Number(v) / g) * 100) : r1(v));
      return `${r.log_date} (${weekday(r.log_date)}, ${daysAgo(r.log_date)} d sedan) | ${r.meal_type} | ${r.item_name} | grams=${grams} | ${k(r.kcal)}/${k(r.protein_g)}/${k(r.fat_g)}/${k(r.carbs_g)}/${k(r.fiber_g || 0)}`;
    }).join("\n");

    const context = [
      `HISTORIK (datum | måltid | livsmedel | gram | kcal/protein/fett/kolhydrater/fiber per 100 g):\n${histText || "(ingen)"}`,
      `EGNA LIVSMEDEL (ref_type=custom, id | namn):\n${(custom.data || []).map((c: any) => `${c.id} | ${c.name}`).join("\n") || "(inga)"}`,
      `EGNA RECEPT (ref_type=recipe, id | namn | portioner):\n${(recipes.data || []).map((r: any) => `${r.id} | ${r.name} | ${r.servings}`).join("\n") || "(inga)"}`,
      `MALLAR (namn: livsmedel):\n${(templates.data || []).map((t: any) => `${t.name}: ${(t.items || []).map((i: any) => `${i.item_name} ${i.amount}${i.unit}`).join(", ")}`).join("\n") || "(inga)"}`,
      `MEST ANVÄNDA LIVSMEDEL (ref_type=food, id | namn):\n${(usedFoods || []).map((f: any) => `${f.id} | ${f.name}`).join("\n") || "(inga)"}`,
      `INLÄRDA PORTIONER (användarens vanliga mängder, namn = gram):\n${(memory.data || []).map((m: any) => `${m.name_lower} = ${m.grams} g`).join("\n") || "(inga)"}`,
      currentRaw ? `NUVARANDE FÖRSLAG (användaren vill ändra detta):\n${currentRaw}` : "",
    ].filter(Boolean).join("\n\n");

    const out = await aiJson<{ meals: { meal: string; day_offset: number; items: any[] }[] }>({
      instructions: [
        `Du är en svensk kostexpert som tolkar vad användaren ätit. Idag är ${today} (${weekday(today)}).`,
        `Dela upp per måltid. Använd EXAKT ett av dessa måltidsnamn: ${slots.map((s) => `"${s}"`).join(", ")}. Närmaste om annat nämns (kvällsmat→middag, fika→mellanmål).`,
        `Tider: "klockan tre/på eftermiddagen" → mellanmål om det finns, "på morgonen" → frukost, "sent i kväll" → middag/kvällsmål. day_offset=0 för idag, -1 om användaren säger att det åts i går ("i går kväll åt jag..."), -2 för i förrgår. Annars 0.`,
        `Förstå vardagsspråk och slang: käk/käkade=åt, macka/smörgås=bröd med pålägg, bira=öl, fika=kaffe + bakverk, "en näve"≈30 g nötter/40 g bär, "en tallrik"≈300 g, "ett glas"≈200 ml, "en kopp"≈150 ml, "en skopa" proteinpulver≈30 g, "en burk"=33 cl om dryck.`,
        `Varje livsmedel: välj i första hand användarens EGNA RECEPT (ref_type=recipe, ange servings, grams=0) eller EGNA LIVSMEDEL (ref_type=custom) om namnet passar, sedan MEST ANVÄNDA LIVSMEDEL (ref_type=food) om det tydligt är samma sak (t.ex. "kaffe" → användarens vanliga kaffe). Ange ref_id exakt. Annars ref_type=none, ref_id="".`,
        `lv_query: 1–3 svenska sökord som matchar Livsmedelsverkets namngivning med huvudordet först (t.ex. "ägg kokt", "banan", "lax odlad", "potatis kokt", "mjölk fett 1,5%", vanligt matbröd = "bröd vitt fibrer 5% formfranska", grovt bröd = "bröd fullkorn råg", "smör fett 80%"). Tom sträng för restaurang-/märkesprodukter och när ref_type≠none.`,
        `Mängd: använd INLÄRDA PORTIONER om livsmedlet finns där. Annars realistisk svensk portion (1 skiva bröd≈35 g, smör på macka≈5 g, 1 ägg≈55 g). Ange alltid näringsvärden per 100 g som reserv.`,
        `Osäker mängd ("lite pasta", "en del", "ett mellanmål", ingen mängd för en rätt): sätt certain=false, question (kort, t.ex. "Hur stor portion pasta?") och 3 options med label (Liten/Normal/Stor eller liknande) och grams. Annars certain=true, question="", options=[].`,
        `Hänvisningar till tidigare dagar ("samma frukost som igår", "som i förrgår", "som i måndags", "det jag brukar äta till frukost" = vanligast i historiken) eller en MALL vid namn: kopiera exakt livsmedel, gram och näringsvärden därifrån.`,
        `Restauranger/kedjor (McDonald's, Max, Burger King, Sibylla, Subway, Espresso House m.fl.): kedjans officiella svenska värden. "X och company"/"meny" = huvudrätt + mellan pommes + mellan läsk. Namnge t.ex. "Big Mac (McDonald's)".`,
        `Om NUVARANDE FÖRSLAG finns: användaren ger en ändring ("ta bort smöret", "dubbla laxen", "flytta bananen till mellanmål", "lägg till en kaffe"). Returnera HELA den uppdaterade listan, behåll oförändrade rader exakt (samma ref, gram).`,
        `pieces/piece_label: om livsmedlet naturligt räknas i styck ange antal och enhet (t.ex. pieces=2, piece_label="ägg"; 1 "skiva"; 1 "banan"); annars pieces=0, piece_label="".`,
        `brand_query: för märkesprodukter i butik (Oatly, Arla, Fazer, Marabou, Barebells, Risenta m.fl.) ange "märke + produkt" (t.ex. "oatly havredryck", "barebells cookies cream"); annars "".`,
        `chain: kedjans namn för restaurangmat (t.ex. "McDonald's"), annars "". Officiella svenska värden (per portion → räkna om per 100 g): Big Mac 219 g 503 kcal P27 F25 K41; Cheeseburgare 119 g 301 kcal; McFeast 230 g 539 kcal; Pommes mellan 114 g 330 kcal; Pommes stor 150 g 434 kcal; Coca-Cola mellan 40 cl 168 kcal; Max Originalburgare 228 g 600 kcal; Whopper 270 g 640 kcal; Sibylla tunnbrödsrulle ~400 g 900 kcal; Espresso House kanelbulle 100 g 380 kcal; Pressbyrån korv med bröd 120 g 300 kcal. Använd annars din bästa kunskap om kedjans värden.`,
        `Namn på svenska, korta. Utelämna tomma måltider.`,
      ].join("\n"),
      input: `${context}\n\nANVÄNDAREN SÄGER:\n${transcript}`,
      schemaName: "day_foods",
      schema: {
        type: "object", additionalProperties: false, required: ["meals"],
        properties: {
          meals: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["meal", "day_offset", "items"],
              properties: { meal: { type: "string" }, day_offset: { type: "integer" }, items: { type: "array", items: ITEM_SCHEMA } },
            },
          },
        },
      },
      signal: req.signal,
    });

    const customIds = new Set((custom.data || []).map((c: any) => c.id));
    const recipeIds = new Set((recipes.data || []).map((r: any) => r.id));
    const usedIds = new Set(usedFoodIds);

    const resolveItem = async (it: any) => {
      const grams = Math.max(0, Math.min(5000, Number(it.grams) || 0));
      const base = { pieces: Number(it.pieces) > 0 ? Number(it.pieces) : 0, piece_label: String(it.piece_label || ""), chain: String(it.chain || ""), certain: !!it.certain, question: it.certain ? "" : String(it.question || ""), options: it.certain ? [] : (it.options || []).slice(0, 4) };
      const fromPer100 = (src: any, sourceLabel: string, ids: Record<string, string | null>, matched?: string) => {
        const f = grams / 100;
        const micros: Record<string, number | null> = {};
        for (const m of MICRO_COLS) micros[m] = src[m] != null ? Number(src[m]) * f : null;
        return {
          ...base, name: it.name, amount: Math.round(grams), unit: "g", source: sourceLabel, matched_name: matched ?? null,
          kcal: Number(src.kcal) * f, protein_g: Number(src.protein_g) * f, fat_g: Number(src.fat_g) * f,
          carbs_g: Number(src.carbs_g) * f, fiber_g: Number(src.fiber_g || 0) * f,
          nova_group: src.nova_group ?? null, micros, food_id: null, custom_food_id: null, recipe_id: null, ...ids,
        };
      };
      if (it.ref_type === "recipe" && recipeIds.has(it.ref_id)) {
        const { data: r } = await sb.from("recipes").select("id,name,kcal_per_serving,protein_g_per_serving,fat_g_per_serving,carbs_g_per_serving").eq("id", it.ref_id).maybeSingle();
        if (r) {
          const s = Math.max(0.25, Math.min(20, Number(it.servings) || 1));
          return { ...base, name: r.name, amount: s, unit: "portion", source: "recept", matched_name: r.name,
            kcal: r.kcal_per_serving * s, protein_g: r.protein_g_per_serving * s, fat_g: r.fat_g_per_serving * s, carbs_g: r.carbs_g_per_serving * s, fiber_g: 0,
            nova_group: null, micros: {}, food_id: null, custom_food_id: null, recipe_id: r.id };
        }
      }
      if (it.ref_type === "custom" && customIds.has(it.ref_id)) {
        const { data: c } = await sb.from("custom_foods").select(FOOD_COLS).eq("id", it.ref_id).maybeSingle();
        if (c) return fromPer100(c, "egen", { custom_food_id: c.id }, c.name);
      }
      if (it.ref_type === "food" && usedIds.has(it.ref_id)) {
        const { data: f } = await sb.from("foods").select(FOOD_COLS).eq("id", it.ref_id).maybeSingle();
        if (f) return fromPer100(f, "livsmedelsverket", { food_id: f.id }, f.name);
      }
      if (it.brand_query) {
        const b = await matchBrand(it.brand_query);
        if (b) return fromPer100(b, "openfoodfacts", {}, b.name);
      }
      if (it.lv_query) {
        const f = await matchFood(sb, it.lv_query);
        if (f) return fromPer100(f, "livsmedelsverket", { food_id: f.id }, f.name);
      }
      return fromPer100({ kcal: it.kcal_100g, protein_g: it.protein_100g, fat_g: it.fat_100g, carbs_g: it.carbs_100g, fiber_g: it.fiber_100g }, it.chain ? "restaurang" : "ai", {});
    };

    const meals = await Promise.all((out.meals || []).map(async (m) => ({
      meal: slots.find((s) => s.toLowerCase() === String(m.meal).toLowerCase()) ?? slots[0],
      day_offset: Math.max(-7, Math.min(0, Math.round(Number(m.day_offset) || 0))),
      items: await Promise.all((m.items || []).map(resolveItem)),
    })));
    return json({ transcript, meals: meals.filter((m) => m.items.length) });
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message }, e.status);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
