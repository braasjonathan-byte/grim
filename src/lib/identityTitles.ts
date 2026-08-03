import { supabase } from "@/integrations/supabase/client";

export interface IdentityTitle {
  id: string;
  label: string;
  emoji: string;
  /** Short description of how it's unlocked */
  requirement: string;
  unlocked: boolean;
  /** 0-1 progress toward unlocking */
  progress: number;
}

export interface IdentityStats {
  workouts: number;
  streak: number;
  strengthSets: number;
  monthWorkouts: number;
  totalTons: number;
  distanceKm: number;
  sportSets: Record<string, number>;
  morningRatio: number;
  eveningRatio: number;
}

const SPORT_KEYWORDS: Record<string, string[]> = {
  simning: ["sim", "swim", "crawl", "bröstsim", "ryggsim"],
  löpning: ["löp", "spring", "run", "jogg", "intervall"],
  cykling: ["cykel", "cykl", "bike", "spinning"],
  styrka: [],
  yoga: ["yoga", "mobility", "rörlighet", "stretch"],
  rodd: ["rodd", "row"],
  vandring: ["vandr", "promenad", "walk", "hike"],
  boxning: ["box", "kick", "mma", "kampsport"],
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const detectSport = (name: string): string | null => {
  const n = name.toLowerCase();
  for (const [sport, keys] of Object.entries(SPORT_KEYWORDS)) {
    if (keys.some((k) => n.includes(k))) return sport;
  }
  return null;
};

const sportLabel: Record<string, { label: string; emoji: string }> = {
  simning: { label: "Simmare", emoji: "🏊" },
  löpning: { label: "Löpare", emoji: "🏃" },
  cykling: { label: "Cyklist", emoji: "🚴" },
  yoga: { label: "Rörlighetsnörd", emoji: "🧘" },
  rodd: { label: "Roddare", emoji: "🚣" },
  vandring: { label: "Vandrare", emoji: "🥾" },
  boxning: { label: "Fighter", emoji: "🥊" },
};

function computeStats(rows: any[]): IdentityStats {
  const dateSet = new Set<string>();
  let strengthSets = 0;
  let totalKg = 0;
  let distanceKm = 0;
  let morning = 0;
  let evening = 0;
  const sportSets: Record<string, number> = {};
  const now = new Date();
  const monthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let monthWorkouts = 0;

  for (const row of rows) {
    if (!row?.done) continue;
    const ts: string | null = typeof row.updated_at === "string" ? row.updated_at : null;
    if (ts) {
      dateSet.add(ts.slice(0, 10));
      if (ts.startsWith(monthPrefix)) monthWorkouts += 1;
      const hour = new Date(ts).getHours();
      if (hour < 10) morning += 1;
      else if (hour >= 18) evening += 1;
    }
    distanceKm += Number(row.logged_distance_km) || 0;

    const lw = row.logged_weights;
    if (!lw || typeof lw !== "object") continue;
    for (const [key, value] of Object.entries(lw as Record<string, unknown>)) {
      if (!key.startsWith("__setdata__")) continue;
      const name = key.substring("__setdata__".length);
      let sets: Array<{ kg?: string | number; reps?: string | number }> = [];
      if (typeof value === "string") {
        try { sets = JSON.parse(value); } catch { continue; }
      } else if (Array.isArray(value)) sets = value as typeof sets;
      if (!Array.isArray(sets)) continue;
      const sport = detectSport(name);
      for (const s of sets) {
        const kg = Number(s?.kg) || 0;
        const reps = Number(s?.reps) || 0;
        if (kg <= 0 && reps <= 0) continue;
        if (sport) sportSets[sport] = (sportSets[sport] || 0) + 1;
        else {
          strengthSets += 1;
          totalKg += kg * reps;
        }
      }
    }
  }

  // Current streak of consecutive days with a completed workout
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 400; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (dateSet.has(key)) streak += 1;
    else if (i > 0 || !dateSet.has(key)) {
      if (i === 0) { cursor.setDate(cursor.getDate() - 1); continue; }
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  const workouts = rows.filter((r) => r?.done).length;
  return {
    workouts,
    streak,
    strengthSets,
    monthWorkouts,
    totalTons: totalKg / 1000,
    distanceKm,
    sportSets,
    morningRatio: workouts ? morning / workouts : 0,
    eveningRatio: workouts ? evening / workouts : 0,
  };
}

export function buildTitles(stats: IdentityStats): IdentityTitle[] {
  const titles: IdentityTitle[] = [];
  const add = (id: string, label: string, emoji: string, requirement: string, progress: number) =>
    titles.push({ id, label, emoji, requirement, unlocked: progress >= 1, progress: clamp01(progress) });

  add("igang", "Igång", "🌱", "Slutför ditt första pass", stats.workouts / 1);
  add("vanebyggare", "Vanebyggare", "🧱", "Slutför 20 pass", stats.workouts / 20);
  add("veteran", "Veteran", "🎖️", "Slutför 100 pass", stats.workouts / 100);
  add("streak-mastare", "Streak-mästare", "⚡", "Träna 7 dagar i rad", stats.streak / 7);
  add("manadens-streak", "Månadens streak-mästare", "🔥", "Träna 30 dagar i rad", stats.streak / 30);
  add("styrkefokuserad", "Styrkefokuserad", "🏋️", "Logga 150 styrkeset", stats.strengthSets / 150);
  add("jarnflyttare", "Järnflyttare", "💥", "Lyft 50 ton totalt", stats.totalTons / 50);
  add("uthallig", "Uthållig", "🛣️", "Logga 100 km distans", stats.distanceKm / 100);
  add("morgonmanniska", "Morgonmänniska", "🌅", "Träna mest på morgnarna (10+ pass)", stats.workouts >= 10 ? stats.morningRatio / 0.5 : 0);
  add("kvallstranare", "Kvällstränare", "🌙", "Träna mest på kvällarna (10+ pass)", stats.workouts >= 10 ? stats.eveningRatio / 0.5 : 0);
  add("manadens-maskin", "Månadens maskin", "📅", "Slutför 15 pass denna månad", stats.monthWorkouts / 15);

  for (const [sport, meta] of Object.entries(sportLabel)) {
    const sets = stats.sportSets[sport] || 0;
    add(`sport-${sport}`, meta.label, meta.emoji, `Logga 20 ${sport}spass-set`, sets / 20);
  }

  return titles.sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress - a.progress);
}

export function findTitle(titles: IdentityTitle[], id: string | null | undefined) {
  if (!id) return null;
  return titles.find((t) => t.id === id) || null;
}

/** Fetch a user's behaviour data and derive their identity titles. */
export async function loadIdentityTitles(userId: string): Promise<{ titles: IdentityTitle[]; stats: IdentityStats }> {
  const { data } = await supabase
    .from("workout_completions")
    .select("done, updated_at, logged_weights, logged_distance_km")
    .eq("user_id", userId)
    .eq("done", true);
  const stats = computeStats((data || []) as any[]);
  return { titles: buildTitles(stats), stats };
}
