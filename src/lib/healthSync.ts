import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type HealthDay = {
  day: string;
  steps: number;
  activeCalories: number;
  sleepMinutes: number;
};

/** Behörigheter grupperade efter vad Grim faktiskt gör med datan. */
export const PERMISSION_GROUPS = {
  activity: ["READ_STEPS", "READ_ACTIVE_CALORIES", "READ_DISTANCE"],
  workouts: ["READ_WORKOUTS"],
  heartRate: ["READ_HEART_RATE"],
  sleep: ["READ_SLEEP"],
} as const;

export type HealthFeature = keyof typeof PERMISSION_GROUPS;

export const FEATURE_LABELS: Record<HealthFeature, string> = {
  activity: "Steg, kalorier och distans",
  workouts: "Genomförda pass",
  heartRate: "Puls",
  sleep: "Sömn",
};

export type HealthAccess = Record<HealthFeature, boolean>;

const PERMISSIONS = Object.values(PERMISSION_GROUPS).flat() as string[];

/** Minsta uppsättning som krävs för att kortet ska kunna visa något alls. */
const CORE_PERMISSIONS = PERMISSION_GROUPS.activity;


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
    dataType: "steps" | "active-calories" | "sleep" | "mindfulness";
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

const EMPTY_ACCESS: HealthAccess = { activity: false, workouts: false, heartRate: false, sleep: false };

function accessFrom(res: PermissionResponse | undefined): HealthAccess {
  const granted = permissionMap(res);
  const has = (list: readonly string[]) => list.every((p) => granted[p] === true);
  return {
    activity: has(PERMISSION_GROUPS.activity),
    workouts: has(PERMISSION_GROUPS.workouts),
    heartRate: has(PERMISSION_GROUPS.heartRate),
    sleep: has(PERMISSION_GROUPS.sleep),
  };
}

/** Exponerad för tester: tolkar plugin-svaret till status per datatyp. */
export function parseHealthAccess(res: PermissionResponse | undefined): HealthAccess {
  return accessFrom(res);
}

/** Vilka datatyper Grim faktiskt får läsa just nu. */
export async function checkHealthAccess(): Promise<HealthAccess> {
  const plugin = await loadPlugin();
  if (!plugin) return EMPTY_ACCESS;
  // iOS svarar inte tillförlitligt på check – där avgörs det vid läsning.
  if (Capacitor.getPlatform() === "ios") {
    return { activity: true, workouts: true, heartRate: true, sleep: true };
  }
  try {
    const res = await withTimeout(
      plugin.checkHealthPermissions({ permissions: [...PERMISSIONS] }),
      10000,
      "timeout",
    );
    return accessFrom(res);
  } catch {
    return EMPTY_ACCESS;
  }
}

export async function requestHealthPermissions(): Promise<HealthAccess> {
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

  const existing = await checkHealthAccess();
  if (existing.activity && existing.workouts && existing.heartRate && existing.sleep) return existing;

  const req = { permissions: [...PERMISSIONS] };
  const coreReq = { permissions: [...CORE_PERMISSIONS] };
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

  let access = accessFrom(res);
  if (Capacitor.getPlatform() === "ios") {
    return { activity: true, workouts: true, heartRate: true, sleep: true };
  }
  if (!access.activity) {
    // Svaret kan komma i annat format – läs av det riktiga läget.
    access = await checkHealthAccess();
  }

  if (!access.activity) {
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
  return access;
}

/** Har appen redan behörighet att läsa grunddatan? */
export async function hasHealthPermissions(): Promise<boolean> {
  return (await checkHealthAccess()).activity;
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

/** Hämtar steg, aktiva kalorier och sömn per dag för de senaste `days` dagarna. */
export async function readHealthDays(days = 7): Promise<HealthDay[]> {
  const plugin = await loadPlugin();
  if (!plugin) throw new Error("Hälsodata är bara tillgängligt i appen.");

  let sleepAllowed = true;
  if (Capacitor.getPlatform() === "android") {
    const access = await checkHealthAccess();
    if (!access.activity) {
      throw new Error(
        "Grim saknar åtkomst till Steg, Aktiva kalorier eller Distans i Health Connect. Öppna Behörigheter och tillåt alla tre.",
      );
    }
    sleepAllowed = access.sleep;
  }

  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);

  const request = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    bucket: "day",
  };

  const [steps, calories, sleep] = await Promise.all([
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
    // Sömn är frivilligt – saknad behörighet eller äldre plugin får inte
    // stoppa steg och kalorier.
    sleepAllowed
      ? withTimeout(
          plugin.queryAggregated({ ...request, dataType: "sleep" }),
          20000,
          "timeout",
        ).catch(() => ({ aggregatedData: [] }))
      : Promise.resolve({ aggregatedData: [] as { startDate: string; value: number }[] }),
  ]);


  const map = new Map<string, HealthDay>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = dayKey(d);
    map.set(key, { day: key, steps: 0, activeCalories: 0, sleepMinutes: 0 });
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
  for (const sample of sleep.aggregatedData ?? []) {
    const key = dayKey(new Date(sample.startDate));
    const entry = map.get(key);
    if (entry) entry.sleepMinutes += Math.round(sample.value || 0);
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
    sleep_minutes: row.sleepMinutes,
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
    .select("day, steps, active_calories, sleep_minutes")
    .eq("user_id", userId)
    .gte("day", dayKey(start))
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    day: row.day as string,
    steps: row.steps ?? 0,
    activeCalories: row.active_calories ?? 0,
    sleepMinutes: (row as { sleep_minutes?: number | null }).sleep_minutes ?? 0,

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

/** Visar sömn som t.ex. "7 h 20 min". */
export function formatSleep(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
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
