import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dumbbell,
  Flame,
  Trophy,
  Target,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { ACHIEVEMENTS, calculateAchievementMetrics, getAchievementById } from "@/lib/achievements";
import { toLocalDateKey } from "@/lib/dateUtils";

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

/** Strips set/rep instruction noise so the card stays readable. */
const summarizeDetails = (details: string | null): string[] => {
  if (!details) return [];
  return details
    .split("\n")
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
};

interface HomeViewProps {
  userId: string;
  onNavigate: (tab: "workout" | "stats" | "social" | "nutrition" | "calc") => void;
  onOpenAchievements?: () => void;
}

const HomeView = ({ userId, onNavigate }: HomeViewProps) => {
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState<string>("");
  const [planStartDate, setPlanStartDate] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [latestAchievement, setLatestAchievement] = useState<{ id: string; unlocked_at: string } | null>(null);
  const [achievementCount, setAchievementCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("profiles").select("nickname, plan_start_date").eq("user_id", userId).maybeSingle(),
      supabase.from("workout_plans").select("week, day, details").eq("user_id", userId),
      supabase.from("workout_completions").select("week, day, done, skipped, updated_at, logged_distance_km, logged_weights").eq("user_id", userId),
      supabase.from("user_achievements" as any).select("achievement_id, unlocked_at").eq("user_id", userId).order("unlocked_at", { ascending: false }),
    ])
      .then(([{ data: profile }, { data: planData }, { data: compData }, { data: achData }]) => {
        if (cancelled) return;
        const p = profile as { nickname?: string | null; plan_start_date?: string | null } | null;
        if (p?.nickname) setNickname(p.nickname);
        if (p?.plan_start_date) setPlanStartDate(p.plan_start_date);
        setPlans((planData as PlanRow[]) ?? []);
        setCompletions((compData as CompletionRow[]) ?? []);
        const achievements = (achData as unknown as { achievement_id: string; unlocked_at: string }[]) ?? [];
        setAchievementCount(achievements.length);
        if (achievements.length > 0) {
          setLatestAchievement({ id: achievements[0].achievement_id, unlocked_at: achievements[0].unlocked_at });
        }
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

  const currentWeek = useMemo(() => {
    const weeks = plans.map((p) => p.week).filter((w) => w > 0);
    if (weeks.length === 0) return 1;
    const maxWeek = Math.max(...weeks);
    if (!planStartDate) return 1;
    const start = parseDateKey(planStartDate);
    if (!start) return 1;
    const monday = getMondayUtc(start);
    const today = parseDateKey(toLocalDateKey(now));
    if (!today) return 1;
    const week = Math.floor(daysBetween(monday, today) / 7) + 1;
    return Math.min(Math.max(week, 1), maxWeek);
  }, [plans, planStartDate, now]);

  const todaysPlans = useMemo(
    () => plans.filter((p) => p.week === currentWeek && p.day.trim().toLowerCase() === todayAbbr.toLowerCase()),
    [plans, currentWeek, todayAbbr],
  );

  const isSameDay = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  const todayDone = useMemo(
    () => completions.some((c) => c.week === currentWeek && isSameDay(c.day, todayAbbr) && c.done),
    [completions, currentWeek, todayAbbr],
  );

  const weekPlanned = useMemo(() => {
    const dayKeys = new Set(
      plans.filter((p) => p.week === currentWeek).map((p) => p.day.trim().toLowerCase()),
    );
    return dayKeys.size;
  }, [plans, currentWeek]);

  const weekCompleted = useMemo(() => {
    const dayKeys = new Set(
      completions
        .filter((c) => c.week === currentWeek && c.done)
        .map((c) => c.day.trim().toLowerCase()),
    );
    return dayKeys.size;
  }, [completions, currentWeek]);

  const goal = weekPlanned > 0 ? weekPlanned : 3;
  const progressPct = goal > 0 ? Math.min(100, Math.round((weekCompleted / goal) * 100)) : 0;

  const streak = useMemo(
    () => calculateAchievementMetrics(completions as never[]).currentStreak,
    [completions],
  );

  const achievementDef = latestAchievement ? getAchievementById(latestAchievement.id) : undefined;

  const greeting = `${greetingFor(now.getHours())}${nickname ? `, ${nickname}` : ""}!`;

  const dateLabel = now.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });

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
        <h1 className="text-2xl font-serif leading-tight">{greeting}</h1>
        <p className="text-xs text-muted-foreground capitalize flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          {dateLabel}
          {currentWeek > 0 && <span className="text-muted-foreground/70">· Vecka {currentWeek}</span>}
        </p>
      </header>

      {/* 1. Today's workout — most important */}
      <section
        className={`rounded-2xl border bg-card p-4 space-y-3 ${todayDone ? "border-success/50" : "border-border"}`}
        aria-label="Dagens pass"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${todayDone ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
              {todayDone ? <CheckCircle2 className="w-5 h-5" /> : <Dumbbell className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Dagens pass</p>
              <p className="text-sm font-semibold">
                {todaysPlans.length === 0 ? "Vilodag" : todayDone ? "Klarmarkerat" : "Redo att köra"}
              </p>
            </div>
          </div>
          {todaysPlans.length > 0 && (
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${todayDone ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
              {todayDone ? "Klart" : "Ej klart"}
            </span>
          )}
        </div>

        {todaysPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Inget pass inplanerat idag. Passa på att återhämta dig – eller lägg till ett pass.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {todaysPlans.flatMap((p) => summarizeDetails(p.details)).slice(0, 5).map((line, i) => (
              <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                <span className="line-clamp-1">{line}</span>
              </li>
            ))}
            {todaysPlans.every((p) => !p.details?.trim()) && (
              <li className="text-sm text-muted-foreground">Passet saknar övningar – lägg till dem i Träning.</li>
            )}
          </ul>
        )}

        <Button className="w-full" onClick={() => onNavigate("workout")}>
          {todaysPlans.length === 0 ? "Öppna träning" : todayDone ? "Visa passet" : "Starta passet"}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </section>

      {/* 2. Streak + weekly progress */}
      <div className="grid grid-cols-2 gap-3">
        <section className="rounded-2xl border border-border bg-card p-4 space-y-1" aria-label="Streak">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Flame className={`w-4 h-4 ${streak > 0 ? "text-warning" : ""}`} />
            <span className="text-[11px] uppercase tracking-wider font-semibold">Streak</span>
          </div>
          <p className="text-2xl font-bold leading-none">{streak}</p>
          <p className="text-[11px] text-muted-foreground">
            {streak === 0 ? "Kom igång idag" : streak === 1 ? "dag i rad" : "dagar i rad"}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-2" aria-label="Veckans framsteg">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="w-4 h-4" />
            <span className="text-[11px] uppercase tracking-wider font-semibold">Veckan</span>
          </div>
          <p className="text-2xl font-bold leading-none">
            {weekCompleted}
            <span className="text-sm font-medium text-muted-foreground">/{goal}</span>
          </p>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{progressPct}% av veckans mål</p>
        </section>
      </div>

      {/* 3. Latest achievement */}
      <button
        onClick={() => onNavigate("stats")}
        className="w-full text-left rounded-2xl border border-border bg-card p-4 flex items-center gap-3"
        aria-label="Visa achievements"
      >
        <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center text-xl shrink-0">
          {achievementDef ? achievementDef.emoji : <Trophy className="w-5 h-5 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Senaste achievement
          </p>
          {achievementDef ? (
            <>
              <p className="text-sm font-semibold truncate">{achievementDef.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {achievementCount} av {ACHIEVEMENTS.length} upplåsta
                {latestAchievement?.unlocked_at
                  ? ` · ${new Date(latestAchievement.unlocked_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}`
                  : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Ingen upplåst ännu</p>
              <p className="text-[11px] text-muted-foreground">Klarmarkera ditt första pass för att låsa upp.</p>
            </>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
};

export default HomeView;
