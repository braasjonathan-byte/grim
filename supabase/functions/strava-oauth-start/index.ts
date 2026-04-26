import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getFunctionBaseUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
  return `${supabaseUrl}/functions/v1`;
}

function createState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!clientId) throw new Error("STRAVA_CLIENT_ID is not configured");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!anonKey) throw new Error("SUPABASE_ANON_KEY is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const rawOrigin = typeof body.redirectOrigin === "string" ? body.redirectOrigin : req.headers.get("origin");
    const redirectOrigin = rawOrigin && /^https?:\/\//.test(rawOrigin) ? rawOrigin : "https://grim.lovable.app";
    const state = createState();

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { error: insertError } = await adminClient.from("strava_oauth_states").insert({
      user_id: userData.user.id,
      state,
      redirect_origin: redirectOrigin,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertError) throw insertError;

    const authUrl = new URL("https://www.strava.com/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", `${getFunctionBaseUrl()}/strava-oauth-callback`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("approval_prompt", "auto");
    authUrl.searchParams.set("scope", "read,activity:read_all");
    authUrl.searchParams.set("state", state);

    return jsonResponse({ authUrl: authUrl.toString() });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
