import { Capacitor, registerPlugin } from "@capacitor/core";

/** Bro till native GrimWorkoutPlugin (Android). No-op på webb / äldre AAB utan pluginet. */
interface GrimWorkoutPlugin {
  startRest(o: { seconds: number; exercise?: string }): Promise<void>;
  stopRest(): Promise<void>;
  startGps(o: { text?: string }): Promise<void>;
  stopGps(): Promise<void>;
}
const GrimWorkout = registerPlugin<GrimWorkoutPlugin>("GrimWorkout");

export const hasNativeWorkoutServices = (): boolean =>
  Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("GrimWorkout");

/** shortService-gräns på Android 14+ (~3 min); längre vilor hanteras även av reservnotisen. */
export const NATIVE_REST_MAX_SEC = 170;

export async function nativeStartRest(seconds: number, exercise?: string): Promise<boolean> {
  if (!hasNativeWorkoutServices() || seconds <= 0) return false;
  try { await GrimWorkout.startRest({ seconds, exercise }); return true; } catch { return false; }
}
export async function nativeStopRest(): Promise<void> {
  if (!hasNativeWorkoutServices()) return;
  try { await GrimWorkout.stopRest(); } catch { /* ignore */ }
}
export async function nativeStartGps(text?: string): Promise<void> {
  if (!hasNativeWorkoutServices()) return;
  try { await GrimWorkout.startGps({ text }); } catch { /* ignore */ }
}
export async function nativeStopGps(): Promise<void> {
  if (!hasNativeWorkoutServices()) return;
  try { await GrimWorkout.stopGps(); } catch { /* ignore */ }
}
