import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Droplet, Minus, Plus } from "lucide-react";

interface Props { userId: string; dateKey: string; goalMl: number }

const STEP_ML = 250; // ett glas

/** Enkel vattenräknare per dag, sparas i water_logs. */
export default function WaterTracker({ userId, dateKey, goalMl }: Props) {
  const [ml, setMl] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("log_date", dateKey).maybeSingle()
      .then(({ data }) => { if (!cancelled) setMl(data?.amount_ml ?? 0); });
    return () => { cancelled = true; };
  }, [userId, dateKey]);

  function change(delta: number) {
    setMl((prev) => {
      const next = Math.max(0, prev + delta);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        supabase.from("water_logs").upsert(
          { user_id: userId, log_date: dateKey, amount_ml: next, updated_at: new Date().toISOString() },
          { onConflict: "user_id,log_date" },
        ).then(({ error }) => { if (error) console.error("water save failed", error); });
      }, 800);
      return next;
    });
  }

  const goal = goalMl > 0 ? goalMl : 2000;
  const glasses = Math.ceil(goal / STEP_ML);
  const filled = Math.floor(ml / STEP_ML);
  const pct = Math.min(100, (ml / goal) * 100);

  return (
    <div className="rounded-2xl bg-card shadow-soft border border-border/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold font-serif flex items-center gap-1.5"><Droplet className="w-4 h-4 text-primary" /> Vatten</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{(ml / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} / {(goal / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} l · {filled} glas</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => change(-STEP_ML)} disabled={ml === 0} className="w-9 h-9 icon-round bg-secondary hover:bg-muted transition-colors disabled:opacity-40" aria-label="Ta bort ett glas"><Minus className="w-4 h-4" /></button>
          <button onClick={() => change(STEP_ML)} className="w-9 h-9 icon-round bg-primary text-primary-foreground shadow-soft hover:opacity-90" aria-label="Lägg till ett glas"><Plus className="w-4 h-4" /></button>
        </div>
      </div>
      {glasses <= 12 ? (
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: glasses }).map((_, i) => (
            <Droplet key={i} className={`w-4 h-4 transition-colors ${i < filled ? "text-primary fill-primary" : "text-muted-foreground/40"}`} />
          ))}
        </div>
      ) : (
        <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
