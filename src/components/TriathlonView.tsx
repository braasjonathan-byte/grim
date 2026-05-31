import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import TriathlonWizard from "./TriathlonWizard";
import TriathlonCalendar from "./TriathlonCalendar";

interface Props {
  userId: string;
}

interface Plan {
  id: string;
  goal_type: string;
  duration_weeks: number | null;
  race_date: string | null;
  start_date: string;
  sessions_per_week: number;
  include_strength: boolean;
}

const TriathlonView = ({ userId }: Props) => {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("triathlon_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPlan(data as Plan | null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const handleDelete = async () => {
    if (!plan) return;
    const { error } = await supabase.from("triathlon_plans").delete().eq("id", plan.id);
    if (error) { toast.error("Kunde inte radera"); return; }
    toast.success("Plan raderad");
    setConfirmDelete(false);
    setPlan(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-primary"/></div>;
  }

  if (showWizard || !plan) {
    return (
      <div className="rounded-lg border border-border bg-secondary p-4">
        {!plan && !showWizard ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary"/>
            </div>
            <div>
              <h3 className="font-bold">Triathlonplan</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Anpassad plan för sim, cykel och löpning med adaptiv återhämtning.
              </p>
            </div>
            <Button onClick={() => setShowWizard(true)} className="w-full">
              <Plus className="w-4 h-4"/> Skapa plan
            </Button>
          </div>
        ) : (
          <TriathlonWizard
            userId={userId}
            onCreated={() => { setShowWizard(false); load(); }}
            onCancel={plan ? () => setShowWizard(false) : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-secondary p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary"/>
          <div>
            <h3 className="font-bold text-sm">Triathlonplan</h3>
            <p className="text-[11px] text-muted-foreground">
              {plan.goal_type === "race_date" && plan.race_date
                ? `Mål: ${new Date(plan.race_date).toLocaleDateString("sv-SE")}`
                : `${plan.duration_weeks ?? "—"} veckor`}
              {" · "}{plan.sessions_per_week} pass/v{plan.include_strength ? " + styrka" : ""}
            </p>
          </div>
        </div>
        <button onClick={() => setConfirmDelete(true)} className="text-muted-foreground p-1.5 hover:text-destructive">
          <Trash2 className="w-4 h-4"/>
        </button>
      </div>

      <TriathlonCalendar userId={userId} planId={plan.id} />

      <button
        onClick={() => setShowWizard(true)}
        className="w-full text-xs text-primary py-2 font-semibold border border-dashed border-primary/40 rounded-lg hover:bg-primary/5"
      >
        Skapa ny plan
      </button>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-card border border-border rounded-lg p-4 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="font-bold">Radera triathlonplan?</h4>
            <p className="text-sm text-muted-foreground">Alla pass och loggar för planen tas bort. Detta kan inte ångras.</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>Avbryt</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>Radera</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TriathlonView;
