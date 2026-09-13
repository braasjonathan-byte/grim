import { supabase } from "@/integrations/supabase/client";
import {
  ACHIEVEMENTS,
  calculateAchievementMetrics,
  unlockEarnedAchievements,
  type AchievementCompletion,
} from "@/lib/achievements";

export interface AchievementSyncResult {
  ids: string[];
  stamps: Record<string, string>;
  latestId: string | null;
}

const ORDER = new Map(ACHIEVEMENTS.map((a, i) => [a.id, i]));

/**
 * Picks the achievement that should be shown as "senaste achievement".
 * Rows unlocked in the same batch share a timestamp, so ties are broken by
 * the achievement order (later in the list = more advanced).
 */
export const pickLatestAchievementId = (stamps: Record<string, string>): string | null => {
  let best: string | null = null;
  let bestTime = -Infinity;
  for (const [id, ts] of Object.entries(stamps)) {
    if (!ORDER.has(id)) continue;
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) continue;
    if (t > bestTime || (t === bestTime && (ORDER.get(id) ?? 0) > (ORDER.get(best ?? "") ?? -1))) {
      best = id;
      bestTime = t;
    }
  }
  return best;
};

/**
 * Recomputes lifetime achievement metrics (active plan + archived plans +
 * challenges + social interaction) and unlocks anything newly earned, so the
 * home screen never lags behind the statistics tab.
 */
export const syncAchievements = async (userId: string): Promise<AchievementSyncResult> => {
  const [
    { data: compData },
    { data: planData },
    { data: archiveData },
    { count: challengeCount },
    { count: firesGiven },
    { count: commentsGiven },
  ] = await Promise.all([
    supabase
      .from("workout_completions")
      .select("week, day, done, skipped, updated_at, logged_distance_km, logged_weights")
      .eq("user_id", userId),
    supabase.from("workout_plans").select("week, day, details, tempo").eq("user_id", userId),
    supabase.from("archived_plans").select("completion_data, plan_data, archived_at").eq("user_id", userId),
    supabase.from("daily_challenge_completions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("social_post_likes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("social_post_comments").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const planDetails = new Map(
    ((planData || []) as any[]).map((p) => [
      `${p.week}-${p.day}`,
      JSON.stringify({ details: p.details || "", tempo: p.tempo ?? "" }),
    ]),
  );

  const completions: AchievementCompletion[] = ((compData || []) as any[]).map((c) => ({
    ...c,
    plan_details: planDetails.get(`${c.week}-${c.day}`) ?? null,
  }));

  for (const archive of (archiveData || []) as any[]) {
    const planRows = Array.isArray(archive.plan_data) ? archive.plan_data : [];
    const rows = Array.isArray(archive.completion_data) ? archive.completion_data : [];
    for (const c of rows) {
      const row = planRows.find(
        (p: any) => Number(p?.week) === Number(c.week) && String(p?.day) === String(c.day),
      );
      completions.push({
        ...c,
        done: Boolean(c.done),
        updated_at: c.updated_at || archive.archived_at,
        plan_details: row?.details
          ? JSON.stringify({ details: row.details, tempo: row.tempo ?? "" })
          : null,
      } as AchievementCompletion);
    }
  }

  const metrics = calculateAchievementMetrics(completions, challengeCount || 0, {
    firesGiven: firesGiven || 0,
    commentsGiven: commentsGiven || 0,
  });

  await unlockEarnedAchievements(userId, metrics);

  const { data: stored } = await supabase
    .from("user_achievements" as any)
    .select("achievement_id, unlocked_at")
    .eq("user_id", userId);

  const stamps: Record<string, string> = {};
  for (const row of (stored || []) as any[]) {
    if (row?.achievement_id && row?.unlocked_at) stamps[row.achievement_id] = row.unlocked_at;
  }

  return {
    ids: Object.keys(stamps),
    stamps,
    latestId: pickLatestAchievementId(stamps),
  };
};
