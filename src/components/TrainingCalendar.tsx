import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface TrainingCalendarProps {
  userId: string;
}

interface CompletionRow {
  week: number;
  day: string;
  done: boolean;
  skipped: boolean;
}

interface PlanRow {
  week: number;
  day: string;
  details: string;
  created_at: string;
}

const MONTH_NAMES = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const DAY_HEADERS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const DAY_NAME_TO_OFFSET: Record<string, number> = {
  "Måndag": 0, "Tisdag": 1, "Onsdag": 2, "Torsdag": 3,
  "Fredag": 4, "Lördag": 5, "Söndag": 6,
};

const getISOWeekStart = (d: Date): Date => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
};

const getISOWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const TrainingCalendar = ({ userId }: TrainingCalendarProps) => {
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    Promise.all([
      supabase
        .from("workout_completions")
        .select("week, day, done, skipped")
        .eq("user_id", userId),
      supabase
        .from("workout_plans")
        .select("week, day, details, created_at")
        .eq("user_id", userId),
    ]).then(([{ data: compData }, { data: planData }]) => {
      if (compData) setCompletions(compData);
      if (planData) setPlans(planData);
    });
  }, [userId]);

  // Build a map of dateStr -> status for all plan sessions
  const dayStatusMap = useMemo(() => {
    if (plans.length === 0) return new Map<string, "done" | "skipped" | "pending">();

    // Find earliest plan to anchor week 1 to a calendar week
    const earliest = plans.reduce((min, p) => p.created_at < min.created_at ? p : min);
    const startDate = new Date(earliest.created_at);
    const startISOWeek = getISOWeekNumber(startDate);
    const startYear = startDate.getFullYear();
    const planWeekOfEarliest = earliest.week;
    const calendarWeekForPlanWeek1 = startISOWeek - (planWeekOfEarliest - 1);

    // Get the Monday of calendar week 1 of that year, then offset to the right week
    const jan4 = new Date(Date.UTC(startYear, 0, 4));
    const week1Monday = getISOWeekStart(jan4);

    const planHasExercises = new Set(
      plans.filter(p => p.details && p.details.trim() !== "").map(p => `${p.week}-${p.day}`)
    );

    const completionMap = new Map<string, CompletionRow>();
    for (const c of completions) {
      completionMap.set(`${c.week}-${c.day}`, c);
    }

    const map = new Map<string, "done" | "skipped" | "pending">();

    // Get all unique plan weeks
    const allWeeks = [...new Set(plans.map(p => p.week))];

    for (const planWeek of allWeeks) {
      const calendarWeek = calendarWeekForPlanWeek1 + (planWeek - 1);
      const weekMonday = new Date(week1Monday.getTime() + (calendarWeek - 1) * 7 * 86400000);

      const daysInWeek = plans.filter(p => p.week === planWeek);
      for (const planDay of daysInWeek) {
        const dayOffset = DAY_NAME_TO_OFFSET[planDay.day];
        if (dayOffset === undefined) continue;

        const date = new Date(weekMonday.getTime() + dayOffset * 86400000);
        const dateStr = date.toISOString().split("T")[0];

        const comp = completionMap.get(`${planDay.week}-${planDay.day}`);
        const hasExercise = planHasExercises.has(`${planDay.week}-${planDay.day}`);

        if (comp?.done && hasExercise) {
          map.set(dateStr, "done");
        } else if (comp?.skipped) {
          map.set(dateStr, "skipped");
        } else {
          map.set(dateStr, "pending");
        }
      }
    }

    return map;
  }, [completions, plans]);

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

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold tracking-tight">Träningskalender</h3>
      </div>

      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 text-muted-foreground hover:text-foreground">
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

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;
            const dateStr = date.toISOString().split("T")[0];
            const status = dayStatusMap.get(dateStr);
            const isToday = dateStr === today;

            return (
              <div
                key={dateStr}
                className={`aspect-square flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  status === "done"
                    ? "bg-success/20 text-success font-bold"
                    : status === "skipped"
                    ? "bg-destructive/20 text-destructive font-bold"
                    : "text-muted-foreground"
                } ${isToday ? "ring-1 ring-primary" : ""}`}
              >
                {date.getDate()}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-border">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-success/20 border border-success/40" />
            <span className="text-[10px] text-muted-foreground">Tränat</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-destructive/20 border border-destructive/40" />
            <span className="text-[10px] text-muted-foreground">Missat</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm border border-border" />
            <span className="text-[10px] text-muted-foreground">Vilodag</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingCalendar;
