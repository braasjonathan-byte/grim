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
const defaultRandom: RandomSource = (bytes) => crypto.getRandomValues(bytes);

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

export function buildTempPasswordMail(opts: { nickname: string; tempPassword: string; appUrl?: string }) {
  const appUrl = opts.appUrl ?? "https://grim.lovable.app";
  const nick = escapeHtml(opts.nickname);
  const pw = escapeHtml(opts.tempPassword);
  const subject = "Ditt tillfälliga lösenord till Grim";
  const text = [
    `Hej ${opts.nickname}!`,
    "",
    "Du (eller någon annan) har begärt ett nytt lösenord till Grim.",
    "",
    `Användarnamn: ${opts.nickname}`,
    `Tillfälligt lösenord: ${opts.tempPassword}`,
    "",
    "Lösenordet gäller i 24 timmar och kan bara användas en gång.",
    "Ditt gamla lösenord fungerar fortfarande tills du har valt ett nytt.",
    "När du loggar in med det tillfälliga lösenordet får du direkt välja ett nytt lösenord.",
    "",
    "Har du inte begärt detta kan du ignorera mejlet – ditt konto är oförändrat.",
    "",
    `Logga in: ${appUrl}`,
    "",
    "/ Grim Support",
  ].join("\n");
  const html = `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#151517;border:1px solid #27272a;border-radius:16px;">
        <tr><td style="padding:28px 28px 8px;text-align:center;">
          <div style="font-size:34px;font-weight:900;letter-spacing:-1px;color:#ffffff;">GRIM<span style="color:#a1a1aa;">.</span></div>
          <div style="font-size:12px;color:#a1a1aa;font-style:italic;margin-top:4px;">lift heavier than runners, run faster than lifters</div>
        </td></tr>
        <tr><td style="padding:16px 28px 0;">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#ffffff;">Ditt tillfälliga lösenord</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#d4d4d8;">Hej ${nick}! Du (eller någon annan) har begärt ett nytt lösenord till Grim.</p>
          <p style="margin:0 0 6px;font-size:13px;color:#a1a1aa;">Användarnamn</p>
          <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#ffffff;">${nick}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#a1a1aa;">Tillfälligt lösenord</p>
          <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:24px;font-weight:800;letter-spacing:2px;text-align:center;background:#0b0b0c;border:1px solid #ffffff;color:#ffffff;border-radius:10px;padding:16px 8px;margin:0 0 18px;">${pw}</div>
          <ul style="margin:0 0 18px;padding-left:18px;font-size:14px;line-height:1.6;color:#d4d4d8;">
            <li>Gäller i <strong style="color:#fff;">24 timmar</strong> och kan bara användas en gång.</li>
            <li>Ditt <strong style="color:#fff;">gamla lösenord fungerar fortfarande</strong> tills du har valt ett nytt.</li>
            <li>När du loggar in med det tillfälliga lösenordet får du direkt <strong style="color:#fff;">välja ett nytt lösenord</strong>.</li>
          </ul>
          <div style="text-align:center;margin:0 0 22px;">
            <a href="${appUrl}" style="display:inline-block;background:#ffffff;color:#0b0b0c;text-decoration:none;font-weight:800;font-size:15px;padding:12px 28px;border-radius:10px;">Logga in på Grim</a>
          </div>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#71717a;">Har du inte begärt detta kan du ignorera mejlet – ditt konto är oförändrat. Svara på det här mejlet om du behöver hjälp.</p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#52525b;margin:16px 0 0;">Grim Support · grimtraning@gmail.com</p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}
