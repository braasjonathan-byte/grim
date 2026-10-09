import { Fragment, useEffect, useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { parseNum } from "@/lib/inputValidation";
import { computeStrengthStats, dotsScore, LIFT_LABELS, type MainLift, type StrengthCompletion } from "@/lib/strengthStats";

const LIFTS: MainLift[] = ["squat", "bench", "deadlift"];
const COLORS: Record<MainLift, string> = { squat: "hsl(var(--primary))", bench: "hsl(var(--success))", deadlift: "hsl(var(--warning))" };
const kg = (v: number) => `${Math.round(v)} kg`;
const ton = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")} t` : `${Math.round(v)} kg`);

const StrengthSection = ({ userId, completions }: { userId: string; completions: StrengthCompletion[] }) => {
  const [body, setBody] = useState<{ weight: number; gender: string }>({ weight: 0, gender: "" });
  useEffect(() => {
    supabase.from("profiles").select("weight_kg, gender").eq("user_id", userId).maybeSingle().then(({ data }) => {
      setBody({ weight: parseNum((data as any)?.weight_kg) || 0, gender: (data as any)?.gender || "" });
    });
  }, [userId]);

  const stats = useMemo(() => computeStrengthStats(completions), [completions]);
  const hasAny = LIFTS.some((l) => stats.best[l]);
  const dots = dotsScore(stats.sbdTotal, body.weight, body.gender);
  const chartData = stats.weeks.slice(-12).map((w) => ({
    week: w.weekStart.slice(5).replace("-", "/"),
    ...Object.fromEntries(LIFTS.map((l) => [l, w.e1rm[l] ? Math.round(w.e1rm[l]!) : null])),
  }));
  const tonnageWeeks = stats.weeks.slice(-6).reverse();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 icon-round bg-primary/15"><Dumbbell className="w-4 h-4 text-primary" /></span>
        <h3 className="text-lg font-bold tracking-tight">Styrka</h3>
      </div>
      {!hasAny ? (
        <div className="rounded-2xl p-4 bg-card shadow-soft border border-border/40 text-sm text-muted-foreground">
          Logga knäböj, bänkpress eller marklyft så visas din styrka här.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl p-3 bg-card shadow-soft border border-border/40">
              <p className="text-[10px] text-muted-foreground">SBD-total</p>
              <p className="text-xl font-black">{kg(stats.sbdTotal)}</p>
              <p className="text-[10px] text-muted-foreground">Tyngsta knäböj + bänk + marklyft</p>
            </div>
            <div className="rounded-2xl p-3 bg-card shadow-soft border border-border/40">
              <p className="text-[10px] text-muted-foreground">DOTS</p>
              {dots ? (
                <p className="text-xl font-black">{dots.toFixed(1).replace(".", ",")}</p>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground mt-1">Fyll i vikt och kön i profilen</p>
              )}
              <p className="text-[10px] text-muted-foreground">Utifrån SBD-total, kroppsvikt och kön</p>
            </div>
          </div>

          <div className="rounded-2xl p-3 bg-card shadow-soft border border-border/40 space-y-2">
            <p className="text-xs font-semibold">Uppskattad 1RM per lyft (Epley)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {LIFTS.map((l) => (
                <div key={l}>
                  <p className="text-[10px] text-muted-foreground">{LIFT_LABELS[l]}</p>
                  <p className="text-base font-black">{stats.bestE1rm[l] ? kg(stats.bestE1rm[l]!) : "–"}</p>
                </div>
              ))}
            </div>
            {chartData.length > 1 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number, n: string) => [`${v} kg`, LIFT_LABELS[n as MainLift]]} />
                    {LIFTS.map((l) => <Line key={l} type="monotone" dataKey={l} stroke={COLORS[l]} strokeWidth={2} dot={false} connectNulls />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">Bästa uppskattade 1RM per vecka, samma formel som 1RM-kalkylatorn.</p>
          </div>

          <div className="rounded-2xl p-3 bg-card shadow-soft border border-border/40 space-y-2">
            <p className="text-xs font-semibold">Tonnage per lyft och vecka</p>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              <span className="text-muted-foreground">Vecka</span>
              {LIFTS.map((l) => <span key={l} className="text-muted-foreground text-right">{LIFT_LABELS[l]}</span>)}
              {tonnageWeeks.map((w) => (
                <Fragment key={w.weekStart}>
                  <span>{w.weekStart.slice(5).replace("-", "/")}</span>
                  {LIFTS.map((l) => <span key={w.weekStart + l} className="text-right font-mono">{w.tonnage[l] ? ton(w.tonnage[l]!) : "–"}</span>)}
                </Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StrengthSection;
