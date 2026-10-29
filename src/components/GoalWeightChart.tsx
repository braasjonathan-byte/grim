import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ComposedChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Target } from "lucide-react";
import { WEIGHT_CHANGED_EVENT } from "@/lib/bodyWeight";
import { useStatsSettings, weightRangeFrom } from "@/lib/statsSettings";

const parseKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const kg = (v: number) => String(v).replace(".", ",");

/** «Mot målvikten» – flyttad från Kost → Vikt till Statistik. */
export default function GoalWeightChart({ userId }: { userId: string }) {
  const [weights, setWeights] = useState<{ log_date: string; weight_kg: number }[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const { weightDays } = useStatsSettings();

  useEffect(() => {
    const load = () => {
      const from = weightRangeFrom(weightDays);
      let q = supabase.from("body_weight_logs").select("log_date,weight_kg").eq("user_id", userId);
      if (from) q = q.gte("log_date", from);
      q.order("log_date").then(({ data }) => setWeights((data || []).map((w) => ({ log_date: w.log_date, weight_kg: Number(w.weight_kg) }))));
      supabase.from("nutrition_goals").select("target_weight_kg").eq("user_id", userId).maybeSingle()
        .then(({ data }) => setGoalWeight(data?.target_weight_kg != null ? Number(data.target_weight_kg) : null));
    };
    load();
    window.addEventListener(WEIGHT_CHANGED_EVENT, load);
    return () => window.removeEventListener(WEIGHT_CHANGED_EVENT, load);
  }, [userId, weightDays]);

  const weightTrend = useMemo(() => {
    if (weights.length < 5) return null;
    const spanDays = (parseKey(weights[weights.length - 1].log_date).getTime() - parseKey(weights[0].log_date).getTime()) / 864e5;
    if (spanDays < 7) return null;
    const t0 = parseKey(weights[0].log_date).getTime();
    const xs = weights.map((w) => (parseKey(w.log_date).getTime() - t0) / 864e5); const ys = weights.map((w) => w.weight_kg);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0); if (!den) return null;
    return (xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den) * 7;
  }, [weights]);

  const plan = useMemo(() => {
    if (goalWeight == null || weights.length === 0) return null;
    const last = weights[weights.length - 1];
    const lastDate = parseKey(last.log_date);
    const diff = goalWeight - last.weight_kg;
    const reached = Math.abs(diff) < 0.2;
    const onTrack = weightTrend != null && Math.abs(weightTrend) > 0.01 && Math.sign(weightTrend) === Math.sign(diff);
    const weeks = onTrack ? diff / weightTrend! : null;
    const eta = weeks != null && weeks <= 104 ? addDays(lastDate, Math.ceil(weeks * 7)) : null;
    const pts: { label: string; weight: number | null; projected: number | null }[] = weights.map((w) => ({
      label: parseKey(w.log_date).toLocaleDateString("sv-SE", { day: "numeric", month: "numeric" }), weight: w.weight_kg, projected: null,
    }));
    pts[pts.length - 1].projected = last.weight_kg;
    if (eta && weeks) {
      const steps = Math.min(12, Math.max(1, Math.ceil(weeks)));
      for (let i = 1; i <= steps; i++) {
        const d = addDays(lastDate, Math.round((weeks * 7 * i) / steps));
        pts.push({ label: d.toLocaleDateString("sv-SE", { day: "numeric", month: "numeric" }), weight: null, projected: +(last.weight_kg + (diff * i) / steps).toFixed(1) });
      }
    }
    return { diff, reached, onTrack, eta, pts };
  }, [goalWeight, weights, weightTrend]);

  return (
    <div className="rounded-2xl p-3 bg-card shadow-soft space-y-2">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Mot målvikten</p>
        {goalWeight != null && <span className="ml-auto text-xs text-muted-foreground">Mål {kg(goalWeight)} kg</span>}
      </div>
      {goalWeight == null ? (
        <p className="text-xs text-muted-foreground">Lägg in en målvikt under Kost → Mål så visas din väg dit här.</p>
      ) : !plan ? (
        <p className="text-xs text-muted-foreground">Spara din vikt under Kost → Vikt så räknas vägen dit ut.</p>
      ) : (
        <>
          <p className="text-xs">
            {plan.reached ? <>Du har nått din målvikt {kg(goalWeight)} kg!</> : <>
              {Math.abs(plan.diff).toFixed(1).replace(".", ",")} kg kvar.{" "}
              {plan.eta
                ? <>Med nuvarande takt når du målet ungefär <span className="font-bold">{plan.eta.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}</span>.</>
                : weightTrend == null
                  ? "Väg dig minst fem gånger över en vecka så räknas ett datum ut."
                  : plan.onTrack ? "Med nuvarande takt dröjer det mer än två år." : "Vikten rör sig just nu åt fel håll eller står still."}
            </>}
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={plan.pts} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" minTickGap={20} />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" domain={[(min: number) => Math.floor(Math.min(min, goalWeight) - 1), (max: number) => Math.ceil(Math.max(max, goalWeight) + 1)]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number, n: string) => [`${kg(v)} kg`, n === "weight" ? "Vikt" : "Prognos"]} />
                <ReferenceLine y={goalWeight} stroke="hsl(var(--success))" strokeDasharray="4 4" label={{ value: "Mål", fontSize: 10, fill: "hsl(var(--success))", position: "insideTopRight" }} />
                <Line dataKey="weight" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                <Line dataKey="projected" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
