import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

// Clear app icon badge when app is opened
if ("clearAppBadge" in navigator) {
  (navigator as any).clearAppBadge().catch(() => {});
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && "clearAppBadge" in navigator) {
    (navigator as any).clearAppBadge().catch(() => {});
  }
});

// Force service worker update check on every app load + periodically
if ("serviceWorker" in navigator) {
  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) reg.update().catch(() => {});
    });
  };

  // Check on load
  checkForUpdate();

  // Check every 2 minutes
  setInterval(checkForUpdate, 2 * 60 * 1000);

  // Check when app returns to foreground
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });

  // Reload once when a new SW takes control
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
