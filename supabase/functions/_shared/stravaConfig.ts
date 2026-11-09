// Resolves Strava API credentials for edge functions.
// Order: edge env (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET) if both set,
// else public.app_private_config (RLS on, no policies → service role only).
// Values are never logged.

export const STRAVA_CONFIG_KEYS = ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"] as const;
export type StravaCreds = { clientId: string; clientSecret: string };

type EnvGetter = (name: string) => string | undefined;
// deno-lint-ignore no-explicit-any
type AdminClient = any;

export function stravaCredsFromRecord(rec: Record<string, string | undefined | null>): StravaCreds | null {
  const clientId = rec.STRAVA_CLIENT_ID?.trim();
  const clientSecret = rec.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function loadStravaCreds(getEnv: EnvGetter, admin: AdminClient): Promise<StravaCreds | null> {
  const fromEnv = stravaCredsFromRecord(Object.fromEntries(STRAVA_CONFIG_KEYS.map((k) => [k, getEnv(k)])));
  if (fromEnv) return fromEnv;
  if (!admin) return null;
  const { data, error } = await admin
    .from("app_private_config")
    .select("key, value")
    .in("key", [...STRAVA_CONFIG_KEYS]);
  if (error) {
    console.error("[stravaConfig] app_private_config read failed", error.message ?? "");
    return null;
  }
  const rec: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) rec[row.key] = row.value;
  return stravaCredsFromRecord(rec);
}

/** Scope Grim begär: läsa pass (import) och skriva pass (export). */
export const STRAVA_SCOPE = "read,activity:read_all,activity:write";

export const hasWriteScope = (scope: string | null | undefined) =>
  String(scope || "").split(/[ ,]+/).includes("activity:write");
