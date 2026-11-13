import { memo, useState, type ReactNode } from "react";
import { RPE_VALUES, rpeToRir } from "@/lib/underPass";
import SwipeableSetRow from "@/components/SwipeableSetRow";
import AutoSaveInput from "@/components/AutoSaveInput";
import { Checkbox } from "@/components/ui/checkbox";
import type { SetType } from "@/lib/setTypes";
import { Button } from "@/components/ui/button";

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
  /** Valfri RPE för setet (visas efter bock, kollapsad som standard). */
  rpe?: string | null;
  onRpe?: (value: string | null) => void;
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

function StrengthSetRowV2(p: StrengthSetRowV2Props) {
  const [rpeOpen, setRpeOpen] = useState(false);
  const showRpe = !!p.onRpe && p.done && p.setType !== "w";
  const inputCls = "h-11 bg-background text-foreground text-base px-2 rounded-lg border border-input text-center font-mono focus:ring-2 focus:ring-primary outline-none placeholder:text-muted-foreground";
  return (
    <div>
      <SwipeableSetRow done={p.done} isPR={p.isPR && p.setType !== "w"} celebrationKey={p.celebrationKey} onToggle={p.onToggle}>
        <div className={`flex flex-wrap items-center gap-1.5 py-1 rounded px-1 ${p.done ? "bg-success/5" : ""} ${p.setType === "w" ? "bg-warning/5" : ""}`}>
          <Button variant="ghost"
            type="button"
            onClick={(e) => { e.stopPropagation(); p.onCycleType(); }}
            className={`h-11 w-7 px-0 flex-shrink-0 text-center font-mono ${TYPE_CLS[p.setType]}`}
            title={TYPE_TITLE[p.setType]}
            aria-label={TYPE_TITLE[p.setType]}
          >
            {p.label}
          </Button>
          <AutoSaveInput aria-label="Repetitioner eller tid" rule={p.repsRule} type="number" inputMode="numeric" initialValue={p.repsInitial} placeholder={p.repsPlaceholder} onSave={p.onSaveReps} className={`w-16 ${inputCls}`} />
          {p.showKg && (
            <>
              {p.bwToggle && (
                <button
                  onClick={(e) => { e.stopPropagation(); p.bwToggle?.onToggle(); }}
                  className={`w-6 h-11 flex items-center justify-center rounded text-xs font-bold border transition-colors ${
                    p.bwToggle.mode === "add" ? "bg-primary/10 border-primary/30 text-primary" : "bg-primary/5 border-primary/20 text-primary opacity-70"
                  }`}
                  title={p.bwToggle.mode === "add" ? "Addera vikt till kroppsvikt" : "Dra av vikt från kroppsvikt"}
                >
                  {p.bwToggle.mode === "add" ? "+" : "−"}
                </button>
              )}
              <AutoSaveInput aria-label="Vikt i kg" rule="setKg" confirmValue={p.confirmKg} type="number" inputMode="decimal" initialValue={p.kgInitial} onSave={p.onSaveKg} placeholder={p.kgPlaceholder || "—"} className={`w-20 ${inputCls}`} />
            </>
          )}
          {showRpe && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRpeOpen((o) => !o); }}
              className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${p.rpe ? "border-primary/40 bg-primary/10 text-primary" : "border-dashed border-muted-foreground/40 text-muted-foreground"}`}
              aria-label="Ange RPE (ansträngning)"
              aria-expanded={rpeOpen}
            >
              {p.rpe ? `RPE ${p.rpe.replace(".", ",")}` : "RPE"}
            </button>
          )}
          <span className={`${showRpe ? "" : "ml-auto "}flex items-center`}><Checkbox checked={p.done} onCheckedChange={p.onToggle} className="h-11 w-11 rounded-lg" aria-label="Klart set (fyller i förifyllda värden)" /></span>
        </div>
      </SwipeableSetRow>
      {showRpe && rpeOpen && (
        <div className="flex items-center gap-1 pl-8 pr-1 py-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {RPE_VALUES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { p.onRpe?.(p.rpe === v ? null : v); setRpeOpen(false); }}
              className={`min-w-[30px] h-7 px-1 rounded-full text-[11px] font-mono border transition-colors ${p.rpe === v ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-transparent text-foreground hover:border-primary/40"}`}
              title={`RPE ${v} ≈ ${rpeToRir(v)} reps kvar`}
            >
              {v.replace(".", ",")}
            </button>
          ))}
          <span className="text-[9px] text-muted-foreground ml-1">{p.rpe ? `≈ ${rpeToRir(p.rpe)} kvar` : "10 = max"}</span>
        </div>
      )}
      {p.footer}
    </div>
  );
}

export default memo(StrengthSetRowV2);
