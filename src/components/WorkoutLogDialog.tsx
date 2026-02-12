import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Footprints, Dumbbell, Heart, Timer, Route, Save } from "lucide-react";

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

// Detect if session is running-type
const isRunningSession = (name: string, details: string): boolean => {
  const s = (name + " " + details).toLowerCase();
  return s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel") || s.includes("tempo") || s.includes("km") || s.includes("min/km");
};

// Detect if session is strength-type
const isStrengthSession = (name: string, details: string): boolean => {
  const s = (name + " " + details).toLowerCase();
  return s.includes("styrka") || s.includes("bänk") || s.includes("böj") || s.includes("mark") || s.includes("press") || s.includes("rodd") || s.includes("chins") || s.includes("tung") || s.includes("rpm") || s.includes("rpe") || s.includes("×") || s.includes("x");
};

// Extract exercise names from details string
const extractExercises = (details: string): string[] => {
  if (!details) return [];
  // Split on semicolons or newlines, then extract exercise name (before numbers/sets)
  const parts = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  const exercises: string[] = [];
  for (const part of parts) {
    // Match exercise name: text before first digit pattern like "3×5" or "3x5" or number
    const match = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d|\s*$)/);
    if (match) {
      const name = match[1].trim();
      // Skip rest/recovery entries
      if (name.toLowerCase().includes("vila") || name.toLowerCase().includes("vilodag") || name.toLowerCase().includes("deload")) continue;
      if (name.length > 2) exercises.push(name);
    }
  }
  return exercises;
};

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
  const showRunning = isRunningSession(sessionName, details);
  const showStrength = isStrengthSession(sessionName, details);
  const exercises = showStrength ? extractExercises(details) : [];

  const [tempo, setTempo] = useState(existingLog?.logged_tempo || "");
  const [pulse, setPulse] = useState(existingLog?.logged_pulse?.toString() || "");
  const [distance, setDistance] = useState(existingLog?.logged_distance_km?.toString() || "");
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const existing = existingLog?.logged_weights || {};
    for (const ex of exercises) {
      initial[ex] = existing[ex]?.toString() || "";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);

    const weightValues: Record<string, number> = {};
    for (const [ex, val] of Object.entries(weights)) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) weightValues[ex] = num;
    }

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
        logged_weights: Object.keys(weightValues).length > 0 ? weightValues : null,
      } as any,
      { onConflict: "user_id,week,day" }
    );

    setSaving(false);
    onSaved();
  };

  const hasAnyInput = tempo || pulse || distance || Object.values(weights).some(v => v);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Logga resultat</h3>
            <p className="text-xs text-muted-foreground">{sessionName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Running fields */}
        {showRunning && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Footprints className="w-3.5 h-3.5" /> Löpdata
            </p>
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
        )}

        {/* Strength fields */}
        {showStrength && exercises.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5" /> Vikter (kg)
            </p>
            {exercises.map((ex) => (
              <div key={ex} className="space-y-1">
                <label className="text-xs text-muted-foreground">{ex}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weights[ex] || ""}
                  onChange={(e) => setWeights(prev => ({ ...prev, [ex]: e.target.value }))}
                  placeholder="Vikt i kg"
                  className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                />
              </div>
            ))}
          </div>
        )}

        {/* If neither running nor strength detected */}
        {!showRunning && !showStrength && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Inga specifika fält att logga för detta pass. Passet markeras som avklarat.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" /> {hasAnyInput ? "Spara & klar" : "Markera klar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutLogDialog;
