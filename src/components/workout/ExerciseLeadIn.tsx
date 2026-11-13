import { memo } from "react";
import { History, TrendingUp } from "lucide-react";
import type { WarmupStep } from "@/lib/underPass";

const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

/** «Förra: 3×8 @ 80 kg» + förslag på uppvärmningsrampa ovanför setraderna (styrka v2). */
function ExerciseLeadIn({ prevSummary, ramp, onAddRamp, rpeSuggestion, onAcceptRpe }: { prevSummary: string | null; ramp: WarmupStep[]; onAddRamp: () => void; rpeSuggestion?: { label: string; rpe: number } | null; onAcceptRpe?: () => void }) {
  if (!prevSummary && !ramp.length && !rpeSuggestion) return null;
  return (
    <div className="space-y-1">
      {prevSummary && (
        <p className="text-xs text-muted-foreground px-1 py-2 flex flex-wrap items-center gap-1.5">
          <History className="w-4 h-4" /> Senast: <span className="font-mono font-semibold text-foreground">{prevSummary}</span>
        </p>
      )}
      {rpeSuggestion && (
        <div className="flex items-center gap-1.5 px-1 text-[10px]">
          <TrendingUp className="w-3 h-3 text-primary" />
          <span className="text-muted-foreground">Förslag <span className="opacity-70">(RPE {fmt(rpeSuggestion.rpe)} förra)</span>:</span>
          <span className="font-mono font-semibold text-foreground/90">{rpeSuggestion.label}</span>
          {onAcceptRpe && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onAcceptRpe(); }}
              className="ml-auto px-2 py-0.5 rounded-md bg-primary/15 text-primary font-semibold hover:bg-primary/25">Använd</button>
          )}
        </div>
      )}
      {ramp.length > 0 && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onAddRamp(); }}
          className="text-[10px] mx-1 px-2 py-1 rounded-lg border border-dashed border-warning/50 text-warning hover:bg-warning/10 text-left">
          + Uppvärmning {ramp.map((r) => `${fmt(r.kg)}×${r.reps}`).join(" · ")} kg <span className="opacity-70">(40/60/80 %)</span>
        </button>
      )}
    </div>
  );
}
export default memo(ExerciseLeadIn, (a, b) => a.prevSummary === b.prevSummary && a.rpeSuggestion?.label === b.rpeSuggestion?.label && !!a.onAcceptRpe === !!b.onAcceptRpe && a.ramp.map((r) => r.kg).join() === b.ramp.map((r) => r.kg).join());
