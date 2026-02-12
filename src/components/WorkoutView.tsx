import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, MessageSquare, ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
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
    }

    if (compData) {
      const map: Record<string, Completion> = {};
      for (const c of compData) {
        map[`${c.week}-${c.day}`] = c;
      }
      setCompletions(map);
      // Initialize comments
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

  const weekDays = plans
    .filter((p) => p.week === currentWeek)
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  const weekIdx = weeks.indexOf(currentWeek);

  const toggleDone = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newDone = !current?.done;

    // Optimistic update
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

  const doneCount = weekDays.filter((d) => completions[`${d.week}-${d.day}`]?.done).length;
  const progress = weekDays.length > 0 ? Math.round((doneCount / weekDays.length) * 100) : 0;

  const leavePlan = async () => {
    if (!confirm("Är du säker? Hela ditt schema och all progress raderas.")) return;
    await Promise.all([
      supabase.from("workout_plans").delete().eq("user_id", userId),
      supabase.from("workout_completions").delete().eq("user_id", userId),
    ]);
    setPlans([]);
    setWeeks([]);
    setCompletions({});
  };

  if (weeks.length === 0) {
    return <PlanPicker userId={userId} onDone={fetchData} />;
  }

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
