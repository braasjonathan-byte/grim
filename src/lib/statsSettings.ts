// Visibility of Statistik sections + body-weight chart horizon. Stored in localStorage.
import { useEffect, useState } from "react";

export const STATS_SECTIONS = [
  { key: "nutrition", label: "Kosttrend" },
  { key: "summary", label: "Sammanfattning & utmaningar" },
  { key: "muscleBalance", label: "Muskelbalans-varning" },
  { key: "quote", label: "Dagens citat" },
  { key: "achievements", label: "Utmärkelser" },
  { key: "periodList", label: "Pass per vecka/månad/år" },
  { key: "untrained", label: "Otränade muskler" },
  { key: "leaderboard", label: "Topplista" },
  { key: "strength", label: "Styrka & personliga rekord" },
  { key: "calendar", label: "Träningskalender" },
  { key: "bodyWeight", label: "Viktkurva" },
  { key: "weightProgression", label: "Viktprogression per övning" },
  { key: "goalWeight", label: "Mot målvikten" },
  { key: "calorieIntake", label: "Intagna kalorier" },
] as const;
export type StatsSection = (typeof STATS_SECTIONS)[number]["key"];

// days: 0 = alla vägningar (ingen nedre datumgräns).
export const WEIGHT_RANGES = [
  { days: 0, label: "Alla vägningar" },
  { days: 30, label: "Senaste månaden" },
  { days: 180, label: "Senaste halvåret" },
  { days: 365, label: "Senaste året" },
] as const;
export const DEFAULT_WEIGHT_DAYS = 30;
/** Startdatum (YYYY-MM-DD) för ett intervall, eller null för alla vägningar. */
export const weightRangeFrom = (days: number, end: Date = new Date()): string | null => {
  if (!days) return null;
  const d = new Date(end); d.setDate(d.getDate() - (days - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Nybörjarstandard (vanebyggare). Synligt: sammanfattning (pass + km per gren), citat,
// topplista, träningskalender, målvikt, intagna kalorier.
// Viktkurvan är dold tills användaren vägt sig mer än en gång (se autoShowBodyWeight).
export const DEFAULT_HIDDEN: StatsSection[] = [
  "nutrition", "weightProgression", "muscleBalance", "untrained",
  "achievements", "periodList", "strength", "bodyWeight",
];

const KEY = "grim_stats_settings";
const EVENT = "grim:stats-settings-changed";
interface State { hidden: StatsSection[]; weightDays: number; touched?: StatsSection[]; bodyWeightAutoShown?: boolean }

const read = (): State => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { hidden: [...DEFAULT_HIDDEN], weightDays: DEFAULT_WEIGHT_DAYS };
    const s = JSON.parse(raw);
    const days = WEIGHT_RANGES.some((r) => r.days === s.weightDays) ? s.weightDays : DEFAULT_WEIGHT_DAYS;
    return { hidden: Array.isArray(s.hidden) ? s.hidden : [], weightDays: days, touched: Array.isArray(s.touched) ? s.touched : [], bodyWeightAutoShown: !!s.bodyWeightAutoShown };
  } catch { return { hidden: [...DEFAULT_HIDDEN], weightDays: DEFAULT_WEIGHT_DAYS }; }
};
const write = (s: State) => { localStorage.setItem(KEY, JSON.stringify(s)); window.dispatchEvent(new Event(EVENT)); };

export function useStatsSettings() {
  const [state, setState] = useState<State>(read);
  useEffect(() => {
    const h = () => setState(read());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVENT, h); window.removeEventListener("storage", h); };
  }, []);
  return {
    weightDays: state.weightDays,
    isVisible: (k: StatsSection) => !state.hidden.includes(k),
    toggle: (k: StatsSection) => {
      const cur = read();
      write({ ...cur, touched: [...new Set([...(cur.touched || []), k])], hidden: cur.hidden.includes(k) ? cur.hidden.filter((x) => x !== k) : [...cur.hidden, k] });
    },
    setWeightDays: (d: number) => write({ ...read(), weightDays: d }),
  };
}

/** Slå på viktkurvan automatiskt en gång när användaren har fler än en vägning – om hen inte själv valt. */
export function autoShowBodyWeight(weighIns: number) {
  if (weighIns <= 1) return;
  const cur = read();
  if (cur.bodyWeightAutoShown || cur.touched?.includes("bodyWeight")) return;
  write({ ...cur, bodyWeightAutoShown: true, hidden: cur.hidden.filter((x) => x !== "bodyWeight") });
}
