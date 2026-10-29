import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Flame } from "lucide-react";
import { toLocalDateKey } from "@/lib/dateUtils";
import { isPlausibleMealLog } from "@/lib/inputValidation";

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmt = (n: number) => Math.round(n).toLocaleString("sv-SE");

/** «Intagna kalorier» – senaste 30 dagarna, flyttad från Kost → Vikt till Statistik. */
export default function CalorieIntakeChart({ userId }: { userId: string }) {
  const [byDay, setByDay] = useState<Map<string, number>>(new Map());
  const [target, setTarget] = useState<number | null>(null);
  const today = new Date();
  const from = toLocalDateKey(addDays(today, -29));

  useEffect(() => {
    supabase.from("meal_logs").select("log_date,item_name,amount,unit,kcal,protein_g,fat_g,carbs_g")
      .eq("user_id", userId).gte("log_date", from).limit(5000)
      .then(({ data }) => {
        const m = new Map<string, number>();
        for (const l of (data || []) as any[]) { if (!isPlausibleMealLog(l)) continue; m.set(l.log_date, (m.get(l.log_date) || 0) + (Number(l.kcal) || 0)); }
        setByDay(m);
      });
    supabase.from("nutrition_goals").select("daily_kcal").eq("user_id", userId).maybeSingle()
      .then(({ data }) => setTarget(data?.daily_kcal ? Number(data.daily_kcal) : null));
  }, [userId, from]);

  const data = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i - 29); const k = toLocalDateKey(d);
    return { label: d.toLocaleDateString("sv-SE", { day: "numeric", month: "numeric" }), kcal: byDay.has(k) ? Math.round(byDay.get(k)!) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [byDay, from]);
  const logged = data.filter((d) => d.kcal != null) as { kcal: number }[];
  const avg = logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : 0;

  return (
    <div className="rounded-2xl p-3 bg-card shadow-soft space-y-2">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Intagna kalorier</p>
        <span className="ml-auto text-xs text-muted-foreground">30 dagar</span>
      </div>
      {logged.length === 0 ? (
        <p className="text-xs text-muted-foreground">Logga din mat under Kost så visas ditt intag här.</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">Snitt <span className="font-bold text-foreground tabular-nums">{fmt(avg)} kcal</span> på {logged.length} loggade dagar{target ? ` · Mål ${fmt(target)}` : ""}</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={6} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [`${fmt(v)} kcal`, "Intag"]} />
                {target && <ReferenceLine y={target} stroke="hsl(var(--primary))" strokeDasharray="4 4" />}
                <Bar dataKey="kcal" fill="hsl(var(--primary) / 0.6)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
