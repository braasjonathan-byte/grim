import { useEffect, useState } from "react";
import { X, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface ExerciseHistoryDialogProps {
  exerciseName: string;
  userId: string;
  onClose: () => void;
}

interface HistorySession {
  date: Date;
  sets: Array<{ kg: number; reps: number }>;
  topKg: number;
  totalVolume: number;
  isPr: boolean;
}

const safelyParseSets = (value: any): Array<{ kg: number; reps: number }> => {
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

const normalizeKey = (name: string) => name.trim().toLowerCase();

const ExerciseHistoryDialog = ({ exerciseName, userId, onClose }: ExerciseHistoryDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<HistorySession[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const targetKey = normalizeKey(exerciseName);
        const setDataKey = `__setdata__${exerciseName}`;

        // Active completions
        const { data: active } = await supabase
          .from("workout_completions")
          .select("logged_weights, updated_at, week, day")
          .eq("user_id", userId)
          .eq("done", true)
          .order("updated_at", { ascending: false })
          .limit(200);

        // Archived completions
        const { data: archived } = await supabase
          .from("archived_plans")
          .select("completion_data, archived_at")
          .eq("user_id", userId);

        const collected: HistorySession[] = [];

        const pushFromWeights = (weights: any, ts: string | Date) => {
          if (!weights || typeof weights !== "object") return;
          // Find a key that matches (case-insensitive)
          let matchKey: string | null = null;
          for (const k of Object.keys(weights)) {
            if (!k.startsWith("__setdata__")) continue;
            const name = k.replace(/^__setdata__/, "");
            if (normalizeKey(name) === targetKey) {
              matchKey = k;
              break;
            }
          }
          if (!matchKey) return;
          const sets = safelyParseSets(weights[matchKey]);
          if (sets.length === 0) return;
          const topKg = Math.max(0, ...sets.map((s) => s.kg));
          const totalVolume = sets.reduce((sum, s) => sum + s.kg * s.reps, 0);
          collected.push({
            date: new Date(ts),
            sets,
            topKg,
            totalVolume,
            isPr: false,
          });
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

        // Sort by date desc, mark PR (highest topKg ever)
        collected.sort((a, b) => b.date.getTime() - a.date.getTime());
        let prSoFar = 0;
        // Walk oldest → newest to figure out PR status, then keep order
        const chrono = [...collected].sort((a, b) => a.date.getTime() - b.date.getTime());
        const prMap = new Map<number, boolean>();
        for (const s of chrono) {
          if (s.topKg > prSoFar) {
            prSoFar = s.topKg;
            prMap.set(s.date.getTime(), true);
          }
        }
        const withPr = collected.map((s) => ({ ...s, isPr: prMap.get(s.date.getTime()) === true }));

        if (!cancelled) setSessions(withPr.slice(0, 5));
      } catch (e) {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [exerciseName, userId]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card border-t-2 sm:border-2 border-border max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Historik</p>
              <p className="text-sm font-black truncate">{exerciseName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary" aria-label="Stäng">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Ingen historik ännu — logga övningen så dyker den upp här.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground">Senaste {sessions.length} pass</p>
              <div className="space-y-2">
                {sessions.map((s, idx) => (
                  <div key={idx} className="border border-border bg-secondary p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold">
                        {format(s.date, "EEE d MMM yyyy", { locale: sv })}
                      </p>
                      {s.isPr && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground font-black">
                          PR
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.sets.map((set, i) => (
                        <span
                          key={i}
                          className="text-[11px] font-mono px-2 py-0.5 bg-card border border-border"
                        >
                          {set.reps} × {set.kg > 0 ? `${set.kg}kg` : "BW"}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
                      <span>Topp: <span className="font-bold text-foreground">{s.topKg > 0 ? `${s.topKg}kg` : "BW"}</span></span>
                      {s.totalVolume > 0 && (
                        <span>Volym: <span className="font-bold text-foreground">{s.totalVolume.toLocaleString("sv-SE")}kg</span></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseHistoryDialog;
