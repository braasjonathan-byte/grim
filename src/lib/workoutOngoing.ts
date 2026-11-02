import { Capacitor } from "@capacitor/core";

/**
 * Pågående-notis för styrkepass (Android): visas på låsskärmen när första
 * setet bockas och uppdateras vid varje set med vilotimerns sluttid.
 * En separat notis "Vilan är slut" schemaläggs till vilans slut.
 * Avslutas när passet klarmarkeras eller efter 90 min utan aktivitet.
 */
export const ONGOING_ENABLED_KEY = "grim_ongoing_workout_notification";
const STATE_KEY = "grim_ongoing_workout";
const ONGOING_ID = 7301;
const REST_ID = 7302;
const IDLE_MS = 90 * 60 * 1000;
const CHANNEL = "grim_workout_ongoing";

type State = { startedAt: number; lastAt: number; sets: number; exercise?: string };

export function isOngoingNotificationEnabled(): boolean {
  return localStorage.getItem(ONGOING_ENABLED_KEY) !== "0";
}

function readState(): State | null {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || "null") as State | null;
    if (s && Date.now() - s.lastAt < IDLE_MS) return s;
  } catch { /* ignore */ }
  return null;
}

let plugin: typeof import("@capacitor/local-notifications").LocalNotifications | null = null;
let channelReady = false;
async function ln() {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("LocalNotifications")) return null;
  if (!plugin) plugin = (await import("@capacitor/local-notifications")).LocalNotifications;
  if (!channelReady && Capacitor.getPlatform() === "android") {
    try {
      await plugin.createChannel({ id: CHANNEL, name: "Pågående pass", description: "Visar pågående styrkepass och vilotimer", importance: 3, visibility: 1, vibration: true });
    } catch { /* ignore */ }
    channelReady = true;
  }
  return plugin;
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

/** Anropas när ett set bockas av. restSeconds = vilans längd (0/undefined = ingen vilotimer). */
export async function touchOngoingWorkout(opts: { exercise?: string; restSeconds?: number }) {
  if (!isOngoingNotificationEnabled()) return;
  const now = Date.now();
  const prev = readState();
  const state: State = { startedAt: prev?.startedAt ?? now, lastAt: now, sets: (prev?.sets ?? 0) + 1, exercise: opts.exercise };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  try {
    const p = await ln();
    if (!p) return;
    const perm = await p.checkPermissions();
    if (perm.display !== "granted") {
      const req = await p.requestPermissions();
      if (req.display !== "granted") return;
    }
    const mins = Math.max(0, Math.round((now - state.startedAt) / 60000));
    const restEnd = opts.restSeconds ? now + opts.restSeconds * 1000 : 0;
    const body = [
      opts.exercise ? `Senast: ${opts.exercise}` : null,
      `${state.sets} set · ${mins} min`,
      restEnd ? `Vila till ${hhmm(restEnd)}` : null,
    ].filter(Boolean).join(" · ");
    await p.cancel({ notifications: [{ id: REST_ID }] }).catch(() => {});
    const notifications: any[] = [{
      id: ONGOING_ID, channelId: CHANNEL, title: "🏋️ Styrkepass pågår", body,
      ongoing: true, autoCancel: false, extra: { url: "/?tab=workout" },
    }];
    if (restEnd) {
      notifications.push({
        id: REST_ID, channelId: CHANNEL, title: "⏰ Vilan är slut", body: "Dags för nästa set!",
        schedule: { at: new Date(restEnd), allowWhileIdle: true }, autoCancel: true, extra: { url: "/?tab=workout" },
      });
    }
    await p.schedule({ notifications });
  } catch { /* notiser är best effort */ }
}

export async function endOngoingWorkout() {
  localStorage.removeItem(STATE_KEY);
  try {
    const p = await ln();
    if (!p) return;
    await p.cancel({ notifications: [{ id: ONGOING_ID }, { id: REST_ID }] });
  } catch { /* ignore */ }
}

/** Städar bort en kvarglömd notis (t.ex. app-start efter >90 min). */
export function cleanupStaleOngoingWorkout() {
  if (localStorage.getItem(STATE_KEY) && !readState()) void endOngoingWorkout();
}
