import type { HealthDay } from "@/lib/healthSync";

export type RestingHrSignal = {
  today: number;
  avg7: number | null;
  delta: number | null;
  /** true när vilopulsen ligger minst 5 slag över 7-dagarssnittet. */
  elevated: boolean;
};

/** Minsta antal tidigare dagar med vilopuls innan vi jämför mot snitt. */
export const RESTING_HR_MIN_BASELINE_DAYS = 3;
export const RESTING_HR_ELEVATED_BPM = 5;

/** Jämför dagens vilopuls med snittet av de 7 föregående dagarna (dagens värde exkluderas). */
export function restingHrSignal(days: HealthDay[], todayKey: string): RestingHrSignal | null {
  const valid = days.filter((d) => typeof d.restingHeartRate === "number" && (d.restingHeartRate as number) > 0);
  const todayRow = valid.find((d) => d.day === todayKey);
  if (!todayRow) return null;
  const today = Math.round(todayRow.restingHeartRate as number);
  const prior = valid.filter((d) => d.day < todayKey).slice(-7).map((d) => d.restingHeartRate as number);
  if (prior.length < RESTING_HR_MIN_BASELINE_DAYS) return { today, avg7: null, delta: null, elevated: false };
  const avg7 = Math.round((prior.reduce((a, b) => a + b, 0) / prior.length) * 10) / 10;
  const delta = Math.round(today - avg7);
  return { today, avg7, delta, elevated: delta >= RESTING_HR_ELEVATED_BPM };
}
