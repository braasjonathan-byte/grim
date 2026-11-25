import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "grim_initial_permissions_requested_v1";

/**
 * Requests all relevant OS permissions up-front on first app launch
 * (camera, photo library, notifications). Runs once per
 * device — tracked via localStorage. Safe to call on every startup.
 *
 * Works for both Capacitor native (APK/iOS) and PWA/web. Each request
 * is wrapped in try/catch so a single failure never blocks the others.
 */
export async function requestInitialPermissions(): Promise<void> {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch {
    /* localStorage unavailable — still attempt once */
  }

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // Camera + photo library
    try {
      const { Camera } = await import("@capacitor/camera");
      await Camera.requestPermissions({ permissions: ["camera", "photos"] });
    } catch (err) {
      console.warn("Camera permission request failed:", err);
    }

    // Ingen platsbehörighet: Grim spelar inte in pass med GPS (Health Connect
    // ersätter det).

    // Do not request push permission during startup/login. On Android, some
    // Capacitor PushNotifications permission paths can crash natively before JS
    // can catch the failure. Native push is requested only from explicit flows.
  } else {
    // Web / PWA — only notifications are pre-prompted.
    // Camera/photo access is requested by the browser on first use.
    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch (err) {
      console.warn("Notification permission request failed:", err);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}
