import { useState, useEffect } from "react";
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

const tempoToMinPerKm = (t: string): number | null => {
  const secs = tempoToSeconds(t.trim());
  if (!secs || secs <= 0) return null;
  return secs / 60;
};

const formatTempo = (minPerKm: number): string => {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Parse interval pattern: "3×10 min" → { count: 3, duration: 10 }
const parseIntervalPattern = (details: string): { count: number; duration: number } | null => {
  const m = details.match(/(\d+)\s*[×x]\s*(\d+)\s*min/i);
  if (m) return { count: parseInt(m[1]), duration: parseInt(m[2]) };
  return null;
};

// Check if details already specify a distance (e.g. "8 km")
const parseExistingDistance = (details: string): number | null => {
  const match = details.match(/^(\d+(?:[.,]\d+)?)\s*km$/i);
  if (match) return parseFloat(match[1].replace(",", "."));
  return null;
};

// Parse total running minutes from session details (for non-interval)
const parseRunningMinutes = (details: string): number | null => {
  const intervalMatch = details.match(/(\d+)\s*[×x]\s*(\d+)\s*min/i);
  if (intervalMatch) return parseInt(intervalMatch[1]) * parseInt(intervalMatch[2]);
  const rangeMatch = details.match(/(\d+)\s*[–-]\s*(\d+)\s*min/i);
  if (rangeMatch) return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
  const singleMatch = details.match(/^(\d+)\s*min/i);
  if (singleMatch) return parseInt(singleMatch[1]);
  return null;
};

interface IntervalRow {
  time: string;
  tempo: string;
  distance: string;
}

const calcDistance = (timeMin: number, minPerKm: number): string => {
  if (timeMin > 0 && minPerKm > 0) {
    return String(Math.round((timeMin / minPerKm) * 100) / 100);
  }
  return "";
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
  const interval = parseIntervalPattern(details);
  const isInterval = !!interval;

  // Interval mode state
  const [intervals, setIntervals] = useState<IntervalRow[]>(() => {
    if (!interval) return [];
    return Array.from({ length: interval.count }, () => ({
      time: String(interval.duration),
      tempo: existingLog?.logged_tempo || "",
      distance: "",
    }));
  });

  // Non-interval mode state
  const [tempo, setTempo] = useState(existingLog?.logged_tempo || "");
  const [distance, setDistance] = useState(existingLog?.logged_distance_km?.toString() || "");
  const [duration, setDuration] = useState("");

  const [pulse, setPulse] = useState(existingLog?.logged_pulse?.toString() || "");
  const [saving, setSaving] = useState(false);

  // Auto-calc distance for each interval row when tempo or time changes
  const updateIntervalRow = (index: number, field: "time" | "tempo", value: string) => {
    setIntervals((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      const t = parseFloat(next[index].time.replace(",", "."));
      const p = tempoToMinPerKm(next[index].tempo);
      if (t > 0 && p && p > 0) {
        next[index].distance = calcDistance(t, p);
      } else {
        next[index].distance = "";
      }
      return next;
    });
  };

  // Apply same tempo to all intervals
  const applyTempoToAll = (tempoVal: string) => {
    setIntervals((prev) =>
      prev.map((row) => {
        const t = parseFloat(row.time.replace(",", "."));
        const p = tempoToMinPerKm(tempoVal);
        return {
          ...row,
          tempo: tempoVal,
          distance: t > 0 && p && p > 0 ? calcDistance(t, p) : "",
        };
      })
    );
  };

  // Auto-calc for non-interval mode
  const autoCalcSimple = (newTime: string, newTempo: string, newDist: string, changed: "time" | "tempo" | "distance") => {
    const t = parseFloat(newTime.replace(",", "."));
    const p = tempoToMinPerKm(newTempo);
    const d = parseFloat(newDist.replace(",", "."));

    if (changed === "time" && t > 0 && p && p > 0) {
      setDistance(calcDistance(t, p));
    } else if (changed === "time" && t > 0 && d > 0) {
      setTempo(formatTempo(t / d));
    } else if (changed === "tempo" && p && p > 0) {
      let time = t;
      if (!(time > 0)) {
        const runMin = parseRunningMinutes(details);
        if (runMin) { time = runMin; setDuration(String(runMin)); }
      }
      if (time > 0) setDistance(calcDistance(time, p));
    } else if (changed === "distance" && d > 0 && t > 0) {
      setTempo(formatTempo(t / d));
    } else if (changed === "distance" && d > 0 && p && p > 0) {
      setDuration(String(Math.round(p * d * 10) / 10));
    }
  };

  // Pre-fill distance on mount for non-interval
  useEffect(() => {
    if (isInterval) return;
    if (!existingLog?.logged_distance_km && tempo.trim() && !distance) {
      const existingDist = parseExistingDistance(details);
      if (existingDist) {
        setDistance(existingDist.toString());
      } else {
        const secs = tempoToSeconds(tempo.trim());
        if (secs && secs > 0) {
          const runMin = parseRunningMinutes(details);
          if (runMin) {
            setDistance((Math.round(runMin / (secs / 60) * 100) / 100).toString());
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute totals for interval mode
  const totalDistance = intervals.reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0);
  const totalTime = intervals.reduce((sum, r) => sum + (parseFloat(r.time.replace(",", ".")) || 0), 0);
  const avgTempo = totalDistance > 0 ? formatTempo(totalTime / totalDistance) : "";

  const handleSave = async () => {
    setSaving(true);

    const saveTempo = isInterval ? avgTempo : tempo.trim();
    const saveDist = isInterval ? totalDistance : parseFloat(distance) || null;

    // First read existing record to preserve logged_weights
    const { data: existing } = await supabase
      .from("workout_completions")
      .select("logged_weights")
      .eq("user_id", userId)
      .eq("week", week)
      .eq("day", day)
      .maybeSingle();

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: true,
        skipped: false,
        logged_tempo: saveTempo || null,
        logged_pulse: pulse ? parseInt(pulse) || null : null,
        logged_distance_km: saveDist || null,
        logged_weights: existing?.logged_weights ?? existingLog?.logged_weights ?? null,
      } as any,
      { onConflict: "user_id,week,day" }
    );

    notifyFriendsOfCompletion(day, week, sessionName);
    setSaving(false);
    onSaved();
  };

  const inputClass = "w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground";
  const calcClass = "w-full bg-primary/10 ring-1 ring-primary/30 text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl p-5 space-y-4 animate-fade-in max-h-[85vh] overflow-y-auto">
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

        {isInterval ? (
          <div className="space-y-3">
            {/* Header row */}
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-end text-[10px] text-muted-foreground font-medium">
              <span className="w-6" />
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> Tid</span>
              <span className="flex items-center gap-0.5"><Timer className="w-3 h-3" /> Tempo</span>
              <span className="flex items-center gap-0.5">
                <Route className="w-3 h-3" /> Distans
                <Calculator className="w-2.5 h-2.5 text-primary ml-0.5" />
              </span>
            </div>

            {intervals.map((row, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center">
                <span className="text-xs text-muted-foreground font-bold w-6 text-center">{i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={row.time}
                  onChange={(e) => updateIntervalRow(i, "time", e.target.value)}
                  placeholder="min"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={row.tempo}
                  onChange={(e) => {
                    updateIntervalRow(i, "tempo", e.target.value);
                  }}
                  onBlur={(e) => {
                    // If first row tempo set and others empty, apply to all
                    if (i === 0 && e.target.value.trim()) {
                      const allEmpty = intervals.slice(1).every((r) => !r.tempo.trim());
                      if (allEmpty) applyTempoToAll(e.target.value);
                    }
                  }}
                  placeholder="5:30"
                  className={inputClass}
                  autoFocus={i === 0}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={row.distance}
                  readOnly
                  tabIndex={-1}
                  className={row.distance ? calcClass : inputClass + " opacity-50"}
                  placeholder="—"
                />
              </div>
            ))}

            {/* Totals */}
            {totalDistance > 0 && (
              <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 text-xs">
                <span className="text-muted-foreground">Totalt</span>
                <div className="flex gap-3 font-semibold text-foreground">
                  <span>{totalTime} min</span>
                  {avgTempo && <span>{avgTempo} /km</span>}
                  <span>{Math.round(totalDistance * 100) / 100} km</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Non-interval mode */
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
                    autoCalcSimple(e.target.value, tempo, distance, "time");
                  }}
                  placeholder="t.ex. 30"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Route className="w-3 h-3" /> Distans (km)
                  {distance && duration && (
                    <Calculator className="w-3 h-3 text-primary ml-1" />
                  )}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => {
                    setDistance(e.target.value);
                    autoCalcSimple(duration, tempo, e.target.value, "distance");
                  }}
                  placeholder="t.ex. 10"
                  className={distance && duration ? calcClass : inputClass}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Timer className="w-3 h-3" /> Tempo (min/km)
              </label>
              <input
                type="text"
                value={tempo}
                onChange={(e) => {
                  setTempo(e.target.value);
                  autoCalcSimple(duration, e.target.value, distance, "tempo");
                }}
                placeholder="t.ex. 5:30"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Pulse - always shown */}
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
            className={inputClass}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={async () => {
              // Preserve existing logged_weights when skipping logging
              const { data: existing } = await supabase
                .from("workout_completions")
                .select("logged_weights, logged_tempo, logged_pulse, logged_distance_km")
                .eq("user_id", userId)
                .eq("week", week)
                .eq("day", day)
                .maybeSingle();

              await supabase.from("workout_completions").upsert(
                {
                  user_id: userId, week, day, done: true, skipped: false,
                  logged_weights: existing?.logged_weights ?? null,
                  logged_tempo: existing?.logged_tempo ?? null,
                  logged_pulse: existing?.logged_pulse ?? null,
                  logged_distance_km: existing?.logged_distance_km ?? null,
                } as any,
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
