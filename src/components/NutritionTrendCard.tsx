import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Apple } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { toLocalDateKey } from "@/lib/dateUtils";
import { foodQualityScore } from "@/lib/micronutrients";

type Metric = "kcal" | "protein_g" | "fat_g" | "carbs_g" | "quality";
const METRICS: { key: Metric; label: string; unit: string; color: string }[] = [
  { key: "kcal", label: "Kcal", unit: "kcal", color: "hsl(var(--primary))" },
  { key: "protein_g", label: "Protein", unit: "g", color: "hsl(var(--destructive))" },
  { key: "fat_g", label: "Fett", unit: "g", color: "hsl(45 93% 47%)" },
  { key: "carbs_g", label: "Kolhydr.", unit: "g", color: "hsl(199 89% 48%)" },
  { key: "quality", label: "Matkvalitet", unit: "/100", color: "hsl(var(--success))" },
];

export default function NutritionTrendCard({ userId }: { userId: string }) {
  const [days, setDays] = useState<7 | 30>(7);
  const [metric, setMetric] = useState<Metric>("kcal");
  const [logs, setLogs] = useState<any[]>([]);
  const [goals, setGoals] = useState<Record<string, number>>({});

  useEffect(() => {
    const from = new Date(); from.setDate(from.getDate() - 29);
    Promise.all([
      supabase.from("meal_logs").select("log_date,kcal,protein_g,fat_g,carbs_g,fiber_g,sugar_g,nova_group")
        .eq("user_id", userId).gte("log_date", toLocalDateKey(from)).limit(5000),
      supabase.from("nutrition_goals").select("daily_kcal,protein_g,fat_g,carbs_g").eq("user_id", userId).maybeSingle(),
    ]).then(([l, g]) => {
      setLogs(l.data || []);
      if (g.data) setGoals({ kcal: g.data.daily_kcal, protein_g: g.data.protein_g, fat_g: g.data.fat_g, carbs_g: g.data.carbs_g, quality: 70 });
      else setGoals({ quality: 70 });
    });
  }, [userId]);

  const data = useMemo(() => {
    const byDay = new Map<string, any[]>();
    for (const l of logs) { const a = byDay.get(l.log_date) || []; a.push(l); byDay.set(l.log_date, a); }
    const out: any[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      const rows = byDay.get(key) || [];
      const sum = (k: string) => rows.length ? Math.round(rows.reduce((s, r) => s + Number(r[k] || 0), 0)) : null;
      out.push({
        label: d.toLocaleDateString("sv-SE", days === 7 ? { weekday: "short" } : { day: "numeric", month: "numeric" }),
        kcal: sum("kcal"), protein_g: sum("protein_g"), fat_g: sum("fat_g"), carbs_g: sum("carbs_g"),
        quality: foodQualityScore(rows),
      });
    }
    return out;
  }, [logs, days]);

  const m = METRICS.find((x) => x.key === metric)!;
  const vals = data.map((d) => d[metric]).filter((v) => v != null) as number[];
  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const goal = goals[metric];

  return (
    <div className="rounded-2xl p-4 bg-card shadow-soft space-y-3">
      <div className="flex items-center gap-2">
        <Apple className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">Näringstrend</h3>
        <div className="ml-auto flex gap-1 rounded-full bg-muted/60 p-0.5">
          {([7, 30] as const).map((n) => (
            <button key={n} onClick={() => setDays(n)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${days === n ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{n} d</button>
          ))}
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {METRICS.map((x) => (
          <button key={x.key} onClick={() => setMetric(x.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${metric === x.key ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>{x.label}</button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Snitt: <span className="font-bold text-foreground tabular-nums">{avg ?? "–"} {m.unit}</span>
        {goal ? <> · Mål: <span className="tabular-nums">{goal} {m.unit}</span></> : null}
      </p>
      <div className="h-48 -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={days === 30 ? 4 : 0} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} domain={metric === "quality" ? [0, 100] : ["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(v: any) => [`${v} ${m.unit}`, m.label]} />
            {goal ? <ReferenceLine y={goal} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" /> : null}
            <Line type="monotone" dataKey={metric} stroke={m.color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
