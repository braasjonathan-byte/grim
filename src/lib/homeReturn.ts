import type { HistorySession } from "@/lib/workoutHistory";
import { getPlanDayDateValue, planHasAnyExercise, toUtcDateKey, parseDateKey } from "@/lib/workoutDayUtils";
import { trainingInsights } from "@/lib/trainingInsights";

type Plan = { week: number; day: string; details: string | null; session_name?: string | null };
type Completion = { week: number; day: string; done?: boolean | null; skipped?: boolean | null };

/** Preserve exact workout identities; never recommend a completed or skipped slot. */
export function nextPlannedWorkout(plans: Plan[], completions: Completion[], planStart: string | null, today: string) {
  return plans.flatMap(plan => {
    if (!planHasAnyExercise(plan)) return [];
    if (completions.some(c => c.week === plan.week && c.day === plan.day && (c.done || c.skipped))) return [];
    const date = plan.week === 0 ? parseDateKey(plan.day) : getPlanDayDateValue(planStart, plan.week, plan.day);
    if (!date) return [];
    const key = toUtcDateKey(date);
    return key >= today ? [{ ...plan, date: key }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.day.localeCompare(b.day))[0] ?? null;
}

/** Seven UTC dates ending today, compared with the preceding seven dates. */
export function homeReturnSummary(sessions: HistorySession[], today: string) {
  const offset = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const from = offset(6), previousFrom = offset(13), previousTo = offset(7);
  const unique = [...new Map(sessions.map(s => [s.id, s])).values()];
  const recent = unique.filter(s => s.date && s.date >= from && s.date <= today);
  const previous = unique.filter(s => s.date && s.date >= previousFrom && s.date <= previousTo);
  const evidence = unique.filter(s => s.date && s.date >= offset(89) && s.date <= today);
  // A comparison belongs here only when its newest measurement is in this period.
  const insights = trainingInsights(evidence).filter(s => (s.kind === "strength" || s.kind === "cardio") && s.measuredDate && s.measuredDate >= from && s.measuredDate <= today);
  return { from, to: today, sessions: recent.length, days: new Set(recent.map(s => s.date)).size, previousSessions: previous.length, insight: insights[0] ?? null };
}