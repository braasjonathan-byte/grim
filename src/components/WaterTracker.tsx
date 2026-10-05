import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Droplet, Plus } from "lucide-react";

interface Props { userId: string; dateKey: string; goalMl: number }

const STEP_ML = 250; // ett glas

/** Vattenglas i rad: tryck på nästa glas för att fylla, tryck på sista fyllda för att ta bort. */
export default function WaterTracker({ userId, dateKey, goalMl }: Props) {
  const [ml, setMl] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("log_date", dateKey).maybeSingle()
      .then(({ data }) => { if (!cancelled) setMl(data?.amount_ml ?? 0); });
    return () => { cancelled = true; };
  }, [userId, dateKey]);

  function setAmount(next: number) {
    next = Math.max(0, next);
    setMl(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase.from("water_logs").upsert(
        { user_id: userId, log_date: dateKey, amount_ml: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,log_date" },
      ).then(({ error }) => { if (error) console.error("water save failed", error); });
    }, 800);
  }

  const goal = goalMl > 0 ? goalMl : 2000;
  const filled = Math.floor(ml / STEP_ML);
  const glasses = Math.max(Math.ceil(goal / STEP_ML), filled + 1);

  return (
    <div className="rounded-2xl bg-card shadow-soft border border-border/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold font-serif flex items-center gap-1.5"><Droplet className="w-4 h-4 text-primary" /> Vatten</p>
          <p className="text-[11px] text-muted-foreground">Mål: {(goal / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} l</p>
        </div>
        <p className="text-sm font-bold tabular-nums">{(ml / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} l</p>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: glasses }).map((_, i) => {
          const isFilled = i < filled;
          const isNext = i === filled;
          return (
            <button
              key={i}
              onClick={() => setAmount(isFilled && i === filled - 1 ? (filled - 1) * STEP_ML : (i + 1) * STEP_ML)}
              aria-label={isFilled ? `Glas ${i + 1} (tryck för att ta bort)` : `Fyll glas ${i + 1}`}
              className={`h-11 rounded-b-xl rounded-t-md flex items-center justify-center transition-all active:scale-90 ${
                isFilled ? "bg-primary/70" : isNext ? "bg-primary/10 border border-dashed border-primary/40" : "bg-muted/50"
              }`}
            >
              {!isFilled && <Plus className={`w-3.5 h-3.5 ${isNext ? "text-primary" : "text-muted-foreground/50"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
