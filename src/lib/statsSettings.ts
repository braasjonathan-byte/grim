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
] as const;
export type StatsSection = (typeof STATS_SECTIONS)[number]["key"];

export const WEIGHT_RANGES = [
  { days: 30, label: "1 mån" },
  { days: 90, label: "3 mån" },
  { days: 180, label: "6 mån" },
  { days: 270, label: "9 mån" },
  { days: 365, label: "1 år" },
] as const;

const KEY = "grim_stats_settings";
const EVENT = "grim:stats-settings-changed";
interface State { hidden: StatsSection[]; weightDays: number }

const read = (): State => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    const days = WEIGHT_RANGES.some((r) => r.days === s.weightDays) ? s.weightDays : 90;
    return { hidden: Array.isArray(s.hidden) ? s.hidden : [], weightDays: days };
  } catch { return { hidden: [], weightDays: 90 }; }
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
      write({ ...cur, hidden: cur.hidden.includes(k) ? cur.hidden.filter((x) => x !== k) : [...cur.hidden, k] });
    },
    setWeightDays: (d: number) => write({ ...read(), weightDays: d }),
  };
}
