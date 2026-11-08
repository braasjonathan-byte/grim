import { DAYS, getBaseDay, parseDateKey, sameWorkoutDay } from "@/lib/workoutDayUtils";

type Slot = { week: number; day: string };

/** Keep persisted week/day identities intact: the date-keyed fallback is only
 * grouped into today's displayed program day, never moved to an older date.
 */
export function getWorkoutDisplayDay(slot: Slot): string {
  const date = slot.week === 0 ? parseDateKey(slot.day) : null;
  return date ? DAYS[(date.getUTCDay() + 6) % 7] : getBaseDay(slot.day);
}

export function getProgramWeekPlans<T extends Slot>(plans: T[], week: number, activeWeek: number, todayKey: string): T[] {
  return plans.filter((p) => p.week === week || (
    p.week === 0 && week === activeWeek && p.day.startsWith(`${todayKey}_hc`)
  ));
}

export function isWorkoutDayDone(
  plans: Slot[], completions: Record<string, { done?: boolean }>, day: string,
): boolean {
  return plans.some((p) => sameWorkoutDay(getWorkoutDisplayDay(p), day) && completions[`${p.week}-${p.day}`]?.done);
}
