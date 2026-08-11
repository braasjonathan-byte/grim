import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "gymberget_wakelock";

type Sentinel = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener: (t: string, l: () => void) => void;
};

let sentinel: Sentinel | null = null;
let enabled = false;
let started = false;
let reacquireTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(v: boolean) => void>();

export function isWakeLockEnabled() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function isWakeLockSupported() {
  return Capacitor.isNativePlatform() || "wakeLock" in navigator;
}

export function subscribeWakeLock(cb: (v: boolean) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function nativeKeepAwake(on: boolean) {
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch {
    // plugin unavailable
  }
}

async function acquire() {
  if (!enabled) return;
  if (Capacitor.isNativePlatform()) {
    await nativeKeepAwake(true);
    return;
  }
  if (!("wakeLock" in navigator)) return;
  if (sentinel && !sentinel.released) return;
  if (document.visibilityState !== "visible") return;
  try {
    sentinel = (await (navigator as any).wakeLock.request("screen")) as Sentinel;
    sentinel.addEventListener("release", () => {
      sentinel = null;
      // Re-acquire immediately if still enabled and visible (Android releases on blur)
      if (enabled && document.visibilityState === "visible") {
        setTimeout(() => void acquire(), 300);
      }
    });
  } catch {
    sentinel = null;
  }
}

async function release() {
  if (Capacitor.isNativePlatform()) {
    await nativeKeepAwake(false);
    return;
  }
  if (sentinel) {
    try {
      await sentinel.release();
    } catch {
      // ignore
    }
    sentinel = null;
  }
}

export async function setWakeLockEnabled(value: boolean) {
  enabled = value;
  localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  listeners.forEach((l) => l(value));
  if (value) await acquire();
  else await release();
}

/** Starts the global wake lock manager. Safe to call once at app root. */
export function startWakeLockManager() {
  if (started) return;
  started = true;
  enabled = isWakeLockEnabled();

  const onVisibility = () => {
    if (document.visibilityState === "visible") void acquire();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onVisibility);
  window.addEventListener("pageshow", onVisibility);

  // Safety net: some browsers silently drop the sentinel
  reacquireTimer = setInterval(() => {
    if (enabled && !Capacitor.isNativePlatform() && (!sentinel || sentinel.released)) {
      void acquire();
    }
  }, 15000);

  void acquire();

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onVisibility);
    window.removeEventListener("pageshow", onVisibility);
    if (reacquireTimer) clearInterval(reacquireTimer);
    started = false;
  };
}
