import { Capacitor } from "@capacitor/core";

type CrashlyticsModule = typeof import("@capacitor-firebase/crashlytics");

let crashlyticsPromise: Promise<CrashlyticsModule["FirebaseCrashlytics"] | null> | null = null;

const getCrashlytics = () => {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  if (!crashlyticsPromise) {
    crashlyticsPromise = import("@capacitor-firebase/crashlytics")
      .then((m) => m.FirebaseCrashlytics)
      .catch((e) => {
        console.warn("[crashlytics] plugin unavailable", e);
        return null;
      });
  }
  return crashlyticsPromise;
};

export const initCrashlytics = async () => {
  const c = await getCrashlytics();
  if (!c) return;
  try {
    await c.setEnabled({ enabled: true });
  } catch (e) {
    console.warn("[crashlytics] setEnabled failed", e);
  }

  window.addEventListener("error", (event) => {
    const err = event.error instanceof Error ? event.error : new Error(event.message || "window.error");
    void recordError(err);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : JSON.stringify(reason));
    void recordError(err);
  });
};

export const recordError = async (error: Error, context?: Record<string, string>) => {
  const c = await getCrashlytics();
  if (!c) return;
  try {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        await c.setCustomKey({ key: k, value: String(v), type: "string" }).catch(() => {});
      }
    }
    await c.recordException({
      message: error.message || "Unknown error",
      stacktrace: error.stack ? parseStack(error.stack) : undefined,
    } as any);
  } catch (e) {
    console.warn("[crashlytics] recordException failed", e);
  }
};

export const setCrashlyticsUserId = async (userId: string | null) => {
  const c = await getCrashlytics();
  if (!c) return;
  try {
    await c.setUserId({ userId: userId ?? "" });
  } catch {
    /* ignore */
  }
};

export const logCrashlyticsMessage = async (message: string) => {
  const c = await getCrashlytics();
  if (!c) return;
  try {
    await c.log({ message });
  } catch {
    /* ignore */
  }
};

// Force a native crash for testing the integration end-to-end.
export const crashAppForTesting = async () => {
  const c = await getCrashlytics();
  if (!c) return;
  await c.crash({ message: "Test crash from JS" });
};

const parseStack = (stack: string) =>
  stack
    .split("\n")
    .map((line) => ({ fileName: "app.js", lineNumber: 0, methodName: line.trim() }))
    .slice(0, 50);
