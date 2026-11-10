import { useEffect, useState } from "react";
import { Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import NutritionGoalsDialog from "./NutritionGoalsDialog";
import {
  ADAPTIVE_CHANGED_EVENT,
  NUTRITION_GOALS_SAVED_EVENT,
  readAdaptiveEnabled,
  setAdaptiveEnabledEverywhere,
} from "./AdaptiveTdeeCard";

/** Inställningar → Kost: samma mål-dialog och adaptiv-växel som Kost → Mer (åtgärd 20). */
export default function NutritionSettings({ userId }: { userId: string }) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [adaptiveOn, setAdaptiveOn] = useState<boolean>(readAdaptiveEnabled);
  const [hasGoals, setHasGoals] = useState(false);

  const loadGoals = async () => {
    const { data } = await supabase.from("nutrition_goals").select("user_id").eq("user_id", userId).maybeSingle();
    setHasGoals(!!data);
  };

  useEffect(() => {
    void loadGoals();
    const onAdaptive = () => setAdaptiveOn(readAdaptiveEnabled());
    window.addEventListener(ADAPTIVE_CHANGED_EVENT, onAdaptive);
    return () => window.removeEventListener(ADAPTIVE_CHANGED_EVENT, onAdaptive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="rounded-2xl bg-card border border-border/40 p-4 space-y-3">
      <button
        type="button"
        onClick={() => setGoalsOpen(true)}
        className="w-full flex items-center justify-between gap-2 text-sm min-h-[44px]"
      >
        <span className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Kostmål (kcal och makron)</span>
        <span className="text-xs font-semibold text-primary">Ändra</span>
      </button>
      <label className="flex items-center justify-between gap-2 text-sm min-h-[44px]">
        <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Adaptiv förbrukning</span>
        <Switch
          checked={adaptiveOn}
          aria-label="Adaptiv förbrukning på/av"
          onCheckedChange={(v) => { setAdaptiveOn(v); setAdaptiveEnabledEverywhere(userId, v, hasGoals); }}
        />
      </label>
      <NutritionGoalsDialog
        open={goalsOpen}
        onOpenChange={setGoalsOpen}
        userId={userId}
        onSaved={() => {
          void loadGoals();
          try { window.dispatchEvent(new CustomEvent(NUTRITION_GOALS_SAVED_EVENT)); } catch { /* ignore */ }
        }}
      />
    </div>
  );
}
