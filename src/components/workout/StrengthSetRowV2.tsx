import type { ReactNode } from "react";
import SwipeableSetRow from "@/components/SwipeableSetRow";
import AutoSaveInput from "@/components/AutoSaveInput";
import { Checkbox } from "@/components/ui/checkbox";
import type { SetType } from "@/lib/setTypes";

/**
 * En setrad i styrka v2: [set-etikett] [reps] [(±) kg] [✓].
 * Tryck på set-etiketten byter settyp (vanligt → uppvärmning → dropset).
 * Bock = 1-tryck-set: tomma fält fylls med de förifyllda värdena (placeholder).
 */
export interface StrengthSetRowV2Props {
  label: string;
  setType: SetType;
  done: boolean;
  isPR: boolean;
  celebrationKey: string;
  onToggle: () => void;
  onCycleType: () => void;
  repsRule: any;
  repsInitial: string;
  repsPlaceholder: string;
  onSaveReps: (v: string) => void;
  showKg: boolean;
  kgInitial: string;
  kgPlaceholder: string;
  onSaveKg: (v: string) => void;
  confirmKg?: (value: number) => string | null;
  bwToggle?: { mode: "add" | "sub"; onToggle: () => void } | null;
  footer?: ReactNode;
}

const TYPE_CLS: Record<SetType, string> = {
  n: "text-muted-foreground",
  w: "text-warning font-bold",
  d: "text-primary font-bold",
};
const TYPE_TITLE: Record<SetType, string> = {
  n: "Vanligt set – tryck för uppvärmning",
  w: "Uppvärmningsset – tryck för dropset",
  d: "Dropset – tryck för vanligt set",
};

export default function StrengthSetRowV2(p: StrengthSetRowV2Props) {
  const inputCls = "bg-primary/10 text-foreground text-xs px-1 py-0.5 rounded border border-primary/30 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground placeholder:opacity-60";
  return (
    <div>
      <SwipeableSetRow done={p.done} isPR={p.isPR && p.setType !== "w"} celebrationKey={p.celebrationKey} onToggle={p.onToggle}>
        <div className={`flex items-center gap-1.5 py-0.5 rounded px-1 ${p.done ? "opacity-50 bg-success/5" : ""} ${p.setType === "w" ? "bg-warning/5" : ""}`}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); p.onCycleType(); }}
            className={`text-xs w-7 flex-shrink-0 text-center font-mono rounded hover:bg-secondary ${TYPE_CLS[p.setType]}`}
            title={TYPE_TITLE[p.setType]}
            aria-label={TYPE_TITLE[p.setType]}
          >
            {p.label}
          </button>
          <AutoSaveInput rule={p.repsRule} type="number" inputMode="numeric" initialValue={p.repsInitial} placeholder={p.repsPlaceholder} onSave={p.onSaveReps} className={`w-11 ${inputCls}`} />
          {p.showKg && (
            <>
              {p.bwToggle && (
                <button
                  onClick={(e) => { e.stopPropagation(); p.bwToggle!.onToggle(); }}
                  className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold border transition-colors ${
                    p.bwToggle.mode === "add" ? "bg-primary/10 border-primary/30 text-primary" : "bg-primary/5 border-primary/20 text-primary opacity-70"
                  }`}
                  title={p.bwToggle.mode === "add" ? "Addera vikt till kroppsvikt" : "Dra av vikt från kroppsvikt"}
                >
                  {p.bwToggle.mode === "add" ? "+" : "−"}
                </button>
              )}
              <AutoSaveInput rule="setKg" confirmValue={p.confirmKg} type="number" inputMode="decimal" initialValue={p.kgInitial} onSave={p.onSaveKg} placeholder={p.kgPlaceholder || "—"} className={`w-14 ${inputCls}`} />
            </>
          )}
          <span className="ml-auto flex items-center"><Checkbox checked={p.done} onCheckedChange={p.onToggle} className="h-5 w-5" aria-label="Klart set (fyller i förifyllda värden)" /></span>
        </div>
      </SwipeableSetRow>
      {p.footer}
    </div>
  );
}
