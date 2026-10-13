import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line, CartesianGrid } from "recharts";
import { BarChart3, TrendingUp, Scale, ListOrdered } from "lucide-react";
import { toLocalDateKey } from "@/lib/dateUtils";
import { isPlausibleMealLog, validateNumber, parseDecimal } from "@/lib/inputValidation";
import { useToast } from "@/hooks/use-toast";

type Tab = "week" | "forecast" | "weight" | "foods";
type Log = { log_date: string; item_name: string; amount: number; unit: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number };
type Targets = { kcal: number; protein_g: number; fat_g: number; carbs_g: number };

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "week", label: "Vecka", icon: BarChart3 },
  { key: "forecast", label: "Prognos", icon: TrendingUp },
  { key: "weight", label: "Vikt", icon: Scale },
  { key: "foods", label: "Livsmedel", icon: ListOrdered },
];
const DAY_NAMES = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"];

const parseKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmt = (n: number) => Math.round(n).toLocaleString("sv-SE");

export default function NutritionInsights({ userId, dateKey, targets, refreshKey }: { userId: string; dateKey: string; targets: Targets; refreshKey?: number }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("week");
  const [logs, setLogs] = useState<Log[]>([]);
  const [weights, setWeights] = useState<{ log_date: string; weight_kg: number }[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);

  const selected = parseKey(dateKey);
  const monday = mondayOf(selected);
  const from = toLocalDateKey(addDays(selected, -29) < monday ? addDays(selected, -29) : monday);
  const to = toLocalDateKey(addDays(monday, 6) > selected ? addDays(monday, 6) : selected);

  const loadWeights = () => supabase.from("body_weight_logs").select("log_date,weight_kg").eq("user_id", userId)
    .gte("log_date", toLocalDateKey(addDays(selected, -89))).lte("log_date", dateKey).order("log_date")
    .then(({ data }) => setWeights((data || []).map((w) => ({ log_date: w.log_date, weight_kg: Number(w.weight_kg) }))));

  useEffect(() => {
    supabase.from("meal_logs").select("log_date,item_name,amount,unit,kcal,protein_g,fat_g,carbs_g")
      .eq("user_id", userId).gte("log_date", from).lte("log_date", to).limit(5000)
      .then(({ data }) => setLogs(((data || []) as Log[]).filter((l) => isPlausibleMealLog(l))));
    loadWeights();
    supabase.from("nutrition_goals").select("target_weight_kg").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setGoalWeight(data?.target_weight_kg != null ? Number(data.target_weight_kg) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, from, to, refreshKey]);

  const byDay = useMemo(() => {
    const m = new Map<string, { kcal: number; protein: number; fat: number; carbs: number }>();
    for (const l of logs) {
      const a = m.get(l.log_date) || { kcal: 0, protein: 0, fat: 0, carbs: 0 };
      a.kcal += Number(l.kcal) || 0; a.protein += Number(l.protein_g) || 0; a.fat += Number(l.fat_g) || 0; a.carbs += Number(l.carbs_g) || 0;
      m.set(l.log_date, a);
    }
    return m;
  }, [logs]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i); const k = toLocalDateKey(d); const v = byDay.get(k);
    return { key: k, label: d.toLocaleDateString("sv-SE", { weekday: "short" }).replace(".", ""), kcal: v ? Math.round(v.kcal) : 0, protein: v ? Math.round(v.protein) : 0, fat: v ? Math.round(v.fat) : 0, carbs: v ? Math.round(v.carbs) : 0, logged: !!v };
  }), [byDay, monday.getTime()]);

  // ---- Prognos ----
  const forecast = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    const past = week.filter((d) => d.key <= todayKey);
    const logged = past.filter((d) => d.logged);
    const sum = logged.reduce((s, d) => s + d.kcal, 0);
    const avg = logged.length ? sum / logged.length : 0;
    const remaining = week.filter((d) => d.key > todayKey).length + past.filter((d) => !d.logged && d.key === todayKey).length;
    const projected = sum + avg * remaining;
    const goal = targets.kcal * 7;
    // När når man veckans kcal-budget med nuvarande snitt?
    let reachDay: number | null = null;
    if (avg > 0) {
      let acc = 0;
      for (let i = 0; i < 7; i++) { const d = week[i]; acc += d.key <= todayKey && d.logged ? d.kcal : d.key <= todayKey ? 0 : avg; if (acc >= goal) { reachDay = i; break; } }
    }
    const proteinDays = logged.filter((d) => d.protein >= targets.protein_g * 0.9).length;
    const proteinRate = logged.length ? proteinDays / logged.length : 0;
    return { logged: logged.length, avg, projected, goal, reachDay, proteinDays, proteinProjected: Math.round(proteinDays + proteinRate * remaining) };
  }, [week, targets]);

  // ---- Vikt ----
  const weightChart = useMemo(() => {
    const wMap = new Map(weights.map((w) => [w.log_date, w.weight_kg]));
    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(selected, i - 29); const k = toLocalDateKey(d);
      return { label: d.toLocaleDateString("sv-SE", { day: "numeric", month: "numeric" }), kcal: byDay.get(k) ? Math.round(byDay.get(k)!.kcal) : null, weight: wMap.get(k) ?? null };
    });
  }, [weights, byDay, dateKey]);
  const weightTrend = useMemo(() => {
    if (weights.length < 2) return null;
    const t0 = parseKey(weights[0].log_date).getTime();
    const xs = weights.map((w) => (parseKey(w.log_date).getTime() - t0) / 864e5); const ys = weights.map((w) => w.weight_kg);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0); if (!den) return null;
    return (xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den) * 7;
  }, [weights]);
  const goalPlan = useMemo(() => {
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
    return { last: last.weight_kg, diff, reached, onTrack, eta, pts };
  }, [goalWeight, weights, weightTrend]);
  const todayWeight = weights.find((w) => w.log_date === dateKey)?.weight_kg;
  const ws = weightChart.map((d) => d.weight).filter((v): v is number => v != null);

  const saveWeight = async () => {
    const v = validateNumber(weightInput, "bodyWeightKg");
    if (v.error || v.value == null) { toast({ title: "Ogiltig vikt", description: v.error || "Ange en vikt", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("body_weight_logs").upsert({ user_id: userId, log_date: dateKey, weight_kg: parseDecimal(weightInput) }, { onConflict: "user_id,log_date" });
    setSaving(false);
    if (error) { toast({ title: "Kunde inte spara vikten", description: error.message, variant: "destructive" }); return; }
    if (dateKey === toLocalDateKey(new Date())) await supabase.from("profiles").update({ weight_kg: parseDecimal(weightInput) } as any).eq("user_id", userId);
    setWeightInput(""); loadWeights();
    toast({ title: "Vikt sparad" });
  };

  // ---- Livsmedel ----
  const foods = useMemo(() => {
    const start = toLocalDateKey(addDays(selected, -29));
    const m = new Map<string, { name: string; count: number; days: Set<string>; kcal: number; grams: number }>();
    for (const l of logs) {
      if (l.log_date < start || l.log_date > dateKey) continue;
      const key = l.item_name.trim().toLowerCase(); if (!key) continue;
      const a = m.get(key) || { name: l.item_name.trim(), count: 0, days: new Set(), kcal: 0, grams: 0 };
      a.count++; a.days.add(l.log_date); a.kcal += Number(l.kcal) || 0; if (l.unit === "g" || l.unit === "ml") a.grams += Number(l.amount) || 0;
      m.set(key, a);
    }
    const total = [...m.values()].reduce((s, f) => s + f.kcal, 0);
    return { list: [...m.values()].sort((a, b) => b.count - a.count || b.kcal - a.kcal).slice(0, 15), total };
  }, [logs, dateKey]);

  return (
    <div className="rounded-2xl bg-card shadow-soft border border-border/40 p-4 space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-full bg-muted/60 p-0.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold rounded-full ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "week" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Vecka från {monday.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })} · Snitt{" "}
            <span className="font-bold text-foreground tabular-nums">{fmt(forecastAvg(week))} kcal</span> · Mål {fmt(targets.kcal)}
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number, n: string) => [`${fmt(v)} ${n === "kcal" ? "kcal" : "g"}`, n === "kcal" ? "Kalorier" : n]} />
                <ReferenceLine y={targets.kcal} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
                <Bar dataKey="kcal" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([["Protein", "protein", targets.protein_g], ["Fett", "fat", targets.fat_g], ["Kolhydr.", "carbs", targets.carbs_g]] as const).map(([label, k, goal]) => {
              const d = week.filter((x) => x.logged); const avg = d.length ? d.reduce((s, x) => s + x[k], 0) / d.length : 0;
              return (
                <div key={k} className="rounded-xl bg-muted/50 py-2">
                  <p className="text-[10px] text-muted-foreground">{label} snitt</p>
                  <p className="text-sm font-bold tabular-nums">{fmt(avg)} g</p>
                  <p className="text-[10px] text-muted-foreground">mål {fmt(goal)} g</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "forecast" && (
        <div className="space-y-2 text-sm">
          {forecast.logged === 0 ? (
            <p className="text-xs text-muted-foreground">Logga minst en dag den här veckan så räknar appen fram en prognos.</p>
          ) : (
            <>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Med ditt snitt på {fmt(forecast.avg)} kcal/dag landar veckan på</p>
                <p className="text-lg font-bold tabular-nums">{fmt(forecast.projected)} <span className="text-xs font-normal text-muted-foreground">av {fmt(forecast.goal)} kcal</span></p>
                <p className="text-xs">
                  {Math.abs(forecast.projected - forecast.goal) < forecast.goal * 0.03
                    ? "Du ligger precis i fas med veckomålet."
                    : forecast.projected > forecast.goal
                      ? `Ca ${fmt(forecast.projected - forecast.goal)} kcal över målet${forecast.reachDay != null ? ` – veckobudgeten är slut på ${DAY_NAMES[forecast.reachDay]}` : ""}.`
                      : `Ca ${fmt(forecast.goal - forecast.projected)} kcal under målet.`}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Proteinmål (minst 90 %)</p>
                <p className="text-sm">Nått {forecast.proteinDays} av {forecast.logged} loggade dagar – i den takten <span className="font-bold">{forecast.proteinProjected} av 7</span> dagar.</p>
              </div>
              {weightTrend != null && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Vikttrend</p>
                  <p className="text-sm">{weightTrend > 0 ? "+" : ""}{weightTrend.toFixed(2).replace(".", ",")} kg/vecka enligt dina vägningar.</p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Prognosen bygger bara på dagar du har loggat.</p>
            </>
          )}
        </div>
      )}

      {tab === "weight" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
              placeholder={todayWeight ? `${String(todayWeight).replace(".", ",")} kg sparat` : "Vikt (kg) för dagen"}
              className="flex-1 rounded-full bg-muted/60 px-3 py-2 text-sm" />
            <button onClick={saveWeight} disabled={saving || !weightInput} className="pill-btn bg-primary text-primary-foreground px-4 text-xs disabled:opacity-40">Spara</button>
          </div>
          {ws.length === 0 ? (
            <p className="text-xs text-muted-foreground">Väg dig och spara vikten här, så visas den bredvid ditt kaloriintag.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Senast <span className="font-bold text-foreground">{String(ws[ws.length - 1]).replace(".", ",")} kg</span>
              {ws.length > 1 && <> · {ws[ws.length - 1] - ws[0] > 0 ? "+" : ""}{(ws[ws.length - 1] - ws[0]).toFixed(1).replace(".", ",")} kg på 30 dagar</>}
            </p>
          )}
          <div className="rounded-xl bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-semibold">Mot målvikten</p>
            {goalWeight == null ? (
              <p className="text-xs text-muted-foreground">Lägg in en målvikt under knappen Mål så visas din väg dit här.</p>
            ) : !goalPlan ? (
              <p className="text-xs text-muted-foreground">Målvikt {String(goalWeight).replace(".", ",")} kg. Spara din vikt så räknas vägen dit ut.</p>
            ) : (
              <>
                <p className="text-xs">
                  {goalPlan.reached ? <>Du har nått din målvikt {String(goalWeight).replace(".", ",")} kg!</> : <>
                    {Math.abs(goalPlan.diff).toFixed(1).replace(".", ",")} kg kvar till {String(goalWeight).replace(".", ",")} kg.{" "}
                    {goalPlan.eta
                      ? <>Med nuvarande takt når du målet ungefär <span className="font-bold">{goalPlan.eta.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}</span>.</>
                      : weights.length < 2
                        ? "Väg dig några gånger till så räknas ett datum ut."
                        : goalPlan.onTrack ? "Med nuvarande takt dröjer det mer än två år." : "Vikten rör sig just nu åt fel håll eller står still."}
                  </>}
                </p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={goalPlan.pts} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" minTickGap={20} />
                      <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" domain={[(min: number) => Math.floor(Math.min(min, goalWeight) - 1), (max: number) => Math.ceil(Math.max(max, goalWeight) + 1)]} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number, n: string) => [`${String(v).replace(".", ",")} kg`, n === "weight" ? "Vikt" : "Prognos"]} />
                      <ReferenceLine y={goalWeight} stroke="hsl(var(--success))" strokeDasharray="4 4" label={{ value: "Mål", fontSize: 10, fill: "hsl(var(--success))", position: "insideTopRight" }} />
                      <Line dataKey="weight" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                      <Line dataKey="projected" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weightChart} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={6} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="k" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="w" orientation="right" domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={30} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number, n: string) => n === "weight" ? [`${String(v).replace(".", ",")} kg`, "Vikt"] : [`${fmt(v)} kcal`, "Intag"]} />
                <Bar yAxisId="k" dataKey="kcal" fill="hsl(var(--primary) / 0.35)" radius={[3, 3, 0, 0]} />
                <Line yAxisId="w" dataKey="weight" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "foods" && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Senaste 30 dagarna</p>
          {foods.list.length === 0 && <p className="text-xs text-muted-foreground">Inget loggat än.</p>}
          {foods.list.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
              <span className="w-5 text-xs font-bold text-muted-foreground tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {f.count} {f.count === 1 ? "gång" : "gånger"} · {f.days.size} {f.days.size === 1 ? "dag" : "dagar"}
                  {f.grams > 0 && <> · {f.grams >= 1000 ? `${(f.grams / 1000).toFixed(1).replace(".", ",")} kg` : `${fmt(f.grams)} g`}</>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold tabular-nums">{fmt(f.kcal)} kcal</p>
                <p className="text-[10px] text-muted-foreground">{foods.total ? Math.round((f.kcal / foods.total) * 100) : 0} % av intaget</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function forecastAvg(week: { kcal: number; logged: boolean }[]) {
  const d = week.filter((x) => x.logged);
  return d.length ? d.reduce((s, x) => s + x.kcal, 0) / d.length : 0;
}
