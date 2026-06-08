import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cron-driven purge: deletes auth users whose `deletion_scheduled_at` is
// older than 90 days. Cascading FKs remove all related data in `public`.
// Triggered daily by pg_cron — see scheduled job in DB.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (cronSecret && provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: selErr } = await admin
    .from("profiles")
    .select("user_id, deletion_scheduled_at, nickname")
    .lt("deletion_scheduled_at", cutoff)
    .not("deletion_scheduled_at", "is", null);

  if (selErr) {
    return new Response(JSON.stringify({ error: selErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { user_id: string; ok: boolean; error?: string }[] = [];
  for (const row of rows ?? []) {
    const { error } = await admin.auth.admin.deleteUser(row.user_id);
    results.push({ user_id: row.user_id, ok: !error, error: error?.message });
  }

  return new Response(
    JSON.stringify({ ok: true, processed: results.length, cutoff, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
