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

// Poll server for the latest deployed version. When a new version is detected,
// clear caches and hard-reload so PWA users always get the freshest build.
const REMOTE_VERSION_REFRESH_KEY = "grim_remote_refresh_at";
const checkRemoteVersion = async () => {
  try {
    // Bust any intermediate cache (SW, CDN, browser) by adding a timestamp.
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return;
    const { version } = await res.json();
    if (!version || version === APP_VERSION) return;

    // Avoid reload loops — only reload at most once every 30s.
    const lastReload = Number(sessionStorage.getItem(REMOTE_VERSION_REFRESH_KEY) || 0);
    if (Date.now() - lastReload < 30000) return;
    sessionStorage.setItem(REMOTE_VERSION_REFRESH_KEY, String(Date.now()));

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
    await clearAllCaches().catch(() => undefined);
    localStorage.setItem(APP_VERSION_STORAGE_KEY, version);
    window.location.reload();
  } catch {
    /* offline or transient — try again later */
  }
};

void checkRemoteVersion();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkRemoteVersion();
});

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

// iOS Safari fix: position:fixed elements drift off the bottom after the
// soft keyboard closes or after viewport resizes. Nudge layout to re-sync.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
if (isIOS) {
  const nudgeFixedElements = () => {
    window.scrollTo(window.scrollX, window.scrollY);
    document.body.style.minHeight = "";
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    document.body.offsetHeight;
    document.body.style.minHeight = "100vh";
  };
  window.addEventListener("orientationchange", () => setTimeout(nudgeFixedElements, 300));
  window.addEventListener("resize", () => setTimeout(nudgeFixedElements, 100));
  window.addEventListener("focusout", () => setTimeout(nudgeFixedElements, 100));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(nudgeFixedElements, 100);
  });
}

// Native-app feel: prevent accidental text/image selection in app chrome.
// Selection is only allowed when the actual selected text lives inside an editable field.
const editableSelector = 'input, textarea, select, [contenteditable="true"], .allow-select';

const getElementFromTarget = (target: EventTarget | Node | null) => {
  if (target instanceof Element) return target;
  return target?.parentElement ?? null;
};

const isEditableTarget = (target: EventTarget | Node | null) => {
  return !!getElementFromTarget(target)?.closest(editableSelector);
};

const selectionIsInsideEditable = (selection: Selection) => {
  if (selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return true;
  return isEditableTarget(selection.anchorNode) && isEditableTarget(selection.focusNode);
};

const clearNonEditableSelection = () => {
  const selection = window.getSelection();
  if (!selection || selectionIsInsideEditable(selection)) return;
  selection.removeAllRanges();
};

document.addEventListener("selectstart", (event) => {
  if (!isEditableTarget(event.target)) {
    event.preventDefault();
    clearNonEditableSelection();
  }
}, { capture: true });

document.addEventListener("selectionchange", clearNonEditableSelection);

document.addEventListener("mousedown", (event) => {
  if (!isEditableTarget(event.target)) {
    event.preventDefault();
    clearNonEditableSelection();
  }
}, { capture: true });

document.addEventListener("touchstart", (event) => {
  if (!isEditableTarget(event.target)) clearNonEditableSelection();
}, { capture: true, passive: true });

document.addEventListener("contextmenu", (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
}, { capture: true });

document.addEventListener("dragstart", (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
}, { capture: true });

// Lock screen orientation to portrait when supported (PWA / installed apps)
try {
  const orientation = (screen as any).orientation;
  if (orientation && typeof orientation.lock === "function") {
    orientation.lock("portrait").catch(() => {});
  }
} catch {
  /* unsupported */
}

createRoot(document.getElementById("root")!).render(<App />);
