import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import { findMatchingTempRow, getClientIp, looksLikeTempPassword, RATE_LIMITS } from "../_shared/tempPassword.ts";
import { hitRateLimit } from "../_shared/resetRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const INVALID = { success: false, error: "Fel användarnamn eller lösenord" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(INVALID, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const nickname = typeof body.nickname === "string" ? body.nickname.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (nickname.length < 2 || nickname.length > 50 || !password || password.length > 100) return json(INVALID, 401);
    // Cheap reject: only temp-password-shaped input is worth a DB round trip
    if (!looksLikeTempPassword(password)) return json(INVALID, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const ip = getClientIp(req.headers);
    if (await hitRateLimit(admin, `login-ip:${ip}`, RATE_LIMITS.loginPerIp)) {
      return json({ success: false, error: "För många försök. Vänta en stund och försök igen." }, 429);
    }
    if (await hitRateLimit(admin, `login-nick:${nickname}`, RATE_LIMITS.loginPerNickname)) {
      return json({ success: false, error: "För många försök. Vänta en stund och försök igen." }, 429);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("user_id")
      .ilike("nickname", nickname)
      .maybeSingle();
    if (!profile) return json(INVALID, 401);

    const { data: rows, error: rowsErr } = await admin
      .from("password_reset_temp")
      .select("id, user_id, password_hash, expires_at, used_at")
      .eq("user_id", profile.user_id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(5);
    if (rowsErr) {
      console.error("[temp-password-login] rows", rowsErr.message);
      return json(INVALID, 401);
    }

    const match = await findMatchingTempRow(rows ?? [], password, (p, h) => bcrypt.compare(p, h));
    if (!match) return json(INVALID, 401);

    // Atomically claim the row so it can only be used once
    const { data: claimed } = await admin
      .from("password_reset_temp")
      .update({ used_at: new Date().toISOString() })
      .eq("id", match.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return json(INVALID, 401);

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(profile.user_id);
    const email = userRes?.user?.email;
    if (userErr || !email) {
      console.error("[temp-password-login] getUser", userErr?.message);
      return json({ success: false, error: "Inloggningen misslyckades" }, 500);
    }

    // Mint a real session: magic link (not mailed) -> verify server-side
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      console.error("[temp-password-login] generateLink", linkErr?.message);
      return json({ success: false, error: "Inloggningen misslyckades" }, 500);
    }
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    const session = verified?.session;
    if (verifyErr || !session) {
      console.error("[temp-password-login] verifyOtp", verifyErr?.message);
      return json({ success: false, error: "Inloggningen misslyckades" }, 500);
    }

    // Force a new password on next app render (checked on every boot)
    await admin.from("profiles").update({ must_change_password: true }).eq("user_id", profile.user_id);

    return json({
      success: true,
      must_change_password: true,
      session: { access_token: session.access_token, refresh_token: session.refresh_token },
    });
  } catch (err) {
    console.error("[temp-password-login] error", err instanceof Error ? err.message : String(err));
    return json(INVALID, 401);
  }
});
