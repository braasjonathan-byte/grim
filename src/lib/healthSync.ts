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

/** Varje automatiskt anrop mot hälsoappen får ta max så här lång tid. */
export const STEP_TIMEOUT_MS = 20000;

/** Health Connect kan lämna löften ohanterade – avbryt istället för att snurra för evigt. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      healthLog("timeout", message);
      reject(new Error(message));
    }, ms);
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

type VisibilityTarget = {
  hidden?: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

function visibilityTarget(): VisibilityTarget | null {
  return typeof document === "undefined" ? null : (document as unknown as VisibilityTarget);
}

/**
 * Behörighetsdialogen öppnas av systemet ovanpå appen. Klockan ska bara ticka
 * medan Grim är i förgrunden – annars avbryts användaren mitt i godkännandet.
 * Hänger anropet utan att någon dialog syns avbryts det efter `idleMs`.
 */
export function withDialogTimeout<T>(
  promise: Promise<T>,
  message: string,
  idleMs = STEP_TIMEOUT_MS,
): Promise<T> {
  const target = visibilityTarget();
  if (!target) return withTimeout(promise, idleMs, message);

  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const cleanup = () => {
      stop();
      target.removeEventListener("visibilitychange", onVisibility);
    };
    const start = () => {
      stop();
      timer = setTimeout(() => {
        healthLog("timeout", message);
        cleanup();
        reject(new Error(message));
      }, idleMs);
    };
    function onVisibility() {
      if (target!.hidden) {
        healthLog("dialogen ligger överst – tidsgränsen pausas");
        stop();
      } else {
        healthLog("appen är tillbaka – tidsgränsen startas om");
        start();
      }
    }

    target.addEventListener("visibilitychange", onVisibility);
    if (!target.hidden) start();

    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (err) => {
        cleanup();
        reject(err);
      },
    );
  });
}

/** Loggas i Android Logcat (taggen "Capacitor/Console") så fel går att spåra på riktig enhet. */
export function healthLog(step: string, detail?: unknown) {
  try {
    console.info(`[health] ${step}`, detail === undefined ? "" : detail);
  } catch {
    /* ignore */
  }
}

/** Alla feltillstånd i hälsokedjan har en egen kod så gränssnittet kan svara rätt. */
export type HealthErrorCode =
  | "not-supported"
  | "not-installed"
  | "denied"
  | "partial"
  | "timeout"
  | "network"
  | "unknown";

export class HealthError extends Error {
  code: HealthErrorCode;
  constructor(code: HealthErrorCode, message: string) {
    super(message);
    this.name = "HealthError";
    this.code = code;
  }
}

export function healthErrorCode(err: unknown): HealthErrorCode {
  return err instanceof HealthError ? err.code : "unknown";
}

/**
 * Kort felkod som användaren kan läsa upp vid support. Varje troligt fel i
 * hälsokedjan har en egen kod så att det går att skilja dem åt.
 */
export const HEALTH_ERROR_REFS: Record<HealthErrorCode, string> = {
  "not-supported": "HC-01",
  "not-installed": "HC-02",
  denied: "HC-03",
  partial: "HC-04",
  timeout: "HC-05",
  network: "HC-06",
  unknown: "HC-99",
};

/** Kort förklaring per felkod, visas under felmeddelandet. */
export const HEALTH_ERROR_HINTS: Record<HealthErrorCode, string> = {
  "not-supported": "Hälsodata fungerar bara i Grim-appen på mobilen.",
  "not-installed": "Health Connect saknas eller behöver uppdateras.",
  denied: "Behörighet saknas i Health Connect.",
  partial: "Bara en del av datan kunde läsas.",
  timeout: "Health Connect svarade inte i tid.",
  network: "Ingen kontakt med servern.",
  unknown: "Okänt fel i hälsokopplingen.",
};

export function healthErrorRef(err: unknown): string {
  return HEALTH_ERROR_REFS[healthErrorCode(err)];
}

/** Meddelande + felkod, färdigt att visa i gränssnittet. */
export function formatHealthError(err: unknown, fallback = "Kunde inte hämta hälsodata") {
  const code = healthErrorCode(err);
  const ref = HEALTH_ERROR_REFS[code];
  const message = (err as { message?: string })?.message || fallback;
  return { code, ref, message, hint: HEALTH_ERROR_HINTS[code], label: `Felkod ${ref}` };
}

/** Hur appen ska bete sig när hälsoplattformen inte går att nå. */
export type HealthAvailability = "available" | "not-installed" | "not-supported";

export async function healthAvailability(): Promise<HealthAvailability> {
  const plugin = await loadPlugin();
  if (!plugin) return "not-supported";
  try {
    const res = await withTimeout(
      plugin.isHealthAvailable(),
      STEP_TIMEOUT_MS,
      "Health Connect svarade inte.",
    );
    healthLog("availability", res);
    if (res?.available) return "available";
  } catch (err) {
    healthLog("availability check failed", err);
  }
  // På Android betyder "inte tillgänglig" i praktiken att Health Connect
  // saknas eller behöver uppdateras – då ska användaren till Play Store.
  return Capacitor.getPlatform() === "android" ? "not-installed" : "not-supported";
}


async function loadPlugin(): Promise<HealthPluginLike | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (!pluginPromise) {
    pluginPromise = import("capacitor-health")
      .then((mod) => (mod.Health as unknown as HealthPluginLike) ?? null)
      .catch((err) => {
        healthLog("plugin import failed", err);
        return null;
      });
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
    const res = await withTimeout(
      plugin.isHealthAvailable(),
      STEP_TIMEOUT_MS,
      "Health Connect svarade inte.",
    );
    healthLog("availability", res);
    return !!res?.available;
  } catch (err) {
    healthLog("availability check failed", err);
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
  // Aktivitet räcker med steg ELLER kalorier – distans används bara i pass.
  const someActivity = PERMISSION_GROUPS.activity.some((p) => granted[p] === true);
  return {
    activity: someActivity,
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
      STEP_TIMEOUT_MS,
      "Health Connect svarade inte när behörigheterna lästes.",
    );
    healthLog("check permissions response", res);
    return accessFrom(res);
  } catch (err) {
    healthLog("check permissions failed", err);
    return EMPTY_ACCESS;
  }
}

export async function requestHealthPermissions(): Promise<HealthAccess> {
  const plugin = await loadPlugin();
  if (!plugin) throw new HealthError("not-supported", "Hälsodata är bara tillgängligt i Grim-appen på mobilen.");

  const availability = await healthAvailability();
  if (availability !== "available") {
    throw new HealthError(
      availability === "not-installed" ? "not-installed" : "not-supported",
      availability === "not-installed"
        ? "Health Connect saknas eller behöver uppdateras på telefonen. Installera det och försök igen."
        : "Apple Health är inte tillgängligt på den här enheten.",
    );
  }

  healthLog("health connect available");
  const existing = await checkHealthAccess();
  if (existing.activity && existing.workouts && existing.heartRate && existing.sleep) return existing;

  const req = { permissions: [...PERMISSIONS] };
  const coreReq = { permissions: [...CORE_PERMISSIONS] };
  let res: PermissionResponse | undefined;
  healthLog("requesting permissions", req.permissions);

  /**
   * Systemdialogen kan starta om appens aktivitet. Då tappar hälsomodulen
   * kopplingen till det pågående anropet och svaret kommer aldrig tillbaka.
   * Därför läser vi av det verkliga läget så fort appen är i förgrunden igen,
   * i stället för att lita enbart på svaret från modulen.
   */
  const settledOnResume = async (): Promise<HealthAccess | null> => {
    const target = visibilityTarget();
    if (!target) return null;
    await new Promise<void>((resolve) => {
      let sawHidden = false;
      const onChange = () => {
        if (target.hidden) {
          sawHidden = true;
        } else if (sawHidden) {
          target.removeEventListener("visibilitychange", onChange);
          resolve();
        }
      };
      target.addEventListener("visibilitychange", onChange);
    });
    healthLog("appen tillbaka efter dialogen – läser av behörigheterna");
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const access = await checkHealthAccess();
      if (access.activity) return access;
    }
    return null;
  };

  const request = async (request: { permissions: string[] }) => {
    const resumed = settledOnResume();
    const result = await Promise.race([
      withDialogTimeout(
        plugin.requestHealthPermissions(request),
        "Health Connect svarade inte i tid. Försök igen.",
      ).then((r) => ({ kind: "plugin" as const, res: r })),
      resumed.then((access) => (access ? { kind: "access" as const, access } : new Promise<never>(() => {}))),
    ]);
    return result;
  };

  try {
    const first = await request(req);
    if (first.kind === "access") return first.access;
    res = first.res;
  } catch (err: any) {
    healthLog("permission request failed", err?.message);
    // Har användaren hunnit godkänna trots att svaret uteblev? Läs av läget.
    const afterFirst = await checkHealthAccess();
    if (afterFirst.activity) return afterFirst;
    // Vissa enheter avvisar hela begäran om en behörighet inte stöds –
    // försök då med enbart grunddatan.
    try {
      const second = await request(coreReq);
      if (second.kind === "access") return second.access;
      res = second.res;
    } catch (fallbackErr: any) {
      healthLog("fallback permission request failed", fallbackErr?.message);
      const afterFallback = await checkHealthAccess();
      if (afterFallback.activity) return afterFallback;
      if (Capacitor.getPlatform() === "android") {
        try {
          await plugin.openHealthConnectSettings();
        } catch {
          /* ignore */
        }
      }
      throw new HealthError(
        "denied",
        "Health Connect öppnade ingen godkännanderuta. Vi har öppnat Health Connect åt dig – välj Grim under Appbehörigheter och tillåt Steg, Aktiva kalorier och Distans, gå sedan tillbaka och tryck Synka hälsodata igen.",
      );
    }
  }


  healthLog("permission response", res);
  if (Capacitor.getPlatform() === "ios") {
    return { activity: true, workouts: true, heartRate: true, sleep: true };
  }
  // Läs alltid av det verkliga läget: reservbegäran frågar bara om grunddatan,
  // så svaret där saknar pass, puls och sömn även när de redan är beviljade.
  let access = await checkHealthAccess();
  if (!access.activity) access = accessFrom(res);


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
    throw new HealthError(
      "denied",
      "Grim har inte behörighet ännu. Välj Grim i Health Connect och tillåt Steg, Aktiva kalorier och Distans – i Samsung Health måste synk till Health Connect också vara på.",
    );
  }
  if (!access.workouts || !access.heartRate || !access.sleep) {
    healthLog("partial access", access);
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

/**
 * Dagnyckel i telefonens egen tidszon. Health Connect grupperar dygn lokalt, så
 * en UTC-nyckel skulle flytta svensk data till fel datum (t.ex. midnatt 16:e
 * blir 22:00 den 15:e i UTC).
 */
function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}


const LAST_SYNC_KEY = "grim_health_last_sync";

/** Minsta respektive största fönster vi hämtar per synk. */
export const MIN_SYNC_DAYS = 2;
export const MAX_SYNC_DAYS = 30;

export function getLastHealthSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function setLastHealthSync(iso = new Date().toISOString()) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    /* ignore */
  }
}

/**
 * Hur många dagar bakåt som ska hämtas. Utgår från senaste lyckade synk så att
 * inga dagar hoppas över om appen inte varit öppen på ett tag – men aldrig
 * färre än MIN_SYNC_DAYS (dagens data ändras hela tiden) eller fler än
 * MAX_SYNC_DAYS.
 */
export function syncWindowDays(lastSyncIso: string | null, now = new Date()): number {
  if (!lastSyncIso) return 7;
  const then = new Date(lastSyncIso).getTime();
  if (!Number.isFinite(then)) return 7;
  const elapsedDays = Math.ceil((now.getTime() - then) / 86400000) + 1;
  return Math.min(MAX_SYNC_DAYS, Math.max(MIN_SYNC_DAYS, elapsedDays));
}

/** Hämtar steg, aktiva kalorier och sömn per dag för de senaste `days` dagarna. */
export async function readHealthDays(days = 7): Promise<HealthDay[]> {
  const plugin = await loadPlugin();
  if (!plugin) throw new HealthError("not-supported", "Hälsodata är bara tillgängligt i Grim-appen på mobilen.");

  let sleepAllowed = true;
  if (Capacitor.getPlatform() === "android") {
    const access = await checkHealthAccess();
    if (!access.activity) {
      throw new HealthError(
        "denied",
        "Grim saknar åtkomst till Steg och Aktiva kalorier i Health Connect. Öppna Behörigheter och tillåt minst en av dem.",
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

  healthLog("reading aggregated data", { days, sleepAllowed });
  const empty = { aggregatedData: [] as { startDate: string; value: number }[] };
  const errors: unknown[] = [];
  const [steps, calories, sleep] = await Promise.all([
    // Steg och kalorier kan vara nekade var för sig – den ena får inte stoppa den andra.
    withTimeout(
      plugin.queryAggregated({ ...request, dataType: "steps" }),
      STEP_TIMEOUT_MS,
      "Health Connect svarade inte när steg hämtades.",
    ).catch((err) => {
      healthLog("steps query failed", err);
      errors.push(err);
      return empty;
    }),
    withTimeout(
      plugin.queryAggregated({ ...request, dataType: "active-calories" }),
      STEP_TIMEOUT_MS,
      "Health Connect svarade inte när aktiva kalorier hämtades.",
    ).catch((err) => {
      healthLog("calories query failed", err);
      errors.push(err);
      return empty;
    }),
    // Sömn är frivilligt – saknad behörighet eller ett opatchat plugin får inte
    // stoppa steg och kalorier, men felet ska synas i loggen.
    sleepAllowed
      ? withTimeout(
          plugin.queryAggregated({ ...request, dataType: "sleep" }),
          STEP_TIMEOUT_MS,
          "Health Connect svarade inte när sömn hämtades.",
        ).catch((err) => {
          healthLog("sleep query failed", err);
          return { aggregatedData: [] };
        })
      : Promise.resolve({ aggregatedData: [] as { startDate: string; value: number }[] }),
  ]);

  // Båda misslyckades – då är det ett riktigt fel som ska nå användaren.
  if (errors.length === 2) throw errors[0];



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

  healthLog("aggregated data read", { days: map.size });
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
  const { error } = await withTimeout(
    Promise.resolve(
      supabase.from("health_daily").upsert(payload, { onConflict: "user_id,day" }),
    ),
    15000,
    "Kunde inte spara hälsodatan – ingen kontakt med servern.",
  );
  if (error) throw new HealthError("network", "Kunde inte spara hälsodatan – ingen kontakt med servern.");
}

export async function loadStoredHealthDays(userId: string, days = 7): Promise<HealthDay[]> {
  const start = new Date(Date.now() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);
  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from("health_daily")
        .select("day, steps, active_calories, sleep_minutes")
        .eq("user_id", userId)
        .gte("day", dayKey(start))
        .order("day", { ascending: true }),
    ),
    15000,
    "Kunde inte hämta sparad hälsodata – ingen kontakt med servern.",
  );
  if (error) throw new HealthError("network", "Kunde inte hämta sparad hälsodata – ingen kontakt med servern.");
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

/**
 * Stabil nyckel per pass. Nyckeln bygger på passets identitet i hälsoappen och
 * är lång nog att två olika pass inte kan krocka.
 */
export function workoutKey(w: Pick<RawHealthWorkout, "id" | "startDate" | "workoutType">): string {
  const base = w.id || `${w.startDate}|${w.workoutType}`;
  // FNV-1a i två strömmar ger 64 bitar – tillräckligt för att undvika krockar.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < base.length; i += 1) {
    const c = base.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

/**
 * Samsung Health och en klocka kan skriva samma pass till Health Connect. Pass
 * av samma typ som överlappar i tid räknas som ett – det med mest data vinner.
 */
export function dedupeWorkouts(list: HealthWorkout[]): HealthWorkout[] {
  const score = (w: HealthWorkout) =>
    (w.distanceKm ? 4 : 0) + (w.avgHeartRate ? 3 : 0) + (w.calories ? 2 : 0) + (w.steps ? 1 : 0) + w.minutes / 1000;
  const kept: HealthWorkout[] = [];
  for (const w of [...list].sort((a, b) => a.start.localeCompare(b.start))) {
    const aStart = new Date(w.start).getTime();
    const aEnd = new Date(w.end).getTime();
    const index = kept.findIndex((k) => {
      if (k.label !== w.label) return false;
      const bStart = new Date(k.start).getTime();
      const bEnd = new Date(k.end).getTime();
      const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
      const shortest = Math.min(aEnd - aStart, bEnd - bStart);
      if (!Number.isFinite(overlap) || shortest <= 0) return false;
      return overlap / shortest >= 0.5;
    });
    if (index === -1) {
      kept.push(w);
    } else if (score(w) > score(kept[index])) {
      kept[index] = w;
    }
  }
  return kept;
}


/** Läser genomförda pass från hälsoappen (inkl. Samsung Health via Health Connect). */
export async function readHealthWorkouts(days = 30): Promise<HealthWorkout[]> {
  const plugin = await loadPlugin();
  if (!plugin) throw new HealthError("not-supported", "Hälsodata är bara tillgängligt i Grim-appen på mobilen.");

  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  healthLog("reading workouts", { days });
  const res = await withTimeout(
    plugin.queryWorkouts({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      includeHeartRate: true,
      includeRoute: false,
      includeSteps: true,
    }),
    STEP_TIMEOUT_MS,
    "Hälsoappen svarade inte i tid. Försök igen.",
  ).catch((err) => {
    throw new HealthError("timeout", err?.message || "Hälsoappen svarade inte i tid. Försök igen.");
  });
  healthLog("workouts read", res?.workouts?.length ?? 0);

  const mapped = (res?.workouts ?? [])
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
    });
  const deduped = dedupeWorkouts(mapped).sort((a, b) => b.start.localeCompare(a.start));
  if (deduped.length !== mapped.length) {
    healthLog("duplicate workouts merged", mapped.length - deduped.length);
  }
  return deduped;
}
