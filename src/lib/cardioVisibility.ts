// Manages which cardio categories are shown in Statistik.
// Stored in localStorage; toggling a category off hides distance contributions
// from workouts whose plan matches that category's keywords.

export type CardioCategory =
  | "löpning"
  | "cykling"
  | "simning"
  | "rodd"
  | "promenad"
  | "trapp";

export interface CardioCategoryMeta {
  key: CardioCategory;
  label: string;
  icon: string; // emoji
  keywords: RegExp;
}

export const CARDIO_CATEGORIES: CardioCategoryMeta[] = [
  { key: "löpning",   label: "Löpning",         icon: "🏃", keywords: /löpning|löp|jogg|sprint|tröskel|långpass|distanslöpning|intervaller?(?:löpning)?/i },
  { key: "cykling",   label: "Cykling",         icon: "🚴", keywords: /cykling|cykel|spinning/i },
  { key: "simning",   label: "Simning",         icon: "🏊", keywords: /simning|sim(?![a-zåäö])/i },
  { key: "rodd",      label: "Rodd",            icon: "🚣", keywords: /roddmaskin|rodd(?:pass)?/i },
  { key: "promenad",  label: "Promenad / Gång", icon: "🚶", keywords: /promenad|(?<![-\w])gång(?![-\w])/i },
  { key: "trapp",     label: "Trappmaskin",     icon: "🪜", keywords: /trappmaskin|stair\s*machine|crosstrainer/i },
];

const STORAGE_KEY = "grim_cardio_visibility";
const EVENT = "grim:cardio-visibility-changed";

const readState = (): Record<CardioCategory, boolean> => {
  const defaults = CARDIO_CATEGORIES.reduce((acc, c) => {
    acc[c.key] = true;
    return acc;
  }, {} as Record<CardioCategory, boolean>);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
};

export const getCardioVisibility = (): Record<CardioCategory, boolean> => readState();

export const setCardioVisibility = (key: CardioCategory, visible: boolean) => {
  const next = { ...readState(), [key]: visible };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT));
};

/** Returns the matched category for a plan's text, or null if none. */
export const getCardioCategory = (planText: string | null | undefined): CardioCategory | null => {
  if (!planText) return null;
  for (const c of CARDIO_CATEGORIES) {
    if (c.keywords.test(planText)) return c.key;
  }
  return null;
};

/** True if the plan belongs to a cardio category that the user has hidden. */
export const isCardioPlanHidden = (planText: string | null | undefined): boolean => {
  const cat = getCardioCategory(planText);
  if (!cat) return false;
  const vis = readState();
  return vis[cat] === false;
};

/** React hook: subscribe to changes from any tab/component. */
import { useEffect, useState } from "react";
export const useCardioVisibility = () => {
  const [state, setState] = useState(readState);
  useEffect(() => {
    const handler = () => setState(readState());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return { state, set: setCardioVisibility };
};
