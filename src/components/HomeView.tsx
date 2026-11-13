import { isCompletedWorkout } from "@/lib/completionCounting";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getFirstFocus } from "@/lib/firstStart";
import {
  Dumbbell,
  Flame,
  Trophy,
  Target,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  Lightbulb,
  Plus,
  Footprints,
  Moon,
  Apple,
  Timer,
  Scale,
  Route,
  Flame as FlameIcon,
} from "lucide-react";
import {
  isHealthSupported,
  formatSleep,
  loadStoredHealthDays,
  readHealthDays,
  importBackgroundCache,
  recordHealthSyncError,
  clearHealthSyncError,
  healthLog,
  saveHealthDays,
  type HealthDay,

} from "@/lib/healthSync";
import { syncGrimWorkoutsToHealth } from "@/lib/healthWriteSync";
import { syncNutritionToHealth } from "@/lib/nutritionHealthWrite";
import { ACHIEVEMENTS, calculateAchievementMetrics, getAchievementById } from "@/lib/achievements";
import { syncAchievements } from "@/lib/achievementSync";
import { toLocalDateKey } from "@/lib/dateUtils";
import { completionTrainingDate, currentStreakFromDates } from "@/lib/streak";
import { loadUntrainedRegions, buildSuggestion } from "@/lib/untrainedMuscles";
import { restingHrSignal } from "@/lib/restingHr";
import HealthWorkoutPrompt from "@/components/HealthWorkoutPrompt";
import HomeTrainingStats from "@/components/HomeTrainingStats";
import HomeHealthTrends from "@/components/HomeHealthTrends";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import DailyRecipeCard from "@/components/DailyRecipeCard";
import { getCardioModes, getStoredCardioMode } from "@/lib/cardioUnits";
import { computeWeekProgress } from "@/lib/homeDashboard";
import { isPlausibleMealLog } from "@/lib/inputValidation";
import { getModules } from "@/lib/modules";
import { formatDurationMin } from "@/lib/workoutSummary";

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

interface PlanRow {
  week: number;
  day: string;
  details: string | null;
  session_name?: string | null;
  created_at?: string | null;
}
interface CompletionRow {
  week: number;
  day: string;
  done: boolean | null;
  skipped?: boolean | null;
  updated_at?: string | null;
  logged_distance_km?: number | null;
  logged_weights?: Record<string, unknown> | null;
}

const parseDateKey = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
};

const getMondayUtc = (d: Date) => {
  const copy = new Date(d);
  const dayIdx = (copy.getUTCDay() + 6) % 7; // 0 = Monday
  copy.setUTCDate(copy.getUTCDate() - dayIdx);
  return copy;
};

const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 86400000);

const greetingFor = (hour: number) => {
  if (hour < 5) return "God natt";
  if (hour < 10) return "God morgon";
  if (hour < 13) return "God förmiddag";
  if (hour < 17) return "God eftermiddag";
  if (hour < 22) return "God kväll";
  return "God natt";
};

const REST_NAME = /(?<!\p{L})(vila|vilodag|återhämtning|rest)(?!\p{L})/iu;

/**
 * Dagens läge på Hem: vilodag (inget planerat eller bara «Vila»), ett planerat pass
 * utan övningar, eller ett pass med innehåll. Styr vilken knapp som visas.
 */
export function classifyToday(todays: Pick<PlanRow, "details" | "session_name">[]): "rest" | "empty" | "workout" {
  if (todays.length === 0) return "rest";
  const withContent = todays.filter((p) => !!p.details && p.details.trim().length > 0);
  if (withContent.length > 0) return "workout";
  return todays.every((p) => !p.session_name?.trim() || REST_NAME.test(p.session_name)) ? "rest" : "empty";
}

/** Strips set/rep instruction noise so the card stays readable. */
const summarizeDetails = (details: string | null): string[] => {
  if (!details) return [];
  return details
    .split("\n")
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
};

/**
 * Loggade pass sparas som fritext (t.ex. "Cykling — 45 min, 30.0/km, 22.5 km").
 * Sporter vars enhet är km/h (cykling m.fl.) ska aldrig visa farten som "/km".
 */
const fixCardioUnitSuffix = (line: string): string => {
  const sep = line.indexOf("—");
  const name = sep >= 0 ? line.slice(0, sep).trim() : line;
  if (getStoredCardioMode(name) === "watt") return line.replace(/(\d+(?:[.,]\d+)?)\s*(?:\/\s*km|km\/h)\b/g, "$1 W");
  if (getCardioModes(name)[0] !== "kmh") return line;
  return line.replace(/(\d+(?:[.,]\d+)?)\s*\/\s*km\b/g, "$1 km/h");
};

interface HomeViewProps {
  userId: string;
  onNavigate: (tab: "workout" | "stats" | "social" | "nutrition" | "calc") => void;
  onOpenAchievements?: () => void;
  isHonorary?: boolean;
}

// Senast hämtade Hem-data per användare (åtgärd 23): vid flikbyte visas den direkt
// i stället för skelett, och uppdateras i bakgrunden när den nya hämtningen är klar.
type HomeCache = {
  nickname: string;
  planStartDate: string | null;
  plans: PlanRow[];
  completions: CompletionRow[];
  achievementCount: number;
  latestAchievement: { id: string; unlocked_at: string } | null;
};
const homeCache = new Map<string, HomeCache>();
const archivedCache = new Map<string, string[]>();
const untrainedCache = new Map<string, string[]>();

const HomeView = ({ userId, onNavigate, isHonorary = false }: HomeViewProps) => {
  const focus = getFirstFocus(userId);
  const cached = homeCache.get(userId);
  // Visar en ofarlig Samsung Health-demonstration i Lovables förhandsvisning.
  const healthPreview = import.meta.env.DEV;
  const [loading, setLoading] = useState(!cached);
  const [nickname, setNickname] = useState<string>(cached?.nickname ?? "");
  const [planStartDate, setPlanStartDate] = useState<string | null>(cached?.planStartDate ?? null);
  const [plans, setPlans] = useState<PlanRow[]>(cached?.plans ?? []);
  const [completions, setCompletions] = useState<CompletionRow[]>(cached?.completions ?? []);
  const [latestAchievement, setLatestAchievement] = useState<{ id: string; unlocked_at: string } | null>(cached?.latestAchievement ?? null);
  const [achievementCount, setAchievementCount] = useState(cached?.achievementCount ?? 0);
  const [untrainedRegions, setUntrainedRegions] = useState<string[] | null>(() => untrainedCache.get(userId) ?? null);
  const [archivedDates, setArchivedDates] = useState<string[]>(() => archivedCache.get(userId) ?? []);
  const [healthToday, setHealthToday] = useState<HealthDay | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthDay[]>([]);
  const restingHr = useMemo(() => restingHrSignal(healthHistory, toLocalDateKey(new Date())), [healthHistory]);
  const nutritionOn = getModules().nutrition;
  const [nutritionToday, setNutritionToday] = useState<{ kcal: number; protein: number; kcalGoal: number; proteinGoal: number; logged: boolean } | null>(null);

  // Dagens kost (kalorier + protein) – samma mål och rimlighetsregler som Kost-fliken.
  useEffect(() => {
    if (!nutritionOn) return;
    let cancelled = false;
    const day = toLocalDateKey(new Date());
    Promise.all([
      supabase.from("meal_logs").select("amount, unit, kcal, protein_g, fat_g, carbs_g").eq("user_id", userId).eq("log_date", day),
      supabase.from("nutrition_goals").select("daily_kcal, protein_g").eq("user_id", userId).maybeSingle(),
    ]).then(([{ data: logs }, { data: goals }]) => {
      if (cancelled) return;
      const rows = ((logs || []) as any[]).filter(isPlausibleMealLog);
      setNutritionToday({
        kcal: Math.round(rows.reduce((sum, r) => sum + Number(r.kcal || 0), 0)),
        protein: Math.round(rows.reduce((sum, r) => sum + Number(r.protein_g || 0), 0)),
        kcalGoal: Number((goals as any)?.daily_kcal) || 2000,
        proteinGoal: Number((goals as any)?.protein_g) || 100,
        logged: rows.length > 0,
      });
    }).catch(() => { /* kortet visas inte utan data */ });
    return () => { cancelled = true; };
  }, [userId, nutritionOn]);

  // Steg och aktiva kalorier från hälsoappen (sparad data visas även i webben).
  useEffect(() => {
    let cancelled = false;
    if (healthPreview) {
      setHealthToday({ day: toLocalDateKey(new Date()), steps: 8_421, activeCalories: 624, sleepMinutes: 437 });
      return () => {
        cancelled = true;
      };
    }
    const todayKeyLocal = toLocalDateKey(new Date());
    const applyStored = async () => {
      try {
        const stored = await loadStoredHealthDays(userId, 15);
        if (cancelled) return;
        setHealthHistory(stored);
        const row = stored.find((r) => r.day === todayKeyLocal) ?? stored[stored.length - 1] ?? null;
        setHealthToday(row && (row.steps > 0 || row.activeCalories > 0) ? row : null);
      } catch {
        /* ignore */
      }
    };
    void applyStored();
    // Läser vid kallstart och när appen kommer fram igen (max var 5:e minut).
    // Fel sparas och visas i Health Connect-kortet i stället för att sväljas.
    let lastRun = 0;
    const runSync = () => {
      if (!isHealthSupported() || Date.now() - lastRun < 5 * 60_000) return;
      lastRun = Date.now();
      (async () => {
        // Data som bakgrundsjobbet hämtat medan appen var stängd sparas först.
        try {
          if ((await importBackgroundCache(userId)) > 0 && !cancelled) await applyStored();
        } catch (err) {
          recordHealthSyncError("home background cache", err);
        }
        try {
          const days = await readHealthDays(7);
          await saveHealthDays(userId, days);
          clearHealthSyncError();
          if (!cancelled) await applyStored();
        } catch (err) {
          recordHealthSyncError("home health read", err);
        }
        try {
          const w = await syncGrimWorkoutsToHealth(userId);
          if (w.written + w.deleted + w.failed > 0) healthLog("home write sync", w);
        } catch (err) {
          recordHealthSyncError("home health write", err);
        }
        try {
          await syncNutritionToHealth(userId);
        } catch (err) {
          recordHealthSyncError("home nutrition write", err);
        }
      })();
    };
    runSync();
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) runSync();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, healthPreview]);

  // Träningsdatum från arkiverade planer räknas också in i streaken.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("archived_plans")
      .select("completion_data, archived_at")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        const dates: string[] = [];
        for (const row of (data || []) as any[]) {
          const cd = row?.completion_data;
          const list: any[] = Array.isArray(cd) ? cd : cd && typeof cd === "object" ? Object.values(cd) : [];
          for (const c of list) {
            if (!c?.done) continue;
            const ts = c.updated_at || row.archived_at;
            const d = ts ? new Date(ts) : null;
            if (d && !Number.isNaN(d.getTime())) dates.push(toLocalDateKey(d));
          }
        }
        archivedCache.set(userId, dates);
        setArchivedDates(dates);
      });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    loadUntrainedRegions(userId)
      .then((regions) => { untrainedCache.set(userId, regions); if (!cancelled) setUntrainedRegions(regions); })
      .catch(() => { if (!cancelled) setUntrainedRegions([]); });
    return () => { cancelled = true; };
  }, [userId]);



  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("profiles").select("display_name, plan_start_date").eq("user_id", userId).maybeSingle(),
      supabase.from("workout_plans").select("week, day, details, session_name, created_at").eq("user_id", userId),
      supabase.from("workout_completions").select("week, day, done, skipped, updated_at, logged_distance_km, logged_weights").eq("user_id", userId),
      syncAchievements(userId).catch(() => null),
    ])
      .then(([{ data: profile }, { data: planData }, { data: compData }, achSync]) => {
        if (cancelled) return;
        const p = profile as { display_name?: string | null; plan_start_date?: string | null } | null;
        // Hälsningen använder visningsnamn – aldrig användarnamnet.
        setNickname(p?.display_name?.trim() || "");
        if (p?.plan_start_date) setPlanStartDate(p.plan_start_date);
        setPlans((planData as PlanRow[]) ?? []);
        setCompletions((compData as CompletionRow[]) ?? []);
        const prev = homeCache.get(userId);
        let achCount = prev?.achievementCount ?? 0;
        let latest = prev?.latestAchievement ?? null;
        if (achSync) {
          setAchievementCount(achSync.ids.length);
          achCount = achSync.ids.length;
          if (achSync.latestId) {
            latest = { id: achSync.latestId, unlocked_at: achSync.stamps[achSync.latestId] };
            setLatestAchievement(latest);
          }
        }
        homeCache.set(userId, {
          nickname: p?.display_name?.trim() || "",
          planStartDate: p?.plan_start_date ?? prev?.planStartDate ?? null,
          plans: (planData as PlanRow[]) ?? [],
          completions: (compData as CompletionRow[]) ?? [],
          achievementCount: achCount,
          latestAchievement: latest,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // 0 = Monday
  const todayAbbr = DAYS[todayIdx];
  const todayKey = toLocalDateKey(now);

  /** "Tors_ab12" -> "tors", "Tor" -> "tors" so plan/completion keys line up. */
  const normalizeDay = (value: string) => {
    const base = value.trim().replace(/_[a-z0-9]+$/i, "").toLowerCase();
    return base === "tor" ? "tors" : base;
  };
  const isToday = (value: string) =>
    normalizeDay(value) === normalizeDay(todayAbbr) || value.trim().startsWith(todayKey);
  const hasContent = (details: string | null | undefined) => !!details && details.trim().length > 0;

  const currentWeek = useMemo(() => {
    const weeks = plans.map((p) => p.week).filter((w) => w > 0);
    if (weeks.length === 0) return 1;
    const maxWeek = Math.max(...weeks);

    // Prefer the calibrated plan start, otherwise fall back to the oldest plan row.
    let startMonday: Date | null = null;
    if (planStartDate) {
      const start = parseDateKey(planStartDate);
      if (start) startMonday = getMondayUtc(start);
    }
    if (!startMonday) {
      const created = plans
        .filter((p) => p.week > 0 && p.created_at)
        .map((p) => new Date(p.created_at as string).getTime())
        .filter((t) => !Number.isNaN(t));
      if (created.length > 0) startMonday = getMondayUtc(new Date(Math.min(...created)));
    }
    if (!startMonday) return 1;

    const today = parseDateKey(todayKey);
    if (!today) return 1;
    const week = Math.floor(daysBetween(startMonday, today) / 7) + 1;
    return Math.min(Math.max(week, 1), maxWeek);
  }, [plans, planStartDate, todayKey]);

  const todaysPlans = useMemo(
    () =>
      plans.filter(
        (p) => (p.week === currentWeek && isToday(p.day)) || (p.week === 0 && p.day.trim().startsWith(todayKey)),
      ),
    [plans, currentWeek, todayKey, todayAbbr],
  );

  const todayDone = useMemo(
    () =>
      completions.some(
        (c) =>
          c.done &&
          ((c.week === currentWeek && isToday(c.day)) || (c.week === 0 && c.day.trim().startsWith(todayKey))),
      ),
    [completions, currentWeek, todayKey, todayAbbr],
  );

  const noActivePlan = plans.length === 0;
  // «Vila» utan övningar är en vilodag – inte ett pass som saknar övningar.
  const todayKind = classifyToday(todaysPlans);

  const DAY_NAMES_FULL: Record<string, string> = {
    mån: "Måndag", tis: "Tisdag", ons: "Onsdag", tors: "Torsdag", fre: "Fredag", lör: "Lördag", sön: "Söndag",
  };

  const nextSession = useMemo(() => {
    for (let i = 1; i <= 8; i++) {
      const idx = (todayIdx + i) % 7;
      const abbr = DAYS[idx];
      const wrapped = todayIdx + i >= 7;
      const weekToCheck = wrapped ? currentWeek + 1 : currentWeek;
      const match = plans.find(
        (p) => p.week === weekToCheck && normalizeDay(p.day) === normalizeDay(abbr) && hasContent(p.details),
      );
      if (match) {
        return {
          dayLabel: DAY_NAMES_FULL[normalizeDay(abbr)] ?? abbr,
          name: match.session_name?.trim() || "Pass",
        };
      }
    }
    return null;
  }, [plans, currentWeek, todayIdx]);

  const weekPlanned = useMemo(() => {
    const dayKeys = new Set(
      plans.filter((p) => p.week === currentWeek && hasContent(p.details)).map((p) => normalizeDay(p.day)),
    );
    return dayKeys.size;
  }, [plans, currentWeek]);

  const weekCompleted = useMemo(() => {
    // Samma definition som Statistik: genomförda pass (med belägg) denna kalendervecka (UTC, måndag),
    // inklusive enskilda pass och extrapass.
    const now = new Date();
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const start = monday.getTime();
    const end = start + 7 * 86400000;
    const keys = new Set(
      completions
        .filter((c) => {
          if (!isCompletedWorkout(c as any)) return false;
          const t = c.updated_at ? new Date(c.updated_at).getTime() : NaN;
          return t >= start && t < end;
        })
        .map((c) => `${c.week}-${normalizeDay(c.day)}`),
    );
    return keys.size;
  }, [completions]);

  const goal = weekPlanned > 0 ? weekPlanned : 3;
  const progressPct = goal > 0 ? Math.min(100, Math.round((weekCompleted / goal) * 100)) : 0;
  const weekProgress = useMemo(() => {
    const detailsByKey = new Map<string, string>();
    for (const p of plans) {
      const k = `${p.week}-${normalizeDay(p.day)}`;
      detailsByKey.set(k, `${detailsByKey.get(k) ?? ""}\n${p.details ?? ""}`);
    }
    return computeWeekProgress(completions, (w, d) => detailsByKey.get(`${w}-${normalizeDay(d)}`));
  }, [completions, plans]);

  const planStartMonday = useMemo(() => {
    if (planStartDate) {
      const start = parseDateKey(planStartDate);
      if (start) return getMondayUtc(start);
    }
    const created = plans
      .filter((p) => p.week > 0 && p.created_at)
      .map((p) => new Date(p.created_at as string).getTime())
      .filter((t) => !Number.isNaN(t));
    if (created.length > 0) return getMondayUtc(new Date(Math.min(...created)));
    return null;
  }, [plans, planStartDate]);

  const streak = useMemo(() => {
    const dateSet = new Set<string>(archivedDates);
    for (const c of completions) {
      if (!c.done) continue;
      const key = completionTrainingDate(c, planStartMonday);
      if (key) dateSet.add(key);
    }
    return currentStreakFromDates(dateSet);
  }, [completions, archivedDates, planStartMonday]);

  const achievementDef = latestAchievement ? getAchievementById(latestAchievement.id) : undefined;

  // "Vad ska jag göra idag?" — only when nothing is scheduled (and nothing done yet)
  const hasScheduledToday = todaysPlans.some((p) => hasContent(p.details));
  const suggestion = useMemo(
    () => (untrainedRegions ? buildSuggestion(untrainedRegions) : null),
    [untrainedRegions],
  );
  const showSuggestion = !hasScheduledToday && !todayDone && !!suggestion;

  const openPickerForGroup = (muscleGroup: string | null) => {
    onNavigate("workout");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("grim:open-exercise-picker", { detail: { muscleGroup } }));
    }, 250);
  };

  const greeting = `${greetingFor(now.getHours())}${nickname ? `, ${nickname}` : ""}!`;

  // «Fredag 13 november» – bara första bokstaven versal (CSS capitalize gav «13 November»).
  const dateRaw = now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  const dateLabel = dateRaw.charAt(0).toUpperCase() + dateRaw.slice(1);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Greeting */}
      <header className="space-y-1">
        <h1 className="text-2xl font-brand leading-tight">{greeting}</h1>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          {dateLabel}
          {currentWeek > 0 && <span className="text-muted-foreground/70">· Vecka {currentWeek}</span>}
        </p>
      </header>

      <nav className="grid grid-cols-3 gap-2" aria-label="Snabbval">
        <Button variant={focus === "nutrition" ? "outline" : "default"} className={`h-auto min-h-14 flex-col gap-1 px-1 py-2 text-xs ${focus === "nutrition" ? "order-2" : "order-1"}`} onClick={() => onNavigate("workout")}><Dumbbell />Starta pass</Button>
        {nutritionOn && <Button variant={focus === "nutrition" ? "default" : "outline"} className={`h-auto min-h-14 flex-col gap-1 px-1 py-2 text-xs ${focus === "nutrition" ? "order-1" : "order-2"}`} onClick={() => { sessionStorage.setItem("grim_nutrition_action", "food"); onNavigate("nutrition"); }}><Apple />Logga mat</Button>}
        <Button variant="outline" className="order-3 h-auto min-h-14 flex-col gap-1 px-1 py-2 text-xs" onClick={() => { sessionStorage.setItem("grim_nutrition_action", "weight"); sessionStorage.setItem("grim_nutrition_insights_tab", "weight"); onNavigate("nutrition"); }}><Scale />Logga vikt</Button>
      </nav>

      {/* 1. Today's workout — most important */}
      <section
        className={`py-4 space-y-3 border-b border-border ${todayDone ? "border-success/50" : ""}`}
        aria-label="Dagens pass"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${todayDone ? "bg-success/15 text-success" : todayKind === "rest" && !noActivePlan ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
              {todayDone ? <CheckCircle2 className="w-5 h-5" /> : todayKind === "rest" && !noActivePlan ? <Moon className="w-5 h-5" /> : <Dumbbell className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Dagens pass</p>
              <p className="text-sm font-semibold truncate">
                {noActivePlan
                  ? "Ingen plan än"
                  : todayKind === "rest"
                  ? "Vilodag"
                  : todaysPlans
                      .map((p) => p.session_name?.trim())
                      .filter(Boolean)
                      .join(" + ") || (todayDone ? "Klarmarkerat" : "Redo att köra")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {todayKind === "workout" && (
              <span className={`whitespace-nowrap text-[10px] font-bold uppercase px-2 py-1 rounded-full ${todayDone ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                {todayDone ? "Klart" : "Ej klart"}
              </span>
            )}
          </div>
        </div>

        {noActivePlan ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ingen plan än – börja med en plan eller ett enkelt pass.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 min-w-[140px]" onClick={() => onNavigate("workout")}>
                Välj en plan
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <Button variant="outline" className="flex-1 min-w-[140px]" onClick={() => openPickerForGroup(null)}>
                <Plus className="w-4 h-4 mr-1" />
                Enkelt pass
              </Button>
            </div>
          </div>
        ) : (
          <>
            {todayKind === "rest" && !todayDone ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Vilodag idag. Återhämtning är en del av träningen – musklerna bygger upp sig nu.
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {nextSession && (
                    <p className="text-xs text-muted-foreground">
                      Nästa pass: <span className="font-semibold text-foreground">{nextSession.dayLabel} – {nextSession.name}</span>
                    </p>
                  )}
                  <button type="button" onClick={() => onNavigate("workout")} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
                    Träna ändå
                  </button>
                </div>
              </div>
            ) : todayKind === "empty" && !todayDone ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Passet är planerat men har inga övningar än.</p>
                <Button className="w-full" onClick={() => openPickerForGroup(null)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Lägg till övningar
                </Button>
              </div>
            ) : (
              <>
                {todayKind === "workout" && (
                  <ul className="space-y-1.5">
                    {todaysPlans.flatMap((p) => summarizeDetails(p.details).map(fixCardioUnitSuffix)).slice(0, 5).map((line, i) => (
                      <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                        <span className="line-clamp-1">{line}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {todayDone && nextSession && (
                  <p className="text-xs text-muted-foreground">
                    Nästa pass: <span className="font-semibold text-foreground">{nextSession.dayLabel} – {nextSession.name}</span>
                  </p>
                )}

                <Button className="w-full" variant={todayDone ? "outline" : "default"} onClick={() => onNavigate("workout")}>
                  {todayDone ? "Visa passet" : "Starta passet"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
          </>
        )}
      </section>

      {/* 3. Dagens kost: kalorier och protein */}
      {nutritionOn && nutritionToday && (
        <button
          type="button"
          onClick={() => onNavigate("nutrition")}
          className="w-full text-left py-4 border-b border-border space-y-3 order-2"
          aria-label="Kost idag – öppna Kost"
        >
          <div className="flex items-center gap-2">
            <Apple className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Kost idag</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </div>
          {nutritionToday.logged ? (
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: "Kalorier", value: nutritionToday.kcal, goal: nutritionToday.kcalGoal, unit: "kcal" },
                { label: "Protein", value: nutritionToday.protein, goal: nutritionToday.proteinGoal, unit: "g" },
              ] as const).map((m) => {
                const pct = Math.min(100, Math.round((m.value / Math.max(1, m.goal)) * 100));
                return (
                  <div key={m.label} className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">{m.label}</p>
                    <p className="text-lg font-bold tabular-nums leading-none">
                      {m.value.toLocaleString("sv-SE")}
                      <span className="text-xs font-medium text-muted-foreground"> / {m.goal.toLocaleString("sv-SE")} {m.unit}</span>
                    </p>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${m.label === "Protein" ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="col-span-2 text-xs text-muted-foreground">
                {nutritionToday.protein >= nutritionToday.proteinGoal
                  ? "Proteinmålet är nått idag."
                  : <><span className="font-semibold text-foreground">{(nutritionToday.proteinGoal - nutritionToday.protein).toLocaleString("sv-SE")} g protein</span> kvar idag</>}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Inget loggat än idag. Tryck för att logga din första måltid.</p>
          )}
        </button>
      )}

      {/* 4. Aktivitet från hälsoappen (Health Connect / Apple Health) */}
      <HealthWorkoutPrompt userId={userId} preview={healthPreview} />
      {healthToday && (
        <section className="card-soft p-4 space-y-3" aria-label="Aktivitet idag">
          {healthPreview && (
            <div className="flex items-center gap-2 text-xs font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Samsung Health synkades precis
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1" aria-label="Steg idag">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Footprints className="w-4 h-4" />
                <span className="text-[11px] uppercase tracking-wider font-semibold">Steg idag</span>
              </div>
              <p className="text-2xl font-bold leading-none">{healthToday.steps.toLocaleString("sv-SE")}</p>
              <p className="text-[11px] text-muted-foreground">{healthPreview ? "från Samsung Health" : "från din hälsoapp"}</p>
            </div>
            <div className="space-y-1" aria-label="Aktiva kalorier idag">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FlameIcon className="w-4 h-4" />
                <span className="text-[11px] uppercase tracking-wider font-semibold">Aktiva kcal</span>
              </div>
              <p className="text-2xl font-bold leading-none">{healthToday.activeCalories.toLocaleString("sv-SE")}</p>
              <p className="text-[11px] text-muted-foreground">totalt idag</p>
            </div>
          </div>
          {restingHr && (
            <div className="space-y-1" aria-label="Dagens form">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">Dagens form</span>
                <span className="rounded-full border border-border bg-card px-2 py-0.5">
                  Vilopuls {restingHr.today}
                  {restingHr.delta !== null && (
                    <span className={restingHr.elevated ? " text-warning" : ""}>
                      {" "}{restingHr.delta > 1 ? "↑" : restingHr.delta < -1 ? "↓" : "→"} {restingHr.delta > 0 ? "+" : ""}{restingHr.delta} mot 7 d
                    </span>
                  )}
                </span>
              </div>
              {restingHr.elevated && (
                <p className="text-[11px] text-muted-foreground">Vilopulsen är hög — lättare pass idag?</p>
              )}
            </div>
          )}
          {healthToday.sleepMinutes > 0 && (
            <p className="text-[11px] text-muted-foreground">Sömn i natt: {formatSleep(healthToday.sleepMinutes)}</p>
          )}
          <HomeHealthTrends days={healthHistory} />
        </section>
      )}

      <DailyRecipeCard userId={userId} isHonorary={isHonorary} />

      {/* 2. Veckans framsteg: pass, minuter, km och svit */}
      <details className="group border-t border-border pt-4 order-last" id="home-week-overview">
      <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold py-2">Veckans översikt<ChevronRight className="h-5 w-5 transition-transform group-open:rotate-90" /></summary>
      <section className="py-4 space-y-3" aria-label="Veckans framsteg">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-success" />
          <p className="text-sm font-semibold">Veckans framsteg</p>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${streak > 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}
            aria-label={`Svit: ${streak} ${streak === 1 ? "dag" : "dagar"} i rad`}
          >
            <Flame className="w-3.5 h-3.5" />
            {streak > 0 ? `${streak} ${streak === 1 ? "dag" : "dagar"} i rad` : "Ingen svit än"}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold leading-none tabular-nums">
              {weekCompleted}
              <span className="text-sm font-medium text-muted-foreground"> av {goal} pass</span>
            </p>
            <span className="text-xs font-semibold text-success tabular-nums">{progressPct} %</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
            <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="tile-soft p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Timer className="w-3.5 h-3.5" />Träningstid</p>
            <p className="text-lg font-bold tabular-nums">{weekProgress.minutes > 0 ? formatDurationMin(weekProgress.minutes) : "–"}</p>
          </div>
          <div className="tile-soft p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Route className="w-3.5 h-3.5" />Distans</p>
            <p className="text-lg font-bold tabular-nums">{weekProgress.km > 0 ? `${weekProgress.km.toLocaleString("sv-SE")} km` : "–"}</p>
          </div>
        </div>
      </section>

      <WeeklySummaryCard userId={userId} onStartWorkout={() => onNavigate("workout")} />
      <HomeTrainingStats userId={userId} onStartWorkout={() => onNavigate("workout")} />
      <Button variant="ghost" className="w-full justify-start h-auto py-4" onClick={() => onNavigate("stats")}><Trophy className="text-warning" /><span>{achievementDef ? achievementDef.title : "Utmärkelser"} · {achievementCount} av {ACHIEVEMENTS.length}</span><ChevronRight className="ml-auto" /></Button>
      </details>


      {/* 7. Litet förslagskort sist, bara när inget är inplanerat */}
      {showSuggestion && suggestion && (
        <section className="rounded-tile border border-border/70 p-3 space-y-2" aria-label="Förslag för idag">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Förslag: {suggestion.title}</p>
              <p className="text-xs text-muted-foreground">
                {suggestion.labels.join(", ")} har vilat i 7 dagar. Ett pass med fokus på {suggestion.title.toLowerCase()} balanserar veckan.
              </p>
            </div>
          </div>
          <div className={`grid gap-2 ${suggestion.groups.length >= 3 ? "grid-cols-3" : suggestion.groups.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {suggestion.groups.map((group, i) => (
              <Button
                key={group}
                size="sm"
                variant={i === 0 ? "default" : "outline"}
                className="w-full min-w-0 px-2"
                onClick={() => openPickerForGroup(group)}
              >
                {i === 0 && <Plus className="w-4 h-4" />}
                <span className="truncate">{group}</span>
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomeView;
