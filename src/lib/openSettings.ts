import { Capacitor } from "@capacitor/core";

export type SettingsTarget = "notifications" | "location" | "app";

/**
 * Opens the OS settings page for the app so the user can grant
 * notification or location permissions. On the web, falls back to
 * a noop (the calling UI already shows browser-specific instructions).
 *
 * Returns true if a native settings page was opened.
 */
export async function openAppSettings(target: SettingsTarget = "app"): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const mod = await import("capacitor-native-settings");
    const { NativeSettings, AndroidSettings, IOSSettings } = mod as any;

    let androidOption = AndroidSettings.ApplicationDetails;
    let iosOption = IOSSettings.App;

    if (target === "notifications") {
      androidOption = AndroidSettings.AppNotification;
      iosOption = IOSSettings.App;
    } else if (target === "location") {
      androidOption = AndroidSettings.Location;
      iosOption = IOSSettings.LocationServices ?? IOSSettings.App;
    }

    await NativeSettings.open({
      optionAndroid: androidOption,
      optionIOS: iosOption,
    });
    return true;
  } catch (err) {
    console.error("Failed to open native settings:", err);
    return false;
  }
}
