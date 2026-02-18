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
  "knäböj": "barbell full squat",
  "lätta böj": "barbell full squat",
  "pausböj": "barbell full squat",
  "frontböj": "barbell front squat",
  "pausböj": "barbell full squat",
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

  // Also try broader single-word searches as last resort
  const english = exerciseTranslations[lower] || cleanName;
  const mainWord = english.split(" ").pop();
  if (mainWord && mainWord.length > 3 && !terms.includes(mainWord)) {
    terms.push(mainWord);
  }

  return [...new Set(terms)];
}

async function searchExerciseDB(term: string): Promise<any | null> {
  try {
    const apiUrl = `https://exercisedb-api.vercel.app/api/v1/exercises/search?q=${encodeURIComponent(term)}&limit=10`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.success && data.data && data.data.length > 0) {
      const results = data.data.filter((e: any) => e.gifUrl);
      if (results.length === 0) return data.data[0];
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exerciseName } = await req.json();
    if (!exerciseName) {
      return new Response(JSON.stringify({ error: "Missing exerciseName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cleanName = cleanExerciseName(exerciseName);
    if (!cleanName) cleanName = exerciseName.trim();

    // 1. Check database for admin-managed mapping first
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: dbMapping } = await sb
        .from("exercise_gif_mappings")
        .select("exercisedb_name, gif_url")
        .ilike("exercise_name", cleanName)
        .maybeSingle();

      if (dbMapping) {
        // Use the admin-linked ExerciseDB name to fetch full data
        const exercise = await searchExerciseDB(dbMapping.exercisedb_name);
        if (exercise) {
          const rawInstructions = exercise.instructions || [];
          const instructions = await translateToSwedish(rawInstructions);
          return new Response(JSON.stringify({
            gifUrl: exercise.gifUrl || dbMapping.gif_url,
            name: exercise.name,
            instructions,
            targetMuscles: exercise.targetMuscles || [],
            equipments: exercise.equipments || [],
            adminLinked: true,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch (e) {
      console.error("DB mapping lookup failed:", e);
    }

    // 2. Fall back to hardcoded translations
    const searchTerms = getSearchTerms(cleanName);

    // Check if this is a cardio/mobility exercise without GIF support
    if (searchTerms.length === 1 && searchTerms[0] === "_CARDIO_") {
      return new Response(JSON.stringify({
        gifUrl: null,
        name: cleanName,
        instructions: [],
        targetMuscles: [],
        equipments: [],
        isCardio: true,
        error: "Konditions- och rörlighetsövningar har ingen GIF-demonstration.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this exercise has no GIF available in the database — generate AI instructions
    if (searchTerms.length === 1 && searchTerms[0] === "_NO_GIF_") {
      const aiInstructions = await generateAIInstructions(cleanName);
      return new Response(JSON.stringify({
        gifUrl: null,
        name: cleanName,
        instructions: aiInstructions,
        targetMuscles: [],
        equipments: [],
        aiGenerated: true,
        error: aiInstructions.length > 0 ? null : "Denna övning saknar GIF-demonstration.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out any _CARDIO_ / _NO_GIF_ markers from search terms
    const validTerms = searchTerms.filter(t => t !== "_CARDIO_" && t !== "_NO_GIF_");

    for (const term of validTerms) {
      const exercise = await searchExerciseDB(term);
      if (exercise?.gifUrl) {
        const rawInstructions = exercise.instructions || [];
        const instructions = await translateToSwedish(rawInstructions);
        return new Response(JSON.stringify({
          gifUrl: exercise.gifUrl,
          name: exercise.name,
          instructions,
          targetMuscles: exercise.targetMuscles || [],
          equipments: exercise.equipments || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // No ExerciseDB match found — try AI-generated instructions as last resort
    const aiInstructions = await generateAIInstructions(cleanName);
    return new Response(JSON.stringify({
      gifUrl: null,
      name: cleanName,
      instructions: aiInstructions,
      targetMuscles: [],
      equipments: [],
      aiGenerated: true,
      error: aiInstructions.length > 0 ? null : "Exercise not found",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
