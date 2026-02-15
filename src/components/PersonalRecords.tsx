import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Equal, TrendingDown } from "lucide-react";

interface PersonalRecordsProps {
  userId: string;
}

interface CompletionRow {
  week: number;
  day: string;
  done: boolean;
  updated_at: string;
  logged_weights: Record<string, number> | null;
}

interface PRRecord {
  exercise: string;
  weight: number;
  date: string;
  week: number;
  trend: "up" | "same" | "down" | "first";
}

const PersonalRecords = ({ userId }: PersonalRecordsProps) => {
  const [completions, setCompletions] = useState<CompletionRow[]>([]);

  useEffect(() => {
    supabase
      .from("workout_completions")
      .select("week, day, done, updated_at, logged_weights")
      .eq("user_id", userId)
      .eq("done", true)
      .order("updated_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setCompletions(
            data.map((c) => ({
              ...c,
              logged_weights: c.logged_weights as Record<string, number> | null,
            }))
          );
        }
      });
  }, [userId]);

  const records = useMemo(() => {
    const prMap = new Map<string, { weight: number; date: string; week: number; previousBest: number | null }>();

    for (const c of completions) {
      if (!c.logged_weights) continue;
      for (const [ex, w] of Object.entries(c.logged_weights)) {
        if (ex.startsWith("__")) continue;
        if (typeof w !== "number" || w <= 0) continue;
        const existing = prMap.get(ex);
        if (!existing || w > existing.weight) {
          prMap.set(ex, {
            weight: w,
            date: c.updated_at,
            week: c.week,
            previousBest: existing?.weight ?? null,
          });
        }
      }
    }

    const result: PRRecord[] = [];
    for (const [exercise, data] of prMap) {
      let trend: PRRecord["trend"] = "first";
      if (data.previousBest !== null) {
        if (data.weight > data.previousBest) trend = "up";
        else if (data.weight === data.previousBest) trend = "same";
        else trend = "down";
      }
      result.push({
        exercise,
        weight: data.weight,
        date: data.date,
        week: data.week,
        trend,
      });
    }

    return result.sort((a, b) => b.weight - a.weight);
  }, [completions]);

  if (records.length === 0) return null;

  const TrendIcon = ({ trend }: { trend: PRRecord["trend"] }) => {
    if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-success" />;
    if (trend === "same") return <Equal className="w-3.5 h-3.5 text-muted-foreground" />;
    if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
    return <Trophy className="w-3.5 h-3.5 text-warning" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-warning" />
        <h3 className="text-lg font-bold tracking-tight">Personliga rekord</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {records.map((pr) => (
          <div
            key={pr.exercise}
            className="bg-card border border-border rounded-lg p-3 space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium truncate flex-1">
                {pr.exercise}
              </span>
              <TrendIcon trend={pr.trend} />
            </div>
            <p className="text-xl font-black">{pr.weight} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
            <p className="text-[10px] text-muted-foreground">
              V{pr.week} · {new Date(pr.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonalRecords;
