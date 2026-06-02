import { Capacitor } from "@capacitor/core";

/**
 * URL to the latest APK / release page. Override at build time with
 * VITE_APK_UPDATE_URL (e.g. a GitHub Releases "latest" URL).
 */
export const APK_UPDATE_URL: string =
  (import.meta.env.VITE_APK_UPDATE_URL as string | undefined) ||
  "https://github.com/";

/**
 * Triggers an app update flow.
 * - On native (Capacitor): opens the APK download URL in the system browser
 *   so the user can install the latest build.
 * - On web/PWA: clears caches, unregisters the service worker and forces
 *   a hard reload so the newest build is fetched from the network.
 */
export async function updateApp(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      window.open(APK_UPDATE_URL, "_system");
    } catch {
      window.location.href = APK_UPDATE_URL;
    }
    return;
  }

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignore
  }

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString());
  window.location.replace(url.toString());
}
