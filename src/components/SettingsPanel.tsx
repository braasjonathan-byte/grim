import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "gymberget_theme";

const SettingsPanel = () => {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-bold">⚙️ Inställningar</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {dark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
          <span className="text-sm">Mörkt läge</span>
        </div>
        <button
          onClick={() => setDark(!dark)}
          className={`relative w-11 h-6 rounded-full transition-colors ${dark ? "bg-primary" : "bg-secondary border border-border"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
              dark ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground"
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
