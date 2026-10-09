import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Share2, Sparkles, Trophy, Weight, Route, Clock, CalendarDays } from "lucide-react";
import { computePeriodStats, toTons, type PeriodCompletionRow } from "@/lib/periodStats";
import { toast } from "sonner";

const MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const WEEKDAYS = ["söndagar", "måndagar", "tisdagar", "onsdagar", "torsdagar", "fredagar", "lördagar"];

const CATEGORY_LABELS: Record<string, string> = {
  "löpning": "🏃 Löpning",
  "cykling": "🚴 Cykling",
  "simning": "🏊 Simning",
  "rodd": "🚣 Rodd",
  "promenad": "🚶 Promenad",
  "trapp": "🪜 Trappa",
};

const fmt = (n: number, decimals = 1) =>
  Number(n || 0).toLocaleString("sv-SE", { maximumFractionDigits: decimals });

interface Props {
  userId: string;
  onClose: () => void;
}

/**
 * Månads- och årskrönika: en sammanfattning av allt som loggats under
 * perioden, med jämförelse mot föregående period och en delbar text.
 */
export default function PeriodRecapView({ userId, onClose }: Props) {
  const [rows, setRows] = useState<PeriodCompletionRow[]>([]);
  const [planDetails, setPlanDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"month" | "year">("month");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: completions }, { data: plans }] = await Promise.all([
        supabase
          .from("workout_completions")
          .select("week, day, done, updated_at, logged_distance_km, logged_weights")
          .eq("user_id", userId),
        supabase.from("workout_plans").select("week, day, details").eq("user_id", userId),
      ]);
      if (cancelled) return;
      setRows((completions || []) as PeriodCompletionRow[]);
      const map: Record<string, string> = {};
      for (const p of plans || []) {
        const key = `${p.week}-${p.day}`;
        map[key] = map[key] ? `${map[key]}\n${p.details}` : p.details;
      }
      setPlanDetails(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const range = useMemo(() => {
    if (scope === "year") {
      return {
        from: new Date(year, 0, 1),
        to: new Date(year, 11, 31),
        prevFrom: new Date(year - 1, 0, 1),
        prevTo: new Date(year - 1, 11, 31),
        label: `${year}`,
      };
    }
    const prev = new Date(year, month - 1, 1);
    return {
      from: new Date(year, month, 1),
      to: new Date(year, month + 1, 0),
      prevFrom: prev,
      prevTo: new Date(prev.getFullYear(), prev.getMonth() + 1, 0),
      label: `${MONTHS[month]} ${year}`,
    };
  }, [scope, year, month]);

  const stats = useMemo(
    () => computePeriodStats(rows, range.from, range.to, planDetails),
    [rows, range, planDetails],
  );
  const prevStats = useMemo(
    () => computePeriodStats(rows, range.prevFrom, range.prevTo, planDetails),
    [rows, range, planDetails],
  );

  const step = (dir: -1 | 1) => {
    if (scope === "year") { setYear((y) => y + dir); return; }
    const next = new Date(year, month + dir, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const diff = (current: number, previous: number) => {
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };

  const shareText = () => {
    const lines = [
      `Min ${scope === "year" ? "årskrönika" : "månad"} i Grim – ${range.label}`,
      `${stats.passCount} pass`,
      stats.volumeKg > 0 ? `${fmt(toTons(stats.volumeKg), 1)} ton lyft` : "",
      stats.distanceKm > 0 ? `${fmt(stats.distanceKm, 1)} km` : "",
      stats.bestStreak > 1 ? `Bästa svit: ${stats.bestStreak} dagar i rad` : "",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const share = async () => {
    const text = shareText();
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Sammanfattningen kopierad");
      }
    } catch {
      /* användaren avbröt */
    }
  };

  const passDiff = diff(stats.passCount, prevStats.passCount);
  const tonsDiff = diff(stats.volumeKg, prevStats.volumeKg);
  const kmDiff = diff(stats.distanceKm, prevStats.distanceKm);

  const metric = (
    icon: React.ReactNode,
    label: string,
    value: string,
    change: number | null,
  ) => (
    <div className="bg-card border border-border rounded-2xl p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {change !== null && (
        <div className={`text-[11px] font-semibold ${change >= 0 ? "text-primary" : "text-muted-foreground"}`}>
          {change >= 0 ? "+" : ""}{change}% mot föregående
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in pb-6">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-base flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" /> Veckorapport
        </h2>
        <button
          onClick={share}
          className="ml-auto flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
        >
          <Share2 className="w-3.5 h-3.5" /> Dela
        </button>
      </div>

      <div className="relative inline-flex rounded-full bg-muted/40 p-1">
        {(["month", "year"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`relative z-10 w-24 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
              scope === s ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            {s === "month" ? "Månad" : "År"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-2 py-2">
        <button onClick={() => step(-1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold">{range.label}</span>
        <button onClick={() => step(1)} className="p-2 text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Laddar…</p>
      ) : stats.passCount === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-1">
          <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">Inga pass den här perioden</p>
          <p className="text-xs text-muted-foreground">Bläddra till en annan period eller logga ett pass.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {metric(<Trophy className="w-3.5 h-3.5 text-primary" />, "Pass", String(stats.passCount), passDiff)}
            {metric(<Weight className="w-3.5 h-3.5 text-primary" />, "Lyft totalt", `${fmt(toTons(stats.volumeKg), 1)} ton`, tonsDiff)}
            {metric(<Route className="w-3.5 h-3.5 text-primary" />, "Distans", `${fmt(stats.distanceKm, 1)} km`, kmDiff)}
            {metric(<Clock className="w-3.5 h-3.5 text-primary" />, "Konditionstid", `${Math.round(stats.minutes)} min`, null)}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-1.5"><Flame className="w-4 h-4 text-warning" /> Höjdpunkter</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• {stats.activeDays} träningsdagar och {stats.sets} set totalt.</li>
              {stats.bestStreak > 1 && <li>• Längsta svit i perioden: {stats.bestStreak} dagar i rad.</li>}
              {stats.favoriteWeekday !== null && <li>• Du tränar helst på {WEEKDAYS[stats.favoriteWeekday]}.</li>}
              {stats.topExercises[0] && (
                <li>• Mest tränade övning: {stats.topExercises[0].name} ({stats.topExercises[0].count} pass).</li>
              )}
            </ul>
          </div>

          {Object.keys(stats.byCategory).length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-bold">Distans per gren</h3>
              <div className="space-y-1.5">
                {Object.entries(stats.byCategory)
                  .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                  .map(([cat, km]) => (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                      <span className="font-semibold tabular-nums">{fmt(km ?? 0, 1)} km</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {stats.topExercises.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-bold">Topplista övningar</h3>
              <div className="space-y-1.5">
                {stats.topExercises.map((ex, i) => (
                  <div key={ex.name} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2">{i + 1}. {ex.name}</span>
                    <span className="font-semibold tabular-nums">{ex.count} pass</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
