import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, MessageSquare, ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike, ChevronLeft, ChevronRight, LogOut, Plus, Trash2, Search, CalendarIcon, X, TrendingUp, Equal, Weight, MessageCircle, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import PlanPicker from "@/components/PlanPicker";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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
  skipped: boolean;
  user_comment: string;
}

interface FriendComment {
  id: string;
  author_id: string;
  target_user_id: string;
  week: number;
  day: string;
  comment: string;
  created_at: string;
}

interface CustomExercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  created_by: string;
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

// Format a day key for display - if it looks like an ISO date, format it nicely
const formatDayDisplay = (day: string) => {
  try {
    // Check if it starts with a date pattern (YYYY-MM-DD)
    const dateMatch = day.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const date = parseISO(dateMatch[1]);
      return format(date, "d MMM yyyy", { locale: sv });
    }
  } catch {
    // not a date
  }
  return day;
};

const WorkoutView = ({ userId }: WorkoutViewProps) => {
  const [plans, setPlans] = useState<PlanDay[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"loading" | "choose" | "plan" | "single">("loading");

  // Single workout form
  const [showAddSingle, setShowAddSingle] = useState(false);
  const [singleName, setSingleName] = useState("");
  const [singleDetails, setSingleDetails] = useState("");
  const [singleTempo, setSingleTempo] = useState("");
  const [singleDate, setSingleDate] = useState<Date>(new Date());

  // Exercise browser for single workouts
  const [showExercisePicker, setShowExercisePicker] = useState<string | null>(null); // plan id
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  // Weight selection for exercises
  const [weightDialog, setWeightDialog] = useState<{ planId: string; exerciseName: string; lastWeight: string | null } | null>(null);
  const [weightInput, setWeightInput] = useState("");

  // Friend comments on own workouts
  const [friendComments, setFriendComments] = useState<FriendComment[]>([]);
  const [commentNicknames, setCommentNicknames] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    const [{ data: planData }, { data: compData }, { data: friendCommentsData }] = await Promise.all([
      supabase.from("workout_plans").select("*").eq("user_id", userId).order("week").order("day"),
      supabase.from("workout_completions").select("*").eq("user_id", userId),
      supabase.from("workout_comments").select("*").eq("target_user_id", userId).order("created_at", { ascending: true }),
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
        map[`${c.week}-${c.day}`] = { ...c, skipped: (c as any).skipped || false };
      }
      setCompletions(map);
      const commentMap: Record<string, string> = {};
      for (const c of compData) {
        commentMap[`${c.week}-${c.day}`] = c.user_comment || "";
      }
      setComments((prev) => ({ ...commentMap, ...prev }));
    }

    if (friendCommentsData && friendCommentsData.length > 0) {
      setFriendComments(friendCommentsData);
      const authorIds = [...new Set(friendCommentsData.map((c) => c.author_id))];
      const { data: authorProfiles } = await supabase
        .from("profiles")
        .select("user_id, nickname")
        .in("user_id", authorIds);
      if (authorProfiles) {
        const map: Record<string, string> = {};
        for (const p of authorProfiles) map[p.user_id] = p.nickname;
        setCommentNicknames(map);
      }
    } else {
      setFriendComments([]);
    }
  }, [userId, currentWeek]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (mode === "single") {
      supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
        if (data) setCustomExercises(data);
      });
    }
  }, [mode]);

  const allExercises = [
    ...exerciseLibrary.map((e) => ({ ...e, id: "", isCustom: false })),
    ...customExercises.map((e) => ({ name: e.name, category: e.category, muscleGroup: e.muscle_group, id: e.id, isCustom: true })),
  ];

  const filteredExercises = allExercises.filter((e) => {
    const matchesSearch = !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  const toggleDone = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newDone = !current?.done;

    setCompletions((prev) => ({
      ...prev,
      [key]: { week, day, done: newDone, skipped: false, user_comment: comments[key] || "" },
    }));

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: newDone,
        skipped: false,
        user_comment: comments[key] || "",
      } as any,
      { onConflict: "user_id,week,day" }
    );
  };

  const toggleSkipped = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newSkipped = !current?.skipped;

    setCompletions((prev) => ({
      ...prev,
      [key]: { week, day, done: false, skipped: newSkipped, user_comment: comments[key] || "" },
    }));

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: false,
        skipped: newSkipped,
        user_comment: comments[key] || "",
      } as any,
      { onConflict: "user_id,week,day" }
    );
  };

  const saveComment = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const newText = commentInput[key]?.trim();
    if (!newText) return;

    const existing = comments[key]?.trim();
    const updated = existing ? `${existing}\n${newText}` : newText;

    setComments((prev) => ({ ...prev, [key]: updated }));
    setCommentInput((prev) => ({ ...prev, [key]: "" }));

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: completions[key]?.done || false,
        user_comment: updated,
      },
      { onConflict: "user_id,week,day" }
    );
  };

  const deleteCommentLine = async (week: number, day: string, lineIndex: number) => {
    const key = `${week}-${day}`;
    const lines = (comments[key] || "").split("\n").filter(Boolean);
    lines.splice(lineIndex, 1);
    const updated = lines.join("\n");
    setComments((prev) => ({ ...prev, [key]: updated }));
    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: completions[key]?.done || false,
        user_comment: updated,
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

    // Use date + timestamp for unique day key
    const dateStr = format(singleDate, "yyyy-MM-dd");
    const uniqueKey = `${dateStr}_${Date.now()}`;

    await supabase.from("workout_plans").insert({
      user_id: userId,
      week: 0,
      day: uniqueKey,
      session_name: singleName.trim(),
      details: singleDetails.trim(),
      tempo: singleTempo.trim() || null,
    });

    setSingleName("");
    setSingleDetails("");
    setSingleTempo("");
    setSingleDate(new Date());
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

  // Parse weight from a detail line like "Bänkpress — 80 kg"
  const parseExerciseWeight = (line: string): { name: string; weight: string | null } => {
    const match = line.match(/^(.+?)\s*—\s*(.+)$/);
    if (match) return { name: match[1].trim(), weight: match[2].trim() };
    return { name: line.trim(), weight: null };
  };

  // Find last weight used for an exercise across all single workouts
  const findLastWeight = (exerciseName: string): string | null => {
    const singlePlans = plans.filter(p => p.week === 0);
    for (const plan of singlePlans) {
      if (!plan.details) continue;
      for (const line of plan.details.split("\n")) {
        const { name, weight } = parseExerciseWeight(line);
        if (name.toLowerCase() === exerciseName.toLowerCase() && weight) {
          return weight;
        }
      }
    }
    return null;
  };

  // Open weight dialog when selecting an exercise
  const handleExerciseSelect = (planId: string, exerciseName: string) => {
    const lastWeight = findLastWeight(exerciseName);
    setWeightDialog({ planId, exerciseName, lastWeight });
    setWeightInput(lastWeight || "");
  };

  // Add exercise with weight to plan
  const addExerciseWithWeight = async (useWeight: string | null) => {
    if (!weightDialog) return;
    const plan = plans.find(p => p.id === weightDialog.planId);
    if (!plan) return;

    const entry = useWeight
      ? `${weightDialog.exerciseName} — ${useWeight}`
      : weightDialog.exerciseName;

    const newDetails = plan.details ? `${plan.details}\n${entry}` : entry;

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
    setWeightDialog(null);
    setWeightInput("");
  };

  const addExerciseToPlan = async (plan: PlanDay, exerciseName: string) => {
    const newDetails = plan.details
      ? `${plan.details}\n${exerciseName}`
      : exerciseName;

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);

    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
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
    const singlePlans = plans.filter(p => p.week === 0).sort((a, b) => {
      // Sort by date descending (newest first)
      const dateA = a.day.match(/^(\d{4}-\d{2}-\d{2})/) ? a.day : "0000";
      const dateB = b.day.match(/^(\d{4}-\d{2}-\d{2})/) ? b.day : "0000";
      return dateB.localeCompare(dateA);
    });
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
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={leavePlan}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                title="Rensa alla pass"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <span className="text-[9px] text-muted-foreground leading-tight">Rensa alla</span>
            </div>
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
            const isSkipped = completion?.skipped || false;
            const expanded = expandedDay === key;
            const Icon = getSessionIcon(plan.session_name);
            const colorClass = getSessionColor(plan.session_name);
            const isExercisePickerOpen = showExercisePicker === plan.id;

            return (
              <div
                key={plan.id}
                className={`rounded-lg border bg-card transition-all animate-fade-in ${isDone ? "workout-done opacity-80" : ""} ${isSkipped ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedDay(expanded ? null : key)}>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDone(0, plan.day); }}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"
                      }`}
                      title="Genomfört"
                    >
                      {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSkipped(0, plan.day); }}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isSkipped ? "bg-destructive text-destructive-foreground" : "text-muted-foreground/40 hover:text-destructive"
                      }`}
                      title="Markera som missat"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className={`flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`font-semibold text-sm truncate block ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {plan.session_name}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDayDisplay(plan.day)}
                    </span>
                    {plan.tempo && plan.tempo !== "—" && (
                      <span className="text-xs text-muted-foreground font-mono block">{plan.tempo}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const ownLines = comments[key]?.trim() ? comments[key].trim().split("\n").filter(Boolean).length : 0;
                      const dayFriendComments = friendComments.filter(c => c.week === 0 && c.day === plan.day);
                      const totalComments = ownLines + dayFriendComments.length;
                      return totalComments > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <MessageCircle className="w-3 h-3" /> {totalComments}
                        </span>
                      ) : null;
                    })()}
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
                    {/* Exercises / details */}
                    {plan.details && (
                      <div className="space-y-1">
                        {plan.details.split("\n").filter(Boolean).map((line, i) => {
                          const { name, weight } = parseExerciseWeight(line);
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                              <span className="flex-1">{name}</span>
                              {weight && (
                                <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  {weight}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Weight dialog */}
                    {weightDialog && weightDialog.planId === plan.id && (
                      <div className="bg-secondary/50 rounded-lg p-3 space-y-3 animate-fade-in border border-primary/30">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <Weight className="w-3.5 h-3.5 text-primary" />
                          {weightDialog.exerciseName}
                        </h4>
                        {weightDialog.lastWeight ? (
                          <div className="text-xs text-muted-foreground">
                            Senast: <span className="font-mono text-foreground">{weightDialog.lastWeight}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Ingen tidigare vikt registrerad</div>
                        )}
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">Vikt (t.ex. 80 kg, 3×8 @ 60 kg)</label>
                          <input
                            type="text"
                            value={weightInput}
                            onChange={(e) => setWeightInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && weightInput.trim() && addExerciseWithWeight(weightInput.trim())}
                            placeholder="Ange vikt..."
                            className="w-full bg-background text-foreground text-xs px-3 py-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          {weightDialog.lastWeight && (
                            <button
                              onClick={() => addExerciseWithWeight(weightDialog.lastWeight)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-secondary text-foreground rounded-md text-xs font-medium hover:bg-muted transition-colors"
                            >
                              <Equal className="w-3 h-3" /> Samma vikt
                            </button>
                          )}
                          <button
                            onClick={() => addExerciseWithWeight(weightInput.trim() || null)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium"
                          >
                            {weightInput.trim() ? (
                              <><TrendingUp className="w-3 h-3" /> Spara</>
                            ) : (
                              <>Utan vikt</>
                            )}
                          </button>
                          <button
                            onClick={() => { setWeightDialog(null); setWeightInput(""); }}
                            className="px-2 py-1.5 text-muted-foreground hover:text-foreground text-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add exercise button */}
                    {!isExercisePickerOpen && !weightDialog ? (
                      <button
                        onClick={() => {
                          setShowExercisePicker(plan.id);
                          setExerciseSearch("");
                          setSelectedMuscle(null);
                        }}
                        className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Lägg till övning
                      </button>
                    ) : isExercisePickerOpen && !weightDialog ? (
                      <div className="bg-secondary/50 rounded-lg p-3 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold">Välj övning</h4>
                          <button onClick={() => setShowExercisePicker(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={exerciseSearch}
                            onChange={(e) => setExerciseSearch(e.target.value)}
                            placeholder="Sök övning..."
                            className="w-full bg-background text-foreground text-xs pl-8 pr-3 py-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setSelectedMuscle(null)}
                            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${!selectedMuscle ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                          >
                            Alla
                          </button>
                          {muscleGroups.map((mg) => (
                            <button
                              key={mg}
                              onClick={() => setSelectedMuscle(mg === selectedMuscle ? null : mg)}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${selectedMuscle === mg ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                            >
                              {mg}
                            </button>
                          ))}
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {filteredExercises.map((e, i) => {
                            const lastW = findLastWeight(e.name);
                            return (
                              <button
                                key={`${e.name}-${i}`}
                                onClick={() => handleExerciseSelect(plan.id, e.name)}
                                className="w-full text-left flex items-center justify-between p-1.5 bg-background rounded text-xs hover:bg-primary/10 transition-colors"
                              >
                                <span>{e.name}</span>
                                <div className="flex items-center gap-1.5">
                                  {lastW && (
                                    <span className="text-[10px] font-mono text-primary">{lastW}</span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">{e.muscleGroup}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Friend comments */}
                    {(() => {
                      const dayComments = friendComments.filter(c => c.week === 0 && c.day === plan.day);
                      return dayComments.length > 0 ? (
                        <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                          <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                          </p>
                          {dayComments.map((c) => (
                            <div key={c.id} className="bg-background/80 rounded-md px-3 py-2">
                              <p className="text-xs">
                                <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                                <span className="text-foreground">{c.comment}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(c.created_at).toLocaleDateString("sv-SE")}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    {/* Own comments display */}
                    {comments[key]?.trim() && (
                      <div className="space-y-1">
                        {comments[key].trim().split("\n").filter(Boolean).map((line, i) => (
                          <div key={i} className="bg-accent/30 rounded-lg px-3 py-2 border border-accent/50 flex items-start justify-between gap-2">
                            <p className="text-xs flex items-start gap-1.5 flex-1">
                              <MessageSquare className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                              <span className="text-foreground">{line}</span>
                            </p>
                            <button
                              onClick={() => deleteCommentLine(0, plan.day, i)}
                              className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                              title="Ta bort kommentar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment input */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={commentInput[key] || ""}
                          onChange={(e) => setCommentInput((prev) => ({ ...prev, [key]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && saveComment(0, plan.day)}
                          placeholder="Skriv en kommentar..."
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

        {/* Add single workout form */}
        {showAddSingle ? (
          <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold">Nytt pass</h3>

            {/* Date picker */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 bg-secondary text-foreground text-sm p-2 rounded-md text-left",
                      !singleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    {singleDate ? format(singleDate, "d MMMM yyyy", { locale: sv }) : "Välj datum"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[80]" align="start">
                  <Calendar
                    mode="single"
                    selected={singleDate}
                    onSelect={(date) => date && setSingleDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

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
          <div className="absolute right-14 top-2 flex flex-col items-center gap-0.5">
            <button
              onClick={leavePlan}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Lämna plan"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <span className="text-[9px] text-muted-foreground leading-tight">Avsluta plan</span>
          </div>
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
          const isSkipped = completion?.skipped || false;
          const expanded = expandedDay === key;
          const Icon = getSessionIcon(plan.session_name);
          const colorClass = getSessionColor(plan.session_name);
          const isRest = plan.session_name.toLowerCase().includes("vila") || plan.session_name.toLowerCase().includes("återhämtning");

          return (
            <div
              key={key}
              className={`rounded-lg border bg-card transition-all animate-fade-in ${isDone ? "workout-done opacity-80" : ""} ${isSkipped ? "opacity-60" : ""} ${isRest ? "workout-rest" : ""}`}
            >
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedDay(expanded ? null : key)}>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDone(plan.week, plan.day); }}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"
                    }`}
                    title="Genomfört"
                  >
                    {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSkipped(plan.week, plan.day); }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSkipped ? "bg-destructive text-destructive-foreground" : "text-muted-foreground/40 hover:text-destructive"
                    }`}
                    title="Markera som missat"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
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
                <div className="flex items-center gap-2 text-muted-foreground">
                    {(() => {
                      const ownLines = comments[key]?.trim() ? comments[key].trim().split("\n").filter(Boolean).length : 0;
                      const dayFriendComments = friendComments.filter(c => c.week === plan.week && c.day === plan.day);
                      const totalComments = ownLines + dayFriendComments.length;
                      return totalComments > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full animate-fade-in">
                          <MessageCircle className="w-3 h-3" /> {totalComments}
                        </span>
                      ) : null;
                    })()}
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
              </div>
              {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <p className="text-sm text-foreground leading-relaxed">{plan.details}</p>

                  {/* Friend comments */}
                  {(() => {
                    const dayComments = friendComments.filter(c => c.week === plan.week && c.day === plan.day);
                    return dayComments.length > 0 ? (
                      <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                        </p>
                        {dayComments.map((c) => (
                          <div key={c.id} className="bg-background/80 rounded-md px-3 py-2">
                            <p className="text-xs">
                              <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                              <span className="text-foreground">{c.comment}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(c.created_at).toLocaleDateString("sv-SE")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {/* Own comments display */}
                  {comments[key]?.trim() && (
                    <div className="space-y-1">
                      {comments[key].trim().split("\n").filter(Boolean).map((line, i) => (
                        <div key={i} className="bg-accent/30 rounded-lg px-3 py-2 border border-accent/50 flex items-start justify-between gap-2">
                          <p className="text-xs flex items-start gap-1.5 flex-1">
                            <MessageSquare className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-foreground">{line}</span>
                          </p>
                          <button
                            onClick={() => deleteCommentLine(plan.week, plan.day, i)}
                            className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                            title="Ta bort kommentar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={commentInput[key] || ""}
                        onChange={(e) => setCommentInput((prev) => ({ ...prev, [key]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && saveComment(plan.week, plan.day)}
                        placeholder="Skriv en kommentar..."
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
