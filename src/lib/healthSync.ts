import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type HealthDay = {
  day: string;
  steps: number;
  activeCalories: number;
};

const PERMISSIONS = ["READ_STEPS", "READ_ACTIVE_CALORIES"] as const;

type PermissionResponse = { permissions: Record<string, boolean>[] };

type HealthPluginLike = {
  isHealthAvailable: () => Promise<{ available: boolean }>;
  checkHealthPermissions: (req: { permissions: string[] }) => Promise<PermissionResponse>;
  requestHealthPermissions: (req: { permissions: string[] }) => Promise<PermissionResponse>;
  openHealthConnectSettings: () => Promise<void>;
  showHealthConnectInPlayStore: () => Promise<void>;
  queryAggregated: (req: {
    startDate: string;
    endDate: string;
    dataType: "steps" | "active-calories" | "mindfulness";
    bucket: string;
  }) => Promise<{ aggregatedData: { startDate: string; value: number }[] }>;
};

let pluginPromise: Promise<HealthPluginLike | null> | null = null;

async function loadPlugin(): Promise<HealthPluginLike | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!pluginPromise) {
    pluginPromise = import("capacitor-health")
      .then((mod) => (mod.Health as unknown as HealthPluginLike) ?? null)
      .catch(() => null);
  }
  return pluginPromise;
}

export function isHealthSupported() {
  return Capacitor.isNativePlatform();
}

export async function isHealthAvailable(): Promise<boolean> {
  const plugin = await loadPlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.isHealthAvailable();
    return !!res?.available;
  } catch {
    return false;
  }
}

function anyGranted(res: PermissionResponse | undefined): boolean {
  const list = res?.permissions ?? [];
  return list.some((entry) => Object.values(entry ?? {}).some(Boolean));
}

export async function requestHealthPermissions(): Promise<void> {
  const plugin = await loadPlugin();
  if (!plugin) throw new Error("Hälsodata är bara tillgängligt i appen.");

  const available = await plugin.isHealthAvailable().catch(() => ({ available: false }));
  if (!available?.available) {
    throw new Error(
      Capacitor.getPlatform() === "android"
        ? "Health Connect saknas på telefonen. Installera appen och försök igen."
        : "Apple Health är inte tillgängligt på den här enheten."
    );
  }

  const req = { permissions: [...PERMISSIONS] };
  let granted = false;
  try {
    granted = anyGranted(await plugin.checkHealthPermissions(req));
  } catch {
    /* iOS saknar check – fortsätt med request */
  }
  if (granted) return;

  let res: PermissionResponse | undefined;
  try {
    res = await plugin.requestHealthPermissions(req);
  } catch (err: any) {
    throw new Error(err?.message || "Behörighet till hälsodata nekades.");
  }
  if (anyGranted(res)) return;

  try {
    granted = anyGranted(await plugin.checkHealthPermissions(req));
  } catch {
    granted = Capacitor.getPlatform() === "ios";
  }
  if (!granted) {
    throw new Error(
      "Grim har inte behörighet till steg och kalorier. Öppna Behörigheter och tillåt Steg samt Aktiva kalorier."
    );
  }
}

export async function openHealthSettings(): Promise<void> {
  const plugin = await loadPlugin();
  if (!plugin) return;
  try {
    if (Capacitor.getPlatform() === "android") {
      await plugin.openHealthConnectSettings();
    }
  } catch {
    /* ignore */
  }
}

export async function installHealthConnect(): Promise<void> {
  const plugin = await loadPlugin();
  if (!plugin) return;
  try {
    await plugin.showHealthConnectInPlayStore();
  } catch {
    /* ignore */
  }
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Hämtar steg och aktiva kalorier per dag för de senaste `days` dagarna. */
export async function readHealthDays(days = 7): Promise<HealthDay[]> {
  const plugin = await loadPlugin();
  if (!plugin) throw new Error("Hälsodata är bara tillgängligt i appen.");

  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);

  const request = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    bucket: "day",
  };

  const [steps, calories] = await Promise.all([
    plugin
      .queryAggregated({ ...request, dataType: "steps" })
      .catch(() => ({ aggregatedData: [] })),
    plugin
      .queryAggregated({ ...request, dataType: "active-calories" })
      .catch(() => ({ aggregatedData: [] })),
  ]);

  const map = new Map<string, HealthDay>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = dayKey(d);
    map.set(key, { day: key, steps: 0, activeCalories: 0 });
  }

  for (const sample of steps.aggregatedData ?? []) {
    const key = dayKey(new Date(sample.startDate));
    const entry = map.get(key);
    if (entry) entry.steps += Math.round(sample.value || 0);
  }
  for (const sample of calories.aggregatedData ?? []) {
    const key = dayKey(new Date(sample.startDate));
    const entry = map.get(key);
    if (entry) entry.activeCalories += Math.round(sample.value || 0);
  }

  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
}

export async function saveHealthDays(userId: string, rows: HealthDay[]) {
  if (!rows.length) return;
  const payload = rows.map((row) => ({
    user_id: userId,
    day: row.day,
    steps: row.steps,
    active_calories: row.activeCalories,
    source: Capacitor.getPlatform() === "ios" ? "apple-health" : "health-connect",
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("health_daily")
    .upsert(payload, { onConflict: "user_id,day" });
  if (error) throw error;
}

export async function loadStoredHealthDays(userId: string, days = 7): Promise<HealthDay[]> {
  const start = new Date(Date.now() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("health_daily")
    .select("day, steps, active_calories")
    .eq("user_id", userId)
    .gte("day", dayKey(start))
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    day: row.day as string,
    steps: row.steps ?? 0,
    activeCalories: row.active_calories ?? 0,
  }));
}

/** Enkel återhämtningsvink: jämför dagens aktivitet med snittet. */
export function activityTrend(rows: HealthDay[]) {
  if (rows.length < 2) return null;
  const today = rows[rows.length - 1];
  const rest = rows.slice(0, -1);
  const avg = rest.reduce((sum, r) => sum + r.steps, 0) / rest.length;
  if (!avg) return null;
  const ratio = today.steps / avg;
  if (ratio >= 1.25) return "Mer rörelse än vanligt idag – tänk på återhämtningen.";
  if (ratio <= 0.6) return "Lugnare dag än vanligt – bra läge för ett tyngre pass.";
  return "Aktiviteten ligger i nivå med din vanliga vecka.";
}
