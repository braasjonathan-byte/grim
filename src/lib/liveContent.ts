import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rememberPrevious } from "@/lib/contentHistory";
import { helpCategories, type HelpCategory } from "@/data/helpTopics";
import { readyWorkoutCategories, type ReadyWorkoutCategory } from "@/data/readyWorkouts";

/** Innehåll som admin kan byta inne i appen. Sparas i app_settings och läses av samma webbapp. */

export const BUNDLED_CHALLENGES = [
  "20 armhävningar 💪",
  "30 squats 🦵",
  "1 minut planka 🧘",
  "40 situps 🔥",
  "50 jumping jacks ⭐",
  "15 burpees 🥵",
  "20 lunges per ben 🏃",
  "25 tricep dips 💎",
  "30 sekunders väggstol 🧱",
  "10 pike push-ups 🤸",
  "20 mountain climbers 🏔️",
  "15 jump squats 🚀",
  "40 höga knän 🦿",
  "1 minut hälspark 🔄",
  "20 diamant-armhävningar 💠",
  "30 calf raises 🦶",
  "15 superman holds (3 sek) 🦸",
  "25 ryska twists 🌀",
  "20 glute bridges 🍑",
  "10 handstående mot vägg (5 sek) 🤚",
  "3×10 bakåtfällning 🔙",
  "50 steg lungewalk 🚶",
  "20 decline push-ups 📐",
  "30 flutter kicks 🦋",
  "45 sekunders sidoplanka per sida ⚖️",
  "15 box jumps (eller trappsteg) 📦",
  "20 commando planks 🎖️",
  "30 bicycle crunches 🚲",
  "2 minuter skipping (utan rep) 🤾",
  "10 pistol squats per ben 🔫",
  "25 push-up shoulder taps 👋",
];

export type NewsPopup = { id: string; title: string; items: string[] };

const KEYS = ["daily_challenges", "ready_workouts", "help_tips", "news_popup"] as const;

const strings = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const list = value.map((x) => String(x).trim()).filter(Boolean);
  return list.length ? list : null;
};

const asWorkouts = (value: unknown): ReadyWorkoutCategory[] | null => {
  if (!Array.isArray(value)) return null;
  const out: ReadyWorkoutCategory[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as { label?: unknown; emoji?: unknown; workouts?: unknown };
    const label = String(c.label || "").trim();
    const workouts = Array.isArray(c.workouts)
      ? c.workouts
          .map((w) => {
            const row = (w || {}) as { name?: unknown; details?: unknown; tempo?: unknown };
            return { name: String(row.name || "").trim(), details: String(row.details || ""), tempo: String(row.tempo || "") };
          })
          .filter((w) => w.name)
      : [];
    if (label && workouts.length) out.push({ label, emoji: String(c.emoji || "🏋️"), workouts });
  }
  return out.length ? out : null;
};

const asNews = (value: unknown): NewsPopup | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as { id?: unknown; title?: unknown; items?: unknown };
  const items = strings(v.items);
  const title = String(v.title || "").trim();
  const id = String(v.id || "").trim();
  if (!id || !title || !items) return null;
  return { id, title, items };
};

let challenges = BUNDLED_CHALLENGES;
let workouts = readyWorkoutCategories;
let help = helpCategories;
let helpOverride: Record<string, string[]> = {};
let news: NewsPopup | null = null;
let loaded = false;
let started = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function applyHelp(map: Record<string, string[]>) {
  helpOverride = map;
  help = helpCategories.map((c) => {
    const tips = map[c.title];
    return tips?.length ? { ...c, tips } : c;
  });
}

export async function refreshLiveContent() {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", [...KEYS]);
  challenges = BUNDLED_CHALLENGES;
  workouts = readyWorkoutCategories;
  applyHelp({});
  news = null;
  for (const row of data || []) {
    if (row.key === "daily_challenges") challenges = strings(row.value) ?? BUNDLED_CHALLENGES;
    if (row.key === "ready_workouts") workouts = asWorkouts(row.value) ?? readyWorkoutCategories;
    if (row.key === "help_tips" && row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      const map: Record<string, string[]> = {};
      for (const [title, tips] of Object.entries(row.value as Record<string, unknown>)) {
        const clean = strings(tips);
        if (clean) map[title] = clean;
      }
      applyHelp(map);
    }
    if (row.key === "news_popup") news = asNews(row.value);
  }
  loaded = true;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    refreshLiveContent().catch(() => { loaded = true; emit(); });
  }
  return () => { listeners.delete(listener); };
}

async function writeSetting(key: string, value: unknown, userId?: string) {
  const { data: previous } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await supabase.from("app_settings").upsert({
    key,
    value: value as never,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  });
  if (error) throw error;
  await rememberPrevious(key, previous?.value ?? null, userId);
  await refreshLiveContent();
}

async function clearSetting(key: string) {
  const { data: previous } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await supabase.from("app_settings").delete().eq("key", key);
  if (error) throw error;
  await rememberPrevious(key, previous?.value ?? null);
  await refreshLiveContent();
}

export const getReadyWorkouts = () => workouts;
export const useDailyChallenges = () => useStateSlot(() => challenges);
export const useReadyWorkouts = () => useStateSlot(() => workouts);
export const useHelpCategories = (): HelpCategory[] => useStateSlot(() => help);
export const useNewsPopup = () => useStateSlot(() => news);
export const useLiveContentReady = () => useStateSlot(() => loaded);

function useStateSlot<T>(read: () => T): T {
  const [value, setValue] = useState(read);
  useEffect(() => subscribe(() => setValue(read())), []);
  return value;
}

export const saveDailyChallenges = (list: string[], userId?: string) => writeSetting("daily_challenges", list, userId);
export const resetDailyChallenges = () => clearSetting("daily_challenges");
export const saveReadyWorkouts = (list: ReadyWorkoutCategory[], userId?: string) => writeSetting("ready_workouts", list, userId);
export const resetReadyWorkouts = () => clearSetting("ready_workouts");
export const saveHelpTips = (title: string, tips: string[], userId?: string) =>
  writeSetting("help_tips", { ...helpOverride, [title]: tips }, userId);
export const resetHelpTips = () => clearSetting("help_tips");
export const saveNewsPopup = (popup: NewsPopup, userId?: string) => writeSetting("news_popup", popup, userId);
export const clearNewsPopup = () => clearSetting("news_popup");
