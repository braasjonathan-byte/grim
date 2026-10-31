import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line, CartesianGrid } from "recharts";
import { BarChart3, TrendingUp, Scale, ListOrdered, LineChart, List } from "lucide-react";
import { toLocalDateKey } from "@/lib/dateUtils";
import { WEIGHT_CHANGED_EVENT } from "@/lib/bodyWeight";
import { isPlausibleMealLog, validateNumber, parseDecimal } from "@/lib/inputValidation";
import { useToast } from "@/hooks/use-toast";
import { useStatsSettings, WEIGHT_RANGES, weightRangeFrom, autoShowBodyWeight } from "@/lib/statsSettings";
import { completeDayAverage } from "@/lib/nutritionExperience";

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
  const [tab, setTabState] = useState<Tab>(() => { try { return (sessionStorage.getItem("grim_nutrition_insights_tab") as Tab) || "week"; } catch { return "week"; } });
  const setTab = (t: Tab) => { setTabState(t); try { sessionStorage.setItem("grim_nutrition_insights_tab", t); } catch { /* ignore */ } };
  const [logs, setLogs] = useState<Log[]>([]);
  const [completeDays, setCompleteDays] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<{ log_date: string; weight_kg: number }[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [weightView, setWeightView] = useState<"graph" | "table">("graph");
  const { weightDays, setWeightDays } = useStatsSettings();

  const selected = parseKey(dateKey);
  const monday = mondayOf(selected);
  const from = toLocalDateKey(addDays(selected, -29) < monday ? addDays(selected, -29) : monday);
  const to = toLocalDateKey(addDays(monday, 6) > selected ? addDays(monday, 6) : selected);

  const loadWeights = () => {
    const wFrom = weightRangeFrom(weightDays, selected);
    let q = supabase.from("body_weight_logs").select("log_date,weight_kg").eq("user_id", userId).lte("log_date", dateKey);
    if (wFrom) q = q.gte("log_date", wFrom);
    return q.order("log_date").then(({ data }) => {
      const list = (data || []).map((w) => ({ log_date: w.log_date, weight_kg: Number(w.weight_kg) }));
      setWeights(list);
      autoShowBodyWeight(list.length);
    });
  };

  useEffect(() => {
    const loadComplete = () => supabase.from("nutrition_complete_days").select("log_date").eq("user_id", userId).gte("log_date", from).lte("log_date", to).then(({ data }) => setCompleteDays(new Set((data || []).map((d) => d.log_date))));
    void loadComplete();
    window.addEventListener("grim:nutrition-completion-changed", loadComplete);
    supabase.from("meal_logs").select("log_date,item_name,amount,unit,kcal,protein_g,fat_g,carbs_g")
      .eq("user_id", userId).gte("log_date", from).lte("log_date", to).limit(5000)
      .then(({ data }) => setLogs(((data || []) as Log[]).filter((l) => isPlausibleMealLog(l))));
    loadWeights();
    window.addEventListener(WEIGHT_CHANGED_EVENT, loadWeights);
    return () => { window.removeEventListener(WEIGHT_CHANGED_EVENT, loadWeights); window.removeEventListener("grim:nutrition-completion-changed", loadComplete); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, from, to, refreshKey, weightDays]);

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
    return { key: k, label: d.toLocaleDateString("sv-SE", { weekday: "short" }).replace(".", ""), kcal: v ? Math.round(v.kcal) : 0, protein: v ? Math.round(v.protein) : 0, fat: v ? Math.round(v.fat) : 0, carbs: v ? Math.round(v.carbs) : 0, logged: !!v, complete: completeDays.has(k) };
  }), [byDay, completeDays, monday.getTime()]);

  // ---- Prognos ----
  const forecast = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    const past = week.filter((d) => d.key <= todayKey);
    const logged = past.filter((d) => d.complete);
    const sum = logged.reduce((s, d) => s + d.kcal, 0);
    const avg = logged.length ? sum / logged.length : 0;
    // Prognosen bygger bara på loggade dagar: alla ologgade dagar (även passerade) räknas med snittet, aldrig som 0.
    const remaining = 7 - logged.length;
    const projected = sum + avg * remaining;
    const goal = targets.kcal * 7;
    // När når man veckans kcal-budget med nuvarande snitt?
    let reachDay: number | null = null;
    if (avg > 0) {
      let acc = 0;
      for (let i = 0; i < 7; i++) { const d = week[i]; acc += d.key <= todayKey && d.complete ? d.kcal : avg; if (acc >= goal) { reachDay = i; break; } }
    }
    const proteinDays = logged.filter((d) => d.protein >= targets.protein_g * 0.9).length;
    const proteinRate = logged.length ? proteinDays / logged.length : 0;
    return { logged: logged.length, avg, projected, goal, reachDay, proteinDays, proteinProjected: Math.round(proteinDays + proteinRate * remaining) };
  }, [week, targets]);

  // ---- Vikt ----
  const weightPts = useMemo(() => weights.map((w) => ({
    label: parseKey(w.log_date).toLocaleDateString("sv-SE", { day: "numeric", month: "numeric" }), weight: w.weight_kg,
  })), [weights]);
  const weightTrend = useMemo(() => {
    // Kräver minst 5 vägningar över minst 7 dagar – färre ger en missvisande prognos.
    if (weights.length < 5) return null;
    const spanDays = (parseKey(weights[weights.length - 1].log_date).getTime() - parseKey(weights[0].log_date).getTime()) / 864e5;
    if (spanDays < 7) return null;
    const t0 = parseKey(weights[0].log_date).getTime();
    const xs = weights.map((w) => (parseKey(w.log_date).getTime() - t0) / 864e5); const ys = weights.map((w) => w.weight_kg);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0); if (!den) return null;
    return (xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den) * 7;
  }, [weights]);
  const todayWeight = weights.find((w) => w.log_date === dateKey)?.weight_kg;
  const ws = weights.map((w) => w.weight_kg);
  const weightSpanDays = weights.length < 2 ? 0
    : Math.max(1, Math.round((parseKey(weights[weights.length - 1].log_date).getTime() - parseKey(weights[0].log_date).getTime()) / 864e5));

  const saveWeight = async () => {
    const v = validateNumber(weightInput, "bodyWeightKg");
    if (v.error || v.value == null) { toast({ title: "Ogiltig vikt", description: v.error || "Ange en vikt", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("body_weight_logs").upsert({ user_id: userId, log_date: dateKey, weight_kg: parseDecimal(weightInput) }, { onConflict: "user_id,log_date" });
    setSaving(false);
    if (error) { toast({ title: "Kunde inte spara vikten", description: error.message, variant: "destructive" }); return; }
    if (dateKey === toLocalDateKey(new Date())) await supabase.from("profiles").update({ weight_kg: parseDecimal(weightInput) } as any).eq("user_id", userId);
    window.dispatchEvent(new Event(WEIGHT_CHANGED_EVENT));
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
            <span className="font-bold text-foreground tabular-nums">{completeDayAverage(week) == null ? "–" : fmt(completeDayAverage(week) ?? 0)} kcal</span> · Mål {fmt(targets.kcal)}
          </p>
          <p className="text-[11px] text-muted-foreground">{week.filter((d) => d.complete).length} av 7 dagar färdigregistrerade · snittet använder endast dessa dagar.</p>
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
              const d = week.filter((x) => x.complete); const avg = d.length ? d.reduce((s, x) => s + x[k], 0) / d.length : null;
              return (
                <div key={k} className="rounded-xl bg-muted/50 py-2">
                  <p className="text-[10px] text-muted-foreground">{label} snitt</p>
                  <p className="text-sm font-bold tabular-nums">{avg == null ? "–" : fmt(avg)} g</p>
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
            <p className="text-xs text-muted-foreground">Markera minst en dag den här veckan som färdigregistrerad för att visa prognosen.</p>
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
                <p className="text-sm">Nått {forecast.proteinDays} av {forecast.logged} färdigregistrerade dagar – i den takten <span className="font-bold">{forecast.proteinProjected} av 7</span> dagar.</p>
              </div>
              {weightTrend != null && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Vikttrend</p>
                  <p className="text-sm">{weightTrend > 0 ? "+" : ""}{weightTrend.toFixed(2).replace(".", ",")} kg/vecka enligt dina vägningar.</p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Prognosen bygger bara på färdigregistrerade dagar.</p>
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
            <p className="text-xs text-muted-foreground">Väg dig och spara vikten här, så visas den i grafen.</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Senast <span className="font-bold text-foreground">{String(ws[ws.length - 1]).replace(".", ",")} kg</span>
              {ws.length > 1 && <> · {ws[ws.length - 1] - ws[0] > 0 ? "+" : ""}{(ws[ws.length - 1] - ws[0]).toFixed(1).replace(".", ",")} kg på {weightSpanDays} {weightSpanDays === 1 ? "dag" : "dagar"}</>}
            </p>
          )}
          <div className="grid grid-cols-4 gap-1 rounded-full bg-muted/60 p-1">
            {WEIGHT_RANGES.map((x) => (
              <button key={x.days} type="button" onClick={() => setWeightDays(x.days)}
                className={`py-1 px-1 text-[10px] leading-tight font-semibold rounded-full ${weightDays === x.days ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-full bg-muted/60 p-1 w-fit ml-auto">
            <button type="button" onClick={() => setWeightView("graph")} aria-pressed={weightView === "graph"}
              className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full ${weightView === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <LineChart className="w-3 h-3" /> Graf
            </button>
            <button type="button" onClick={() => setWeightView("table")} aria-pressed={weightView === "table"}
              className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-full ${weightView === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <List className="w-3 h-3" /> Tabell
            </button>
          </div>
          {weightView === "graph" ? (
            <>
          {ws.length > 0 && (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weightPts} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={20} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [`${String(v).replace(".", ",")} kg`, "Vikt"]} />
                <Line dataKey="weight" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          )}
          <p className="text-[10px] text-muted-foreground">Målvikt och intagna kalorier finns nu under Statistik.</p>
            </>
          ) : (
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <div className="grid grid-cols-2 gap-2 px-3 py-2 bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                <span>Datum</span>
                <span className="text-right">Vikt</span>
              </div>
              <ul className="max-h-56 overflow-y-auto divide-y divide-border/40">
                {[...weights].reverse().map((w) => (
                  <li key={w.log_date} className="grid grid-cols-2 gap-2 px-3 py-2 text-sm">
                    <span>{parseKey(w.log_date).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className="text-right font-semibold tabular-nums">{String(w.weight_kg).replace(".", ",")} kg</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
