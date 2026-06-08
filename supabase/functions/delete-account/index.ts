import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Schedules account for deletion in 90 days instead of deleting immediately.
// User is signed out + banned so the account is unusable, but data can be
// restored within the grace period (or to satisfy retention requirements).
// Actual purge happens via the `purge-deleted-accounts` cron job.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Mark profile as scheduled for deletion
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ deletion_scheduled_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Ban the auth user (lock them out for ~100 years) and revoke all sessions
    const banUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" }).catch(() => {});
    await admin.auth.admin.signOut(userId, "global").catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, scheduled_purge_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
