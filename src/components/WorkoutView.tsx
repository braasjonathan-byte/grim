import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, MessageSquare, ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike, ChevronLeft, ChevronRight, LogOut, Plus, Trash2 } from "lucide-react";
import PlanPicker from "@/components/PlanPicker";

interface WorkoutViewProps {
  userId: string;
}

interface PlanDay {
  id: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
  tempo: string | null;
}

interface Completion {
  week: number;
  day: string;
  done: boolean;
  user_comment: string;
}

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

const getSessionIcon = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return Dumbbell;
  if (s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel")) return Footprints;
  if (s.includes("cykel") || s.includes("återhämtning") || s.includes("crosstrainer")) return Bike;
  return Moon;
};

const getSessionColor = (session: string) => {
  const s = session.toLowerCase();
  if (s.includes("styrka") || s.includes("tung")) return "text-primary";
  if (s.includes("löpning") || s.includes("tröskel")) return "text-warning";
  if (s.includes("långpass")) return "text-destructive";
  if (s.includes("vila")) return "text-muted-foreground";
  return "text-secondary-foreground";
};

const WorkoutView = ({ userId }: WorkoutViewProps) => {
  const [plans, setPlans] = useState<PlanDay[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"loading" | "choose" | "plan" | "single">("loading");

  // Single workout form
  const [showAddSingle, setShowAddSingle] = useState(false);
  const [singleName, setSingleName] = useState("");
  const [singleDetails, setSingleDetails] = useState("");
  const [singleTempo, setSingleTempo] = useState("");

  const fetchData = useCallback(async () => {
    const [{ data: planData }, { data: compData }] = await Promise.all([
      supabase.from("workout_plans").select("*").eq("user_id", userId).order("week").order("day"),
      supabase.from("workout_completions").select("*").eq("user_id", userId),
    ]);

    if (planData) {
      setPlans(planData);
      const wks = [...new Set(planData.map((p) => p.week))].sort((a, b) => a - b);
      setWeeks(wks);
      if (wks.length > 0 && !wks.includes(currentWeek)) {
        setCurrentWeek(wks[0]);
      }

      if (planData.length === 0) {
        setMode("choose");
      } else {
        const allSingle = planData.every(p => p.week === 0);
        setMode(allSingle ? "single" : "plan");
      }
    } else {
      setMode("choose");
    }

    if (compData) {
      const map: Record<string, Completion> = {};
      for (const c of compData) {
        map[`${c.week}-${c.day}`] = c;
      }
      setCompletions(map);
      const commentMap: Record<string, string> = {};
      for (const c of compData) {
        commentMap[`${c.week}-${c.day}`] = c.user_comment || "";
      }
      setComments((prev) => ({ ...commentMap, ...prev }));
    }
  }, [userId, currentWeek]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleDone = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newDone = !current?.done;

    setCompletions((prev) => ({
      ...prev,
      [key]: { week, day, done: newDone, user_comment: comments[key] || "" },
    }));

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: newDone,
        user_comment: comments[key] || "",
      },
      { onConflict: "user_id,week,day" }
    );
  };

  const saveComment = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: completions[key]?.done || false,
        user_comment: comments[key] || "",
      },
      { onConflict: "user_id,week,day" }
    );
  };

  const leavePlan = async () => {
    if (!confirm("Är du säker? Alla pass och all progress raderas.")) return;
    await Promise.all([
      supabase.from("workout_plans").delete().eq("user_id", userId),
      supabase.from("workout_completions").delete().eq("user_id", userId),
    ]);
    setPlans([]);
    setWeeks([]);
    setCompletions({});
    setMode("choose");
  };

  const addSingleWorkout = async () => {
    if (!singleName.trim()) return;

    const existingSingle = plans.filter(p => p.week === 0);
    const dayKey = `Pass ${existingSingle.length + 1}`;

    await supabase.from("workout_plans").insert({
      user_id: userId,
      week: 0,
      day: dayKey,
      session_name: singleName.trim(),
      details: singleDetails.trim(),
      tempo: singleTempo.trim() || null,
    });

    setSingleName("");
    setSingleDetails("");
    setSingleTempo("");
    setShowAddSingle(false);
    fetchData();
  };

  const deleteSingleWorkout = async (plan: PlanDay) => {
    if (!confirm("Ta bort detta pass?")) return;
    if (plan.id) {
      await supabase.from("workout_plans").delete().eq("id", plan.id);
      await supabase.from("workout_completions").delete()
        .eq("user_id", userId)
        .eq("week", plan.week)
        .eq("day", plan.day);
      fetchData();
    }
  };

  if (mode === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <Dumbbell className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  // Choice screen
  if (mode === "choose") {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <Dumbbell className="w-10 h-10 text-primary mx-auto" />
          <h2 className="text-2xl font-black tracking-tight">Hur vill du träna?</h2>
          <p className="text-sm text-muted-foreground">
            Välj en plan eller skapa enskilda pass
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setMode("plan")}
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all"
          >
            <div className="flex items-start gap-3">
              <ChevronRight className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <h3 className="font-bold text-sm">📋 Följ en plan</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Välj en färdig plan eller bygg ett schema med veckor och dagar
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("single")}
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all"
          >
            <div className="flex items-start gap-3">
              <Plus className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <h3 className="font-bold text-sm">💪 Enskilda pass</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Skapa och bocka av egna pass utan att följa ett veckoschema
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Plan picker
  if (mode === "plan" && weeks.length === 0) {
    return <PlanPicker userId={userId} onDone={fetchData} />;
  }

  // Single workouts mode
  if (mode === "single") {
    const singlePlans = plans.filter(p => p.week === 0);
    const doneCount = singlePlans.filter(p => completions[`0-${p.day}`]?.done).length;

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Mina pass</h2>
            <p className="text-xs text-muted-foreground">
              {doneCount} av {singlePlans.length} avklarade
            </p>
          </div>
          {singlePlans.length > 0 && (
            <button
              onClick={leavePlan}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Rensa alla pass"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {singlePlans.length > 0 && (
          <div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.round((doneCount / singlePlans.length) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {Math.round((doneCount / singlePlans.length) * 100)}% avklarat
            </p>
          </div>
        )}

        <div className="space-y-2">
          {singlePlans.map((plan) => {
            const key = `0-${plan.day}`;
            const completion = completions[key];
            const isDone = completion?.done || false;
            const expanded = expandedDay === key;
            const Icon = getSessionIcon(plan.session_name);
            const colorClass = getSessionColor(plan.session_name);

            return (
              <div
                key={plan.id}
                className={`rounded-lg border bg-card transition-all animate-fade-in ${isDone ? "workout-done opacity-80" : ""}`}
              >
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedDay(expanded ? null : key)}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDone(0, plan.day); }}
                    className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"
                    }`}
                  >
                    {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                  </button>
                  <div className={`flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`font-semibold text-sm truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {plan.session_name}
                    </span>
                    {plan.tempo && plan.tempo !== "—" && (
                      <p className="text-xs text-muted-foreground font-mono">{plan.tempo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSingleWorkout(plan); }}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {expanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {plan.details && <p className="text-sm text-foreground leading-relaxed">{plan.details}</p>}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={comments[key] || ""}
                          onChange={(e) => setComments((prev) => ({ ...prev, [key]: e.target.value }))}
                          onBlur={() => saveComment(0, plan.day)}
                          onKeyDown={(e) => e.key === "Enter" && saveComment(0, plan.day)}
                          placeholder="Lägg till kommentar..."
                          className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showAddSingle ? (
          <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold">Nytt pass</h3>
            <input
              type="text"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="Passnamn (t.ex. Styrka överkropp)"
              className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              autoFocus
            />
            <textarea
              value={singleDetails}
              onChange={(e) => setSingleDetails(e.target.value)}
              placeholder="Detaljer (t.ex. Bänk 5×3 @ RPE 7; Rodd 3×8)"
              rows={3}
              className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
            />
            <input
              type="text"
              value={singleTempo}
              onChange={(e) => setSingleTempo(e.target.value)}
              placeholder="Tempo/RPE (valfritt)"
              className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
            <div className="flex gap-2">
              <button onClick={addSingleWorkout} disabled={!singleName.trim()} className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-40">
                Spara
              </button>
              <button onClick={() => setShowAddSingle(false)} className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm">
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddSingle(true)}
            className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Lägg till pass
          </button>
        )}
      </div>
    );
  }

  // Plan mode (existing)
  const weekDays = plans
    .filter((p) => p.week === currentWeek)
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  const weekIdx = weeks.indexOf(currentWeek);
  const doneCount = weekDays.filter((d) => completions[`${d.week}-${d.day}`]?.done).length;
  const progress = weekDays.length > 0 ? Math.round((doneCount / weekDays.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between relative">
          <button
            onClick={() => weekIdx > 0 && setCurrentWeek(weeks[weekIdx - 1])}
            disabled={weekIdx <= 0}
            className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-2xl font-black tracking-tight">Vecka {currentWeek}</h2>
            <p className="text-sm text-muted-foreground">av {weeks.length} veckor</p>
          </div>
          <button
            onClick={leavePlan}
            className="absolute right-14 top-3 p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            title="Lämna plan"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => weekIdx < weeks.length - 1 && setCurrentWeek(weeks[weekIdx + 1])}
            disabled={weekIdx >= weeks.length - 1}
            className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground text-center">{progress}% avklarat</p>
      </div>

      {/* Week overview */}
      <div className="grid grid-cols-6 gap-1.5">
        {weeks.map((w) => {
          const isCurrent = w === currentWeek;
          return (
            <button
              key={w}
              onClick={() => setCurrentWeek(w)}
              className={`flex flex-col items-center p-2 rounded-md text-xs transition-all ${
                isCurrent
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "bg-secondary text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="font-bold">V{w}</span>
            </button>
          );
        })}
      </div>

      {/* Workout cards */}
      <div className="space-y-2">
        {weekDays.map((plan) => {
          const key = `${plan.week}-${plan.day}`;
          const completion = completions[key];
          const isDone = completion?.done || false;
          const expanded = expandedDay === key;
          const Icon = getSessionIcon(plan.session_name);
          const colorClass = getSessionColor(plan.session_name);
          const isRest = plan.session_name.toLowerCase().includes("vila") || plan.session_name.toLowerCase().includes("återhämtning");

          return (
            <div
              key={key}
              className={`rounded-lg border bg-card transition-all animate-fade-in ${isDone ? "workout-done opacity-80" : ""} ${isRest ? "workout-rest" : ""}`}
            >
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedDay(expanded ? null : key)}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDone(plan.week, plan.day); }}
                  className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                </button>
                <div className={`flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-mono text-muted-foreground uppercase">{plan.day}</span>
                    <span className={`font-semibold text-sm truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {plan.session_name}
                    </span>
                  </div>
                  {plan.tempo && plan.tempo !== "—" && (
                    <span className="text-xs text-muted-foreground font-mono">{plan.tempo}</span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
              {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <p className="text-sm text-foreground leading-relaxed">{plan.details}</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={comments[key] || ""}
                        onChange={(e) => setComments((prev) => ({ ...prev, [key]: e.target.value }))}
                        onBlur={() => saveComment(plan.week, plan.day)}
                        onKeyDown={(e) => e.key === "Enter" && saveComment(plan.week, plan.day)}
                        placeholder="Lägg till kommentar..."
                        className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkoutView;
