import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Metoden stöds inte" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Tjänsten är inte tillgänglig" }, 500);
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Ej inloggad" }, 401);
    const { data: caller, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !caller.user) return json({ error: "Ej autentiserad" }, 401);
    const { data: allowed, error: roleError } = await admin.rpc("has_role", { _user_id: caller.user.id, _role: "admin" });
    if (roleError || allowed !== true) return json({ error: "Endast admin" }, 403);
    const { userId } = await req.json();
    if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "Ogiltig användare" }, 400);
    }
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("nickname, deletion_scheduled_at").eq("user_id", userId).maybeSingle();
    if (profileError) return json({ error: "Kontot kunde inte kontrolleras" }, 500);
    if (!profile) return json({ error: "Kontot finns inte kvar" }, 404);
    if (!profile.deletion_scheduled_at) return json({ error: "Kontot väntar inte på radering" }, 409);
    // Cancel the purge before unbanning; never allow the purge to race an active account.
    const { error: cancelError } = await admin.from("profiles")
      .update({ deletion_scheduled_at: null }).eq("user_id", userId);
    if (cancelError) return json({ error: "Raderingen kunde inte avbrytas" }, 500);
    const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    if (unbanError) return json({ error: "Raderingen är avbruten men kontospärren kunde inte hävas" }, 500);
    return json({ success: true, nickname: profile.nickname });
  } catch {
    return json({ error: "Kontot kunde inte återställas" }, 500);
  }
});