import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, CheckCircle, Flame, Footprints, Weight, Star, Swords } from "lucide-react";
import WeightProgressionChart from "@/components/WeightProgressionChart";
import PersonalRecords from "@/components/PersonalRecords";
import EmptyState from "@/components/EmptyState";
import TrainingCalendar from "@/components/TrainingCalendar";
import Leaderboard from "@/components/Leaderboard";
import UntrainedMuscles from "@/components/UntrainedMuscles";
import AchievementsPanel from "@/components/AchievementsPanel";
import { getWorkoutDistanceKm } from "@/lib/workoutDistance";
import { stripSetRepSuffix } from "@/lib/exerciseNormalization";
import { useCardioVisibility, getCardioCategory } from "@/lib/cardioVisibility";

import { calculateAchievementMetrics, unlockEarnedAchievements } from "@/lib/achievements";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";


interface WorkoutStatsProps {
  userId: string;
}

interface CompletionRecord {
  week: number;
  day: string;
  done: boolean;
  skipped: boolean;
  updated_at: string;
  logged_distance_km: number | null;
  logged_tempo: string | null;
  logged_pulse: number | null;
  logged_weights: any;
  archived_plan_start_date?: string | null;
  plan_details?: string | null;
}

type View = "week" | "month" | "year";

const isAssistedBodyweightExercise = (name: string) => /assisterad|assisted/i.test(name) && /pull\s*-?\s*ups?|pullups?|chins?|dips/i.test(name);

const motivationalQuotes = [
"Framgång kommer till den som aldrig ger upp 💪",
"En dag i taget – du blir starkare varje pass 🔥",
"Det enda dåliga passet är det som inte blev av 🏋️",
"Du tävlar bara mot dig själv – och du vinner 🥇",
"Disciplin slår motivation varje dag 💯",
"Svett idag, stolthet imorgon 🌟",
"Små steg varje dag leder till stora resultat 📈",
"Din kropp klarar mer än du tror 🚀",
"Ge inte upp – du är närmare än du tror ⭐",
"Varje rep räknas – fortsätt kämpa 🏆",
"Styrka byggs inte på komfort utan på motstånd 💎",
"Du skapar den bästa versionen av dig själv 🌱",
"Det handlar inte om perfektion – det handlar om framsteg ✨",
"Idag är en bra dag att bli bättre 🎯",
"Konsistens är nyckeln till allt 🔑",
"Res dig upp, visa upp, ge allt 🙌",
"Smärtan du känner idag är styrkan du får imorgon 🦾",
"Tro på processen – resultaten kommer 🌊",
"Du ångrar aldrig ett genomfört pass 😤",
"Champions tränar även när de inte känner för det 👑",
"En timme träning är 4% av din dag – inga ursäkter 🕐",
"Ditt framtida jag kommer tacka dig 🙏",
"Starkare än igår, svagare än imorgon 📊",
"Hårt arbete lönar sig alltid i längden 🏅",
"Fokusera på framsteg, inte perfektion 🎖️",
"Du har kommit för långt för att ge upp nu 🛤️",
"Varje dag är en ny chans att bli bättre 🌅",
"Gör det svåra tills det svåra blir lätt 💫",
"Du är starkare än dina ursäkter 🧠",
"Sista repet är det som räknas mest 🔥",
"Träna som ett djur, återhämta som en proffs 🐺"];


const weightComparisons: {maxTons: number;text: string;}[] = [
{ maxTons: 5, text: "en afrikansk elefant 🐘" },
{ maxTons: 10, text: "en T-Rex 🦖" },
{ maxTons: 15, text: "en skolbuss 🚌" },
{ maxTons: 20, text: "en lastbil 🚛" },
{ maxTons: 25, text: "en stridsvagn 🪖" },
{ maxTons: 30, text: "en brandbil 🚒" },
{ maxTons: 35, text: "en knölval 🐋" },
{ maxTons: 40, text: "en semitrailer 🚛" },
{ maxTons: 45, text: "en spermaval 🐳" },
{ maxTons: 50, text: "en grävmaskin 🏗️" },
{ maxTons: 55, text: "en betongblandare 🏗️" },
{ maxTons: 60, text: "en vikingaskepp ⛵" },
{ maxTons: 65, text: "ett rymdskepp Sojuz 🚀" },
{ maxTons: 70, text: "en blåval 🐳" },
{ maxTons: 75, text: "ett Boeing 737 ✈️" },
{ maxTons: 80, text: "en ubåt 🛥️" },
{ maxTons: 85, text: "ett lokomotiv 🚂" },
{ maxTons: 90, text: "Frihetsgudinnan 🗽" },
{ maxTons: 95, text: "ett rymdfärjeprogram 🚀" },
{ maxTons: 100, text: "ett hus 🏠" },
{ maxTons: 150, text: "en jumbojet 747 ✈️" },
{ maxTons: 200, text: "en NASA-raket 🚀" },
{ maxTons: 250, text: "ett vindkraftverk 🌬️" },
{ maxTons: 300, text: "en Boeing 777 ✈️" },
{ maxTons: 350, text: "en järnvägsvagn 🚃" },
{ maxTons: 400, text: "ett passagerarfartyg ⛴️" },
{ maxTons: 450, text: "en jättesequoia 🌲" },
{ maxTons: 500, text: "ett kryssningsfartyg 🚢" },
{ maxTons: 550, text: "en rymdstation ISS 🛸" },
{ maxTons: 600, text: "ett Airbus A380 ✈️" },
{ maxTons: 650, text: "en oljetanker 🛢️" },
{ maxTons: 700, text: "en ubåt Gotland 🛥️" },
{ maxTons: 750, text: "ett pansarskepp ⚓" },
{ maxTons: 800, text: "en pyramid-block × 100 🏛️" },
{ maxTons: 850, text: "en jättemeteor ☄️" },
{ maxTons: 900, text: "en kolossalstaty 🗿" },
{ maxTons: 950, text: "en islandsfärja 🚢" },
{ maxTons: 1000, text: "Eiffeltornet 🗼" },
{ maxTons: Infinity, text: "en asteroid 🌑" }];


const getWeightComparison = (tons: number): string => {
  if (tons <= 0) return "";
  const match = weightComparisons.find((w) => tons <= w.maxTons);
  return match ? match.text : weightComparisons[weightComparisons.length - 1].text;
};

const DailyQuoteCard = () => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const quote = motivationalQuotes[dayOfYear % motivationalQuotes.length];
  return (
    <div className="border border-border rounded-lg p-4 text-center flex flex-col items-center justify-center min-h-[120px] bg-secondary">
      <Flame className="w-6 h-6 text-primary mx-auto mb-2" />
      <p className="text-sm font-medium leading-relaxed">{quote}</p>
    </div>);

};

type SummaryPeriod = "week" | "month" | "year" | "all";
const summaryPeriodLabels: Record<SummaryPeriod, string> = {
  week: "Denna vecka",
  month: "Denna månaden",
  year: "Detta året",
  all: "Totalt",
};

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setHours(0, 0, 0, 0);
  date.setDate(diff);
  return date;
};

const getStartOfMonth = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getStartOfYear = (d: Date) => {
  const date = new Date(d.getFullYear(), 0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const DAY_OFFSETS: Record<string, number> = {
  "Mån": 0, "Tis": 1, "Ons": 2, "Tor": 3, "Tors": 3, "Fre": 4, "Lör": 5, "Sön": 6,
  "Måndag": 0, "Tisdag": 1, "Onsdag": 2, "Torsdag": 3, "Fredag": 4, "Lördag": 5, "Söndag": 6,
};

const getBaseDay = (day: string) => day.replace(/_[a-z0-9]+$/i, "");

const getWorkoutCalendarDate = (planWeek: number, dayName: string, planStartDate: Date): Date => {
  // Anchor to Monday of the plan start week so day names map to actual weekdays
  const monday = getMonday(planStartDate);
  const dayOffset = DAY_OFFSETS[getBaseDay(dayName)] ?? 0;
  const date = new Date(monday);
  date.setDate(date.getDate() + (planWeek - 1) * 7 + dayOffset);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getCurrentPlanWeek = (planStartDate: Date): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(planStartDate);
  start.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.floor(daysSinceStart / 7) + 1;
};

const isStandaloneSession = (c: { week: number; day: string }) => c.week === 0;

const getStandaloneDate = (day: string): Date | null => {
  const match = day.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const d = new Date(match[1] + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
};

const getUpdatedAtDate = (updatedAt: string | null | undefined): Date | null => {
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  if (isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getCompletionStatsDate = (
  completion: Pick<CompletionRecord, "week" | "day" | "done" | "skipped" | "updated_at" | "archived_plan_start_date">,
  planStartDate: Date | null
): Date | null => {
  if (isStandaloneSession(completion)) {
    return getStandaloneDate(completion.day) ?? getUpdatedAtDate(completion.updated_at);
  }

  if (completion.done || completion.skipped) {
    // Prefer the actual completion timestamp — the plan's start date may have
    // been recalibrated since this session was completed, which would otherwise
    // shift historical completions onto the wrong calendar day.
    const updatedDate = getUpdatedAtDate(completion.updated_at);
    if (updatedDate) return updatedDate;
    const archivedStart = completion.archived_plan_start_date
      ? getStandaloneDate(completion.archived_plan_start_date)
      : null;
    const resolvedPlanStart = archivedStart ?? planStartDate;
    return resolvedPlanStart
      ? getWorkoutCalendarDate(completion.week, completion.day, resolvedPlanStart)
      : null;
  }

  if (planStartDate) {
    return getWorkoutCalendarDate(completion.week, completion.day, planStartDate);
  }

  return getUpdatedAtDate(completion.updated_at);
};

const WorkoutStats = ({ userId }: WorkoutStatsProps) => {
  const { state: cardioVis } = useCardioVisibility();
  const [userWeightKg, setUserWeightKg] = useState<number | null>(null);

  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const [view, setView] = useState<View>("week");
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("week");
  const [planStartCalendarWeek, setPlanStartCalendarWeek] = useState<{week: number;year: number;} | null>(null);
  const [planStartDate, setPlanStartDate] = useState<Date | null>(null);
  const [plansWithExercises, setPlansWithExercises] = useState<Set<string>>(new Set());
  const [planDetailsMap, setPlanDetailsMap] = useState<Map<string, string>>(new Map());
  const [plansPerDay, setPlansPerDay] = useState<Map<string, number>>(new Map());
  const [scheduledPerWeek, setScheduledPerWeek] = useState<Map<number, number>>(new Map());
  const [challengeCount, setChallengeCount] = useState(0);
  const [challengeCounts, setChallengeCounts] = useState<Record<SummaryPeriod, number>>({ week: 0, month: 0, year: 0, all: 0 });
  const [allChallenges, setAllChallenges] = useState<{ challenge_text: string; completed_at: string; challenge_date: string }[]>([]);
  const [showChallengeList, setShowChallengeList] = useState(false);
  const [achievementIds, setAchievementIds] = useState<string[]>([]);
  const getISOWeek = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return {
      week: Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
      year: date.getUTCFullYear()
    };
  };

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("weight_kg, plan_start_date").eq("user_id", userId).maybeSingle(),
      supabase.from("workout_completions")
        .select("week, day, done, skipped, updated_at, logged_distance_km, logged_tempo, logged_pulse, logged_weights")
        .eq("user_id", userId),
      supabase.from("workout_plans")
        .select("week, day, details, tempo, created_at")
        .eq("user_id", userId),
      supabase.from("daily_challenge_completions")
        .select("completed_at, challenge_text, challenge_date")
        .eq("user_id", userId).order("completed_at", { ascending: false }),
      supabase.from("archived_plans")
        .select("plan_start_date, completion_data, plan_data")
        .eq("user_id", userId),
      supabase.from("user_achievements" as any)
        .select("achievement_id")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false }),
    ]).then(async ([{ data: profileData }, { data: compData }, { data: planData }, { data: challengeData }, { data: archiveData }, { data: achievementData }]) => {
      let profileStartDate: Date | null = null;
      if (profileData) {
        if ((profileData as any).weight_kg) setUserWeightKg(parseFloat((profileData as any).weight_kg));
        if ((profileData as any).plan_start_date) {
          const psd = new Date((profileData as any).plan_start_date + "T00:00:00");
          if (!isNaN(psd.getTime())) profileStartDate = psd;
        }
      }

      const activePlanKeys = new Set((planData || []).map((p) => `${p.week}-${p.day}`));
      const activeCompletions = ((compData || []) as CompletionRecord[]).filter((c) => c.week === 0 || activePlanKeys.has(`${c.week}-${c.day}`));
      const activePlanDetails = new Map((planData || []).map((p) => [`${p.week}-${p.day}`, JSON.stringify({ details: p.details || "", tempo: p.tempo ?? "" })]));
      const achievementActiveCompletions = ((compData || []) as CompletionRecord[]).map((c) => ({
        ...c,
        plan_details: c.plan_details ?? activePlanDetails.get(`${c.week}-${c.day}`) ?? null,
      }));
      const archivedCompletions: CompletionRecord[] = [];
      for (const archive of (archiveData || []) as any[]) {
        const archiveStart = archive.plan_start_date || null;
        const planRows = Array.isArray(archive.plan_data) ? archive.plan_data : [];
        const rows = Array.isArray(archive.completion_data) ? archive.completion_data : [];
        for (const c of rows) {
          const archivedPlanRow = planRows.find((p: any) => Number(p?.week) === Number(c.week) && String(p?.day) === String(c.day));
          archivedCompletions.push({
            week: Number(c.week) || 0,
            day: String(c.day || ""),
            done: Boolean(c.done),
            skipped: Boolean(c.skipped),
            updated_at: c.updated_at || archive.archived_at || new Date(0).toISOString(),
            logged_distance_km: c.logged_distance_km ?? null,
            logged_tempo: c.logged_tempo ?? null,
            logged_pulse: c.logged_pulse ?? null,
            logged_weights: c.logged_weights ?? null,
            archived_plan_start_date: archiveStart,
            plan_details: archivedPlanRow?.details ? JSON.stringify({ details: archivedPlanRow.details, tempo: archivedPlanRow.tempo ?? "" }) : null,
          });
        }
      }

      setCompletions([...activeCompletions, ...archivedCompletions]);

      let userPlanStartDate: Date | null = profileStartDate;
      let usedProfileDate = !!profileStartDate;
      if (!userPlanStartDate && planData && planData.length > 0) {
        const earliest = planData.reduce((min, p) =>
          p.created_at < min.created_at ? p : min
        );
        userPlanStartDate = getMonday(new Date(earliest.created_at));
      }

      const now = new Date();
      const monthStart = getStartOfMonth(now);
      const yearStart = getStartOfYear(now);
      const cCounts = { week: 0, month: 0, year: 0, all: 0 };
      if (challengeData) {
        const currentMonday = getMonday(now);
        const endOfWeek = new Date(currentMonday);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        cCounts.all = challengeData.length;
        for (const c of challengeData) {
          const d = new Date(c.completed_at);
          if (d >= yearStart) cCounts.year++;
          if (d >= monthStart) cCounts.month++;
          if (d >= currentMonday && d < endOfWeek) cCounts.week++;
        }
      }
      setChallengeCounts(cCounts);
      setChallengeCount(cCounts.all);
      if (challengeData) setAllChallenges(challengeData as any);

      const storedAchievementIds = ((achievementData || []) as any[]).map((row) => row.achievement_id);
      const historicalAchievementMetrics = calculateAchievementMetrics([...achievementActiveCompletions, ...archivedCompletions], cCounts.all);
      const newlyUnlocked = await unlockEarnedAchievements(userId, historicalAchievementMetrics);
      setAchievementIds([...new Set([...newlyUnlocked.map((achievement) => achievement.id), ...storedAchievementIds])]);

      const detailsMap = new Map<string, string>();
      const exerciseKeys = new Set<string>();
      const perWeek = new Map<number, number>();
      const perDay = new Map<string, number>();

      if (planData) {
        const withExercises = planData.filter((p) => p.details && p.details.trim() !== "");
        for (const p of withExercises) {
          const key = `${p.week}-${p.day}`;
          exerciseKeys.add(key);
          if (!detailsMap.has(key)) {
            detailsMap.set(key, JSON.stringify({ details: p.details, tempo: p.tempo ?? "" }));
          }
          perWeek.set(p.week, (perWeek.get(p.week) || 0) + 1);
          perDay.set(key, (perDay.get(key) || 0) + 1);
        }
      }

      setPlansWithExercises(exerciseKeys);
      setPlanDetailsMap(detailsMap);
      setPlansPerDay(perDay);
      setScheduledPerWeek(perWeek);

      if (userPlanStartDate) {
        setPlanStartDate(userPlanStartDate);
        const isoStart = getISOWeek(userPlanStartDate);
        let weekOffset = 0;
        if (!usedProfileDate && planData && planData.length > 0) {
          const planWeekOfEarliest = planData.reduce((min, p) =>
            p.created_at < min.created_at ? p : min
          ).week as number;
          weekOffset = planWeekOfEarliest - 1;
        }
        setPlanStartCalendarWeek({
          week: isoStart.week - weekOffset,
          year: isoStart.year
        });
      }
    });
  }, [userId]);

  const hasLoggedData = (c: CompletionRecord) => {
    // Check for logged conditioning data
    if (c.logged_distance_km || c.logged_tempo || c.logged_pulse) return true;
    // Check for logged weights/sets
    if (c.logged_weights && typeof c.logged_weights === "object") {
      const keys = Object.keys(c.logged_weights as Record<string, any>);
      return keys.some(k => k.startsWith("__sets__") || k.startsWith("__setdata__") || k.startsWith("__cond__"));
    }
    return false;
  };
  const hasExercise = (c: CompletionRecord) => hasLoggedData(c) || Boolean(c.plan_details) || plansWithExercises.has(`${c.week}-${c.day}`);
  // How many separate workouts a user has on a given (week, day). At least 1 if there's exercise data.
  const passCountForDay = (c: CompletionRecord) => {
    const key = `${c.week}-${c.day}`;
    return Math.max(1, plansPerDay.get(key) || 0);
  };

  const stats = useMemo(() => {
    type Bucket = {label: string;done: number;doneWithExercise: number;skipped: number;total: number;totalWithExercise: number;distanceKm: number;sortKey: string;};
    const buckets = new Map<string, Bucket>();

    for (const c of completions) {
      const calendarDate = getCompletionStatsDate(c, planStartDate) ?? new Date(c.updated_at);
      let key: string;
      let label: string;
      let sortKey: string;

      if (view === "week") {
        // Group by plan week, label with calendar week
        const planWeek = c.week;
        key = `plan-W${planWeek}`;
        if (planStartCalendarWeek) {
          const calendarWeek = planStartCalendarWeek.week + (planWeek - 1);
          label = `V${calendarWeek} ${planStartCalendarWeek.year}`;
        } else {
          label = `Vecka ${planWeek}`;
        }
        sortKey = String(planWeek).padStart(4, "0");
      } else if (view === "month") {
        const m = calendarDate.getMonth();
        const yr = calendarDate.getFullYear();
        key = `${yr}-${String(m + 1).padStart(2, "0")}`;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
        label = `${monthNames[m]} ${yr}`;
        sortKey = key;
      } else {
        const yr = calendarDate.getFullYear();
        key = `${yr}`;
        label = `${yr}`;
        sortKey = key;
      }

      if (!buckets.has(key)) {
        buckets.set(key, { label, done: 0, doneWithExercise: 0, skipped: 0, total: 0, totalWithExercise: 0, distanceKm: 0, sortKey });
      }
      const b = buckets.get(key)!;
      const dayCount = passCountForDay(c);
      b.total++;
      if (hasExercise(c)) b.totalWithExercise += dayCount;
      if (c.done && hasExercise(c)) {
        b.done += dayCount;
        b.doneWithExercise += dayCount;
      }
      if (c.skipped) b.skipped++;
      if (c.done && hasExercise(c)) {
        const planText = c.plan_details ?? planDetailsMap.get(`${c.week}-${c.day}`);
        const cat = getCardioCategory(planText);
        const hidden = cat ? cardioVis[cat] === false : false;
        if (!hidden) {
          const distanceKm = getWorkoutDistanceKm({
            loggedDistanceKm: c.logged_distance_km,
            loggedWeights: c.logged_weights,
            planDetails: planText,
          });
          if (distanceKm > 0) {
            b.distanceKm += distanceKm;
          }
        }
      }
    }


    // For week view, ensure all weeks with scheduled exercises have a bucket and set totalWithExercise from plans
    if (view === "week") {
      for (const [planWeek, count] of scheduledPerWeek) {
        const key = `plan-W${planWeek}`;
        if (!buckets.has(key)) {
          let label: string;
          if (planStartCalendarWeek) {
            const calendarWeek = planStartCalendarWeek.week + (planWeek - 1);
            label = `V${calendarWeek} ${planStartCalendarWeek.year}`;
          } else {
            label = `Vecka ${planWeek}`;
          }
          const sortKey = String(planWeek).padStart(4, "0");
          buckets.set(key, { label, done: 0, doneWithExercise: 0, skipped: 0, total: 0, totalWithExercise: count, distanceKm: 0, sortKey });
        } else {
          buckets.get(key)!.totalWithExercise = count;
        }
      }
    }

    let result = Array.from(buckets.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    if (view === "week") {
      // Split into started (has any done/skipped) and fully pending
      const started = result.filter((b) => b.doneWithExercise > 0 || b.skipped > 0);
      const fullyCompleted = started.filter((b) => b.doneWithExercise + b.skipped >= b.totalWithExercise && b.totalWithExercise > 0);
      const inProgress = started.filter((b) => !(b.doneWithExercise + b.skipped >= b.totalWithExercise && b.totalWithExercise > 0));
      // Show in-progress weeks + up to 3 most recent completed, max 4 total
      result = [...inProgress, ...fullyCompleted.slice(0, 3)].slice(0, 4);
      result.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    }
    return result;
  }, [completions, view, planStartCalendarWeek, scheduledPerWeek, planDetailsMap, planStartDate, plansWithExercises, plansPerDay]);

  const filteredCompletions = useMemo(() => {
    if (summaryPeriod === "all") return completions;
    const now = new Date();
    const currentMonday = getMonday(now);
    const endOfWeek = new Date(currentMonday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    if (summaryPeriod === "week") {
      return completions.filter((c) => {
        const d = getCompletionStatsDate(c, planStartDate);
        return d >= currentMonday && d < endOfWeek;
      });
    }

    const startOfMonth = getStartOfMonth(now);
    const startOfYear = getStartOfYear(now);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1);

    return completions.filter((c) => {
      const d = getCompletionStatsDate(c, planStartDate);
      if (!d) return false;
      if (summaryPeriod === "year") return d >= startOfYear && d < endOfYear;
      return d >= startOfMonth && d < endOfMonth;
    });
  }, [completions, summaryPeriod, planStartDate]);

  const totalDone = filteredCompletions.reduce(
    (sum, c) => (c.done && hasExercise(c) ? sum + passCountForDay(c) : sum),
    0,
  );
  const totalSkipped = filteredCompletions.filter((c) => c.skipped).length;
  const totalDistanceKm = useMemo(() => {
    let total = 0;
    for (const c of filteredCompletions) {
      if (!c.done || !hasExercise(c)) continue;
      total += getWorkoutDistanceKm({
        loggedDistanceKm: c.logged_distance_km,
        loggedWeights: c.logged_weights,
          planDetails: c.plan_details ?? planDetailsMap.get(`${c.week}-${c.day}`),
      });
    }
    return Math.round(total * 100) / 100;
  }, [filteredCompletions, planDetailsMap, plansWithExercises]);

  const totalLiftedTons = useMemo(() => {
    let total = 0;
    for (const row of filteredCompletions) {
      if (!row.done || !hasExercise(row) || !row.logged_weights || typeof row.logged_weights !== "object") continue;
      const weights = row.logged_weights as Record<string, any>;
      // Group setdata entries by base exercise name (strip "— 3×10 @ -20 kg" style suffixes
      // that the progression engine appends when renaming). Same lift can appear under
      // multiple variant names within the same workout — keep only the variant with the
      // highest tonnage so we don't double/triple-count.
      const tonnageByBase = new Map<string, number>();
      for (const [key, value] of Object.entries(weights)) {
        if (!key.startsWith("__setdata__")) continue;
        const exerciseName = key.replace("__setdata__", "");
        let sets: { kg?: string | number; reps?: string | number }[] = [];
        if (typeof value === "string") {
          try { sets = JSON.parse(value); } catch { continue; }
        } else if (Array.isArray(value)) {
          sets = value;
        }
        const bwModeExercise = weights[`__bw_mode__${exerciseName}`];
        let entryTotal = 0;
        for (let si = 0; si < sets.length; si++) {
          const s = sets[si];
          let kg = Number(s.kg) || 0;
          const reps = Number(s.reps) || 0;
          const bwMode = weights[`__bw_mode__${exerciseName}__${si}`] ?? bwModeExercise ?? (isAssistedBodyweightExercise(exerciseName) ? "sub" : undefined);
          if (bwMode && userWeightKg) {
            const absKg = Math.abs(kg);
            kg = bwMode === "sub" ? Math.max(0, userWeightKg - absKg) : userWeightKg + absKg;
          } else if (bwMode && !userWeightKg) {
            // can't compute
          } else if (kg < 0 && userWeightKg) {
            kg = userWeightKg + kg;
            if (kg < 0) kg = 0;
          } else if (kg < 0) {
            kg = 0;
          }
          entryTotal += kg * reps;
        }
        const baseKey = stripSetRepSuffix(exerciseName).toLowerCase();
        const prev = tonnageByBase.get(baseKey) ?? 0;
        if (entryTotal > prev) tonnageByBase.set(baseKey, entryTotal);
      }
      for (const v of tonnageByBase.values()) total += v;
    }
    return Math.round(total / 1000 * 10) / 10;
  }, [filteredCompletions, userWeightKg, plansWithExercises]);


  const cyclePeriod = () => {
    const order: SummaryPeriod[] = ["all", "week", "month", "year"];
    const idx = order.indexOf(summaryPeriod);
    setSummaryPeriod(order[(idx + 1) % order.length]);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-black tracking-tight">Statistik</h2>
      </div>

      {/* Period toggle */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(["week", "month", "year", "all"] as SummaryPeriod[]).map((p) =>
        <button
          key={p}
          onClick={() => setSummaryPeriod(p)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
          summaryPeriod === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`
          }>
            {summaryPeriodLabels[p]}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-border rounded-lg p-3 text-center bg-secondary">
          <CheckCircle className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-black">{totalDone}</p>
          <p className="text-[10px] text-muted-foreground">Genomförda</p>
        </div>
        <div className="border border-border rounded-lg p-3 text-center bg-secondary">
          <Weight className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-black">{totalLiftedTons} <span className="text-xs font-normal text-muted-foreground">ton</span></p>
          <p className="text-[10px] text-muted-foreground">Lyft totalt</p>
          {totalLiftedTons > 0 &&
          <p className="text-[9px] text-muted-foreground mt-0.5">≈ {getWeightComparison(totalLiftedTons)}</p>
          }
        </div>
        <div className="border border-border rounded-lg p-3 text-center bg-secondary">
          <Footprints className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black">{Math.round(totalDistanceKm * 10) / 10}</p>
          <p className="text-[10px] text-muted-foreground">km sprungit</p>
        </div>
        <button
          onClick={() => setShowChallengeList(true)}
          className="border border-border rounded-lg p-3 text-center transition-colors cursor-pointer bg-secondary"
        >
          <Swords className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black">{challengeCounts[summaryPeriod]}</p>
          <p className="text-[10px] text-muted-foreground">Utmaningar klarade</p>
        </button>
      </div>
      <DailyQuoteCard />
      <AchievementsPanel unlockedIds={achievementIds} />

      {/* View toggle */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {([["week", "Vecka"], ["month", "Månad"], ["year", "År"]] as const).map(([v, label]) =>
        <button
          key={v}
          onClick={() => setView(v)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
          view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`
          }>

            {label}
          </button>
        )}
      </div>

      {/* Stats list */}
      {stats.length === 0 ?
      <EmptyState icon={BarChart3} title="Ingen statistik ännu" description="Genomför ditt första pass så dyker din data upp här!" emoji="📊" /> :

      <div className="space-y-2">
          {stats.map((b) => {
          const scheduled = b.totalWithExercise;
          const pctDone = scheduled > 0 ? Math.round(b.doneWithExercise / scheduled * 100) : 0;
          const pctSkipped = scheduled > 0 ? Math.round(b.skipped / scheduled * 100) : 0;
          return (
            <div key={b.label} className="border border-border rounded-lg p-3 bg-secondary">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{b.label}</span>
                  <div className="flex items-center gap-2">
                    {b.distanceKm > 0 &&
                  <span className="text-xs text-warning font-mono flex items-center gap-0.5">
                        <Footprints className="w-3 h-3" />
                        {Math.round(b.distanceKm * 10) / 10} km
                      </span>
                  }
                    <span className="text-xs text-muted-foreground">
                      {b.doneWithExercise} ✓ · {b.skipped} ✗
                    </span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden flex">
                  <div
                  className="h-full bg-success transition-all duration-300"
                  style={{ width: `${pctDone}%` }} />

                  <div
                  className="h-full bg-destructive transition-all duration-300"
                  style={{ width: `${pctSkipped}%` }} />

                </div>
              </div>);

        })}
        </div>
      }
      {/* Untrained muscles with exercise suggestions */}
      <UntrainedMuscles userId={userId} />

      {/* Leaderboard */}
      <Leaderboard userId={userId} />

      {/* Personal records */}
      <PersonalRecords userId={userId} />

      {/* Training calendar */}
      <TrainingCalendar userId={userId} />

      {/* Weight progression chart */}
      <WeightProgressionChart userId={userId} />

      {/* Challenge list dialog */}
      <Dialog open={showChallengeList} onOpenChange={setShowChallengeList}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-warning" />
              Klarade utmaningar
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {allChallenges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Inga utmaningar avklarade ännu</p>
            ) : (
              <div className="space-y-2 pr-3">
                {allChallenges.map((c, i) => (
                  <div key={i} className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.challenge_text}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(c.completed_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>);

};

export default WorkoutStats;