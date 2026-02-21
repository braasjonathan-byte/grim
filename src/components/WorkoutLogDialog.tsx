import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Footprints, Heart, Timer, Route, Save, Calculator, Clock } from "lucide-react";
import { notifyFriendsOfCompletion } from "@/hooks/usePushNotifications";

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

// Parse tempo string like "5:30" to seconds per km
const tempoToSeconds = (t: string): number | null => {
  const m = t.match(/^(\d+)[:\.](\d+)$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const m2 = t.match(/^(\d+)$/);
  if (m2) return parseInt(m2[1]) * 60;
  return null;
};

// Parse total running minutes from session details
// Supports formats like:
// "3×10 min (2 min joggvila)" → 3*10 = 30 min running
// "4×8 min (2 min joggvila)" → 4*8 = 32 min running
// "21–31 min" → average = 26 min
// "8 km" → null (distance already specified)
const parseRunningMinutes = (details: string): number | null => {
  // Interval format: "3×10 min" or "4x8 min"
  const intervalMatch = details.match(/(\d+)\s*[×x]\s*(\d+)\s*min/i);
  if (intervalMatch) {
    return parseInt(intervalMatch[1]) * parseInt(intervalMatch[2]);
  }

  // Range format: "21–31 min" or "21-31 min"
  const rangeMatch = details.match(/(\d+)\s*[–-]\s*(\d+)\s*min/i);
  if (rangeMatch) {
    return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
  }

  // Single duration: "30 min"
  const singleMatch = details.match(/^(\d+)\s*min/i);
  if (singleMatch) {
    return parseInt(singleMatch[1]);
  }

  return null;
};

// Check if details already specify a distance (e.g. "8 km")
const parseExistingDistance = (details: string): number | null => {
  const match = details.match(/^(\d+(?:[.,]\d+)?)\s*km$/i);
  if (match) return parseFloat(match[1].replace(",", "."));
  return null;
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
  const [tempo, setTempo] = useState(existingLog?.logged_tempo || "");
  const [pulse, setPulse] = useState(existingLog?.logged_pulse?.toString() || "");
  const [distance, setDistance] = useState(existingLog?.logged_distance_km?.toString() || "");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoCalculated, setAutoCalculated] = useState(false);
  const [tempoAutoCalculated, setTempoAutoCalculated] = useState(false);

  // Auto-calculate tempo from duration and distance
  const calculateTempoFromDurationAndDistance = useCallback(() => {
    if (!duration.trim() || !distance.trim()) return;
    const distKm = parseFloat(distance.replace(",", "."));
    const durMin = parseFloat(duration.replace(",", "."));
    if (!distKm || distKm <= 0 || !durMin || durMin <= 0) return;

    const minPerKm = durMin / distKm;
    const mins = Math.floor(minPerKm);
    const secs = Math.round((minPerKm - mins) * 60);
    setTempo(`${mins}:${secs.toString().padStart(2, "0")}`);
    setTempoAutoCalculated(true);
  }, [duration, distance]);

  // Auto-calculate distance from duration and tempo
  const calculateDistanceFromDurationAndTempo = useCallback(() => {
    if (!duration.trim() || !tempo.trim()) return;
    const durMin = parseFloat(duration.replace(",", "."));
    const secsPerKm = tempoToSeconds(tempo.trim());
    if (!durMin || durMin <= 0 || !secsPerKm || secsPerKm <= 0) return;

    const distanceKm = durMin / (secsPerKm / 60);
    const rounded = Math.round(distanceKm * 100) / 100;
    setDistance(rounded.toString());
    setAutoCalculated(true);
  }, [duration, tempo]);

  // Auto-calculate distance when tempo changes (original logic from details parsing)
  const calculateDistance = useCallback(() => {
    if (!tempo.trim()) return;

    const secsPerKm = tempoToSeconds(tempo.trim());
    if (!secsPerKm || secsPerKm <= 0) return;

    const existingDist = parseExistingDistance(details);
    if (existingDist) {
      if (!distance) {
        setDistance(existingDist.toString());
        setAutoCalculated(true);
      }
      return;
    }

    const runMinutes = parseRunningMinutes(details);
    if (!runMinutes) return;

    const distanceKm = runMinutes / (secsPerKm / 60);
    const rounded = Math.round(distanceKm * 100) / 100;

    setDistance(rounded.toString());
    setAutoCalculated(true);
  }, [tempo, details, distance]);

  useEffect(() => {
    if (!existingLog?.logged_distance_km && tempo.trim() && !tempoAutoCalculated) {
      // If duration is entered, use duration+tempo to calculate distance
      if (duration.trim()) {
        calculateDistanceFromDurationAndTempo();
      } else {
        calculateDistance();
      }
    }
  }, [tempo, duration, calculateDistance, calculateDistanceFromDurationAndTempo, existingLog, tempoAutoCalculated]);

  useEffect(() => {
    // Only calculate tempo from duration+distance if tempo wasn't manually entered
    if (duration.trim() && distance.trim() && !tempo.trim()) {
      calculateTempoFromDurationAndDistance();
    }
  }, [duration, distance, tempo, calculateTempoFromDurationAndDistance]);

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

    // Send push notification to friends
    notifyFriendsOfCompletion(day, week, sessionName);

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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Tid (min)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setTempoAutoCalculated(false);
                }}
                placeholder="t.ex. 30"
                className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Route className="w-3 h-3" /> Distans (km)
                {autoCalculated && (
                  <span className="flex items-center gap-0.5 text-primary ml-1">
                    <Calculator className="w-3 h-3" />
                    <span className="text-[10px]">Beräknad</span>
                  </span>
                )}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={distance}
                onChange={(e) => {
                  setDistance(e.target.value);
                  setAutoCalculated(false);
                }}
                placeholder="t.ex. 10"
                className={`w-full text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground ${
                  autoCalculated ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary"
                }`}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="w-3 h-3" /> Tempo (min/km)
              {tempoAutoCalculated && (
                <span className="flex items-center gap-0.5 text-primary ml-1">
                  <Calculator className="w-3 h-3" />
                  <span className="text-[10px]">Beräknad</span>
                </span>
              )}
            </label>
            <input
              type="text"
              value={tempo}
              onChange={(e) => {
                setTempo(e.target.value);
                setAutoCalculated(false);
                setTempoAutoCalculated(false);
              }}
              placeholder="t.ex. 5:30"
              className={`w-full text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground ${
                tempoAutoCalculated ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary"
              }`}
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
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={async () => {
              await supabase.from("workout_completions").upsert(
                { user_id: userId, week, day, done: true, skipped: false } as any,
                { onConflict: "user_id,week,day" }
              );
              notifyFriendsOfCompletion(day, week, sessionName);
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