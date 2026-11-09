// Deno-side helper for the password_reset_rate_events table (service role).
// deno-lint-ignore no-explicit-any
type Admin = any;

export async function hitRateLimit(
  admin: Admin,
  bucket: string,
  limit: { max: number; windowMs: number },
): Promise<boolean> {
  const since = new Date(Date.now() - limit.windowMs).toISOString();
  const { count, error } = await admin
    .from("password_reset_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", since);
  if (error) {
    console.error("[rate-limit] count failed", error.message);
    return false;
  }
  if ((count ?? 0) >= limit.max) return true;
  const { error: insErr } = await admin.from("password_reset_rate_events").insert({ bucket });
  if (insErr) console.error("[rate-limit] insert failed", insErr.message);
  return false;
}
