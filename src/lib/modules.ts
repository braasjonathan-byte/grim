/** Modul av/på (onboarding + Verktyg). Hem, Träning, Statistik och Verktyg är alltid på. */
export type ModuleKey = "nutrition" | "social";
export type Goal = "strength" | "cardio" | "weight" | "general";
const KEY = "grim_modules_v1";
const GOAL_KEY = "grim_goal_v1";
export const MODULES_EVENT = "grim:modules-changed";

export function getModules(): Record<ModuleKey, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return { nutrition: v?.nutrition !== false, social: v?.social !== false };
  } catch { return { nutrition: true, social: true }; }
}
export function setModules(m: Record<ModuleKey, boolean>) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(MODULES_EVENT));
}
export function getGoal(): Goal | null {
  try { return (localStorage.getItem(GOAL_KEY) as Goal) || null; } catch { return null; }
}
export function setGoal(g: Goal) { try { localStorage.setItem(GOAL_KEY, g); } catch { /* ignore */ } }
/** Förvalda moduler per mål – användaren kan ändra direkt. */
export function defaultModulesFor(goal: Goal): Record<ModuleKey, boolean> {
  return { nutrition: goal === "weight" || goal === "general" || goal === "strength", social: true };
}
