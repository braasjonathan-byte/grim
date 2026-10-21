// Which Statistik blocks are visible, and in which order. Stored on the device.
import { useEffect, useState } from "react";

export const STATS_SECTIONS = [
  { key: "overview", label: "Översikt", hint: "Siffror och pass för vecka, månad eller år" },
  { key: "calendar", label: "Kalender", hint: "Vilka dagar du har tränat" },
  { key: "strength", label: "Styrka", hint: "SBD, personliga rekord och viktutveckling" },
  { key: "bodyWeight", label: "Kroppsvikt", hint: "Viktkurva" },
  { key: "muscles", label: "Muskler", hint: "Obalans och områden du inte rört" },
  { key: "nutrition", label: "Kosttrend", hint: "Hur kosten sett ut" },
  { key: "achievements", label: "Utmärkelser", hint: "" },
  { key: "leaderboard", label: "Topplista", hint: "" },
  { key: "quote", label: "Dagens citat", hint: "" },
] as const;

export type StatsSection = (typeof STATS_SECTIONS)[number]["key"];

/** Older builds stored these as separate cards. They now live inside one block. */
const LEGACY_GROUPS: Record<StatsSection, string[]> = {
  overview: ["summary", "periodList"],
  calendar: ["calendar"],
  strength: ["strength", "weightProgression"],
  bodyWeight: ["bodyWeight"],
  muscles: ["muscleBalance", "untrained"],
  nutrition: ["nutrition"],
  achievements: ["achievements"],
  leaderboard: ["leaderboard"],
  quote: ["quote"],
};

export const WEIGHT_RANGES = [
  { days: 30, label: "1 mån" },
  { days: 90, label: "3 mån" },
  { days: 180, label: "6 mån" },
  { days: 270, label: "9 mån" },
  { days: 365, label: "1 år" },
] as const;

const KEY = "grim_stats_settings";
const EVENT = "grim:stats-settings-changed";
const DEFAULT_ORDER = STATS_SECTIONS.map((section) => section.key);

export interface StatsLayout {
  hidden: StatsSection[];
  order: StatsSection[];
  weightDays: number;
}

const isSection = (value: string): value is StatsSection => DEFAULT_ORDER.includes(value as StatsSection);

/** A merged block stays hidden only if every card it replaced was hidden. */
export function hiddenSections(raw: unknown): StatsSection[] {
  const list = Array.isArray(raw) ? raw.map(String) : [];
  return DEFAULT_ORDER.filter((key) => list.includes(key) || LEGACY_GROUPS[key].every((legacy) => list.includes(legacy)));
}

export function normalizeOrder(raw: unknown): StatsSection[] {
  const seen = new Set<StatsSection>();
  const order: StatsSection[] = [];
  const incoming = Array.isArray(raw) ? raw.map(String) : [];
  for (const key of incoming) {
    const section = isSection(key) ? key : null;
    if (!section || seen.has(section)) continue;
    seen.add(section);
    order.push(section);
  }
  for (const key of DEFAULT_ORDER) if (!seen.has(key)) order.push(key);
  return order;
}

interface Stored { hidden?: unknown; order?: unknown; weightDays?: unknown }

const read = (): StatsLayout => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "{}") as Stored;
    const days = WEIGHT_RANGES.some((range) => range.days === stored.weightDays) ? Number(stored.weightDays) : 90;
    return { hidden: hiddenSections(stored.hidden), order: normalizeOrder(stored.order), weightDays: days };
  } catch {
    return { hidden: [], order: [...DEFAULT_ORDER], weightDays: 90 };
  }
};

const write = (layout: StatsLayout) => {
  localStorage.setItem(KEY, JSON.stringify(layout));
  window.dispatchEvent(new Event(EVENT));
};

export function useStatsSettings() {
  const [state, setState] = useState<StatsLayout>(read);
  useEffect(() => {
    const refresh = () => setState(read());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const commit = (next: StatsLayout) => write(next);

  return {
    ...state,
    isVisible: (key: StatsSection) => !state.hidden.includes(key),
    toggle: (key: StatsSection) => {
      const current = read();
      commit({
        ...current,
        hidden: current.hidden.includes(key) ? current.hidden.filter((item) => item !== key) : [...current.hidden, key],
      });
    },
    move: (key: StatsSection, direction: -1 | 1) => {
      const current = read();
      const order = [...current.order];
      const index = order.indexOf(key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= order.length) return;
      [order[index], order[next]] = [order[next], order[index]];
      commit({ ...current, order });
    },
    reset: () => commit({ hidden: [], order: [...DEFAULT_ORDER], weightDays: read().weightDays }),
    setWeightDays: (days: number) => commit({ ...read(), weightDays: days }),
  };
}
