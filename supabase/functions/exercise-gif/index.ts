import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Swedish to English exercise name mapping
const exerciseTranslations: Record<string, string> = {
  // Bröst
  "bänkpress": "barbell bench press",
  "incline bänkpress": "incline barbell bench press",
  "incline hantelpress": "incline dumbbell press",
  "pausbänk": "barbell bench press",
  "close-grip bänkpress": "close grip barbell bench press",
  "hantlar bänkpress": "dumbbell bench press",
  "hantelpress": "dumbbell bench press",
  "hantlar flyes": "dumbbell fly",
  "kabelflyes": "cable fly",
  "dips": "chest dip",
  "armhävningar": "push up",
  // Rygg
  "marklyft": "barbell deadlift",
  "rumänsk marklyft": "barbell romanian deadlift",
  "sumo marklyft": "barbell sumo deadlift",
  "rodd": "barbell bent over row",
  "skivstångsrodd": "barbell bent over row",
  "hantelrodd": "dumbbell bent over row",
  "kabelrodd": "cable seated row",
  "latsdrag": "cable lat pulldown",
  "chins": "chin up",
  "pull-ups": "pull up",
  "face pulls": "cable face pull",
  "hyperextension": "hyperextension",
  // Ben
  "knäböj": "barbell squat",
  "frontböj": "barbell front squat",
  "pausböj": "barbell squat",
  "bulgarska utfall": "dumbbell bulgarian split squat",
  "enbensutfall": "dumbbell lunge",
  "benpress": "leg press",
  "bencurl": "leg curl",
  "benextension": "leg extension",
  "vadpress": "calf raise",
  "hip thrust": "barbell hip thrust",
  "goblet squat": "dumbbell goblet squat",
  "box squat": "barbell squat",
  "steg-ups": "step up",
  // Axlar
  "axelpress": "dumbbell shoulder press",
  "militärpress": "barbell overhead press",
  "arnold press": "dumbbell arnold press",
  "sidolyft": "dumbbell lateral raise",
  "framlyfning": "dumbbell front raise",
  "reverse fly": "dumbbell reverse fly",
  "upright row": "barbell upright row",
  "shrugs": "dumbbell shrug",
  // Armar
  "bicepscurl": "dumbbell bicep curl",
  "hammarcurl": "dumbbell hammer curl",
  "skallkross": "barbell lying triceps extension",
  "tricepspress": "cable tricep pushdown",
  "triceps pushdown": "cable tricep pushdown",
  "preacher curl": "dumbbell preacher curl",
  "concentration curl": "dumbbell concentration curl",
  // Core
  "planka": "plank",
  "ab wheel": "ab wheel rollout",
  "kabeldrag": "cable crunch",
  "russian twist": "russian twist",
  "hängande benlyft": "hanging leg raise",
  "dead bug": "dead bug",
  "sidoplanka": "side plank",
  "bålrotation": "cable wood chop",
  "sit-ups": "sit up",
  // Kondition
  "löpning": "running",
  "tröskellöpning": "running",
  "intervaller": "running",
  "långpass": "running",
  "cykling": "cycling",
  "crosstrainer": "elliptical",
  "roddmaskin": "rowing machine",
  "simning": "swimming",
  "promenad": "walking",
  "trappmaskin": "stair climber",
  // Rörlighet
  "stretching": "stretching",
  "yoga": "yoga",
  "foam rolling": "foam rolling",
  "rörlighetspass": "stretching",
  "dynamisk uppvärmning": "dynamic stretching",
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
    const apiUrl = `https://exercisedb-api.vercel.app/api/v1/exercises/search?q=${encodeURIComponent(term)}&limit=3`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.success && data.data && data.data.length > 0) {
      // Prefer results that have a gifUrl
      const withGif = data.data.find((e: any) => e.gifUrl);
      return withGif || data.data[0];
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

    for (const term of searchTerms) {
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
