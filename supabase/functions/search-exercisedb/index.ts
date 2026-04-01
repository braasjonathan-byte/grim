import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_EXERCISE_DB_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
let freeExerciseCache: any[] | null = null;

async function loadFreeExerciseDB(): Promise<any[]> {
  if (freeExerciseCache) return freeExerciseCache;
  try {
    const res = await fetch(FREE_EXERCISE_DB_URL);
    freeExerciseCache = await res.json();
    return freeExerciseCache!;
  } catch {
    return [];
  }
}

function searchFreeDB(exercises: any[], query: string, limit: number): any[] {
  const lower = query.toLowerCase();
  const imageBase = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

  const scored = exercises
    .map((e: any) => {
      const name = (e.name || "").toLowerCase();
      let score = 0;
      if (name === lower) score = 100;
      else if (name.startsWith(lower)) score = 80;
      else if (name.includes(lower)) score = 60;
      else {
        const words = lower.split(/\s+/);
        const nameWords = name.split(/\s+/);
        const overlap = words.filter((w: string) => nameWords.some((nw: string) => nw.includes(w) || w.includes(nw))).length;
        if (overlap >= 1) score = overlap * 20;
      }
      return { exercise: e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ exercise }) => {
    const images = (exercise.images || []).map((img: string) => `${imageBase}/${img}`);
    return {
      name: exercise.name,
      gifUrl: images.length > 0 ? images[0] : null,
      targetMuscles: exercise.primaryMuscles || [],
      equipments: exercise.equipment ? [exercise.equipment] : [],
      instructions: exercise.instructions || [],
      source: "free-exercise-db",
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized", results: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sbClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await sbClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", results: [] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query } = await req.json();
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search both databases in parallel
    const [exerciseDBPromise, freeDBPromise] = await Promise.allSettled([
      (async () => {
        const apiUrl = `https://exercisedb-api.vercel.app/api/v1/exercises/search?q=${encodeURIComponent(query)}&limit=15`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.map((e: any) => ({
            name: e.name,
            gifUrl: e.gifUrl || null,
            targetMuscles: e.targetMuscles || [],
            equipments: e.equipments || [],
            instructions: e.instructions || [],
            source: "exercisedb",
          }));
        }
        return [];
      })(),
      (async () => {
        const exercises = await loadFreeExerciseDB();
        return searchFreeDB(exercises, query, 15);
      })(),
    ]);

    const exerciseDBResults = exerciseDBPromise.status === "fulfilled" ? exerciseDBPromise.value : [];
    const freeDBResults = freeDBPromise.status === "fulfilled" ? freeDBPromise.value : [];

    // Merge: deduplicate by name, prefer exerciseDB (has GIFs)
    const seen = new Set<string>();
    const merged: any[] = [];

    for (const r of exerciseDBResults) {
      const key = r.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
    for (const r of freeDBResults) {
      const key = r.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }

    return new Response(JSON.stringify({ results: merged.slice(0, 30) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal error", results: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
