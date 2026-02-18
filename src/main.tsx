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

// Force service worker update check on every app load
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg) {
      reg.update().catch(() => {});
    }
  });

  // Reload once when a new SW takes control (prevents infinite loops via sessionStorage flag)
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    const key = "grim_sw_reload";
    const last = sessionStorage.getItem(key);
    const now = Date.now();
    // Only reload if we haven't reloaded in the last 10 seconds
    if (!last || now - Number(last) > 10000) {
      refreshing = true;
      sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
