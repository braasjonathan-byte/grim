import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNativePush } from "../_shared/sendFcm.ts";
import { authorizeCronCall } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Weekly report — runs every Sunday ~18:00 local time.
 * For each user who trained at least one session this week:
 *  - stores a detailed report row in public.weekly_reports (in-app notification + detail page)
 *  - sends a push notification deep-linking to that report
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

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

/** Per-session breakdown for one completion row. */
const computeSessionStats = (c: any) => {
  let setCount = 0;
  let kgTotal = 0;
  const exercises: string[] = [];

  const weights = c?.logged_weights;
  if (weights && typeof weights === "object") {
    for (const [key, value] of Object.entries(weights)) {
      if (!key.startsWith("__setdata__")) continue;
      exercises.push(key.substring("__setdata__".length));
      const sets = safelyParseSets(value);
      for (const s of sets) {
        if (s.kg || s.reps) setCount += 1;
        kgTotal += s.kg * s.reps;
      }
    }
  }

  return {
    setCount,
    tons: Math.round((kgTotal / 1000) * 100) / 100,
    kgTotal,
    distanceKm: Math.round((Number(c?.logged_distance_km) || 0) * 10) / 10,
    tempo: typeof c?.logged_tempo === "string" ? c.logged_tempo : null,
    exercises,
  };
};

const computeTotals = (completions: any[]) => {
  let passCount = 0;
  let kgTotal = 0;
  let distanceKm = 0;
  let setCount = 0;

  for (const c of completions) {
    if (!c?.done) continue;
    passCount += 1;
    const s = computeSessionStats(c);
    kgTotal += s.kgTotal;
    distanceKm += s.distanceKm;
    setCount += s.setCount;
  }

  return {
    passCount,
    setCount,
    tons: Math.round((kgTotal / 1000) * 10) / 10,
    distanceKm: Math.round(distanceKm * 10) / 10,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await authorizeCronCall(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Week window — last 7 days from now, plus the 7 days before for comparison
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * ONE_DAY_MS);
    const twoWeeksAgo = new Date(now.getTime() - 14 * ONE_DAY_MS);

    const { data: completions, error } = await supabaseAdmin
      .from("workout_completions")
      .select("user_id, week, day, done, logged_distance_km, logged_tempo, logged_weights, updated_at")
      .eq("done", true)
      .gte("updated_at", twoWeeksAgo.toISOString());

    if (error) throw error;

    if (!completions || completions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_completions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group per user, split current vs previous week
    const perUser = new Map<string, { current: any[]; previous: any[] }>();
    for (const c of completions) {
      const bucket = perUser.get(c.user_id) || { current: [], previous: [] };
      if (new Date(c.updated_at).getTime() >= weekAgo.getTime()) bucket.current.push(c);
      else bucket.previous.push(c);
      perUser.set(c.user_id, bucket);
    }

    let totalSent = 0;
    const sentUsers: string[] = [];
    let reportsWritten = 0;

    for (const [userId, buckets] of perUser.entries()) {
      const stats = computeTotals(buckets.current);
      if (stats.passCount === 0) continue;

      const prevStats = computeTotals(buckets.previous);

      // Session names from the user's plan
      const planKeys = buckets.current
        .filter((c: any) => c.done)
        .map((c: any) => ({ week: c.week, day: c.day }));
      const nameMap = new Map<string, string>();
      if (planKeys.length > 0) {
        const { data: plans } = await supabaseAdmin
          .from("workout_plans")
          .select("week, day, session_name")
          .eq("user_id", userId)
          .in("week", [...new Set(planKeys.map((k) => k.week))]);
        (plans || []).forEach((p: any) => nameMap.set(`${p.week}|${p.day}`, p.session_name));
      }

      const sessions = buckets.current
        .filter((c: any) => c.done)
        .sort((a: any, b: any) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        .map((c: any) => {
          const s = computeSessionStats(c);
          return {
            date: c.updated_at,
            week: c.week,
            day: c.day,
            name: nameMap.get(`${c.week}|${c.day}`) || c.day || "Pass",
            set_count: s.setCount,
            tons: s.tons,
            distance_km: s.distanceKm,
            tempo: s.tempo,
            exercises: s.exercises.slice(0, 8),
          };
        });

      const parts: string[] = [`${stats.passCount} pass`];
      if (stats.tons > 0) parts.push(`${stats.tons.toLocaleString("sv-SE")} ton`);
      if (stats.distanceKm > 0) parts.push(`${stats.distanceKm.toLocaleString("sv-SE")} km`);
      const body = `Veckans summering: ${parts.join(" · ")} 🔥`;

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("weekly_reports")
        .upsert(
          {
            user_id: userId,
            week_start: dateKey(weekAgo),
            week_end: dateKey(now),
            pass_count: stats.passCount,
            total_tons: stats.tons,
            total_distance_km: stats.distanceKm,
            pr_count: 0,
            prev_tons: prevStats.tons,
            prev_pass_count: prevStats.passCount,
            prev_distance_km: prevStats.distanceKm,
            summary: body,
            sessions,
          },
          { onConflict: "user_id,week_start" },
        )
        .select("id")
        .maybeSingle();

      if (insertError) {
        console.error("weekly_reports upsert failed:", insertError);
      } else {
        reportsWritten += 1;
      }

      const reportId = inserted?.id;
      const url = reportId ? `/?tab=stats&weeklyReport=${reportId}` : "/?tab=stats&weeklyReport=latest";

      const sent = await sendNativePush(supabaseAdmin, [userId], {
        title: "📊 Veckorapport",
        body,
        data: { url },
      });
      if (sent > 0) {
        totalSent += sent;
        sentUsers.push(userId);
      }
    }

    return new Response(
      JSON.stringify({
        sent: totalSent,
        users: sentUsers.length,
        reports: reportsWritten,
        week_start: weekAgo.toISOString(),
      }),
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
