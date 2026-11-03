import { useState } from "react";
import { getModules, setModules, type ModuleKey } from "@/lib/modules";

/** Modul av/på – samma val som i välkomstflödet. */
export default function ModuleSettings() {
  const [mods, setMods] = useState(getModules);
  const toggle = (k: ModuleKey, on: boolean) => { const m = { ...mods, [k]: on }; setMods(m); setModules(m); };
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold">🧩 Moduler</h3>
      {([["nutrition", "Kost"], ["social", "Socialt"]] as [ModuleKey, string][]).map(([k, label]) => (
        <label key={k} className="flex items-center justify-between gap-3 text-sm">
          <span>Visa {label} i menyn</span>
          <input type="checkbox" className="w-5 h-5 accent-primary" checked={mods[k]} onChange={(e) => toggle(k, e.target.checked)} />
        </label>
      ))}
    </div>
  );
}
