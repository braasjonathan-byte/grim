import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDateKey } from "@/lib/dateUtils";
import { isPlausibleMealLog } from "@/lib/inputValidation";
import { loadWorkoutBurnedRange } from "@/lib/workoutBurned";

/** Bro till Android-hemskärmswidgeten (GrimWidgetPlugin / GrimKcalWidget). */
interface GrimWidgetPlugin {
  update(data: Record<string, number | string | boolean>): Promise<void>;
  consumeLaunchTab(): Promise<{ tab: string | null }>;
}
const GrimWidget = registerPlugin<GrimWidgetPlugin>("GrimWidget");
const isAndroid = () => Capacitor.getPlatform() === "android";

function cssVarToHex(name: string): string | null {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!raw) return null;
    const el = document.createElement("div");
    el.style.color = raw.startsWith("#") || raw.startsWith("rgb") || raw.startsWith("hsl(") ? raw : `hsl(${raw})`;
    document.body.appendChild(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    const m = rgb.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    return "#" + m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

/** Exportera aktivt temas färger till widgeten (anropas efter applyTheme). */
export function syncWidgetTheme() {
  if (!isAndroid()) return;
  const data: Record<string, string | boolean> = {
    isDark: document.documentElement.classList.contains("dark"),
  };
  const map: Record<string, string> = {
    bg: "--background", card: "--card", foreground: "--foreground", primary: "--primary",
    muted: "--muted", mutedForeground: "--muted-foreground", destructive: "--destructive",
  };
  for (const [k, v] of Object.entries(map)) {
    const hex = cssVarToHex(v);
    if (hex) data[k] = hex;
  }
  GrimWidget.update(data).catch(logSyncError("theme"));
}

const logSyncError = (what: string) => (e: unknown) => console.warn(`[GrimWidget] ${what} sync failed`, e);

export interface WidgetNutrition {
  date: string; kcal: number; burned: number; targetKcal: number;
  protein: number; fat: number; carbs: number;
  targetProtein: number; targetFat: number; targetCarbs: number;
}

export function syncWidgetNutrition(d: WidgetNutrition) {
  if (!isAndroid()) return;
  GrimWidget.update({ ...d }).catch(logSyncError("nutrition"));
  syncWidgetTheme();
}

/**
 * Veckovy i widgeten: senaste 7 dagarna (äldst → idag).
 * Nycklar i SharedPreferences: weekEnd (YYYY-MM-DD idag), wD0..6 (datum),
 * wK0..6 (ätna kcal), wB0..6 (förbrända kcal), wS0..6 (antal pass).
 */
export async function syncWidgetWeek(userId: string): Promise<void> {
  if (!isAndroid() || !userId) return;
  try {
    const keys: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); keys.push(toLocalDateKey(d)); }
    const [{ data: logs, error }, burned] = await Promise.all([
      supabase.from("meal_logs").select("log_date,amount,unit,kcal,protein_g,fat_g,carbs_g")
        .eq("user_id", userId).gte("log_date", keys[0]).lte("log_date", keys[6]),
      loadWorkoutBurnedRange(userId, keys),
    ]);
    if (error) throw error;
    const kcal: Record<string, number> = {};
    for (const l of (logs || []) as any[]) {
      if (!isPlausibleMealLog(l)) continue;
      kcal[l.log_date] = (kcal[l.log_date] || 0) + Number(l.kcal || 0);
    }
    const data: Record<string, number | string> = { weekEnd: keys[6] };
    keys.forEach((k, i) => {
      data[`wD${i}`] = k;
      data[`wK${i}`] = Math.round(kcal[k] || 0);
      data[`wB${i}`] = burned[k]?.kcal ?? 0;
      data[`wS${i}`] = burned[k]?.sessions ?? 0;
    });
    await GrimWidget.update(data);
  } catch (e) { logSyncError("week")(e); }
}

/** Lyssna på widgetklick (kall- och varmstart) → öppna flik. */
export function listenWidgetLaunch(open: (tab: string) => void): () => void {
  if (!isAndroid()) return () => {};
  GrimWidget.consumeLaunchTab().then((r) => { if (r?.tab) open(r.tab); }).catch(logSyncError("launchTab"));
  const h = (e: Event) => { const t = (e as any)?.tab ?? (e as CustomEvent).detail?.tab; if (t) open(t); };
  window.addEventListener("grimOpenTab", h);
  return () => window.removeEventListener("grimOpenTab", h);
}
