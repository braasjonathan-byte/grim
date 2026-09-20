import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type HealthDay = {
  day: string;
  steps: number;
  activeCalories: number;
};

const PERMISSIONS = [
  "READ_STEPS",
  "READ_ACTIVE_CALORIES",
  "READ_TOTAL_CALORIES",
  "READ_DISTANCE",
  "READ_WORKOUTS",
  "READ_HEART_RATE",
] as const;

/** Minsta uppsättning som alltid finns i Health Connect. */
const CORE_PERMISSIONS = ["READ_STEPS", "READ_ACTIVE_CALORIES", "READ_DISTANCE"] as const;


type PermissionMap = Record<string, boolean>;
type PermissionResponse = { permissions: PermissionMap[] | PermissionMap };

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
  queryWorkouts: (req: {
    startDate: string;
    endDate: string;
    includeHeartRate: boolean;
    includeRoute: boolean;
    includeSteps: boolean;
  }) => Promise<{ workouts: RawHealthWorkout[] }>;
};

export type RawHealthWorkout = {
  id?: string;
  startDate: string;
  endDate: string;
  workoutType: string;
  sourceName: string;
  sourceBundleId?: string;
  duration: number;
  distance?: number;
  steps?: number;
  calories: number;
  heartRate?: { timestamp: string; bpm: number }[];
};

let pluginPromise: Promise<HealthPluginLike | null> | null = null;

/** Health Connect kan lämna löften ohanterade – avbryt istället för att snurra för evigt. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

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
    const res = await withTimeout(plugin.isHealthAvailable(), 8000, "timeout");
    return !!res?.available;
  } catch {
    return false;
  }
}

function permissionMap(res: PermissionResponse | undefined): PermissionMap {
  const raw = res?.permissions as unknown;
  if (!raw) return {};
  const list = Array.isArray(raw) ? raw : [raw as Record<string, boolean>];
  return Object.assign({}, ...list.filter(Boolean));
}

function allGranted(res: PermissionResponse | undefined, required: readonly string[]): boolean {
  const granted = permissionMap(res);
  return required.every((permission) => granted[permission] === true);
}


export async function requestHealthPermissions(): Promise<void> {
  const plugin = await loadPlugin();
  if (!plugin) throw new Error("Hälsodata är bara tillgängligt i appen.");

  const available = await withTimeout(plugin.isHealthAvailable(), 8000, "timeout").catch(() => ({
    available: false,
  }));
  if (!available?.available) {
    throw new Error(
      Capacitor.getPlatform() === "android"
        ? "Health Connect svarar inte eller saknas på telefonen. Öppna Health Connect en gång och försök igen."
        : "Apple Health är inte tillgängligt på den här enheten."
    );
  }

  const req = { permissions: [...PERMISSIONS] };
  const coreReq = { permissions: [...CORE_PERMISSIONS] };
  let granted = false;
  try {
    granted = allGranted(await withTimeout(plugin.checkHealthPermissions(coreReq), 10000, "timeout"), CORE_PERMISSIONS);
  } catch {
    /* iOS saknar check – fortsätt med request */
  }
  if (granted) return;

  let res: PermissionResponse | undefined;
  try {
    res = await withTimeout(
      plugin.requestHealthPermissions(req),
      120000,
      "Health Connect svarade inte. Öppna Health Connect, ge Grim behörighet och försök igen."
    );
  } catch (err: any) {
    // Vissa enheter avvisar hela begäran om en behörighet inte stöds –
    // försök då med enbart grunddatan.
    try {
      res = await withTimeout(
        plugin.requestHealthPermissions(coreReq),
        120000,
        err?.message || "Behörighet till hälsodata nekades."
      );
    } catch (fallbackErr: any) {
      throw new Error(fallbackErr?.message || err?.message || "Behörighet till hälsodata nekades.");
    }
  }
  if (Capacitor.getPlatform() === "ios" || allGranted(res, CORE_PERMISSIONS)) return;


  try {
    granted = allGranted(
      await withTimeout(plugin.checkHealthPermissions(coreReq), 10000, "timeout"),
      CORE_PERMISSIONS,
    );
  } catch {
    granted = Capacitor.getPlatform() === "ios";
  }

  if (!granted) {
    // Health Connect visar ingen dialog om användaren nekat två gånger –
    // öppna inställningarna direkt så behörigheten kan ges manuellt.
    if (Capacitor.getPlatform() === "android") {
      try {
        await plugin.openHealthConnectSettings();
      } catch {
        /* ignore */
      }
    }
    throw new Error(
      "Grim har inte behörighet ännu. Välj Grim i Health Connect och tillåt Steg, Aktiva kalorier och Distans – i Samsung Health måste synk till Health Connect också vara på."
    );
  }
}

/** Har appen redan behörighet att läsa hälsodata? */
export async function hasHealthPermissions(): Promise<boolean> {
  const plugin = await loadPlugin();
  if (!plugin) return false;
  try {
    if (Capacitor.getPlatform() === "ios") return true;
    return allGranted(
      await withTimeout(plugin.checkHealthPermissions({ permissions: [...CORE_PERMISSIONS] }), 10000, "timeout"),
      CORE_PERMISSIONS,
    );

  } catch {
    return false;
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

  if (Capacitor.getPlatform() === "android") {
    const permissions = await withTimeout(
      plugin.checkHealthPermissions({ permissions: [...CORE_PERMISSIONS] }),
      10000,
      "Health Connect svarade inte vid kontroll av behörigheter.",
    );
    if (!allGranted(permissions, CORE_PERMISSIONS)) {
      throw new Error(
        "Grim saknar åtkomst till Steg, Aktiva kalorier eller Distans i Health Connect. Öppna Behörigheter och tillåt alla tre.",
      );
    }
  }

  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);

  const request = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    bucket: "day",
  };

  const [steps, calories] = await Promise.all([
    withTimeout(
      plugin.queryAggregated({ ...request, dataType: "steps" }),
      20000,
      "Health Connect svarade inte när steg hämtades.",
    ),
    withTimeout(
      plugin.queryAggregated({ ...request, dataType: "active-calories" }),
      20000,
      "Health Connect svarade inte när aktiva kalorier hämtades.",
    ),
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

/* ---------------- Genomförda pass från Health Connect / Apple Health ---------------- */

export type HealthWorkout = {
  key: string;
  start: string;
  end: string;
  type: string;
  label: string;
  source: string;
  minutes: number;
  distanceKm: number | null;
  calories: number | null;
  steps: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
};

const WORKOUT_LABELS: Array<[RegExp, string]> = [
  [/tread/i, "Löpband"],
  [/run|jog/i, "Löpning"],
  [/hike|vandr/i, "Vandring"],
  [/walk/i, "Promenad"],
  [/spinning|indoor.?bik|stationary/i, "Spinning"],
  [/bik|cycl|ride/i, "Cykling"],
  [/swim/i, "Simning"],
  [/row/i, "Rodd"],
  [/elliptic|cross.?train/i, "Crosstrainer"],
  [/stair/i, "Trappmaskin"],
  [/strength|weight|resistance/i, "Styrketräning"],
  [/yoga/i, "Yoga"],
  [/hiit|interval/i, "Intervallpass"],
  [/ski/i, "Skidåkning"],
  [/paddl|kayak/i, "Paddling"],
  [/golf/i, "Golf"],
  [/football|soccer/i, "Fotboll"],
  [/tennis|padel/i, "Racketsport"],
  [/box/i, "Boxning"],
];

function labelForWorkoutType(type: string): string {
  const clean = (type || "").replace(/_/g, " ").trim();
  for (const [re, label] of WORKOUT_LABELS) if (re.test(clean)) return label;
  if (!clean) return "Träningspass";
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/** Kort, stabil nyckel per pass så samma pass inte importeras två gånger. */
function workoutKey(w: RawHealthWorkout): string {
  const base = w.id || `${w.startDate}|${w.workoutType}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return hash.toString(36).slice(0, 6);
}

/** Läser genomförda pass från hälsoappen (inkl. Samsung Health via Health Connect). */
export async function readHealthWorkouts(days = 30): Promise<HealthWorkout[]> {
  const plugin = await loadPlugin();
  if (!plugin) throw new Error("Hälsodata är bara tillgängligt i appen.");

  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const res = await withTimeout(
    plugin.queryWorkouts({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      includeHeartRate: true,
      includeRoute: false,
      includeSteps: true,
    }),
    30000,
    "Hälsoappen svarade inte i tid. Försök igen.",
  );


  return (res?.workouts ?? [])
    .map((w) => {
      const bpms = (w.heartRate ?? []).map((s) => s.bpm).filter((n) => Number.isFinite(n) && n > 0);
      // Tidsstämplarna är alltid tillförlitliga – duration (sekunder) används bara som reserv.
      const spanMinutes =
        (new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 60000;
      const minutes = Number.isFinite(spanMinutes) && spanMinutes > 0
        ? spanMinutes
        : (w.duration || 0) / 60;
      return {
        key: workoutKey(w),
        start: w.startDate,
        end: w.endDate,
        type: w.workoutType,
        label: labelForWorkoutType(w.workoutType),
        source: w.sourceName || "Hälsoappen",
        minutes: Math.max(0, Math.round(minutes * 100) / 100),
        distanceKm: w.distance ? Math.round((w.distance / 1000) * 100) / 100 : null,
        calories: w.calories ? Math.round(w.calories) : null,
        steps: w.steps ? Math.round(w.steps) : null,
        avgHeartRate: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
        maxHeartRate: bpms.length ? Math.max(...bpms) : null,
      } satisfies HealthWorkout;
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}
