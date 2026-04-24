import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Equal, TrendingDown, Star, ChevronDown, Target, X, Calendar, Pencil } from "lucide-react";
import { normalizeExerciseName } from "@/lib/exerciseNormalization";
import { getStrengthPercentile, type StrengthPercentile } from "@/lib/strengthPercentile";

interface PersonalRecordsProps {
  userId: string;
}

interface CompletionRow {
  week: number;
  day: string;
  done: boolean;
  updated_at: string;
  logged_weights: Record<string, number> | null;
}

interface PRRecord {
  exercise: string;
  weight: number;
  date: string;
  week: number;
  trend: "up" | "same" | "down" | "first";
}

interface PRGoal {
  exercise: string;
  target_weight: number;
  target_date: string | null;
}

const PersonalRecords = ({ userId }: PersonalRecordsProps) => {
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [stars, setStars] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState<Map<string, PRGoal>>(new Map());
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [expanded, setExpanded] = useState(false);
  const [goalDialog, setGoalDialog] = useState<{exercise: string;currentWeight: number;} | null>(null);
  const [goalWeight, setGoalWeight] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [editDialog, setEditDialog] = useState<{exercise: string; currentWeight: number;} | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [percentilePopup, setPercentilePopup] = useState<{exercise: string; weight: number; data: StrengthPercentile} | null>(null);

  useEffect(() => {
    // Fetch completions, stars, and goals in parallel
    Promise.all([
    supabase.
    from("workout_completions").
    select("week, day, done, updated_at, logged_weights").
    eq("user_id", userId).
    eq("done", true).
    order("updated_at", { ascending: true }),
    supabase.from("pr_stars").select("exercise").eq("user_id", userId),
    supabase.from("pr_goals").select("exercise, target_weight, target_date").eq("user_id", userId),
    supabase.from("pr_overrides").select("exercise, weight").eq("user_id", userId),
    supabase.from("profiles").select("gender").eq("user_id", userId).single()]
    ).then(([compRes, starsRes, goalsRes, overRes, profileRes]) => {
      if (compRes.data) {
        setCompletions(
          compRes.data.map((c) => ({
            ...c,
            logged_weights: c.logged_weights as Record<string, number> | null
          }))
        );
      }
      if (starsRes.data) {
        setStars(new Set(starsRes.data.map((s) => normalizeExerciseName(s.exercise))));
      }
      if (goalsRes.data) {
        const m = new Map<string, PRGoal>();
        for (const g of goalsRes.data) {
          m.set(normalizeExerciseName(g.exercise), g);
        }
        setGoals(m);
      }
      if (overRes.data) {
        const m = new Map<string, number>();
        for (const o of overRes.data) {
          const key = normalizeExerciseName(o.exercise);
          const existing = m.get(key);
          m.set(key, existing !== undefined ? Math.max(existing, Number(o.weight)) : Number(o.weight));
        }
        setOverrides(m);
      }
      if (profileRes.data?.gender) {
        setGender(profileRes.data.gender);
      }
    });
  }, [userId]);

  const records = useMemo(() => {
    const prMap = new Map<string, {weight: number;date: string;week: number;previousBest: number | null;}>();

    for (const c of completions) {
      if (!c.logged_weights) continue;
      for (const [ex, w] of Object.entries(c.logged_weights)) {
        // Handle legacy format: exerciseName: weight (number)
        if (!ex.startsWith("__")) {
          if (typeof w !== "number" || w <= 0) continue;
          const cleanEx = ex.replace(/( —)+$/, "");
          const normName = normalizeExerciseName(cleanEx);
          const existing = prMap.get(normName);
          if (!existing || w > existing.weight) {
            prMap.set(normName, {
              weight: w,
              date: c.updated_at,
              week: c.week,
              previousBest: existing?.weight ?? null
            });
          }
          continue;
        }
        // Handle modern format: __setdata__exerciseName: [{kg, reps}, ...]
        if (ex.startsWith("__setdata__")) {
          const rawName = ex.replace("__setdata__", "").replace(/( —)+$/, "");
          const exerciseName = normalizeExerciseName(rawName);
          let sets: { kg?: string | number; reps?: string | number }[] = [];
          if (typeof w === "string") {
            try { sets = JSON.parse(w); } catch { continue; }
          } else if (Array.isArray(w)) {
            sets = w;
          } else { continue; }
          const maxKg = Math.max(0, ...sets.map(s => Number(s.kg) || 0));
          if (maxKg <= 0) continue;
          const existing = prMap.get(exerciseName);
          if (!existing || maxKg > existing.weight) {
            prMap.set(exerciseName, {
              weight: maxKg,
              date: c.updated_at,
              week: c.week,
              previousBest: existing?.weight ?? null
            });
          }
        }
      }
    }

    const result: PRRecord[] = [];
    for (const [exercise, data] of prMap) {
      // Apply manual override if it exists and is higher
      const override = overrides.get(exercise);
      const finalWeight = override !== undefined && override > data.weight ? override : data.weight;
      
      let trend: PRRecord["trend"] = "first";
      if (data.previousBest !== null) {
        if (finalWeight > data.previousBest) trend = "up";else
        if (finalWeight === data.previousBest) trend = "same";else
        trend = "down";
      }
      result.push({ exercise, weight: finalWeight, date: data.date, week: data.week, trend });
    }

    // Also add overrides for exercises not in completions
    for (const [exercise, weight] of overrides) {
      if (!prMap.has(exercise)) {
        result.push({ exercise, weight, date: new Date().toISOString(), week: 0, trend: "first" });
      }
    }

    // Sort: starred first, then by weight
    return result.sort((a, b) => {
      const aStarred = stars.has(a.exercise) ? 1 : 0;
      const bStarred = stars.has(b.exercise) ? 1 : 0;
      if (aStarred !== bStarred) return bStarred - aStarred;
      return b.weight - a.weight;
    });
  }, [completions, stars, overrides]);

  const toggleStar = async (exercise: string) => {
    const newStars = new Set(stars);
    if (newStars.has(exercise)) {
      newStars.delete(exercise);
      await supabase.from("pr_stars").delete().eq("user_id", userId).eq("exercise", exercise);
    } else {
      newStars.add(exercise);
      await supabase.from("pr_stars").insert({ user_id: userId, exercise });
    }
    setStars(newStars);
  };

  const saveOverride = async () => {
    if (!editDialog || !editWeight.trim()) return;
    const w = parseFloat(editWeight);
    if (isNaN(w) || w <= 0) return;

    await supabase.from("pr_overrides").upsert(
      { user_id: userId, exercise: editDialog.exercise, weight: w },
      { onConflict: "user_id,exercise" }
    );

    setOverrides((prev) => {
      const m = new Map(prev);
      m.set(editDialog.exercise, w);
      return m;
    });
    setEditDialog(null);
    setEditWeight("");
  };

  const removeOverride = async (exercise: string) => {
    await supabase.from("pr_overrides").delete().eq("user_id", userId).eq("exercise", exercise);
    setOverrides((prev) => {
      const m = new Map(prev);
      m.delete(exercise);
      return m;
    });
  };

  const saveGoal = async () => {
    if (!goalDialog || !goalWeight.trim()) return;
    const tw = parseFloat(goalWeight);
    if (isNaN(tw) || tw <= 0) return;

    const targetDate = goalDate || null;

    await supabase.from("pr_goals").upsert(
      {
        user_id: userId,
        exercise: goalDialog.exercise,
        target_weight: tw,
        target_date: targetDate
      },
      { onConflict: "user_id,exercise" }
    );

    setGoals((prev) => {
      const m = new Map(prev);
      m.set(goalDialog.exercise, { exercise: goalDialog.exercise, target_weight: tw, target_date: targetDate });
      return m;
    });
    setGoalDialog(null);
    setGoalWeight("");
    setGoalDate("");
  };

  const removeGoal = async (exercise: string) => {
    await supabase.from("pr_goals").delete().eq("user_id", userId).eq("exercise", exercise);
    setGoals((prev) => {
      const m = new Map(prev);
      m.delete(exercise);
      return m;
    });
  };

  if (records.length === 0) return null;

  const displayRecords = expanded ? records : records.slice(0, 4);

  const TrendIcon = ({ trend }: {trend: PRRecord["trend"];}) => {
    if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-success" />;
    if (trend === "same") return <Equal className="w-3.5 h-3.5 text-muted-foreground" />;
    if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
    return <Trophy className="w-3.5 h-3.5 text-warning" />;
  };

  return (
    <div className="space-y-3 bg-secondary">
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 group w-full text-left">

        <Trophy className="w-5 h-5 text-warning" />
        <h3 className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors">
          Personliga rekord
        </h3>
        <span className="text-xs text-muted-foreground ml-1">({records.length})</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />

      </button>

      <div className="grid grid-cols-2 gap-2">
        {displayRecords.map((pr) => {
          const goal = goals.get(pr.exercise);
          const goalProgress = goal ? Math.min(100, Math.round(pr.weight / goal.target_weight * 100)) : null;

          return (
            <div
              key={pr.exercise}
              className="border border-border rounded-lg p-3 space-y-1 relative bg-secondary">

              {/* Star button */}
              <button
                onClick={(e) => {e.stopPropagation();toggleStar(pr.exercise);}}
                className="absolute top-2 right-2">

                <Star
                  className={`w-3.5 h-3.5 transition-colors ${
                  stars.has(pr.exercise) ?
                  "text-warning fill-warning" :
                  "text-muted-foreground/30 hover:text-muted-foreground"}`
                  } />

              </button>

              <div className="flex items-center gap-1 pr-5">
                <span className="text-[10px] text-muted-foreground font-medium truncate flex-1">
                  {pr.exercise}
                </span>
                <TrendIcon trend={pr.trend} />
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const data = getStrengthPercentile(pr.exercise, pr.weight, gender);
                  if (data) {
                    setPercentilePopup({ exercise: pr.exercise, weight: pr.weight, data });
                  }
                }}
                className="text-left group/weight"
              >
                <p className="text-xl font-black group-hover/weight:text-primary transition-colors">
                  {pr.weight} <span className="text-xs font-normal text-muted-foreground">kg</span>
                </p>
              </button>

              {/* Goal progress */}
              {goal &&
              <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">
                      Mål: {goal.target_weight} kg
                    </span>
                    {goal.target_date &&
                  <span className="text-[9px] text-muted-foreground">
                        {new Date(goal.target_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                      </span>
                  }
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div
                    className={`h-full rounded-full transition-all duration-300 ${
                    goalProgress! >= 100 ? "bg-success" : "bg-primary"}`
                    }
                    style={{ width: `${goalProgress}%` }} />

                  </div>
                </div>
              }

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {pr.week > 0 ? `V${pr.week} · ` : ""}{new Date(pr.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditDialog({ exercise: pr.exercise, currentWeight: pr.weight });
                      setEditWeight(pr.weight.toString());
                    }}
                    className="text-muted-foreground/50 hover:text-primary transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setGoalDialog({ exercise: pr.exercise, currentWeight: pr.weight });
                      setGoalWeight(goal?.target_weight?.toString() || "");
                      setGoalDate(goal?.target_date || "");
                    }}
                    className="text-muted-foreground/50 hover:text-primary transition-colors">
                    <Target className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              </div>
            </div>);

        })}
      </div>

      {!expanded && records.length > 4 &&
      <button
        onClick={() => setExpanded(true)}
        className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors py-1">

          Visa alla {records.length} rekord ↓
        </button>
      }

      {/* Goal dialog */}
      {goalDialog &&
      <>
          <div className="fixed inset-0 bg-black/60 z-[70]" onClick={() => setGoalDialog(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[80] max-w-sm mx-auto bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold">Sätt mål</h3>
              </div>
              <button onClick={() => setGoalDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{goalDialog.exercise}</p>
                <p className="text-sm text-muted-foreground">
                  Nuvarande PB: <span className="font-bold text-foreground">{goalDialog.currentWeight} kg</span>
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Målvikt (kg)</label>
                <input
                type="number"
                inputMode="decimal"
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value)}
                placeholder="t.ex. 100"
                className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                autoFocus />

              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Måldatum (valfritt)
                </label>
                <input
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary" />

              </div>

              <div className="flex gap-2">
                <button
                onClick={saveGoal}
                disabled={!goalWeight.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">

                  Spara mål
                </button>
                {goals.has(goalDialog.exercise) &&
              <button
                onClick={() => {
                  removeGoal(goalDialog.exercise);
                  setGoalDialog(null);
                }}
                className="px-3 py-2.5 bg-destructive/10 text-destructive text-sm font-semibold rounded-lg hover:bg-destructive/20 transition-colors">

                    Ta bort
                  </button>
              }
              </div>
            </div>
          </div>
        </>
      }

      {/* Edit PR dialog */}
      {editDialog &&
      <>
          <div className="fixed inset-0 bg-black/60 z-[70]" onClick={() => setEditDialog(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[80] max-w-sm mx-auto bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold">Justera PB</h3>
              </div>
              <button onClick={() => setEditDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{editDialog.exercise}</p>
                <p className="text-sm text-muted-foreground">
                  Nuvarande PB: <span className="font-bold text-foreground">{editDialog.currentWeight} kg</span>
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Ny vikt (kg)</label>
                <input
                type="number"
                inputMode="decimal"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                placeholder="t.ex. 120"
                className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                autoFocus />
              </div>

              <div className="flex gap-2">
                <button
                onClick={saveOverride}
                disabled={!editWeight.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity">
                  Spara
                </button>
                {overrides.has(editDialog.exercise) &&
              <button
                onClick={() => {
                  removeOverride(editDialog.exercise);
                  setEditDialog(null);
                  setEditWeight("");
                }}
                className="px-3 py-2.5 bg-destructive/10 text-destructive text-sm font-semibold rounded-lg hover:bg-destructive/20 transition-colors">
                    Återställ
                  </button>
              }
              </div>
            </div>
          </div>
        </>
      }

      {/* Strength percentile popup */}
      {percentilePopup && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[70]" onClick={() => setPercentilePopup(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[80] max-w-sm mx-auto bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg">{percentilePopup.data.emoji}</span>
                <h3 className="text-sm font-bold">Styrkenivå</h3>
              </div>
              <button onClick={() => setPercentilePopup(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">{percentilePopup.exercise}</p>
                <p className="text-3xl font-black">{percentilePopup.weight} <span className="text-base font-normal text-muted-foreground">kg</span></p>
              </div>

              {/* Percentile bar */}
              <div className="space-y-2">
                <div className="w-full bg-secondary rounded-full h-3 overflow-hidden relative">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
                    style={{ width: `${percentilePopup.data.percentile}%` }}
                  />
                </div>
                <p className="text-center text-sm font-semibold text-foreground">
                  {percentilePopup.data.description}
                </p>
                <p className="text-center text-[10px] text-muted-foreground">
                  Baserat på {gender === "kvinna" || gender === "female" || gender === "f" ? "kvinnor" : "män"} i världens befolkning (uppskattning)
                </p>
              </div>

              <button
                onClick={() => setPercentilePopup(null)}
                className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Stäng
              </button>
            </div>
          </div>
        </>
      )}
    </div>);

};

export default PersonalRecords;