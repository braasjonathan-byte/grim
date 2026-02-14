import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  "pausböj": "barbell full squat",
  "marklyft": "barbell deadlift",
  "mark": "barbell deadlift",
  "stela marklyft": "barbell stiff leg deadlift",
  "rumänsk marklyft": "barbell romanian deadlift",
  "sumo marklyft": "barbell sumo deadlift",
  "sumo-marklyft": "barbell sumo deadlift",
  "utfall": "dumbbell lunge",
  "gående utfall": "dumbbell walking lunge",
  "bulgarska utfall": "dumbbell bulgarian split squat",
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
  "face pulls": "cable face pull",
  "facepulls": "cable face pull",
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

    // Filter out any _CARDIO_ markers from search terms
    const validTerms = searchTerms.filter(t => t !== "_CARDIO_");

    for (const term of validTerms) {
      const exercise = await searchExerciseDB(term);
      if (exercise?.gifUrl) {
        return new Response(JSON.stringify({
          gifUrl: exercise.gifUrl,
          name: exercise.name,
          instructions: exercise.instructions || [],
          targetMuscles: exercise.targetMuscles || [],
          equipments: exercise.equipments || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Exercise not found", gifUrl: null }), {
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
