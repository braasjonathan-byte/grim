import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface TrainingCalendarProps {
  userId: string;
}

interface CompletionRow {
  done: boolean;
  skipped: boolean;
  updated_at: string;
}

const MONTH_NAMES = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const DAY_HEADERS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const TrainingCalendar = ({ userId }: TrainingCalendarProps) => {
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    supabase
      .from("workout_completions")
      .select("done, skipped, updated_at")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (data) setCompletions(data);
      });
  }, [userId]);

  const dayStatusMap = useMemo(() => {
    const map = new Map<string, "done" | "skipped">();
    for (const c of completions) {
      const dateStr = new Date(c.updated_at).toISOString().split("T")[0];
      if (c.done) map.set(dateStr, "done");
      else if (c.skipped) map.set(dateStr, "skipped");
    }
    return map;
  }, [completions]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday = 0 in our layout
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
        {/* Month navigation */}
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

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[10px] text-muted-foreground font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
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

        {/* Legend */}
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
