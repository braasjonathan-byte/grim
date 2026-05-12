import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const isNative = () => {
  // @ts-ignore
  return typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.();
};

const webVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch { /* ignore */ }
};

/** Light tap, e.g. set toggled or button confirm. */
export const hapticLight = () => {
  if (isNative()) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => webVibrate(15));
  } else {
    webVibrate(15);
  }
};

/** Medium tap, e.g. workout complete. */
export const hapticMedium = () => {
  if (isNative()) {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => webVibrate(30));
  } else {
    webVibrate(30);
  }
};

/** Strong alarm pattern, e.g. countdown timer ended. */
export const hapticAlarm = () => {
  if (isNative()) {
    Haptics.notification({ type: NotificationType.Warning }).catch(() => webVibrate([400, 150, 400, 150, 400]));
  } else {
    webVibrate([400, 150, 400, 150, 400]);
  }
};
