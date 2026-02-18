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
      // Listen for new SW waiting and force it to activate
      reg.addEventListener("updatefound", () => {
        const newSW = reg.installing;
        if (newSW) {
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              // New SW ready, reload to activate it
              window.location.reload();
            }
          });
        }
      });
    }
  });
  // Also reload when a new SW takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
