import { memo } from "react";
import { History } from "lucide-react";
import type { WarmupStep } from "@/lib/underPass";

const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

/** «Förra: 3×8 @ 80 kg» + förslag på uppvärmningsrampa ovanför setraderna (styrka v2). */
function ExerciseLeadIn({ prevSummary, ramp, onAddRamp }: { prevSummary: string | null; ramp: WarmupStep[]; onAddRamp: () => void }) {
  if (!prevSummary && !ramp.length) return null;
  return (
    <div className="space-y-1">
      {prevSummary && (
        <p className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
          <History className="w-3 h-3" /> Förra: <span className="font-mono font-semibold text-foreground/80">{prevSummary}</span>
        </p>
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
export default memo(ExerciseLeadIn, (a, b) => a.prevSummary === b.prevSummary && a.ramp.map((r) => r.kg).join() === b.ramp.map((r) => r.kg).join());
