import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNativePush } from "../_shared/sendFcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Weekly report — runs every Sunday ~18:00 local time.
 * For each user who trained at least one session this week, sends a push
 * with: pass count, total tonnage, distance, current streak.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const safelyParseSets = (value: any): Array<{ kg: number; reps: number }> => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s: any) => ({ kg: Number(s?.kg) || 0, reps: Number(s?.reps) || 0 }));
  } catch {
    return [];
  }
};

const computeWeekStats = (completions: any[]) => {
  let passCount = 0;
  let kgTotal = 0;
  let prCount = 0;
  let distanceKm = 0;

  for (const c of completions) {
    if (!c?.done) continue;
    passCount += 1;
    if (c.logged_distance_km) distanceKm += Number(c.logged_distance_km) || 0;
    const weights = c.logged_weights;
    if (!weights || typeof weights !== "object") continue;
    for (const [key, value] of Object.entries(weights)) {
      if (!key.startsWith("__setdata__")) continue;
      const sets = safelyParseSets(value);
      for (const s of sets) {
        kgTotal += s.kg * s.reps;
      }
    }
  }

  return {
    passCount,
    tons: Math.round((kgTotal / 1000) * 10) / 10,
    distanceKm: Math.round(distanceKm * 10) / 10,
    prCount,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Week window — last 7 days from now
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * ONE_DAY_MS);

    // Pull every user who has any completion in this window
    const { data: completions, error } = await supabaseAdmin
      .from("workout_completions")
      .select("user_id, done, logged_distance_km, logged_weights, updated_at")
      .eq("done", true)
      .gte("updated_at", weekAgo.toISOString());

    if (error) throw error;

    if (!completions || completions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_completions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group per user
    const perUser = new Map<string, any[]>();
    for (const c of completions) {
      const arr = perUser.get(c.user_id) || [];
      arr.push(c);
      perUser.set(c.user_id, arr);
    }

    let totalSent = 0;
    const sentUsers: string[] = [];

    for (const [userId, userCompletions] of perUser.entries()) {
      const stats = computeWeekStats(userCompletions);
      if (stats.passCount === 0) continue;

      const parts: string[] = [`${stats.passCount} pass`];
      if (stats.tons > 0) parts.push(`${stats.tons.toLocaleString("sv-SE")} ton`);
      if (stats.distanceKm > 0) parts.push(`${stats.distanceKm.toLocaleString("sv-SE")} km`);

      const body = `Veckans summering: ${parts.join(" · ")} 🔥`;

      const sent = await sendNativePush(supabaseAdmin, [userId], {
        title: "📊 Veckorapport",
        body,
        data: { url: "/?tab=stats" },
      });
      if (sent > 0) {
        totalSent += sent;
        sentUsers.push(userId);
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, users: sentUsers.length, week_start: weekAgo.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("weekly-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
