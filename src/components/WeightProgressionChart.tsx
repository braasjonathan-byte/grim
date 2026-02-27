import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { normalizeExerciseName } from "@/lib/exerciseNormalization";

interface WeightProgressionChartProps {
  userId: string;
}

interface CompletionRow {
  week: number;
  day: string;
  done: boolean;
  updated_at: string;
  logged_weights: Record<string, number> | null;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--warning, 38 92% 50%))",
  "#22d3ee",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fb923c",
];

const WeightProgressionChart = ({ userId }: WeightProgressionChartProps) => {
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

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

  const { exercises, chartData } = useMemo(() => {
    const exerciseSet = new Set<string>();
    for (const c of completions) {
      if (c.logged_weights) {
        for (const name of Object.keys(c.logged_weights)) {
          if (name.startsWith("__")) continue;
          exerciseSet.add(normalizeExerciseName(name));
        }
      }
    }
    const exercises = Array.from(exerciseSet).sort();

    // Build chart data: each point is a completion with a date
    const data: Record<string, string | number>[] = [];
    const lastKnown: Record<string, number> = {};

    for (const c of completions) {
      if (!c.logged_weights) continue;
      const dateLabel = new Date(c.updated_at).toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "short",
      });

      const point: Record<string, string | number> = { date: `V${c.week} ${dateLabel}` };
      let hasRelevant = false;

      for (const [ex, w] of Object.entries(c.logged_weights)) {
        if (ex.startsWith("__")) continue;
        const normEx = normalizeExerciseName(ex);
        if (typeof w === "number" && w > 0) {
          // If multiple aliases map to same name, keep the highest
          const existing = point[normEx];
          if (typeof existing !== "number" || w > existing) {
            point[normEx] = w;
          }
          lastKnown[normEx] = w;
          hasRelevant = true;
        }
      }

      if (hasRelevant) data.push(point);
    }

    return { exercises, chartData: data };
  }, [completions]);

  if (exercises.length === 0) {
    return null;
  }

  const displayExercises = selectedExercise ? [selectedExercise] : exercises.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold tracking-tight">Viktutveckling</h3>
      </div>

      {/* Exercise filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedExercise(null)}
          className={`px-2 py-1 text-[10px] font-medium rounded-full transition-colors ${
            !selectedExercise
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Alla (topp 4)
        </button>
        {exercises.map((ex) => (
          <button
            key={ex}
            onClick={() => setSelectedExercise(selectedExercise === ex ? null : ex)}
            className={`px-2 py-1 text-[10px] font-medium rounded-full transition-colors ${
              selectedExercise === ex
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 1 ? (
        <div className="bg-card border border-border rounded-lg p-3">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                width={35}
                unit="kg"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              {displayExercises.map((ex, i) => (
                <Line
                  key={ex}
                  type="monotone"
                  dataKey={ex}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                  name={ex}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          Logga vikter i minst 2 pass för att se grafen
        </p>
      )}
    </div>
  );
};

export default WeightProgressionChart;
