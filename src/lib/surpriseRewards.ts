import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, calculateAchievementMetrics, type AchievementMetrics } from "@/lib/achievements";
import type { WorkoutSummary } from "@/lib/workoutSummary";

export interface SurpriseReward {
  /** Small emoji shown in the card */
  emoji: string;
  /** Short headline */
  title: string;
  /** One-line, always positive, always based on real data */
  text: string;
  /** Optional progress bar 0-1 for achievement teasers */
  progress?: number;
  /** Whether this reward deserves an extra confetti burst */
  confetti?: boolean;
}

/** Real-world comparisons for lifted volume (kg). Kept honest and playful. */
const VOLUME_COMPARISONS: Array<{ kg: number; label: string; emoji: string }> = [
  { kg: 80, label: "en fullvuxen människa", emoji: "🧍" },
  { kg: 150, label: "en tvättmaskin", emoji: "🧺" },
  { kg: 300, label: "ett flygel-piano", emoji: "🎹" },
  { kg: 500, label: "en älg", emoji: "🫎" },
  { kg: 1000, label: "ett ton betong", emoji: "🧱" },
  { kg: 1500, label: "en bil", emoji: "🚗" },
  { kg: 4000, label: "en elefant", emoji: "🐘" },
  { kg: 12000, label: "en stadsbuss", emoji: "🚌" },
  { kg: 30000, label: "en stridsvagn", emoji: "🛡️" },
  { kg: 150000, label: "en blåval", emoji: "🐋" },
];

const pick = <T,>(arr: T[]): T | null => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

const fmt = (n: number) => Math.round(n).toLocaleString("sv-SE");

interface RewardContext {
  metrics: AchievementMetrics;
  unlockedIds: Set<string>;
  monthVolumeKg: number;
  monthWorkouts: number;
  monthDistanceKm: number;
  avgSessionVolumeKg: number;
  totalWorkouts: number;
  summary: WorkoutSummary | null;
}

function buildCandidates(ctx: RewardContext): SurpriseReward[] {
  const out: SurpriseReward[] = [];
  const { summary } = ctx;

  // 1. Månadens volym jämfört med något i verkligheten
  if (ctx.monthVolumeKg >= 80) {
    const matches = VOLUME_COMPARISONS.filter((c) => ctx.monthVolumeKg >= c.kg);
    const c = matches[matches.length - 1];
    const times = ctx.monthVolumeKg / c.kg;
    out.push({
      emoji: c.emoji,
      title: "Visste du det här?",
      text:
        times >= 2
          ? `Du har lyft ${fmt(ctx.monthVolumeKg)} kg den här månaden – motsvarande ${times.toFixed(1).replace(".", ",")} gånger ${c.label} ${c.emoji}`
          : `Du har lyft ${fmt(ctx.monthVolumeKg)} kg den här månaden – motsvarande ${c.label} ${c.emoji}`,
    });
  }

  // 2. Nästa achievement som är nära
  const nextClose = ACHIEVEMENTS.map((a) => {
    if (ctx.unlockedIds.has(a.id)) return null;
    const value = Number(ctx.metrics[a.metric] ?? 0);
    if (!isFinite(value) || value <= 0) return null;
    const progress = value / a.threshold;
    if (progress < 0.55 || progress >= 1) return null;
    return { a, value, progress };
  }).filter(Boolean) as Array<{ a: (typeof ACHIEVEMENTS)[number]; value: number; progress: number }>;
  const near = nextClose.sort((x, y) => y.progress - x.progress)[0];
  if (near) {
    out.push({
      emoji: near.a.emoji,
      title: "Du är närmare än du tror",
      text: `${near.a.title} – ${Math.round(near.progress * 100)} % klart. Bara ${fmt(near.a.threshold - near.value)} kvar!`,
      progress: near.progress,
    });
  }

  // 3. Tyngre pass än vanligt
  if (summary?.volumeKg && ctx.avgSessionVolumeKg > 0 && summary.volumeKg > ctx.avgSessionVolumeKg * 1.15) {
    const pct = Math.round((summary.volumeKg / ctx.avgSessionVolumeKg - 1) * 100);
    out.push({
      emoji: "📈",
      title: "Extra tungt idag",
      text: `Det här passet var ${pct} % tyngre än ditt snittpass. Snyggt jobbat!`,
      confetti: true,
    });
  }

  // 4. Streak
  if (ctx.metrics.currentStreak >= 3) {
    out.push({
      emoji: "⚡",
      title: "Streak igång",
      text: `${ctx.metrics.currentStreak} träningsdagar i rad – konsekvensen är det som bygger resultat.`,
      confetti: ctx.metrics.currentStreak >= 7,
    });
  }

  // 5. Antal pass totalt
  if (ctx.totalWorkouts >= 5) {
    out.push({
      emoji: "🏅",
      title: "Pass i loggboken",
      text: `Det här var ditt ${fmt(ctx.totalWorkouts)}:e loggade pass. Du har byggt en riktig vana.`,
      confetti: ctx.totalWorkouts % 25 === 0,
    });
  }

  // 6. Månadens pass
  if (ctx.monthWorkouts >= 3) {
    out.push({
      emoji: "🗓️",
      title: "Månaden hittills",
      text: `${ctx.monthWorkouts} pass klara den här månaden. Det är fler än de flesta hinner med.`,
    });
  }

  // 7. Distans
  if (ctx.monthDistanceKm >= 5) {
    const laps = ctx.monthDistanceKm / 0.4;
    out.push({
      emoji: "👟",
      title: "Kilometer i benen",
      text: `${ctx.monthDistanceKm.toFixed(1).replace(".", ",")} km den här månaden – ${Math.round(laps)} varv runt en löparbana.`,
    });
  }

  // 8. Totala reps
  if (ctx.metrics.reps >= 500) {
    out.push({
      emoji: "🔁",
      title: "Repräknaren",
      text: `Du har loggat ${fmt(ctx.metrics.reps)} reps totalt. Varje enskild räknades.`,
    });
  }

  // 9. Total volym i ton
  if (ctx.metrics.tons >= 1) {
    out.push({
      emoji: "🏋️",
      title: "Totalt lyft",
      text: `Sammanlagt har du flyttat ${ctx.metrics.tons.toFixed(1).replace(".", ",")} ton järn sedan du började.`,
    });
  }

  // 10. Många set i dagens pass
  if (summary && summary.sets >= 12) {
    out.push({
      emoji: "💪",
      title: "Rejält volympass",
      text: `${summary.sets} set på ett och samma pass – det är ordentligt jobbat.`,
      confetti: true,
    });
  }

  return out;
}

/**
 * Sometimes (not always) returns a small, genuine surprise reward based on the
 * user's real training data. Never fake urgency, never invented offers.
 */
export async function buildSurpriseReward(
  userId: string,
  summary: WorkoutSummary | null,
  chance = 0.6,
): Promise<SurpriseReward | null> {
  if (!userId) return null;
  if (Math.random() > chance) return null;

  try {
    const [completionsRes, achievementsRes, challengesRes] = await Promise.all([
      supabase
        .from("workout_completions")
        .select("done, updated_at, logged_weights, logged_distance_km")
        .eq("user_id", userId)
        .eq("done", true),
      supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
      supabase.from("daily_challenge_completions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    const completions = (completionsRes.data || []) as any[];
    if (completions.length === 0) return null;

    const metrics = calculateAchievementMetrics(completions, challengesRes.count || 0);
    const unlockedIds = new Set((achievementsRes.data || []).map((a: any) => a.achievement_id));

    const now = new Date();
    const monthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthRows = completions.filter((c) => typeof c.updated_at === "string" && c.updated_at.startsWith(monthPrefix));
    const monthMetrics = calculateAchievementMetrics(monthRows, 0);

    const totalVolumeKg = metrics.tons * 1000;
    const avgSessionVolumeKg = completions.length ? totalVolumeKg / completions.length : 0;

    const candidates = buildCandidates({
      metrics,
      unlockedIds,
      monthVolumeKg: monthMetrics.tons * 1000,
      monthWorkouts: monthMetrics.workouts,
      monthDistanceKm: monthMetrics.distanceKm,
      avgSessionVolumeKg,
      totalWorkouts: metrics.workouts,
      summary,
    });

    return pick(candidates);
  } catch {
    return null;
  }
}
