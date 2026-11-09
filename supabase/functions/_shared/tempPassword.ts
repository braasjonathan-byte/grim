// Shared, runtime-agnostic logic for the "Glömt lösenord" temp-password flow.
// Imported by the forgot-password / temp-password-login edge functions (Deno)
// and by vitest (Node), so it must not use Deno- or Node-specific APIs.

/** No 0/O, 1/l/I to keep the password readable when typed from a mail. */
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
export const TEMP_PASSWORD_GROUPS = 3;
export const TEMP_PASSWORD_GROUP_LEN = 4;
export const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

export const RATE_LIMITS = {
  /** forgot-password: per account / identifier per hour */
  forgotPerIdentifier: { max: 3, windowMs: 60 * 60 * 1000 },
  /** forgot-password: per IP per hour */
  forgotPerIp: { max: 10, windowMs: 60 * 60 * 1000 },
  /** temp-password-login: per nickname per 15 min */
  loginPerNickname: { max: 8, windowMs: 15 * 60 * 1000 },
  /** temp-password-login: per IP per hour */
  loginPerIp: { max: 30, windowMs: 60 * 60 * 1000 },
} as const;

type RandomSource = (bytes: Uint8Array) => Uint8Array;
const defaultRandom: RandomSource = (bytes) => {
  // Own the buffer so Web Crypto receives an ArrayBuffer-backed view.
  const randomBytes = new Uint8Array(bytes.length);
  crypto.getRandomValues(randomBytes);
  return randomBytes;
};

/**
 * Generates e.g. "K7mP-x9Qa-R3tW" (12 random chars, ~69 bits of entropy).
 * Uses rejection sampling so every character is equally likely.
 */
export function generateTempPassword(random: RandomSource = defaultRandom): string {
  const total = TEMP_PASSWORD_GROUPS * TEMP_PASSWORD_GROUP_LEN;
  const n = TEMP_PASSWORD_ALPHABET.length;
  const limit = 256 - (256 % n);
  const chars: string[] = [];
  while (chars.length < total) {
    const buf = random(new Uint8Array(total * 2));
    for (const b of buf) {
      if (b < limit) chars.push(TEMP_PASSWORD_ALPHABET[b % n]);
      if (chars.length === total) break;
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < total; i += TEMP_PASSWORD_GROUP_LEN) {
    groups.push(chars.slice(i, i + TEMP_PASSWORD_GROUP_LEN).join(""));
  }
  return groups.join("-");
}

/** Shape check so obviously non-temp passwords skip the bcrypt work. */
export function looksLikeTempPassword(value: string): boolean {
  const re = new RegExp(
    `^[${TEMP_PASSWORD_ALPHABET}]{${TEMP_PASSWORD_GROUP_LEN}}(-[${TEMP_PASSWORD_ALPHABET}]{${TEMP_PASSWORD_GROUP_LEN}}){${TEMP_PASSWORD_GROUPS - 1}}$`,
  );
  return re.test(value.trim());
}

export interface TempPasswordRow {
  id: string;
  user_id: string;
  password_hash: string;
  expires_at: string;
  used_at: string | null;
}

export function isRowUsable(row: TempPasswordRow, now: Date = new Date()): boolean {
  if (row.used_at) return false;
  const exp = Date.parse(row.expires_at);
  return Number.isFinite(exp) && exp > now.getTime();
}

export function expiresAtFrom(now: Date = new Date()): string {
  return new Date(now.getTime() + TEMP_PASSWORD_TTL_MS).toISOString();
}

/**
 * Returns the first unexpired, unused row whose hash matches the password,
 * or null. `compare` is bcrypt.compare (injected so tests can use any hasher).
 */
export async function findMatchingTempRow(
  rows: TempPasswordRow[],
  password: string,
  compare: (plain: string, hash: string) => Promise<boolean>,
  now: Date = new Date(),
): Promise<TempPasswordRow | null> {
  const candidate = password.trim();
  if (!looksLikeTempPassword(candidate)) return null;
  for (const row of rows) {
    if (!isRowUsable(row, now)) continue;
    try {
      if (await compare(candidate, row.password_hash)) return row;
    } catch {
      // malformed hash – ignore row
    }
  }
  return null;
}

export function isRateLimited(recentCount: number, limit: { max: number }): boolean {
  return recentCount >= limit.max;
}

export function normalizeIdentifier(raw: unknown): { kind: "email" | "nickname"; value: string } | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value.length < 2 || value.length > 254) return null;
  if (value.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
    return { kind: "email", value };
  }
  if (value.length > 50) return null;
  return { kind: "nickname", value };
}

const LOGIN_EMAIL_DOMAIN = "@trainapp.local";

/** Login name -> the internal auth e-mail used by the login screen. */
export function loginEmailFor(login: string): string {
  return `${login.trim().toLowerCase()}${LOGIN_EMAIL_DOMAIN}`;
}

/** Internal auth e-mail -> login name (what the user types). null if not a login-name account. */
export function loginNameFromAuthEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (!e.endsWith(LOGIN_EMAIL_DOMAIN)) return null;
  const name = e.slice(0, -LOGIN_EMAIL_DOMAIN.length);
  return name.length > 0 ? name : null;
}

export function getClientIp(headers: { get(name: string): string | null }): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const TEMP_PASSWORD_MAIL_SUBJECT = "Ditt tillfälliga lösenord till Grim";

/**
 * Plain, low-noise Swedish mail (text + HTML). Deliberately simple to stay out
 * of spam filters: no external images, no button-heavy layout, one plain link,
 * no shouting or "klicka här".
 */
export function buildTempPasswordMail(opts: { nickname: string; tempPassword: string; appUrl?: string }) {
  const appUrl = opts.appUrl ?? "https://grim.lovable.app";
  const appHost = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const nick = escapeHtml(opts.nickname);
  const pw = escapeHtml(opts.tempPassword);
  const subject = TEMP_PASSWORD_MAIL_SUBJECT;
  const footer = `Grim · ${appHost} · Svara på detta mejl om du behöver hjälp`;
  const text = [
    `Hej ${opts.nickname},`,
    "",
    "Du har begärt ett nytt lösenord till Grim. Här är ett tillfälligt lösenord:",
    "",
    `Användarnamn: ${opts.nickname}`,
    `Tillfälligt lösenord: ${opts.tempPassword}`,
    "",
    "- Det tillfälliga lösenordet gäller i 24 timmar och kan användas en gång.",
    "- Ditt gamla lösenord fungerar fortfarande.",
    "- När du loggar in med det tillfälliga lösenordet får du välja ett nytt lösenord.",
    "",
    `Logga in i appen eller på ${appUrl}`,
    "",
    "Om du inte har begärt detta kan du ignorera mejlet. Ditt konto är oförändrat.",
    "",
    "Hälsningar,",
    "Grim Support",
    "",
    "--",
    footer,
  ].join("\n");
  const html = `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<div style="display:none;max-height:0;overflow:hidden;">Ditt tillfälliga lösenord gäller i 24 timmar.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:24px 28px 8px 28px;font-size:24px;font-weight:bold;letter-spacing:1px;color:#18181b;">GRIM</td></tr>
<tr><td style="padding:8px 28px 0 28px;font-size:15px;line-height:22px;color:#18181b;">
<p style="margin:0 0 14px 0;">Hej ${nick},</p>
<p style="margin:0 0 18px 0;">Du har begärt ett nytt lösenord till Grim. Här är ett tillfälligt lösenord:</p>
</td></tr>
<tr><td style="padding:0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;border-radius:6px;">
<tr><td style="padding:14px 16px 4px 16px;font-size:13px;color:#52525b;">Användarnamn</td></tr>
<tr><td style="padding:0 16px 10px 16px;font-size:16px;font-weight:bold;color:#18181b;">${nick}</td></tr>
<tr><td style="padding:4px 16px 4px 16px;font-size:13px;color:#52525b;">Tillfälligt lösenord</td></tr>
<tr><td style="padding:0 16px 14px 16px;font-family:Consolas,Menlo,'Courier New',monospace;font-size:22px;font-weight:bold;letter-spacing:2px;color:#18181b;">${pw}</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 28px 0 28px;font-size:14px;line-height:21px;color:#3f3f46;">
<p style="margin:0 0 8px 0;">Det tillfälliga lösenordet gäller i 24 timmar och kan användas en gång.</p>
<p style="margin:0 0 8px 0;">Ditt gamla lösenord fungerar fortfarande.</p>
<p style="margin:0 0 16px 0;">När du loggar in med det tillfälliga lösenordet får du välja ett nytt lösenord.</p>
<p style="margin:0 0 16px 0;">Logga in i appen eller på <a href="${appUrl}" style="color:#18181b;">${escapeHtml(appHost)}</a>.</p>
<p style="margin:0 0 16px 0;color:#71717a;">Om du inte har begärt detta kan du ignorera mejlet. Ditt konto är oförändrat.</p>
<p style="margin:0 0 24px 0;">Hälsningar,<br>Grim Support</p>
</td></tr>
<tr><td style="padding:14px 28px 20px 28px;border-top:1px solid #e4e4e7;font-size:12px;line-height:18px;color:#71717a;">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}
