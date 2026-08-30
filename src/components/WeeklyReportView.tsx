import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BarChart3, CheckCircle, Footprints, TrendingDown, TrendingUp, Weight, Star, Calendar } from "lucide-react";
import { getWorkoutDistanceByCategory, type CardioCategoryKey } from "@/lib/workoutDistance";

const CATEGORY_LABELS: Record<CardioCategoryKey, string> = {
  "löpning": "🏃 Löpning",
  "cykling": "🚴 Cykling",
  "simning": "🏊 Simning",
  "rodd": "🚣 Rodd",
  "promenad": "🚶 Promenad",
  "trapp": "🪜 Trappa/Crosstrainer",
};


interface WeeklyReportSession {
  date?: string;
  week?: number;
  day?: string;
  name?: string;
  set_count?: number;
  tons?: number;
  distance_km?: number;
  tempo?: string | null;
  exercises?: string[];
}

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  pass_count: number;
  total_tons: number;
  total_distance_km: number;
  pr_count: number;
  prev_tons: number;
  prev_pass_count: number;
  prev_distance_km: number;
  summary: string;
  sessions: WeeklyReportSession[];
  created_at: string;
}

interface WeeklyReportViewProps {
  userId: string;
  reportId?: string | null;
  onClose: () => void;
}

const WEEKDAYS = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];

const fmtNum = (n: number, decimals = 1) =>
  Number(n || 0).toLocaleString("sv-SE", { maximumFractionDigits: decimals });

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

const fmtRange = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  return `${s.getDate()}/${s.getMonth() + 1} – ${e.getDate()}/${e.getMonth() + 1}`;
};

const pctChange = (current: number, previous: number): number | null => {
  if (!previous || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};

export default function WeeklyReportView({ userId, reportId, onClose }: WeeklyReportViewProps) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(reportId ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("user_id", userId)
        .order("week_start", { ascending: false })
        .limit(12);
      if (cancelled) return;
      const rows = (data || []).map((r: any) => ({
        ...r,
        sessions: Array.isArray(r.sessions) ? (r.sessions as WeeklyReportSession[]) : [],
      })) as WeeklyReport[];
      setReports(rows);
      setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const report = useMemo(
    () => reports.find((r) => r.id === selectedId) || null,
    [reports, selectedId],
  );

  // Distansen i rapport-raden räknar bara logged_distance_km, vilket missar
  // konditionspass som loggats via __cond__/intervaller. Räkna om per gren här.
  const [byCategory, setByCategory] = useState<Partial<Record<CardioCategoryKey, number>>>({});
  const [sessionKm, setSessionKm] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!report) {
      setByCategory({});
      setSessionKm({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: completions } = await supabase
        .from("workout_completions")
        .select("week, day, logged_distance_km, logged_weights")
        .eq("user_id", userId)
        .eq("done", true)
        .gte("updated_at", `${report.week_start}T00:00:00Z`)
        .lte("updated_at", `${report.week_end}T23:59:59Z`);
      if (cancelled) return;
      const rows = completions || [];
      if (rows.length === 0) {
        setByCategory({});
        setSessionKm({});
        return;
      }

      const weeks = [...new Set(rows.map((r: any) => r.week))];
      const { data: plans } = await supabase
        .from("workout_plans")
        .select("week, day, session_name, details, tempo")
        .eq("user_id", userId)
        .in("week", weeks);
      if (cancelled) return;

      const planMap = new Map<string, string>();
      (plans || []).forEach((p: any) => {
        planMap.set(
          `${p.week}|${p.day}`,
          JSON.stringify({ sessionName: p.session_name, details: p.details, tempo: p.tempo }),
        );
      });

      const totals: Partial<Record<CardioCategoryKey, number>> = {};
      const perSession: Record<string, number> = {};
      for (const c of rows as any[]) {
        const cats = getWorkoutDistanceByCategory({
          loggedDistanceKm: c.logged_distance_km,
          loggedWeights: c.logged_weights,
          planDetails: planMap.get(`${c.week}|${c.day}`) ?? null,
        });
        let sum = 0;
        for (const [key, km] of Object.entries(cats)) {
          if (!(km > 0)) continue;
          totals[key as CardioCategoryKey] = (totals[key as CardioCategoryKey] ?? 0) + km;
          sum += km;
        }
        if (sum > 0) {
          const k = `${c.week}|${c.day}`;
          perSession[k] = (perSession[k] ?? 0) + sum;
        }
      }
      setByCategory(totals);
      setSessionKm(perSession);
    })();
    return () => { cancelled = true; };
  }, [userId, report?.id, report?.week_start, report?.week_end]);

  const categoryRows = useMemo(
    () =>
      (Object.entries(byCategory) as [CardioCategoryKey, number][])
        .filter(([, km]) => km > 0.05)
        .sort((a, b) => b[1] - a[1]),
    [byCategory],
  );

  const computedDistance = useMemo(
    () => categoryRows.reduce((sum, [, km]) => sum + km, 0),
    [categoryRows],
  );

  const totalDistance = computedDistance > 0 ? computedDistance : report?.total_distance_km ?? 0;

  const tonsChange = report ? pctChange(report.total_tons, report.prev_tons) : null;

  const distChange = report ? pctChange(totalDistance, report.prev_distance_km) : null;
  const passDiff = report ? report.pass_count - report.prev_pass_count : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-muted/60 text-foreground active:scale-95 transition-transform"
          aria-label="Tillbaka"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-black font-serif text-foreground">📊 Veckorapport</h2>
      </div>

      {loading && <p className="text-sm text-muted-foreground px-1">Laddar veckorapport…</p>}

      {!loading && reports.length === 0 && (
        <div className="rounded-2xl bg-card shadow-soft p-6 text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ingen veckorapport än. Den skapas automatiskt varje söndag när du har tränat under veckan.
          </p>
        </div>
      )}

      {reports.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                r.id === selectedId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {fmtRange(r.week_start, r.week_end)}
            </button>
          ))}
        </div>
      )}

      {report && (
        <>
          <div className="rounded-2xl bg-card shadow-soft p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {fmtRange(report.week_start, report.week_end)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <CheckCircle className="w-3.5 h-3.5" /> Pass
                </div>
                <p className="text-2xl font-black text-foreground">{report.pass_count}</p>
                {passDiff !== 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {passDiff > 0 ? `+${passDiff}` : passDiff} mot förra veckan
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Weight className="w-3.5 h-3.5" /> Volym
                </div>
                <p className="text-2xl font-black text-foreground">{fmtNum(report.total_tons)} <span className="text-sm font-bold">ton</span></p>
                {tonsChange !== null && (
                  <p className={`text-[11px] font-semibold flex items-center gap-1 ${tonsChange >= 0 ? "text-success" : "text-destructive"}`}>
                    {tonsChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {tonsChange >= 0 ? "+" : ""}{tonsChange}% volym mot förra veckan
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Footprints className="w-3.5 h-3.5" /> Distans
                </div>
                <p className="text-2xl font-black text-foreground">{fmtNum(totalDistance)} <span className="text-sm font-bold">km</span></p>
                {distChange !== null && (
                  <p className={`text-[11px] font-semibold flex items-center gap-1 ${distChange >= 0 ? "text-success" : "text-destructive"}`}>
                    {distChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {distChange >= 0 ? "+" : ""}{distChange}% mot förra veckan
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <Star className="w-3.5 h-3.5" /> Rekord
                </div>
                <p className="text-2xl font-black text-foreground">{report.pr_count}</p>
                <p className="text-[11px] text-muted-foreground">PR under veckan</p>
              </div>
            </div>

            {categoryRows.length > 0 && (
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Distans per gren</p>
                {categoryRows.map(([key, km]) => (
                  <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{CATEGORY_LABELS[key]}</span>
                    <span className="text-xs font-bold text-foreground shrink-0">
                      {fmtNum(km)} km
                      <span className="ml-1 font-medium text-muted-foreground">
                        {Math.round((km / totalDistance) * 100)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>



          <div className="rounded-2xl bg-card shadow-soft p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Veckans pass</h3>
            {report.sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">Inga registrerade pass den här veckan.</p>
            )}
            <ul className="space-y-2">
              {report.sessions.map((s, i) => {
                const metrics: string[] = [];
                if (s.set_count) metrics.push(`${s.set_count} set`);
                if (s.tons) metrics.push(`${fmtNum(s.tons, 2)} ton`);
                if (s.distance_km) metrics.push(`${fmtNum(s.distance_km)} km`);
                if (s.tempo) metrics.push(String(s.tempo));
                return (
                  <li key={`${s.date}-${i}`} className="rounded-xl bg-muted/40 px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {fmtDate(s.date)} · {s.name}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0">v{s.week}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.length > 0 ? metrics.join(" · ") : "Genomfört"}
                    </p>
                    {s.exercises && s.exercises.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1 truncate">
                        {s.exercises.join(", ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
