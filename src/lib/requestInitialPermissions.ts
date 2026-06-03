import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "grim_initial_permissions_requested_v1";

/**
 * Requests all relevant OS permissions up-front on first app launch
 * (camera, photo library, geolocation, notifications). Runs once per
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

    // Geolocation — request foreground first, then background ("Allow all the time")
    // so workouts can keep recording with the screen off.
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const fg = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
      if (fg.location === "granted" || fg.coarseLocation === "granted") {
        // A second call after foreground grant triggers the OS "Allow all the time"
        // prompt on Android 10+ (requires ACCESS_BACKGROUND_LOCATION in AndroidManifest).
        try {
          await Geolocation.requestPermissions({ permissions: ["location"] });
        } catch (err) {
          console.warn("Background geolocation permission request failed:", err);
        }
      }
    } catch (err) {
      console.warn("Geolocation permission request failed:", err);
    }

    // Push notifications (FCM/APNs)
    try {
      if (Capacitor.isPluginAvailable("PushNotifications")) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.requestPermissions();
      }
    } catch (err) {
      console.warn("Push permission request failed:", err);
    }
  } else {
    // Web / PWA — only notifications and geolocation can be pre-prompted.
    // Camera/photo access is requested by the browser on first use.
    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch (err) {
      console.warn("Notification permission request failed:", err);
    }

    try {
      if ("geolocation" in navigator) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            () => resolve(),
            { timeout: 5000, maximumAge: 600000 }
          );
        });
      }
    } catch (err) {
      console.warn("Geolocation permission request failed:", err);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}
