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
  "pausbänk": "barbell bench press",
  "close-grip bänkpress": "close grip barbell bench press",
  "hantlar bänkpress": "dumbbell bench press",
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

    // Translate Swedish name to English search term
    const searchTerm = exerciseTranslations[exerciseName.toLowerCase()] || exerciseName;

    const apiUrl = `https://exercisedb-api.vercel.app/api/v1/exercises/search?q=${encodeURIComponent(searchTerm)}&limit=1`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.success && data.data && data.data.length > 0) {
      const exercise = data.data[0];
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
