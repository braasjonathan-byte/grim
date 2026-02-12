import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Footprints, Heart, Timer, Route, Save } from "lucide-react";

interface WorkoutLogDialogProps {
  userId: string;
  week: number;
  day: string;
  sessionName: string;
  details: string;
  existingLog?: {
    logged_tempo: string | null;
    logged_pulse: number | null;
    logged_distance_km: number | null;
    logged_weights: Record<string, number> | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

const WorkoutLogDialog = ({
  userId,
  week,
  day,
  sessionName,
  details,
  existingLog,
  onClose,
  onSaved,
}: WorkoutLogDialogProps) => {
  const [tempo, setTempo] = useState(existingLog?.logged_tempo || "");
  const [pulse, setPulse] = useState(existingLog?.logged_pulse?.toString() || "");
  const [distance, setDistance] = useState(existingLog?.logged_distance_km?.toString() || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: true,
        skipped: false,
        logged_tempo: tempo.trim() || null,
        logged_pulse: pulse ? parseInt(pulse) || null : null,
        logged_distance_km: distance ? parseFloat(distance) || null : null,
      } as any,
      { onConflict: "user_id,week,day" }
    );

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-warning" /> Logga löppass
            </h3>
            <p className="text-xs text-muted-foreground">{sessionName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{details}</p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="w-3 h-3" /> Tempo (min/km)
            </label>
            <input
              type="text"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              placeholder="t.ex. 5:30"
              className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Heart className="w-3 h-3" /> Genomsnittspuls (bpm)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={pulse}
              onChange={(e) => setPulse(e.target.value)}
              placeholder="t.ex. 155"
              className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Route className="w-3 h-3" /> Distans (km)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="t.ex. 10"
              className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={async () => {
              await supabase.from("workout_completions").upsert(
                { user_id: userId, week, day, done: true, skipped: false } as any,
                { onConflict: "user_id,week,day" }
              );
              onSaved();
            }}
            className="flex-1 py-3 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
          >
            Hoppa över loggning
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Spara & klar
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutLogDialog;
