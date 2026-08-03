import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Authorizes background/cron-triggered edge functions.
 *
 * Accepts either:
 *  1. the shared cron secret in the `x-cron-secret` header (matched against
 *     `public.cron_secrets`, readable only with the service role), or
 *  2. a valid JWT belonging to a user with the `admin` role (manual triggers).
 *
 * Returns `null` when authorized, otherwise a ready-to-return 403 Response.
 */
export async function authorizeCronCall(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const forbidden = () =>
    new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // 1) Shared cron secret
  const provided = req.headers.get("x-cron-secret");
  if (provided) {
    const { data } = await admin
      .from("cron_secrets")
      .select("secret")
      .eq("name", "cron")
      .maybeSingle();
    if (data?.secret && timingSafeEqual(provided, data.secret)) return null;
    return forbidden();
  }

  // 2) Admin JWT
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return forbidden();

  const { data: userData } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return forbidden();

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return roleRow ? null : forbidden();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
