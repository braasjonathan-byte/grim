import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readyWorkoutCategories } from "@/data/readyWorkouts";
import { ChevronDown, Flame, Dumbbell, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WorkoutConfig {
  category_label: string;
  workout_name: string;
  is_circuit: boolean;
}

const ReadyWorkoutManager = () => {
  const [open, setOpen] = useState(false);
  const [configs, setConfigs] = useState<WorkoutConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("ready_workout_config")
      .select("category_label, workout_name, is_circuit")
      .then(({ data }) => {
        if (data) setConfigs(data as WorkoutConfig[]);
        setLoading(false);
      });
  }, [open]);

  const isCircuit = (cat: string, name: string) =>
    configs.find(c => c.category_label === cat && c.workout_name === name)?.is_circuit ?? false;

  const toggle = async (cat: string, name: string) => {
    const key = `${cat}::${name}`;
    setSaving(key);
    const current = isCircuit(cat, name);
    const newVal = !current;

    const existing = configs.find(c => c.category_label === cat && c.workout_name === name);
    if (existing) {
      await supabase
        .from("ready_workout_config")
        .update({ is_circuit: newVal, updated_at: new Date().toISOString() } as any)
        .eq("category_label", cat)
        .eq("workout_name", name);
      setConfigs(prev => prev.map(c => c.category_label === cat && c.workout_name === name ? { ...c, is_circuit: newVal } : c));
    } else {
      await supabase
        .from("ready_workout_config")
        .insert({ category_label: cat, workout_name: name, is_circuit: newVal } as any);
      setConfigs(prev => [...prev, { category_label: cat, workout_name: name, is_circuit: newVal }]);
    }

    setSaving(null);
    toast.success(newVal ? `"${name}" markerat som cirkelpass` : `"${name}" markerat som vanligt pass`);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-sm font-bold"
      >
        <span className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          Passtyper (cirkel/vanligt)
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            readyWorkoutCategories.map((cat) => (
              <div key={cat.label}>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{cat.emoji} {cat.label}</p>
                <div className="space-y-1">
                  {cat.workouts.map((w) => {
                    const circuit = isCircuit(cat.label, w.name);
                    const key = `${cat.label}::${w.name}`;
                    return (
                      <div key={w.name} className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/50">
                        <span className="text-xs truncate flex-1">{w.name}</span>
                        <button
                          onClick={() => toggle(cat.label, w.name)}
                          disabled={saving === key}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                            circuit
                              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                              : "bg-secondary text-muted-foreground border border-border"
                          }`}
                        >
                          {saving === key ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : circuit ? (
                            <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> Cirkel</span>
                          ) : (
                            <span className="flex items-center gap-1"><Dumbbell className="w-3 h-3" /> Vanligt</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ReadyWorkoutManager;
