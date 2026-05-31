import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Waves, Bike, Footprints, Dumbbell, Moon, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [selected, setSelected] = useState<Session | null>(null);

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

  // Determine current week based on today
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentWeekIdx = useMemo(() => {
    const idx = weeks.findIndex(([, s]) => s.some(x => x.session_date >= todayIso));
    return idx >= 0 ? idx : 0;
  }, [weeks, todayIso]);

  const viewIdx = Math.max(0, Math.min(weeks.length - 1, currentWeekIdx + weekOffset));
  const [weekNum, weekSessions] = weeks[viewIdx] || [0, []];

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
          const isPast = s.session_date < todayIso;
          const dateLabel = new Date(s.session_date + "T00:00:00Z").toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

          return (
            <button
              key={s.id}
              onClick={() => s.discipline !== "rest" && !s.completed && setSelected(s)}
              disabled={s.discipline === "rest" || s.completed}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                s.completed ? "bg-success/10 border-success/30" :
                isToday ? "bg-primary/10 border-primary" :
                isPast && s.discipline !== "rest" ? "bg-destructive/5 border-destructive/20" :
                "bg-secondary border-border"
              } ${s.discipline === "rest" || s.completed ? "cursor-default" : "hover:bg-secondary/70"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-background ${meta.color}`}>
                  <Icon className="w-5 h-5"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground">{day} {dateLabel}</span>
                      {s.is_long_session && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold">LÅNG</span>}
                      {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold">IDAG</span>}
                    </div>
                    {s.completed && <CheckCircle2 className="w-4 h-4 text-success shrink-0"/>}
                  </div>
                  <p className="text-sm font-bold mt-0.5">{meta.label}</p>
                  {s.discipline !== "rest" && (
                    <p className="text-xs text-muted-foreground">
                      {s.duration_min} min{s.distance_km > 0 ? ` · ${s.distance_km} km` : ""} · {s.intensity}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <TriathlonSessionLogDialog
          userId={userId}
          session={selected}
          onClose={() => setSelected(null)}
          onLogged={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
};

export default TriathlonCalendar;
