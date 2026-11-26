import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { resetMemberPassword } from "./reset.ts";

const BodySchema = z.object({
  user_id: z.string().uuid().optional(),
  nickname: z.string().trim().min(1).max(120).optional(),
}).refine((body) => body.user_id || body.nickname);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metoden stöds inte" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!jwt) return json({ error: "Ej inloggad" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Tjänsten är inte tillgänglig" }, 500);
    const admin = createClient(
      url,
      key,
      { auth: { persistSession: false } }
    );

    const { data: userData } = await admin.auth.getUser(jwt);
    const caller = userData?.user;
    if (!caller) return json({ error: "Ej autentiserad" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Endast admin" }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Ogiltig indata" }, 400);
    const { user_id: userId, nickname } = parsed.data;

    const profileQuery = admin.from("profiles").select("user_id, nickname, must_change_password");
    const { data: profile } = userId
      ? await profileQuery.eq("user_id", userId).maybeSingle()
      : await profileQuery.eq("nickname", nickname ?? "").maybeSingle();

    if (!profile) return json({ error: "Användaren hittades inte" }, 404);

    const result = await resetMemberPassword(
      profile.must_change_password === true,
      (value) => admin.from("profiles").update({ must_change_password: value }).eq("user_id", profile.user_id),
      (password) => admin.auth.admin.updateUserById(profile.user_id, { password }),
    );
    if (result.error) return json({ error: result.error }, 400);
    return json({ success: true, nickname: profile.nickname, temporary_password: result.password });
  } catch {
    return json({ error: "Kunde inte återställa lösenordet" }, 500);
  }
});
