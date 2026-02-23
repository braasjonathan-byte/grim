import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Round 2: exercises that failed in round 1, with alternative search terms
const translations: Record<string, { english: string; freeDbSearch: string; properName: string }> = {
  "kabelrodd": { english: "seated cable row", properName: "Kabelrodd", freeDbSearch: "Seated Cable Rows" },
  "latsdrag": { english: "lat pulldown", properName: "Latsdrag", freeDbSearch: "Wide-Grip Lat Pulldown" },
  "face pulls": { english: "face pull", properName: "Face Pulls", freeDbSearch: "Face Pull" },
  "frontböj": { english: "front squat", properName: "Frontböj", freeDbSearch: "Front Barbell Squat" },
  "goblet squat": { english: "goblet squat", properName: "Goblet Squat", freeDbSearch: "Goblet Squat" },
  "militärpress": { english: "military press", properName: "Militärpress", freeDbSearch: "Standing Military Press" },
  "sidolyft": { english: "lateral raise", properName: "Sidolyft", freeDbSearch: "Side Lateral Raise" },
  "framlyfning": { english: "front raise", properName: "Framlyfning", freeDbSearch: "Front Dumbbell Raise" },
  "reverse fly": { english: "reverse fly", properName: "Reverse Fly", freeDbSearch: "Reverse Flyes" },
  "upright row": { english: "upright row", properName: "Upright Row", freeDbSearch: "Upright Barbell Row" },
  "skallkross": { english: "skull crusher", properName: "Skallkross", freeDbSearch: "Lying Triceps Press" },
  "tricepspress": { english: "triceps pushdown", properName: "Tricepspress", freeDbSearch: "Triceps Pushdown" },
  "sit-ups": { english: "sit up", properName: "Sit-Ups", freeDbSearch: "Sit-Up" },
  "hip thrust maskin": { english: "hip thrust", properName: "Hip Thrust Maskin", freeDbSearch: "Barbell Hip Thrust" },
  "single-leg hip thrust": { english: "single leg hip thrust", properName: "Single-Leg Hip Thrust", freeDbSearch: "Single Leg" },
  "single-leg glute bridge": { english: "single leg glute bridge", properName: "Single-Leg Glute Bridge", freeDbSearch: "Barbell Glute Bridge" },
  "frog pump": { english: "frog pump", properName: "Frog Pump", freeDbSearch: "Glute Bridge" },
  "cable pull-through": { english: "pull through", properName: "Cable Pull-Through", freeDbSearch: "Pull Through" },
  "donkey kick": { english: "donkey calf raise", properName: "Donkey Kick", freeDbSearch: "Donkey Calf Raises" },
  "fire hydrant": { english: "fire hydrant", properName: "Fire Hydrant", freeDbSearch: "All Fours Quad" },
  "rumänsk marklyft hantel": { english: "dumbbell romanian deadlift", properName: "Rumänsk Marklyft Hantel", freeDbSearch: "Romanian Deadlift" },
  "stiff-leg marklyft": { english: "stiff leg deadlift", properName: "Stiff-Leg Marklyft", freeDbSearch: "Stiff-Legged Barbell Deadlift" },
  "single-leg rumänsk marklyft": { english: "single leg deadlift", properName: "Single-Leg Rumänsk Marklyft", freeDbSearch: "Single Leg" },
  "sumo squat": { english: "sumo squat", properName: "Sumo Squat", freeDbSearch: "Barbell Squat" },
  "curtsy lunge": { english: "curtsy lunge", properName: "Curtsy Lunge", freeDbSearch: "Dumbbell Lunges" },
  "lateral lunge": { english: "lateral lunge", properName: "Lateral Lunge", freeDbSearch: "Side Lunge" },
  "kabelabduktion": { english: "cable hip abduction", properName: "Kabelabduktion", freeDbSearch: "Hip" },
  "band walk": { english: "band walk", properName: "Band Walk", freeDbSearch: "Monster Walk" },
  "clamshell": { english: "clamshell", properName: "Clamshell", freeDbSearch: "Clam" },
  "kickback maskin": { english: "machine kickback", properName: "Kickback Maskin", freeDbSearch: "One-Legged Cable Kickback" },
  "benspark bakåt": { english: "cable kickback", properName: "Benspark Bakåt", freeDbSearch: "One-Legged Cable Kickback" },
  "smith machine hip thrust": { english: "smith hip thrust", properName: "Smith Machine Hip Thrust", freeDbSearch: "Barbell Hip Thrust" },
};

const FREE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

async function searchExerciseDB(term: string): Promise<any | null> {
  try {
    const apiUrl = `https://exercisedb-api.vercel.app/api/v1/exercises/search?q=${encodeURIComponent(term)}&limit=5`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.success && data.data && data.data.length > 0) {
      const withGif = data.data.filter((e: any) => e.gifUrl);
      if (withGif.length > 0) return withGif[0];
      return data.data[0];
    }
  } catch (e) {
    console.error(`Search failed for "${term}":`, e);
  }
  return null;
}

async function loadFreeDb(): Promise<any[]> {
  try {
    const res = await fetch(FREE_DB_URL);
    return await res.json();
  } catch {
    return [];
  }
}

function searchFreeDbExact(exercises: any[], term: string): any | null {
  const lower = term.toLowerCase();
  // exact
  const exact = exercises.find((e: any) => e.name?.toLowerCase() === lower);
  if (exact) return exact;
  // contains
  const contains = exercises.filter((e: any) => e.name?.toLowerCase().includes(lower));
  if (contains.length > 0) {
    contains.sort((a: any, b: any) => (a.name || "").length - (b.name || "").length);
    return contains[0];
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: { user } } = await anonClient.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existingMappings } = await sb.from("exercise_gif_mappings").select("exercise_name");
    const mappedNames = new Set((existingMappings || []).map((m: any) => m.exercise_name.toLowerCase()));

    const freeDbExercises = await loadFreeDb();
    const results: any[] = [];

    for (const [swedish, config] of Object.entries(translations)) {
      if (mappedNames.has(swedish) || mappedNames.has(config.properName.toLowerCase())) {
        continue;
      }

      // Try ExerciseDB
      let result = await searchExerciseDB(config.english);
      let source = "exercisedb";
      let gifUrl = result?.gifUrl || null;
      let englishName = result?.name || config.english;

      // If no GIF, try free-exercise-db with specific search
      if (!gifUrl) {
        const freeResult = searchFreeDbExact(freeDbExercises, config.freeDbSearch);
        if (freeResult) {
          const imageBase = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
          const images = (freeResult.images || []).map((img: string) => `${imageBase}/${img}`);
          gifUrl = images.length > 0 ? images[0] : null;
          englishName = freeResult.name;
          source = "free-exercise-db";
        }
      }

      if (gifUrl || englishName) {
        await sb.from("exercise_gif_mappings").insert({
          exercise_name: config.properName,
          exercise_name_lower: swedish,
          exercisedb_name: englishName,
          gif_url: gifUrl,
          created_by: user.id,
        });

        results.push({
          exercise: config.properName,
          linked: true,
          englishName,
          gifUrl,
          source: gifUrl ? source : "name-only",
        });
      } else {
        results.push({ exercise: config.properName, linked: false, englishName: config.english, gifUrl: null, source: "none" });
      }

      await new Promise(r => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({
      success: true,
      linked: results.filter(r => r.linked).length,
      failed: results.filter(r => !r.linked).length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal error", details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
