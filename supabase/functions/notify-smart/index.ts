/**
 * Smarta push (native FCM):
 *  - POST {type:"cheer", toUserId, emoji}  (användar-JWT) → «X hejade på ditt pass»
 *    Kräver att en workout_cheers-rad från anroparen till mottagaren skapats senaste 2 min.
 *  - Cron (x-cron-secret), kväll: 
 *      • logga-om-tomt: loggat mat ≥3 av senaste 7 dagarna men inget idag
 *      • streak-hot: tränat var och en av de 3 senaste dagarna men inte idag
 *    Max en smart push per användare och kväll. Opt-out: profiles.smart_push = false.
 * Söndagsrecap skickas redan av weekly-report (cron sön 17 UTC).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNativePush } from "../_shared/sendFcm.ts";
import { authorizeCronCall } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** YYYY-MM-DD i Europe/Stockholm. */
function stockholmKey(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any = {};
  try { body = await req.json(); } catch { /* cron skickar {} */ }

  try {
    if (body?.type === "cheer") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const toUserId = String(body.toUserId || "");
      if (!toUserId || toUserId === user.id) return json({ sent: 0 });
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: cheer } = await admin.from("workout_cheers").select("id, emoji")
        .eq("from_user_id", user.id).eq("to_user_id", toUserId).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!cheer) return json({ sent: 0, reason: "no_recent_cheer" });
      const { data: prof } = await admin.from("profiles").select("smart_push").eq("user_id", toUserId).maybeSingle();
      if (prof && (prof as any).smart_push === false) return json({ sent: 0, reason: "opt_out" });
      const { data: me } = await admin.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const name = (me as any)?.display_name || "En vän";
      const sent = await sendNativePush(admin, [toUserId], {
        title: `${cheer.emoji || "🔥"} ${name} hejade på dig`,
        body: "Kolla ditt pass i flödet",
        data: { url: "/?tab=social" },
      });
      return json({ sent });
    }

    const denied = await authorizeCronCall(req, corsHeaders);
    if (denied) return denied;

    const now = new Date();
    const today = stockholmKey(now);
    const days = Array.from({ length: 8 }, (_, i) => stockholmKey(new Date(now.getTime() - i * 86400000)));
    const weekAgo = days[7];

    const { data: optOut } = await admin.from("profiles").select("user_id").eq("smart_push", false);
    const skip = new Set((optOut || []).map((r: any) => r.user_id));

    // Logga-om-tomt
    const { data: meals } = await admin.from("meal_logs").select("user_id, log_date").gte("log_date", weekAgo).limit(50000);
    const mealDays = new Map<string, Set<string>>();
    for (const r of meals || []) {
      if (!mealDays.has(r.user_id)) mealDays.set(r.user_id, new Set());
      mealDays.get(r.user_id)!.add(r.log_date);
    }
    const nudgeFood: string[] = [];
    for (const [uid, set] of mealDays) {
      if (skip.has(uid) || set.has(today)) continue;
      const prior = days.slice(1).filter((d) => set.has(d)).length;
      if (prior >= 3) nudgeFood.push(uid);
    }

    // Streak-hot
    const sinceIso = new Date(now.getTime() - 4 * 86400000).toISOString();
    const { data: comps } = await admin.from("workout_completions").select("user_id, updated_at, done").eq("done", true).gte("updated_at", sinceIso).limit(50000);
    const trainDays = new Map<string, Set<string>>();
    for (const r of comps || []) {
      if (!trainDays.has(r.user_id)) trainDays.set(r.user_id, new Set());
      trainDays.get(r.user_id)!.add(stockholmKey(new Date(r.updated_at)));
    }
    const nudgeStreak: string[] = [];
    for (const [uid, set] of trainDays) {
      if (skip.has(uid) || set.has(today)) continue;
      if ([days[1], days[2], days[3]].every((d) => set.has(d))) nudgeStreak.push(uid);
    }

    const streakSet = new Set(nudgeStreak);
    let sent = 0;
    if (nudgeStreak.length) sent += await sendNativePush(admin, nudgeStreak, {
      title: "🔥 Din svit är i fara",
      body: "Du har kört flera dagar i rad – ett kort pass räcker för att hålla igång den.",
      data: { url: "/?tab=workout" },
    });
    const food = nudgeFood.filter((u) => !streakSet.has(u));
    if (food.length) sent += await sendNativePush(admin, food, {
      title: "🍽️ Inget loggat idag",
      body: "Ta 30 sekunder och logga dagens mat – kopiera gärna från igår.",
      data: { url: "/?tab=nutrition" },
    });
    return json({ sent, food: food.length, streak: nudgeStreak.length });
  } catch (e) {
    console.error("notify-smart error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
