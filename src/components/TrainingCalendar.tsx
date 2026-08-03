import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface TrainingCalendarProps {
  userId: string;
}

const MONTH_NAMES = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const DAY_HEADERS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const DAY_NAME_TO_OFFSET: Record<string, number> = {
  "Mån": 0, "Tis": 1, "Ons": 2, "Tor": 3, "Tors": 3,
  "Fre": 4, "Lör": 5, "Sön": 6,
  "Måndag": 0, "Tisdag": 1, "Onsdag": 2, "Torsdag": 3,
  "Fredag": 4, "Lördag": 5, "Söndag": 6,
};

const parseDateKey = (value: string | null | undefined): Date | null => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
};

const getISOWeekStart = (d: Date): Date => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
};

const getISOWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const timestampToDateKey = (value: string | null | undefined): string | null => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

/** Resolve a completion to a calendar date string (YYYY-MM-DD) */
const resolveCompletionDate = (
  week: number,
  day: string,
  updatedAt: string | null,
  planStartDate: string | null,
): string | null => {
  // Standalone sessions: day field is a date
  if (week === 0 && /^\d{4}-\d{2}-\d{2}/.test(day)) {
    return day.substring(0, 10);
  }

  // Plan-based: calculate from plan_start_date
  if (planStartDate && week > 0) {
    const start = parseDateKey(planStartDate);
    if (!start) return updatedAt ? updatedAt.substring(0, 10) : null;
    const startMonday = getISOWeekStart(start);
    const dayOffset = DAY_NAME_TO_OFFSET[day];
    if (dayOffset === undefined) return updatedAt ? updatedAt.substring(0, 10) : null;
    const date = new Date(startMonday.getTime() + (week - 1) * 7 * 86400000 + dayOffset * 86400000);
    return date.toISOString().split("T")[0];
  }

  // Fallback: use updated_at
  if (updatedAt) return updatedAt.substring(0, 10);
  return null;
};

interface DayStats {
  sets: number;
  volume: number;
}

/** Summarise completed sets + total volume (kg) from a logged_weights object */
const summarizeLoggedWeights = (lw: any): DayStats => {
  const stats: DayStats = { sets: 0, volume: 0 };
  if (!lw || typeof lw !== "object") return stats;
  let markerSets = 0;
  for (const [key, val] of Object.entries(lw)) {
    if (key.startsWith("__sets__") && typeof val === "string") {
      markerSets += val.split("").filter((c) => c === "1").length;
    }
  }
  const hadMarkers = markerSets > 0;
  stats.sets = markerSets;
  for (const [key, val] of Object.entries(lw)) {
    if (!key.startsWith("__setdata__")) continue;
    const exName = key.replace("__setdata__", "");
    const setsStr = (lw[`__sets__${exName}`] as string) || "";
    try {
      const data = typeof val === "string" ? JSON.parse(val) : val;
      if (!Array.isArray(data)) continue;
      const done = setsStr
        ? data.filter((_: any, i: number) => setsStr[i] === "1")
        : data.filter((s: any) => (parseFloat(s?.kg) || 0) > 0 || (parseInt(s?.reps) || 0) > 0);
      if (!hadMarkers) stats.sets += done.length;
      for (const s of done) {
        stats.volume += (parseFloat(s?.kg) || 0) * (parseInt(s?.reps) || 0);
      }
    } catch {
      // ignore malformed set data
    }
  }
  return stats;
};

const formatVolume = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k kg` : `${Math.round(v)} kg`);

const TrainingCalendar = ({ userId }: TrainingCalendarProps) => {
  const [doneDates, setDoneDates] = useState<Set<string>>(new Set());
  const [skippedDates, setSkippedDates] = useState<Set<string>>(new Set());
  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());
  const [dayStats, setDayStats] = useState<Record<string, DayStats>>({});
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      const [
        { data: completions },
        { data: plans },
        { data: profile },
        { data: archives },
      ] = await Promise.all([
        supabase
          .from("workout_completions")
          .select("week, day, done, skipped, updated_at, logged_weights")
          .eq("user_id", userId),
        supabase
          .from("workout_plans")
          .select("week, day, details, created_at")
          .eq("user_id", userId),
        supabase
          .from("profiles")
          .select("plan_start_date")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("archived_plans")
          .select("plan_start_date, completion_data")
          .eq("user_id", userId),
      ]);

      const planStartDate = profile?.plan_start_date || null;
      const done = new Set<string>();
      const skipped = new Set<string>();
      const pending = new Set<string>();
      const stats: Record<string, DayStats> = {};
      const addStats = (dateStr: string, lw: any) => {
        const s = summarizeLoggedWeights(lw);
        if (s.sets === 0 && s.volume === 0) return;
        const prev = stats[dateStr] || { sets: 0, volume: 0 };
        stats[dateStr] = { sets: prev.sets + s.sets, volume: prev.volume + s.volume };
      };

      // --- Active plan completions ---
      const planHasExercises = new Set(
        (plans || []).filter(p => p.details && p.details.trim() !== "").map(p => `${p.week}-${p.day}`)
      );

      // First: map all plan days as pending
      if (plans && plans.length > 0 && planStartDate) {
        for (const p of plans) {
          if (!p.details || p.details.trim() === "") continue;
          const dateStr = resolveCompletionDate(p.week, p.day, null, planStartDate);
          if (dateStr) pending.add(dateStr);
        }
      }

      // Then: overlay completions
      if (completions) {
        for (const c of completions) {
          const dateStr = resolveCompletionDate(c.week, c.day, c.updated_at, planStartDate) ?? timestampToDateKey(c.updated_at);
          if (!dateStr) continue;
          const hasExercise = planHasExercises.has(`${c.week}-${c.day}`);

          if (c.done && (hasExercise || c.week === 0)) {
            done.add(dateStr);
            pending.delete(dateStr);
            addStats(dateStr, (c as any).logged_weights);
          } else if (c.skipped) {
            skipped.add(dateStr);
            pending.delete(dateStr);
          }
        }
      }

      // --- Archived plan completions ---
      if (archives) {
        for (const archive of archives) {
          const archiveStart = archive.plan_start_date || null;
          const compData = archive.completion_data as any[];
          if (!compData || !Array.isArray(compData)) continue;

          for (const c of compData) {
            if (!c.done) continue;
            const dateStr = resolveCompletionDate(
              c.week || 0,
              c.day || "",
              c.updated_at || null,
              archiveStart,
            ) ?? timestampToDateKey(c.updated_at || null);
            if (dateStr) {
              done.add(dateStr);
              addStats(dateStr, c.logged_weights ?? c.loggedWeights);
            }
          }
        }
      }

      setDoneDates(done);
      setSkippedDates(skipped);
      setPendingDates(pending);
      setDayStats(stats);
    };

    load();
  }, [userId]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [month, year]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold tracking-tight">Träningskalender</h3>
      </div>

      <div className="rounded-2xl p-4 bg-card shadow-soft border border-border/40">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-8 h-8 icon-round bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 icon-round bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const isDone = doneDates.has(dateStr);
            const isSkipped = skippedDates.has(dateStr);
            const isPending = pendingDates.has(dateStr);
            const isToday = dateStr === today;

            const stats = isDone ? dayStats[dateStr] : undefined;
            const hasStats = !!stats && (stats.sets > 0 || stats.volume > 0);
            const isActive = activeDate === dateStr;

            const cell = (
              <div
                className={`w-full aspect-square icon-round text-xs transition-colors relative ${
                  isToday
                    ? "bg-primary text-primary-foreground font-bold shadow-soft"
                    : isDone
                    ? "bg-success/20 text-success font-bold"
                    : isSkipped
                    ? "bg-destructive/15 text-destructive font-bold"
                    : isPending
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground/70"
                } ${hasStats ? "group-hover:bg-success/35" : ""}`}
              >
                {hasStats ? (
                  <>
                    <span className={`${isActive ? "hidden" : "group-hover:hidden"}`}>{date.getDate()}</span>
                    <span className={`text-[10px] font-bold leading-none ${isActive ? "" : "hidden group-hover:inline"}`}>
                      {stats!.sets > 0 ? `${stats!.sets} set` : formatVolume(stats!.volume)}
                    </span>
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-success" />
                  </>
                ) : (
                  date.getDate()
                )}
              </div>
            );

            if (!hasStats) {
              return (
                <div key={dateStr} className="aspect-square flex items-center justify-center">
                  {cell}
                </div>
              );
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setActiveDate(isActive ? null : dateStr)}
                aria-label={`${date.getDate()} ${MONTH_NAMES[month]}: ${stats!.sets} set${stats!.volume > 0 ? `, ${formatVolume(stats!.volume)}` : ""}`}
                className="group relative aspect-square flex items-center justify-center"
              >
                {cell}
                <span
                  className={`pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-20 whitespace-nowrap rounded-lg bg-foreground text-background text-[10px] font-semibold px-2 py-1 shadow-soft transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {stats!.sets > 0 ? `${stats!.sets} set` : ""}
                  {stats!.sets > 0 && stats!.volume > 0 ? " · " : ""}
                  {stats!.volume > 0 ? formatVolume(stats!.volume) : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-border/40">
          {[
            ["bg-success/25", "Tränat"],
            ["bg-primary", "Idag"],
            ["bg-primary/15", "Planerat"],
            ["bg-destructive/20", "Missat"],
            ["bg-muted", "Vilodag"],
          ].map(([cls, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default TrainingCalendar;
