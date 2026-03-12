import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queueOfflineUpsert } from "@/hooks/useOfflineSync";
import { Check, MessageSquare, ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike, ChevronLeft, ChevronRight, LogOut, Plus, Trash2, Search, CalendarIcon, X, TrendingUp, Equal, Weight, MessageCircle, XCircle, Timer, Route, Info, Pencil, Share2, Swords, ArrowLeftRight, Send, Settings, ArrowLeft, Flame } from "lucide-react";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import PlanPicker from "@/components/PlanPicker";
import PlanCalibrationDialog from "@/components/PlanCalibrationDialog";
import ReplacementWorkoutDialog from "@/components/ReplacementWorkoutDialog";
import WorkoutLogDialog from "@/components/WorkoutLogDialog";
import ExercisePickerDialog from "@/components/ExercisePickerDialog";
import { exerciseLibrary, muscleGroups } from "@/data/exerciseLibrary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { notifyFriendsOfCompletion } from "@/hooks/usePushNotifications";
import ExerciseInfoDialog from "@/components/ExerciseInfoDialog";
import FireworksOverlay from "@/components/FireworksOverlay";
import { Checkbox } from "@/components/ui/checkbox";
import DailyChallenge from "@/components/DailyChallenge";
import WorkoutShareCard from "@/components/WorkoutShareCard";
import AutoSaveInput from "@/components/AutoSaveInput";
import { useSaveIndicator } from "@/components/SaveIndicator";

const toTitleCase = (str: string): string =>
  str.replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());

interface WorkoutViewProps {
  userId: string;
  isAdmin?: boolean;
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
    const dateMatch = day.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const date = parseISO(dateMatch[1]);
      return format(date, "d MMM yyyy", { locale: sv });
    }
  } catch {
    // not a date
  }
  // Strip any suffix like _abc1 or _1771393847859
  return day.replace(/_[a-z0-9]+$/i, "");
};

const WEEKDAY_NAMES_SV = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

// Extract date from a single workout day key and return weekday name
const getWeekdayFromDayKey = (day: string): string | null => {
  const dateMatch = day.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const date = parseISO(dateMatch[1]);
  return WEEKDAY_NAMES_SV[date.getDay()];
};

// Compute virtual week number for a single workout based on the earliest workout's Monday
const computeSingleWeek = (dayKey: string, firstMonday: Date): number => {
  const dateMatch = dayKey.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return 1;
  const date = parseISO(dateMatch[1]);
  const monday = getMonday(date);
  const diffDays = Math.floor((monday.getTime() - firstMonday.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
};

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const WorkoutView = ({ userId, isAdmin = false }: WorkoutViewProps) => {
  const { triggerSave } = useSaveIndicator();
  const isMobile = useIsMobile();
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const swipeKey = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [plans, setPlans] = useState<PlanDay[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [currentWeek, setCurrentWeek] = useState(1);
  const [activePlanWeek, setActivePlanWeek] = useState<number | null>(null);
  const [initialWeekSet, setInitialWeekSet] = useState(false);
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
  const [singleCurrentWeek, setSingleCurrentWeek] = useState(1);

  // Exercise browser for single workouts
  const [showExercisePicker, setShowExercisePicker] = useState<string | null>(null); // plan id
  const [isWarmupMode, setIsWarmupMode] = useState(false);
  const [deleteExerciseConfirm, setDeleteExerciseConfirm] = useState<{planId: string; lineIndex: number; name: string} | null>(null);
  const [replaceExerciseTarget, setReplaceExerciseTarget] = useState<{planId: string; lineIndex: number; name: string} | null>(null);
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
  const [editingExercise, setEditingExercise] = useState<{planId: string;lineIndex: number;name: string;originalName: string;sets: string;reps: string;weight: string;} | null>(null);

  // Conditioning exercise dialog
  const [conditioningDialog, setConditioningDialog] = useState<{planId: string;exerciseName: string;} | null>(null);
  const [condTempoInput, setCondTempoInput] = useState("");
  const [condTimeInput, setCondTimeInput] = useState("");
  const [condDistanceInput, setCondDistanceInput] = useState("");
  const [condIntervalsInput, setCondIntervalsInput] = useState("");
  const [condRestInput, setCondRestInput] = useState("");
  const [condPulseInput, setCondPulseInput] = useState("");
  const [condSpmInput, setCondSpmInput] = useState("");

  // Friend comments on own workouts
  const [friendComments, setFriendComments] = useState<FriendComment[]>([]);
  const [commentNicknames, setCommentNicknames] = useState<Record<string, string>>({});

  // Likes on own workouts
  const [workoutLikes, setWorkoutLikes] = useState<{ id: string; user_id: string; week: number; day: string }[]>([]);

  // Replacement workout dialog state
  const [replacementTarget, setReplacementTarget] = useState<{planId: string;sessionName: string;week: number;day: string;} | null>(null);
  const [runLogTarget, setRunLogTarget] = useState<{week: number;day: string;sessionName: string;details: string;} | null>(null);

  // Exercise info dialog
  const [exerciseInfoName, setExerciseInfoName] = useState<string | null>(null);

  // Fireworks celebration
  const [showFireworks, setShowFireworks] = useState(false);

  // Edit plan propagation dialog
  const [propagateDialog, setPropagateDialog] = useState<{
    entry: string;
    originalName: string;
    newName: string;
    plan: PlanDay;
    lineIndex: number;
  } | null>(null);

  // Replace exercise propagation dialog
  const [replacePropagateDialog, setReplacePropagateDialog] = useState<{
    oldExerciseName: string;
    newEntry: string;
    sourcePlanId: string;
  } | null>(null);

  // Confirm unchecked sets dialog
  const [uncheckedSetsDialog, setUncheckedSetsDialog] = useState<{
    week: number;
    day: string;
    uncheckedCount: number;
  } | null>(null);

  // Share card
  const [shareTarget, setShareTarget] = useState<{
    plan: PlanDay;
    completion: Completion;
  } | null>(null);
  const [userNickname, setUserNickname] = useState("");

  // Change day / rename session dialogs
  const [changeDayDialog, setChangeDayDialog] = useState<{planId: string; currentDay: string; week: number; sessionName: string} | null>(null);
  const [renameDialog, setRenameDialog] = useState<{planId: string; currentName: string} | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // Share to chat
  const [chatShareTarget, setChatShareTarget] = useState<PlanDay | null>(null);
  const [chatFriends, setChatFriends] = useState<{user_id: string; nickname: string}[]>([]);
  const [chatShareSending, setChatShareSending] = useState(false);

  // Copy to date
  const [copyToDateSource, setCopyToDateSource] = useState<PlanDay | null>(null);
  const [copyToDateSelected, setCopyToDateSelected] = useState<Date>(new Date());
  const [copyToDateConflict, setCopyToDateConflict] = useState<"ask" | "replace" | "add" | null>(null);
  const [copyToDateSaving, setCopyToDateSaving] = useState(false);

  // Exercise dropdown menu close on scroll
  const [openExerciseMenuId, setOpenExerciseMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openExerciseMenuId) return;
    const handleScroll = () => setOpenExerciseMenuId(null);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [openExerciseMenuId]);

  // Profile data for calorie estimation
  const [profileWeight, setProfileWeight] = useState<number | null>(null);
  const [profileGender, setProfileGender] = useState<string | null>(null);
  const [profileAge, setProfileAge] = useState<number | null>(null);

  // Calibration state
  const [needsCalibration, setNeedsCalibration] = useState(false);

  // Plan start date from profile (timezone-safe)
  const [planStartDate, setPlanStartDate] = useState<string | null>(null);

  // Fetch user nickname + calibration status + body data
  useEffect(() => {
    supabase.from("profiles").select("nickname, plan_start_calibrated, plan_start_date, weight_kg, gender, age").eq("user_id", userId).single().then(({ data }) => {
      if (data) {
        setUserNickname(data.nickname);
        if ((data as any).plan_start_date) {
          setPlanStartDate((data as any).plan_start_date);
        }
        if (!(data as any).plan_start_calibrated) {
          setNeedsCalibration(true);
        }
        if ((data as any).weight_kg) setProfileWeight(parseFloat((data as any).weight_kg));
        if (data.gender) setProfileGender(data.gender);
        if (data.age) setProfileAge(data.age);
      }
    });
  }, [userId]);

  const fetchData = useCallback(async () => {
    const [{ data: planData }, { data: compData }, { data: friendCommentsData }, { data: likesData }] = await Promise.all([
    supabase.from("workout_plans").select("*").eq("user_id", userId).order("week").order("day"),
    supabase.from("workout_completions").select("*").eq("user_id", userId),
    supabase.from("workout_comments").select("*").eq("target_user_id", userId).order("created_at", { ascending: true }),
    supabase.from("workout_likes").select("*").eq("target_user_id", userId)]
    );

    if (planData) {
      setPlans(planData);
      const wks = [...new Set(planData.map((p) => p.week))].sort((a, b) => a - b);
      setWeeks(wks);

      // Calculate active plan week based on plan start date (timezone-safe)
      const nonSinglePlans = planData.filter(p => p.week > 0);

      // Helper: compute week number from a plan start date string (YYYY-MM-DD) or fallback to created_at
      const computeWeekFromStart = (planWeeks: number[]) => {
        let planStartMonday: Date | null = null;

        // Prefer the explicit plan_start_date (timezone-safe, no UTC conversion issues)
        if (planStartDate) {
          const [y, m, d] = planStartDate.split("-").map(Number);
          const startLocal = new Date(y, m - 1, d);
          planStartMonday = getMonday(startLocal);
        } else if (nonSinglePlans.length > 0) {
          // Fallback to created_at (may have timezone issues)
          const earliest = nonSinglePlans.reduce((min, p) =>
            (p as any).created_at < (min as any).created_at ? p : min
          );
          planStartMonday = getMonday(new Date((earliest as any).created_at));
        }

        if (!planStartMonday) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const daysSinceStart = Math.floor((now.getTime() - planStartMonday.getTime()) / 86400000);
        const calcWeek = Math.floor(daysSinceStart / 7) + 1;
        const maxWeek = Math.max(...planWeeks);
        return Math.min(Math.max(calcWeek, 1), maxWeek);
      };

      if (nonSinglePlans.length > 0) {
        const planWeeks = wks.filter(w => w > 0);
        const activeWeek = computeWeekFromStart(planWeeks);
        if (activeWeek) setActivePlanWeek(activeWeek);
      }

      // Auto-navigate to the active (date-based) week on initial load
      if (wks.length > 0 && !initialWeekSet) {
        const compMap: Record<string, boolean> = {};
        if (compData) {
          for (const c of compData) {
            if (c.done) compMap[`${c.week}-${c.day}`] = true;
          }
        }

        // Prefer the date-based active week
        const planWeeks = wks.filter(w => w > 0);
        const dateBasedWeek = computeWeekFromStart(planWeeks);

        let targetWeek: number | undefined;

        if (dateBasedWeek && planWeeks.includes(dateBasedWeek)) {
          // Use the date-based active week if it has incomplete workouts
          const weekPlans = planData.filter(p => p.week === dateBasedWeek && p.session_name.trim() !== "" && p.details.trim() !== "");
          const allDone = weekPlans.length > 0 && weekPlans.every(p => compMap[`${p.week}-${p.day}`]);
          targetWeek = allDone
            // If active week is fully done, try next incomplete week FORWARD from dateBasedWeek
            ? wks.filter(w => w > dateBasedWeek).find(w => {
                const wp = planData.filter(p => p.week === w && p.session_name.trim() !== "" && p.details.trim() !== "");
                return wp.length > 0 && !wp.every(p => compMap[`${p.week}-${p.day}`]);
              }) ?? dateBasedWeek
            : dateBasedWeek;
        } else {
          // Fallback: first incomplete week forward from dateBasedWeek (or from start if no dateBasedWeek)
          const startFrom = dateBasedWeek ?? 0;
          targetWeek = wks.filter(w => w >= startFrom).find(w => {
            const weekPlans = planData.filter(p => p.week === w && p.session_name.trim() !== "" && p.details.trim() !== "");
            return weekPlans.length > 0 && !weekPlans.every(p => compMap[`${p.week}-${p.day}`]);
          });
        }

        setCurrentWeek(targetWeek ?? wks[wks.length - 1]);
        setInitialWeekSet(true);
      }

      if (planData.length === 0) {
        setMode("choose");
      } else {
        const allSingle = planData.every((p) => p.week === 0);
        setMode(allSingle ? "single" : "plan");
      }
    }
    // If planData is null (query failed / auth not ready), stay in "loading" and retry
    if (!planData) {
      return;
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

    // Set likes
    setWorkoutLikes((likesData || []) as any);

    // Collect all author IDs from comments and likes
    const allAuthorIds = new Set<string>();
    if (friendCommentsData) friendCommentsData.forEach((c) => allAuthorIds.add(c.author_id));
    if (likesData) (likesData as any[]).forEach((l) => allAuthorIds.add(l.user_id));

    if (friendCommentsData && friendCommentsData.length > 0) {
      setFriendComments(friendCommentsData);
    } else {
      setFriendComments([]);
    }

    if (allAuthorIds.size > 0) {
      const { data: authorProfiles } = await supabase
        .from("profiles")
        .select("user_id, nickname")
        .in("user_id", [...allAuthorIds]);
      if (authorProfiles) {
        const map: Record<string, string> = {};
        for (const p of authorProfiles) map[p.user_id] = p.nickname;
        setCommentNicknames(map);
      }
    }
  }, [userId, initialWeekSet, planStartDate]);

  useEffect(() => {
    fetchData();
    // Retry once after a short delay if auth session may not be ready yet
    const retryTimer = setTimeout(() => {
      if (mode === "loading") fetchData();
    }, 1500);
    return () => clearTimeout(retryTimer);
  }, [fetchData]);

  // Backfill disabled: automatic plan mutations caused data corruption for users.
  // Tröskellöpning details should be set at plan creation time, not retroactively.

  useEffect(() => {
    if (mode === "single" || mode === "plan") {
      supabase.from("custom_exercises").select("*").order("name").then(({ data }) => {
        if (data) setCustomExercises(data);
      });
    }
  }, [mode]);

  // Reset active day index when week changes — navigate to today's day
  useEffect(() => {
    const todayDayNames = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
    const todayName = todayDayNames[new Date().getDay()];
    const currentWeekDays = plans
      .filter((p) => p.week === currentWeek)
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    const todayIdx = currentWeekDays.findIndex(p => p.day === todayName);
    const newIdx = todayIdx >= 0 ? todayIdx : 0;
    setActiveDayIndex(newIdx);
    setExpandedDay(null);
  }, [currentWeek, plans]);

  // Auto-expand if the currently shown day has only one session
  useEffect(() => {
    if (!isMobile) return;
    const currentWeekDays = plans
      .filter((p) => p.week === currentWeek)
      .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    const activePlan = currentWeekDays[activeDayIndex];
    if (!activePlan) return;
    const sameDayPlans = currentWeekDays.filter(p => p.day === activePlan.day);
    if (sameDayPlans.length === 1) {
      setExpandedDay(`${activePlan.week}-${activePlan.day}`);
    }
  }, [activeDayIndex, currentWeek, plans, isMobile]);

  const allExercises = [
  ...exerciseLibrary.map((e) => ({ ...e, id: "", isCustom: false })),
  ...customExercises.map((e) => ({ name: e.name, category: e.category, muscleGroup: e.muscle_group, id: e.id, isCustom: true }))];

// Compute date for a plan week/day given a plan start date
const getPlanDayDate = (planStart: string | null, week: number, dayAbbr: string): string | null => {
  if (week <= 0) return null;
  if (!planStart) {
    // Fallback: show week + day abbreviation when no start date is set
    return `v${week} ${dayAbbr}`;
  }
  const [y, m, d] = planStart.split("-").map(Number);
  const startDate = new Date(y, m - 1, d);
  const startMonday = getMonday(startDate);
  const dayIndex = DAYS.indexOf(dayAbbr);
  if (dayIndex < 0) return null;
  const targetDate = new Date(startMonday);
  targetDate.setDate(targetDate.getDate() + (week - 1) * 7 + dayIndex);
  return format(targetDate, "d MMM yyyy", { locale: sv });
};

// Estimate calories burned for a workout based on exercises, weight, gender, and pulse
const estimateCalories = (
  details: string,
  loggedWeights: Record<string, any> | null,
  loggedPulse: number | null,
  weightKg: number,
  gender: string | null,
  age: number | null
): number => {
  let totalMinutes = 0;
  const lines = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  
  for (const line of lines) {
    // Check for conditioning: "30 min", "5 km"
    const timeMatch = line.match(/(\d+)\s*min/i);
    if (timeMatch) {
      totalMinutes += parseInt(timeMatch[1]);
      continue;
    }
    // Check for sets×reps format
    const setsMatch = line.match(/(\d+)\s*[×x]\s*(\d+)/i);
    if (setsMatch) {
      const sets = parseInt(setsMatch[1]);
      // ~2 min per set (including rest)
      totalMinutes += sets * 2;
      continue;
    }
    // Default: assume ~3 min per exercise line
    totalMinutes += 3;
  }

  // Also count logged conditioning data
  if (loggedWeights) {
    for (const [k, v] of Object.entries(loggedWeights)) {
      if (k.startsWith('__cond__')) {
        try {
          const data = typeof v === 'string' ? JSON.parse(v) : v;
          if (data.time && parseFloat(data.time) > 0) {
            // Already counted in details parse, skip duplicates
          }
        } catch {}
      }
    }
  }

  if (totalMinutes <= 0) return 0;

  // Use heart rate based formula if pulse is available (more accurate)
  if (loggedPulse && loggedPulse > 0 && age) {
    // Keytel et al. formula
    if (gender === 'male') {
      return Math.round(totalMinutes * ((-55.0969 + 0.6309 * loggedPulse + 0.1988 * weightKg + 0.2017 * age) / 4.184));
    } else {
      return Math.round(totalMinutes * ((-20.4022 + 0.4472 * loggedPulse - 0.1263 * weightKg + 0.074 * age) / 4.184));
    }
  }

  // Fallback: MET-based estimate
  // Strength training: MET ~5.0, Cardio: MET ~8.0, average ~6.0
  const avgMET = 6.0;
  const hours = totalMinutes / 60;
  return Math.round(avgMET * weightKg * hours);
};

  const filteredExercises = allExercises.filter((e) => {
    const matchesSearch = !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscle = !selectedMuscle || e.muscleGroup === selectedMuscle;
    return matchesSearch && matchesMuscle;
  });

  // Helper: count unchecked sets for a workout
  const countUncheckedSets = (week: number, day: string): number => {
    const k = `${week}-${day}`;
    // Check ALL plans for this week+day, not just the first one
    const dayPlans = plans.filter(p => p.week === week && p.day === day);
    if (dayPlans.length === 0) return 0;
    let unchecked = 0;
    for (const plan of dayPlans) {
      if (!plan.details) continue;
      const parts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        // Skip daily challenge exercises
        if (part.startsWith("⚔️")) continue;
        // Check if conditioning exercise — skip set tracking for those
        const isCondExercise = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|gång|intervallträning|stair\s*machine|trappmaskin/i.test(part);
        if (isCondExercise) continue;
        // Skip rest/rest day markers
        if (/^(vila|vilodag)/i.test(part)) continue;

        // Use the same name extraction logic as the rendering code
        const { clean: cleanPart } = extractRpe(part);
        const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
        const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
        const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
        const exerciseName = nameMatch ? nameMatch[1].trim() : null;
        const pName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;

        const sc = partStructMatch ? parseInt(partStructMatch[2]) : fallbackSetsMatch ? parseInt(fallbackSetsMatch[1]) : 1;
        const setsVal = getSetsDone(k, pName);
        for (let i = 0; i < sc; i++) {
          if (setsVal[i] !== "1") unchecked++;
        }
      }
    }
    return unchecked;
  };

  const toggleDone = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newDone = !current?.done;

    // If marking as done, check for unchecked sets first
    if (newDone) {
      const unchecked = countUncheckedSets(week, day);
      if (unchecked > 0) {
        setUncheckedSetsDialog({ week, day, uncheckedCount: unchecked });
        return;
      }
    }

    await performToggleDone(week, day);
  };

  const performToggleDone = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const current = completions[key];
    const newDone = !current?.done;

    setCompletions((prev) => ({
      ...prev,
      [key]: { ...prev[key], week, day, done: newDone, skipped: false, user_comment: comments[key] || "" }
    }));

    await safeUpsertCompletion(week, day, {
      done: newDone,
      skipped: false,
      user_comment: comments[key] || "",
    });

    if (newDone) {
      const plan = plans.find((p) => p.week === week && p.day === day);
      notifyFriendsOfCompletion(day, week, plan?.session_name || day);

      if (week > 0) {
        const weekPlans = plans.filter((p) => p.week === week);
        const scheduledPlans = weekPlans.filter((p) => p.session_name.trim() !== "" && p.details.trim() !== "");
        const updatedCompletions = { ...completions, [key]: { week, day, done: true, skipped: false, user_comment: comments[key] || "" } };
        const allDone = scheduledPlans.length > 0 && scheduledPlans.every((p) => {
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
      [key]: { ...prev[key], week, day, done: false, skipped: newSkipped, user_comment: comments[key] || "" }
    }));

    await safeUpsertCompletion(week, day, {
      done: false,
      skipped: newSkipped,
      user_comment: comments[key] || "",
    });
  };

  const saveComment = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    const newText = commentInput[key]?.trim();
    if (!newText) return;

    const existing = comments[key]?.trim();
    const updated = existing ? `${existing}\n${newText}` : newText;

    setComments((prev) => ({ ...prev, [key]: updated }));
    setCommentInput((prev) => ({ ...prev, [key]: "" }));

    await safeUpsertCompletion(week, day, { user_comment: updated });
  };

  const deleteCommentLine = async (week: number, day: string, lineIndex: number) => {
    const key = `${week}-${day}`;
    const lines = (comments[key] || "").split("\n").filter(Boolean);
    lines.splice(lineIndex, 1);
    const updated = lines.join("\n");
    setComments((prev) => ({ ...prev, [key]: updated }));
    await safeUpsertCompletion(week, day, { user_comment: updated });
  };

  const deleteFriendComment = async (commentId: string) => {
    await supabase.from("workout_comments").delete().eq("id", commentId);
    setFriendComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  // Set completion tracking helpers
  const getSetsDone = (weekDayKey: string, exerciseName: string): string => {
    const comp = completions[weekDayKey];
    const weights = comp?.logged_weights as Record<string, any> | null;
    return (weights?.[`__sets__${exerciseName}`] as string) || "";
  };

  // Safe upsert that always preserves ALL existing fields to prevent data loss
  const safeUpsertCompletion = async (
    week: number,
    day: string,
    updates: Partial<Completion & { logged_weights: Record<string, any> | null }>
  ) => {
    const entryKey = `${week}-${day}`;

    // Build payload from current state synchronously using a promise that resolves inside setState
    const payload = await new Promise<Record<string, any>>((resolve) => {
      setCompletions((prev: Record<string, any>) => {
        const prevComp = prev[entryKey] || {};
        const merged = {
          week,
          day,
          done: prevComp.done || false,
          skipped: prevComp.skipped || false,
          user_comment: prevComp.user_comment || "",
          logged_tempo: prevComp.logged_tempo ?? null,
          logged_pulse: prevComp.logged_pulse ?? null,
          logged_distance_km: prevComp.logged_distance_km ?? null,
          logged_weights: prevComp.logged_weights ?? null,
          ...updates,
        };

        resolve(merged);

        return {
          ...prev,
          [entryKey]: merged as any,
        };
      });
    });

    const upsertData = {
        user_id: userId,
        week,
        day,
        done: payload.done,
        skipped: payload.skipped,
        user_comment: payload.user_comment,
        logged_tempo: payload.logged_tempo,
        logged_pulse: payload.logged_pulse,
        logged_distance_km: payload.logged_distance_km,
        logged_weights: payload.logged_weights,
      };

    // Queue to localStorage first so data survives if the page is killed before network completes
    queueOfflineUpsert("workout_completions", upsertData as any, "user_id,week,day");

    const { error } = await supabase.from("workout_completions").upsert(
      upsertData as any,
      { onConflict: "user_id,week,day" }
    );

    // If network save succeeded, remove from offline queue (it will be a duplicate but harmless)
    if (!error) {
      // Clear the queued item since it saved successfully
      try {
        const raw = localStorage.getItem("grim_offline_queue");
        if (raw) {
          const queue = JSON.parse(raw) as any[];
          // Remove matching items (same table + user + week + day)
          const filtered = queue.filter((item: any) =>
            !(item.table === "workout_completions" &&
              item.data.user_id === userId &&
              item.data.week === week &&
              item.data.day === day)
          );
          localStorage.setItem("grim_offline_queue", JSON.stringify(filtered));
        }
      } catch { /* ignore */ }
    }
    triggerSave();
  };

  const updateCompletionWeights = async (
    week: number,
    day: string,
    updater: (current: Record<string, any>) => Record<string, any>
  ) => {
    const entryKey = `${week}-${day}`;

    // Compute the new weights using current state via promise
    const nextWeights = await new Promise<Record<string, any>>((resolve) => {
      setCompletions((prev: Record<string, any>) => {
        const prevComp = prev[entryKey] || {};
        const currentWeights = (prevComp.logged_weights || {}) as Record<string, any>;
        resolve(updater(currentWeights));
        return prev; // Don't update yet - safeUpsertCompletion will do it
      });
    });

    await safeUpsertCompletion(week, day, { logged_weights: nextWeights });
  };

  const toggleSetDone = async (week: number, day: string, exerciseName: string, setIndex: number, totalSets: number, defaultKg?: string, defaultReps?: string) => {
    const k = `${week}-${day}`;
    const current = getSetsDone(k, exerciseName);
    const arr = Array.from({ length: totalSets }, (_, i) => current[i] === "1");
    arr[setIndex] = !arr[setIndex];
    const setsStr = arr.map(b => b ? "1" : "0").join("");

    const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
    const updated = { ...existing, [`__sets__${exerciseName}`]: setsStr };

    // Ensure __setdata__ exists so kg/reps are always persisted for stats
    const setDataKey = `__setdata__${exerciseName}`;
    if (!updated[setDataKey]) {
      const dkg = defaultKg || "";
      const dreps = defaultReps || "10";
      const initData = Array.from({ length: totalSets }, () => ({ kg: dkg, reps: dreps }));
      updated[setDataKey] = JSON.stringify(initData);
    }

    // Check if all sets across all exercises in this workout are now done
    const plan = plans.find(p => p.week === week && p.day === day);
    let allExercisesDone = false;
    if (plan && plan.details) {
      const parts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      allExercisesDone = parts.every(part => {
        // Skip conditioning exercises
        const { name: pName, weight: pWeight } = parseExerciseWeight(part);
        const isCondFormat = pWeight && (pWeight.includes("min") || pWeight.includes("/km"));
        if (isCondFormat) return true; // conditioning doesn't need set tracking
        
        const { clean: cp } = extractRpe(pWeight || '');
        const sm = cp?.match(/^(\d+)[×x](\d+)/i);
        const fbm = !sm && cp ? cp.match(/(\d+)\s*[×x]\s*\S+/) : null;
        const sc = sm ? parseInt(sm[1]) : fbm ? parseInt(fbm[1]) : 1;
        
        const setsKey = `__sets__${pName}`;
        const setsVal = setsKey === `__sets__${exerciseName}` ? setsStr : (updated[setsKey] as string || "");
        return setsVal.length >= sc && !setsVal.includes("0") && setsVal.split("").filter(c => c === "1").length >= sc;
      });
    }

    const newDone = allExercisesDone || (completions[k]?.done || false);

    setCompletions(prev => ({
      ...prev,
      [k]: { ...prev[k], week, day, done: newDone, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
    }));

    await safeUpsertCompletion(week, day, {
      done: newDone,
      logged_weights: updated,
    });

    // Notify friends and check fireworks if workout was just completed
    if (allExercisesDone && !completions[k]?.done && plan) {
      notifyFriendsOfCompletion(day, week, plan.session_name || day);

      // Check if all scheduled workouts in this week are now done
      if (week > 0) {
        const weekPlans = plans.filter(p => p.week === week);
        const scheduledPlans = weekPlans.filter(p => p.session_name.trim() !== "" && p.details.trim() !== "");
        const updatedCompletions = { ...completions, [k]: { ...completions[k], week, day, done: true } };
        const allWeekDone = scheduledPlans.length > 0 && scheduledPlans.every(p => {
          const wk = `${p.week}-${p.day}`;
          return updatedCompletions[wk]?.done;
        });
        if (allWeekDone) {
          setShowFireworks(true);
        }
      }
    }
  };

  // Modify set count for an exercise in a plan
  const modifySetCount = async (planId: string, exerciseIndex: number, delta: number, week: number, day: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    const line = lines[exerciseIndex];
    if (!line) return;

    // Match "NxM" pattern (sets x reps)
    const setsMatch = line.match(/(\d+)\s*([×x])\s*(\S+)/i);
    if (setsMatch) {
      const oldSets = parseInt(setsMatch[1]);
      const newSets = Math.max(1, oldSets + delta);
      if (newSets === oldSets) return;
      lines[exerciseIndex] = line.replace(/\d+\s*[×x]/i, `${newSets}×`);
    } else {
      // No sets pattern found - add one
      const { name, weight } = parseExerciseWeight(line);
      if (delta > 0) {
        const newSets = 1 + delta;
        lines[exerciseIndex] = weight ? `${name} — ${newSets}×10 @ ${weight}` : `${name} — ${newSets}×10`;
      } else return;
    }

    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", planId);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, details: newDetails } : p));
    triggerSave();

    // Adjust set tracking data
    const k = `${week}-${day}`;
    const partName = parseExerciseWeight(lines[exerciseIndex]).name;
    const currentSetsStr = getSetsDone(k, partName);
    const currentSetData = getSetData(k, partName);
    
    if (delta > 0) {
      // Add a set - extend tracking
      const newSetsStr = currentSetsStr + "0";
      const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
      const updated = { ...existing, [`__sets__${partName}`]: newSetsStr };
      setCompletions(prev => ({
        ...prev,
        [k]: { ...prev[k], week, day, done: prev[k]?.done || false, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
      }));
    } else if (delta < 0 && currentSetsStr.length > 1) {
      // Remove last set
      const newSetsStr = currentSetsStr.slice(0, -1);
      const newSetData = currentSetData.slice(0, -1);
      const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
      const updated = { ...existing, [`__sets__${partName}`]: newSetsStr, [`__setdata__${partName}`]: JSON.stringify(newSetData) };
      setCompletions(prev => ({
        ...prev,
        [k]: { ...prev[k], week, day, done: prev[k]?.done || false, skipped: prev[k]?.skipped || false, user_comment: prev[k]?.user_comment || "", logged_weights: updated }
      }));
      await safeUpsertCompletion(week, day, { logged_weights: updated });
    }
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

    await updateCompletionWeights(week, day, (existing) => ({
      ...existing,
      [`__setdata__${exerciseName}`]: JSON.stringify(data),
    }));
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
  // adaptProgression removed: automatic plan mutations caused data corruption.
  // Progression is now only applied when the user explicitly chooses "Alla framtida" in the edit dialog.

  const leavePlan = async () => {
    if (!confirm("Är du säker? Schemat arkiveras under din profil innan det tas bort.")) return;

    // Archive plan data before deleting
    try {
      const [{ data: planData }, { data: compData }] = await Promise.all([
        supabase.from("workout_plans").select("*").eq("user_id", userId),
        supabase.from("workout_completions").select("*").eq("user_id", userId),
      ]);

      if (planData && planData.length > 0) {
        // Derive plan name from first non-empty session
        const firstSession = planData.find(p => p.session_name.trim() !== "");
        const planName = firstSession ? `Schema (${planData.filter(p => p.session_name.trim() !== "").length} pass, ${[...new Set(planData.map(p => p.week))].length} veckor)` : "Schema";

        await supabase.from("archived_plans").insert({
          user_id: userId,
          plan_name: planName,
          plan_data: planData as any,
          completion_data: (compData || []) as any,
        });
      }
    } catch (e) {
      console.error("Failed to archive plan:", e);
    }

    await Promise.all([
      supabase.from("workout_plans").delete().eq("user_id", userId),
      supabase.from("workout_completions").delete().eq("user_id", userId),
    ]);
    setPlans([]);
    setWeeks([]);
    setCompletions({});
    setMode("choose");
  };

  const addSingleWorkout = async (copyFrom?: PlanDay) => {
    const name = copyFrom ? copyFrom.session_name : singleName.trim();
    if (!name) return;

    // Use date + short random suffix for unique day key
    const dateStr = format(singleDate, "yyyy-MM-dd");
    const uniqueKey = `${dateStr}_${Math.random().toString(36).slice(2, 6)}`;

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

    // Copy logged weights/reps from the source workout's completion
    if (copyFrom) {
      const sourceKey = `${copyFrom.week}-${copyFrom.day}`;
      const sourceCompletion = completions[sourceKey];
      if (sourceCompletion?.logged_weights && Object.keys(sourceCompletion.logged_weights).length > 0) {
        await supabase.from("workout_completions").upsert({
          user_id: userId,
          week: 0,
          day: uniqueKey,
          done: false,
          skipped: false,
          logged_weights: sourceCompletion.logged_weights,
        }, { onConflict: "user_id,week,day" });
      }
    }

    // Navigate to the week of the new workout
    const allSinglePlans = plans.filter(p => p.week === 0);
    const allDates = [...allSinglePlans.map(p => p.day), uniqueKey];
    const sortedDates = allDates.map(d => d.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]).filter(Boolean).sort();
    if (sortedDates.length > 0) {
      const fm = getMonday(parseISO(sortedDates[0]!));
      const newWeek = computeSingleWeek(uniqueKey, fm);
      setSingleCurrentWeek(newWeek);
    }

    setSingleName("");
    setSingleDate(new Date());
    setShowAddSingle(false);
    setShowCopyPicker(false);
    if (copyFrom) {
      toast.success("Pass kopierat med vikter & reps från förra gången. Öka själv för progression! 💪");
    }
    fetchData();
  };

  // Helper: map a calendar date to plan week number and day abbreviation
  const mapDateToPlanWeekDay = (date: Date): { week: number; day: string } | null => {
    if (mode !== "plan" || !planStartDate) return null;
    const [y, m, d] = planStartDate.split("-").map(Number);
    const startLocal = new Date(y, m - 1, d);
    const planStartMonday = getMonday(startLocal);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((targetDate.getTime() - planStartMonday.getTime()) / 86400000);
    if (diffDays < 0) return null;
    const weekNum = Math.floor(diffDays / 7) + 1;
    const dayIndex = ((targetDate.getDay() + 6) % 7); // 0=Mon, 6=Sun
    const dayName = DAYS[dayIndex];
    const maxWeek = Math.max(...weeks.filter(w => w > 0), 0);
    if (weekNum > maxWeek || weekNum < 1) return null;
    return { week: weekNum, day: dayName };
  };

  const handleCopyToDateConfirm = async () => {
    if (!copyToDateSource) return;

    const planTarget = mapDateToPlanWeekDay(copyToDateSelected);

    if (planTarget) {
      // Plan mode: check if plan has exercises on that week/day
      const existingOnDay = plans.filter(p => p.week === planTarget.week && p.day === planTarget.day && p.details.trim() !== "");
      if (existingOnDay.length > 0) {
        setCopyToDateConflict("ask");
        return;
      }
    } else {
      // Standalone mode: check for existing standalone exercises on date
      const dateStr = format(copyToDateSelected, "yyyy-MM-dd");
      const existingOnDate = plans.filter(p => p.week === 0 && p.day.startsWith(dateStr) && p.details.trim() !== "");
      if (existingOnDate.length > 0) {
        setCopyToDateConflict("ask");
        return;
      }
    }

    await executeCopyToDate("add");
  };

  const executeCopyToDate = async (conflictMode: "replace" | "add") => {
    if (!copyToDateSource) return;
    setCopyToDateSaving(true);

    const planTarget = mapDateToPlanWeekDay(copyToDateSelected);
    const details = copyToDateSource.details || "";

    if (planTarget) {
      // --- Plan mode: insert into plan week/day ---
      const existingOnDay = plans.filter(p => p.week === planTarget.week && p.day === planTarget.day);

      if (conflictMode === "replace") {
        // Clear existing details on that day
        for (const p of existingOnDay) {
          await supabase.from("workout_plans").update({ details, session_name: copyToDateSource.session_name }).eq("id", p.id);
          // Clear completion
          await supabase.from("workout_completions").delete().eq("user_id", userId).eq("week", planTarget.week).eq("day", planTarget.day);
        }
        if (existingOnDay.length === 0) {
          await supabase.from("workout_plans").insert({
            user_id: userId,
            week: planTarget.week,
            day: planTarget.day,
            session_name: copyToDateSource.session_name,
            details,
            tempo: copyToDateSource.tempo || null
          });
        }
      } else {
        // Add mode
        const withDetails = existingOnDay.filter(p => p.details.trim() !== "");
        if (withDetails.length > 0) {
          const target = withDetails[0];
          const combined = [target.details.trim(), details.trim()].filter(Boolean).join("\n");
          await supabase.from("workout_plans").update({ details: combined }).eq("id", target.id);
        } else if (existingOnDay.length > 0) {
          // Day exists but empty details
          await supabase.from("workout_plans").update({ details, session_name: copyToDateSource.session_name }).eq("id", existingOnDay[0].id);
        } else {
          await supabase.from("workout_plans").insert({
            user_id: userId,
            week: planTarget.week,
            day: planTarget.day,
            session_name: copyToDateSource.session_name,
            details,
            tempo: copyToDateSource.tempo || null
          });
        }
      }

      // Copy logged weights if available
      const sourceKey = `${copyToDateSource.week}-${copyToDateSource.day}`;
      const sourceCompletion = completions[sourceKey];
      if (sourceCompletion?.logged_weights && Object.keys(sourceCompletion.logged_weights).length > 0) {
        await supabase.from("workout_completions").upsert({
          user_id: userId,
          week: planTarget.week,
          day: planTarget.day,
          done: false,
          skipped: false,
          logged_weights: sourceCompletion.logged_weights,
        }, { onConflict: "user_id,week,day" });
      }

      toast.success(`Pass kopierat till v${planTarget.week} ${planTarget.day}!`);
    } else {
      // --- Standalone mode (fallback) ---
      const dateStr = format(copyToDateSelected, "yyyy-MM-dd");

      if (conflictMode === "replace") {
        const existingOnDate = plans.filter(p => p.week === 0 && p.day.startsWith(dateStr));
        for (const p of existingOnDate) {
          if (p.id) {
            await supabase.from("workout_plans").delete().eq("id", p.id);
            await supabase.from("workout_completions").delete().eq("user_id", userId).eq("week", 0).eq("day", p.day);
          }
        }
      }

      const uniqueKey = `${dateStr}_${Math.random().toString(36).slice(2, 6)}`;

      if (conflictMode === "add") {
        const existingOnDate = plans.filter(p => p.week === 0 && p.day.startsWith(dateStr) && p.details.trim() !== "");
        if (existingOnDate.length > 0) {
          const target = existingOnDate[0];
          const combined = [target.details.trim(), details.trim()].filter(Boolean).join("\n");
          await supabase.from("workout_plans").update({ details: combined }).eq("id", target.id);
          toast.success("Övningar tillagda!");
          setCopyToDateSource(null);
          setCopyToDateConflict(null);
          setCopyToDateSaving(false);
          fetchData();
          return;
        }
      }

      await supabase.from("workout_plans").insert({
        user_id: userId,
        week: 0,
        day: uniqueKey,
        session_name: copyToDateSource.session_name,
        details,
        tempo: copyToDateSource.tempo || null
      });

      const sourceKey = `${copyToDateSource.week}-${copyToDateSource.day}`;
      const sourceCompletion = completions[sourceKey];
      if (sourceCompletion?.logged_weights && Object.keys(sourceCompletion.logged_weights).length > 0) {
        await supabase.from("workout_completions").upsert({
          user_id: userId,
          week: 0,
          day: uniqueKey,
          done: false,
          skipped: false,
          logged_weights: sourceCompletion.logged_weights,
        }, { onConflict: "user_id,week,day" });
      }

      toast.success("Pass kopierat!");
    }

    setCopyToDateSource(null);
    setCopyToDateConflict(null);
    setCopyToDateSaving(false);
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

  // Strip daily challenge lines from workout details
  const stripChallengeLines = (details: string): string => {
    return details.split("\n").filter(line => !line.trim().startsWith("⚔️ Utmaning:")).join("\n");
  };

  // Change weekday for a workout in a plan week
  const changeWorkoutDay = async (planId: string, newDay: string, week: number) => {
    // Strip challenge lines before moving — challenges stay on their original day
    const plan = plans.find(p => p.id === planId);
    const cleanDetails = plan ? stripChallengeLines(plan.details) : undefined;
    await supabase.from("workout_plans").update({ day: newDay, ...(cleanDetails !== undefined ? { details: cleanDetails } : {}) }).eq("id", planId);

    // Also move any completion data to the new day
    const oldPlan = plans.find(p => p.id === planId);
    if (oldPlan) {
      const oldKey = `${week}-${oldPlan.day}`;
      const comp = completions[oldKey];
      if (comp) {
        // Delete old completion, insert new one with new day
        await supabase.from("workout_completions").delete()
          .eq("user_id", userId).eq("week", week).eq("day", oldPlan.day);
        await supabase.from("workout_completions").upsert({
          user_id: userId, week, day: newDay, done: comp.done, skipped: comp.skipped,
          user_comment: comp.user_comment || "",
          logged_tempo: comp.logged_tempo, logged_pulse: comp.logged_pulse,
          logged_distance_km: comp.logged_distance_km, logged_weights: comp.logged_weights as any,
        }, { onConflict: "user_id,week,day" });
      }
    }

    setChangeDayDialog(null);
    triggerSave();
    fetchData();
  };

  // Rename a session
  const renameSession = async (planId: string, newName: string) => {
    if (!newName.trim()) return;
    await supabase.from("workout_plans").update({ session_name: newName.trim() }).eq("id", planId);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, session_name: newName.trim() } : p));
    setRenameDialog(null);
    setRenameInput("");
    triggerSave();
  };

  const parseExerciseWeight = (line: string): {name: string;weight: string | null;} => {
    const match = line.match(/^(.+?)\s*—\s*(.+)$/);
    if (match) return { name: match[1].trim(), weight: match[2].trim() };
    return { name: line.trim(), weight: null };
  };

  // Find last weight used for an exercise across ALL workouts (single + plan),
  // preferring matching rep count. Returns e.g. "3×10 @ 80 kg" or "80 kg (8 reps)"
  const findLastWeight = (exerciseName: string, targetReps?: number): string | null => {
    const exLower = exerciseName.toLowerCase();

    // Collect all logged set data across all completed workouts
    type SetInfo = { kg: number; reps: number; label: string };
    const allSets: SetInfo[] = [];

    // Search all completions for logged set data
    for (const [k, comp] of Object.entries(completions)) {
      if (!comp?.done) continue;
      const weights = comp.logged_weights as Record<string, any> | null;
      if (!weights) continue;
      const setDataRaw = weights[`__setdata__${exerciseName}`] ?? weights[`__setdata__${exLower}`];
      if (setDataRaw) {
        try {
          const setData = typeof setDataRaw === 'string' ? JSON.parse(setDataRaw) : setDataRaw;
          if (Array.isArray(setData) && setData.length > 0) {
            for (const s of setData) {
              const kg = parseFloat(s.kg);
              const reps = parseInt(s.reps);
              if (kg > 0) {
                allSets.push({ kg, reps: reps || 0, label: `${kg} kg (${reps || '?'} reps)` });
              }
            }
          }
        } catch {}
      }
    }

    // If we found logged sets, prefer matching rep count
    if (allSets.length > 0) {
      if (targetReps) {
        const matching = allSets.filter(s => s.reps === targetReps);
        if (matching.length > 0) {
          const best = matching[matching.length - 1];
          return `${best.kg} kg (${best.reps} reps)`;
        }
      }
      // Fallback: latest set
      const last = allSets[allSets.length - 1];
      return `${last.kg} kg (${last.reps || '?'} reps)`;
    }

    // Fallback: search plan details text for weight info
    const allPlans = [...plans].sort((a, b) => {
      if (a.week !== b.week) return b.week - a.week;
      return b.day.localeCompare(a.day);
    });
    for (const plan of allPlans) {
      if (!plan.details) continue;
      for (const line of plan.details.split("\n")) {
        const { name, weight } = parseExerciseWeight(line);
        if (name.toLowerCase() === exLower && weight) {
          return weight;
        }
      }
    }
    return null;
  };

  // Find last logged tempo for a conditioning exercise across all workouts
  const findLastCondTempo = (exerciseName: string): string | null => {
    // Check single workouts (week 0)
    const singlePlans = plans.filter((p) => p.week === 0).sort((a, b) => b.day.localeCompare(a.day));
    for (const plan of singlePlans) {
      if (!plan.details) continue;
      const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      for (const line of lines) {
        const { name } = parseExerciseWeight(line);
        if (name.toLowerCase() === exerciseName.toLowerCase()) {
          const tempoM = line.match(/([\d:.]+)\s*\/km/);
          if (tempoM) return tempoM[1];
        }
      }
      // Also check logged conditioning data
      const k = `0-${plan.day}`;
      const comp = completions[k];
      if (comp?.done) {
        const weights = comp.logged_weights as Record<string, any> | null;
        if (weights) {
          for (const [wk, val] of Object.entries(weights)) {
            if (wk.startsWith('__cond__') && wk.toLowerCase().includes(exerciseName.toLowerCase())) {
              try {
                const data = typeof val === 'string' ? JSON.parse(val) : val;
                if (data.tempo) return data.tempo;
              } catch {}
            }
          }
        }
      }
    }
    // Check plan workouts
    const planWorkouts = plans.filter(p => p.week > 0).sort((a, b) => b.week - a.week);
    for (const plan of planWorkouts) {
      const k = `${plan.week}-${plan.day}`;
      const comp = completions[k];
      if (!comp?.done) continue;
      const weights = comp.logged_weights as Record<string, any> | null;
      if (weights) {
        for (const [wk, val] of Object.entries(weights)) {
          if (wk.startsWith('__cond__') && wk.toLowerCase().includes(exerciseName.toLowerCase())) {
            try {
              const data = typeof val === 'string' ? JSON.parse(val) : val;
              if (data.tempo) return data.tempo;
            } catch {}
          }
        }
      }
      if (comp.logged_tempo) {
        // Check if this plan's details contain the exercise
        const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        for (const line of lines) {
          const { name } = parseExerciseWeight(line);
          if (name.toLowerCase() === exerciseName.toLowerCase()) {
            return comp.logged_tempo;
          }
        }
      }
    }
    return null;
  };

  // Auto-calc for conditioning: fill in the 3rd field when 2 are provided
  const parseCondTempo = (t: string): number | null => {
    const m = t.trim().match(/^(\d+)[:\.](\d+)$/);
    if (m) return parseInt(m[1]) + parseInt(m[2]) / 60;
    const v = parseFloat(t.replace(",", "."));
    return isNaN(v) ? null : v;
  };

  const formatCondTempo = (minPerKm: number): string => {
    const mins = Math.floor(minPerKm);
    const secs = Math.round((minPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper: check if exercise is a stair machine (Trappmaskin)
  const isStairMachine = (name: string) => name.toLowerCase().includes("trappmaskin");

  const autoCalcCond = (time: string, tempo: string, dist: string, changed: "time" | "tempo" | "distance") => {
    const t = parseFloat(time.replace(",", "."));
    const p = parseCondTempo(tempo);
    const d = parseFloat(dist.replace(",", "."));

    if (changed === "time" && t > 0 && p && p > 0) {
      setCondDistanceInput(String(Math.round((t / p) * 100) / 100));
    } else if (changed === "time" && t > 0 && d > 0) {
      setCondTempoInput(formatCondTempo(t / d));
    } else if (changed === "tempo" && p && p > 0 && t > 0) {
      setCondDistanceInput(String(Math.round((t / p) * 100) / 100));
    } else if (changed === "tempo" && p && p > 0 && d > 0) {
      setCondTimeInput(String(Math.round(p * d * 10) / 10));
    } else if (changed === "distance" && d > 0 && t > 0) {
      setCondTempoInput(formatCondTempo(t / d));
    } else if (changed === "distance" && d > 0 && p && p > 0) {
      setCondTimeInput(String(Math.round(p * d * 10) / 10));
    }
  };

  // Open weight dialog when selecting an exercise
  const handleExerciseSelect = (planId: string, exerciseName: string) => {
    // Check if exercise is conditioning type
    const exercise = allExercises.find((e) => e.name === exerciseName);
    if (exercise && exercise.category === "kondition") {
      setConditioningDialog({ planId, exerciseName });
      if (isStairMachine(exerciseName)) {
        setCondTempoInput("");
        setCondSpmInput("");
      } else {
        const lastCondTempo = findLastCondTempo(exerciseName);
        setCondTempoInput(lastCondTempo || "");
        setCondSpmInput("");
      }
      setCondTimeInput("");
      setCondDistanceInput("");
      setCondIntervalsInput("");
      setCondRestInput("");
      setCondPulseInput("");
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

    let newDetails: string;
    let wasReplace = false;
    let oldName = "";
    if (replaceExerciseTarget && replaceExerciseTarget.planId === plan.id) {
      // Replace mode: substitute the line at the target index
      const separator = plan.details.includes("\n") ? "\n" : "; ";
      const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      lines[replaceExerciseTarget.lineIndex] = entry;
      newDetails = lines.join(separator);
      wasReplace = true;
      oldName = replaceExerciseTarget.name;
      setReplaceExerciseTarget(null);
    } else {
      const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
      newDetails = isWarmupMode
        ? (plan.details ? `${entry}${joinSep}${plan.details}` : entry)
        : (plan.details ? `${plan.details}${joinSep}${entry}` : entry);
    }

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
    setWeightDialog(null);
    setWeightInput("");
    setRepsInput("10");
    setSetsInput("3");
    setIsWarmupMode(false);

    // Show propagation dialog if this was a replacement in plan mode
    if (wasReplace && mode === "plan" && plan.week > 0) {
      setReplacePropagateDialog({ oldExerciseName: oldName, newEntry: entry, sourcePlanId: plan.id });
    }
  };

  // Add conditioning exercise with tempo, time, distance (+ intervals for Intervallträning)
  const addConditioningExercise = async () => {
    if (!conditioningDialog) return;
    const plan = plans.find((p) => p.id === conditioningDialog.planId);
    if (!plan) return;

    const infoParts: string[] = [];
    const isInterval = conditioningDialog.exerciseName.toLowerCase().includes("intervall");
    const isStair = isStairMachine(conditioningDialog.exerciseName);
    
    if (isInterval && condIntervalsInput.trim()) {
      const intervalPart = `${condIntervalsInput.trim()}×${condTimeInput.trim() || "?"} min`;
      infoParts.push(intervalPart);
      if (condRestInput.trim()) infoParts.push(`${condRestInput.trim()} min vila`);
    } else {
      if (condTimeInput.trim()) infoParts.push(`${condTimeInput.trim()} min`);
    }
    if (isStair) {
      if (condSpmInput.trim()) infoParts.push(`${condSpmInput.trim()} spm`);
      const time = parseFloat(condTimeInput.replace(",", "."));
      const spm = parseFloat(condSpmInput.replace(",", "."));
      if (time > 0 && spm > 0) infoParts.push(`${Math.round(time * spm)} steg`);
    } else {
      if (condTempoInput.trim()) infoParts.push(`${condTempoInput.trim()}/km`);
      if (condDistanceInput.trim()) infoParts.push(`${condDistanceInput.trim()} km`);
    }
    if (condPulseInput.trim()) infoParts.push(`${condPulseInput.trim()} bpm`);
    
    const entry = infoParts.length > 0 ? `${conditioningDialog.exerciseName} — ${infoParts.join(", ")}` : conditioningDialog.exerciseName;

    let newDetails: string;
    let wasReplace = false;
    let oldName = "";
    if (replaceExerciseTarget && replaceExerciseTarget.planId === plan.id) {
      const separator = plan.details.includes("\n") ? "\n" : "; ";
      const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
      lines[replaceExerciseTarget.lineIndex] = entry;
      newDetails = lines.join(separator);
      wasReplace = true;
      oldName = replaceExerciseTarget.name;
      setReplaceExerciseTarget(null);
    } else {
      const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
      newDetails = isWarmupMode
        ? (plan.details ? `${entry}${joinSep}${plan.details}` : entry)
        : (plan.details ? `${plan.details}${joinSep}${entry}` : entry);
    }

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
    setConditioningDialog(null);
    setCondTempoInput("");
    setCondTimeInput("");
    setCondDistanceInput("");
    setCondIntervalsInput("");
    setCondRestInput("");
    setCondPulseInput("");
    setCondSpmInput("");
    setIsWarmupMode(false);

    // Show propagation dialog if this was a replacement in plan mode
    if (wasReplace && mode === "plan" && plan.week > 0) {
      setReplacePropagateDialog({ oldExerciseName: oldName, newEntry: entry, sourcePlanId: plan.id });
    }
  };

  // Delete a logged conditioning line from plan details
  const deleteConditioningLine = async (planId: string, lineIndex: number) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    lines.splice(lineIndex, 1);
    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", planId);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, details: newDetails } : p));
    triggerSave();
  };

  // Delete direct logged conditioning fields from completion
  const deleteDirectCondLog = async (week: number, day: string) => {
    const key = `${week}-${day}`;
    setCompletions(prev => ({
      ...prev,
      [key]: { ...prev[key], logged_tempo: null, logged_pulse: null, logged_distance_km: null }
    }));
    await supabase.from("workout_completions").update({
      logged_tempo: null, logged_pulse: null, logged_distance_km: null
    }).eq("user_id", userId).eq("week", week).eq("day", day);
  };

  // Delete a logged conditioning payload stored in logged_weights (__cond__...)
  const deleteCondWeightLog = async (week: number, day: string, condWeightKey: string) => {
    const key = `${week}-${day}`;
    const currentWeights = (completions[key]?.logged_weights || {}) as Record<string, any>;
    if (!Object.prototype.hasOwnProperty.call(currentWeights, condWeightKey)) return;

    const { [condWeightKey]: _removed, ...restWeights } = currentWeights;
    const payload = Object.keys(restWeights).length > 0 ? restWeights : null;

    setCompletions(prev => ({
      ...prev,
      [key]: { ...prev[key], logged_weights: payload as any }
    }));

    await safeUpsertCompletion(week, day, { logged_weights: payload });
  };

  // Start editing a logged conditioning line
  const startEditCondLine = (planId: string, lineIndex: number, name: string, info: string) => {
    const timeM = info.match(/(\d+(?:[.,]\d+)?)\s*min/);
    const tempoM = info.match(/(\d+:\d+)\/km/);
    const distM = info.match(/([\d.,]+)\s*km(?!\/)/);
    const pulseM = info.match(/(\d+)\s*bpm/);
    const spmM = info.match(/(\d+)\s*spm/);
    setCondTimeInput(timeM ? timeM[1] : "");
    setCondTempoInput(tempoM ? tempoM[1] : "");
    setCondDistanceInput(distM ? distM[1].replace(",", ".") : "");
    setCondPulseInput(pulseM ? pulseM[1] : "");
    setCondSpmInput(spmM ? spmM[1] : "");
    setCondIntervalsInput("");
    setCondRestInput("");
    setEditingCondLine({ planId, lineIndex, name });
  };

  // State for editing a conditioning line
  const [editingCondLine, setEditingCondLine] = useState<{ planId: string; lineIndex: number; name: string } | null>(null);

  // Save edited conditioning line
  const saveEditedCondLine = async () => {
    if (!editingCondLine) return;
    const plan = plans.find(p => p.id === editingCondLine.planId);
    if (!plan) return;
    const infoParts: string[] = [];
    const isStair = isStairMachine(editingCondLine.name);
    if (condTimeInput.trim()) infoParts.push(`${condTimeInput.trim()} min`);
    if (isStair) {
      if (condSpmInput.trim()) infoParts.push(`${condSpmInput.trim()} spm`);
      const time = parseFloat(condTimeInput.replace(",", "."));
      const spm = parseFloat(condSpmInput.replace(",", "."));
      if (time > 0 && spm > 0) infoParts.push(`${Math.round(time * spm)} steg`);
    } else {
      if (condTempoInput.trim()) infoParts.push(`${condTempoInput.trim()}/km`);
      if (condDistanceInput.trim()) infoParts.push(`${condDistanceInput.trim()} km`);
    }
    if (condPulseInput.trim()) infoParts.push(`${condPulseInput.trim()} bpm`);
    const entry = infoParts.length > 0 ? `${editingCondLine.name} — ${infoParts.join(", ")}` : editingCondLine.name;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    lines[editingCondLine.lineIndex] = entry;
    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
    setEditingCondLine(null);
    setCondTimeInput("");
    setCondTempoInput("");
    setCondDistanceInput("");
    setCondPulseInput("");
    setCondSpmInput("");
  };

  const addExerciseToPlan = async (plan: PlanDay, exerciseName: string) => {
    const joinSep = plan.details.includes("\n") ? "\n" : plan.details.includes(";") ? "; " : "\n";
    const newDetails = plan.details ?
    `${plan.details}${joinSep}${exerciseName}` :
    exerciseName;

    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);

    setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, details: newDetails } : p));
    triggerSave();
  };

  // Save edited exercise line (sets/reps/weight)
  const saveEditedExercise = async (propagate = false) => {
    if (!editingExercise) return;
    const plan = plans.find((p) => p.id === editingExercise.planId);
    if (!plan) return;

    const sets = parseInt(editingExercise.sets) || 3;
    const reps = parseInt(editingExercise.reps) || 10;
    const w = editingExercise.weight.trim();

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
    triggerSave();
    // In plan mode, ask about propagation to future weeks
    if (mode === "plan" && plan.week > 0 && !propagate) {
      setPropagateDialog({ entry, originalName: editingExercise.originalName, newName: editingExercise.name, plan, lineIndex: editingExercise.lineIndex });
      setEditingExercise(null);
      return;
    }

    // Propagate to future weeks on same weekday
    if (propagate && mode === "plan" && plan.week > 0) {
      const futurePlans = plans.filter(p => p.day === plan.day && p.week > plan.week);
      const baseWeight = w ? parseFloat(w) : 0;
      const repsNum = reps;
      const step = repsNum <= 3 ? 5 : repsNum <= 8 ? 2.5 : 1.25;

      for (let fi = 0; fi < futurePlans.length; fi++) {
        const fp = futurePlans[fi];
        const fpLines = fp.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        // Find the original exercise by name
        const matchIdx = fpLines.findIndex(l => {
          const { name: ln } = parseExerciseWeight(l);
          return ln.toLowerCase() === editingExercise.originalName.toLowerCase();
        });
        if (matchIdx >= 0) {
          const progressiveWeight = baseWeight > 0 ? Math.round((baseWeight + step * (fi + 1)) * 4) / 4 : 0;
          const fpEntry = progressiveWeight > 0
            ? `${editingExercise.name} — ${sets}×${reps} @ ${progressiveWeight} kg`
            : w ? `${editingExercise.name} — ${sets}×${reps} @ ${w} kg` : `${editingExercise.name} — ${sets}×${reps}`;
          fpLines[matchIdx] = fpEntry;
          const fpSep = fp.details.includes("\n") ? "\n" : "; ";
          const fpNewDetails = fpLines.join(fpSep);
          await supabase.from("workout_plans").update({ details: fpNewDetails }).eq("id", fp.id);
        }
      }
      fetchData();
    }

    setEditingExercise(null);
  };

  const handlePropagate = async (doPropagate: boolean) => {
    if (doPropagate && propagateDialog) {
      // Re-run save with propagation
      const { plan, originalName, newName, entry, lineIndex } = propagateDialog;
      const w = entry.match(/@\s*([\d.,]+)\s*kg/)?.[1] || "";
      const setsMatch = entry.match(/(\d+)[×x](\d+)/i);
      const sets = setsMatch ? setsMatch[1] : "3";
      const reps = setsMatch ? setsMatch[2] : "10";
      
      setEditingExercise({ planId: plan.id, lineIndex, name: newName, originalName, sets, reps, weight: w });
      setPropagateDialog(null);
      // Use setTimeout to let state update
      setTimeout(() => {
        saveEditedExercise(true);
      }, 0);
      return;
    }
    setPropagateDialog(null);
  };

  // Handle replace exercise propagation across all weeks
  const handleReplacePropagate = async (doPropagate: boolean) => {
    if (doPropagate && replacePropagateDialog) {
      const { oldExerciseName, newEntry, sourcePlanId } = replacePropagateDialog;
      const sourcePlan = plans.find(p => p.id === sourcePlanId);
      if (!sourcePlan) { setReplacePropagateDialog(null); return; }

      // Find all other plans (different weeks, same day) that contain the old exercise
      const otherPlans = plans.filter(p =>
        p.id !== sourcePlanId &&
        p.week > 0 &&
        p.day === sourcePlan.day
      );

      const updatedPlans = [...plans];

      for (const p of otherPlans) {
        const separator = p.details.includes("\n") ? "\n" : "; ";
        const lines = p.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
        let changed = false;
        for (let i = 0; i < lines.length; i++) {
          const lineName = lines[i].split(/\s*—\s*/)[0].trim();
          if (lineName.toLowerCase() === oldExerciseName.toLowerCase()) {
            lines[i] = newEntry;
            changed = true;
          }
        }
        if (changed) {
          const newDetails = lines.join(separator);
          await supabase.from("workout_plans").update({ details: newDetails }).eq("id", p.id);
          const idx = updatedPlans.findIndex(up => up.id === p.id);
          if (idx >= 0) updatedPlans[idx] = { ...updatedPlans[idx], details: newDetails };
        }
      }

      setPlans(updatedPlans);
      triggerSave();
    }
    setReplacePropagateDialog(null);
  };

  const executeDeleteExercise = async () => {
    if (!deleteExerciseConfirm) return;
    console.log("[DELETE] deleteExerciseConfirm:", JSON.stringify(deleteExerciseConfirm));
    const plan = plans.find(p => p.id === deleteExerciseConfirm.planId);
    if (!plan) { console.log("[DELETE] Plan not found!"); setDeleteExerciseConfirm(null); return; }
    console.log("[DELETE] plan.details:", JSON.stringify(plan.details));
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    console.log("[DELETE] lines before splice:", JSON.stringify(lines), "removing index:", deleteExerciseConfirm.lineIndex);
    lines.splice(deleteExerciseConfirm.lineIndex, 1);
    const newDetails = lines.join(separator);
    console.log("[DELETE] newDetails:", JSON.stringify(newDetails));
    const { error } = await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    if (error) console.error("[DELETE] Supabase error:", error);
    else console.log("[DELETE] Success");
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, details: newDetails } : p));
    setDeleteExerciseConfirm(null);
  };

  // Start replace exercise flow: open exercise picker filtered to the exercise's muscle group
  const startReplaceExercise = (planId: string, lineIndex: number, exerciseName: string) => {
    const exercise = allExercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    const muscleGroup = exercise?.muscleGroup || null;
    setReplaceExerciseTarget({ planId, lineIndex, name: exerciseName });
    setShowExercisePicker(planId);
    setExerciseSearch("");
    setSelectedMuscle(muscleGroup);
    setIsWarmupMode(false);
  };

  const moveExercise = async (planId: string, lineIndex: number, direction: "up" | "down") => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const separator = plan.details.includes("\n") ? "\n" : "; ";
    const lines = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    const targetIndex = direction === "up" ? lineIndex - 1 : lineIndex + 1;
    if (targetIndex < 0 || targetIndex >= lines.length) return;
    [lines[lineIndex], lines[targetIndex]] = [lines[targetIndex], lines[lineIndex]];
    const newDetails = lines.join(separator);
    await supabase.from("workout_plans").update({ details: newDetails }).eq("id", plan.id);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, details: newDetails } : p));
    triggerSave();
  };

  if (mode === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <Dumbbell className="w-8 h-8 text-primary animate-pulse" />
      </div>);

  }

  // Calibration screen — shown once for users with active plan who haven't calibrated
  if (mode === "plan" && needsCalibration) {
    return (
      <PlanCalibrationDialog
        userId={userId}
        onDone={async () => {
          // Re-fetch the plan_start_date from profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("plan_start_date")
            .eq("user_id", userId)
            .single();
          if (profileData && (profileData as any).plan_start_date) {
            setPlanStartDate((profileData as any).plan_start_date);
          }
          setNeedsCalibration(false);
          setInitialWeekSet(false);
          fetchData();
        }}
      />
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
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => setMode("choose")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tillbaka
        </button>
        <PlanPicker userId={userId} onDone={() => { setNeedsCalibration(false); fetchData(); }} />
      </div>
    );
  }

  // Single workouts mode
  if (mode === "single") {
    const singlePlans = plans.filter((p) => p.week === 0).sort((a, b) => {
      // Sort by date ascending within week view
      const dateA = a.day.match(/^(\d{4}-\d{2}-\d{2})/) ? a.day : "0000";
      const dateB = b.day.match(/^(\d{4}-\d{2}-\d{2})/) ? b.day : "0000";
      return dateA.localeCompare(dateB);
    });

    // Compute virtual weeks from dates
    const firstMonday = singlePlans.length > 0 ? (() => {
      const earliest = singlePlans.reduce((min, p) => {
        const d = p.day.match(/^(\d{4}-\d{2}-\d{2})/);
        const md = min.day.match(/^(\d{4}-\d{2}-\d{2})/);
        return d && md && d[1] < md[1] ? p : min;
      });
      const dateMatch = earliest.day.match(/^(\d{4}-\d{2}-\d{2})/);
      return dateMatch ? getMonday(parseISO(dateMatch[1])) : getMonday(new Date());
    })() : getMonday(new Date());

    // Group plans by virtual week
    const weekGroups = new Map<number, PlanDay[]>();
    for (const p of singlePlans) {
      const wk = computeSingleWeek(p.day, firstMonday);
      if (!weekGroups.has(wk)) weekGroups.set(wk, []);
      weekGroups.get(wk)!.push(p);
    }
    const singleWeeks = [...weekGroups.keys()].sort((a, b) => a - b);

    // Auto-set to latest week with incomplete workouts on first render
    const effectiveWeek = singleWeeks.includes(singleCurrentWeek) ? singleCurrentWeek :
      (singleWeeks.length > 0 ? singleWeeks[singleWeeks.length - 1] : 1);

    const weekPlans = weekGroups.get(effectiveWeek) || [];
    const weekDoneCount = weekPlans.filter((p) => completions[`0-${p.day}`]?.done).length;
    const totalDoneCount = singlePlans.filter((p) => completions[`0-${p.day}`]?.done).length;
    const singleWeekIdx = singleWeeks.indexOf(effectiveWeek);

    return (
      <>
      <div className="space-y-4 animate-fade-in">
        {singlePlans.length === 0 && (
          <button
            onClick={() => setMode("choose")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Tillbaka
          </button>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Mina pass</h2>
            <p className="text-xs text-muted-foreground">
              {totalDoneCount} av {singlePlans.length} avklarade totalt
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

        {/* Week navigation */}
        {singleWeeks.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => singleWeekIdx > 0 && setSingleCurrentWeek(singleWeeks[singleWeekIdx - 1])}
                disabled={singleWeekIdx <= 0}
                className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="text-2xl font-black tracking-tight">Vecka {effectiveWeek}</h2>
                <p className="text-sm text-muted-foreground">
                  av {singleWeeks.length} {singleWeeks.length === 1 ? "vecka" : "veckor"}
                </p>
              </div>
              <button
                onClick={() => singleWeekIdx < singleWeeks.length - 1 && setSingleCurrentWeek(singleWeeks[singleWeekIdx + 1])}
                disabled={singleWeekIdx >= singleWeeks.length - 1}
                className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Week pills */}
            {singleWeeks.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {singleWeeks.map((wk) => {
                  const wPlans = weekGroups.get(wk) || [];
                  const wDone = wPlans.filter(p => completions[`0-${p.day}`]?.done).length;
                  const allDone = wPlans.length > 0 && wDone === wPlans.length;
                  return (
                    <button
                      key={wk}
                      onClick={() => setSingleCurrentWeek(wk)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        effectiveWeek === wk
                          ? "bg-primary text-primary-foreground"
                          : allDone
                          ? "bg-success/20 text-success"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}>
                      V{wk}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Week progress */}
            {weekPlans.length > 0 && (
              <div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${weekPlans.length > 0 ? Math.round(weekDoneCount / weekPlans.length * 100) : 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {weekDoneCount} av {weekPlans.length} pass denna vecka
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {weekPlans.map((plan) => {
            const weekdayName = getWeekdayFromDayKey(plan.day);
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

                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setExpandedDay(expanded ? null : key); }}>
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
                    {weekdayName && (
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">{weekdayName}</span>
                    )}
                    <span className={`font-semibold text-sm block break-words ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {plan.session_name}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDayDisplay(plan.day)}
                    </span>
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
                      onClick={(e) => {e.stopPropagation();setShareTarget({ plan, completion: completions[key] || { week: plan.week, day: plan.day, done: false, skipped: false, user_comment: "" } as Completion });}}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      title="Dela pass">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
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
                  (() => { const exerciseLines = plan.details.split("\n").filter(Boolean); return <div className="space-y-2">
                        {exerciseLines.map((line, i) => {
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
                                   <div className="flex items-center gap-0.5">
                                     <div className="flex flex-col">
                                       <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3.5 h-3.5" /></button>
                                       <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === exerciseLines.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3.5 h-3.5" /></button>
                                     </div>
                                     <button
                                   onClick={(e) => {e.stopPropagation();setExerciseInfoName(name);}}
                                  className="p-0.5 text-muted-foreground hover:text-warning transition-colors"
                                  title="Visa övningsinformation">
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                    onClick={(e) => {e.stopPropagation();e.preventDefault();setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(name) });}}
                                   className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors touch-manipulation">
                                       <X className="w-4 h-4" />
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
                                  <button onClick={() => saveEditedExercise()} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold">Spara</button>
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
                                <div className="flex items-center gap-0.5">
                                  <div className="flex flex-col">
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === exerciseLines.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  </div>
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
                                  originalName: name,
                                  sets: sets || "3",
                                  reps: reps || "10",
                                  weight: kg?.replace(/\s*kg\s*/i, "").trim() || ""
                                })}
                                className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                                title="Redigera">
                                    <Dumbbell className="w-3 h-3" />
                                  </button>
                                  <button
                                 onClick={(e) => {e.stopPropagation();e.preventDefault();setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(name) });}}
                                 className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors touch-manipulation">
                                     <X className="w-4 h-4" />
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
                                          <Checkbox checked={isSetDone} onCheckedChange={() => toggleSetDone(0, plan.day, name, si, setsCountSingle, defaultKg, defaultReps)} className="h-5 w-5" />
                                          <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">S{si + 1}</span>
                                          <AutoSaveInput type="number" inputMode="numeric" initialValue={saved?.reps || defaultReps} onSave={(v) => saveSetFieldData(0, plan.day, name, si, 'reps', v, setsCountSingle, defaultKg, defaultReps)} className="w-11 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none" />
                                          <span className="text-[10px] text-muted-foreground">reps</span>
                                          <AutoSaveInput type="number" inputMode="decimal" initialValue={saved?.kg || defaultKg} onSave={(v) => saveSetFieldData(0, plan.day, name, si, 'kg', v, setsCountSingle, defaultKg, defaultReps)} placeholder="—" className="w-14 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                          <span className="text-[10px] text-muted-foreground">kg</span>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, -1, 0, plan.day); }}
                                    disabled={setsCountSingle <= 1}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                                    title="Ta bort set">
                                    − Set
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, 1, 0, plan.day); }}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-primary transition-colors"
                                    title="Lägg till set">
                                    + Set
                                  </button>
                                </div>
                            </div>);

                    })}
                      </div>; })()
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
                        {condTempoInput && !isStairMachine(conditioningDialog.exerciseName) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Timer className="w-3 h-3" /> Senast tempo: <span className="font-mono font-semibold text-foreground">{condTempoInput}/km</span>
                          </p>
                        )}
                        {conditioningDialog.exerciseName.toLowerCase().includes("intervall") && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Antal intervaller</label>
                              <input type="number" inputMode="numeric" value={condIntervalsInput} onChange={(e) => setCondIntervalsInput(e.target.value)} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Vila (min)</label>
                              <input type="number" inputMode="numeric" value={condRestInput} onChange={(e) => setCondRestInput(e.target.value)} placeholder="t.ex. 2" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                          </div>
                        )}
                        {isStairMachine(conditioningDialog.exerciseName) ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid (min)</label>
                                <input type="number" inputMode="numeric" value={condTimeInput} onChange={(e) => { setCondTimeInput(e.target.value); }} placeholder="t.ex. 30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">SPM (steg/min)</label>
                                <input type="number" inputMode="numeric" value={condSpmInput} onChange={(e) => setCondSpmInput(e.target.value)} placeholder="t.ex. 80" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                              </div>
                            </div>
                            {(() => {
                              const time = parseFloat(condTimeInput.replace(",", "."));
                              const spm = parseFloat(condSpmInput.replace(",", "."));
                              if (time > 0 && spm > 0) {
                                return (
                                  <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                    <span className="text-muted-foreground">Totalt:</span>
                                    <span className="font-mono font-bold text-foreground">{Math.round(time * spm)} steg</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                              <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                          </>
                        ) : (
                          <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                              {conditioningDialog.exerciseName.toLowerCase().includes("intervall") ? "Tid per intervall (min)" : "Tid (min)"}
                            </label>
                            <input
                          type="number"
                          inputMode="numeric"
                          value={condTimeInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCondTimeInput(v);
                            autoCalcCond(v, condTempoInput, condDistanceInput, "time");
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
                            const v = e.target.value;
                            setCondTempoInput(v);
                            autoCalcCond(condTimeInput, v, condDistanceInput, "tempo");
                          }}
                          placeholder="t.ex. 5:30"
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Route className="w-3 h-3" /> Distans (km)
                            </label>
                            <input
                          type="number"
                          inputMode="decimal"
                          value={condDistanceInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCondDistanceInput(v);
                            autoCalcCond(condTimeInput, condTempoInput, v, "distance");
                          }}
                          placeholder="t.ex. 5"
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                            <input
                          type="number"
                          inputMode="numeric"
                          value={condPulseInput}
                          onChange={(e) => setCondPulseInput(e.target.value)}
                          placeholder="t.ex. 155"
                          className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                        </div>
                          </>
                        )}
                        <div className="flex gap-2">
                          <button
                        onClick={addConditioningExercise}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-warning text-warning-foreground rounded-md text-xs font-semibold">
                            <Plus className="w-3.5 h-3.5" /> Lägg till
                          </button>
                          <button
                        onClick={() => {setConditioningDialog(null);setCondTempoInput("");setCondTimeInput("");setCondDistanceInput("");setCondIntervalsInput("");setCondRestInput("");setCondPulseInput("");setCondSpmInput("");}}
                        className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                            Avbryt
                          </button>
                        </div>
                      </div>
                  }

                    {/* Suggest adding interval training for tröskelpass */}
                    {(() => {
                      const isThresholdSession = plan.session_name.toLowerCase().includes("tröskel") || plan.details.toLowerCase().includes("tröskellöpning");
                      const detailParts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                      const hasInterval = detailParts.some(p => /\d+\s*[×x]\s*\d+\s*min/i.test(p) || p.toLowerCase().includes("intervall"));
                      if (isThresholdSession && !hasInterval && !conditioningDialog && !showExercisePicker) {
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConditioningDialog({ planId: plan.id, exerciseName: "Intervallträning" });
                              const lastCondTempo = findLastCondTempo("Intervallträning");
                              setCondTempoInput(lastCondTempo || "");
                              setCondTimeInput("");
                              setCondDistanceInput("");
                              setCondIntervalsInput("");
                              setCondRestInput("");
                              setCondPulseInput("");
                            }}
                            className="w-full bg-warning/10 border border-warning/30 rounded-lg p-3 text-left hover:bg-warning/20 transition-colors animate-fade-in"
                          >
                            <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5" /> Förslag: Lägg till intervallträning
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Tröskelpass inkluderar vanligtvis intervaller. Tryck här för att lägga till.</p>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    {/* Add warmup & exercise buttons */}
                    {!weightDialog && !conditioningDialog &&
                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setShowExercisePicker(plan.id);
                        setSelectedMuscle(null);
                        setIsWarmupMode(true);
                      }}
                      className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-muted-foreground hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Lägg till uppvärmning
                      </button>
                    <button
                      onClick={() => {
                        setShowExercisePicker(plan.id);
                        setSelectedMuscle(null);
                        setIsWarmupMode(false);
                      }}
                      className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Lägg till övning
                      </button>
                  </div>
                    }
                    <ExercisePickerDialog
                      open={isExercisePickerOpen && !weightDialog && !conditioningDialog}
                      onClose={() => { setShowExercisePicker(null); setIsWarmupMode(false); setReplaceExerciseTarget(null); }}
                      onSelect={(name) => handleExerciseSelect(plan.id, name)}
                      title={replaceExerciseTarget ? `Byt ut: ${replaceExerciseTarget.name}` : isWarmupMode ? "Välj uppvärmning" : "Välj övning"}
                      initialMuscleGroup={selectedMuscle}
                      getLastWeight={findLastWeight}
                      onExerciseInfo={(name) => setExerciseInfoName(name)}
                      allowCreate
                      userId={userId}
                    />

                    {/* Friend comments */}
                    {(() => {
                    const dayComments = friendComments.filter((c) => c.week === 0 && c.day === plan.day);
                    return dayComments.length > 0 ?
                    <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                          <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                          </p>
                        {dayComments.map((c) =>
                    <div key={c.id} className="bg-background/80 rounded-md px-3 py-2 flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-xs">
                                  <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                                  <span className="text-foreground">{c.comment}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {new Date(c.created_at).toLocaleDateString("sv-SE")}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteFriendComment(c.id)}
                                className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                title="Ta bort kommentar">
                                <X className="w-3 h-3" />
                              </button>
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
                    {/* Calorie burn estimate */}
                    {isDone && plan.details && (
                      profileWeight ? (() => {
                        const comp = completions[key];
                        const cal = estimateCalories(plan.details, comp?.logged_weights as Record<string, any> | null, comp?.logged_pulse || null, profileWeight, profileGender, profileAge);
                        return cal > 0 ? (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-center gap-2">
                            <Flame className="w-4 h-4 text-destructive flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-xs font-semibold text-destructive">~{cal} kcal</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">
                                {comp?.logged_pulse ? "baserat på puls, vikt & kön" : "uppskattning baserat på vikt"}
                              </span>
                            </div>
                          </div>
                        ) : null;
                      })() : (
                        <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                          <Flame className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <p className="text-[10px] text-muted-foreground">
                            Lägg till din vikt i profilen för att se kaloriförbrukning
                          </p>
                        </div>
                      )
                    )}
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
                    <p className="text-[10px] text-muted-foreground text-center">Övningar, vikter och reps kopieras — justera själv för progression</p>
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
          isAdmin={isAdmin}
        />
      )}
      {deleteExerciseConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteExerciseConfirm(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
            <h3 className="font-bold text-sm">Ta bort övning?</h3>
            <p className="text-sm text-muted-foreground">
              Är du säker på att du vill ta bort <span className="font-semibold text-foreground">{deleteExerciseConfirm.name}</span>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteExerciseConfirm(null)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
                Avbryt
              </button>
              <button onClick={executeDeleteExercise} className="flex-1 py-2.5 bg-destructive text-destructive-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
                Ta bort
              </button>
            </div>
          </div>
        </div>
      )}
      </>);

  }

  // Plan mode (existing)
  const weekDays = plans.
  filter((p) => p.week === currentWeek).
  sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  const weekIdx = weeks.indexOf(currentWeek);
  const scheduledDays = weekDays.filter(d => d.session_name.trim() !== "" && d.details.trim() !== "");
  const doneCount = scheduledDays.filter((d) => completions[`${d.week}-${d.day}`]?.done).length;
  const progress = scheduledDays.length > 0 ? Math.round(doneCount / scheduledDays.length * 100) : 0;

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
            <p className="text-sm text-muted-foreground">
              av {weeks.length} veckor
              {activePlanWeek && activePlanWeek !== currentWeek && (
                <span className="ml-1 text-warning">(aktiv: V{activePlanWeek})</span>
              )}
            </p>
          </div>
          <div className="absolute right-14 top-1 flex gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={leavePlan}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                title="Lämna plan">
                <LogOut className="w-4 h-4" />
              </button>
              <span className="text-[9px] text-muted-foreground leading-tight">Avsluta</span>
            </div>
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
          const isActive = w === activePlanWeek;
          return (
            <button
              key={w}
              onClick={() => setCurrentWeek(w)}
              className={`flex flex-col items-center p-2 rounded-md text-xs transition-all relative ${
              isCurrent ?
              "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background" :
              isActive ?
              "bg-warning/20 text-warning border border-warning/50 hover:bg-warning/30" :
              "bg-secondary text-muted-foreground hover:bg-muted"}`
              }>
              <span className="font-bold">V{w}</span>
              {isActive && !isCurrent && (
                <span className="text-[8px] leading-none mt-0.5">Aktiv</span>
              )}
            </button>);
        })}
      </div>

      {/* Warning when viewing non-active week */}
      {activePlanWeek && currentWeek !== activePlanWeek && (
        <div className="flex items-center gap-2 bg-warning/15 border border-warning/30 rounded-lg px-3 py-2">
          <CalendarIcon className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-warning">
            Du tittar på vecka {currentWeek} — din aktiva vecka är <button onClick={() => setCurrentWeek(activePlanWeek)} className="font-bold underline">vecka {activePlanWeek}</button>.
            Pass du registrerar här tillhör inte den aktuella veckan.
          </p>
        </div>
      )}


      {/* Workout cards */}
      {isMobile && weekDays.length > 1 && (() => {
        const todayDayNames = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
        const todayName = todayDayNames[new Date().getDay()];
        return (
        <div className="flex flex-col gap-2">
          {/* Day tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
            {weekDays.map((plan, idx) => {
              const k = `${plan.week}-${plan.day}`;
              const comp = completions[k];
              const done = comp?.done || false;
              const skipped = comp?.skipped || false;
              const isToday = plan.day === todayName && currentWeek === activePlanWeek;
              const isActive = idx === activeDayIndex;
              return (
                <button
                  key={k}
                  onClick={() => { setSwipeDirection(idx > activeDayIndex ? "left" : "right"); swipeKey.current++; setActiveDayIndex(idx); setExpandedDay(null); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? done
                        ? "bg-success text-success-foreground shadow-sm"
                        : isToday
                        ? "bg-warning text-warning-foreground shadow-sm"
                        : "bg-primary text-primary-foreground shadow-sm"
                      : done
                      ? "bg-success/20 text-success"
                      : skipped
                      ? "bg-destructive/20 text-destructive"
                      : isToday
                      ? "bg-warning/20 text-warning"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {plan.day}
                </button>
              );
            })}
          </div>
        </div>
        );
      })()}
      <div
        key={isMobile && weekDays.length > 1 ? `swipe-${swipeKey.current}` : undefined}
        className={`${isMobile && weekDays.length > 1 ? (swipeDirection === "left" ? "swipe-left" : swipeDirection === "right" ? "swipe-right" : "") : "space-y-2"}`}
        onTouchStart={(e) => {
          if (!isMobile || weekDays.length <= 1) return;
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (!isMobile || weekDays.length <= 1 || touchStartX.current === null || touchStartY.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          const dy = e.changedTouches[0].clientY - touchStartY.current;
          touchStartX.current = null;
          touchStartY.current = null;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx < 0 && activeDayIndex < weekDays.length - 1) {
              setSwipeDirection("left");
              swipeKey.current++;
              setActiveDayIndex(activeDayIndex + 1);
              setExpandedDay(null);
            } else if (dx > 0 && activeDayIndex > 0) {
              setSwipeDirection("right");
              swipeKey.current++;
              setActiveDayIndex(activeDayIndex - 1);
              setExpandedDay(null);
            }
          }
        }}
      >
        {(isMobile && weekDays.length > 1 ? [weekDays[activeDayIndex]] : weekDays).filter(Boolean).map((plan) => {
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
              className={`relative rounded-lg border bg-card transition-all animate-fade-in ${isDone ? "workout-done opacity-80" : ""} ${isSkipped ? "opacity-60" : ""} ${isRest ? "workout-rest" : ""}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameDialog({ planId: plan.id, currentName: plan.session_name });
                  setRenameInput(plan.session_name);
                }}
                className="absolute top-1 right-1 p-1 text-muted-foreground/30 hover:text-primary transition-colors z-10"
                title="Inställningar">
                <Settings className="w-3 h-3" />
              </button>

              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; if (expanded) { const sameDayPlans = plans.filter(p2 => p2.week === plan.week && p2.day === plan.day); if (sameDayPlans.length <= 1) return; } setExpandedDay(expanded ? null : key); }}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDone(plan.week, plan.day);
                    }}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone ? "bg-success border-success" : "bg-background border-muted-foreground/30 hover:border-primary"}`
                    }
                    title="Genomfört">
                      <Check className={`w-4 h-4 transition-all ${isDone ? "text-success-foreground opacity-100" : "text-muted-foreground/30 opacity-100"}`} />
                    </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                    <button
                      onClick={(e) => {e.stopPropagation(); setChangeDayDialog({ planId: plan.id, currentDay: plan.day, week: plan.week, sessionName: plan.session_name });}}
                      className="text-xs font-mono text-muted-foreground uppercase hover:text-primary transition-colors"
                      title="Byt veckodag">
                      {plan.day}
                    </button>
                    <span
                      className={`font-semibold text-sm break-words text-left ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {plan.session_name}
                    </span>
                  </div>
                  {(() => {
                    const dateStr = getPlanDayDate(planStartDate, plan.week, plan.day);
                    return dateStr ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {dateStr}
                      </span>
                    ) : null;
                  })()}
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
                    <button
                      onClick={(e) => {e.stopPropagation();setShareTarget({ plan, completion: completions[key] || { week: plan.week, day: plan.day, done: false, skipped: false, user_comment: "" } as Completion });}}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      title="Dela pass">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
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
                    let detailParts = plan.details.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
                    
                    // Auto-generate conditioning entry for tröskelpass/running with empty details
                    if (detailParts.length === 0 && isRunning && plan.session_name.trim()) {
                      const sessionLower = plan.session_name.toLowerCase();
                      if (sessionLower.includes("tröskel")) {
                        detailParts = ["Tröskellöpning"];
                      } else if (sessionLower.includes("långpass")) {
                        detailParts = ["Löpning"];
                      } else {
                        detailParts = ["Löpning"];
                      }
                    }
                    // Helper: check if a line is a pure distance suggestion like "Löpning 8.5 km"
                    const isSuggestedDistance = (line: string): { name: string; distance: number } | null => {
                      const trimmed = line.trim();
                      // Match: "ExerciseName X km" or "ExerciseName X,Y km" — only name + distance, nothing else
                      const match = trimmed.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*km\s*$/i);
                      if (!match) return null;
                      const exName = match[1].trim();
                      const dist = parseFloat(match[2].replace(",", "."));
                      // Only treat as suggestion if the name is a known conditioning exercise
                      const isCondEx = allExercises.some(e => e.name.toLowerCase() === exName.toLowerCase() && e.category === "kondition");
                      if (isCondEx && dist > 0) return { name: exName, distance: dist };
                      return null;
                    };

                    // Helper: check if a line is a known exercise or has exercise format
                    const isExerciseLine = (line: string): boolean => {
                      // If it's a suggested distance, it's NOT an exercise line
                      if (isSuggestedDistance(line)) return false;
                      const cleanName = line.replace(/\s*[—\-]\s*.*$/, "").trim().toLowerCase();
                      // Check against exercise library and custom exercises
                      if (allExercises.some(e => e.name.toLowerCase() === cleanName)) return true;
                      // Check for structured formats (sets×reps, kg, min/km patterns)
                      if (/\d+\s*[×x]\s*\d+/i.test(line)) return true;
                      if (/\d+\s*kg/i.test(line)) return true;
                      if (/\d+\s*min/i.test(line) && /\/km/i.test(line)) return true;
                      // Check if line starts with a known exercise name (partial match)
                      if (allExercises.some(e => cleanName.startsWith(e.name.toLowerCase()))) return true;
                      return false;
                    };

                    return (
                      <div className="space-y-2">
                          {/* Hint: copied weights from previous session */}
                          {!isDone && completion?.logged_weights && Object.keys(completion.logged_weights).length > 0 && (
                            <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                              <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                Vikter & reps hämtade från förra passet — <span className="text-foreground font-medium">justera själv för progression</span>
                              </p>
                            </div>
                          )}
                          {detailParts.length > 1 ? (
                            <ul className="space-y-1.5">
                              {detailParts.map((line, i) => {
                                const cleanName = line.replace(/\s*[—\-]\s*\d+[×x].*$/i, "").replace(/\s*@\s*\d+.*$/i, "").trim();
                                const suggestion = isSuggestedDistance(line);
                                if (suggestion) {
                                  return (
                                    <li key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center gap-2">
                                      <Route className="w-4 h-4 text-primary flex-shrink-0" />
                                      <div>
                                        <p className="text-xs text-muted-foreground">Föreslagen distans</p>
                                        <p className="text-sm font-semibold text-foreground">{suggestion.name} {suggestion.distance} km</p>
                                      </div>
                                    </li>
                                  );
                                }

                                const isExercise = isExerciseLine(line);

                                if (!isExercise) {
                                  // Descriptive text - render as muted italic text
                                  return (
                                    <li key={i} className="text-xs text-muted-foreground italic leading-relaxed px-1 py-0.5">
                                      {line}
                                    </li>
                                  );
                                }

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
                                    <div className="flex flex-col flex-shrink-0">
                                      <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3 h-3" /></button>
                                      <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === detailParts.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3 h-3" /></button>
                                    </div>
                                    <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         e.preventDefault();
                                         setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: line });
                                       }}
                                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 touch-manipulation">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (() => {
                            // Single line - check if it's a suggested distance first
                            const suggestion = isSuggestedDistance(plan.details);
                            if (suggestion) {
                              return (
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center gap-2">
                                  <Route className="w-4 h-4 text-primary flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Föreslagen distans</p>
                                    <p className="text-sm font-semibold text-foreground">{suggestion.name} {suggestion.distance} km</p>
                                  </div>
                                </div>
                              );
                            }
                            const isExercise = isExerciseLine(plan.details);
                            return isExercise ? (
                              <p className="text-sm text-foreground leading-relaxed">{plan.details}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground italic leading-relaxed">{plan.details}</p>
                            );
                          })()}
                          {(() => {
                            // Parse logged conditioning data from plan details + saved conditioning payloads + direct fields
                            const loggedEntries: {
                              name: string;
                              time?: string;
                              tempo?: string;
                              distance?: string;
                              pulse?: string;
                              spm?: string;
                              steps?: string;
                              lineIndex: number;
                              source: "details" | "direct" | "weights";
                              rawInfo?: string;
                              weightKey?: string;
                            }[] = [];

                            // 1) Parse plan details for logged lines (format: "Name — time, tempo, distance, pulse")
                            const detailLines = plan.details.split(/[;\n]/).map(l => l.trim()).filter(Boolean);
                            for (let li = 0; li < detailLines.length; li++) {
                              const line = detailLines[li];
                              const dashMatch = line.match(/^(.+?)\s*—\s*(.+)$/);
                              if (!dashMatch) continue;

                              const eName = dashMatch[1].trim();
                              const info = dashMatch[2];
                              const entry: any = { name: eName, lineIndex: li, source: "details", rawInfo: info };

                              const timeM = info.match(/(\d+(?:[.,]\d+)?)\s*min/);
                              if (timeM) entry.time = timeM[1];
                              const tempoM = info.match(/(\d+:\d+)\/km/);
                              if (tempoM) entry.tempo = tempoM[1];
                              const distM = info.match(/([\d.,]+)\s*km(?!\/)/);
                              if (distM) entry.distance = distM[1].replace(",", ".");
                              const pulseM = info.match(/(\d+)\s*bpm/);
                              if (pulseM) entry.pulse = pulseM[1];
                              const spmM = info.match(/(\d+)\s*spm/);
                              if (spmM) entry.spm = spmM[1];
                              const stepsM = info.match(/(\d+)\s*steg/);
                              if (stepsM) entry.steps = stepsM[1];

                              if (entry.time || entry.tempo || entry.distance || entry.pulse || entry.spm || entry.steps) {
                                loggedEntries.push(entry);
                              }
                            }

                            // 2) Merge in saved conditioning payloads from logged_weights (__cond__...)
                            const condWeights = (comp?.logged_weights || {}) as Record<string, any>;
                            for (const [weightKey, rawValue] of Object.entries(condWeights)) {
                              if (!weightKey.startsWith("__cond__")) continue;
                              try {
                                const data = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
                                if (!data || typeof data !== "object") continue;

                                const name = weightKey.replace(/^__cond__/, "").trim() || "Kondition";
                                const time = data.time ? String(data.time) : undefined;
                                const tempo = data.tempo ? String(data.tempo).replace(/\s*\/km\s*$/i, "") : undefined;
                                const distance = data.dist ? String(data.dist).replace(",", ".") : undefined;
                                const pulse = data.pulse ? String(data.pulse) : undefined;
                                const spm = data.spm ? String(data.spm) : undefined;
                                const steps = data.steps
                                  ? String(data.steps)
                                  : (() => {
                                      const t = parseFloat(String(data.time ?? "").replace(",", "."));
                                      const s = parseFloat(String(data.spm ?? "").replace(",", "."));
                                      return t > 0 && s > 0 ? String(Math.round(t * s)) : undefined;
                                    })();

                                if (!(time || tempo || distance || pulse || spm || steps)) continue;

                                const existing = loggedEntries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
                                if (existing) {
                                  if (!existing.time && time) existing.time = time;
                                  if (!existing.tempo && tempo) existing.tempo = tempo;
                                  if (!existing.distance && distance) existing.distance = distance;
                                  if (!existing.pulse && pulse) existing.pulse = pulse;
                                  if (!existing.spm && spm) existing.spm = spm;
                                  if (!existing.steps && steps) existing.steps = steps;
                                  continue;
                                }

                                loggedEntries.push({
                                  name,
                                  time,
                                  tempo,
                                  distance,
                                  pulse,
                                  spm,
                                  steps,
                                  lineIndex: -1,
                                  source: "weights",
                                  weightKey,
                                });
                              } catch {}
                            }

                            // 3) Include legacy direct fields if present (but never for stair machine data)
                            const hasStairData = loggedEntries.some((e) => e.spm || e.steps);
                            if (!hasStairData && comp && (comp.logged_tempo || comp.logged_pulse || comp.logged_distance_km)) {
                              const hasDirectData = !loggedEntries.length ||
                                (comp.logged_distance_km && !loggedEntries.some((e) => e.distance));
                              if (hasDirectData) {
                                loggedEntries.unshift({
                                  name: plan.session_name || "Kondition",
                                  tempo: comp.logged_tempo || undefined,
                                  pulse: comp.logged_pulse ? String(comp.logged_pulse) : undefined,
                                  distance: comp.logged_distance_km ? String(comp.logged_distance_km) : undefined,
                                  lineIndex: -1,
                                  source: "direct",
                                });
                              }
                            }

                            if (loggedEntries.length === 0) return null;

                            // Check if we're editing one of these lines
                            if (editingCondLine && editingCondLine.planId === plan.id) {
                              return (
                                <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-bold text-success">✏️ Redigera: {editingCondLine.name}</p>
                                  {isStairMachine(editingCondLine.name) ? (
                                    <>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid (min)</label>
                                          <input type="number" inputMode="numeric" value={condTimeInput} onChange={(e) => setCondTimeInput(e.target.value)} placeholder="t.ex. 30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">SPM (steg/min)</label>
                                          <input type="number" inputMode="numeric" value={condSpmInput} onChange={(e) => setCondSpmInput(e.target.value)} placeholder="t.ex. 80" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                        </div>
                                      </div>
                                      {(() => {
                                        const time = parseFloat(condTimeInput.replace(",", "."));
                                        const spm = parseFloat(condSpmInput.replace(",", "."));
                                        if (time > 0 && spm > 0) {
                                          return (
                                            <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                              <span className="text-muted-foreground">Totalt:</span>
                                              <span className="font-mono font-bold text-foreground">{Math.round(time * spm)} steg</span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                      <div>
                                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                                        <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid (min)</label>
                                      <input type="number" inputMode="numeric" value={condTimeInput} onChange={(e) => setCondTimeInput(e.target.value)} placeholder="t.ex. 30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
                                      <input type="text" value={condTempoInput} onChange={(e) => setCondTempoInput(e.target.value)} placeholder="t.ex. 5:30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Distans (km)</label>
                                      <input type="number" inputMode="decimal" value={condDistanceInput} onChange={(e) => setCondDistanceInput(e.target.value)} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                                      <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                                    </div>
                                  </div>
                                    </>
                                  )}
                                  <div className="flex gap-2">
                                    <button onClick={saveEditedCondLine} className="flex-1 py-2 bg-success text-success-foreground rounded-md text-xs font-semibold">
                                      Spara
                                    </button>
                                    <button onClick={() => { setEditingCondLine(null); setCondTimeInput(""); setCondTempoInput(""); setCondDistanceInput(""); setCondPulseInput(""); setCondSpmInput(""); }} className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                                      Avbryt
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
                                <p className="text-xs font-bold text-success">📊 Loggat resultat</p>
                                {loggedEntries.map((e, i) => (
                                  <div key={i} className={`${loggedEntries.length > 1 ? "border-l-2 border-success/30 pl-2" : ""} group`}>
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex-1">
                                        {loggedEntries.length > 1 && <p className="text-[10px] font-semibold text-success/80">{e.name}</p>}
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                          {e.time && <p className="text-xs">⏱ <span className="font-mono font-semibold">{e.time} min</span></p>}
                                          {e.spm && <p className="text-xs">🦶 <span className="font-mono font-semibold">{e.spm} spm</span></p>}
                                          {e.steps && <p className="text-xs">👣 <span className="font-mono font-semibold">{e.steps} steg</span></p>}
                                          {e.tempo && <p className="text-xs">🏃 <span className="font-mono font-semibold">{e.tempo}/km</span></p>}
                                          {e.distance && <p className="text-xs">📏 <span className="font-mono font-semibold">{e.distance} km</span></p>}
                                          {e.pulse && <p className="text-xs">❤️ <span className="font-mono font-semibold">{e.pulse} bpm</span></p>}
                                        </div>
                                      </div>
                                      <div className="flex gap-0.5 flex-shrink-0">
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            if (e.source === "details") {
                                              startEditCondLine(plan.id, e.lineIndex, e.name, e.rawInfo || "");
                                            }
                                          }}
                                          className="p-2 text-muted-foreground hover:text-primary transition-colors touch-manipulation"
                                          title="Redigera">
                                          <Pencil className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            if (e.source === "details") {
                                              deleteConditioningLine(plan.id, e.lineIndex);
                                            } else if (e.source === "weights" && e.weightKey) {
                                              deleteCondWeightLog(plan.week, plan.day, e.weightKey);
                                            } else {
                                              deleteDirectCondLog(plan.week, plan.day);
                                            }
                                          }}
                                          className="p-2 text-muted-foreground hover:text-destructive transition-colors touch-manipulation"
                                          title="Ta bort">
                                          <X className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
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

                  // Find last conditioning log for a session with the same name
                  const findLastConditioningLog = (sessionName: string, currentWeek: number): { tempo: string | null; dist: number | null; time: string | null; week: number } | null => {
                    const matchingPlans = plans.filter(p => 
                      p.session_name === sessionName && p.week < currentWeek
                    ).sort((a, b) => b.week - a.week);
                    
                    for (const p of matchingPlans) {
                      const k = `${p.week}-${p.day}`;
                      const comp = completions[k];
                      if (comp?.done) {
                        const weights = comp.logged_weights as Record<string, any> | null;
                        if (weights) {
                          for (const [wk, val] of Object.entries(weights)) {
                            if (wk.startsWith('__cond__')) {
                              try {
                                const data = typeof val === 'string' ? JSON.parse(val) : val;
                                if (data.tempo || data.dist) {
                                  return { tempo: data.tempo || null, dist: data.dist ? parseFloat(data.dist) : null, time: data.time || null, week: p.week };
                                }
                              } catch {}
                            }
                          }
                        }
                        if (comp.logged_tempo || comp.logged_distance_km) {
                          return { 
                            tempo: comp.logged_tempo || null, 
                            dist: comp.logged_distance_km ? Number(comp.logged_distance_km) : null,
                            time: null,
                            week: p.week
                          };
                        }
                      }
                    }
                    return null;
                  };

                  // Count completed conditioning sessions for a given session name (for threshold every-5th logic)
                  const countCompletedCondSessions = (sessionName: string, currentWeek: number): number => {
                    return plans.filter(p => 
                      p.session_name === sessionName && p.week < currentWeek
                    ).filter(p => {
                      const k = `${p.week}-${p.day}`;
                      return completions[k]?.done;
                    }).length;
                  };

                  // Find last logged kg+reps for a strength exercise from completed sessions
                  const findLastLoggedKg = (exerciseName: string, currentWeek: number): { kg: number; reps?: number } | null => {
                    // Search plan weeks backwards
                    for (let w = currentWeek - 1; w >= 1; w--) {
                      for (const p of plans.filter(pp => pp.week === w)) {
                        const k = `${w}-${p.day}`;
                        const comp = completions[k];
                        if (!comp?.done) continue;
                        const weights = comp.logged_weights as Record<string, any> | null;
                        if (!weights) continue;
                        const setDataRaw = weights[`__setdata__${exerciseName}`];
                        if (setDataRaw) {
                          try {
                            const setData = typeof setDataRaw === 'string' ? JSON.parse(setDataRaw) : setDataRaw;
                            if (Array.isArray(setData) && setData.length > 0) {
                              const withKg = setData.find((s: any) => s.kg && parseFloat(s.kg) > 0);
                              if (withKg) return { kg: parseFloat(withKg.kg), reps: parseInt(withKg.reps) || undefined };
                            }
                          } catch {}
                        }
                        if (weights[exerciseName] && typeof weights[exerciseName] === 'number') {
                          return { kg: weights[exerciseName] };
                        }
                      }
                    }
                    // Also search single workouts (week 0)
                    const singlePlans = plans.filter(p => p.week === 0).sort((a, b) => b.day.localeCompare(a.day));
                    for (const p of singlePlans) {
                      const k = `0-${p.day}`;
                      const comp = completions[k];
                      if (!comp?.done) continue;
                      const weights = comp.logged_weights as Record<string, any> | null;
                      if (!weights) continue;
                      const setDataRaw = weights[`__setdata__${exerciseName}`];
                      if (setDataRaw) {
                        try {
                          const setData = typeof setDataRaw === 'string' ? JSON.parse(setDataRaw) : setDataRaw;
                          if (Array.isArray(setData) && setData.length > 0) {
                            const withKg = setData.find((s: any) => s.kg && parseFloat(s.kg) > 0);
                            if (withKg) return { kg: parseFloat(withKg.kg), reps: parseInt(withKg.reps) || undefined };
                          }
                        } catch {}
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
                        // Check if this is a conditioning exercise
                        const { name: partCondCheckName } = parseExerciseWeight(part);
                        const matchedExercise = allExercises.find(e => e.name.toLowerCase() === partCondCheckName.toLowerCase());
                        const isCondExercise = matchedExercise?.category === "kondition" || /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|gång|intervallträning/i.test(part);
                        
                        if (isCondExercise) {
                          // Check if this is a pure distance suggestion (e.g. "Löpning 8.5 km")
                          const suggestMatch = part.trim().match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*km\s*$/i);
                          const isSuggestion = suggestMatch && allExercises.some(e => e.name.toLowerCase() === suggestMatch[1].trim().toLowerCase() && e.category === "kondition");
                          if (isSuggestion && suggestMatch) {
                            return (
                              <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center gap-2">
                                <Route className="w-4 h-4 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Föreslagen distans</p>
                                  <p className="text-sm font-semibold text-foreground">{suggestMatch[1]} {parseFloat(suggestMatch[2].replace(",", "."))} km</p>
                                </div>
                              </div>
                            );
                          }

                          // Parse conditioning data from the part
                          const { name: condName } = parseExerciseWeight(part);
                          // Parse interval pattern like "3×10 min (2 min joggvila)" or "3×10 min, 2 min vila"
                          const intervalMatch = part.match(/(\d+)\s*[×x]\s*(\d+)\s*min(?:\s*[,(]\s*(\d+)\s*(?:min\s*)?(?:jogg)?vila)?/i);
                          const intervalCount = intervalMatch ? parseInt(intervalMatch[1]) : 0;
                          const intervalDuration = intervalMatch ? parseInt(intervalMatch[2]) : 0;
                          const intervalRest = intervalMatch && intervalMatch[3] ? intervalMatch[3] : "";
                          
                          const condTimeM = !intervalMatch ? part.match(/(\d+)\s*min/) : null;
                          const condTempoM = part.match(/([\d:.]+)\s*\/km/);
                          const condDistM = part.match(/([\d.,]+)\s*km(?!\/)/);
                          const planTime = condTimeM ? condTimeM[1] : "";
                          const planTempo = condTempoM ? condTempoM[1] : "";
                          const planDist = condDistM ? condDistM[1] : "";
                          
                          // Get saved conditioning data from completions
                          const condComp = completions[key];
                          const condWeights = (condComp?.logged_weights || {}) as Record<string, any>;
                          const savedCondData = condWeights[`__cond__${condName || part}`];
                          const condSaved = savedCondData ? (typeof savedCondData === 'string' ? JSON.parse(savedCondData) : savedCondData) : null;
                          
                          const displayTime = condSaved?.time || planTime;
                          const displayDist = condSaved?.dist || planDist;
                          let displayTempo = condSaved?.tempo || planTempo;
                          
                          // Auto-calculate tempo if time and distance exist but no tempo
                          if (!displayTempo && displayTime && displayDist) {
                            const t = parseFloat(displayTime);
                            const d = parseFloat(String(displayDist).replace(',', '.'));
                            if (t > 0 && d > 0) {
                              const tempoMin = t / d;
                              const mins = Math.floor(tempoMin);
                              const secs = Math.round((tempoMin - mins) * 60);
                              displayTempo = `${mins}:${secs.toString().padStart(2, '0')}`;
                            }
                          }
                          
                          const saveCondField = async (field: string, value: any) => {
                            const condKey = `__cond__${condName || part}`;

                            await updateCompletionWeights(plan.week, plan.day, (existing) => {
                              let currentData: Record<string, any> = { time: planTime, dist: planDist, tempo: planTempo };
                              const rawCurrent = existing[condKey];
                              if (rawCurrent) {
                                try {
                                  const parsed = typeof rawCurrent === "string" ? JSON.parse(rawCurrent) : rawCurrent;
                                  if (parsed && typeof parsed === "object") {
                                    currentData = { ...currentData, ...parsed };
                                  }
                                } catch {
                                  // Ignore malformed legacy data
                                }
                              }

                              const updated = { ...currentData, [field]: value };

                              // Auto-calculate tempo (only for non-interval fields)
                              if (field !== "intervals" && (field === "time" || field === "dist") && !updated.tempo) {
                                const t = parseFloat(field === "time" ? value : updated.time || "0");
                                const d = parseFloat(String(field === "dist" ? value : updated.dist || "0").replace(",", "."));
                                if (t > 0 && d > 0) {
                                  const tempoMin = t / d;
                                  const mins = Math.floor(tempoMin);
                                  const secs = Math.round((tempoMin - mins) * 60);
                                  updated.tempo = `${mins}:${secs.toString().padStart(2, "0")}`;
                                }
                              }

                              return { ...existing, [condKey]: JSON.stringify(updated) };
                            });
                          };
                          
                          return (
                            <div key={i} className="bg-warning/5 rounded-lg p-3 border border-warning/20 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                  <Footprints className="w-3.5 h-3.5 text-warning" />
                                  {toTitleCase(condName || part)}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <div className="flex flex-col">
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === parts.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setExerciseInfoName(condName || part); }} className="p-0.5 text-muted-foreground hover:text-warning transition-colors">
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={(e) => {e.stopPropagation();e.preventDefault();setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(condName || part) });}} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors touch-manipulation">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {/* Interval checkmarks integrated into per-interval rows below */}
                              {/* Last tempo / conditioning progression suggestion */}
                              {(() => {
                                if (isStairMachine(condName || part)) return null;
                                const lastLog = findLastConditioningLog(plan.session_name, plan.week);
                                if (!lastLog) return null;
                                
                                // For interval sessions: never suggest distance, only suggest increasing interval time
                                const isInterval = intervalCount > 0;
                                const isThreshold = plan.session_name.toLowerCase().includes("tröskel");
                                const completedCount = countCompletedCondSessions(plan.session_name, plan.week);
                                
                                if (isInterval) {
                                  // For intervals: suggest increasing interval duration (time), never distance
                                  const suggestedDuration = intervalDuration + 1;
                                  // Extract last logged tempo from interval data
                                  let lastIntervalTempo: string | null = null;
                                  if (lastLog) {
                                    // Check if last log has interval-level data with tempo
                                    const matchingPlansForTempo = plans.filter(p => 
                                      p.session_name === plan.session_name && p.week < plan.week
                                    ).sort((a, b) => b.week - a.week);
                                    for (const mp of matchingPlansForTempo) {
                                      const mk = `${mp.week}-${mp.day}`;
                                      const mc = completions[mk];
                                      if (mc?.done) {
                                        const mw = mc.logged_weights as Record<string, any> | null;
                                        if (mw) {
                                          for (const [wk, val] of Object.entries(mw)) {
                                            if (wk.startsWith('__cond__')) {
                                              try {
                                                const data = typeof val === 'string' ? JSON.parse(val) : val;
                                                if (data.intervals && Array.isArray(data.intervals)) {
                                                  const tempos = data.intervals.filter((r: any) => r.tempo?.trim()).map((r: any) => r.tempo);
                                                  if (tempos.length > 0) {
                                                    // Calculate average tempo from intervals
                                                    let totalSecs = 0; let count = 0;
                                                    for (const t of tempos) {
                                                      const s = tempoToSeconds(t);
                                                      if (s) { totalSecs += s; count++; }
                                                    }
                                                    if (count > 0) lastIntervalTempo = secondsToTempo(Math.round(totalSecs / count));
                                                  }
                                                }
                                                if (!lastIntervalTempo && data.tempo) lastIntervalTempo = data.tempo;
                                              } catch {}
                                            }
                                          }
                                        }
                                        if (!lastIntervalTempo && mc.logged_tempo) lastIntervalTempo = mc.logged_tempo;
                                        if (lastIntervalTempo) break;
                                      }
                                    }
                                  }
                                  return (
                                    <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
                                      <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">📈 Föreslagen tid</p>
                                      <p className="text-xs text-foreground">
                                        <span className="font-mono font-semibold">{intervalCount}×{suggestedDuration} min</span>
                                        <span className="text-muted-foreground ml-1">(+1 min/intervall)</span>
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">Nuvarande: {intervalCount}×{intervalDuration} min{isThreshold ? ` (pass ${completedCount + 1})` : ''}</p>
                                      {lastIntervalTempo && (
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          <Timer className="w-3 h-3" />
                                          Senast loggat tempo: <span className="font-mono font-semibold text-foreground">{lastIntervalTempo}/km</span>
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                                
                                // For non-interval conditioning: threshold = distance every 5th, others alternate
                                const isDistancePass = isThreshold ? (completedCount > 0 && completedCount % 5 === 0) : (plan.week - lastLog.week) % 2 === 0;
                                const isSpeedWeek = !isDistancePass;
                                
                                if (isSpeedWeek && lastLog.tempo) {
                                  const lastSecs = tempoToSeconds(lastLog.tempo);
                                  if (lastSecs) {
                                    const fasterSecs = Math.round(lastSecs * 0.995);
                                    const lowSecs = Math.max(fasterSecs - 5, 120);
                                    const highSecs = fasterSecs + 5;
                                    return (
                                      <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
                                        <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">📈 Föreslagen hastighet</p>
                                        <p className="text-xs text-foreground">
                                          <span className="font-mono font-semibold">{secondsToTempo(lowSecs)}–{secondsToTempo(highSecs)}</span>
                                          <span className="text-muted-foreground ml-1">/km (0,5% snabbare)</span>
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">Baserat på senast loggade: {lastLog.tempo}/km{isThreshold ? ` (pass ${completedCount + 1})` : ''}</p>
                                      </div>
                                    );
                                  }
                                } else if (isDistancePass && lastLog.dist) {
                                  const newDist = Math.round(lastLog.dist * 1.1 * 100) / 100;
                                  return (
                                    <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 space-y-0.5">
                                      <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">📈 Föreslagen distans</p>
                                      <p className="text-xs text-foreground">
                                        <span className="font-mono font-semibold">{newDist} km</span>
                                        <span className="text-muted-foreground ml-1">(+10% ökning)</span>
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">Baserat på senast loggade: {lastLog.dist} km{isThreshold ? ` (var 5:e pass)` : ''}</p>
                                    </div>
                                  );
                                }
                                // Fallback: just show last tempo if available
                                if (lastLog.tempo) {
                                  // Don't show if user already has saved conditioning data for this exercise
                                  const hasCurrentData = condSaved?.tempo;
                                  if (!hasCurrentData) {
                                    return (
                                      <p className="text-[10px] text-muted-foreground pl-1 flex items-center gap-1">
                                        <Timer className="w-3 h-3" />
                                        Senast: <span className="font-mono font-semibold text-foreground">{lastLog.tempo}/km</span> (v{lastLog.week})
                                      </p>
                                    );
                                  }
                                }
                                return null;
                              })()}
                              {intervalCount > 0 ? (
                                <div className="space-y-2">
                                  {/* Per-interval header */}
                                  <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-end">
                                    <span className="w-7" />
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Timer className="w-3 h-3 text-warning" />Tid</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5"><Route className="w-3 h-3 text-warning" />Distans</span>
                                  </div>
                                  {/* Per-interval rows - use saved intervals length or plan count */}
                                  {(() => {
                                    const savedIntervals: Array<{time: string; tempo: string; dist: string}> = condSaved?.intervals || [];
                                    const activeCount = savedIntervals.length > 0 ? savedIntervals.length : intervalCount;
                                    
                                    return Array.from({ length: activeCount }, (_, ii) => {
                                    const row = savedIntervals[ii] || { time: String(intervalDuration), tempo: planTempo || '', dist: '' };
                                    const rowTempo = row.tempo;
                                    const rowTime = parseFloat(row.time) || 0;
                                    // Auto-calc distance
                                    let rowDist = '';
                                    if (rowTempo && rowTime > 0) {
                                      const tMatch = rowTempo.match(/^(\d+)[:\.](\d+)$/);
                                      const tSingle = rowTempo.match(/^(\d+)$/);
                                      let minPerKm = 0;
                                      if (tMatch) minPerKm = (parseInt(tMatch[1]) * 60 + parseInt(tMatch[2])) / 60;
                                      else if (tSingle) minPerKm = parseInt(tSingle[1]);
                                      if (minPerKm > 0) rowDist = String(Math.round((rowTime / minPerKm) * 100) / 100);
                                    }
                                    if (row.dist && !rowDist) rowDist = row.dist;
                                    return (
                                      <div key={ii} className="grid grid-cols-[28px_1fr_1fr_1fr] gap-1.5 items-center">
                                        {(() => {
                                          const intervalSetsKey = `__sets__interval_${condName || part}`;
                                          const setsStr = ((completions[key]?.logged_weights as Record<string, any>)?.[intervalSetsKey] as string) || "";
                                          const isDone = setsStr[ii] === "1";
                                          return (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const arr = Array.from({ length: activeCount }, (_, j) => setsStr[j] === "1");
                                                arr[ii] = !arr[ii];
                                                const newStr = arr.map(b => b ? "1" : "0").join("");
                                                const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                                const updated = { ...existing, [intervalSetsKey]: newStr };
                                                setCompletions(prev => ({
                                                  ...prev,
                                                  [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated }
                                                }));
                                                await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                              }}
                                              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                                                isDone
                                                  ? "bg-success border-success text-success-foreground"
                                                  : "border-warning/30 text-muted-foreground hover:border-warning"
                                              }`}
                                            >
                                              {isDone ? <Check className="w-3.5 h-3.5" /> : ii + 1}
                                            </button>
                                          );
                                        })()}
                                        <AutoSaveInput
                                          type="number" inputMode="numeric"
                                          initialValue={row.time || String(intervalDuration)}
                                          onSave={(v) => {
                                            const arr = [...(condSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' })))];
                                            arr[ii] = { ...arr[ii], time: v };
                                            saveCondField('intervals', arr as any);
                                          }}
                                          className="w-full bg-warning/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-warning/20 text-center font-mono focus:ring-1 focus:ring-warning outline-none"
                                        />
                                        <AutoSaveInput
                                          type="text"
                                          initialValue={rowTempo}
                                          onSave={(v) => {
                                            const arr = [...(condSaved?.intervals || Array.from({ length: activeCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' })))];
                                            arr[ii] = { ...arr[ii], tempo: v };
                                            // If first row and others empty, apply to all
                                            if (ii === 0 && v.trim()) {
                                              const allEmpty = arr.slice(1).every(r => !r.tempo?.trim());
                                              if (allEmpty) {
                                                for (let j = 1; j < arr.length; j++) {
                                                  arr[j] = { ...arr[j], tempo: v };
                                                }
                                              }
                                            }
                                            saveCondField('intervals', arr as any);
                                          }}
                                          placeholder="5:30"
                                          className="w-full bg-warning/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-warning/20 text-center font-mono focus:ring-1 focus:ring-warning outline-none placeholder:text-muted-foreground"
                                        />
                                        <span className={`text-xs font-mono text-center px-2 py-1.5 rounded-md ${rowDist ? 'bg-primary/10 text-foreground ring-1 ring-primary/30' : 'text-muted-foreground'}`}>
                                          {rowDist || '—'}
                                        </span>
                                      </div>
                                    );
                                  });
                                  })()}
                                  {/* Add/remove interval buttons */}
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const currentIntervals = condSaved?.intervals || Array.from({ length: intervalCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' }));
                                        if (currentIntervals.length > 1) {
                                          const newArr = currentIntervals.slice(0, -1);
                                          saveCondField('intervals', newArr as any);
                                          // Also trim the sets tracking
                                          const intervalSetsKey = `__sets__interval_${condName || part}`;
                                          const setsStr = ((completions[key]?.logged_weights as Record<string, any>)?.[intervalSetsKey] as string) || "";
                                          if (setsStr.length > newArr.length) {
                                            const trimmedStr = setsStr.slice(0, newArr.length);
                                            const existing = (completions[key]?.logged_weights || {}) as Record<string, any>;
                                            const updated = { ...existing, [intervalSetsKey]: trimmedStr };
                                            setCompletions(prev => ({
                                              ...prev,
                                              [key]: { ...prev[key], week: plan.week, day: plan.day, done: prev[key]?.done || false, skipped: prev[key]?.skipped || false, user_comment: prev[key]?.user_comment || "", logged_weights: updated }
                                            }));
                                            await safeUpsertCompletion(plan.week, plan.day, { logged_weights: updated });
                                          }
                                        }
                                      }}
                                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary"
                                    >
                                      <Trash2 className="w-3 h-3" /> Ta bort intervall
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIntervals = condSaved?.intervals || Array.from({ length: intervalCount }, () => ({ time: String(intervalDuration), tempo: planTempo || '', dist: '' }));
                                        const lastRow = currentIntervals[currentIntervals.length - 1] || { time: String(intervalDuration), tempo: '', dist: '' };
                                        const newArr = [...currentIntervals, { time: lastRow.time || String(intervalDuration), tempo: '', dist: '' }];
                                        saveCondField('intervals', newArr as any);
                                      }}
                                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary"
                                    >
                                      <Plus className="w-3 h-3" /> Lägg till intervall
                                    </button>
                                  </div>
                                  {/* Summary row */}
                                  {(() => {
                                    const intervalsData: Array<{time: string; tempo: string; dist: string}> = condSaved?.intervals || [];
                                    let totDist = 0;
                                    let totTime = 0;
                                    intervalsData.forEach((r) => {
                                      const t = parseFloat(r.time) || 0;
                                      totTime += t;
                                      if (r.tempo && t > 0) {
                                        const tMatch = r.tempo.match(/^(\d+)[:\.](\d+)$/);
                                        const tSingle = r.tempo.match(/^(\d+)$/);
                                        let minPerKm = 0;
                                        if (tMatch) minPerKm = (parseInt(tMatch[1]) * 60 + parseInt(tMatch[2])) / 60;
                                        else if (tSingle) minPerKm = parseInt(tSingle[1]);
                                        if (minPerKm > 0) totDist += t / minPerKm;
                                      }
                                    });
                                    if (totDist <= 0) return null;
                                    const avgTempo = totTime / totDist;
                                    const avgMins = Math.floor(avgTempo);
                                    const avgSecs = Math.round((avgTempo - avgMins) * 60);
                                    return (
                                      <div className="flex items-center justify-between bg-primary/5 rounded-md px-3 py-1.5 text-[11px]">
                                        <span className="text-muted-foreground">Totalt</span>
                                        <div className="flex gap-3 font-semibold font-mono text-foreground">
                                          <span>{totTime} min</span>
                                          <span>{avgMins}:{String(avgSecs).padStart(2, '0')} /km</span>
                                          <span>{Math.round(totDist * 100) / 100} km</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : isStairMachine(condName || part) ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Timer className="w-3 h-3 text-warning" />Tid (min)</label>
                                      <AutoSaveInput type="number" inputMode="numeric" initialValue={displayTime} onSave={(v) => saveCondField('time', v)} placeholder="—" className="w-full bg-warning/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-warning/20 text-center font-mono focus:ring-1 focus:ring-warning outline-none placeholder:text-muted-foreground" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">🦶 SPM (steg/min)</label>
                                      <AutoSaveInput type="number" inputMode="numeric" initialValue={condSaved?.spm || ""} onSave={(v) => saveCondField('spm', v)} placeholder="—" className="w-full bg-warning/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-warning/20 text-center font-mono focus:ring-1 focus:ring-warning outline-none placeholder:text-muted-foreground" />
                                    </div>
                                  </div>
                                  {(() => {
                                    const t = parseFloat(condSaved?.time || displayTime || "0");
                                    const s = parseFloat(condSaved?.spm || "0");
                                    if (t > 0 && s > 0) {
                                      return (
                                        <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                          <span className="text-muted-foreground">Totalt:</span>
                                          <span className="font-mono font-bold text-foreground">{Math.round(t * s)} steg</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Timer className="w-3 h-3 text-warning" />Tid (min)</label>
                                    <AutoSaveInput type="number" inputMode="numeric" initialValue={displayTime} onSave={(v) => saveCondField('time', v)} placeholder="—" className="w-full bg-warning/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-warning/20 text-center font-mono focus:ring-1 focus:ring-warning outline-none placeholder:text-muted-foreground" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Route className="w-3 h-3 text-warning" />Distans (km)</label>
                                    <AutoSaveInput type="text" inputMode="decimal" initialValue={displayDist} onSave={(v) => saveCondField('dist', v)} placeholder="—" className="w-full bg-warning/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-warning/20 text-center font-mono focus:ring-1 focus:ring-warning outline-none placeholder:text-muted-foreground" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo (/km)</label>
                                    <AutoSaveInput type="text" initialValue={displayTempo} onSave={(v) => saveCondField('tempo', v)} placeholder="auto" className="w-full bg-warning/10 text-foreground text-xs px-2 py-1.5 rounded-md border border-warning/20 text-center font-mono focus:ring-1 focus:ring-warning outline-none placeholder:text-muted-foreground" />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

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
                        const partName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;
                        const partSets = partStructMatch ? partStructMatch[2] : fallbackSetsMatch ? fallbackSetsMatch[1] : null;
                        const partReps = partStructMatch ? partStructMatch[3] : null;
                        const partKg = partStructMatch && partStructMatch[4] ? partStructMatch[4].trim() : null;

                        const isEditing = editingExercise?.planId === plan.id && editingExercise?.lineIndex === i;

                        if (isEditing) {
                          return (
                            <div key={i} className="bg-secondary/60 rounded-lg p-3 border border-primary/30 space-y-2 animate-fade-in">
                                <div className="space-y-0.5">
                                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Övning</label>
                                  <input type="text" value={editingExercise.name} onChange={(e) => setEditingExercise((prev) => prev ? { ...prev, name: e.target.value } : null)} className="w-full bg-background text-foreground text-sm p-1.5 rounded-md border-none outline-none focus:ring-1 focus:ring-primary font-semibold" />
                                </div>
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
                                  <button onClick={() => saveEditedExercise()} className="flex-1 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold">Spara</button>
                                  <button onClick={() => setEditingExercise(null)} className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs">Avbryt</button>
                                </div>
                              </div>);

                        }

                        const setsCountPlan = partSets ? parseInt(partSets) : 1;
                        const setsStrPlan = getSetsDone(key, partName);

                        // Daily challenge exercise - render with distinct style
                        const isDailyChallenge = part.startsWith("⚔️ Utmaning:");
                        if (isDailyChallenge) {
                          const challengeName = part.replace("⚔️ Utmaning:", "").trim();
                          return (
                            <div key={i} className="bg-warning/10 rounded-lg p-2.5 border border-warning/30 space-y-1">
                              <div className="flex items-center gap-2">
                                <Swords className="w-4 h-4 text-warning flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] font-bold text-warning uppercase tracking-wider">Dagens utmaning</span>
                                  <p className="text-sm font-semibold text-foreground">{challengeName}</p>
                                </div>
                                <Check className="w-4 h-4 text-success" />
                              </div>
                            </div>
                          );
                        }

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
                                      originalName: partName,
                                      sets: partSets || "3",
                                      reps: partReps || repsStr || "10",
                                      weight: partKg || ""
                                    })}>
                                    {toTitleCase(partName)}
                                    {partRpe && <span className="text-xs font-normal text-muted-foreground ml-1.5">{partRpe}</span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <div className="flex flex-col">
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "up");}} disabled={i === 0} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta upp"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => {e.stopPropagation();moveExercise(plan.id, i, "down");}} disabled={i === parts.length - 1} className="p-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-20" title="Flytta ner"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  </div>
                                   <DropdownMenu modal={false} open={openExerciseMenuId === `${plan.id}-${i}`} onOpenChange={(open) => setOpenExerciseMenuId(open ? `${plan.id}-${i}` : null)}>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          onPointerDown={(e) => {
                                            // Prevent opening on scroll-through touches
                                            const target = e.currentTarget;
                                            target.dataset.pointerStart = `${e.clientX},${e.clientY}`;
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const target = e.currentTarget;
                                            const start = target.dataset.pointerStart;
                                            if (start) {
                                              const [sx, sy] = start.split(",").map(Number);
                                              const dist = Math.sqrt((e.clientX - sx) ** 2 + (e.clientY - sy) ** 2);
                                              if (dist > 10) {
                                                e.preventDefault();
                                                return;
                                              }
                                            }
                                          }}
                                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-primary transition-colors touch-manipulation"
                                          title="Övningsalternativ">
                                          <Settings className="w-4 h-4" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenuItem onClick={() => startReplaceExercise(plan.id, i, partName)}>
                                          <ArrowLeftRight className="w-4 h-4 mr-2" />
                                          Byt ut övning
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteExerciseConfirm({ planId: plan.id, lineIndex: i, name: toTitleCase(partName) })}>
                                          <X className="w-4 h-4 mr-2" />
                                          Ta bort övning
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                              </div>
                              {/* Last logged weight note */}
                              {(() => {
                                const lastKg = findLastLoggedKg(partName, plan.week);
                                if (!lastKg) return null;
                                // Don't show if user already has saved data for this session
                                const hasCurrentData = getSetData(key, partName).some(s => s.kg && parseFloat(s.kg) > 0);
                                if (hasCurrentData) return null;
                                return (
                                  <p className="text-[10px] text-muted-foreground pl-1 flex items-center gap-1">
                                    <Weight className="w-3 h-3" />
                                    Senast: <span className="font-mono font-semibold text-foreground">{lastKg.kg} kg{lastKg.reps ? ` (${lastKg.reps} reps)` : ''}</span> — öka vikten själv för progression
                                  </p>
                                );
                              })()}
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
                                          <Checkbox checked={isSetDone} onCheckedChange={() => toggleSetDone(plan.week, plan.day, partName, si, setsCountPlan, defKg, defReps)} className="h-5 w-5" />
                                          <span className="text-[10px] text-muted-foreground w-7 flex-shrink-0">S{si + 1}</span>
                                          <AutoSaveInput type="number" inputMode="numeric" initialValue={saved?.reps || defReps} onSave={(v) => saveSetFieldData(plan.week, plan.day, partName, si, 'reps', v, setsCountPlan, defKg, defReps)} className="w-11 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none" />
                                          <span className="text-[10px] text-muted-foreground">reps</span>
                                          <AutoSaveInput type="number" inputMode="decimal" initialValue={saved?.kg || defKg} onSave={(v) => saveSetFieldData(plan.week, plan.day, partName, si, 'kg', v, setsCountPlan, defKg, defReps)} placeholder="—" className="w-14 bg-secondary text-foreground text-xs px-1 py-0.5 rounded border border-border/50 text-center font-mono focus:ring-1 focus:ring-primary outline-none placeholder:text-muted-foreground" />
                                          <span className="text-[10px] text-muted-foreground">kg</span>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 pl-1 pt-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, -1, plan.week, plan.day); }}
                                    disabled={setsCountPlan <= 1}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                                    title="Ta bort set">
                                    − Set
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); modifySetCount(plan.id, i, 1, plan.week, plan.day); }}
                                    className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-primary transition-colors"
                                    title="Lägg till set">
                                    + Set
                                  </button>
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
                      {condTempoInput && !isStairMachine(conditioningDialog.exerciseName) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Timer className="w-3 h-3" /> Senast tempo: <span className="font-mono font-semibold text-foreground">{condTempoInput}/km</span>
                        </p>
                      )}
                      {conditioningDialog.exerciseName.toLowerCase().includes("intervall") && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Antal intervaller</label>
                            <input type="number" inputMode="numeric" value={condIntervalsInput} onChange={(e) => setCondIntervalsInput(e.target.value)} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Vila (min)</label>
                            <input type="number" inputMode="numeric" value={condRestInput} onChange={(e) => setCondRestInput(e.target.value)} placeholder="t.ex. 2" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                        </div>
                      )}
                      {isStairMachine(conditioningDialog.exerciseName) ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tid (min)</label>
                              <input type="number" inputMode="numeric" value={condTimeInput} onChange={(e) => setCondTimeInput(e.target.value)} placeholder="t.ex. 30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">SPM (steg/min)</label>
                              <input type="number" inputMode="numeric" value={condSpmInput} onChange={(e) => setCondSpmInput(e.target.value)} placeholder="t.ex. 80" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                            </div>
                          </div>
                          {(() => {
                            const time = parseFloat(condTimeInput.replace(",", "."));
                            const spm = parseFloat(condSpmInput.replace(",", "."));
                            if (time > 0 && spm > 0) {
                              return (
                                <div className="bg-primary/10 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                                  <span className="text-muted-foreground">Totalt:</span>
                                  <span className="font-mono font-bold text-foreground">{Math.round(time * spm)} steg</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                            <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                          </div>
                        </>
                      ) : (
                        <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                            {conditioningDialog.exerciseName.toLowerCase().includes("intervall") ? "Tid per intervall (min)" : "Tid (min)"}
                          </label>
                          <input type="number" inputMode="numeric" value={condTimeInput} onChange={(e) => { const v = e.target.value; setCondTimeInput(v); autoCalcCond(v, condTempoInput, condDistanceInput, "time"); }} placeholder="t.ex. 30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tempo (min/km)</label>
                          <input type="text" value={condTempoInput} onChange={(e) => { const v = e.target.value; setCondTempoInput(v); autoCalcCond(condTimeInput, v, condDistanceInput, "tempo"); }} placeholder="t.ex. 5:30" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Distans (km)</label>
                          <input type="number" inputMode="decimal" value={condDistanceInput} onChange={(e) => { const v = e.target.value; setCondDistanceInput(v); autoCalcCond(condTimeInput, condTempoInput, v, "distance"); }} placeholder="t.ex. 5" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Snittspuls (bpm)</label>
                          <input type="number" inputMode="numeric" value={condPulseInput} onChange={(e) => setCondPulseInput(e.target.value)} placeholder="t.ex. 155" className="w-full bg-background text-foreground text-sm px-3 py-2 rounded-md border border-border outline-none focus:ring-1 focus:ring-primary text-center font-bold placeholder:text-muted-foreground placeholder:font-normal" />
                        </div>
                      </div>
                        </>
                      )}
                      <div className="flex gap-2">
                        <button onClick={addConditioningExercise} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold">
                          <Plus className="w-3.5 h-3.5" /> Lägg till
                        </button>
                        <button onClick={() => {setConditioningDialog(null);setCondTempoInput("");setCondTimeInput("");setCondDistanceInput("");setCondIntervalsInput("");setCondRestInput("");setCondPulseInput("");setCondSpmInput("");}} className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs bg-secondary rounded-md">
                          Avbryt
                        </button>
                      </div>
                    </div>
                }

                  {/* Add exercise to plan session */}
                  {!weightDialog && !conditioningDialog &&
                <div className="space-y-1.5">
                  {/* Suggest adding interval training for tröskelpass (plan mode) */}
                  {(() => {
                    const isThresholdSession = plan.session_name.toLowerCase().includes("tröskel") || plan.details.toLowerCase().includes("tröskellöpning");
                    const dp = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                    const hasInterval = dp.some(p => /\d+\s*[×x]\s*\d+\s*min/i.test(p) || p.toLowerCase().includes("intervall"));
                    if (isThresholdSession && !hasInterval) {
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConditioningDialog({ planId: plan.id, exerciseName: "Intervallträning" });
                            const lastCondTempo = findLastCondTempo("Intervallträning");
                            setCondTempoInput(lastCondTempo || "");
                            setCondTimeInput("");
                            setCondDistanceInput("");
                            setCondIntervalsInput("");
                            setCondRestInput("");
                            setCondPulseInput("");
                          }}
                          className="w-full bg-warning/10 border border-warning/30 rounded-lg p-3 text-left hover:bg-warning/20 transition-colors animate-fade-in"
                        >
                          <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Förslag: Lägg till intervallträning
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Tröskelpass inkluderar vanligtvis intervaller. Tryck här för att lägga till.</p>
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button onClick={() => {setShowExercisePicker(plan.id);setSelectedMuscle(null);setIsWarmupMode(true);}} className="w-full py-2 border border-dashed border-warning/40 rounded-md text-xs text-muted-foreground hover:text-warning hover:border-warning transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Lägg till uppvärmning
                    </button>
                  <button onClick={() => {setShowExercisePicker(plan.id);setSelectedMuscle(null);setIsWarmupMode(false);}} className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Lägg till övning
                    </button>
                </div>
                  }
                  <ExercisePickerDialog
                    open={showExercisePicker === plan.id && !weightDialog && !conditioningDialog}
                    onClose={() => { setShowExercisePicker(null); setShowAddCustomExercise(false); setIsWarmupMode(false); setReplaceExerciseTarget(null); }}
                    onSelect={(name) => handleExerciseSelect(plan.id, name)}
                    title={replaceExerciseTarget ? `Byt ut: ${replaceExerciseTarget.name}` : isWarmupMode ? "Välj uppvärmning" : "Lägg till övning"}
                    initialMuscleGroup={selectedMuscle}
                    getLastWeight={findLastWeight}
                    onExerciseInfo={(name) => setExerciseInfoName(name)}
                    allowCreate
                    userId={userId}
                  />

                  {/* Likes from friends */}
                  {(() => {
                    const dayLikes = workoutLikes.filter((l) => l.week === plan.week && l.day === plan.day);
                    return dayLikes.length > 0 ? (
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-sm">🔥</span>
                        <p className="text-[11px] text-muted-foreground">
                          {dayLikes.map((l) => commentNicknames[l.user_id] || "...").join(", ")} gillade detta pass
                        </p>
                      </div>
                    ) : null;
                  })()}

                  {/* Friend comments */}
                  {(() => {
                  const dayComments = friendComments.filter((c) => c.week === plan.week && c.day === plan.day);
                  return dayComments.length > 0 ?
                  <div className="space-y-1.5 bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" /> Kommentarer från vänner
                        </p>
                        {dayComments.map((c) =>
                    <div key={c.id} className="bg-background/80 rounded-md px-3 py-2 flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-xs">
                                <span className="font-semibold text-primary">{commentNicknames[c.author_id] || "..."}</span>{" "}
                                <span className="text-foreground">{c.comment}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(c.created_at).toLocaleDateString("sv-SE")}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteFriendComment(c.id)}
                              className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                              title="Ta bort kommentar">
                              <X className="w-3 h-3" />
                            </button>
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
                    {/* Calorie burn estimate */}
                    {isDone && plan.details && (
                      profileWeight ? (() => {
                        const comp = completions[key];
                        const cal = estimateCalories(plan.details, comp?.logged_weights as Record<string, any> | null, comp?.logged_pulse || null, profileWeight, profileGender, profileAge);
                        return cal > 0 ? (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-center gap-2">
                            <Flame className="w-4 h-4 text-destructive flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-xs font-semibold text-destructive">~{cal} kcal</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">
                                {comp?.logged_pulse ? "baserat på puls, vikt & kön" : "uppskattning baserat på vikt"}
                              </span>
                            </div>
                          </div>
                        ) : null;
                      })() : (
                        <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                          <Flame className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <p className="text-[10px] text-muted-foreground">
                            Lägg till din vikt i profilen för att se kaloriförbrukning
                          </p>
                        </div>
                      )
                    )}
                </div>
              }
            </div>);

        })}
      </div>

      {/* Daily challenge — below workout cards */}
      <DailyChallenge userId={userId} onComplete={async (challengeText) => {
        const dayNames = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
        const todayName = dayNames[new Date().getDay()];
        const todayPlan = plans.find(p => p.week === currentWeek && p.day === todayName);
        if (todayPlan) {
          const cleanChallenge = challengeText.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
          const challengeEntry = `⚔️ Utmaning: ${cleanChallenge}`;
          const joinSep = todayPlan.details.includes("\n") ? "\n" : todayPlan.details.includes(";") ? "; " : "\n";
          const newDetails = todayPlan.details ? `${todayPlan.details}${joinSep}${challengeEntry}` : challengeEntry;
          await supabase.from("workout_plans").update({ details: newDetails }).eq("id", todayPlan.id);
          setPlans(prev => prev.map(p => p.id === todayPlan.id ? { ...p, details: newDetails } : p));
        }
      }} />

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
        isAdmin={isAdmin}
      />
    )}
    {showFireworks && (
      <FireworksOverlay onComplete={() => setShowFireworks(false)} />
    )}
    {uncheckedSetsDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setUncheckedSetsDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-base">Obockade set</h3>
          <p className="text-sm text-muted-foreground">
            Du har {uncheckedSetsDialog.uncheckedCount} set som inte är avbockade. Vill du klarmarkera passet ändå?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setUncheckedSetsDialog(null)}
              className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
            >
              Avbryt
            </button>
            <button
              onClick={async () => {
                const { week, day } = uncheckedSetsDialog;
                setUncheckedSetsDialog(null);
                // Auto-check all unchecked sets before completing
                const dayPlans = plans.filter(p => p.week === week && p.day === day);
                for (const plan of dayPlans) {
                  if (!plan.details) continue;
                  const parts = plan.details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
                  for (const part of parts) {
                    if (part.startsWith("⚔️")) continue;
                    const isCondExercise = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|jogg|promenad|gång|intervallträning|stair\s*machine|trappmaskin/i.test(part);
                    if (isCondExercise) continue;
                    if (/^(vila|vilodag)/i.test(part)) continue;
                    const { clean: cleanPart } = extractRpe(part);
                    const partStructMatch = cleanPart.match(/^(.+?)\s+(\d+)\s*[×x]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*kg)?$/i);
                    const fallbackSetsMatch = !partStructMatch ? cleanPart.match(/(\d+)\s*[×x]\s*\S+/) : null;
                    const nameMatch = part.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+?)(?:\s+\d)/);
                    const exerciseName = nameMatch ? nameMatch[1].trim() : null;
                    const pName = partStructMatch ? partStructMatch[1].trim().replace(/\s*—\s*$/, '') : exerciseName || cleanPart;
                    const sc = partStructMatch ? parseInt(partStructMatch[2]) : fallbackSetsMatch ? parseInt(fallbackSetsMatch[1]) : 1;
                    const k = `${week}-${day}`;
                    const currentSets = getSetsDone(k, pName);
                    const allChecked = "1".repeat(sc);
                    if (currentSets !== allChecked) {
                      const existing = (completions[k]?.logged_weights || {}) as Record<string, any>;
                      const updated = { ...existing, [`__sets__${pName}`]: allChecked };
                      // Ensure setdata exists
                      const setDataKey = `__setdata__${pName}`;
                      if (!updated[setDataKey]) {
                        const defReps = partStructMatch ? partStructMatch[3] : "10";
                        const defKg = partStructMatch && partStructMatch[4] ? partStructMatch[4] : "";
                        const initData = Array.from({ length: sc }, () => ({ kg: defKg, reps: defReps }));
                        updated[setDataKey] = JSON.stringify(initData);
                      }
                      await safeUpsertCompletion(week, day, { logged_weights: updated });
                    }
                  }
                }
                await performToggleDone(week, day);
              }
              className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-80 transition-opacity"
            >
              Klarmarkera
            </button>
          </div>
        </div>
      </div>
    )}
    {deleteExerciseConfirm && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteExerciseConfirm(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Ta bort övning?</h3>
          <p className="text-sm text-muted-foreground">
            Är du säker på att du vill ta bort <span className="font-semibold text-foreground">{deleteExerciseConfirm.name}</span>?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteExerciseConfirm(null)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Avbryt
            </button>
            <button onClick={executeDeleteExercise} className="flex-1 py-2.5 bg-destructive text-destructive-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Ta bort
            </button>
          </div>
        </div>
      </div>
    )}
    {propagateDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setPropagateDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Tillämpa på framtida veckor?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du tillämpa ändringen på alla <span className="font-semibold text-foreground">{propagateDialog.plan.day}</span>-pass i efterföljande veckor? Vikten ökas progressivt.
          </p>
          <div className="flex gap-2">
            <button onClick={() => handlePropagate(false)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Bara denna vecka
            </button>
            <button onClick={() => handlePropagate(true)} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Alla framtida
            </button>
          </div>
        </div>
      </div>
    )}
    {replacePropagateDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setReplacePropagateDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <h3 className="font-bold text-sm">Byt ut i hela schemat?</h3>
          <p className="text-sm text-muted-foreground">
            Vill du byta ut <span className="font-semibold text-foreground">{replacePropagateDialog.oldExerciseName}</span> i alla veckor?
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleReplacePropagate(false)} className="flex-1 py-2.5 bg-secondary text-muted-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm">
              Bara denna vecka
            </button>
            <button onClick={() => handleReplacePropagate(true)} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm">
              Alla veckor
            </button>
          </div>
        </div>
      </div>
    )}
    {shareTarget && (
      <WorkoutShareCard
        sessionName={shareTarget.plan.session_name}
        day={shareTarget.plan.day}
        week={shareTarget.plan.week}
        details={shareTarget.plan.details}
        tempo={shareTarget.plan.tempo}
        loggedTempo={shareTarget.completion.logged_tempo}
        loggedPulse={shareTarget.completion.logged_pulse}
        loggedDistanceKm={shareTarget.completion.logged_distance_km}
        loggedWeights={shareTarget.completion.logged_weights}
        nickname={userNickname}
        onClose={() => setShareTarget(null)}
        onChatShare={async () => {
          const plan = shareTarget.plan;
          setShareTarget(null);
          const { data: friendships } = await supabase.from("friendships").select("user_id, friend_id").eq("status", "accepted").or(`user_id.eq.${userId},friend_id.eq.${userId}`);
          if (!friendships || friendships.length === 0) return;
          const fIds = friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, nickname").in("user_id", fIds);
          setChatFriends(profiles || []);
          setChatShareTarget(plan);
        }}
        onCopyToDate={() => {
          const plan = shareTarget.plan;
          // Gather ALL plans for the same week/day so custom exercises are included
          const allDayPlans = plans.filter(p => p.week === plan.week && p.day === plan.day);
          const combinedDetails = allDayPlans.map(p => p.details.trim()).filter(Boolean).join("\n");
          const combinedSource: PlanDay = {
            ...plan,
            details: combinedDetails || plan.details,
          };
          setShareTarget(null);
          setCopyToDateSource(combinedSource);
          setCopyToDateSelected(new Date());
          setCopyToDateConflict(null);
        }}
      />
    )}

    {/* Change day dialog */}
    {changeDayDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setChangeDayDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              Byt veckodag
            </h3>
            <button onClick={() => setChangeDayDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{changeDayDialog.sessionName}</span> — nuvarande dag: <span className="font-mono font-semibold text-foreground">{changeDayDialog.currentDay}</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DAYS.map((d) => {
              const isCurrentDay = d === changeDayDialog.currentDay;
              const isOccupied = !isCurrentDay && plans.some(p => p.week === changeDayDialog.week && p.day === d);
              return (
                <button
                  key={d}
                  onClick={async () => {
                    if (!isCurrentDay) {
                      if (isOccupied) {
                        // Swap: move target to current day and current to target day
                        const targetPlan = plans.find(p => p.week === changeDayDialog.week && p.day === d);
                        if (targetPlan) {
                          const week = changeDayDialog.week;
                          const oldDay = changeDayDialog.currentDay;
                          const newDay = d;

                          // Get completions for both days
                          const compOld = completions[`${week}-${oldDay}`];
                          const compNew = completions[`${week}-${newDay}`];

                          // Strip challenge lines from both plans before swapping
                          const cleanDetailsCurrent = stripChallengeLines(
                            plans.find(p => p.id === changeDayDialog.planId)?.details || ""
                          );
                          const cleanDetailsTarget = stripChallengeLines(targetPlan.details || "");

                          // Swap plan days using a temp value to avoid unique constraint conflict
                          const tempDay = `__swap_${Date.now()}`;
                          await supabase.from("workout_plans").update({ day: tempDay, details: cleanDetailsCurrent }).eq("id", changeDayDialog.planId);
                          await supabase.from("workout_plans").update({ day: oldDay, details: cleanDetailsTarget }).eq("id", targetPlan.id);
                          await supabase.from("workout_plans").update({ day: newDay }).eq("id", changeDayDialog.planId);

                          // Delete both completions first, then re-insert swapped
                          await supabase.from("workout_completions").delete()
                            .eq("user_id", userId).eq("week", week).in("day", [oldDay, newDay]);

                          const upserts: any[] = [];
                          if (compOld) {
                            upserts.push({
                              user_id: userId, week, day: newDay, done: compOld.done, skipped: compOld.skipped,
                              user_comment: compOld.user_comment || "",
                              logged_tempo: compOld.logged_tempo, logged_pulse: compOld.logged_pulse,
                              logged_distance_km: compOld.logged_distance_km, logged_weights: compOld.logged_weights as any,
                            });
                          }
                          if (compNew) {
                            upserts.push({
                              user_id: userId, week, day: oldDay, done: compNew.done, skipped: compNew.skipped,
                              user_comment: compNew.user_comment || "",
                              logged_tempo: compNew.logged_tempo, logged_pulse: compNew.logged_pulse,
                              logged_distance_km: compNew.logged_distance_km, logged_weights: compNew.logged_weights as any,
                            });
                          }
                          if (upserts.length > 0) {
                            await supabase.from("workout_completions").upsert(upserts, { onConflict: "user_id,week,day" });
                          }

                          setChangeDayDialog(null);
                          fetchData();
                        }
                      } else {
                        changeWorkoutDay(changeDayDialog.planId, d, changeDayDialog.week);
                      }
                    }
                  }}
                  disabled={isCurrentDay}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isCurrentDay 
                      ? "bg-primary text-primary-foreground" 
                      : isOccupied 
                        ? "bg-secondary text-muted-foreground cursor-pointer border border-border hover:border-primary"
                        : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground"
                  }`}
                  title={isOccupied ? `Byt plats med ${plans.find(p => p.week === changeDayDialog.week && p.day === d)?.session_name}` : undefined}
                >
                  {d}
                  {isOccupied && <span className="block text-[8px] text-muted-foreground/70 mt-0.5">upptagen</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Tryck på en upptagen dag för att byta plats mellan passen.</p>
        </div>
      </div>
    )}

    {/* Rename session dialog */}
    {renameDialog && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={() => setRenameDialog(null)} />
        <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full mx-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Byt namn på pass
            </h3>
            <button onClick={() => setRenameDialog(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && renameSession(renameDialog.planId, renameInput)}
            placeholder="Nytt namn..."
            className="w-full bg-secondary text-foreground text-sm p-2.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => renameSession(renameDialog.planId, renameInput)}
              disabled={!renameInput.trim() || renameInput.trim() === renameDialog.currentName}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Spara
            </button>
            <button
              onClick={() => setRenameDialog(null)}
              className="px-4 py-2.5 bg-secondary text-muted-foreground text-sm rounded-lg hover:text-foreground transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Share to chat dialog */}
    {chatShareTarget && chatFriends.length > 0 && (
      <>
        <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setChatShareTarget(null)} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Dela pass via chatt
              </h3>
              <button onClick={() => setChatShareTarget(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {chatShareTarget.session_name} – {chatShareTarget.details.split(/[;\n]/).filter(Boolean).length} övningar
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {chatFriends.map(friend => (
              <button
                key={friend.user_id}
                disabled={chatShareSending}
                onClick={async () => {
                  setChatShareSending(true);
                  await supabase.from("chat_messages").insert({
                    sender_id: userId,
                    receiver_id: friend.user_id,
                    message: `Delade passet "${chatShareTarget.session_name}"`,
                    message_type: "workout",
                    shared_workout: {
                      session_name: chatShareTarget.session_name,
                      details: chatShareTarget.details,
                      tempo: chatShareTarget.tempo,
                      week: chatShareTarget.week,
                    },
                  });
                  setChatShareSending(false);
                  setChatShareTarget(null);
                  triggerSave();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{friend.nickname.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium">{friend.nickname}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )}

    {/* Copy to date dialog */}
    {copyToDateSource && (
      <>
        <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setCopyToDateSource(null)} />
        <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Kopiera till datum
              </h3>
              <button onClick={() => setCopyToDateSource(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {copyToDateSource.session_name}
            </p>
          </div>

          {copyToDateConflict === "ask" ? (
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Det finns redan övningar på <span className="font-semibold text-foreground">{format(copyToDateSelected, "d MMMM yyyy", { locale: sv })}</span>. Vad vill du göra?
              </p>
              <button
                onClick={async () => {
                  setCopyToDateConflict("replace");
                  await executeCopyToDate("replace");
                }}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Ersätt befintliga övningar
              </button>
              <button
                onClick={async () => {
                  setCopyToDateConflict("add");
                  await executeCopyToDate("add");
                }}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg text-sm disabled:opacity-50"
              >
                Lägg till efter befintliga
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={copyToDateSelected}
                  onSelect={(d) => d && setCopyToDateSelected(d)}
                  locale={sv}
                  className="p-3 pointer-events-auto bg-card border border-border rounded-lg"
                />
              </div>
              <div className="bg-secondary/50 border border-border rounded-lg p-2.5 text-center">
                <p className="text-xs font-medium">
                  Kopiera till: <span className="text-primary">{format(copyToDateSelected, "EEEE d MMMM yyyy", { locale: sv })}</span>
                </p>
              </div>
              <button
                onClick={handleCopyToDateConfirm}
                disabled={copyToDateSaving}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
              >
                {copyToDateSaving ? "Kopierar..." : "Kopiera"}
              </button>
            </div>
          )}
        </div>
      </>
    )}
    </>);

};

export default WorkoutView;