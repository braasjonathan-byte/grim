import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 chars" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all profiles
    const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, nickname");
    if (!profiles) {
      return new Response(JSON.stringify({ error: "No profiles found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const p of profiles) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(p.user_id, { password });
      results.push({ nickname: p.nickname, success: !error, error: error?.message });
    }

    // Also clear any temp passwords
    await supabaseAdmin.from("temp_passwords").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
