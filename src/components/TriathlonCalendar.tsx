import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Waves, Bike, Footprints, Dumbbell, Moon, Check, ChevronLeft, ChevronRight } from "lucide-react";
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
  const currentWeekIdx = useMemo(() => {
    const idx = weeks.findIndex(([, s]) => s.some(x => x.session_date >= todayIso));
    return idx >= 0 ? idx : 0;
  }, [weeks, todayIso]);

  const viewIdx = Math.max(0, Math.min(weeks.length - 1, currentWeekIdx + weekOffset));
  const [weekNum, weekSessions] = weeks[viewIdx] || [0, []];

  const handleToggleComplete = async (s: Session) => {
    if (s.discipline === "rest") return;
    if (s.completed) {
      // Un-mark: just clear completion
      await supabase.from("triathlon_sessions")
        .update({ completed: false, completed_at: null })
        .eq("id", s.id);
      await supabase.from("triathlon_session_logs").delete().eq("session_id", s.id);
      load();
    } else {
      // Mark complete immediately, then open log dialog
      await supabase.from("triathlon_sessions")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq("id", s.id);
      setLogSession(s);
      load();
    }
  };

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

      <div className="space-y-2">
        {DAYS.map(day => {
          const s = weekSessions.find(x => x.day_of_week === day);
          if (!s) return null;
          const meta = disciplineMeta[s.discipline];
          const Icon = meta.icon;
          const isToday = s.session_date === todayIso;
          const dateLabel = new Date(s.session_date + "T00:00:00Z").toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
          const isRest = s.discipline === "rest";

          return (
            <div
              key={s.id}
              className={`bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2 ${isRest ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!isRest && (
                  <button
                    onClick={() => handleToggleComplete(s)}
                    className={`w-8 h-8 shrink-0 border-2 flex items-center justify-center transition-all ${s.completed ? "bg-success border-success text-success-foreground" : "border-primary/30 text-muted-foreground hover:border-primary"}`}
                    title="Klarmarkera"
                  >
                    {s.completed ? <Check className="w-4 h-4"/> : null}
                  </button>
                )}
                <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-background ${meta.color}`}>
                  <Icon className="w-4 h-4"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-muted-foreground">{day} {dateLabel}</span>
                    {s.is_long_session && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">LÅNG</span>}
                    {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold">IDAG</span>}
                  </div>
                  <p className="text-sm font-semibold mt-0.5 text-foreground">{meta.label}</p>
                </div>
              </div>

              {!isRest && (
                <div className="pl-10 space-y-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <p className="text-xs">⏱ <span className="font-mono font-semibold">{s.duration_min} min</span></p>
                    {s.distance_km > 0 && <p className="text-xs">📏 <span className="font-mono font-semibold">{s.distance_km} km</span></p>}
                    <p className="text-xs">⚡ <span className="font-semibold">{s.intensity}</span></p>
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
