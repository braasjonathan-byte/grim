import { Capacitor, registerPlugin } from "@capacitor/core";

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
  GrimWidget.update(data).catch(() => {});
}

export interface WidgetNutrition {
  date: string; kcal: number; burned: number; targetKcal: number;
  protein: number; fat: number; carbs: number;
  targetProtein: number; targetFat: number; targetCarbs: number;
}

export function syncWidgetNutrition(d: WidgetNutrition) {
  if (!isAndroid()) return;
  GrimWidget.update({ ...d }).catch(() => {});
  syncWidgetTheme();
}

/** Lyssna på widgetklick (kall- och varmstart) → öppna flik. */
export function listenWidgetLaunch(open: (tab: string) => void): () => void {
  if (!isAndroid()) return () => {};
  GrimWidget.consumeLaunchTab().then((r) => { if (r?.tab) open(r.tab); }).catch(() => {});
  const h = (e: Event) => { const t = (e as any)?.tab ?? (e as CustomEvent).detail?.tab; if (t) open(t); };
  window.addEventListener("grimOpenTab", h);
  return () => window.removeEventListener("grimOpenTab", h);
}
