import { supabase } from "@/integrations/supabase/client";
import { isCompletedWorkout } from "@/lib/completionCounting";
import { checkedSetsFor, setVolumeKg } from "@/lib/checkedSets";
import { parseExerciseWeight } from "@/lib/workoutSetData";
import { getPlanDayDateValue, toUtcDateKey } from "@/lib/workoutDayUtils";

/**
 * Unified list of every completed workout — active plan, single workouts and
 * archived plans — so history can be viewed, edited and deleted in one place.
 */
export type SessionSource =
  | { kind: "active"; planIds: string[] }
  | { kind: "archive"; archiveId: string; index: number; archivedAt: string };

export interface HistoryExercise {
  name: string;
  sets: Array<{ kg: string; reps: string }>;
  info: string | null;
}

export interface HistorySession {
  id: string;
  source: SessionSource;
  week: number;
  day: string;
  date: string | null;
  name: string;
  details: string;
  completion: Record<string, any>;
  exercises: HistoryExercise[];
  setCount: number;
  volume: number;
  distanceKm: number | null;
  tempo: string | null;
  pulse: number | null;
}

export const WORKOUTS_CHANGED_EVENT = "grim:workouts-changed";
export const notifyWorkoutsChanged = (userId?: string) => {
  try { window.dispatchEvent(new CustomEvent(WORKOUTS_CHANGED_EVENT)); } catch { /* non-browser */ }
  // Achievements/titles are recomputed from the remaining data (and relocked if no longer earned).
  if (userId) import("@/lib/achievementSync").then((m) => m.syncAchievements(userId)).catch(() => null);
};

const resolveDate = (week: number, day: string, planStart: string | null, updatedAt?: string | null): string | null => {
  if (week === 0 && /^\d{4}-\d{2}-\d{2}/.test(day)) return day.substring(0, 10);
  if (week > 0 && planStart) {
    const d = getPlanDayDateValue(planStart, week, day.replace(/_[a-z0-9]+$/i, ""));
    if (d) return toUtcDateKey(d);
  }
  return updatedAt ? String(updatedAt).substring(0, 10) : null;
};

const buildExercises = (details: string, lw: Record<string, any>): HistoryExercise[] => {
  const out: HistoryExercise[] = [];
  const seen = new Set<string>();
  for (const line of details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)) {
    if (/^(vila|vilodag)/i.test(line) || line.startsWith("⚔️")) continue;
    const { name, weight } = parseExerciseWeight(line);
    if (!name) continue;
    seen.add(name);
    const sets = checkedSetsFor(lw, name);
    out.push({ name, sets, info: sets.length ? null : weight });
  }
  // Exercises that only exist in logged data (e.g. renamed lines)
  for (const key of Object.keys(lw)) {
    if (!key.startsWith("__setdata__")) continue;
    const name = key.slice("__setdata__".length);
    if (seen.has(name)) continue;
    const sets = checkedSetsFor(lw, name);
    if (sets.length) out.push({ name, sets, info: null });
  }
  return out;
};

const toSession = (id: string, source: SessionSource, c: any, plans: any[], planStart: string | null): HistorySession => {
  const lw = (c.logged_weights && typeof c.logged_weights === "object") ? c.logged_weights : {};
  const details = plans.map((p) => p.details || "").filter(Boolean).join("\n");
  const exercises = buildExercises(details, lw);
  let setCount = 0;
  let volume = 0;
  for (const e of exercises) for (const s of e.sets) {
    setCount++;
    volume += setVolumeKg(s);
  }
  return {
    id, source, week: c.week || 0, day: c.day || "",
    date: resolveDate(c.week || 0, c.day || "", planStart, c.updated_at),
    name: plans.map((p) => p.session_name).filter(Boolean).join(" + ") || "Pass",
    details, completion: c, exercises, setCount, volume,
    distanceKm: c.logged_distance_km != null ? Number(c.logged_distance_km) : null,
    tempo: c.logged_tempo || null,
    pulse: c.logged_pulse ?? null,
  };
};

export async function loadWorkoutHistory(userId: string): Promise<HistorySession[]> {
  const [{ data: comps }, { data: plans }, { data: profile }, { data: archives }] = await Promise.all([
    supabase.from("workout_completions").select("*").eq("user_id", userId),
    supabase.from("workout_plans").select("id, week, day, session_name, details").eq("user_id", userId),
    supabase.from("profiles").select("plan_start_date").eq("user_id", userId).maybeSingle(),
    supabase.from("archived_plans").select("id, plan_start_date, plan_data, completion_data, archived_at").eq("user_id", userId),
  ]);
  const out: HistorySession[] = [];
  const planStart = (profile as any)?.plan_start_date || null;
  for (const c of (comps || []) as any[]) {
    if (!isCompletedWorkout(c)) continue;
    const ps = (plans || []).filter((p: any) => p.week === c.week && p.day === c.day);
    out.push(toSession(`a-${c.id}`, { kind: "active", planIds: ps.map((p: any) => p.id) }, c, ps, planStart));
  }
  for (const a of (archives || []) as any[]) {
    const cd: any[] = Array.isArray(a.completion_data) ? a.completion_data : [];
    const pd: any[] = Array.isArray(a.plan_data) ? a.plan_data : [];
    cd.forEach((c, index) => {
      if (!c || !isCompletedWorkout(c)) return;
      const ps = pd.filter((p) => p.week === c.week && p.day === c.day);
      out.push(toSession(`r-${a.id}-${index}`, { kind: "archive", archiveId: a.id, index, archivedAt: a.archived_at }, c, ps, a.plan_start_date || null));
    });
  }
  return out.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
}

const removeSocialPost = async (userId: string, s: HistorySession) => {
  let q = supabase.from("social_posts").delete().eq("user_id", userId).eq("workout_week", s.week).eq("workout_day", s.day);
  if (s.source.kind === "archive") q = q.lte("created_at", s.source.archivedAt);
  await q;
};

/** Writes edited set data (and optional new date for single workouts). */
export async function saveSessionEdit(
  userId: string,
  s: HistorySession,
  edited: Array<{ name: string; sets: Array<{ kg: string; reps: string }> }>,
  newDate: string | null,
) {
  const lw: Record<string, any> = { ...(s.completion.logged_weights || {}) };
  for (const e of edited) {
    lw[`__setdata__${e.name}`] = JSON.stringify(e.sets.map((x) => ({ kg: x.kg.trim().replace(",", "."), reps: x.reps.trim() })));
    lw[`__sets__${e.name}`] = "1".repeat(e.sets.length);
  }
  if (s.source.kind === "active") {
    let day = s.day;
    if (newDate && s.week === 0 && newDate !== s.date) {
      const suffix = s.day.slice(10);
      day = `${newDate}${suffix}`;
      for (const id of s.source.planIds) await supabase.from("workout_plans").update({ day }).eq("id", id);
      await supabase.from("social_posts").update({ workout_day: day }).eq("user_id", userId).eq("workout_week", 0).eq("workout_day", s.day);
    }
    const { error } = await supabase.from("workout_completions").update({ logged_weights: lw, day } as any).eq("id", s.completion.id);
    if (error) throw error;
    // Refresh the feed caption from the new data
    const { previewWorkoutCaption } = await import("@/lib/workoutAutoShare");
    const caption = await previewWorkoutCaption(userId, s.week, day);
    if (caption) await supabase.from("social_posts").update({ caption }).eq("user_id", userId).eq("workout_week", s.week).eq("workout_day", day);
  } else {
    const { data: row, error: e1 } = await supabase.from("archived_plans").select("completion_data").eq("id", s.source.archiveId).single();
    if (e1 || !row) throw e1 || new Error("missing");
    const cd = [...((row as any).completion_data || [])];
    cd[s.source.index] = { ...cd[s.source.index], logged_weights: lw };
    const { error } = await supabase.from("archived_plans").update({ completion_data: cd } as any).eq("id", s.source.archiveId);
    if (error) throw error;
  }
  notifyWorkoutsChanged(userId);
}

/** Deletes the workout and its feed post; returns an undo function. */
export async function deleteSession(userId: string, s: HistorySession): Promise<() => Promise<void>> {
  const { data: posts } = await supabase.from("social_posts").select("*").eq("user_id", userId).eq("workout_week", s.week).eq("workout_day", s.day);
  if (s.source.kind === "active") {
    const { data: planRows } = await supabase.from("workout_plans").select("*").in("id", s.source.planIds.length ? s.source.planIds : ["00000000-0000-0000-0000-000000000000"]);
    const { error } = await supabase.from("workout_completions").delete().eq("id", s.completion.id);
    if (error) throw error;
    // Single workouts disappear entirely; plan days stay in the plan as not done.
    if (s.week === 0) for (const id of s.source.planIds) await supabase.from("workout_plans").delete().eq("id", id);
    await removeSocialPost(userId, s);
    notifyWorkoutsChanged(userId);
    return async () => {
      if (s.week === 0 && planRows?.length) await supabase.from("workout_plans").insert(planRows as any);
      await supabase.from("workout_completions").insert(s.completion as any);
      if (posts?.length) await supabase.from("social_posts").insert(posts as any);
      notifyWorkoutsChanged(userId);
    };
  }
  const src = s.source;
  const { data: row } = await supabase.from("archived_plans").select("completion_data").eq("id", src.archiveId).single();
  const original = [...(((row as any)?.completion_data) || [])];
  const next = original.filter((_, i) => i !== src.index);
  const { error } = await supabase.from("archived_plans").update({ completion_data: next } as any).eq("id", src.archiveId);
  if (error) throw error;
  await removeSocialPost(userId, s);
  notifyWorkoutsChanged(userId);
  return async () => {
    await supabase.from("archived_plans").update({ completion_data: original } as any).eq("id", src.archiveId);
    if (posts?.length) await supabase.from("social_posts").insert(posts as any);
    notifyWorkoutsChanged(userId);
  };
}
