import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, CheckCircle, XCircle, Flame, Footprints, Weight, Star, Swords } from "lucide-react";
import WeightProgressionChart from "@/components/WeightProgressionChart";
import PersonalRecords from "@/components/PersonalRecords";
import EmptyState from "@/components/EmptyState";
import TrainingCalendar from "@/components/TrainingCalendar";
import Leaderboard from "@/components/Leaderboard";
import UntrainedMuscles from "@/components/UntrainedMuscles";
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
}

type View = "week" | "month" | "year";

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
    <div className="bg-card border border-border rounded-lg p-3 text-center flex flex-col items-center justify-center">
      <Flame className="w-5 h-5 text-primary mx-auto mb-1" />
      <p className="text-sm font-medium leading-tight">{quote}</p>
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

const DAY_OFFSETS: Record<string, number> = { "Mån": 0, "Tis": 1, "Ons": 2, "Tors": 3, "Fre": 4, "Lör": 5, "Sön": 6 };

const getWorkoutCalendarDate = (planWeek: number, dayName: string, planStartDate: Date): Date => {
  // Anchor to Monday of the plan start week so day names map to actual weekdays
  const monday = getMonday(planStartDate);
  const dayOffset = DAY_OFFSETS[dayName] ?? 0;
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

/** Extract distance from plan details text, using only LOGGED conditioning entries (with "—" separator and tempo/time data).
 *  Excludes cycling (cykel/motioncykel) — only counts running/walking exercises.
 *  Logged entries look like "Löpning — 37 min, 7:19/km, 5.06 km". Suggested distances like "Löpning 8.5 km" are NOT counted. */
const CYCLING_KEYWORDS = /cykel|motioncykel|spinning|crosstrainer/i;
const extractDistanceFromDetails = (details: string): number => {
  let loggedTotal = 0;
  const lines = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    // Only process logged conditioning lines (with "—" separator)
    const dashMatch = line.match(/^(.+?)\s*—\s*(.+)$/);
    if (!dashMatch) continue;
    const name = dashMatch[1].trim();
    const info = dashMatch[2];
    // Skip cycling exercises
    if (CYCLING_KEYWORDS.test(name)) continue;
    // Extract distance: look for X km (not /km)
    const distMatch = info.match(/([\d.,]+)\s*km(?!\/)/);
    if (distMatch) {
      loggedTotal += parseFloat(distMatch[1].replace(",", ".")) || 0;
    }
  }
  return loggedTotal;
};

const WorkoutStats = ({ userId }: WorkoutStatsProps) => {
  const [userWeightKg, setUserWeightKg] = useState<number | null>(null);
  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const [view, setView] = useState<View>("week");
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("all");
  const [planStartCalendarWeek, setPlanStartCalendarWeek] = useState<{week: number;year: number;} | null>(null);
  const [planStartDate, setPlanStartDate] = useState<Date | null>(null);
  const [plansWithExercises, setPlansWithExercises] = useState<Set<string>>(new Set());
  const [planDetailsMap, setPlanDetailsMap] = useState<Map<string, string>>(new Map());
  const [scheduledPerWeek, setScheduledPerWeek] = useState<Map<number, number>>(new Map());
  const [challengeCount, setChallengeCount] = useState(0);
  const [challengeCounts, setChallengeCounts] = useState<Record<SummaryPeriod, number>>({ week: 0, month: 0, year: 0, all: 0 });
  const [allChallenges, setAllChallenges] = useState<{ challenge_text: string; completed_at: string; challenge_date: string }[]>([]);
  const [showChallengeList, setShowChallengeList] = useState(false);
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
        .select("week, day, details, created_at")
        .eq("user_id", userId),
      supabase.from("daily_challenge_completions")
        .select("completed_at, challenge_text, challenge_date")
        .eq("user_id", userId).order("completed_at", { ascending: false }),
    ]).then(([{ data: profileData }, { data: compData }, { data: planData }, { data: challengeData }]) => {
      // Profile
      let profileStartDate: Date | null = null;
      if (profileData) {
        if ((profileData as any).weight_kg) setUserWeightKg(parseFloat((profileData as any).weight_kg));
        if ((profileData as any).plan_start_date) {
          const psd = new Date((profileData as any).plan_start_date + "T00:00:00");
          if (!isNaN(psd.getTime())) profileStartDate = psd;
        }
      }

      if (compData) setCompletions(compData as CompletionRecord[]);

      // Determine plan start date: prefer profile, fallback to earliest plan
      let userPlanStartDate: Date | null = profileStartDate;
      let usedProfileDate = !!profileStartDate;
      if (!userPlanStartDate && planData && planData.length > 0) {
        const earliest = planData.reduce((min, p) =>
          p.created_at < min.created_at ? p : min
        );
        userPlanStartDate = getMonday(new Date(earliest.created_at));
      }

      // Compute challenge counts per period
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
      if (planData) {
        const withExercises = planData.filter((p) => p.details && p.details.trim() !== "");
        setPlansWithExercises(new Set(withExercises.map((p) => `${p.week}-${p.day}`)));
        const detailsMap = new Map<string, string>();
        for (const p of withExercises) {
          detailsMap.set(`${p.week}-${p.day}`, p.details);
        }
        setPlanDetailsMap(detailsMap);
        const perWeek = new Map<number, number>();
        for (const p of withExercises) {
          perWeek.set(p.week, (perWeek.get(p.week) || 0) + 1);
        }
        setScheduledPerWeek(perWeek);
        if (userPlanStartDate) {
          setPlanStartDate(userPlanStartDate);
          const isoStart = getISOWeek(userPlanStartDate);
          // When using profile's plan_start_date, it represents week 1 directly.
          // Only apply planWeekOfEarliest offset when using fallback.
          let weekOffset = 0;
          if (!usedProfileDate && planData.length > 0) {
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
  const hasExercise = (c: CompletionRecord) => hasLoggedData(c) || plansWithExercises.has(`${c.week}-${c.day}`);

  const stats = useMemo(() => {
    type Bucket = {label: string;done: number;doneWithExercise: number;skipped: number;total: number;totalWithExercise: number;distanceKm: number;sortKey: string;};
    const buckets = new Map<string, Bucket>();

    for (const c of completions) {
      // Use the workout's actual calendar date for month/year grouping
      const calendarDate = (() => {
        if (isStandaloneSession(c)) {
          return getStandaloneDate(c.day) ?? new Date(c.updated_at);
        }
        if (planStartDate) {
          return getWorkoutCalendarDate(c.week, c.day, planStartDate);
        }
        return new Date(c.updated_at);
      })();
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
      b.total++;
      if (hasExercise(c)) b.totalWithExercise++;
      if (c.done && hasExercise(c)) {
        b.done++;
        b.doneWithExercise++;
      }
      if (c.skipped) b.skipped++;
      if (c.done && hasExercise(c)) {
        let distFound = false;
        if (c.logged_distance_km) {
          b.distanceKm += Number(c.logged_distance_km);
          distFound = true;
        }
        if (!distFound && c.logged_weights && typeof c.logged_weights === "object") {
          const weights = c.logged_weights as Record<string, any>;
          for (const [wKey, value] of Object.entries(weights)) {
            if (wKey.startsWith("__cond__")) {
              try {
                const data = typeof value === "string" ? JSON.parse(value) : value;
                if (data?.dist) {
                  b.distanceKm += parseFloat(String(data.dist).replace(",", ".")) || 0;
                  distFound = true;
                }
                // Sum distances from per-interval data
                if (data?.intervals && Array.isArray(data.intervals)) {
                  for (const iv of data.intervals) {
                    if (iv.tempo && iv.time) {
                      const tm = iv.tempo.match(/^(\d+)[:\.](\d+)$/);
                      const ts = iv.tempo.match(/^(\d+)$/);
                      let mpk = 0;
                      if (tm) mpk = (parseInt(tm[1]) * 60 + parseInt(tm[2])) / 60;
                      else if (ts) mpk = parseInt(ts[1]);
                      const t = parseFloat(iv.time) || 0;
                      if (mpk > 0 && t > 0) { b.distanceKm += t / mpk; distFound = true; }
                    }
                  }
                }
              } catch {}
            }
          }
        }
        if (!distFound) {
          const details = planDetailsMap.get(`${c.week}-${c.day}`);
          if (details) {
            b.distanceKm += extractDistanceFromDetails(details);
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
  }, [completions, view, planStartCalendarWeek, scheduledPerWeek, planDetailsMap]);

  const filteredCompletions = useMemo(() => {
    if (!planStartDate) return summaryPeriod === "all" ? completions : [];
    if (summaryPeriod === "all") return completions;
    const now = new Date();
    const currentMonday = getMonday(now);
    const endOfWeek = new Date(currentMonday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    if (summaryPeriod === "week") {
      return completions.filter((c) => {
        if (isStandaloneSession(c)) {
          const d = getStandaloneDate(c.day);
          return d ? d >= currentMonday && d < endOfWeek : false;
        }
        const d = getWorkoutCalendarDate(c.week, c.day, planStartDate);
        return d >= currentMonday && d < endOfWeek;
      });
    }

    const startOfMonth = getStartOfMonth(now);
    const startOfYear = getStartOfYear(now);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1);

    return completions.filter((c) => {
      const d = isStandaloneSession(c) ? getStandaloneDate(c.day) : getWorkoutCalendarDate(c.week, c.day, planStartDate);
      if (!d) return false;
      if (summaryPeriod === "year") return d >= startOfYear && d < endOfYear;
      return d >= startOfMonth && d < endOfMonth;
    });
  }, [completions, summaryPeriod, planStartDate]);

  const totalDone = filteredCompletions.filter((c) => c.done && hasExercise(c)).length;
  const totalSkipped = filteredCompletions.filter((c) => c.skipped).length;
  const totalDistanceKm = useMemo(() => {
    let total = 0;
    for (const c of filteredCompletions) {
      if (!c.done || !hasExercise(c)) continue;
      let distFound = false;
      // 1. Include logged_distance_km (from WorkoutLogDialog)
      if (c.logged_distance_km) {
        total += Number(c.logged_distance_km);
        distFound = true;
      }
      // 2. Include distance from inline conditioning data (__cond__ in logged_weights)
      if (!distFound && c.logged_weights && typeof c.logged_weights === "object") {
        const weights = c.logged_weights as Record<string, any>;
        for (const [key, value] of Object.entries(weights)) {
          if (key.startsWith("__cond__")) {
            try {
              const data = typeof value === "string" ? JSON.parse(value) : value;
              if (data?.dist) {
                total += parseFloat(String(data.dist).replace(",", ".")) || 0;
                distFound = true;
              }
              // Sum distances from per-interval data
              if (data?.intervals && Array.isArray(data.intervals)) {
                for (const iv of data.intervals) {
                  if (iv.tempo && iv.time) {
                    const tm = iv.tempo.match(/^(\d+)[:\.](\d+)$/);
                    const ts = iv.tempo.match(/^(\d+)$/);
                    let mpk = 0;
                    if (tm) mpk = (parseInt(tm[1]) * 60 + parseInt(tm[2])) / 60;
                    else if (ts) mpk = parseInt(ts[1]);
                    const t = parseFloat(iv.time) || 0;
                    if (mpk > 0 && t > 0) { total += t / mpk; distFound = true; }
                  }
                }
              }
            } catch {}
          }
        }
      }
      // 3. Fallback: extract distance from plan details text (e.g. "6.5 km")
      if (!distFound) {
        const details = planDetailsMap.get(`${c.week}-${c.day}`);
        if (details) {
          total += extractDistanceFromDetails(details);
        }
      }
    }
    return Math.round(total * 100) / 100;
  }, [filteredCompletions, planDetailsMap]);

  const totalLiftedTons = useMemo(() => {
    let total = 0;
    for (const row of filteredCompletions) {
      if (!row.done || !hasExercise(row) || !row.logged_weights || typeof row.logged_weights !== "object") continue;
      const weights = row.logged_weights as Record<string, any>;
      for (const [key, value] of Object.entries(weights)) {
        if (key.startsWith("__setdata__")) {
          let sets: {kg?: string | number;reps?: string | number;}[] = [];
          if (typeof value === "string") {
            try {sets = JSON.parse(value);} catch {continue;}
          } else if (Array.isArray(value)) {
            sets = value;
          }
          for (const s of sets) {
            let kg = Number(s.kg) || 0;
            const reps = Number(s.reps) || 0;
            // Negative kg = assisted exercise: effective weight = bodyweight + kg (which subtracts)
            if (kg < 0 && userWeightKg) {
              kg = userWeightKg + kg; // e.g. -20 + 102 = 82
              if (kg < 0) kg = 0;
            } else if (kg < 0) {
              kg = 0; // Can't compute without body weight
            }
            total += kg * reps;
          }
        }
      }
    }
    return Math.round(total / 1000 * 10) / 10;
  }, [filteredCompletions, userWeightKg]);

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
        {(["all", "week", "month", "year"] as SummaryPeriod[]).map((p) =>
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
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <CheckCircle className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-black">{totalDone}</p>
          <p className="text-[10px] text-muted-foreground">Genomförda</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-black">{totalSkipped}</p>
          <p className="text-[10px] text-muted-foreground">Missade</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Weight className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-black">{totalLiftedTons} <span className="text-xs font-normal text-muted-foreground">ton</span></p>
          <p className="text-[10px] text-muted-foreground">Lyft totalt</p>
          {totalLiftedTons > 0 &&
          <p className="text-[9px] text-muted-foreground mt-0.5">≈ {getWeightComparison(totalLiftedTons)}</p>
          }
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Footprints className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black">{Math.round(totalDistanceKm * 10) / 10}</p>
          <p className="text-[10px] text-muted-foreground">km sprungit</p>
        </div>
        <button
          onClick={() => setShowChallengeList(true)}
          className="bg-card border border-border rounded-lg p-3 text-center hover:bg-accent transition-colors cursor-pointer"
        >
          <Swords className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black">{challengeCounts[summaryPeriod]}</p>
          <p className="text-[10px] text-muted-foreground">Utmaningar klarade</p>
        </button>
        <DailyQuoteCard />
      </div>

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
            <div key={b.label} className="bg-card border border-border rounded-lg p-3">
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