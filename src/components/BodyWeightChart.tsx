import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ComposedChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Scale } from "lucide-react";
import { toLocalDateKey } from "@/lib/dateUtils";
import { useStatsSettings, WEIGHT_RANGES } from "@/lib/statsSettings";
import { WEIGHT_CHANGED_EVENT } from "@/lib/bodyWeight";

const parseKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function BodyWeightChart({ userId }: { userId: string }) {
  const [weights, setWeights] = useState<{ log_date: string; weight_kg: number }[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const { weightDays, setWeightDays } = useStatsSettings();

  useEffect(() => {
    const load = () => {
      const from = toLocalDateKey(addDays(new Date(), -(weightDays - 1)));
      supabase.from("body_weight_logs").select("log_date,weight_kg").eq("user_id", userId)
        .gte("log_date", from).order("log_date")
        .then(({ data }) => setWeights((data || []).map((w) => ({ log_date: w.log_date, weight_kg: Number(w.weight_kg) }))));
      supabase.from("nutrition_goals").select("target_weight_kg").eq("user_id", userId).maybeSingle()
        .then(({ data }) => setGoalWeight(data?.target_weight_kg != null ? Number(data.target_weight_kg) : null));
    };
    load();
    window.addEventListener(WEIGHT_CHANGED_EVENT, load);
    return () => window.removeEventListener(WEIGHT_CHANGED_EVENT, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, weightDays]);

  // kg/vecka enligt minstakvadratregression över vägningarna.
  // Kräver minst 5 vägningar över minst 7 dagar – färre ger en missvisande prognos.
  const weightTrend = useMemo(() => {
    if (weights.length < 5) return null;
    const spanDays = (parseKey(weights[weights.length - 1].log_date).getTime() - parseKey(weights[0].log_date).getTime()) / 864e5;
    if (spanDays < 7) return null;
    const t0 = parseKey(weights[0].log_date).getTime();
    const xs = weights.map((w) => (parseKey(w.log_date).getTime() - t0) / 864e5);
    const ys = weights.map((w) => w.weight_kg);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    if (!den) return null;
    return (xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den) * 7;
  }, [weights]);

  const chart = useMemo(() => {
    const pts: { label: string; weight: number | null; projected: number | null }[] = weights.map((w) => ({
      label: parseKey(w.log_date).toLocaleDateString("sv-SE", { day: "numeric", month: "numeric" }),
      weight: w.weight_kg, projected: null,
    }));
    if (goalWeight == null || weights.length === 0) return { pts, eta: null as Date | null };
    const last = weights[weights.length - 1];
    const lastDate = parseKey(last.log_date);
    const diff = goalWeight - last.weight_kg;
    const onTrack = weightTrend != null && Math.abs(weightTrend) > 0.01 && Math.sign(weightTrend) === Math.sign(diff);
    const weeks = onTrack ? diff / weightTrend! : null;
    const eta = weeks != null && weeks > 0 && weeks <= 104 ? addDays(lastDate, Math.ceil(weeks * 7)) : null;
    pts[pts.length - 1].projected = last.weight_kg;
    if (eta && weeks != null) {
      const steps = Math.min(12, Math.max(1, Math.ceil(weeks)));
      for (let i = 1; i <= steps; i++) {
        const d = addDays(lastDate, Math.round((weeks * 7 * i) / steps));
        pts.push({ label: d.toLocaleDateString("sv-SE", { day: "numeric", month: "numeric" }), weight: null, projected: +(last.weight_kg + (diff * i) / steps).toFixed(1) });
      }
    }
    return { pts, eta };
  }, [weights, goalWeight, weightTrend]);

  if (weights.length === 0) return null;
  const last = weights[weights.length - 1];
  const change = weights.length > 1 ? last.weight_kg - weights[0].weight_kg : null;

  return (
    <div className="rounded-2xl p-3 bg-card shadow-soft space-y-2">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Vikt</p>
        <span className="ml-auto text-sm font-bold tabular-nums">{String(last.weight_kg).replace(".", ",")} kg</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {change != null && <>{change > 0 ? "+" : ""}{change.toFixed(1).replace(".", ",")} kg på {WEIGHT_RANGES.find((x) => x.days === weightDays)?.label} · </>}
        {weightTrend != null && <>{weightTrend > 0 ? "+" : ""}{weightTrend.toFixed(2).replace(".", ",")} kg/vecka · </>}
        {goalWeight != null && <>Målvikt {String(goalWeight).replace(".", ",")} kg{chart.eta ? ` – ungefär ${chart.eta.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}` : ""}</>}
        {goalWeight != null && weightTrend == null && weights.length > 1 && <> · Logga vikten några dagar till för en säkrare prognos</>}
      </p>
      <div className="flex gap-1 rounded-full bg-muted/60 p-1">
        {WEIGHT_RANGES.map((x) => (
          <button key={x.days} onClick={() => setWeightDays(x.days)}
            className={`flex-1 py-1 text-[11px] font-semibold rounded-full ${weightDays === x.days ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart.pts} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={24} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))"
              domain={[(min: number) => Math.floor(Math.min(min, goalWeight ?? min) - 1), (max: number) => Math.ceil(Math.max(max, goalWeight ?? max) + 1)]} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, n: string) => [`${String(v).replace(".", ",")} kg`, n === "weight" ? "Vikt" : "Prognos"]} />
            {goalWeight != null &&
              <ReferenceLine y={goalWeight} stroke="hsl(var(--success))" strokeDasharray="4 4"
                label={{ value: "Mål", fontSize: 10, fill: "hsl(var(--success))", position: "insideTopRight" }} />}
            <Line dataKey="weight" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            <Line dataKey="projected" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground">Röd linje: dina vägningar · Blå streckad: vägen till målvikten · Lägg in ny vikt under Vikt-fliken i kost.</p>
    </div>
  );
}
