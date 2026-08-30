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
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeKey = (name: string) => name.trim().toLowerCase();

/** Minuter (decimal) → "1 h 05 min" / "31:30 min". */
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

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const targetKey = normalizeKey(exerciseName);

        const { data: active } = await supabase
          .from("workout_completions")
          .select("logged_weights, updated_at, week, day")
          .eq("user_id", userId)
          .eq("done", true)
          .order("updated_at", { ascending: false })
          .limit(300);

        const { data: archived } = await supabase
          .from("archived_plans")
          .select("completion_data, archived_at")
          .eq("user_id", userId);

        const collected: HistorySession[] = [];

        const pushFromWeights = (weights: any, ts: string | Date) => {
          if (!weights || typeof weights !== "object") return;
          for (const k of Object.keys(weights)) {
            if (k.startsWith("__setdata__")) {
              if (normalizeKey(k.replace(/^__setdata__/, "")) !== targetKey) continue;
              const sets = safelyParseSets(weights[k]);
              if (sets.length === 0) continue;
              collected.push({
                date: new Date(ts),
                kind: "strength",
                sets,
                topKg: Math.max(0, ...sets.map((s) => s.kg)),
                totalVolume: sets.reduce((sum, s) => sum + s.kg * s.reps, 0),
                isPr: false,
              });
            } else if (k.startsWith("__cond__")) {
              if (normalizeKey(k.replace(/^__cond__/, "")) !== targetKey) continue;
              const obj = parseObj(weights[k]);
              if (!obj) continue;
              const cardio = {
                time: obj.time ? String(obj.time) : undefined,
                dist: obj.dist ? String(obj.dist) : undefined,
                tempo: obj.tempo ? String(obj.tempo) : undefined,
                pulse: obj.pulse ? String(obj.pulse) : undefined,
                elev: obj.elev ? String(obj.elev) : undefined,
              };
              if (!cardio.time && !cardio.dist && !cardio.tempo) continue;
              collected.push({
                date: new Date(ts),
                kind: "cardio",
                sets: [],
                topKg: 0,
                totalVolume: 0,
                isPr: false,
                cardio,
              });
            }
          }
        };

        for (const row of active || []) {
          pushFromWeights(row.logged_weights, row.updated_at || new Date().toISOString());
        }
        for (const ap of archived || []) {
          const cd = (ap as any).completion_data;
          if (!Array.isArray(cd)) continue;
          for (const c of cd) {
            if (!c?.done) continue;
            pushFromWeights(c.logged_weights, c.updated_at || ap.archived_at);
          }
        }

        collected.sort((a, b) => b.date.getTime() - a.date.getTime());

        // PR-märkning (styrka: tyngsta set, kondition: längsta distans)
        const chrono = [...collected].sort((a, b) => a.date.getTime() - b.date.getTime());
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
        const withPr = collected.map((s) => ({ ...s, isPr: prTimes.has(s.date.getTime()) }));

        if (!cancelled) setSessions(withPr.slice(0, limit));
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [exerciseName, userId, limit]);

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

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" /> Senaste {sessions.length} pass
      </p>
      {sessions.map((s, idx) => (
        <div key={idx} className="rounded-xl border border-border bg-secondary p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold">{format(s.date, "EEE d MMM yyyy", { locale: sv })}</p>
            {s.isPr && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground font-black">
                PR
              </span>
            )}
          </div>

          {s.kind === "strength" ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {s.sets.map((set, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border"
                  >
                    {set.reps} × {set.kg > 0 ? `${set.kg}kg` : "BW"}
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
    </div>
  );
};

export default ExerciseHistoryPanel;
