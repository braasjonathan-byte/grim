import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface StrengthSet {
  kg: number;
  reps: number;
}

interface HistorySession {
  date: Date;
  kind: "strength" | "cardio";
  source: "current" | "archive";
  sets: StrengthSet[];
  topKg: number;
  totalVolume: number;
  isPr: boolean;
  cardio?: {
    time?: string;
    dist?: string;
    tempo?: string;
    pulse?: string;
    elev?: string;
  };
}

const safelyParseSets = (value: any): StrengthSet[] => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: any) => ({ kg: Number(s?.kg) || 0, reps: Number(s?.reps) || 0 }))
      .filter((s) => s.reps > 0 || s.kg > 0);
  } catch {
    return [];
  }
};

const parseObj = (value: any): Record<string, any> | null => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeKey = (name: string) => name.trim().toLowerCase();

/** Äldre format: logged_weights["Knäböj"] = "80" eller [{kg,reps}] */
const legacySets = (value: any): StrengthSet[] => {
  const arr = safelyParseSets(value);
  if (arr.length > 0) return arr;
  const num = parseFloat(String(value ?? "").replace(",", "."));
  if (Number.isFinite(num) && num > 0) return [{ kg: num, reps: 0 }];
  return [];
};

const DAY_OFFSET: Record<string, number> = {
  mån: 0, måndag: 0, tis: 1, tisdag: 1, ons: 2, onsdag: 2,
  tors: 3, tor: 3, torsdag: 3, fre: 4, fredag: 4, lör: 5, lördag: 5, sön: 6, söndag: 6,
};

/** Härled datum för en completion (samma logik som topplistan). */
const completionDate = (
  week: number | null | undefined,
  day: string | null | undefined,
  planStart: string | null,
  fallback: string | Date,
): Date => {
  const rawDay = String(day ?? "");
  const isoMatch = rawDay.match(/^(\d{4}-\d{2}-\d{2})/);
  if ((week ?? 0) === 0 && isoMatch) return new Date(`${isoMatch[1]}T12:00:00`);

  if (planStart && (week ?? 0) > 0) {
    const start = new Date(`${planStart}T12:00:00`);
    if (!Number.isNaN(start.getTime())) {
      const isoDow = ((start.getDay() + 6) % 7) + 1; // 1 = måndag
      const monday = new Date(start);
      monday.setDate(monday.getDate() - (isoDow - 1));
      const dayKey = rawDay.replace(/_[a-z0-9]+$/i, "").toLowerCase();
      const offset = DAY_OFFSET[dayKey] ?? 0;
      const d = new Date(monday);
      d.setDate(d.getDate() + ((week as number) - 1) * 7 + offset);
      if (d.getTime() <= Date.now()) return d;
    }
  }
  return new Date(fallback);
};

/** Minuter (decimal) → "1h 05m" / "31:30 min". */
const formatMinutes = (raw?: string) => {
  const v = parseFloat(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return null;
  const totalSec = Math.round(v * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")} min`;
};

const ExerciseHistoryPanel = ({
  exerciseName,
  userId,
  limit = 10,
}: {
  exerciseName: string;
  userId: string;
  limit?: number;
}) => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      setShowAll(false);
      try {
        const targetKey = normalizeKey(exerciseName);

        const [{ data: profile }, { data: active }, { data: archived }] = await Promise.all([
          supabase.from("profiles").select("plan_start_date").eq("user_id", userId).maybeSingle(),
          supabase
            .from("workout_completions")
            .select("logged_weights, updated_at, week, day, logged_distance_km, logged_tempo, logged_pulse")
            .eq("user_id", userId)
            .eq("done", true)
            .order("updated_at", { ascending: false })
            .limit(1000),
          supabase
            .from("archived_plans")
            .select("completion_data, archived_at, plan_start_date")
            .eq("user_id", userId)
            .order("archived_at", { ascending: false }),
        ]);

        const planStart = (profile as any)?.plan_start_date ?? null;
        const collected: HistorySession[] = [];

        const pushFromWeights = (weights: any, date: Date, source: "current" | "archive") => {
          if (!weights || typeof weights !== "object") return;
          for (const k of Object.keys(weights)) {
            const value = weights[k];
            if (k.startsWith("__setdata__")) {
              if (normalizeKey(k.replace(/^__setdata__/, "")) !== targetKey) continue;
              const sets = safelyParseSets(value);
              if (sets.length === 0) continue;
              collected.push({
                date,
                kind: "strength",
                source,
                sets,
                topKg: Math.max(0, ...sets.map((s) => s.kg)),
                totalVolume: sets.reduce((sum, s) => sum + s.kg * s.reps, 0),
                isPr: false,
              });
            } else if (k.startsWith("__cond__")) {
              if (normalizeKey(k.replace(/^__cond__/, "")) !== targetKey) continue;
              const obj = parseObj(value);
              if (!obj) continue;
              const cardio = {
                time: obj.time ? String(obj.time) : undefined,
                dist: obj.dist ? String(obj.dist) : undefined,
                tempo: obj.tempo ? String(obj.tempo) : undefined,
                pulse: obj.pulse ? String(obj.pulse) : undefined,
                elev: obj.elev ? String(obj.elev) : undefined,
              };
              if (!cardio.time && !cardio.dist && !cardio.tempo) continue;
              collected.push({ date, kind: "cardio", source, sets: [], topKg: 0, totalVolume: 0, isPr: false, cardio });
            } else if (!k.startsWith("__") && normalizeKey(k) === targetKey) {
              // Äldre format utan prefix
              const sets = legacySets(value);
              if (sets.length === 0) continue;
              collected.push({
                date,
                kind: "strength",
                source,
                sets,
                topKg: Math.max(0, ...sets.map((s) => s.kg)),
                totalVolume: sets.reduce((sum, s) => sum + s.kg * s.reps, 0),
                isPr: false,
              });
            }
          }
        };

        for (const row of active || []) {
          const date = completionDate(row.week, row.day, planStart, row.updated_at || new Date());
          pushFromWeights(row.logged_weights, date, "current");
        }

        for (const ap of archived || []) {
          const cd = (ap as any).completion_data;
          const rows: any[] = Array.isArray(cd) ? cd : cd && typeof cd === "object" ? Object.values(cd) : [];
          for (const c of rows) {
            if (!c?.done) continue;
            const date = completionDate(
              c.week,
              c.day,
              (ap as any).plan_start_date ?? null,
              c.updated_at || (ap as any).archived_at,
            );
            pushFromWeights(c.logged_weights, date, "archive");
          }
        }

        // Ta bort dubbletter (samma dag + samma innehåll)
        const seen = new Set<string>();
        const unique = collected.filter((s) => {
          const sig = `${s.kind}|${format(s.date, "yyyy-MM-dd")}|${
            s.kind === "strength"
              ? s.sets.map((x) => `${x.reps}x${x.kg}`).join(",")
              : `${s.cardio?.dist}/${s.cardio?.time}/${s.cardio?.tempo}`
          }`;
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });

        unique.sort((a, b) => b.date.getTime() - a.date.getTime());

        // PR-märkning (styrka: tyngsta set, kondition: längsta distans)
        const chrono = [...unique].sort((a, b) => a.date.getTime() - b.date.getTime());
        const prTimes = new Set<number>();
        let bestKg = 0;
        let bestDist = 0;
        for (const s of chrono) {
          if (s.kind === "strength") {
            if (s.topKg > bestKg) {
              bestKg = s.topKg;
              prTimes.add(s.date.getTime());
            }
          } else {
            const d = parseFloat(String(s.cardio?.dist ?? "").replace(",", "."));
            if (Number.isFinite(d) && d > bestDist) {
              bestDist = d;
              prTimes.add(s.date.getTime());
            }
          }
        }
        const withPr = unique.map((s) => ({ ...s, isPr: prTimes.has(s.date.getTime()) }));

        if (!cancelled) {
          setTotalFound(withPr.length);
          setSessions(withPr);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
          setTotalFound(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [exerciseName, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        Ingen historik ännu — logga övningen så dyker den upp här.
      </p>
    );
  }

  const visible = showAll ? sessions : sessions.slice(0, limit);

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" /> {visible.length} av {totalFound} loggade pass
      </p>
      {visible.map((s, idx) => (
        <div key={idx} className="rounded-xl border border-border bg-secondary p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold">{format(s.date, "EEE d MMM yyyy", { locale: sv })}</p>
            <div className="flex items-center gap-1.5">
              {s.source === "archive" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-bold uppercase">
                  Arkiv
                </span>
              )}
              {s.isPr && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground font-black">
                  PR
                </span>
              )}
            </div>
          </div>

          {s.kind === "strength" ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {s.sets.map((set, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border"
                  >
                    {set.reps > 0 ? `${set.reps} × ` : ""}
                    {set.kg > 0 ? `${set.kg}kg` : "BW"}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
                <span>
                  Topp:{" "}
                  <span className="font-bold text-foreground">{s.topKg > 0 ? `${s.topKg}kg` : "BW"}</span>
                </span>
                {s.totalVolume > 0 && (
                  <span>
                    Volym:{" "}
                    <span className="font-bold text-foreground">
                      {s.totalVolume.toLocaleString("sv-SE")}kg
                    </span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {s.cardio?.dist && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border">
                  {s.cardio.dist} km
                </span>
              )}
              {formatMinutes(s.cardio?.time) && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border">
                  {formatMinutes(s.cardio?.time)}
                </span>
              )}
              {s.cardio?.tempo && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border">
                  {s.cardio.tempo} tempo
                </span>
              )}
              {s.cardio?.pulse && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border">
                  {s.cardio.pulse} bpm
                </span>
              )}
              {s.cardio?.elev && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border">
                  ⛰ {s.cardio.elev} m
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      {!showAll && sessions.length > limit && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-xs font-semibold text-primary rounded-lg border border-border hover:bg-secondary transition-colors"
        >
          Visa all historik ({sessions.length})
        </button>
      )}
    </div>
  );
};

export default ExerciseHistoryPanel;
