import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyTheme, getStoredThemeId } from "./lib/themes";
import { APP_VERSION } from "./lib/version";

const APP_VERSION_STORAGE_KEY = "grim_app_version";
const APP_VERSION_REFRESH_KEY = `grim_version_refresh_${APP_VERSION}`;

const clearAllCaches = async () => {
  if (!("caches" in window)) return;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
};

const syncAppVersion = async () => {
  const previousVersion = localStorage.getItem(APP_VERSION_STORAGE_KEY);

  if (!previousVersion) {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    return;
  }

  if (previousVersion === APP_VERSION || sessionStorage.getItem(APP_VERSION_REFRESH_KEY) === "1") {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
    return;
  }

  sessionStorage.setItem(APP_VERSION_REFRESH_KEY, "1");
  localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
  }

  await clearAllCaches().catch(() => undefined);
  window.location.reload();
};

void syncAppVersion();

// Initialize theme from localStorage before render
const storedTheme = localStorage.getItem("gymberget_theme");
const shouldBeDark = storedTheme === "dark";
if (shouldBeDark) {
  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
} else {
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.add("light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", "#ffffff");
}

// Apply stored color theme immediately
applyTheme(getStoredThemeId());

// Clear app icon badge when app is opened — try both main thread and SW
const clearBadge = () => {
  if ("clearAppBadge" in navigator) {
    (navigator as any).clearAppBadge().catch(() => {});
  }
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_BADGE" });
  }
};
clearBadge();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") clearBadge();
});

// Force service worker update check on every app load + periodically
if ("serviceWorker" in navigator) {
  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) reg.update().catch(() => {});
    });
  };

  checkForUpdate();

  setInterval(checkForUpdate, 2 * 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    const key = "grim_sw_reload";
    const last = sessionStorage.getItem(key);
    const now = Date.now();
    if (!last || now - Number(last) > 10000) {
      refreshing = true;
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
