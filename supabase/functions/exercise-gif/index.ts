import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Swedish to English exercise name mapping
const exerciseTranslations: Record<string, string> = {
  // Ben & Sätesmuskler
  "knäböj": "barbell full squat",
  "böj": "barbell full squat",
  "lätta böj": "barbell full squat",
  "pausböj": "barbell full squat",
  "frontböj": "barbell front squat",
  "marklyft": "barbell deadlift",
  "mark": "barbell deadlift",
  "stela marklyft": "barbell stiff leg deadlift",
  "rumänsk marklyft": "barbell romanian deadlift",
  "sumo marklyft": "barbell sumo deadlift",
  "sumo-marklyft": "barbell sumo deadlift",
  "utfall": "dumbbell lunge",
  "gående utfall": "dumbbell walking lunge",
  "bulgarska utfall": "dumbbell single leg split squat",
  "enbensutfall": "dumbbell lunge",
  "benpress": "leg press",
  "benspark": "lever leg extension",
  "benextension": "lever leg extension",
  "lårcurl": "leg curl",
  "bencurl": "leg curl",
  "höftlyft": "barbell glute bridge",
  "hip thrust": "barbell glute bridge",
  "vadpress": "calf raise",
  "sittande vadpress": "seated calf raise",
  "hacklift": "sled hack squat",
  "bortförande av höft": "hip abductor",
  "inåtförande av höft": "hip adductor",
  "goblet squat": "dumbbell goblet squat",
  "goblet squats": "dumbbell goblet squat",
  "box squat": "barbell full squat",
  "boxhopp": "box jump",
  "steg-ups": "step up",
  "step-ups": "step up",
  "glute ham raises": "glute ham raise",

  // Rumpa
  "hip thrust maskin": "barbell glute bridge",
  "barbell hip thrust": "barbell glute bridge",
  "single-leg hip thrust": "single leg bridge with outstretched leg",
  "glute bridge": "low glute bridge on floor",
  "single-leg glute bridge": "single leg bridge with outstretched leg",
  "frog pump": "_NO_GIF_",
  "cable pull-through": "band pull through",
  "cable kickback": "_NO_GIF_",
  "donkey kick": "_NO_GIF_",
  "fire hydrant": "_NO_GIF_",
  "rumänsk marklyft hantel": "dumbbell romanian deadlift",
  "stiff-leg marklyft": "barbell stiff leg deadlift",
  "single-leg rumänsk marklyft": "dumbbell single leg deadlift",
  "sumo squat": "smith sumo squat",
  "curtsy lunge": "curtsey squat",
  "walking lunge": "walking lunge",
  "reverse lunge": "_NO_GIF_",
  "lateral lunge": "barbell lateral lunge",
  "bulgarian split squat": "dumbbell single leg split squat",
  "step-up med knälyft": "step up",
  "abduktionsmaskin": "lever seated hip abduction",
  "kabelabduktion": "side hip abduction",
  "band walk": "_NO_GIF_",
  "clamshell": "_NO_GIF_",
  "kickback maskin": "_NO_GIF_",
  "good morning": "barbell good morning",
  "benspark bakåt": "_NO_GIF_",
  "smith machine hip thrust": "barbell glute bridge",
  "glute ham raise": "glute-ham raise",
  "pendlay hip extension": "lever back extension",

  // Bröst
  "bänk": "barbell bench press",
  "bänkpress": "barbell bench press",
  "incline bänkpress": "incline barbell bench press",
  "lutande bänkpress": "incline barbell bench press",
  "nedåtlutad bänkpress": "decline barbell bench press",
  "incline hantelpress": "incline dumbbell press",
  "pausbänk": "barbell bench press",
  "close-grip bänkpress": "close grip barbell bench press",
  "smal bänkpress": "close grip barbell bench press",
  "hantlar bänkpress": "dumbbell bench press",
  "hantelpress": "dumbbell bench press",
  "hantlar flyes": "dumbbell fly",
  "hantelflyes": "dumbbell fly",
  "kabelflyes": "cable fly",
  "cabel-flyes": "cable fly",
  "cable crossovers": "cable fly",
  "dips": "chest dip",
  "armhävningar": "push-up",
  "pike push up": "pike-to-cobra push-up",
  "pike push-up": "pike-to-cobra push-up",
  "pike pushup": "pike-to-cobra push-up",
  "bröstpress": "chest press machine",
  "pec-deck": "pec deck machine",

  // Rygg
  "chins": "chin up",
  "pull-ups": "pull up",
  "chins med assistans": "assisted pull up",
  "latsdrag": "cable lat pulldown",
  "rodd": "barbell bent over row",
  "skivstångsrodd": "barbell bent over row",
  "stångrodd med omvänt grepp": "reverse grip barbell row",
  "sittande kabelrodd": "cable seated row",
  "kabelrodd": "cable seated row",
  "hantelrodd": "dumbbell bent over row",
  "enarmsrodd": "dumbbell bent over row",
  "t-bar rodd": "t bar row",
  "sälrodd": "seal row",
  "ryggresningar": "hyperextension",
  "hyperextension": "hyperextension",
  "face pulls": "cable rear delt row (with rope)",
  "facepulls": "cable rear delt row (with rope)",
  "omvända flyes": "dumbbell reverse fly",
  "pull-overs": "dumbbell pullover",

  // Axlar
  "militärpress": "barbell standing military press",
  "axelpress": "dumbbell seated shoulder press",
  "hantelpress sittande": "dumbbell seated shoulder press",
  "axelpress i maskin": "machine shoulder press",
  "sidolyft": "dumbbell lateral raise",
  "sidolyft med hantlar": "dumbbell lateral raise",
  "sidolyft i kabel": "cable lateral raise",
  "framåtlutade sidolyft": "dumbbell rear lateral raise",
  "framlyfning": "dumbbell front raise",
  "frontlyft": "dumbbell front raise",
  "arnold press": "dumbbell arnold press",
  "arnoldpress": "dumbbell arnold press",
  "upprätt rodd": "barbell upright row",
  "upright row": "barbell upright row",
  "reverse fly": "dumbbell reverse fly",
  "shrugs": "dumbbell shrug",

  // Armar - Biceps
  "bicepscurl": "dumbbell alternate biceps curl",
  "bicepscurl med skivstång": "barbell curl",
  "hantelcurl": "dumbbell curl",
  "hammarcurl": "dumbbell hammer curl",
  "hammercurls": "dumbbell hammer curl",
  "preacher curl": "dumbbell preacher curl",
  "preacher curls": "dumbbell preacher curl",
  "concentration curl": "dumbbell concentration curl",
  "koncentrationscurls": "dumbbell concentration curl",
  "z-stångscurl": "ez bar curl",
  "spider curls": "spider curl",
  "21-an": "barbell curl",

  // Armar - Triceps
  "tricepspress": "cable pushdown",
  "triceps pushdown": "cable pushdown",
  "triceps pushdowns": "cable pushdown",
  "skallkross": "barbell lying triceps extension",
  "fransk press": "barbell lying triceps extension",
  "tricepsdips": "triceps dip",
  "dips mellan bänkar": "bench dip",
  "tricepsextension över huvud": "dumbbell overhead triceps extension",
  "kickbacks": "dumbbell tricep kickback",

  // Core
  "bål": "crunch",
  "bålträning": "crunch",
  "planka": "plank",
  "plankan": "plank",
  "sidoplanka": "side plank",
  "sidoplankan": "side plank",
  "sit-ups": "sit up",
  "crunches": "crunch",
  "benlyft": "leg raise",
  "hängande benlyft": "hanging leg raise",
  "russian twist": "russian twist",
  "russian twists": "russian twist",
  "bicycle crunches": "bicycle crunch",
  "mountain climbers": "mountain climber",
  "ab wheel": "ab wheel rollout",
  "hjulet": "ab wheel rollout",
  "maghjul": "ab wheel rollout",
  "kabeldrag": "cable crunch",
  "kabel-crunch": "cable crunch",
  "dead bug": "dead bug",
  "bålrotation": "cable wood chop",
  "woodchoppers": "cable wood chop",
  "fällkniven": "v up",
  "reverse crunches": "reverse crunch",

  // Helkropp & Funktionell
  "burpees": "burpee",
  "kettlebell-svingar": "kettlebell swing",
  "thrusters": "barbell thruster",
  "clean and press": "barbell clean and press",
  "ryck": "barbell snatch",
  "frivändning": "barbell clean",
  "wall balls": "wall ball",
  "farmers walk": "farmer walk",
  "slam ball": "slam ball",
  "battle ropes": "battle rope",

  // Seniorträning / Hemmaövningar
  "stol-knäböj": "_NO_GIF_",
  "väggpress": "_NO_GIF_",
  "stolspress": "_NO_GIF_",
  "bäckenlyft": "low glute bridge on floor",
  "sittande bensträck": "lever leg extension",
  "sittande rodd med band": "_NO_GIF_",
  "sittande rodd med band/handduk": "_NO_GIF_",
  "sittande armlyft": "dumbbell front raise",
  "sittande vridning": "_NO_GIF_",
  "knä-till-bröst": "_NO_GIF_",
  "katt/ko-stretch": "cat cow stretch",
  "bicepscurl (vattenflaskor)": "dumbbell alternate biceps curl",
  "planka på knä": "_NO_GIF_",
  "häl-tå-gång": "_CARDIO_",
  "tandemstående": "_CARDIO_",
  "sidosteg": "_CARDIO_",
  "enbensstående balans": "_CARDIO_",
  "diamond push-ups": "diamond push up",
  "pike push-ups": "pike-to-cobra push-up",
  "dips (stol)": "bench dip",
  "superman hold": "superman",
  "utfallssteg": "dumbbell lunge",
  "utfallssteg på stället": "dumbbell lunge",
  "hip thrust (golv)": "low glute bridge on floor",
  "jump squats": "jump squat",
  "high knees": "_NO_GIF_",
  "cykelcrunches": "bicycle crunch",
  "rodd med ryggsäck": "_NO_GIF_",
  "axelpress (ryggsäck)": "_NO_GIF_",

  // Kondition - these don't have GIFs in ExerciseDB
  "löpning": "_CARDIO_",
  "tröskellöpning": "_CARDIO_",
  "intervaller": "_CARDIO_",
  "långpass": "_CARDIO_",
  "cykling": "_CARDIO_",
  "crosstrainer": "_CARDIO_",
  "roddmaskin": "_CARDIO_",
  "löpband": "_CARDIO_",
  "stairmaster": "_CARDIO_",
  "simning": "_CARDIO_",
  "promenad": "_CARDIO_",
  "trappmaskin": "_CARDIO_",
  "hopprep": "_CARDIO_",

  // Rörlighet
  "stretching": "_CARDIO_",
  "yoga": "_CARDIO_",
  "foam rolling": "_CARDIO_",
  "rörlighetspass": "_CARDIO_",
  "dynamisk uppvärmning": "_CARDIO_",
};

function cleanExerciseName(raw: string): string {
  return raw.trim()
    .replace(/\s*\d+\s*[×x]\s*\d+.*/i, "")
    .replace(/\s*@\s*[\d.,]+\s*kg.*/i, "")
    .replace(/\s*[\d.,]+\s*kg.*/i, "")
    .replace(/\s*\d+\s*min.*/i, "")
    .replace(/\s*[\d:.]+\/km.*/i, "")
    .replace(/\s*RPE\s*[\d.]+.*/i, "")
    .replace(/\s*\d+\s*set.*/i, "")
    .replace(/\s*\d+\s*rep.*/i, "")
    .replace(/\s*\d+s$/i, "")
    .replace(/\s*\d+×\d+s$/i, "")
    .replace(/\/ben$/i, "")
    .replace(/\/sida$/i, "")
    .replace(/[\s—–\-]+$/g, "")
    .trim();
}

function getSearchTerms(cleanName: string): string[] {
  const terms: string[] = [];
  const lower = cleanName.toLowerCase();

  // Direct translation
  if (exerciseTranslations[lower]) {
    terms.push(exerciseTranslations[lower]);
  }

  // Handle slash-separated names like "Frontböj/Goblet squat"
  if (cleanName.includes("/")) {
    const parts = cleanName.split("/").map(p => p.trim());
    for (const part of parts) {
      const partLower = part.toLowerCase();
      if (exerciseTranslations[partLower]) {
        terms.push(exerciseTranslations[partLower]);
      } else {
        terms.push(part);
      }
    }
  }

  // If no translation found, use the clean name itself (might already be English)
  if (terms.length === 0) {
    terms.push(cleanName);
  }

  // Inga breda enordssökningar: hellre ingen koppling än fel bild.

  return [...new Set(terms)];
}

let exerciseDbDisabled = false;

const STOP = new Set(["the", "a", "an", "to", "on", "with", "of", "and", "med", "på", "och"]);
function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9åäö]+/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w));
}
/** Säker träff: varje ord i söktermen måste finnas i namnet (ordprefix/stam). */
function isRelevantMatch(term: string, name: string): boolean {
  const t = tokens(term);
  const n = tokens(name);
  if (!t.length || !n.length) return false;
  const stem = (w: string) => w.replace(/(es|s)$/, "");
  return t.every((w) => n.some((nw) => stem(nw) === stem(w) || (w.length >= 4 && (nw.startsWith(w) || w.startsWith(nw) && nw.length >= 4))));
}

async function searchExerciseDB(term: string): Promise<any | null> {
  if (exerciseDbDisabled) return null;
  try {
    const apiUrl = `https://exercisedb-api.vercel.app/api/v1/exercises/search?q=${encodeURIComponent(term)}&limit=10`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const body = (await response.text()).slice(0, 120);
      console.warn(`ExerciseDB unavailable (${response.status}) for "${term}": ${body}`);
      // Quota/plan issues won't recover within this instance – stop calling it
      if (response.status === 402 || response.status === 401 || response.status === 403 || response.status === 429) {
        exerciseDbDisabled = true;
      }
      return null;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      console.warn(`ExerciseDB returned non-JSON for "${term}"`);
      return null;
    }
    const data = await response.json();

    if (data.success && data.data && data.data.length > 0) {
      const relevant = data.data.filter((e: any) => isRelevantMatch(term, e.name || ""));
      if (relevant.length === 0) return null;
      const results = relevant.filter((e: any) => e.gifUrl);
      if (results.length === 0) return relevant[0];
      // Prefer exact name match
      const exact = results.find((e: any) => e.name?.toLowerCase() === term.toLowerCase());
      if (exact) return exact;
      // Prefer shortest name without parenthetical qualifiers — closest to the search term
      const scored = results
        .map((e: any) => ({
          exercise: e,
          hasParens: e.name?.includes("(") ? 1 : 0,
          nameLen: (e.name || "").length,
        }))
        .sort((a: any, b: any) => a.hasParens - b.hasParens || a.nameLen - b.nameLen);
      return scored[0].exercise;
    }
  } catch (e) {
    console.error(`Search failed for "${term}":`, e);
  }
  return null;
}

// Fallback: search the free-exercise-db (800+ exercises with images & instructions)
const FREE_EXERCISE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
let freeExerciseCache: any[] | null = null;

async function loadFreeExerciseDB(): Promise<any[]> {
  if (freeExerciseCache) return freeExerciseCache;
  try {
    const res = await fetch(FREE_EXERCISE_DB_URL);
    const data = await res.json();
    freeExerciseCache = data;
    return data;
  } catch (e) {
    console.error("Failed to load free-exercise-db:", e);
    return [];
  }
}

async function searchFreeExerciseDB(term: string): Promise<any | null> {
  const exercises = await loadFreeExerciseDB();
  const lower = term.toLowerCase();
  
  // Exact match
  const exact = exercises.find((e: any) => e.name?.toLowerCase() === lower);
  if (exact) return formatFreeExercise(exact);
  
  // Contains match
  const contains = exercises.filter((e: any) => e.name?.toLowerCase().includes(lower));
  if (contains.length > 0) {
    // Prefer shortest name (most specific match)
    contains.sort((a: any, b: any) => (a.name || "").length - (b.name || "").length);
    return formatFreeExercise(contains[0]);
  }
  
  // Reverse contains: search term contains exercise name
  const reverseMatch = exercises.filter((e: any) => (e.name || "").length >= 6 && lower.includes(e.name?.toLowerCase()) && isRelevantMatch(e.name, term));
  if (reverseMatch.length > 0) {
    reverseMatch.sort((a: any, b: any) => (b.name || "").length - (a.name || "").length);
    return formatFreeExercise(reverseMatch[0]);
  }
  
  // Word overlap match
  const termWords = lower.split(/\s+/);
  let bestMatch: any = null;
  let bestScore = 0;
  for (const ex of exercises) {
    const nameWords = (ex.name || "").toLowerCase().split(/\s+/);
    const overlap = termWords.filter((w: string) => nameWords.some((nw: string) => nw.includes(w) || w.includes(nw))).length;
    if (overlap > bestScore && overlap >= 2 && isRelevantMatch(term, ex.name || "")) {
      bestScore = overlap;
      bestMatch = ex;
    }
  }
  if (bestMatch) return formatFreeExercise(bestMatch);
  
  return null;
}

function formatFreeExercise(exercise: any): any {
  const imageBase = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
  const images = (exercise.images || []).map((img: string) => `${imageBase}/${img}`);
  return {
    name: exercise.name,
    gifUrl: null, // free-exercise-db only has static images, not animated GIFs
    imageUrls: images, // static illustration images
    instructions: exercise.instructions || [],
    targetMuscles: exercise.primaryMuscles || [],
    equipments: exercise.equipment ? [exercise.equipment] : [],
    secondaryMuscles: exercise.secondaryMuscles || [],
    source: "free-exercise-db",
  };
}

async function generateAIInstructions(exerciseName: string): Promise<string[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Du är en erfaren personlig tränare. Skriv tydliga, steg-för-steg instruktioner på svenska för den givna övningen. Skriv 4-7 steg. Numrera stegen (1. 2. 3. osv). Svara BARA med instruktionerna, inget annat. Inkludera startposition, utförande och vanliga misstag att undvika." },
          { role: "user", content: `Skriv träningsinstruktioner för övningen: ${exerciseName}` },
        ],
        temperature: 0.3,
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const lines = content.split("\n").filter((l: string) => l.trim());
    return lines.map((l: string) => l.replace(/^\d+\.\s*/, "").trim()).filter((l: string) => l.length > 0);
  } catch (e) {
    console.error("AI instruction generation failed:", e);
    return [];
  }
}

async function translateToSwedish(instructions: string[]): Promise<string[]> {
  if (!instructions || instructions.length === 0 || !LOVABLE_API_KEY) return instructions;
  try {
    const text = instructions.map((s, i) => `${i + 1}. ${s}`).join("\n");
    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Du är en översättare. Översätt träningsinstruktionerna till naturlig svenska. Behåll numreringen (1. 2. 3. osv). Skriv INTE 'Steg' före numret. Svara BARA med de översatta instruktionerna, inget annat." },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      }),
    });
    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content || "";
    const lines = translated.split("\n").filter((l: string) => l.trim());
    return lines.map((l: string) => l.replace(/^\d+\.\s*/, "").trim()).filter((l: string) => l.length > 0);
  } catch (e) {
    console.error("Translation failed:", e);
    return instructions;
  }
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Explicit "ingen koppling" vs. automatisk rad som bara cachar text (sök igen efter bild). */
const NO_LINK = "";
const AUTO_LINK = "_AUTO_";

type MappingRow = { id: string; exercise_name: string; exercisedb_name: string; gif_url: string | null; custom_instructions: unknown; ai_instructions: unknown };

async function findMapping(sb: any, cleanName: string): Promise<MappingRow | null> {
  // exercise_name_lower är genererad (lower(exercise_name)) och unik
  const { data, error } = await sb
    .from("exercise_gif_mappings")
    .select("id, exercise_name, exercisedb_name, gif_url, custom_instructions, ai_instructions")
    .eq("exercise_name_lower", cleanName.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Skriver fält till kopplingsraden; skapar raden om den saknas. Kastar vid fel. */
async function upsertMapping(sb: any, cleanName: string, fields: Record<string, unknown>, userId: string) {
  const existing = await findMapping(sb, cleanName);
  if (existing) {
    const { error } = await sb.from("exercise_gif_mappings").update(fields).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("exercise_gif_mappings").insert({
      exercise_name: cleanName,
      exercisedb_name: AUTO_LINK,
      created_by: userId,
      ...fields,
    });
    if (error) throw error;
  }
}

const asList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 ? (v as unknown[]).map(String) : null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { exerciseName, action, instructions: saveInstructions, reason } = body;

    const token = (req.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "").auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);
    if (!exerciseName) return json({ error: "Missing exerciseName" }, 400);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let cleanName = cleanExerciseName(exerciseName);
    if (!cleanName) cleanName = exerciseName.trim();

    const canEdit = async () => {
      const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (isAdmin || ["4ddd1300-eeb9-4b33-9c9e-59e3d12c0c04"].includes(user.id)) return true;
      const { data: rows } = await sb.from("custom_exercises").select("created_by").ilike("name", cleanName).limit(5);
      return (rows || []).some((r: any) => r.created_by === user.id);
    };

    // Spara redigerade/godkända instruktioner (admin: globalt; skapare: egen övning)
    if (action === "save_instructions" && Array.isArray(saveInstructions)) {
      if (!(await canEdit())) return json({ error: "Forbidden" }, 403);
      const list = saveInstructions.map((l: unknown) => String(l).trim()).filter(Boolean).slice(0, 30);
      if (!list.length) return json({ error: "Tom beskrivning" }, 400);
      try {
        await sb.from("exercise_description_reports").update({ resolved: true })
          .eq("exercise_name_lower", cleanName.toLowerCase()).eq("resolved", false);
        await upsertMapping(sb, cleanName, { custom_instructions: list }, user.id);
        const check = await findMapping(sb, cleanName);
        if (!asList(check?.custom_instructions)) throw new Error("verify failed");
      } catch (e) {
        console.error("save_instructions failed:", e);
        return json({ error: "Kunde inte spara i databasen" }, 500);
      }
      return json({ success: true, instructions: list });
    }

    // Ändra koppling till engelsk benämning (null = ingen koppling)
    if (action === "set_mapping") {
      if (!(await canEdit())) return json({ error: "Forbidden" }, 403);
      const dbName = typeof body.exercisedbName === "string" ? body.exercisedbName.trim().slice(0, 200) : "";
      const gif = typeof body.gifUrl === "string" && /^https:\/\//.test(body.gifUrl) ? body.gifUrl : null;
      try {
        await upsertMapping(sb, cleanName, { exercisedb_name: dbName || NO_LINK, gif_url: dbName ? gif : null }, user.id);
      } catch (e) {
        console.error("set_mapping failed:", e);
        return json({ error: "Kunde inte spara kopplingen" }, 500);
      }
      return json({ success: true });
    }

    if (action === "report_description") {
      await sb.from("exercise_description_reports").insert({
        exercise_name: cleanName,
        exercise_name_lower: cleanName.toLowerCase(),
        reported_by: user.id,
        reason: typeof reason === "string" ? reason.slice(0, 500) : null,
      });
      await sb.from("suggestions").insert({
        user_id: user.id,
        message: `[Felaktig övningsbeskrivning] "${cleanName}"${reason ? ` — ${reason}` : ""}`,
      });
      // Ett rapporterat AI-förslag ska inte visas igen; nästa granskning genererar nytt
      try { const m = await findMapping(sb, cleanName); if (m) await sb.from("exercise_gif_mappings").update({ ai_instructions: null }).eq("id", m.id); } catch { /* ignore */ }
      return json({ success: true });
    }

    // ---- Uppslag ----
    let creatorId: string | null = null;
    let isReported = false;
    try {
      const { data: rows } = await sb.from("custom_exercises").select("created_by").ilike("name", cleanName).limit(1);
      creatorId = rows?.[0]?.created_by || null;
      const { data: reportRow } = await sb.from("exercise_description_reports").select("id")
        .eq("exercise_name_lower", cleanName.toLowerCase()).eq("resolved", false).limit(1).maybeSingle();
      isReported = !!reportRow;
    } catch (e) {
      console.error("creator/report lookup failed:", e);
    }

    let mapping: MappingRow | null = null;
    try { mapping = await findMapping(sb, cleanName); } catch (e) { console.error("mapping lookup failed:", e); }
    const custom = asList(mapping?.custom_instructions);
    const cachedAi = asList(mapping?.ai_instructions);

    /** AI-förslag: genereras en gång per övning och sparas. */
    const aiFor = async (prompt: string): Promise<string[]> => {
      if (isReported) return [];
      if (cachedAi) return cachedAi;
      const gen = await generateAIInstructions(prompt);
      if (gen.length) {
        try { await upsertMapping(sb, cleanName, { ai_instructions: gen }, user.id); } catch (e) { console.error("cache ai failed:", e); }
      }
      return gen;
    };

    /** Prioritet: redigerade/godkända > källtext > AI-förslag. */
    const respond = (obj: Record<string, any>) => {
      const out: Record<string, any> = { creatorId, isReported, linkedName: mapping?.exercisedb_name && mapping.exercisedb_name !== AUTO_LINK ? mapping.exercisedb_name : null, noLink: mapping?.exercisedb_name === NO_LINK, ...obj };
      if (custom) {
        out.instructions = custom;
        out.hasCustomInstructions = true;
        out.aiGenerated = false;
        out.error = null;
      }
      return json(out);
    };

    // 1. Uttrycklig koppling (admin eller användare)
    if (mapping && mapping.exercisedb_name !== AUTO_LINK) {
      if (mapping.exercisedb_name === NO_LINK) {
        const instr = custom ? [] : await aiFor(cleanName);
        return respond({ gifUrl: null, name: cleanName, instructions: instr, targetMuscles: [], equipments: [], adminLinked: true, aiGenerated: instr.length > 0 });
      }
      let exercise: any = null;
      try { exercise = await searchExerciseDB(mapping.exercisedb_name); } catch (e) { console.error(e); }
      let instructions: string[] = [];
      let aiGen = false;
      if (!custom) {
        if (exercise?.instructions?.length > 0) instructions = await translateToSwedish(exercise.instructions);
        else {
          const free = await searchFreeExerciseDB(mapping.exercisedb_name);
          if (free?.instructions?.length > 0) instructions = await translateToSwedish(free.instructions);
          else { instructions = await aiFor(mapping.exercisedb_name + " (" + cleanName + ")"); aiGen = instructions.length > 0; }
        }
      }
      return respond({
        gifUrl: mapping.gif_url || exercise?.gifUrl || null,
        name: mapping.exercisedb_name,
        instructions,
        targetMuscles: exercise?.targetMuscles || [],
        equipments: exercise?.equipments || [],
        adminLinked: true,
        aiGenerated: aiGen,
      });
    }

    // 2. Automatisk sökning
    const searchTerms = getSearchTerms(cleanName);
    if (searchTerms.length === 1 && searchTerms[0] === "_CARDIO_") {
      return respond({ gifUrl: null, name: cleanName, instructions: [], targetMuscles: [], equipments: [], isCardio: true, error: "Konditions- och rörlighetsövningar har ingen GIF-demonstration." });
    }

    const noGif = searchTerms.length === 1 && searchTerms[0] === "_NO_GIF_";
    const validTerms = searchTerms.filter(t => t !== "_CARDIO_" && t !== "_NO_GIF_");

    if (!noGif) {
      for (const term of validTerms) {
        const exercise = await searchExerciseDB(term);
        if (exercise?.gifUrl) {
          const instructions = custom ? [] : await translateToSwedish(exercise.instructions || []);
          return respond({ gifUrl: exercise.gifUrl, name: exercise.name, instructions, targetMuscles: exercise.targetMuscles || [], equipments: exercise.equipments || [] });
        }
      }
    }
    for (const term of noGif ? [cleanName] : validTerms) {
      const free = await searchFreeExerciseDB(term);
      if (free) {
        const instructions = custom ? [] : await translateToSwedish(free.instructions || []);
        return respond({ gifUrl: null, imageUrls: free.imageUrls || [], name: free.name, instructions, targetMuscles: free.targetMuscles || [], equipments: free.equipments || [], source: "free-exercise-db" });
      }
    }

    const ai = custom ? [] : await aiFor(cleanName);
    return respond({
      gifUrl: null,
      name: cleanName,
      instructions: ai,
      targetMuscles: [],
      equipments: [],
      aiGenerated: ai.length > 0,
      error: ai.length > 0 ? null : (isReported ? "Beskrivning rapporterad — väntar på admin." : "Ingen demonstration hittades."),
    });
  } catch (error) {
    console.error("Error:", error);
    return json({ error: "Internal error" }, 500);
  }
});
