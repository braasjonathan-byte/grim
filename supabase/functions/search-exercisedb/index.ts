import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = `https://exercisedb-api.vercel.app/api/v1/exercises/search?q=${encodeURIComponent(query)}&limit=20`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.success && data.data) {
      const results = data.data.map((e: any) => ({
        name: e.name,
        gifUrl: e.gifUrl || null,
        targetMuscles: e.targetMuscles || [],
        equipments: e.equipments || [],
        instructions: e.instructions || [],
      }));
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ results: [] }), {
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
