import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Archive, ChevronDown, Check, X, Trash2, Dumbbell, Footprints, Moon, Bike, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";

interface ArchivedPlan {
  id: string;
  plan_name: string;
  plan_data: any[];
  completion_data: any[];
  archived_at: string;
}

interface ArchivedPlansProps {
  userId: string;
}

const getSessionIcon = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return Dumbbell;
  if (s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel")) return Footprints;
  if (s.includes("cykel") || s.includes("återhämtning") || s.includes("crosstrainer")) return Bike;
  return Moon;
};

const ArchivedPlans = ({ userId }: ArchivedPlansProps) => {
  const [archives, setArchives] = useState<ArchivedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("archived_plans")
        .select("*")
        .eq("user_id", userId)
        .order("archived_at", { ascending: false });
      if (data) setArchives(data as any);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Ta bort detta arkiverade schema permanent?")) return;
    await supabase.from("archived_plans").delete().eq("id", id);
    setArchives((prev) => prev.filter((a) => a.id !== id));
  };

  const handleRestore = async (archive: ArchivedPlan) => {
    if (!confirm("Återställa detta schema? Ditt nuvarande aktiva schema (om du har ett) arkiveras först.")) return;
    setRestoring(archive.id);
    try {
      // 1. Archive current active plan if exists
      const [{ data: currentPlan }, { data: currentComp }] = await Promise.all([
        supabase.from("workout_plans").select("*").eq("user_id", userId),
        supabase.from("workout_completions").select("*").eq("user_id", userId),
      ]);
      if (currentPlan && currentPlan.length > 0) {
        const planName = `Schema (${currentPlan.filter(p => p.session_name.trim() !== "").length} pass, ${[...new Set(currentPlan.map(p => p.week))].length} veckor)`;
        const { data: profileData } = await supabase.from("profiles").select("plan_start_date").eq("user_id", userId).single();
        await supabase.from("archived_plans").insert({
          user_id: userId,
          plan_name: planName,
          plan_data: currentPlan as any,
          completion_data: (currentComp || []) as any,
          plan_start_date: (profileData as any)?.plan_start_date ?? null,
        } as any);
      }

      // 2. Delete current active data
      await Promise.all([
        supabase.from("workout_plans").delete().eq("user_id", userId),
        supabase.from("workout_completions").delete().eq("user_id", userId),
      ]);

      // 3. Insert archived plan data back
      const planRows = (archive.plan_data || []).map((p: any) => ({
        user_id: userId,
        week: p.week,
        day: p.day,
        session_name: p.session_name || "",
        details: p.details || "",
        tempo: p.tempo || null,
      }));
      if (planRows.length > 0) {
        await supabase.from("workout_plans").insert(planRows);
      }

      const compRows = (archive.completion_data || []).map((c: any) => ({
        user_id: userId,
        week: c.week,
        day: c.day,
        done: c.done || false,
        skipped: c.skipped || false,
        user_comment: c.user_comment || null,
        logged_weights: c.logged_weights || null,
        logged_pulse: c.logged_pulse || null,
        logged_tempo: c.logged_tempo || null,
        logged_distance_km: c.logged_distance_km || null,
      }));
      if (compRows.length > 0) {
        await supabase.from("workout_completions").insert(compRows);
      }

      // 4. Delete the archive entry and set plan_start_date to today
      const today = new Date();
      const startDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      await Promise.all([
        supabase.from("archived_plans").delete().eq("id", archive.id),
        supabase.from("profiles").update({ plan_start_calibrated: true, plan_start_date: startDateStr } as any).eq("user_id", userId),
      ]);

      toast.success("Schemat har återställts!");
      window.location.reload();
    } catch (e) {
      console.error("Failed to restore plan:", e);
      toast.error("Kunde inte återställa schemat");
      setRestoring(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Archive className="w-5 h-5 text-muted-foreground animate-pulse" />
      </div>
    );
  }

  if (archives.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="Inga arkiverade scheman"
        description="När du avslutar ett schema sparas det här för framtida referens."
        emoji="📦"
      />
    );
  }

  return (
    <div className="space-y-3">
      {archives.map((archive) => {
        const isExpanded = expandedId === archive.id;
        const planDays = archive.plan_data || [];
        const completions = archive.completion_data || [];
        const weeks = [...new Set(planDays.map((p: any) => p.week))].sort((a: any, b: any) => a - b);
        const compMap: Record<string, boolean> = {};
        for (const c of completions) {
          if (c.done) compMap[`${c.week}-${c.day}`] = true;
        }
        const totalScheduled = planDays.filter((p: any) => p.session_name?.trim() && p.details?.trim()).length;
        const totalDone = Object.keys(compMap).length;

        return (
          <div key={archive.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => {
                setExpandedId(isExpanded ? null : archive.id);
                setExpandedWeek(null);
              }}
              className="w-full flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-2 text-left">
                <Archive className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold">{archive.plan_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Arkiverat {new Date(archive.archived_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{totalDone}/{totalScheduled} pass klara
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(archive);
                  }}
                  disabled={restoring === archive.id}
                  className="p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title="Återställ schema"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${restoring === archive.id ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(archive.id);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border p-3 space-y-2">
                {/* Week chips */}
                <div className="flex flex-wrap gap-1.5">
                  {weeks.map((w: any) => {
                    const isActive = expandedWeek === w;
                    return (
                      <button
                        key={w}
                        onClick={() => setExpandedWeek(isActive ? null : w)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        V{w}
                      </button>
                    );
                  })}
                </div>

                {/* Week details */}
                {expandedWeek !== null && (
                  <div className="space-y-1.5 pt-1">
                    {planDays
                      .filter((p: any) => p.week === expandedWeek)
                      .map((p: any, i: number) => {
                        const isDone = compMap[`${p.week}-${p.day}`];
                        const isEmpty = !p.session_name?.trim() || !p.details?.trim();
                        if (isEmpty) return null;
                        const Icon = getSessionIcon(p.session_name);
                        const comp = completions.find((c: any) => c.week === p.week && c.day === p.day);

                        return (
                          <div key={i} className={`p-2.5 rounded-lg border ${isDone ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"}`}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs font-bold flex-1">{p.day} — {p.session_name}</span>
                              {isDone ? (
                                <Check className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">{p.details}</p>
                            {comp?.user_comment && (
                              <p className="text-[11px] text-primary/80 mt-1 italic">💬 {comp.user_comment}</p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ArchivedPlans;
