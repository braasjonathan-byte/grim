import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, MessageSquare, ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike, ChevronLeft, ChevronRight, LogOut, Plus, Trash2, Search, CalendarIcon, X, TrendingUp, Equal, Weight, MessageCircle, XCircle, Timer, Route, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import PlanPicker from "@/components/PlanPicker";
import ReplacementWorkoutDialog from "@/components/ReplacementWorkoutDialog";
import WorkoutLogDialog from "@/components/WorkoutLogDialog";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { notifyFriendsOfCompletion } from "@/hooks/usePushNotifications";
import ExerciseInfoDialog from "@/components/ExerciseInfoDialog";
import FireworksOverlay from "@/components/FireworksOverlay";
import { Checkbox } from "@/components/ui/checkbox";

const toTitleCase = (str: string): string =>
  str.replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());

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
  logged_tempo?: string | null;
  logged_pulse?: number | null;
  logged_distance_km?: number | null;
  logged_weights?: Record<string, number> | null;
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
  }return day;
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
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [showCopyPicker, setShowCopyPicker] = useState(false);

  // Exercise browser for single workouts
  const [showExercisePicker, setShowExercisePicker] = useState<string | null>(null); // plan id
  const [isWarmupMode, setIsWarmupMode] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [showAddCustomExercise, setShowAddCustomExercise] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCategory, setNewExCategory] = useState("styrka");
  const [newExMuscle, setNewExMuscle] = useState("Helkropp");

  // Weight/reps/sets selection for exercises
  const [weightDialog, setWeightDialog] = useState<{planId: string;exerciseName: string;lastWeight: string | null;} | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("10");
  const [setsInput, setSetsInput] = useState("3");

  // Inline editing of existing exercise
  const [editingExercise, setEditingExercise] = useState<{planId: string;lineIndex: number;name: string;sets: string;reps: string;weight: string;} | null>(null);

  // Conditioning exercise dialog
  const [conditioningDialog, setConditioningDialog] = useState<{planId: string;exerciseName: string;} | null>(null);
  const [condTempoInput, setCondTempoInput] = useState("");
  const [condTimeInput, setCondTimeInput] = useState("");
  const [condDistanceInput, setCondDistanceInput] = useState("");

  // Friend comments on own workouts
  const [friendComments, setFriendComments] = useState<FriendComment[]>([]);
  const [commentNicknames, setCommentNicknames] = useState<Record<string, string>>({});

  // Replacement workout dialog state
  const [replacementTarget, setReplacementTarget] = useState<{planId: string;sessionName: string;week: number;day: string;} | null>(null);
  const [runLogTarget, setRunLogTarget] = useState<{week: number;day: string;sessionName: string;details: string;} | null>(null);

  // Exercise info dialog
  const [exerciseInfoName, setExerciseInfoName] = useState<string | null>(null);

  // Fireworks celebration
  const [showFireworks, setShowFireworks] = useState(false);


  const fetchData = useCallback(async () => {
    const [{ data: planData }, { data: compData }, { data: friendCommentsData }] = await Promise.all([
    supabase.from("workout_plans").select("*").eq("user_id", userId).order("week").order("day"),
    supabase.from("workout_completions").select("*").eq("user_id", userId),
    supabase.from("workout_comments").select("*").eq("target_user_id", userId).order("created_at", { ascending: true })]
    );

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
        const allSingle = planData.every((p) => p.week === 0);
        setMode(allSingle ? "single" : "plan");
      }
    } else {
      setMode("choose");
    }

    if (compData) {
      const map: Record<string, Completion> = {};
      for (const c of compData) {
        map[`${c.week}-${c.day}`] = {
          ...c,
          skipped: (c as any).skipped || false,
          logged_weights: c.logged_weights as Record<string, number> | null
        };
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
      const { data: authorProfiles } = await supabase.
      from("profiles").
      select("user_id, nickname").
      in("user_id", authorIds);
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
    if (mode === "single" || mode === "plan") {
      supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
        if (data) setCustomExercises(data);
      });
    }
  }, [mode]);

  const allExercises = [
  ...exerciseLibrary.map((e) => ({ ...e, id: "", isCustom: false })),
  ...customExercises.map((e) => ({ name: e.name, category: e.category, muscleGroup: e.muscle_group, id: e.id, isCustom: true }))];


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
      [key]: { week, day, done: newDone, skipped: false, user_comment: comments[key] || "" }
    }));

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: newDone,
        skipped: false,
        user_comment: comments[key] || ""
      } as any,
      { onConflict: "user_id,week,day" }
    );

    // Send push notification to friends
    if (newDone) {
      const plan = plans.find((p) => p.week === week && p.day === day);
      notifyFriendsOfCompletion(day, week, plan?.session_name || day);

      // Check if all days in this week are now completed (plan mode only)
      if (week > 0) {
        const weekPlans = plans.filter((p) => p.week === week);
        const updatedCompletions = { ...completions, [key]: { week, day, done: true, skipped: false, user_comment: comments[key] || "" } };
        const allDone = weekPlans.every((p) => {
          const k = `${p.week}-${p.day}`;
          return updatedCompletions[k]?.done;
        });
        if (allDone) {
          setShowFireworks(true);
        }
      }
    }
  };

  const toggleSkipped = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newSkipped = !current?.skipped;

    setCompletions((prev) => ({
      ...prev,
      [key]: { week, day, done: false, skipped: newSkipped, user_comment: comments[key] || "" }
    }));

    await supabase.from("workout_completions").upsert(
      {
        user_id: userId,
        week,
        day,
        done: false,
        skipped: newSkipped,
        user_comment: comments[key] || ""
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
        user_comment: updated
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
        user_comment: updated
      },
      { onConflict: "user_id,week,day" }
    );
  };

  // Set completion tracking helpers
  const getSetsDone = (weekDayKey: string, exerciseName: string): string => {
    const comp = completions[weekDayKey];
    const weights = comp?.logged_weights as Record<string, any> | null;
    return (weights?.[`__sets__${exerciseName}`] as string) || "";
  };

  const toggleSetDone = async (week: number, day: string, exerciseName: string, setIndex: number, totalSets: number) => {
    const k = `${week}-${day}`;
    const current = getSetsDone(k, exerciseName);
    const arr = Array.from({ length: totalSets }, (_, i) => current[i] === "1");
    arr[setIndex] = !arr[setIndex];
    const setsStr = arr.map(b => b ? "1" : "0").join("");

    const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
    const updated = { ...existing, [`__sets__${exerciseName}`]: setsStr };

    setCompletions(prev => ({
      ...prev,
      [k]: { ...prev[k], week, day, done: prev[k]?.done || false, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
    }));

    await supabase.from("workout_completions").upsert({
      user_id: userId, week, day,
      done: completions[k]?.done || false,
      skipped: completions[k]?.skipped || false,
      logged_weights: updated
    } as any, { onConflict: "user_id,week,day" });
  };

  // Get per-set logged data (kg/reps)
  const getSetData = (weekDayKey: string, exerciseName: string): Array<{kg: string; reps: string}> => {
    const comp = completions[weekDayKey];
    const weights = comp?.logged_weights as Record<string, any> | null;
    const raw = weights?.[`__setdata__${exerciseName}`];
    if (raw) {
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
      }
      if (Array.isArray(raw)) return raw;
    }
    return [];
  };

  const saveSetFieldData = async (week: number, day: string, exerciseName: string, setIndex: number, field: 'kg' | 'reps', value: string, totalSets: number, defaultKg: string, defaultReps: string) => {
    const k = `${week}-${day}`;
    const currentData = getSetData(k, exerciseName);
    const data = Array.from({ length: totalSets }, (_, i) => currentData[i] || { kg: defaultKg, reps: defaultReps });
    data[setIndex] = { ...data[setIndex], [field]: value };
    
    const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
    const updated = { ...existing, [`__setdata__${exerciseName}`]: JSON.stringify(data) };
    
    setCompletions(prev => ({
      ...prev,
      [k]: { ...prev[k], week, day, done: prev[k]?.done || false, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
    }));
    
    await supabase.from("workout_completions").upsert({
      user_id: userId, week, day,
      done: completions[k]?.done || false,
      skipped: completions[k]?.skipped || false,
      logged_weights: updated
    } as any, { onConflict: "user_id,week,day" });
  };

  // Extract RPE from exercise text
  const extractRpe = (text: string): { clean: string; rpe: string | null } => {
    const m = text.match(/(?:\s*@\s*|\s+)RPE\s*([\d.]+)/i);
    if (m) return { clean: text.replace(m[0], '').trim(), rpe: `RPE ${m[1]}` };
    return { clean: text, rpe: null };
  };

  // Helper: parse tempo string like "5:30" to seconds
  const tempoToSeconds = (t: string): number | null => {
    const m = t.match(/^(\d+)[:\.](\d+)$/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
    const m2 = t.match(/^(\d+)$/);
    if (m2) return parseInt(m2[1]) * 60;
    return null;
  };

  // Helper: seconds back to "m:ss"
  const secondsToTempo = (s: number): string => {
    const totalSec = Math.round(s);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  // Adaptive progression: adjust ALL future weeks based on logged results
  const adaptProgression = useCallback(async () => {
    if (mode !== "plan" || weeks.length === 0) return;

    // Fetch ALL completed logs (not just current week)
    const { data: loggedData } = await supabase.
    from("workout_completions").
    select("*").
    eq("user_id", userId).
    eq("done", true);

    if (!loggedData || loggedData.length === 0) return;

    // Find the highest week with a completed session
    const maxLoggedWeek = Math.max(...loggedData.map((l) => l.week));

    // Fetch ALL plans after the latest logged week for continuous progression
    const { data: futurePlans } = await supabase.
    from("workout_plans").
    select("*").
    eq("user_id", userId).
    gt("week", maxLoggedWeek);

    if (!futurePlans || futurePlans.length === 0) return;

    // Fetch all plans to match logged data to session types
    const { data: allPlans } = await supabase.
    from("workout_plans").
    select("*").
    eq("user_id", userId);

    // Build weight history per exercise (latest logged weight)
    const latestWeight: Record<string, number> = {};
    const sortedLogs = [...loggedData].sort((a, b) => a.week - b.week);

    // Build running performance history: latest logged tempo & distance per session type
    const latestRunTempo: Record<string, number> = {}; // session_name -> seconds per km
    const latestRunDistance: Record<string, number> = {}; // session_name -> km

    for (const log of sortedLogs) {
      // Weights
      const weights = log.logged_weights as Record<string, number> | null;
      if (weights) {
        for (const [ex, w] of Object.entries(weights)) {
          latestWeight[ex] = w as number;
        }
      }

      // Running: match log to its plan session to get session_name
      if (log.logged_tempo || log.logged_distance_km) {
        const matchingPlan = allPlans?.find(
          (p) => p.week === log.week && p.day === log.day
        );
        if (matchingPlan) {
          const sn = matchingPlan.session_name.toLowerCase();
          const isRun = sn.includes("löpning") || sn.includes("jogg") || sn.includes("långpass") || sn.includes("tröskel");
          if (isRun) {
            if (log.logged_tempo) {
              const secs = tempoToSeconds(log.logged_tempo);
              if (secs) latestRunTempo[matchingPlan.session_name] = secs;
            }
            if (log.logged_distance_km) {
              latestRunDistance[matchingPlan.session_name] = Number(log.logged_distance_km);
            }
          }
        }
      }
    }

    const updates: {id: string;details: string;tempo: string | null;}[] = [];
    for (const plan of futurePlans) {
      let details = plan.details;
      let tempo = plan.tempo;
      let changed = false;

      // --- Strength progression ---
      for (const [exercise, lastW] of Object.entries(latestWeight)) {
        const escaped = exercise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped}[^;\\n]*?)\\b(\\d+(?:[.,]\\d+)?)\\s*kg`, "gi");
        details = details.replace(regex, (_match, prefix, oldWeight) => {
          const old = parseFloat(oldWeight.replace(",", "."));
          if (old > 0 && lastW > 0) {
            changed = true;
            const step = 2.5;
            const adjusted = Math.round((lastW + step) / step) * step;
            return `${prefix}${adjusted}kg`;
          }
          return _match;
        });
      }

      // --- Running progression ---
      const sn = plan.session_name.toLowerCase();
      const isRunPlan = sn.includes("löpning") || sn.includes("jogg") || sn.includes("långpass") || sn.includes("tröskel");
      if (isRunPlan) {
        // Find best matching logged session by name similarity
        const matchKey = Object.keys(latestRunTempo).find(
          (k) => k.toLowerCase() === plan.session_name.toLowerCase()
        ) || Object.keys(latestRunTempo).find((k) => {
          const kl = k.toLowerCase();
          return kl.includes("tröskel") && sn.includes("tröskel") ||
          kl.includes("långpass") && sn.includes("långpass") ||
          kl.includes("jogg") && sn.includes("jogg");
        });

        // Adjust tempo range based on logged tempo – progressive per week
        if (matchKey && latestRunTempo[matchKey] && tempo) {
          const loggedSecs = latestRunTempo[matchKey];
          // Parse existing tempo range like "6:31–6:49"
          const tempoRangeMatch = tempo.match(/(\d+:\d+)\s*[–-]\s*(\d+:\d+)/);
          if (tempoRangeMatch) {
            const oldLow = tempoToSeconds(tempoRangeMatch[1]);
            const oldHigh = tempoToSeconds(tempoRangeMatch[2]);
            if (oldLow && oldHigh) {
              const rangeSpread = oldHigh - oldLow;
              // Progressive: each week beyond maxLoggedWeek gets incrementally faster
              const weeksAhead = plan.week - maxLoggedWeek;
              const shiftPerWeek = 2; // 2 sec faster per km per week
              const totalShift = weeksAhead * shiftPerWeek;
              const newCenter = loggedSecs - totalShift;
              const newLow = Math.max(newCenter - Math.floor(rangeSpread / 2), 120); // min 2:00/km
              const newHigh = newLow + rangeSpread;
              const newTempo = `${secondsToTempo(newLow)}–${secondsToTempo(newHigh)}`;
              if (newTempo !== tempo) {
                tempo = newTempo;
                changed = true;
              }
            }
          }
        }

        // Adjust distance in details based on logged distance (for Långpass-type)
        const distMatchKey = Object.keys(latestRunDistance).find(
          (k) => k.toLowerCase() === plan.session_name.toLowerCase()
        ) || Object.keys(latestRunDistance).find((k) => {
          const kl = k.toLowerCase();
          return kl.includes("långpass") && sn.includes("långpass");
        });

        if (distMatchKey && latestRunDistance[distMatchKey]) {
          const loggedDist = latestRunDistance[distMatchKey];
          // Replace distance in details like "8 km" → based on logged + small increment
          const distRegex = /(\d+(?:[.,]\d+)?)\s*km/i;
          const distMatch = details.match(distRegex);
          if (distMatch) {
            const oldDist = parseFloat(distMatch[1].replace(",", "."));
            if (oldDist > 0) {
              // If user ran more than planned, bump future by 0.5-1 km
              const increment = loggedDist >= oldDist ? 0.5 : 0;
              const newDist = Math.round((loggedDist + increment) * 2) / 2; // round to 0.5
              if (newDist !== oldDist) {
                details = details.replace(distRegex, `${newDist} km`);
                changed = true;
              }
            }
          }
        }
      }

      if (changed) {
        updates.push({ id: plan.id, details, tempo });
      }
    }

    for (const upd of updates) {
      await supabase.from("workout_plans").update({ details: upd.details, tempo: upd.tempo }).eq("id", upd.id);
    }

    if (updates.length > 0) {
      fetchData();
    }
  }, [userId, mode, weeks, fetchData]);

  useEffect(() => {
    adaptProgression();
  }, [currentWeek, adaptProgression]);

  const leavePlan = async () => {
    if (!confirm("Är du säker? Alla pass och all progress raderas.")) return;
    await Promise.all([
    supabase.from("workout_plans").delete().eq("user_id", userId),
    supabase.from("workout_completions").delete().eq("user_id", userId)]
    );
    setPlans([]);
    setWeeks([]);
    setCompletions({});
    setMode("choose");
  };

  const addSingleWorkout = async (copyFrom?: PlanDay) => {
    const name = copyFrom ? copyFrom.session_name : singleName.trim();
    if (!name) return;

    // Use date + timestamp for unique day key
    const dateStr = format(singleDate, "yyyy-MM-dd");
    const uniqueKey = `${dateStr}_${Date.now()}`;

    // Copy details as-is (no progression for single sessions)
    let details = "";
    if (copyFrom && copyFrom.details) {
      details = copyFrom.details;
    }

    await supabase.from("workout_plans").insert({
      user_id: userId,
      week: 0,
      day: uniqueKey,
      session_name: name,
      details,
      tempo: null
    });

    setSingleName("");
    setSingleDate(new Date());
    setShowAddSingle(false);
    setShowCopyPicker(false);
    fetchData();
  };

  const deleteSingleWorkout = async (plan: PlanDay) => {
    if (!confirm("Ta bort detta pass?")) return;
    if (plan.id) {
      await supabase.from("workout_plans").delete().eq("id", plan.id);
      await supabase.from("workout_completions").delete().
      eq("user_id", userId).
      eq("week", plan.week).
      eq("day", plan.day);
      fetchData();
    }
  };

  // Parse weight from a detail line like "Bänkpress — 80 kg"
  const parseExerciseWeight = (line: string): {name: string;weight: string | null;} => {
    const match = line.match(/^(.+?)\s*—\s*(.+)$/);
    if (match) return { name: match[1].trim(), weight: match[2].trim() };
    return { name: line.trim(), weight: null };
  };

  // Find last weight used for an exercise across all single workouts
  const findLastWeight = (exerciseName: string): string | null => {
    const singlePlans = plans.filter((p) => p.week === 0);
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
    // Check if exercise is conditioning type
    const exercise = allExercises.find((e) => e.name === exerciseName);
    if (exercise && exercise.category === "kondition") {
      setConditioningDialog({ planId, exerciseName });
      setCondTempoInput("");
      setCondTimeInput("");
      setCondDistanceInput("");
      return;
    }
    const lastWeight = findLastWeight(exerciseName);
    setWeightDialog({ planId, exerciseName, lastWeight });
    setWeightInput(lastWeight?.replace(/.*@\s*/, "").replace(/\s*kg.*/, "") || "");
    setRepsInput("10");
    setSetsInput("3");
  };

  // Add exercise with reps, sets & weight to plan
  const addExerciseWithWeight = async (useWeight: string | null) => {
    if (!weightDialog) return;
    const plan = plans.find((p) => p.id === weightDialog.planId);
    if (!plan) return;

    const sets = parseInt(setsInput) || 3;
    const reps = parseInt(repsInput) || 10;
    const weightStr = useWeight ? useWeight.replace(/\s*kg\s*$/i, "").trim() : null;

    const entry = weightStr ?
    `${weightDialog.exerciseName} — ${sets}×${reps} @ ${weightStr} kg` :
    `${weightDialog.exerciseName} — ${sets}×${reps}`;

    const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
    const newDetails = isWarmupMode
      ? (plan.details ? `${entry}${joinSep}${plan.details}` : entry)
      : (plan.details ? `${plan.details}${joinSep}${entry}` : entry);

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    setWeightDialog(null);
    setWeightInput("");
    setRepsInput("10");
    setSetsInput("3");
    setIsWarmupMode(false);
  };

  // Add conditioning exercise with tempo, time, distance
  const addConditioningExercise = async () => {
    if (!conditioningDialog) return;
    const plan = plans.find((p) => p.id === conditioningDialog.planId);
    if (!plan) return;

    const parts: string[] = [conditioningDialog.exerciseName];
    const infoParts: string[] = [];
    if (condTimeInput.trim()) infoParts.push(`${condTimeInput.trim()} min`);
    if (condTempoInput.trim()) infoParts.push(`${condTempoInput.trim()}/km`);
    if (condDistanceInput.trim()) infoParts.push(`${condDistanceInput.trim()} km`);
    
    const entry = infoParts.length > 0 ? `${conditioningDialog.exerciseName} — ${infoParts.join(", ")}` : conditioningDialog.exerciseName;

    const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
    const newDetails = isWarmupMode
      ? (plan.details ? `${entry}${joinSep}${plan.details}` : entry)
      : (plan.details ? `${plan.details}${joinSep}${entry}` : entry);

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    setConditioningDialog(null);
    setCondTempoInput("");
    setCondTimeInput("");
    setCondDistanceInput("");
    setIsWarmupMode(false);
  };

  const addExerciseToPlan = async (plan: PlanDay, exerciseName: string) => {
    const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
    const newDetails = plan.details ?
    `${plan.details}${joinSep}${exerciseName}` :
    exerciseName;

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);

    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
  };

  // Save edited exercise line (sets/reps/weight)
  const saveEditedExercise = async () => {
    if (!editingExercise) return;
    const plan = plans.find((p) => p.id === editingExercise.planId);
    if (!plan) return;

    const sets = parseInt(editingExercise.sets) || 3;
    const reps = parseInt(editingExercise.reps) || 10;
    const w = editingExercise.weight.trim();

    // Check if the original line had structured format (with —)
    const originalLines = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
    const originalLine = originalLines[editingExercise.lineIndex] || "";
    const hadStructuredFormat = originalLine.includes("—");

    let entry: string;
    if (hadStructuredFormat || w) {
      entry = w
        ? `${editingExercise.name} — ${sets}×${reps} @ ${w} kg`
        : `${editingExercise.name} — ${sets}×${reps}`;
    } else {
      entry = editingExercise.name;
    }

    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
    lines[editingExercise.lineIndex] = entry;
    const newDetails = lines.join(separator);

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    setEditingExercise(null);
  };

  if (mode === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <Dumbbell className="w-8 h-8 text-primary animate-pulse" />
      </div>);

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
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all">

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
            className="w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-all">

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
      </div>);

  }

  // Plan picker
  if (mode === "plan" && weeks.length === 0) {
    return <PlanPicker userId={userId} onDone={fetchData} />;
  }

  // Single workouts mode
  if (mode === "single") {
    const singlePlans = plans.filter((p) => p.week === 0).sort((a, b) => {
      // Sort by date descending (newest first)
      const dateA = a.day.match(/^(\d{4}-\d{2}-\d{2})/) ? a.day : "0000";
      const dateB = b.day.match(/^(\d{4}-\d{2}-\d{2})/) ? b.day : "0000";
      return dateB.localeCompare(dateA);
    });
    const doneCount = singlePlans.filter((p) => completions[`0-${p.day}`]?.done).length;

    return (
      <>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Mina pass</h2>
            <p className="text-xs text-muted-foreground">
              {doneCount} av {singlePlans.length} avklarade
            </p>
          </div>
          {singlePlans.length > 0 &&
          <div className="flex flex-col items-center gap-0.5">
              <button
              onClick={leavePlan}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              title="Rensa alla pass">

                <LogOut className="w-4 h-4" />
              </button>
              <span className="text-[9px] text-muted-foreground leading-tight">Rensa alla</span>
            </div>
          }
        </div>

        {singlePlans.length > 0 &&
        <div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.round(doneCount / singlePlans.length * 100)}%` }} />

            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {Math.round(doneCount / singlePlans.length * 100)}% avklarat
            </p>
          </div>
        }

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
                className={`rounded-lg border bg-card transition-all animate-fade-in ${isDone ? "workout-done opacity-80" : ""} ${isSkipped ? "opacity-60" : ""}`}>

                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedDay(expanded ? null : key)}>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {e.stopPropagation();toggleDone(0, plan.day);}}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"}`
                      }
                      title="Genomfört">

                      {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                    </button>
                    <button
                      onClick={(e) => {e.stopPropagation();toggleSkipped(0, plan.day);}}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSkipped ? "bg-destructive text-destructive-foreground" : "text-muted-foreground/40 hover:text-destructive"}`
                      }
                      title="Markera som missat">

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
                    {plan.tempo && plan.tempo !== "—" &&
                    <span className="text-xs text-muted-foreground font-mono block">{plan.tempo}</span>
                    }
                  </div>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const ownLines = comments[key]?.trim() ? comments[key].trim().split("\n").filter(Boolean).length : 0;
                      const dayFriendComments = friendComments.filter((c) => c.week === 0 && c.day === plan.day);
                      const totalComments = ownLines + dayFriendComments.length;
                      return totalComments > 0 ?
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <MessageCircle className="w-3 h-3" /> {totalComments}
                        </span> :
                      null;
                    })()}
                    <button
                      onClick={(e) => {e.stopPropagation();deleteSingleWorkout(plan);}}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors">

                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {expanded &&
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {/* Exercises / details */}
                    {plan.details &&
                  <div className="space-y-2">
                        {plan.details.split("\n").filter(Boolean).map((line, i) => {
                      const { name, weight } = parseExerciseWeight(line);
                      
                      // Check if this is a conditioning exercise (format includes "min", "/km")
                      const isCondFormat = weight && (weight.includes("min") || weight.includes("/km"));
                      
                      if (isCondFormat) {
                        const condTimeM = weight.match(/(\d+)\s*min/);
                        const condTempoM = weight.match(/([\d:.]+)\/km/);
                        const condDistM = weight.match(/([\d.,]+)\s*km(?!\/)/);
                        const condTime = condTimeM ? condTimeM[1] : null;
                        const condTempo = condTempoM ? condTempoM[1] : null;
                        const condDist = condDistM ? condDistM[1] : null;
                        
                        return (
                          <div key={i} className="bg-warning/5 rounded-lg p-3 border border-warning/20">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                    <Footprints className="w-3.5 h-3.5 text-warning" />
                                    {toTitleCase(name)}
                                   </span>
                                   <div className="flex items-center gap-1">
                                     <button
                                   onClick={(e) => {e.stopPropagation();setExerciseInfoName(name);}}
                                  className="p-0.5 text-muted-foreground hover:text-warning transition-colors"
                                  title="Visa övningsinformation">
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                  onClick={async () => {
                                    const lines = plan.details.split("\n").filter(Boolean);
                                    lines.splice(i, 1);
                                    const newDetails = lines.join("\n");
                                    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                                    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
                                  }}
                                  className="p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {condTime &&
                              <div className="flex items-center gap-1 bg-warning/10 rounded-md px-2 py-1 border border-warning/20">
                                      <Timer className="w-3 h-3 text-warning" />
                                      <span className="text-xs font-bold text-warning">{condTime} min</span>
                                    </div>
                              }
                                  {condTempo &&
                              <div className="flex items-center gap-1 bg-warning/10 rounded-md px-2 py-1 border border-warning/20">
                                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo</span>
                                      <span className="text-xs font-bold text-warning">{condTempo}/km</span>
                                    </div>
                              }
                                  {condDist &&
                              <div className="flex items-center gap-1 bg-warning/10 rounded-md px-2 py-1 border border-warning/20">
                                      <Route className="w-3 h-3 text-warning" />
                                      <span className="text-xs font-bold text-warning">{condDist} km</span>
                                    </div>
                              }
                                </div>
                              </div>);
                      }
                      
                      // Parse structured format: "3×10 @ 80 kg" or "3×10"
                      const { clean: cleanWeight, rpe: singleRpe } = extractRpe(weight || '');
                      const structMatch = cleanWeight?.match(/^(\d+)[×x](\d+)(?:\s*@\s*(.+))?$/i);
                      // Fallback: extract sets from "NxSomething" patterns like "3×AMRAP", "3×60s"
                      const fallbackSetsMatch = !structMatch && cleanWeight ? cleanWeight.match(/^(\d+)\s*[×x]\s*\S+/) : null;
                      const sets = structMatch ? structMatch[1] : fallbackSetsMatch ? fallbackSetsMatch[1] : null;
                      const reps = structMatch ? structMatch[2] : null;
                      const rawKg = structMatch && structMatch[3] ? structMatch[3] : !structMatch && !fallbackSetsMatch && cleanWeight ? cleanWeight : null;
                      const kg = rawKg ? rawKg.replace(/\s*kg\s*/i, '').trim() || null : null;

                      const isEditing = editingExercise?.planId === plan.id && editingExercise?.lineIndex === i;

                      if (isEditing) {
                        return (
                          <div key={i} className="bg-secondary/60 rounded-lg p-3 border border-primary/30 space-y-2 animate-fade-in">
                                <span className="font-semibold text-sm text-foreground">{editingExercise.name}</span>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Set</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.sets} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, sets: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Reps</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.reps} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, reps: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vikt (kg)</label>
                                    <input type="number" inputMode="decimal" value={editingExercise.weight} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, weight: e.target.value } : null)} placeholder="—" className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono placeholder:text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={saveEditedExercise} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold">Spara</button>
                                  <button onClick={() => setEditingExercise(null)} className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs">Avbryt</button>
                                </div>
                              </div>);

                      }

                      const setsCountSingle = sets ? parseInt(sets) : 1;
                      const setsStrSingle = getSetsDone(key, name);

                      return (
                        <div key={i} className="bg-secondary/60 rounded-lg p-3 border border-border/50">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-sm text-foreground">
                                  {toTitleCase(name)}
                                  {singleRpe && <span className="text-xs font-normal text-muted-foreground ml-1.5">{singleRpe}</span>}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                onClick={(e) => {e.stopPropagation();setExerciseInfoName(name);}}
                                className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                                title="Visa övningsinformation">
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                onClick={() => setEditingExercise({
                                  planId: plan.id,
                                  lineIndex: i,
                                  name,
                                  sets: sets || "3",
                                  reps: reps || "10",
                                  weight: kg?.replace(/\s*kg\s*/i, "").trim() || ""
                                })}
                                className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                                title="Redigera">
                                    <Dumbbell className="w-3 h-3" />
                                  </button>
                                  <button
                                onClick={async () => {
                                  const lines = plan.details.split("\n").filter(Boolean);
                                  lines.splice(i, 1);
                                  const newDetails = lines.join("\n");
                                  await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                                  setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
                                }}
                                className="p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1">
                                  {(() => {
                                    const setData = getSetData(key, name);
                                    const defaultKg = kg || "";
                                    const defaultReps = reps || "10";
                                    return Array.from({ length: setsCountSingle }, (_, si) => {
                                      const isSetDone = setsStrSingle[si] === "1";
                                      const saved = setData[si];
                                      return (
                                        <div key={si} className={`flex items-center gap-1.5 py-0.5 rounded px-1 ${isSetDone ? "opacity-60" : ""}`}>
                                          <Checkbox checked={isSetDone} onCheckedChange={() => toggleSetDone(0, plan.day, name, si, setsCountSingle)} className="h-3.5 w-3.5" />
                                          <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">S{si + 1}</span>
                                          <input type="number" inputMode="numeric" defaultValue={saved?.reps || defaultReps} onBlur={(e) => saveSetFieldData(0, plan.day, name, si, 'reps', e.target.value, setsCountSingle, defaultKg, defaultReps)} className="w-11 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none" />
                                          <span className="text-[10px] text-muted-foreground">reps</span>
                                          <input type="number" inputMode="decimal" defaultValue={saved?.kg || defaultKg} onBlur={(e) => saveSetFieldData(0, plan.day, name, si, 'kg', e.target.value, setsCountSingle, defaultKg, defaultReps)} placeholder="—" className="w-14 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                          <span className="text-[10px] text-muted-foreground">kg</span>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                            </div>);

                    })}
                      </div>
                  }

                    {/* Reps/sets/weight dialog */}
                    {weightDialog && weightDialog.planId === plan.id &&
                  <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-primary/30">
                        <h4 className="text-sm font-bold flex items-center gap-1.5">
                          <Dumbbell className="w-4 h-4 text-primary" />
                          {weightDialog.exerciseName}
                        </h4>
                        {weightDialog.lastWeight &&
                    <div className="text-xs text-muted-foreground">
                            Senast: <span className="font-mono text-foreground">{weightDialog.lastWeight}</span>
                          </div>
                    }
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Set</label>
                            <input
                          type="number"
                          min="1"
                          value={setsInput}
                          onChange={(e) => setSetsInput(e.target.value)}
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold" />

                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Reps</label>
                            <input
                          type="number"
                          min="1"
                          value={repsInput}
                          onChange={(e) => setRepsInput(e.target.value)}
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold" />

                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Vikt (kg)</label>
                            <input
                          type="text"
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addExerciseWithWeight(weightInput.trim() || null)}
                          placeholder="—"
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />

                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                        onClick={() => addExerciseWithWeight(weightInput.trim() || null)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">

                            <Plus className="w-3.5 h-3.5" /> Lägg till
                          </button>
                          <button
                        onClick={() => {setWeightDialog(null);setWeightInput("");setRepsInput("10");setSetsInput("3");}}
                        className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">

                            Avbryt
                          </button>
                        </div>
                      </div>
                  }

                    {/* Conditioning exercise dialog */}
                    {conditioningDialog && conditioningDialog.planId === plan.id &&
                  <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-warning/30">
                        <h4 className="text-sm font-bold flex items-center gap-1.5">
                          <Footprints className="w-4 h-4 text-warning" />
                          {conditioningDialog.exerciseName}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid (min)</label>
                            <input
                          type="number"
                          inputMode="numeric"
                          value={condTimeInput}
                          onChange={(e) => {
                            setCondTimeInput(e.target.value);
                            // Auto-calculate distance
                            if (condTempoInput.trim()) {
                              const tempoMatch = condTempoInput.trim().match(/^(\d+)[:\.](\d+)$/);
                              if (tempoMatch) {
                                const secsPerKm = parseInt(tempoMatch[1]) * 60 + parseInt(tempoMatch[2]);
                                const mins = parseFloat(e.target.value);
                                if (secsPerKm > 0 && mins > 0) {
                                  const dist = mins / (secsPerKm / 60);
                                  setCondDistanceInput((Math.round(dist * 100) / 100).toString());
                                }
                              }
                            }
                          }}
                          placeholder="t.ex. 30"
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
                            <input
                          type="text"
                          value={condTempoInput}
                          onChange={(e) => {
                            setCondTempoInput(e.target.value);
                            // Auto-calculate distance
                            const tempoMatch = e.target.value.trim().match(/^(\d+)[:\.](\d+)$/);
                            if (tempoMatch && condTimeInput.trim()) {
                              const secsPerKm = parseInt(tempoMatch[1]) * 60 + parseInt(tempoMatch[2]);
                              const mins = parseFloat(condTimeInput);
                              if (secsPerKm > 0 && mins > 0) {
                                const dist = mins / (secsPerKm / 60);
                                setCondDistanceInput((Math.round(dist * 100) / 100).toString());
                              }
                            }
                          }}
                          placeholder="t.ex. 5:30"
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Route className="w-3 h-3" /> Distans (km)
                            {condTempoInput && condTimeInput && <span className="text-primary text-[9px] ml-1">Beräknad</span>}
                          </label>
                          <input
                        type="number"
                        inputMode="decimal"
                        value={condDistanceInput}
                        onChange={(e) => setCondDistanceInput(e.target.value)}
                        placeholder="Beräknas automatiskt"
                        className={`w-full text-foreground text-sm px-3 py-2 rounded-md border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal ${
                          condTempoInput && condTimeInput ? "bg-warning/10 border-warning/30" : "bg-background border-border"
                        }`} />
                        </div>
                        <div className="flex gap-2">
                          <button
                        onClick={addConditioningExercise}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-warning text-warning-foreground rounded-md text-xs font-semibold">
                            <Plus className="w-3.5 h-3.5" /> Lägg till
                          </button>
                          <button
                        onClick={() => {setConditioningDialog(null);setCondTempoInput("");setCondTimeInput("");setCondDistanceInput("");}}
                        className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                            Avbryt
                          </button>
                        </div>
                      </div>
                  }

                    {/* Add warmup & exercise buttons */}
                    {!isExercisePickerOpen && !weightDialog && !conditioningDialog ?
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setShowExercisePicker(plan.id);
                        setExerciseSearch("");
                        setSelectedMuscle(null);
                        setIsWarmupMode(true);
                      }}
                      className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-muted-foreground hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Lägg till uppvärmning
                      </button>
                    <button
                      onClick={() => {
                        setShowExercisePicker(plan.id);
                        setExerciseSearch("");
                        setSelectedMuscle(null);
                        setIsWarmupMode(false);
                      }}
                      className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Lägg till övning
                      </button>
                  </div> :
                  isExercisePickerOpen && !weightDialog && !conditioningDialog ?
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2 animate-fade-in">
                         <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold">{isWarmupMode ? "Välj uppvärmning" : "Välj övning"}</h4>
                          <button onClick={() => { setShowExercisePicker(null); setIsWarmupMode(false); }} className="text-muted-foreground hover:text-foreground">
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
                        autoFocus />

                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                        onClick={() => setSelectedMuscle(null)}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${!selectedMuscle ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>

                            Alla
                          </button>
                          {muscleGroups.map((mg) =>
                      <button
                        key={mg}
                        onClick={() => setSelectedMuscle(mg === selectedMuscle ? null : mg)}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${selectedMuscle === mg ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>

                              {mg}
                            </button>
                      )}
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {filteredExercises.map((e, i) => {
                        const lastW = findLastWeight(e.name);
                        return (
                          <button
                            key={`${e.name}-${i}`}
                            onClick={() => handleExerciseSelect(plan.id, e.name)}
                            className="w-full text-left flex items-center justify-between p-1.5 bg-background rounded text-xs hover:bg-primary/10 transition-colors">

                                <div className="flex items-center gap-1">
                                  <span>{e.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(ev) => {ev.stopPropagation();setExerciseInfoName(e.name);}}
                                    className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                                    title="Info">
                                    <Info className="w-3 h-3" />
                                  </button>
                                  {lastW &&
                              <span className="text-[10px] font-mono text-primary">{lastW}</span>
                              }
                                  <span className="text-[10px] text-muted-foreground">{e.muscleGroup}</span>
                                </div>
                              </button>);

                      })}
                        </div>
                      </div> :
                  null}

                    {/* Friend comments */}
                    {(() => {
                    const dayComments = friendComments.filter((c) => c.week === 0 && c.day === plan.day);
                    return dayComments.length > 0 ?
                    <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                          <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                          </p>
                          {dayComments.map((c) =>
                      <div key={c.id} className="bg-background/80 rounded-md px-3 py-2">
                              <p className="text-xs">
                                <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                                <span className="text-foreground">{c.comment}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(c.created_at).toLocaleDateString("sv-SE")}
                              </p>
                            </div>
                      )}
                        </div> :
                    null;
                  })()}

                    {/* Own comments display */}
                    {comments[key]?.trim() &&
                  <div className="space-y-1">
                        {comments[key].trim().split("\n").filter(Boolean).map((line, i) =>
                    <div key={i} className="bg-accent/30 rounded-lg px-3 py-2 border border-accent/50 flex items-start justify-between gap-2">
                            <p className="text-xs flex items-start gap-1.5 flex-1">
                              <MessageSquare className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                              <span className="text-foreground">{line}</span>
                            </p>
                            <button
                        onClick={() => deleteCommentLine(0, plan.day, i)}
                        className="flex-shrink-0 p-0.5 transition-colors text-destructive"
                        title="Ta bort kommentar">

                              <X className="w-3 h-3" />
                            </button>
                          </div>
                    )}
                      </div>
                  }

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
                        className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />

                      </div>
                    </div>
                  </div>
                }
              </div>);

          })}
        </div>

        {/* Add single workout form */}
        {showAddSingle ?
        <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-fade-in">
            <h3 className="text-sm font-semibold">Nytt pass</h3>

            {/* Copy from previous session */}
            {(() => {
            const uniqueSessions = new Map<string, PlanDay>();
            const singlePlans2 = plans.filter((p) => p.week === 0);
            // Get latest version of each session name
            for (const p of singlePlans2) {
              const existing = uniqueSessions.get(p.session_name);
              if (!existing || p.day > existing.day) {
                uniqueSessions.set(p.session_name, p);
              }
            }
            const previousSessions = Array.from(uniqueSessions.values());

            if (previousSessions.length > 0) {
              return (
                <div className="space-y-2">
                    <button
                    onClick={() => setShowCopyPicker(!showCopyPicker)}
                    className="w-full py-2 border border-dashed border-primary/40 rounded-md text-xs text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1">

                      <TrendingUp className="w-3 h-3" /> Kopiera tidigare pass
                    </button>
                    {showCopyPicker &&
                  <div className="space-y-1 max-h-40 overflow-y-auto animate-fade-in">
                        {previousSessions.map((p) =>
                    <button
                      key={p.id}
                      onClick={() => addSingleWorkout(p)}
                      className="w-full text-left p-2.5 bg-secondary rounded-md text-xs hover:bg-primary/10 transition-colors">

                            <span className="font-semibold block">{p.session_name}</span>
                            {p.details &&
                      <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                                {p.details.split("\n").slice(0, 2).join(", ")}
                              </span>
                      }
                          </button>
                    )}
                      </div>
                  }
                  </div>);

            }
            return null;
          })()}

            {/* Date picker */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                  className={cn(
                    "w-full flex items-center gap-2 bg-secondary text-foreground text-sm p-2 rounded-md text-left",
                    !singleDate && "text-muted-foreground"
                  )}>

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
                  className={cn("p-3 pointer-events-auto")} />

                </PopoverContent>
              </Popover>
            </div>

            <input
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            placeholder="Passnamn (t.ex. Styrka överkropp)"
            className="w-full bg-secondary text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            autoFocus />

            <p className="text-[10px] text-muted-foreground">
              Lägg till övningar efter att passet skapats
            </p>
            <div className="flex gap-2">
              <button onClick={() => addSingleWorkout()} disabled={!singleName.trim()} className="flex-1 py-2 bg-primary text-primary-foreground font-semibold rounded-md text-sm disabled:opacity-40">
                Skapa pass
              </button>
              <button onClick={() => {setShowAddSingle(false);setShowCopyPicker(false);}} className="px-4 py-2 bg-secondary text-muted-foreground rounded-md text-sm">
                Avbryt
              </button>
            </div>
          </div> :

        <button
          onClick={() => setShowAddSingle(true)}
          className="w-full py-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2">

            <Plus className="w-4 h-4" /> Lägg till pass
          </button>
        }
      </div>
      {exerciseInfoName && (
        <ExerciseInfoDialog
          exerciseName={exerciseInfoName}
          onClose={() => setExerciseInfoName(null)}
        />
      )}
      </>);

  }

  // Plan mode (existing)
  const weekDays = plans.
  filter((p) => p.week === currentWeek).
  sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  const weekIdx = weeks.indexOf(currentWeek);
  const doneCount = weekDays.filter((d) => completions[`${d.week}-${d.day}`]?.done).length;
  const progress = weekDays.length > 0 ? Math.round(doneCount / weekDays.length * 100) : 0;

  return (
    <>
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between relative">
          <button
            onClick={() => weekIdx > 0 && setCurrentWeek(weeks[weekIdx - 1])}
            disabled={weekIdx <= 0}
            className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors">

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
              title="Lämna plan">

              <LogOut className="w-4 h-4" />
            </button>
            <span className="text-[9px] text-muted-foreground leading-tight">Avsluta plan</span>
          </div>
          <button
            onClick={() => weekIdx < weeks.length - 1 && setCurrentWeek(weeks[weekIdx + 1])}
            disabled={weekIdx >= weeks.length - 1}
            className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors">

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
              isCurrent ?
              "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background" :
              "bg-secondary text-muted-foreground hover:bg-muted"}`
              }>

              <span className="font-bold">V{w}</span>
            </button>);

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
              className={`rounded-lg border bg-card transition-all animate-fade-in ${isDone ? "workout-done opacity-80" : ""} ${isSkipped ? "opacity-60" : ""} ${isRest ? "workout-rest" : ""}`}>

              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedDay(expanded ? null : key)}>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDone) {
                        toggleDone(plan.week, plan.day);
                      } else {
                        const sLower = (plan.session_name + " " + plan.details).toLowerCase();
                        const isRunning = sLower.includes("löpning") || sLower.includes("jogg") || sLower.includes("långpass") || sLower.includes("tröskel");
                        if (isRunning) {
                          setRunLogTarget({ week: plan.week, day: plan.day, sessionName: plan.session_name, details: plan.details });
                        } else {
                          toggleDone(plan.week, plan.day);
                        }
                      }
                    }}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"}`
                    }
                    title="Genomfört">

                      {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                    </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open replacement dialog instead of directly skipping
                      setReplacementTarget({
                        planId: plan.id,
                        sessionName: plan.session_name,
                        week: plan.week,
                        day: plan.day
                      });
                    }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    isSkipped ? "bg-destructive text-destructive-foreground" : "text-muted-foreground/40 hover:text-destructive"}`
                    }
                    title="Markera som missat">

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
                  {plan.tempo && plan.tempo !== "—" &&
                  <span className="text-xs text-muted-foreground font-mono">{plan.tempo}</span>
                  }
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    {(() => {
                    const ownLines = comments[key]?.trim() ? comments[key].trim().split("\n").filter(Boolean).length : 0;
                    const dayFriendComments = friendComments.filter((c) => c.week === plan.week && c.day === plan.day);
                    const totalComments = ownLines + dayFriendComments.length;
                    return totalComments > 0 ?
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full animate-fade-in">
                          <MessageCircle className="w-3 h-3" /> {totalComments}
                        </span> :
                    null;
                  })()}
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
              </div>
              {expanded &&
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {/* Inline weight inputs for strength exercises */}
                  {(() => {
                  const s = (plan.session_name + " " + plan.details).toLowerCase();
                  const isStrength = s.includes("styrka") || s.includes("bänk") || s.includes("böj") || s.includes("mark") || s.includes("press") || s.includes("rodd") || s.includes("chins") || s.includes("tung") || s.includes("rpe") || s.includes("×") || s.includes("x");
                  if (!isStrength) {
                    const isRunning = s.includes("löpning") || s.includes("jogg") || s.includes("långpass") || s.includes("tröskel");
                    const comp = completions[key];
                    const detailParts = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
                    return (
                      <div className="space-y-2">
                          {detailParts.length > 1 ? (
                            <ul className="space-y-1.5">
                              {detailParts.map((line, i) => {
                                const cleanName = line.replace(/\s*[—\-]\s*\d+[×x].*$/i, "").replace(/\s*@\s*\d+.*$/i, "").trim();
                                return (
                                  <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                                    <span className="text-muted-foreground">•</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setExerciseInfoName(cleanName); }}
                                      className="p-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                                      title="Visa övningsinformation">
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="flex-1">{line}</span>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const lines = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
                                        lines.splice(i, 1);
                                        const separator = plan.details.includes("\n") ? "\n" : "; ";
                                        const newDetails = lines.join(separator);
                                        await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                                        setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
                                      }}
                                      className="p-0.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-foreground leading-relaxed">{plan.details}</p>
                          )}
                          {isRunning && comp && (comp.logged_tempo || comp.logged_pulse || comp.logged_distance_km) &&
                        <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-1">
                              <p className="text-xs font-bold text-success">📊 Loggat resultat</p>
                              {comp.logged_tempo && <p className="text-xs">⏱ Tempo: <span className="font-mono font-semibold">{comp.logged_tempo}</span></p>}
                              {comp.logged_pulse && <p className="text-xs">❤️ Puls: <span className="font-mono font-semibold">{comp.logged_pulse} bpm</span></p>}
                              {comp.logged_distance_km && <p className="text-xs">📏 Distans: <span className="font-mono font-semibold">{comp.logged_distance_km} km</span></p>}
                            </div>
                        }
                        </div>);

                  }

                  // Extract exercises from details
                  const parts = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
                  const comp = completions[key];
                  const savedWeights = (comp?.logged_weights || {}) as Record<string, number>;

                  // Helper: find previously logged weight for an exercise from earlier weeks
                  const findPreviousWeight = (exerciseName: string): number | null => {
                    // Look through completions from previous weeks for this exercise
                    for (let w = plan.week - 1; w >= 1; w--) {
                      // Check all days in that week
                      for (const p of plans.filter((pp) => pp.week === w)) {
                        const compKey = `${w}-${p.day}`;
                        const comp = completions[compKey];
                        const weights = comp?.logged_weights as Record<string, number> | null;
                        if (weights && weights[exerciseName]) {
                          return weights[exerciseName];
                        }
                      }
                    }
                    return null;
                  };

                  // Progressive increase: vary by rep range
                  const getProgression = (weight: number, repsStr: string | null): number => {
                    const reps = repsStr ? parseInt(repsStr) : 10;
                    // High reps (8+) = smaller increase, low reps (1-5) = larger increase
                    if (reps <= 3) return Math.round((weight + 5) / 2.5) * 2.5;
                    if (reps <= 5) return Math.round((weight + 2.5) / 2.5) * 2.5;
                    if (reps <= 8) return Math.round((weight + 2.5) / 2.5) * 2.5;
                    return Math.round((weight + 1.25) / 1.25) * 1.25; // 12+ reps = +1.25 kg
                  };

                  return (
                    <div className="space-y-2">
                        {parts.map((part, i) => {
                        // Extract exercise name (text before first digit pattern)
                        const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
                        const exerciseName = nameMatch ? nameMatch[1].trim() : null;
                        const isLoggable = exerciseName && exerciseName.length > 2 && !exerciseName.toLowerCase().includes("vila") && !exerciseName.toLowerCase().includes("vilodag");

                        // Extract reps from part for progression calculation
                        const repsMatch = part.match(/\d+\s*[×x]\s*(\d+)/i);
                        const repsStr = repsMatch ? repsMatch[1] : null;

                        // Determine default value: saved > previous week with progression
                        let defaultWeight: number | string = "";
                        if (exerciseName && isLoggable) {
                          if (savedWeights[exerciseName]) {
                            defaultWeight = savedWeights[exerciseName];
                          } else {
                            const prevWeight = findPreviousWeight(exerciseName);
                            if (prevWeight) {
                              defaultWeight = getProgression(prevWeight, repsStr);
                            }
                          }
                        }

                        // Extract RPE first, then parse structured format
                        const { clean: cleanPart, rpe: partRpe } = extractRpe(part);
                        const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
                        // Fallback: try to extract just sets from "NxM" or "Nx..." pattern
                        const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
                        const partName = partStructMatch ? partStructMatch[1].trim() : exerciseName || cleanPart;
                        const partSets = partStructMatch ? partStructMatch[2] : fallbackSetsMatch ? fallbackSetsMatch[1] : null;
                        const partReps = partStructMatch ? partStructMatch[3] : null;
                        const partKg = partStructMatch && partStructMatch[4] ? partStructMatch[4].trim() : null;

                        const isEditing = editingExercise?.planId === plan.id && editingExercise?.lineIndex === i;

                        if (isEditing) {
                          return (
                            <div key={i} className="bg-secondary/60 rounded-lg p-3 border border-primary/30 space-y-2 animate-fade-in">
                                <span className="font-semibold text-sm text-foreground">{editingExercise.name}</span>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Set</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.sets} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, sets: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Reps</label>
                                    <input type="number" inputMode="numeric" value={editingExercise.reps} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, reps: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vikt (kg)</label>
                                    <input type="number" inputMode="decimal" value={editingExercise.weight} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, weight: e.target.value } : null)} placeholder="—" className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono placeholder:text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={saveEditedExercise} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold">Spara</button>
                                  <button onClick={() => setEditingExercise(null)} className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs">Avbryt</button>
                                </div>
                              </div>);

                        }

                        const setsCountPlan = partSets ? parseInt(partSets) : 1;
                        const setsStrPlan = getSetsDone(key, partName);

                        return (
                          <div key={i} className="bg-secondary/40 rounded-lg p-2.5 border border-border/30 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => {e.stopPropagation();setExerciseInfoName(partName);}}
                                    className="p-0.5 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                                    title="Visa övningsinformation">
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    className="font-semibold text-sm text-foreground cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => setEditingExercise({
                                      planId: plan.id,
                                      lineIndex: i,
                                      name: partName,
                                      sets: partSets || "3",
                                      reps: partReps || repsStr || "10",
                                      weight: partKg || ""
                                    })}>
                                    {toTitleCase(partName)}
                                    {partRpe && <span className="text-xs font-normal text-muted-foreground ml-1.5">{partRpe}</span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={async () => {
                                      const newParts = [...parts];
                                      newParts.splice(i, 1);
                                      const newDetails = newParts.join(plan.details.includes("\n") ? "\n" : "; ");
                                      await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
                                      setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
                                    }}
                                    className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Ta bort övning">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1 pl-1">
                                  {(() => {
                                    const planSetData = getSetData(key, partName);
                                    const defKg = partKg || "";
                                    const defReps = partReps || repsStr || "10";
                                    return Array.from({ length: setsCountPlan }, (_, si) => {
                                      const isSetDone = setsStrPlan[si] === "1";
                                      const saved = planSetData[si];
                                      return (
                                        <div key={si} className={`flex items-center gap-1.5 py-0.5 rounded px-1 ${isSetDone ? "opacity-60" : ""}`}>
                                          <Checkbox checked={isSetDone} onCheckedChange={() => toggleSetDone(plan.week, plan.day, partName, si, setsCountPlan)} className="h-3.5 w-3.5" />
                                          <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">S{si + 1}</span>
                                          <input type="number" inputMode="numeric" defaultValue={saved?.reps || defReps} onBlur={(e) => saveSetFieldData(plan.week, plan.day, partName, si, 'reps', e.target.value, setsCountPlan, defKg, defReps)} className="w-11 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none" />
                                          <span className="text-[10px] text-muted-foreground">reps</span>
                                          <input type="number" inputMode="decimal" defaultValue={saved?.kg || defKg} onBlur={(e) => saveSetFieldData(plan.week, plan.day, partName, si, 'kg', e.target.value, setsCountPlan, defKg, defReps)} placeholder="—" className="w-14 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                          <span className="text-[10px] text-muted-foreground">kg</span>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                            </div>);

                      })}
                      </div>);

                })()}

                  {/* Reps/sets/weight dialog for plan exercises */}
                  {weightDialog && weightDialog.planId === plan.id &&
                <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-primary/30">
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        <Dumbbell className="w-4 h-4 text-primary" />
                        {weightDialog.exerciseName}
                      </h4>
                      {weightDialog.lastWeight &&
                  <p className="text-xs text-muted-foreground">Senast: {weightDialog.lastWeight}</p>
                  }
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Set</label>
                          <input type="number" inputMode="numeric" value={setsInput} onChange={(e) => setSetsInput(e.target.value)} className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Reps</label>
                          <input type="number" inputMode="numeric" value={repsInput} onChange={(e) => setRepsInput(e.target.value)} className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Vikt (kg)</label>
                          <input type="number" inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} placeholder="—" className="w-full bg-background text-foreground text-sm p-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary text-center font-mono placeholder:text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                      onClick={() => addExerciseWithWeight(weightInput.trim() || null)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">

                          <Plus className="w-3.5 h-3.5" /> Lägg till
                        </button>
                        <button
                      onClick={() => {setWeightDialog(null);setWeightInput("");setRepsInput("10");setSetsInput("3");}}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">

                          Avbryt
                        </button>
                      </div>
                    </div>
                }

                  {/* Conditioning exercise dialog for plan mode */}
                  {conditioningDialog && conditioningDialog.planId === plan.id &&
                <div className="bg-secondary/50 rounded-lg p-4 space-y-3 animate-fade-in border border-warning/30">
                      <h4 className="text-sm font-bold flex items-center gap-1.5">
                        <Footprints className="w-4 h-4 text-warning" />
                        {conditioningDialog.exerciseName}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid (min)</label>
                          <input
                        type="number"
                        inputMode="numeric"
                        value={condTimeInput}
                        onChange={(e) => setCondTimeInput(e.target.value)}
                        placeholder="t.ex. 30"
                        className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
                          <input
                        type="text"
                        value={condTempoInput}
                        onChange={(e) => setCondTempoInput(e.target.value)}
                        placeholder="t.ex. 5:30"
                        className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Distans (km)</label>
                        <input
                      type="text"
                      value={condDistanceInput}
                      onChange={(e) => setCondDistanceInput(e.target.value)}
                      placeholder="t.ex. 5"
                      className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                      </div>
                      <div className="flex gap-2">
                        <button
                      onClick={addConditioningExercise}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">
                          <Plus className="w-3.5 h-3.5" /> Lägg till
                        </button>
                        <button
                      onClick={() => {setConditioningDialog(null);setCondTempoInput("");setCondTimeInput("");setCondDistanceInput("");}}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                          Avbryt
                        </button>
                      </div>
                    </div>
                }

                  {/* Add exercise to plan session */}
                  {showExercisePicker === plan.id && !weightDialog && !conditioningDialog ?
                <div className="bg-secondary/50 rounded-lg p-3 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold">{isWarmupMode ? "Välj uppvärmning" : "Lägg till övning"}</h4>
                        <button onClick={() => {setShowExercisePicker(null);setShowAddCustomExercise(false);setIsWarmupMode(false);}} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                        <input type="text" value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Sök övning..." className="w-full bg-background text-foreground text-xs pl-8 pr-3 py-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" autoFocus />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => setSelectedMuscle(null)} className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${!selectedMuscle ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>Alla</button>
                        {muscleGroups.map((mg) =>
                    <button key={mg} onClick={() => setSelectedMuscle(mg === selectedMuscle ? null : mg)} className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${selectedMuscle === mg ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{mg}</button>
                    )}
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-0.5">
                        {filteredExercises.map((e, i) =>
                    <button key={`${e.name}-${i}`} onClick={() => handleExerciseSelect(plan.id, e.name)} className="w-full text-left flex items-center justify-between p-1.5 bg-background rounded text-xs hover:bg-primary/10 transition-colors">
                            <span>{e.name}</span>
                            <span className="text-[10px] text-muted-foreground">{e.muscleGroup}</span>
                          </button>
                    )}
                      </div>
                      {showAddCustomExercise ?
                  <div className="border border-primary/30 rounded-md p-2 space-y-1.5">
                          <input type="text" value={newExName} onChange={(e) => setNewExName(e.target.value)} placeholder="Övningens namn" className="w-full bg-background text-foreground text-xs p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
                          <div className="flex gap-1.5">
                            <select value={newExCategory} onChange={(e) => setNewExCategory(e.target.value)} className="flex-1 bg-background text-foreground text-[10px] p-1.5 rounded-md border-none outline-none">
                              <option value="styrka">Styrka</option><option value="kondition">Kondition</option><option value="rörlighet">Rörlighet</option><option value="core">Core</option>
                            </select>
                            <select value={newExMuscle} onChange={(e) => setNewExMuscle(e.target.value)} className="flex-1 bg-background text-foreground text-[10px] p-1.5 rounded-md border-none outline-none">
                              {muscleGroups.map((mg) => <option key={mg} value={mg}>{mg}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={async () => {if (!newExName.trim()) return;await supabase.from("custom_exercises").insert({ name: newExName.trim(), category: newExCategory, muscle_group: newExMuscle, created_by: userId });setNewExName("");setShowAddCustomExercise(false);const { data } = await supabase.from("custom_exercises").select("*").order("name");if (data) setCustomExercises(data);}} className="flex-1 py-1 bg-primary text-primary-foreground font-semibold rounded-md text-[10px]">Spara</button>
                            <button onClick={() => setShowAddCustomExercise(false)} className="px-2 py-1 bg-secondary text-muted-foreground rounded-md text-[10px]">Avbryt</button>
                          </div>
                        </div> :

                  <button onClick={() => setShowAddCustomExercise(true)} className="w-full py-1.5 border border-dashed border-border rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1">
                          <Plus className="w-3 h-3" /> Lägg till egen övning
                        </button>
                  }
                    </div> :
                !weightDialog ?
                <div className="space-y-1.5">
                  <button onClick={() => {setShowExercisePicker(plan.id);setExerciseSearch("");setSelectedMuscle(null);setShowAddCustomExercise(false);setIsWarmupMode(true);}} className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-muted-foreground hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Lägg till uppvärmning
                    </button>
                  <button onClick={() => {setShowExercisePicker(plan.id);setExerciseSearch("");setSelectedMuscle(null);setShowAddCustomExercise(false);setIsWarmupMode(false);}} className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Lägg till övning
                    </button>
                </div> :
                null}

                  {/* Friend comments */}
                  {(() => {
                  const dayComments = friendComments.filter((c) => c.week === plan.week && c.day === plan.day);
                  return dayComments.length > 0 ?
                  <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                        </p>
                        {dayComments.map((c) =>
                    <div key={c.id} className="bg-background/80 rounded-md px-3 py-2">
                            <p className="text-xs">
                              <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                              <span className="text-foreground">{c.comment}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(c.created_at).toLocaleDateString("sv-SE")}
                            </p>
                          </div>
                    )}
                      </div> :
                  null;
                })()}

                  {/* Own comments display */}
                  {comments[key]?.trim() &&
                <div className="space-y-1">
                      {comments[key].trim().split("\n").filter(Boolean).map((line, i) =>
                  <div key={i} className="bg-accent/30 rounded-lg px-3 py-2 border border-accent/50 flex items-start justify-between gap-2">
                          <p className="text-xs flex items-start gap-1.5 flex-1">
                            <MessageSquare className="w-3.5 h-3.5 text-accent-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-foreground">{line}</span>
                          </p>
                          <button
                      onClick={() => deleteCommentLine(plan.week, plan.day, i)}
                      className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Ta bort kommentar">

                            <X className="w-3 h-3" />
                          </button>
                        </div>
                  )}
                    </div>
                }

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                      type="text"
                      value={commentInput[key] || ""}
                      onChange={(e) => setCommentInput((prev) => ({ ...prev, [key]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveComment(plan.week, plan.day)}
                      placeholder="Skriv en kommentar..."
                      className="w-full bg-secondary text-foreground text-sm pl-9 pr-3 py-2 rounded-md border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />

                    </div>
                  </div>
                </div>
              }
            </div>);

        })}
      </div>

      {/* Replacement workout dialog */}
      {replacementTarget &&
      <ReplacementWorkoutDialog
        userId={userId}
        planId={replacementTarget.planId}
        sessionName={replacementTarget.sessionName}
        week={replacementTarget.week}
        day={replacementTarget.day}
        onClose={() => setReplacementTarget(null)}
        onReplaced={() => {
          setReplacementTarget(null);
          fetchData();
        }}
        onSkipOnly={() => {
          setReplacementTarget(null);
          toggleSkipped(replacementTarget.week, replacementTarget.day);
        }} />

      }

      {/* Run log dialog */}
      {runLogTarget &&
      <WorkoutLogDialog
        userId={userId}
        week={runLogTarget.week}
        day={runLogTarget.day}
        sessionName={runLogTarget.sessionName}
        details={runLogTarget.details}
        existingLog={(() => {
          const comp = completions[`${runLogTarget.week}-${runLogTarget.day}`];
          if (!comp) return undefined;
          return {
            logged_tempo: comp.logged_tempo || null,
            logged_pulse: comp.logged_pulse || null,
            logged_distance_km: comp.logged_distance_km || null,
            logged_weights: null
          };
        })()}
        onClose={() => setRunLogTarget(null)}
        onSaved={() => {
          setRunLogTarget(null);
          fetchData();
        }} />

      }
    </div>

    {exerciseInfoName && (
      <ExerciseInfoDialog
        exerciseName={exerciseInfoName}
        onClose={() => setExerciseInfoName(null)}
      />
    )}
    {showFireworks && (
      <FireworksOverlay onComplete={() => setShowFireworks(false)} />
    )}
    </>);

};

export default WorkoutView;