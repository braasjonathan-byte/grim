import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Waves, Bike, Footprints, Dumbbell, Moon, Check, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import TriathlonSessionLogDialog from "./TriathlonSessionLogDialog";

interface Props {
  userId: string;
  planId: string;
}

interface Session {
  id: string;
  session_date: string;
  week: number;
  day_of_week: string;
  discipline: "swim" | "bike" | "run" | "strength" | "rest";
  duration_min: number;
  distance_km: number;
  intensity: string;
  description: string;
  is_long_session: boolean;
  completed: boolean;
}

const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const DAY_FULL: Record<string, string> = {
  "Mån": "Måndag", "Tis": "Tisdag", "Ons": "Onsdag", "Tor": "Torsdag",
  "Fre": "Fredag", "Lör": "Lördag", "Sön": "Söndag"
};

const disciplineMeta: Record<Session["discipline"], { icon: any; label: string; color: string }> = {
  swim: { icon: Waves, label: "Simning", color: "text-sky-500" },
  bike: { icon: Bike, label: "Cykling", color: "text-emerald-500" },
  run: { icon: Footprints, label: "Löpning", color: "text-orange-500" },
  strength: { icon: Dumbbell, label: "Styrka", color: "text-purple-500" },
  rest: { icon: Moon, label: "Vila", color: "text-muted-foreground" },
};

const TriathlonCalendar = ({ userId, planId }: Props) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [logSession, setLogSession] = useState<Session | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("triathlon_sessions")
      .select("*")
      .eq("plan_id", planId)
      .order("session_date", { ascending: true });
    if (data) setSessions(data as Session[]);
  };

  useEffect(() => { load(); }, [planId]);

  const weeks = useMemo(() => {
    const map = new Map<number, Session[]>();
    for (const s of sessions) {
      if (!map.has(s.week)) map.set(s.week, []);
      map.get(s.week)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [sessions]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayName = DAYS[(new Date().getDay() + 6) % 7]; // Mon-Sun index
  const currentWeekIdx = useMemo(() => {
    const idx = weeks.findIndex(([, s]) => s.some(x => x.session_date >= todayIso));
    return idx >= 0 ? idx : 0;
  }, [weeks, todayIso]);

  const viewIdx = Math.max(0, Math.min(weeks.length - 1, currentWeekIdx + weekOffset));
  const [weekNum, weekSessions] = weeks[viewIdx] || [0, []];

  // Default active day = today if exists in this week, else first session day
  useEffect(() => {
    if (!weekSessions.length) return;
    if (activeDay && weekSessions.some(s => s.day_of_week === activeDay)) return;
    const today = weekSessions.find(s => s.day_of_week === todayName);
    setActiveDay(today ? todayName : weekSessions[0].day_of_week);
  }, [weekSessions, todayName]);

  const handleToggleComplete = async (s: Session) => {
    if (s.discipline === "rest") return;
    if (s.completed) {
      await supabase.from("triathlon_sessions")
        .update({ completed: false, completed_at: null })
        .eq("id", s.id);
      await supabase.from("triathlon_session_logs").delete().eq("session_id", s.id);
      load();
    } else {
      await supabase.from("triathlon_sessions")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq("id", s.id);
      setLogSession(s);
      load();
    }
  };

  const activeSession = weekSessions.find(s => s.day_of_week === activeDay) || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(o => o - 1)} disabled={viewIdx === 0}
          className="p-2 text-muted-foreground disabled:opacity-30">
          <ChevronLeft className="w-5 h-5"/>
        </button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Vecka</p>
          <p className="font-bold">{weekNum} av {weeks.length}</p>
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} disabled={viewIdx >= weeks.length - 1}
          className="p-2 text-muted-foreground disabled:opacity-30">
          <ChevronRight className="w-5 h-5"/>
        </button>
      </div>

      {/* Day tabs — same style as upper/lower plan */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
        {DAYS.map(dayName => {
          const s = weekSessions.find(x => x.day_of_week === dayName);
          const isRest = !s || s.discipline === "rest";
          const isToday = dayName === todayName && viewIdx === currentWeekIdx;
          const isActive = dayName === activeDay;
          const done = s?.completed;

          if (isRest) {
            return (
              <button
                key={dayName}
                disabled
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
                  isToday
                    ? "bg-warning/10 text-warning/80 border border-warning/30"
                    : "bg-secondary/40 text-muted-foreground/70"
                } cursor-not-allowed`}
                title="Vilodag"
              >
                {dayName}
              </button>
            );
          }
          return (
            <button
              key={dayName}
              onClick={() => setActiveDay(dayName)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? done
                    ? "bg-success text-success-foreground"
                    : isToday
                    ? "bg-warning/10 text-warning border border-warning/30"
                    : "bg-primary text-primary-foreground"
                  : done
                  ? "bg-success/20 text-success"
                  : isToday
                  ? "bg-warning/20 text-warning"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {dayName}
            </button>
          );
        })}
      </div>

      {activeSession && (() => {
        const s = activeSession;
        const meta = disciplineMeta[s.discipline];
        const Icon = meta.icon;
        const isToday = s.session_date === todayIso;
        const isRest = s.discipline === "rest";
        const isDone = s.completed;
        const dateLabel = new Date(s.session_date + "T00:00:00Z").toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

        return (
          <div
            className={`rounded-lg border bg-card transition-colors ${isDone ? "opacity-80" : ""} ${isRest ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleComplete(s)}
                  disabled={isRest}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone ? "bg-success border-success" : "border-muted-foreground/30 hover:border-primary"
                  } ${isRest ? "opacity-40 cursor-not-allowed" : ""}`}
                  title="Genomfört"
                >
                  {isDone && <Check className="w-4 h-4 text-success-foreground" />}
                </button>
              </div>
              <div className={`flex-shrink-0 ${meta.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">
                  {DAY_FULL[s.day_of_week] || s.day_of_week}
                </span>
                <span className={`font-semibold text-sm block break-words ${isDone ? "line-through text-muted-foreground" : ""}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {dateLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {s.is_long_session && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">LÅNG</span>
                )}
                {isToday && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold">IDAG</span>
                )}
              </div>
            </div>

            {!isRest && (
              <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <p className="text-xs">⏱ <span className="font-mono font-semibold">{s.duration_min} min</span></p>
                  {s.distance_km > 0 && (
                    <p className="text-xs">📏 <span className="font-mono font-semibold">{s.distance_km} km</span></p>
                  )}
                  <p className="text-xs">⚡ <span className="font-semibold">{s.intensity}</span></p>
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{s.description}</p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {logSession && (
        <TriathlonSessionLogDialog
          userId={userId}
          session={logSession}
          onClose={() => { setLogSession(null); load(); }}
          onLogged={() => { setLogSession(null); load(); }}
        />
      )}
    </div>
  );
};

export default TriathlonCalendar;
