import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function redirectTo(origin: string, status: "connected" | "error", message?: string) {
  const url = new URL(origin);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("strava", status);
  if (message) url.searchParams.set("stravaMessage", message);
  return Response.redirect(url.toString(), 302);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const fallbackOrigin = "https://grim.lovable.app";

  try {
    const requestUrl = new URL(req.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const scope = requestUrl.searchParams.get("scope");
    const stravaError = requestUrl.searchParams.get("error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    if (!clientId) throw new Error("STRAVA_CLIENT_ID is not configured");
    if (!clientSecret) throw new Error("STRAVA_CLIENT_SECRET is not configured");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    if (!state) return redirectTo(fallbackOrigin, "error", "missing_state");

    const { data: stateRow, error: stateError } = await adminClient
      .from("strava_oauth_states")
      .select("user_id, redirect_origin, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (stateError || !stateRow) return redirectTo(fallbackOrigin, "error", "invalid_state");

    const redirectOrigin = stateRow.redirect_origin || fallbackOrigin;
    await adminClient.from("strava_oauth_states").delete().eq("state", state);

    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      return redirectTo(redirectOrigin, "error", "expired_state");
    }

    if (stravaError || !code) {
      return redirectTo(redirectOrigin, "error", stravaError || "missing_code");
    }

    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(`Strava token exchange failed [${tokenResponse.status}]: ${JSON.stringify(tokenData)}`);
    }

    const athlete = tokenData.athlete ?? {};
    const expiresAt = new Date(Number(tokenData.expires_at) * 1000).toISOString();

    const { error: upsertError } = await adminClient.from("strava_connections").upsert({
      user_id: stateRow.user_id,
      strava_athlete_id: athlete.id,
      athlete_firstname: athlete.firstname ?? null,
      athlete_lastname: athlete.lastname ?? null,
      athlete_username: athlete.username ?? null,
      athlete_profile_url: athlete.profile_medium ?? athlete.profile ?? null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) throw upsertError;

    return redirectTo(redirectOrigin, "connected");
  } catch (error) {
    console.error("Strava OAuth callback failed", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return redirectTo(fallbackOrigin, "error", errorMessage.slice(0, 120));
  }
});
