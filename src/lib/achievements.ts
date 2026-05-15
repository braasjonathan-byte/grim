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
): AchievementMetrics => {
  let workouts = 0;
  let reps = 0;
  let kgTotal = 0;
  let distanceKm = 0;

  for (const completion of completions) {
    if (!completion.done) continue;
    workouts += 1;
    distanceKm += getWorkoutDistanceKm({
      loggedDistanceKm: completion.logged_distance_km ?? null,
      loggedWeights: completion.logged_weights ?? null,
      planDetails: completion.plan_details ?? null,
    });

    const weights = completion.logged_weights;
    if (!weights || typeof weights !== "object") continue;
    for (const [key, value] of Object.entries(weights)) {
      if (!key.startsWith("__setdata__")) continue;
      const sets = typeof value === "string" ? safelyParseSets(value) : Array.isArray(value) ? value : [];
      for (const set of sets) {
        const setReps = Number(set?.reps) || 0;
        const kg = Math.max(0, Number(set?.kg) || 0);
        reps += setReps;
        kgTotal += kg * setReps;
      }
    }
  }

  return {
    workouts,
    reps,
    tons: Math.floor(kgTotal / 1000),
    distanceKm: Math.floor(distanceKm),
    challenges: challengeCount,
  };
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