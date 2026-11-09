// Exporterar ett avslutat Grim-pass till användarens Strava-konto.
// Klienten skickar passets sammanfattning (namn, sport, tider, distans, puls, rutt);
// tokens och client secret finns bara här på serversidan.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasWriteScope, loadStravaCreds } from "../_shared/stravaConfig.ts";
import { buildTcx, externalIdFor, manualActivityParams, needsFileUpload, safeSportType, type StravaExportInput } from "../_shared/stravaTcx.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STRAVA_API = "https://www.strava.com/api/v3";

// deno-lint-ignore no-explicit-any
async function freshAccessToken(admin: any, conn: any, clientId: string, clientSecret: string): Promise<string> {
  const expiresAt = new Date(conn.expires_at).getTime();
  if (isFinite(expiresAt) && expiresAt - Date.now() > 5 * 60 * 1000) return conn.access_token;
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: conn.refresh_token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token_refresh_failed_${res.status}`);
  await admin.from("strava_connections").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Number(data.expires_at) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", conn.id);
  return data.access_token as string;
}

function parseInput(body: any, completionId: string): StravaExportInput | null {
  const p = body?.activity ?? {};
  const startIso = typeof p.startIso === "string" && isFinite(Date.parse(p.startIso)) ? p.startIso : null;
  const elapsedSec = Number(p.elapsedSec);
  if (!startIso || !(elapsedSec > 0) || elapsedSec > 24 * 3600) return null;
  const hr = Array.isArray(p.hr)
    ? p.hr.filter((x: any) => x && isFinite(x.t) && x.bpm > 25 && x.bpm < 240).slice(0, 5000).map((x: any) => ({ t: Number(x.t), bpm: Number(x.bpm) }))
    : null;
  const route = Array.isArray(p.route)
    ? p.route.filter((x: any) => Array.isArray(x) && Math.abs(x[0]) <= 90 && Math.abs(x[1]) <= 180).slice(0, 10000).map((x: any) => [Number(x[0]), Number(x[1])] as [number, number])
    : null;
  return {
    completionId,
    name: String(p.name || "Grim-pass").slice(0, 100),
    sportType: safeSportType(String(p.sportType || "")),
    startIso,
    startLocal: typeof p.startLocal === "string" ? p.startLocal : null,
    elapsedSec,
    distanceM: Number(p.distanceM) > 0 ? Math.min(Number(p.distanceM), 1_000_000) : null,
    calories: Number(p.calories) > 0 ? Math.min(Number(p.calories), 20000) : null,
    description: typeof p.description === "string" ? p.description.slice(0, 1000) : null,
    hr,
    route,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let userId: string | null = null;
  let completionId: string | null = null;
  const record = async (row: Record<string, unknown>) => {
    if (!userId || !completionId) return;
    await admin.from("strava_exports").upsert(
      { user_id: userId, completion_id: completionId, updated_at: new Date().toISOString(), ...row },
      { onConflict: "completion_id" },
    );
  };

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    userId = userData.user?.id ?? null;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    completionId = typeof body.completionId === "string" ? body.completionId : null;
    if (!completionId) return json({ error: "missing_completion" }, 400);

    const { data: completion } = await admin.from("workout_completions")
      .select("id, user_id, done").eq("id", completionId).eq("user_id", userId).maybeSingle();
    if (!completion?.done) return json({ error: "completion_not_found" }, 404);

    const { data: existing } = await admin.from("strava_exports")
      .select("status, strava_activity_id").eq("completion_id", completionId).maybeSingle();
    if (existing?.status === "done" && !body.force) return json({ status: "already", activityId: existing.strava_activity_id });

    const creds = await loadStravaCreds((k) => Deno.env.get(k), admin);
    if (!creds) return json({ error: "strava_not_configured" }, 503);

    const { data: conn } = await admin.from("strava_connections")
      .select("id, access_token, refresh_token, expires_at, scope").eq("user_id", userId).maybeSingle();
    if (!conn) return json({ error: "not_connected" }, 409);
    if (!hasWriteScope(conn.scope)) return json({ error: "needs_reconnect" }, 409);

    const input = parseInput(body, completionId);
    if (!input) return json({ error: "invalid_activity" }, 400);

    const accessToken = await freshAccessToken(admin, conn, creds.clientId, creds.clientSecret);
    const auth = { Authorization: `Bearer ${accessToken}` };
    await record({ status: "pending", error: null });

    let activityId: number | null = null;
    let uploadId: number | null = null;

    if (needsFileUpload(input)) {
      const form = new FormData();
      form.append("file", new Blob([buildTcx(input)], { type: "application/xml" }), `grim-${completionId}.tcx`);
      form.append("data_type", "tcx");
      form.append("name", input.name);
      if (input.description) form.append("description", input.description);
      form.append("external_id", externalIdFor(completionId));
      const up = await fetch(`${STRAVA_API}/uploads`, { method: "POST", headers: auth, body: form });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(`upload_failed_${up.status}: ${String(upData?.message || upData?.error || "").slice(0, 120)}`);
      uploadId = Number(upData.id) || null;
      // Strava bearbetar filen asynkront – fråga några gånger
      for (let i = 0; i < 8 && uploadId && !activityId; i++) {
        await sleep(1500);
        const st = await fetch(`${STRAVA_API}/uploads/${uploadId}`, { headers: auth });
        const sd = await st.json().catch(() => ({}));
        if (sd.activity_id) activityId = Number(sd.activity_id);
        else if (sd.error) {
          const dup = String(sd.error).match(/duplicate of .*?(\d{6,})/i);
          if (dup) { activityId = Number(dup[1]); break; }
          throw new Error(`upload_error: ${String(sd.error).slice(0, 120)}`);
        }
      }
      if (activityId) {
        // TCX kan bara säga Running/Biking/Other – sätt rätt sport i efterhand
        await fetch(`${STRAVA_API}/activities/${activityId}`, {
          method: "PUT",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ sport_type: input.sportType, name: input.name }),
        }).catch(() => null);
      }
    } else {
      const res = await fetch(`${STRAVA_API}/activities`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(manualActivityParams(input)).toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`create_failed_${res.status}: ${String(data?.message || "").slice(0, 120)}`);
      activityId = Number(data.id) || null;
    }

    await record({ status: activityId ? "done" : "processing", upload_id: uploadId, strava_activity_id: activityId, error: null });
    return json({ status: activityId ? "done" : "processing", activityId, uploadId });
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error)).slice(0, 200);
    console.error("[strava-upload] failed", msg);
    await record({ status: "error", error: msg }).catch(() => null);
    return json({ error: msg }, 502);
  }
});
