import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type StravaConnection = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_synced_at: string | null;
};

type StravaActivity = {
  id: number;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDateKey(value: string): string {
  return value.slice(0, 10);
}

function formatPace(averageSpeedMps?: number): string | null {
  if (!averageSpeedMps || averageSpeedMps <= 0) return null;
  const secondsPerKm = Math.round(1000 / averageSpeedMps);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = String(secondsPerKm % 60).padStart(2, "0");
  return `${minutes}:${seconds} min/km`;
}

function roundDistanceKm(distanceMeters?: number): number | null {
  if (!distanceMeters || distanceMeters <= 0) return null;
  return Math.round((distanceMeters / 1000) * 100) / 100;
}

async function refreshAccessToken(connection: StravaConnection, clientId: string, clientSecret: string) {
  if (new Date(connection.expires_at).getTime() > Date.now() + 60_000) {
    return {
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      expiresAt: connection.expires_at,
    };
  }

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Strava token refresh failed [${response.status}]: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: new Date(Number(data.expires_at) * 1000).toISOString(),
  };
}

async function fetchActivities(accessToken: string, afterUnix: number): Promise<StravaActivity[]> {
  const activities: StravaActivity[] = [];

  for (let page = 1; page <= 4; page += 1) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("after", String(afterUnix));
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "50");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Strava activities fetch failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data) || data.length === 0) break;
    activities.push(...data);
    if (data.length < 50) break;
  }

  return activities;
}

async function syncConnection(supabaseAdmin: any, connection: StravaConnection, clientId: string, clientSecret: string) {
  const refreshed = await refreshAccessToken(connection, clientId, clientSecret);

  if (refreshed.accessToken !== connection.access_token || refreshed.refreshToken !== connection.refresh_token) {
    await supabaseAdmin
      .from("strava_connections")
      .update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        expires_at: refreshed.expiresAt,
      })
      .eq("id", connection.id);
  }

  const fallbackAfter = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
  const afterUnix = connection.last_synced_at
    ? Math.max(Math.floor(new Date(connection.last_synced_at).getTime() / 1000) - 3600, fallbackAfter)
    : fallbackAfter;

  const activities = await fetchActivities(refreshed.accessToken, afterUnix);
  let imported = 0;

  for (const activity of activities) {
    if (!activity.id || !activity.start_date) continue;

    const dateKey = formatDateKey(activity.start_date);
    const dayKey = `${dateKey}_strava_${activity.id}`;
    const distanceKm = roundDistanceKm(activity.distance);
    const pace = formatPace(activity.average_speed);
    const pulse = activity.average_heartrate ? Math.round(activity.average_heartrate) : null;
    const label = activity.sport_type || activity.type || "Strava";
    const commentParts = [
      `Strava: ${activity.name || label}`,
      label,
      activity.moving_time ? `${Math.round(activity.moving_time / 60)} min` : null,
    ].filter(Boolean);

    const { data: completion, error: completionError } = await supabaseAdmin
      .from("workout_completions")
      .upsert({
        user_id: connection.user_id,
        week: 0,
        day: dayKey,
        done: true,
        skipped: false,
        logged_distance_km: distanceKm,
        logged_tempo: pace,
        logged_pulse: pulse,
        user_comment: commentParts.join(" · "),
        updated_at: activity.start_date,
      }, { onConflict: "user_id,week,day" })
      .select("id")
      .single();

    if (completionError) throw completionError;

    const { error: activityError } = await supabaseAdmin
      .from("strava_activities")
      .upsert({
        user_id: connection.user_id,
        strava_activity_id: activity.id,
        name: activity.name ?? null,
        activity_type: activity.type ?? null,
        sport_type: activity.sport_type ?? null,
        start_date: activity.start_date,
        distance_km: distanceKm,
        moving_time_seconds: activity.moving_time ?? null,
        elapsed_time_seconds: activity.elapsed_time ?? null,
        average_speed_mps: activity.average_speed ?? null,
        average_heartrate: activity.average_heartrate ?? null,
        max_heartrate: activity.max_heartrate ?? null,
        workout_completion_id: completion?.id ?? null,
        raw_activity: activity,
      }, { onConflict: "user_id,strava_activity_id" });

    if (activityError) throw activityError;
    imported += 1;
  }

  await supabaseAdmin
    .from("strava_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);

  return { userId: connection.user_id, imported };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    if (!clientId) throw new Error("STRAVA_CLIENT_ID is not configured");
    if (!clientSecret) throw new Error("STRAVA_CLIENT_SECRET is not configured");

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.max(1, Math.min(body.limit, 25)) : 25;
    let requestedUserId: string | null = null;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const bearerToken = authHeader.replace("Bearer ", "").trim();
    if (bearerToken) {
      const { data: userData } = await supabaseAdmin.auth.getUser(bearerToken);
      requestedUserId = userData.user?.id ?? null;
    }

    let query = supabaseAdmin
      .from("strava_connections")
      .select("id, user_id, access_token, refresh_token, expires_at, last_synced_at")
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(limit);

    if (body.mode === "user") {
      if (!requestedUserId) return jsonResponse({ error: "Unauthorized" }, 401);
      query = query.eq("user_id", requestedUserId).limit(1);
    }

    const { data: connections, error } = await query;

    if (error) throw error;

    const results = [];
    for (const connection of (connections || []) as StravaConnection[]) {
      try {
        results.push(await syncConnection(supabaseAdmin, connection, clientId, clientSecret));
      } catch (connectionError) {
        console.error("Strava sync failed for connection", connection.id, connectionError);
        results.push({
          userId: connection.user_id,
          imported: 0,
          error: connectionError instanceof Error ? connectionError.message : String(connectionError),
        });
      }
    }

    return jsonResponse({ success: true, syncedConnections: results.length, results });
  } catch (error) {
    console.error("Strava sync failed", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
