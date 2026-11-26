import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEMP_PASSWORD = "Grim123";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Ej inloggad" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: userData } = await admin.auth.getUser(jwt);
    const caller = userData?.user;
    if (!caller) return json({ error: "Ej autentiserad" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Endast admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
    if (!userId && !nickname) {
      return json({ error: "Ogiltig indata" }, 400);
    }

    const profileQuery = admin.from("profiles").select("user_id, nickname");
    const { data: profile } = userId
      ? await profileQuery.eq("user_id", userId).maybeSingle()
      : await profileQuery.ilike("nickname", nickname).maybeSingle();

    if (!profile) return json({ error: "Användaren hittades inte" }, 404);

    const { error: updErr } = await admin.auth.admin.updateUserById(profile.user_id, {
      password: TEMP_PASSWORD,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    const { error: profErr } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("user_id", profile.user_id);
    if (profErr) return json({ error: profErr.message }, 400);

    return json({ success: true, nickname: profile.nickname });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
