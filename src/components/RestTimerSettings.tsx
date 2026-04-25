import { useState } from "react";
import { Timer } from "lucide-react";

const RestTimerSettings = () => {
  const [enabled, setEnabled] = useState(() => localStorage.getItem("grim_set_rest_timer_enabled") === "true");
  const [seconds, setSeconds] = useState(() => localStorage.getItem("grim_set_rest_timer_seconds") || "90");

  const updateEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("grim_set_rest_timer_enabled", String(next));
  };

  const updateSeconds = (value: string) => {
    setSeconds(value);
    localStorage.setItem("grim_set_rest_timer_seconds", value);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary p-4">
      <label className="flex min-w-0 flex-col text-sm font-bold text-foreground">
        <span className="flex min-w-0 items-center gap-2">
        <Timer className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">Vilotimer efter set</span>
        </span>
        <span className="text-xs font-medium text-muted-foreground">Startar när ett set klarmarkeras</span>
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={seconds}
          onChange={(e) => updateSeconds(e.target.value)}
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-muted-foreground">sek</span>
        <button
          type="button"
          onClick={updateEnabled}
          className={`h-5 w-10 rounded-full border p-0.5 transition-colors ${enabled ? "border-primary bg-primary" : "border-border bg-muted"}`}
          aria-pressed={enabled}
          aria-label={enabled ? "Avaktivera vilotimer" : "Aktivera vilotimer"}
        >
          <span className={`block h-4 w-4 rounded-full bg-foreground shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
    </div>
  );
};

export default RestTimerSettings;