import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import nodemailer from "npm:nodemailer@6.9.16";
import {
  buildTempPasswordMail,
  expiresAtFrom,
  generateTempPassword,
  getClientIp,
  normalizeIdentifier,
  RATE_LIMITS,
} from "../_shared/tempPassword.ts";
import { hitRateLimit } from "../_shared/resetRateLimit.ts";

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

const SMTP_USER = "grimtraning@gmail.com";
const FROM = '"Grim Support" <grimtraning@gmail.com>';
const MAX_ACCOUNTS_PER_EMAIL = 3;

const ok = () =>
  new Response(JSON.stringify(GENERIC_OK), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// deno-lint-ignore no-explicit-any
async function getSmtpPassword(admin: any): Promise<string | null> {
  const fromEnv = Deno.env.get("GMAIL_APP_PASSWORD");
  if (fromEnv) return fromEnv.replace(/\s+/g, "");
  const { data, error } = await admin.rpc("get_gmail_app_password");
  if (error) {
    console.error("[forgot-password] vault lookup failed", error.message);
    return null;
  }
  return typeof data === "string" && data ? data.replace(/\s+/g, "") : null;
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

  const smtpPassword = await getSmtpPassword(admin);
  if (!smtpPassword) {
    console.error("[forgot-password] GMAIL_APP_PASSWORD missing – cannot send mail");
    return;
  }
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: smtpPassword },
  });

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
    try {
      await transporter.sendMail({
        from: FROM,
        to: t.email,
        replyTo: SMTP_USER,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      console.log("[forgot-password] mail sent", { user: t.user_id.slice(0, 8), ip_hint: ip.slice(0, 7) });
    } catch (err) {
      console.error("[forgot-password] SMTP send failed", err instanceof Error ? err.message : String(err));
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

    // Do the lookup + SMTP in the background so response time doesn't reveal
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
