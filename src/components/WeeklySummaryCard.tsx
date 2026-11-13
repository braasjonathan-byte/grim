import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarRange, ChevronRight, Dumbbell, Flame, Scale, Trophy, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { isCompletedWorkout } from "@/lib/completionCounting";
import { getCompletionStatsDate } from "@/components/WorkoutStats";
import { WORKOUTS_CHANGED_EVENT } from "@/lib/workoutHistory";
import { WEIGHT_CHANGED_EVENT } from "@/lib/bodyWeight";
import { isPlausibleMealLog } from "@/lib/inputValidation";
import { toLocalDateKey } from "@/lib/dateUtils";
import { computeWeeklySummary, mondayOf, pctChange, type DatedCompletion, type MealRow, type WeightRow } from "@/lib/weeklySummary";

const fmt = (n: number, decimals = 0) => n.toLocaleString("sv-SE", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
const fmtTons = (kg: number) => (kg >= 1000 ? `${fmt(kg / 1000, 1)} t` : `${fmt(kg)} kg`);
const fmtRange = (start: string, end: string) => {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return `${sd}/${sm} – ${ed}/${em}`;
};

function Delta({ value, unit = "%", invert = false, decimals = 0 }: { value: number | null; unit?: string; invert?: boolean; decimals?: number }) {
  if (value === null || !isFinite(value)) return <span className="text-[10px] text-muted-foreground">ingen jämförelse</span>;
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><Minus className="w-3 h-3" />samma som förra</span>;
  const up = rounded > 0;
  const good = invert ? !up : up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${good ? "text-success" : "text-muted-foreground"}`}>
      <Icon className="w-3 h-3" />{up ? "+" : "−"}{fmt(Math.abs(rounded), decimals)}{unit} mot förra
    </span>
  );
}

/** Hem: den här veckan jämfört med förra – pass, volym, nya rekord (e1RM), kost och vikt. */
export default function WeeklySummaryCard({ userId, onStartWorkout }: { userId: string; onStartWorkout?: () => void }) {
  const [completions, setCompletions] = useState<DatedCompletion[]>([]);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const fromKey = toLocalDateKey(new Date(mondayOf(new Date()).getTime() - 7 * 86400000));
      Promise.all([
        supabase.from("profiles").select("plan_start_date").eq("user_id", userId).maybeSingle(),
        supabase.from("workout_completions").select("week, day, done, skipped, updated_at, logged_distance_km, logged_weights").eq("user_id", userId),
        supabase.from("meal_logs").select("log_date, amount, unit, kcal, protein_g, fat_g, carbs_g").eq("user_id", userId).gte("log_date", fromKey),
        supabase.from("body_weight_logs").select("log_date, weight_kg").eq("user_id", userId).gte("log_date", fromKey),
      ]).then(([{ data: p }, { data: c }, { data: m }, { data: w }]) => {
        if (cancelled) return;
        const ps = (p as any)?.plan_start_date;
        const planStart = ps ? new Date(ps + "T00:00:00") : null;
        const dated: DatedCompletion[] = [];
        for (const row of (c || []) as any[]) {
          if (!isCompletedWorkout(row)) continue;
          const date = getCompletionStatsDate(row, planStart);
          if (date) dated.push({ date, logged_weights: row.logged_weights });
        }
        setCompletions(dated);
        setMeals(((m || []) as any[]).filter(isPlausibleMealLog));
        setWeights((w || []) as WeightRow[]);
        setLoaded(true);
      });
    };
    load();
    window.addEventListener(WORKOUTS_CHANGED_EVENT, load);
    window.addEventListener(WEIGHT_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(WORKOUTS_CHANGED_EVENT, load);
      window.removeEventListener(WEIGHT_CHANGED_EVENT, load);
    };
  }, [userId]);

  const s = useMemo(() => computeWeeklySummary(completions, meals, weights), [completions, meals, weights]);
  const openReports = () => window.dispatchEvent(new CustomEvent("grim:open-weekly-report", { detail: {} }));
  const { current: cur, previous: prev } = s;
  const weightDelta = cur.avgWeightKg !== null && prev.avgWeightKg !== null ? cur.avgWeightKg - prev.avgWeightKg : null;
  const kcalDelta = cur.avgKcal !== null && prev.avgKcal !== null ? cur.avgKcal - prev.avgKcal : null;
  // Ingen data alls de senaste två veckorna: visa en kort uppmaning i stället för en vägg av nollor.
  const isEmpty = loaded && cur.sessions === 0 && prev.sessions === 0 && cur.volumeKg === 0 && prev.volumeKg === 0
    && cur.avgKcal === null && cur.avgWeightKg === null && cur.prs.length === 0;

  if (isEmpty) {
    return (
      <section className="card-soft p-4 space-y-3" aria-label="Veckan i siffror">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Veckan i siffror</p>
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{fmtRange(s.weekStart, s.weekEnd)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Din vecka börjar här</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Logga ditt första pass, en måltid eller din vikt så räknar vi ihop veckan åt dig.</p>
          </div>
        </div>
        {onStartWorkout && (
          <button type="button" onClick={onStartWorkout} className="w-full pill-btn-primary py-2.5 text-sm">
            Starta ett pass
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="card-soft p-4 space-y-3" aria-label="Veckan i siffror">
      <div className="flex items-center gap-2">
        <CalendarRange className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Veckan i siffror</p>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{fmtRange(s.weekStart, s.weekEnd)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="tile-soft p-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Dumbbell className="w-3 h-3" />Pass</p>
          <p className="text-xl font-black tabular-nums">{loaded ? cur.sessions : "–"}</p>
          <Delta value={loaded && prev.sessions > 0 ? cur.sessions - prev.sessions : null} unit=" st" />
        </div>
        <div className="tile-soft p-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Dumbbell className="w-3 h-3" />Volym</p>
          <p className="text-xl font-black tabular-nums">{loaded ? fmtTons(cur.volumeKg) : "–"}</p>
          <Delta value={loaded ? pctChange(cur.volumeKg, prev.volumeKg) : null} />
        </div>
        <div className="tile-soft p-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3" />Kost, snitt/dag</p>
          <p className="text-xl font-black tabular-nums">{cur.avgKcal !== null ? <>{fmt(cur.avgKcal)} <span className="text-xs font-normal text-muted-foreground">kcal</span></> : "–"}</p>
          {cur.avgKcal !== null
            ? <Delta value={kcalDelta} unit=" kcal" />
            : <span className="text-[10px] text-muted-foreground">logga mat för att se trenden</span>}
        </div>
        <div className="tile-soft p-3">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Scale className="w-3 h-3" />Vikt, snitt</p>
          <p className="text-xl font-black tabular-nums">{cur.avgWeightKg !== null ? <>{fmt(cur.avgWeightKg, 1)} <span className="text-xs font-normal text-muted-foreground">kg</span></> : "–"}</p>
          {cur.avgWeightKg !== null
            ? <Delta value={weightDelta} unit=" kg" decimals={1} invert />
            : <span className="text-[10px] text-muted-foreground">väg dig för att se trenden</span>}
        </div>
      </div>

      <div className="tile-soft p-3 space-y-1.5">
        <p className="text-[11px] font-semibold flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5 text-primary" />
          {cur.prs.length > 0 ? `${cur.prs.length} nya rekord (e1RM)` : "Inga nya rekord än den här veckan"}
          {prev.prs.length > 0 && <span className="ml-auto font-normal text-muted-foreground">förra veckan: {prev.prs.length}</span>}
        </p>
        {cur.prs.slice(0, 3).map((pr) => (
          <div key={pr.exercise} className="flex items-baseline gap-2 text-xs">
            <span className="truncate flex-1 min-w-0">{pr.exercise}</span>
            <span className="tabular-nums text-muted-foreground">{fmt(pr.kg, 1)} kg × {pr.reps}</span>
            <span className="tabular-nums font-semibold text-success">+{fmt(pr.e1rm - pr.previous, 1)} kg</span>
          </div>
        ))}
        {cur.prs.length > 3 && <p className="text-[10px] text-muted-foreground">+{cur.prs.length - 3} till</p>}
      </div>

      <button type="button" onClick={openReports} className="w-full flex items-center justify-between text-xs font-semibold text-primary py-1">
        Se alla veckorapporter <ChevronRight className="w-4 h-4" />
      </button>
    </section>
  );
}
