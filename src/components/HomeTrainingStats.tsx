import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, SlidersHorizontal, BarChart3 } from "lucide-react";
import { isCompletedWorkout } from "@/lib/completionCounting";
import { getWorkoutDistanceByCategory } from "@/lib/workoutDistance";
import { useCardioVisibility, getCardioCategory, CARDIO_CATEGORIES, type CardioCategory } from "@/lib/cardioVisibility";
import { WORKOUTS_CHANGED_EVENT } from "@/lib/workoutHistory";
import { getCompletionStatsDate } from "@/components/WorkoutStats";

type Period = "week" | "month" | "year";
const LABELS: Record<Period, string> = { week: "Vecka", month: "Månad", year: "År" };

const rangeFor = (p: Period) => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (p === "week") { const s = new Date(now); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); const e = new Date(s); e.setDate(e.getDate() + 7); return { start: s, end: e }; }
  if (p === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
};

/** Hem: träningsstatistik för vecka/månad/år. Grenar väljs direkt i kortet (delar val med Statistik). */
export default function HomeTrainingStats({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<Period>(() => (localStorage.getItem("grim_home_stats_period") as Period) || "week");
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [plans, setPlans] = useState<Map<string, string>>(new Map());
  const [planStart, setPlanStart] = useState<Date | null>(null);
  const { state: vis, set: setVis } = useCardioVisibility();

  useEffect(() => {
    const load = () => Promise.all([
      supabase.from("profiles").select("plan_start_date").eq("user_id", userId).maybeSingle(),
      supabase.from("workout_completions").select("week, day, done, skipped, updated_at, logged_distance_km, logged_tempo, logged_pulse, logged_weights").eq("user_id", userId),
      supabase.from("workout_plans").select("week, day, details").eq("user_id", userId),
    ]).then(([{ data: p }, { data: c }, { data: pl }]) => {
      const ps = (p as any)?.plan_start_date; setPlanStart(ps ? new Date(ps + "T00:00:00") : null);
      setRows(c || []);
      const m = new Map<string, string>();
      for (const r of (pl || []) as any[]) { const k = `${r.week}-${r.day}`; m.set(k, `${m.get(k) || ""} ${r.details || ""}`); }
      setPlans(m);
    });
    load();
    window.addEventListener(WORKOUTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(WORKOUTS_CHANGED_EVENT, load);
  }, [userId]);

  const stats = useMemo(() => {
    const { start, end } = rangeFor(period);
    let sessions = 0;
    const per = new Map<CardioCategory, { km: number; passes: number }>();
    for (const c of rows) {
      if (!isCompletedWorkout(c)) continue;
      const d = getCompletionStatsDate(c, planStart);
      if (!d || d < start || d >= end) continue;
      sessions++;
      const text = plans.get(`${c.week}-${c.day}`);
      const br = getWorkoutDistanceByCategory({ loggedDistanceKm: c.logged_distance_km, loggedWeights: c.logged_weights, planDetails: text });
      const cats = Object.keys(br) as CardioCategory[];
      if (cats.length === 0) { const cat = getCardioCategory(text); if (cat) { const v = per.get(cat) ?? { km: 0, passes: 0 }; per.set(cat, { km: v.km, passes: v.passes + 1 }); } continue; }
      for (const cat of cats) { const v = per.get(cat) ?? { km: 0, passes: 0 }; per.set(cat, { km: v.km + (br[cat] || 0), passes: v.passes + 1 }); }
    }
    return { sessions, per };
  }, [rows, plans, planStart, period]);

  const choose = (p: Period) => { setPeriod(p); localStorage.setItem("grim_home_stats_period", p); };
  const shown = CARDIO_CATEGORIES.filter((c) => vis[c.key] !== false);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-label="Träningsstatistik">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Din träning</p>
        <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${editing ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
          <SlidersHorizontal className="w-3 h-3" /> Grenar
        </button>
      </div>
      <div className="flex gap-1 rounded-full bg-muted/60 p-1">
        {(Object.keys(LABELS) as Period[]).map((p) => (
          <button key={p} type="button" onClick={() => choose(p)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-full ${period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{LABELS[p]}</button>
        ))}
      </div>
      {editing && (
        <div className="flex flex-wrap gap-1.5">
          {CARDIO_CATEGORIES.map((c) => {
            const on = vis[c.key] !== false;
            return (
              <button key={c.key} type="button" aria-pressed={on} onClick={() => setVis(c.key, !on)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 text-muted-foreground border-border/40"}`}>
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 p-3 text-center">
          <CheckCircle className="w-4 h-4 text-success mx-auto mb-1" />
          <p className="text-xl font-black tabular-nums">{stats.sessions}</p>
          <p className="text-[10px] text-muted-foreground">Pass</p>
        </div>
        {shown.map((c) => {
          const v = stats.per.get(c.key) ?? { km: 0, passes: 0 };
          return (
            <div key={c.key} className="rounded-xl bg-muted/40 p-3 text-center">
              <div className="text-lg leading-none mb-1">{c.icon}</div>
              <p className="text-xl font-black tabular-nums">{String(Math.round(v.km * 10) / 10).replace(".", ",")} <span className="text-xs font-normal text-muted-foreground">km</span></p>
              <p className="text-[10px] text-muted-foreground">{c.label} · {v.passes} pass</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
