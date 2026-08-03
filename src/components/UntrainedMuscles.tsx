import { useState, useEffect } from "react";
import { Dumbbell, ChevronDown, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { loadUntrainedRegions, REGION_LABELS, REGION_EXERCISES, REGION_TO_GROUP } from "@/lib/untrainedMuscles";

interface UntrainedMusclesProps {
  userId: string;
}

const UntrainedMuscles = ({ userId }: UntrainedMusclesProps) => {
  const [untrainedRegions, setUntrainedRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadUntrainedRegions(userId)
      .then((regions) => { if (!cancelled) setUntrainedRegions(regions); })
      .catch((err) => console.error("UntrainedMuscles load error:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const openPickerFor = (region: string) => {
    const muscleGroup = REGION_TO_GROUP[region] || null;
    window.dispatchEvent(new CustomEvent("grim:set-tab", { detail: "workout" }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("grim:open-exercise-picker", { detail: { muscleGroup } }));
    }, 250);
  };

  if (loading || untrainedRegions.length === 0) return null;

  return (
    <div className="rounded-2xl p-4 bg-card shadow-soft border border-border/40">
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 icon-round bg-primary/10">
                <Dumbbell className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-bold font-sans">Ej tränade muskler (7 dagar)</h3>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="space-y-1.5">
            {untrainedRegions.map(region => (
              <button
                key={region}
                type="button"
                onClick={() => openPickerFor(region)}
                className="w-full text-left bg-muted/40 hover:bg-muted/70 active:scale-[0.99] transition-all rounded-xl px-3 py-2.5 flex items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{REGION_LABELS[region]}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {(REGION_EXERCISES[region] || []).join(" · ")}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Lägg till pass för ${REGION_LABELS[region]}`}
                  onClick={(e) => { e.stopPropagation(); openPickerFor(region); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openPickerFor(region); } }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-1 hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Lägg till
                </span>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default UntrainedMuscles;
