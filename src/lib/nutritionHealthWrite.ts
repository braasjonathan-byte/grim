/**
 * GRIM_HC_NUTRITION: speglar kost (summa per måltid och dag) och vatten (summa per dag)
 * till Health Connect. Avstämning likt healthWriteSync: bygger önskat läge för de senaste
 * dagarna, skriver bara det som ändrats (version = innehållshash) och tar bort poster för
 * måltider som försvunnit. Kräver native-metoderna writeNutrition/writeHydration
 * (scripts/patch-health-nutrition-write.cjs) – äldre AAB:er hoppar tyst över.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { healthLog, withTimeout } from "@/lib/healthSync";

type NutPlugin = {
  writeNutrition?: (o: { meals: MealExport[] }) => Promise<{ written: number }>;
  writeHydration?: (o: { items: WaterExport[] }) => Promise<{ written: number }>;
  deleteNutrition?: (o: { nutritionIds: string[]; hydrationIds: string[] }) => Promise<{ deleted: number }>;
  requestHealthPermissions?: (o: { permissions: string[] }) => Promise<any>;
  checkHealthPermissions?: (o: { permissions: string[] }) => Promise<any>;
};
const Plugin = registerPlugin<NutPlugin>("HealthPlugin");

export type MealExport = { clientRecordId: string; version: number; startTime: string; endTime: string; mealType: string; name: string; kcal: number; protein?: number; fat?: number; carbs?: number; fiber?: number; sugar?: number };
export type WaterExport = { clientRecordId: string; version: number; startTime: string; endTime: string; ml: number };
type MealRow = { log_date: string; meal_type: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number | null; sugar_g: number | null };
type WaterRow = { log_date: string; amount_ml: number };

export const NUTRITION_WRITE_PERMS = ["WRITE_NUTRITION", "WRITE_HYDRATION"] as const;
const ENABLED_KEY = "grim_health_nutrition_write_enabled";
const STORE_KEY = "grim_health_nutrition_written_v1";
export const NUTRITION_WINDOW_DAYS = 7;

/** Fast klockslag per måltid (lokal tid) så posterna hamnar rätt på dagen i Health Connect. */
const MEAL_HOUR: Record<string, number> = { frukost: 8, lunch: 12, mellanmål: 15, middag: 18, kvällsmål: 21 };

export function isNutritionWriteSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("HealthPlugin");
}
export function isNutritionWriteEnabled(): boolean { try { return localStorage.getItem(ENABLED_KEY) === "1"; } catch { return false; } }
export function setNutritionWriteEnabled(on: boolean) { try { localStorage.setItem(ENABLED_KEY, on ? "1" : "0"); } catch { /* ignore */ } }

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return Math.abs(h) + 1; };
const r1 = (n: number) => Math.round(n * 10) / 10;
function at(dateKey: string, hour: number, min = 0): Date { const [y, m, d] = dateKey.split("-").map(Number); return new Date(y, m - 1, d, hour, min, 0); }

/** Ren funktion (testad): summerar loggar per dag+måltid och vatten per dag. */
export function buildNutritionExport(meals: MealRow[], water: WaterRow[]): { meals: MealExport[]; water: WaterExport[] } {
  const groups = new Map<string, MealRow[]>();
  for (const m of meals) { const k = `${m.log_date}|${(m.meal_type || "övrigt").toLowerCase()}`; groups.set(k, [...(groups.get(k) || []), m]); }
  const outMeals: MealExport[] = [];
  for (const [k, rows] of groups) {
    const [date, meal] = k.split("|");
    const sum = (f: (r: MealRow) => number | null) => r1(rows.reduce((a, r) => a + (Number(f(r)) || 0), 0));
    const kcal = Math.round(rows.reduce((a, r) => a + (Number(r.kcal) || 0), 0));
    const start = at(date, MEAL_HOUR[meal] ?? 20);
    const e: Omit<MealExport, "version"> = {
      clientRecordId: `grim-nutr-${date}-${meal}`, startTime: start.toISOString(), endTime: new Date(start.getTime() + 30 * 60000).toISOString(),
      mealType: meal, name: `Grim · ${meal.charAt(0).toUpperCase()}${meal.slice(1)}`, kcal,
      protein: sum((r) => r.protein_g), fat: sum((r) => r.fat_g), carbs: sum((r) => r.carbs_g), fiber: sum((r) => r.fiber_g), sugar: sum((r) => r.sugar_g),
    };
    outMeals.push({ ...e, version: hash(JSON.stringify(e)) });
  }
  const outWater: WaterExport[] = water.filter((w) => w.amount_ml > 0).map((w) => {
    const e = { clientRecordId: `grim-water-${w.log_date}`, startTime: at(w.log_date, 0).toISOString(), endTime: at(w.log_date, 23, 59).toISOString(), ml: Math.round(w.amount_ml) };
    return { ...e, version: hash(JSON.stringify(e)) };
  });
  return { meals: outMeals, water: outWater };
}

type Store = Record<string, number>;
const load = (): Store => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch { return {}; } };
const save = (s: Store) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

export async function requestNutritionWriteAccess(): Promise<boolean> {
  if (!Plugin.requestHealthPermissions) return false;
  const res = await withTimeout(Plugin.requestHealthPermissions({ permissions: [...NUTRITION_WRITE_PERMS] }), 60000, "Health Connect svarade inte.");
  const p = res?.permissions ?? res ?? {};
  const val = (k: string) => (Array.isArray(p) ? p.some((x: any) => x?.[k] === true) : p?.[k] === true);
  return val("WRITE_NUTRITION") || val("WRITE_HYDRATION");
}

let running: Promise<{ written: number; deleted: number }> | null = null;
export function syncNutritionToHealth(userId: string): Promise<{ written: number; deleted: number; reason?: string }> {
  if (!isNutritionWriteSupported() || !isNutritionWriteEnabled()) return Promise.resolve({ written: 0, deleted: 0, reason: "off" });
  if (running) return running;
  running = (async () => {
    const from = new Date(); from.setDate(from.getDate() - (NUTRITION_WINDOW_DAYS - 1));
    const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    const [mR, wR] = await Promise.all([
      supabase.from("meal_logs").select("log_date, meal_type, kcal, protein_g, fat_g, carbs_g, fiber_g, sugar_g").eq("user_id", userId).gte("log_date", fromKey),
      supabase.from("water_logs").select("log_date, amount_ml").eq("user_id", userId).gte("log_date", fromKey),
    ]);
    if (mR.error || wR.error) throw mR.error || wR.error;
    const desired = buildNutritionExport((mR.data || []) as MealRow[], (wR.data || []) as WaterRow[]);
    const written = load();
    const meals = desired.meals.filter((m) => written[m.clientRecordId] !== m.version);
    const water = desired.water.filter((w) => written[w.clientRecordId] !== w.version);
    const want = new Set([...desired.meals, ...desired.water].map((x) => x.clientRecordId));
    const dateOf = (id: string) => id.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
    // Utanför fönstret: glöm bara (rör inte gamla poster); inom fönstret: borttagen måltid → radera.
    Object.keys(written).forEach((id) => { if (dateOf(id) < fromKey) delete written[id]; });
    const gone = Object.keys(written).filter((id) => !want.has(id));
    let n = 0;
    if (meals.length && Plugin.writeNutrition) { n += (await withTimeout(Plugin.writeNutrition({ meals }), 30000, "Health Connect svarade inte (kost).")).written; meals.forEach((m) => (written[m.clientRecordId] = m.version)); }
    if (water.length && Plugin.writeHydration) {
      try { n += (await withTimeout(Plugin.writeHydration({ items: water }), 30000, "Health Connect svarade inte (vatten).")).written; water.forEach((w) => (written[w.clientRecordId] = w.version)); }
      catch (e) { healthLog("hydration write skipped", String((e as Error)?.message || e)); }
    }
    let deleted = 0;
    if (gone.length && Plugin.deleteNutrition) {
      await withTimeout(Plugin.deleteNutrition({ nutritionIds: gone.filter((g) => g.startsWith("grim-nutr-")), hydrationIds: gone.filter((g) => g.startsWith("grim-water-")) }), 30000, "Health Connect svarade inte (radering).");
      gone.forEach((g) => delete written[g]); deleted = gone.length;
    }
    save(written);
    if (n || deleted) healthLog("nutrition write sync", { written: n, deleted });
    return { written: n, deleted };
  })().finally(() => { running = null; });
  return running;
}
