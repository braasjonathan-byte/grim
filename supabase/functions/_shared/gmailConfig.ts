// Resolves Gmail API credentials for edge functions.
// Order: edge env (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN) if all set,
// else public.app_private_config (RLS on, no policies → service role only).
// Values are never logged.

export const GMAIL_CONFIG_KEYS = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"] as const;
export type GmailCreds = { clientId: string; clientSecret: string; refreshToken: string };

type EnvGetter = (name: string) => string | undefined;
// deno-lint-ignore no-explicit-any
type AdminClient = any;

export function credsFromRecord(rec: Record<string, string | undefined | null>): GmailCreds | null {
  const clientId = rec.GMAIL_CLIENT_ID?.trim();
  const clientSecret = rec.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = rec.GMAIL_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export async function loadGmailCreds(getEnv: EnvGetter, admin: AdminClient): Promise<GmailCreds | null> {
  const fromEnv = credsFromRecord(Object.fromEntries(GMAIL_CONFIG_KEYS.map((k) => [k, getEnv(k)])));
  if (fromEnv) return fromEnv;
  if (!admin) return null;
  const { data, error } = await admin
    .from("app_private_config")
    .select("key, value")
    .in("key", [...GMAIL_CONFIG_KEYS]);
  if (error) {
    console.error("[gmailConfig] app_private_config read failed", error.message ?? "");
    return null;
  }
  const rec: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) rec[row.key] = row.value;
  return credsFromRecord(rec);
}
