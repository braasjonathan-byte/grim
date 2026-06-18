import { supabase } from "@/integrations/supabase/client";
import { getWorkoutDistanceKm } from "@/lib/workoutDistance";

export type AchievementDifficulty = "brons" | "silver" | "guld" | "legend";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  metric: keyof AchievementMetrics;
  threshold: number;
  difficulty: AchievementDifficulty;
  emoji: string;
}

export interface AchievementCompletion {
  done?: boolean | null;
  logged_distance_km?: number | null;
  logged_weights?: Record<string, any> | null;
  plan_details?: string | null;
}

export interface AchievementMetrics {
  workouts: number;
  reps: number;
  tons: number;
  distanceKm: number;
  challenges: number;
  firesGiven: number;
  commentsGiven: number;
  bestSessionTons: number;
  currentStreak: number;
}

const difficultyForIndex = (index: number): AchievementDifficulty => {
  if (index < 6) return "brons";
  if (index < 12) return "silver";
  if (index < 18) return "guld";
  return "legend";
};

const makeAchievements = (
  prefix: string,
  titleBase: string,
  metric: keyof AchievementMetrics,
  thresholds: number[],
  unit: string,
  emoji: string,
): AchievementDefinition[] => thresholds.map((threshold, index) => ({
  id: `${prefix}-${threshold}`,
  title: `${titleBase} ${threshold.toLocaleString("sv-SE")}${unit}`,
  description: `Nå ${threshold.toLocaleString("sv-SE")} ${unit.trim() || "st"}.`,
  metric,
  threshold,
  difficulty: difficultyForIndex(index),
  emoji,
}));

export const ACHIEVEMENTS: AchievementDefinition[] = [
  ...makeAchievements("pass", "Passjägare", "workouts", [1, 3, 5, 10, 15, 25, 35, 50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000, 1250, 1500], " pass", "✅"),
  ...makeAchievements("reps", "Repmaskin", "reps", [50, 100, 250, 500, 750, 1000, 1500, 2500, 4000, 6000, 8000, 10000, 15000, 20000, 30000, 40000, 50000, 75000, 100000, 150000], " reps", "🔁"),
  ...makeAchievements("ton", "Järnflyttare", "tons", [1, 2, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500], " ton", "🏋️"),
  ...makeAchievements("km", "Kilometerkrigare", "distanceKm", [1, 3, 5, 10, 21, 42, 75, 100, 150, 250, 400, 600, 800, 1000, 1500, 2000, 3000, 5000, 7500, 10000], " km", "👟"),
  ...makeAchievements("utmaning", "Utmaningsvinnare", "challenges", [1, 2, 3, 5, 7, 10, 14, 21, 30, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500], " utmaningar", "⚔️"),
  ...makeAchievements("eld", "Eldsjäl", "firesGiven", [1, 5, 10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000], " eldningar", "🔥"),
  ...makeAchievements("kommentar", "Hejarklacken", "commentsGiven", [1, 5, 10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000], " kommentarer", "💬"),
  ...makeAchievements("tonpass", "Tonklubben", "bestSessionTons", [5, 10, 15, 20, 30, 50], "-tons pass", "💥"),
  ...makeAchievements("streak", "Streak", "currentStreak", [3, 7, 14, 30, 60, 100, 200, 365], " dagar i rad", "⚡"),
];

export const getAchievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

export const getUnlockedAchievements = (ids: string[]) => {
  const unlocked = new Set(ids);
  return getHighestAchievementsByMetric(ACHIEVEMENTS.filter((achievement) => unlocked.has(achievement.id)));
};

const getHighestAchievementsByMetric = (achievements: AchievementDefinition[]) => {
  const highest = new Map<keyof AchievementMetrics, AchievementDefinition>();

  for (const achievement of achievements) {
    const current = highest.get(achievement.metric);
    if (!current || achievement.threshold > current.threshold) {
      highest.set(achievement.metric, achievement);
    }
  }

  return ACHIEVEMENTS.filter((achievement) => highest.get(achievement.metric)?.id === achievement.id);
};

export const calculateAchievementMetrics = (
  completions: AchievementCompletion[],
  challengeCount = 0,
  interaction: { firesGiven?: number; commentsGiven?: number } = {},
): AchievementMetrics => {
  let workouts = 0;
  let reps = 0;
  let kgTotal = 0;
  let distanceKm = 0;
  let bestSessionTons = 0;

  const dateSet = new Set<string>();

  for (const completion of completions) {
    if (!completion.done) continue;
    workouts += 1;
    distanceKm += getWorkoutDistanceKm({
      loggedDistanceKm: completion.logged_distance_km ?? null,
      loggedWeights: completion.logged_weights ?? null,
      planDetails: completion.plan_details ?? null,
    });

    const ts = (completion as any).updated_at;
    if (ts && typeof ts === "string") {
      const d = ts.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dateSet.add(d);
    }

    const weights = completion.logged_weights;
    if (!weights || typeof weights !== "object") continue;
    let sessionKg = 0;
    for (const [key, value] of Object.entries(weights)) {
      if (!key.startsWith("__setdata__")) continue;
      const sets = typeof value === "string" ? safelyParseSets(value) : Array.isArray(value) ? value : [];
      for (const set of sets) {
        const setReps = Number(set?.reps) || 0;
        const kg = Math.max(0, Number(set?.kg) || 0);
        reps += setReps;
        kgTotal += kg * setReps;
        sessionKg += kg * setReps;
      }
    }
    const sessionTons = sessionKg / 1000;
    if (sessionTons > bestSessionTons) bestSessionTons = sessionTons;
  }

  let currentStreak = 0;
  if (dateSet.size > 0) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const cursor = new Date(today);
    const todayStr = today.toISOString().slice(0, 10);
    if (!dateSet.has(todayStr)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (dateSet.has(cursor.toISOString().slice(0, 10))) {
      currentStreak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  return {
    workouts,
    reps,
    tons: Math.floor(kgTotal / 1000),
    distanceKm: Math.floor(distanceKm),
    challenges: challengeCount,
    firesGiven: interaction.firesGiven ?? 0,
    commentsGiven: interaction.commentsGiven ?? 0,
    bestSessionTons: Math.floor(bestSessionTons),
    currentStreak,
  };
};

/**
 * Counts the user's outgoing reactions/comments and unlocks any newly
 * earned interaction achievements. Best-effort, swallows errors.
 */
export const checkInteractionAchievements = async (userId: string) => {
  try {
    const [{ count: firesGiven }, { count: commentsGiven }] = await Promise.all([
      supabase.from("social_post_likes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("social_post_comments").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const earned = getEarnedAchievements({
      workouts: 0, reps: 0, tons: 0, distanceKm: 0, challenges: 0,
      firesGiven: firesGiven || 0,
      commentsGiven: commentsGiven || 0,
      bestSessionTons: 0,
      currentStreak: 0,
    }).filter((a) => a.metric === "firesGiven" || a.metric === "commentsGiven");
    if (earned.length === 0) return [];

    const { data: existing } = await supabase
      .from("user_achievements" as any)
      .select("achievement_id")
      .eq("user_id", userId);
    const existingIds = new Set((existing || []).map((row: any) => row.achievement_id));
    const fresh = earned.filter((a) => !existingIds.has(a.id));
    if (fresh.length > 0) {
      await supabase.from("user_achievements" as any).insert(
        fresh.map((a) => ({ user_id: userId, achievement_id: a.id })) as any,
      );
    }
    return fresh;
  } catch {
    return [];
  }
};

export const getEarnedAchievements = (metrics: AchievementMetrics) =>
  ACHIEVEMENTS.filter((achievement) => metrics[achievement.metric] >= achievement.threshold);

export const unlockEarnedAchievements = async (
  userId: string,
  metrics: AchievementMetrics,
) => {
  const earned = getEarnedAchievements(metrics);
  if (earned.length === 0) return [];

  const { data: existing } = await supabase
    .from("user_achievements" as any)
    .select("achievement_id")
    .eq("user_id", userId);
  const existingIds = new Set((existing || []).map((row: any) => row.achievement_id));
  const newAchievements = earned.filter((achievement) => !existingIds.has(achievement.id));

  if (newAchievements.length > 0) {
    await supabase.from("user_achievements" as any).insert(
      newAchievements.map((achievement) => ({ user_id: userId, achievement_id: achievement.id })) as any,
    );
  }

  return getHighestAchievementsByMetric(newAchievements);
};

const safelyParseSets = (value: string): any[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};