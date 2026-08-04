import { format, getISOWeek } from "date-fns";
import { Bike, Dumbbell, Footprints, Moon, Waves } from "lucide-react";
import type { PlanDay } from "@/components/workout/types";

export const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];
export const SWEDISH_MONTHS_SHORT = ["jan.", "feb.", "mars", "apr.", "maj", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."];
export const MS_PER_DAY = 86400000;

export const parseDateKey = (value: string | null | undefined): Date | null => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
};

export const toUtcDateKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

export const toSafeLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const addUtcDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

export const formatUtcDate = (date: Date) =>
  `${date.getUTCDate()} ${SWEDISH_MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

export const getTodayInfo = () => {
  const now = new Date();
  const dateKey = toSafeLocalDateKey(now);
  const date = parseDateKey(dateKey) ?? new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return {
    date,
    dateKey,
    dayName: DAYS[(date.getUTCDay() + 6) % 7],
    isoWeek: getISOWeek(date),
  };
};

export const getSessionIcon = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return Dumbbell;
  if (s.includes("simning")) return Waves;
  if (s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel")) return Footprints;
  if (s.includes("cykel") || s.includes("cykling") || s.includes("återhämtning") || s.includes("crosstrainer")) return Bike;
  return Moon;
};

export const getSessionColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return "text-primary";
  if (s.includes("simning")) return "text-primary";
  if (s.includes("cykel") || s.includes("cykling")) return "text-primary";
  if (s.includes("löpning") || s.includes("tröskel")) return "text-warning";
  if (s.includes("långpass")) return "text-destructive";
  if (s.includes("vila")) return "text-muted-foreground";
  return "text-secondary-foreground";
};

/** True när passet innehåller minst en riktig övning (bortsett från vila/utmaningar). */
export const planHasAnyExercise = (plan: { details?: string | null }) =>
  (plan.details || "")
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .some((l) => !l.startsWith("⚔️") && !/^(vila|vilodag)/i.test(l));

/** Föreslår ett passnamn utifrån övningarna i dagens pass. */
export const suggestSessionName = (details: string): string => {
  const names = (details || "")
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter((l) => l && !l.startsWith("⚔️") && !/^(vila|vilodag)/i.test(l))
    .map((l) => l.split(/\s+[—–]\s+|\s+\d/)[0].trim())
    .filter(Boolean);
  if (names.length === 0) return "Pass";
  const uniq = Array.from(new Set(names));
  if (uniq.length === 1) return uniq[0];
  if (uniq.length === 2) return `${uniq[0]} & ${uniq[1]}`;
  const joined = uniq.join(" ").toLowerCase();
  const cardio = /löpning|cykl|simning|rodd|promenad|crosstrainer|airbike|hopprep|stair|skid/.test(joined);
  const strength = /press|böj|squat|mark|curl|rodd\s|drag|lyft|dips|chins/.test(joined);
  if (cardio && !strength) return "Konditionspass";
  if (strength && !cardio) return "Styrkepass";
  return `${uniq[0]} + ${uniq.length - 1} till`;
};



// Format a day key for display - if it looks like an ISO date, format it nicely
export const formatDayDisplay = (day: string) => {
  const date = parseDateKey(day);
  if (date) return formatUtcDate(date);
  // Strip any suffix like _abc1 or _1771393847859
  return day.replace(/_[a-z0-9]+$/i, "");
};

export const getBaseDay = (day: string) => day.replace(/_[a-z0-9]+$/i, "");

export const getDayIndex = (day: string) => {
  const baseDay = getBaseDay(day).trim();
  if (baseDay === "Tor") return 3;
  return DAYS.indexOf(baseDay);
};

export const sameWorkoutDay = (a: string, b: string) => {
  const aIndex = getDayIndex(a);
  const bIndex = getDayIndex(b);
  return aIndex >= 0 && bIndex >= 0 ? aIndex === bIndex : getBaseDay(a) === getBaseDay(b);
};

export const normalizeExerciseKey = (name: string) =>
  name
    .trim()
    .replace(/\s*—\s*.*$/u, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

export const isAssistedBodyweightExercise = (name: string) => /assisterad|assisted/i.test(name) && /pull\s*-?\s*ups?|pullups?|chins?|dips/i.test(name);

export const isDailyChallengeLabel = (label: string) => label.trim().startsWith("⚔️") || /utmaning:/i.test(label);

export const sanitizeCopiedLoggedWeights = (loggedWeights: Record<string, any> | null | undefined) => {
  if (!loggedWeights) return null;

  const cleanedWeights: Record<string, any> = {};
  const copiedExerciseNames: string[] = [];

  for (const [key, value] of Object.entries(loggedWeights)) {
    if (
      key.startsWith("__sets__") ||
        key.startsWith("__cond_done__") ||
      key.startsWith("__wod_rounds_done_") ||
      key.startsWith("__timer_started_") ||
      key.startsWith("__timer_elapsed_") ||
      key.startsWith("__copied_ex__")
    ) {
      continue;
    }

    if (key.startsWith("__setdata__")) {
      const exName = key.substring("__setdata__".length);
      if (isDailyChallengeLabel(exName)) continue;
      if (exName) copiedExerciseNames.push(exName);
    }

    if (isDailyChallengeLabel(key)) continue;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const { checked, done, completed, ...rest } = value as Record<string, any>;
      cleanedWeights[key] = rest;
      continue;
    }

    cleanedWeights[key] = value;
  }

  // Mark each copied exercise so UI can show a progression-reminder note
  for (const exName of copiedExerciseNames) {
    cleanedWeights[`__copied_ex__${exName}`] = "1";
  }

  return Object.keys(cleanedWeights).length > 0 ? cleanedWeights : null;
};

export const WEEKDAY_NAMES_SV = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

// Extract date from a single workout day key and return weekday name
export const DAY_ABBR_TO_FULL_SV: Record<string, string> = {
  "Mån": "Måndag", "Tis": "Tisdag", "Ons": "Onsdag",
  "Tors": "Torsdag", "Tor": "Torsdag",
  "Fre": "Fredag", "Lör": "Lördag", "Sön": "Söndag",
};

export const getWeekdayFromDayKey = (day: string): string | null => {
  const date = parseDateKey(day);
  if (date) return WEEKDAY_NAMES_SV[date.getUTCDay()];
  const base = day.replace(/_[a-z0-9]+$/i, "").trim();
  return DAY_ABBR_TO_FULL_SV[base] || null;
};

// Compute virtual week number for a single workout based on the earliest workout's Monday
export const computeSingleWeek = (dayKey: string, firstMonday: Date): number => {
  const date = parseDateKey(dayKey);
  if (!date) return 1;
  const monday = getMonday(date);
  const diffDays = Math.floor((monday.getTime() - firstMonday.getTime()) / MS_PER_DAY);
  return Math.floor(diffDays / 7) + 1;
};

export const getMonday = (d: Date) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  return addUtcDays(date, -day + 1);
};

export const toLocalDateKey = toSafeLocalDateKey;

export const calendarDayNumber = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY;

export const daysBetweenCalendarDates = (from: Date, to: Date) =>
  calendarDayNumber(to) - calendarDayNumber(from);

export const getPlanDayDateValue = (planStart: string | null, week: number, dayAbbr: string): Date | null => {
  if (!planStart || week <= 0) return null;

  const startDate = parseDateKey(planStart);
  if (!startDate) return null;
  const startMonday = getMonday(startDate);
  const dayIndex = getDayIndex(dayAbbr);
  if (dayIndex < 0) return null;

  return addUtcDays(startMonday, (week - 1) * 7 + dayIndex);
};

export const resolveTodayDayIndex = (weekPlans: PlanDay[], currentWeek: number, planStart: string | null) => {
  if (weekPlans.length === 0) {
    return { index: 0, matchedToday: false };
  }

  const today = getTodayInfo();

  if (planStart && currentWeek > 0) {
    const dateMatchedIndex = weekPlans.findIndex((plan) => {
      const planDate = getPlanDayDateValue(planStart, currentWeek, plan.day);
      return planDate?.getTime() === today.date.getTime();
    });

    if (dateMatchedIndex >= 0) {
      return { index: dateMatchedIndex, matchedToday: true };
    }
  }

  const todayIndex = getDayIndex(today.dayName);
  const labelMatchedIndex = weekPlans.findIndex((plan) => getDayIndex(plan.day.trim()) === todayIndex);

  if (labelMatchedIndex >= 0) {
    return { index: labelMatchedIndex, matchedToday: !planStart };
  }

  return { index: 0, matchedToday: false };
};
