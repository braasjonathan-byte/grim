import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import {
  buildTempPasswordMail,
  expiresAtFrom,
  generateTempPassword,
  getClientIp,
  normalizeIdentifier,
  RATE_LIMITS,
} from "../_shared/tempPassword.ts";
import { hitRateLimit } from "../_shared/resetRateLimit.ts";
import { buildMimeMessage, toGmailRaw } from "../_shared/gmailMime.ts";
import { type GmailCreds, loadGmailCreds } from "../_shared/gmailConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_OK = {
  success: true,
  message:
    "Om kontot finns och har en e-postadress kopplad har vi skickat ett tillfälligt lösenord. Kolla din inkorg (och skräpposten).",
};

const SUPPORT_ADDRESS = "grimtraning@gmail.com";
const FROM = '"Grim Support" <grimtraning@gmail.com>';
const MAX_ACCOUNTS_PER_EMAIL = 3;

const ok = () =>
  new Response(JSON.stringify(GENERIC_OK), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Gmail API (OAuth refresh token). Credentials come from env if set, else from
// public.app_private_config (service role). Access token cached in memory only.
let cachedToken: { token: string; expiresAt: number } | null = null;

// deno-lint-ignore no-explicit-any
async function getGmailAccessToken(admin: any, credsCache: { v?: GmailCreds | null }): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  if (credsCache.v === undefined) credsCache.v = await loadGmailCreds((k) => Deno.env.get(k), admin);
  const creds = credsCache.v;
  if (!creds) {
    console.error("[forgot-password] Gmail credentials missing (env and app_private_config) – cannot send mail");
    return null;
  }
  const { clientId, clientSecret, refreshToken } = creds;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    console.error("[forgot-password] token exchange failed", res.status, data?.error ?? "");
    cachedToken = null;
    return null;
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cachedToken.token;
}

async function sendGmail(
  // deno-lint-ignore no-explicit-any
  admin: any,
  credsCache: { v?: GmailCreds | null },
  to: string,
  mail: { subject: string; text: string; html: string },
): Promise<boolean> {
  const token = await getGmailAccessToken(admin, credsCache);
  if (!token) return false;
  const raw = toGmailRaw(buildMimeMessage({ from: FROM, to, replyTo: SUPPORT_ADDRESS, ...mail }));
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    if (res.status === 401) cachedToken = null;
    console.error("[forgot-password] gmail send failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return false;
  }
  return true;
}

// deno-lint-ignore no-explicit-any
async function processReset(admin: any, ip: string, ident: { kind: "email" | "nickname"; value: string }) {
  // Resolve target accounts (user_id, nickname, real e-mail)
  const targets: { user_id: string; nickname: string; email: string }[] = [];
  if (ident.kind === "nickname") {
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, nickname")
      .ilike("nickname", ident.value)
      .maybeSingle();
    if (profile) {
      const { data: em } = await admin.from("user_emails").select("email").eq("user_id", profile.user_id).maybeSingle();
      if (em?.email) targets.push({ user_id: profile.user_id, nickname: profile.nickname, email: em.email.trim() });
    }
  } else {
    const { data: rows } = await admin
      .from("user_emails")
      .select("user_id, email")
      .ilike("email", ident.value)
      .limit(MAX_ACCOUNTS_PER_EMAIL);
    for (const r of rows ?? []) {
      const { data: profile } = await admin.from("profiles").select("nickname").eq("user_id", r.user_id).maybeSingle();
      if (profile?.nickname) targets.push({ user_id: r.user_id, nickname: profile.nickname, email: r.email.trim() });
    }
  }
  if (targets.length === 0) return;

  // Per-invocation cache of Gmail credentials (loaded lazily on first send).
  const credsCache: { v?: GmailCreds | null } = {};

  for (const t of targets) {
    if (await hitRateLimit(admin, `forgot-user:${t.user_id}`, RATE_LIMITS.forgotPerIdentifier)) {
      console.warn("[forgot-password] per-user limit hit");
      continue;
    }
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    const { data: inserted, error: insErr } = await admin
      .from("password_reset_temp")
      .insert({ user_id: t.user_id, password_hash: hash, expires_at: expiresAtFrom() })
      .select("id")
      .single();
    if (insErr) {
      console.error("[forgot-password] insert failed", insErr.message);
      continue;
    }
    const mail = buildTempPasswordMail({ nickname: t.nickname, tempPassword });
    let sent = false;
    try {
      sent = await sendGmail(admin, credsCache, t.email, mail);
    } catch (err) {
      console.error("[forgot-password] gmail error", err instanceof Error ? err.message : String(err));
    }
    if (sent) {
      console.log("[forgot-password] mail sent", { user: t.user_id.slice(0, 8), ip_hint: ip.slice(0, 7) });
    } else {
      // Don't leave an unusable temp password behind
      await admin.from("password_reset_temp").delete().eq("id", inserted.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return ok();

  try {
    const body = await req.json().catch(() => ({}));
    const ident = normalizeIdentifier((body as Record<string, unknown>)?.identifier ?? (body as Record<string, unknown>)?.email);
    if (!ident) return ok();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const ip = getClientIp(req.headers);

    if (await hitRateLimit(admin, `forgot-ip:${ip}`, RATE_LIMITS.forgotPerIp)) return ok();
    if (await hitRateLimit(admin, `forgot-id:${ident.value}`, RATE_LIMITS.forgotPerIdentifier)) return ok();

    // Do the lookup + Gmail send in the background so response time doesn't reveal
    // whether the account exists.
    const work = processReset(admin, ip, ident).catch((err) =>
      console.error("[forgot-password] failed", err instanceof Error ? err.message : String(err))
    );
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(work);
    else await work;

    return ok();
  } catch (err) {
    console.error("[forgot-password] error", err instanceof Error ? err.message : String(err));
    return ok();
  }
});
