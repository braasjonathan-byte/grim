import { useState } from "react";
import { Plus, X } from "lucide-react";
import { validateNumber } from "@/lib/inputValidation";

export interface SetRow { kg: string; reps: string }

/** Validates every set with the shared rules; returns the first error or null. */
export const validateSetRows = (rows: SetRow[]): string | null => {
  for (let i = 0; i < rows.length; i++) {
    const r = validateNumber(rows[i].reps, "setReps");
    if (r.error) return `Set ${i + 1}, reps: ${r.error}`;
    const k = validateNumber(rows[i].kg, "setKg");
    if (k.error) return `Set ${i + 1}, kg: ${k.error}`;
  }
  return null;
};

/** One row per set — sets are never merged. Bulk change requires an explicit choice. */
const SetRowsEditor = ({ rows, onChange, timeBased = false }: { rows: SetRow[]; onChange: (rows: SetRow[]) => void; timeBased?: boolean }) => {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<SetRow>({ kg: rows[0]?.kg || "", reps: rows[0]?.reps || "" });
  const input = "w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono";
  const repsLabel = timeBased ? "Sek" : "Reps";
  const update = (i: number, field: keyof SetRow, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [field]: v } : r)));

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
        <span>Set</span><span className="text-center">{repsLabel}</span><span className="text-center">Kg</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-2 items-center">
          <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
          <input aria-label={`Set ${i + 1} ${repsLabel}`} inputMode="numeric" value={r.reps} onChange={(e) => update(i, "reps", e.target.value)} className={input} />
          <input aria-label={`Set ${i + 1} kg`} inputMode="decimal" value={r.kg} placeholder="—" onChange={(e) => update(i, "kg", e.target.value)} className={input} />
          <button type="button" aria-label={`Ta bort set ${i + 1}`} disabled={rows.length <= 1} onClick={() => onChange(rows.filter((_, j) => j !== i))} className="h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => onChange([...rows, { ...(rows[rows.length - 1] || { kg: "", reps: "" }) }])} className="text-xs font-semibold text-primary flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Lägg till set
        </button>
        <button type="button" onClick={() => setBulkOpen((o) => !o)} className="text-xs text-muted-foreground underline">
          Sätt samma värde på alla set
        </button>
      </div>
      {bulkOpen && (
        <div className="rounded-lg bg-muted/40 p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input aria-label={`Alla set ${repsLabel}`} inputMode="numeric" placeholder={repsLabel} value={bulk.reps} onChange={(e) => setBulk({ ...bulk, reps: e.target.value })} className={input} />
            <input aria-label="Alla set kg" inputMode="decimal" placeholder="Kg" value={bulk.kg} onChange={(e) => setBulk({ ...bulk, kg: e.target.value })} className={input} />
          </div>
          <button type="button" onClick={() => { onChange(rows.map(() => ({ ...bulk }))); setBulkOpen(false); }} className="w-full py-1.5 rounded-md bg-primary/15 text-primary text-xs font-semibold">
            Använd på alla {rows.length} set
          </button>
        </div>
      )}
    </div>
  );
};

export default SetRowsEditor;
