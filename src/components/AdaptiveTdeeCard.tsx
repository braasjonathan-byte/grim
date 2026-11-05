import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDateKey } from "@/lib/dateUtils";
import { TrendingUp, Info, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { showUndoToast } from "@/lib/undoToast";
import {
  ADAPTIVE_APPLIED_KEY, ADAPTIVE_WINDOW_DAYS, adaptiveTarget, computeAdaptiveTdee, type AdaptiveTdeeResult,
} from "@/lib/adaptiveTdee";

interface Props {
  userId: string;
  currentKcal: number;
  hasGoals: boolean;
  onApplied: () => void;
  enabled: boolean;
}

type Applied = { date: string; from: number; to: number };
const CHECKIN_KEY = "grim_tdee_checkin_v1";
export const ADAPTIVE_ENABLED_KEY = "grim_adaptive_tdee_enabled_v1";
export function readAdaptiveEnabled(): boolean { try { return localStorage.getItem(ADAPTIVE_ENABLED_KEY) !== "0"; } catch { return true; } }
export function writeAdaptiveEnabled(v: boolean) { try { localStorage.setItem(ADAPTIVE_ENABLED_KEY, v ? "1" : "0"); } catch { /* ignore */ } }
/** Veckovis incheckning: visas om ≥7 dagar sedan senaste (godkänd eller avböjd). */
export function checkinDue(lastIso: string | null, now = new Date()): boolean {
  if (!lastIso) return true;
  const t = new Date(lastIso).getTime();
  return !Number.isFinite(t) || now.getTime() - t >= 7 * 86400000;
}

/** Adaptiv TDEE: räknar om kcal-målet från vikttrend + faktiskt intag. */
export default function AdaptiveTdeeCard({ userId, currentKcal, hasGoals, onApplied, enabled }: Props) {
  const [res, setRes] = useState<AdaptiveTdeeResult | null>(null);
  const [goal, setGoal] = useState<{ goal_type: string; weekly_loss_kg: number | null; protein_g: number; fat_g: number } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [lastCheckin, setLastCheckin] = useState<string | null>(() => { try { return localStorage.getItem(CHECKIN_KEY); } catch { return null; } });
  const markCheckin = () => { const v = new Date().toISOString(); try { localStorage.setItem(CHECKIN_KEY, v); } catch { /* ignore */ } setLastCheckin(v); };
  const [applied, setApplied] = useState<Applied | null>(() => {
    try { return JSON.parse(localStorage.getItem(ADAPTIVE_APPLIED_KEY) || "null"); } catch { return null; }
  });

  useEffect(() => {
    let cancelled = false;
    if (!enabled) return;
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - ADAPTIVE_WINDOW_DAYS);
      const sinceKey = toLocalDateKey(since);
      const todayKey = toLocalDateKey(new Date());
      const [w, m, g] = await Promise.all([
        supabase.from("body_weight_logs").select("log_date, weight_kg").eq("user_id", userId).gte("log_date", sinceKey).order("log_date"),
        supabase.from("meal_logs").select("log_date, kcal").eq("user_id", userId).gte("log_date", sinceKey).lt("log_date", todayKey).limit(5000),
        supabase.from("nutrition_goals").select("goal_type, weekly_loss_kg, protein_g, fat_g").eq("user_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      const intake: Record<string, number> = {};
      for (const r of m.data || []) intake[r.log_date] = (intake[r.log_date] || 0) + Number(r.kcal || 0);
      setRes(computeAdaptiveTdee((w.data || []).map((r) => ({ date: r.log_date, kg: Number(r.weight_kg) })), intake));
      setGoal(g.data as any);
    })();
    return () => { cancelled = true; };
  }, [userId, currentKcal, enabled]);

  if (!hasGoals || (enabled && !res)) return null;

  const suggested = enabled && res?.ok && res.tdee ? adaptiveTarget(res.tdee, goal?.goal_type || "maintain", goal?.weekly_loss_kg) : null;
  const diff = suggested != null ? suggested - currentKcal : 0;
  const worthIt = suggested != null && Math.abs(diff) >= 100;

  async function apply() {
    if (suggested == null || !goal) return;
    markCheckin();
    const from = currentKcal;
    const protein_g = goal.protein_g;
    const fat_g = Math.round((suggested * 0.28) / 9);
    const carbs_g = Math.max(0, Math.round((suggested - protein_g * 4 - fat_g * 9) / 4));
    const { error } = await supabase.from("nutrition_goals").update({ daily_kcal: suggested, fat_g, carbs_g }).eq("user_id", userId);
    if (error) { toast({ title: "Kunde inte uppdatera målet", description: error.message, variant: "destructive" }); return; }
    const a = { date: toLocalDateKey(new Date()), from, to: suggested };
    localStorage.setItem(ADAPTIVE_APPLIED_KEY, JSON.stringify(a));
    setApplied(a);
    onApplied();
    showUndoToast(`Nytt kcal-mål: ${suggested} kcal`, async () => {
      await supabase.from("nutrition_goals").update({ daily_kcal: from, fat_g: goal.fat_g, carbs_g: Math.max(0, Math.round((from - protein_g * 4 - goal.fat_g * 9) / 4)) }).eq("user_id", userId);
      localStorage.removeItem(ADAPTIVE_APPLIED_KEY);
      setApplied(null);
      onApplied();
    });
  }

  return (
    <div className="rounded-2xl bg-card shadow-soft border border-border/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Adaptiv förbrukning</p>
        <button onClick={() => setShowInfo((v) => !v)} aria-label="Hur fungerar det?" className="ml-auto text-muted-foreground"><Info className="w-3.5 h-3.5" /></button>
      </div>
      {showInfo && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Vi jämför vad du faktiskt ätit de senaste {ADAPTIVE_WINDOW_DAYS} dagarna med hur din vikttrend rört sig.
          Ett kilo kroppsvikt ≈ 7 700 kcal, så: <b>förbrukning ≈ snittintag − viktförändring × 7 700</b>.
          Dagar under 800 kcal räknas som ofullständigt loggade och hoppas över. Ju mer du loggar och väger dig, desto säkrare.
        </p>
      )}
      {showInfo && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          <b>På:</b> vi räknar ut din verkliga förbrukning och föreslår veckovis justering av kcal-målet (du godkänner alltid själv). <b>Av:</b> ditt kcal-mål ligger fast som du satt det – inga beräkningar eller förslag.
        </p>
      )}
      {!enabled || !res ? (
        <p className="text-[11px] text-muted-foreground">Av (ändra under Mer) – ditt kcal-mål ({currentKcal} kcal) används som det är, utan adaptiv justering.</p>
      ) : !res.ok ? (
        <p className="text-[11px] text-muted-foreground">{res.reason} – sedan räknar vi ut din verkliga förbrukning.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-base font-bold tabular-nums">{res.tdee}</p><p className="text-[10px] text-muted-foreground">Förbrukning/dag</p></div>
            <div><p className="text-base font-bold tabular-nums">{res.avgIntake}</p><p className="text-[10px] text-muted-foreground">Snittintag</p></div>
            <div><p className="text-base font-bold tabular-nums">{res.kgPerWeek! > 0 ? "+" : ""}{res.kgPerWeek?.toFixed(2)}</p><p className="text-[10px] text-muted-foreground">kg/vecka</p></div>
          </div>
          {applied && applied.to === currentKcal ? (
            <p className="text-[11px] text-success flex items-center gap-1"><Check className="w-3 h-3" /> Målet justerades {new Date(applied.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}: {applied.from} → {applied.to} kcal</p>
          ) : null}
          {worthIt && checkinDue(lastCheckin) && (
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-2.5 space-y-1.5">
              <p className="text-[11px] font-bold">Veckans incheckning</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Du har ätit i snitt <b>{res.avgIntake} kcal</b> och vikten har gått {res.kgPerWeek! > 0 ? "upp" : "ned"} <b>{Math.abs(res.kgPerWeek!).toFixed(2)} kg/vecka</b>.
                Det betyder att du förbrukar ca <b>{res.tdee} kcal/dag</b>. För ditt mål föreslår vi <b>{suggested} kcal</b> ({diff > 0 ? "+" : ""}{diff} mot nu).
              </p>
              <div className="flex gap-2">
                <button onClick={apply} className="flex-1 pill-btn bg-primary text-primary-foreground py-1.5 text-xs font-semibold">Uppdatera till {suggested}</button>
                <button onClick={markCheckin} className="flex-1 pill-btn bg-secondary py-1.5 text-xs font-semibold">Behåll {currentKcal}</button>
              </div>
            </div>
          )}
          {worthIt ? (
            <button onClick={apply} className="w-full pill-btn bg-primary text-primary-foreground py-2 text-xs font-semibold">
              Justera mål {currentKcal} → {suggested} kcal ({diff > 0 ? "+" : ""}{diff})
            </button>
          ) : (
            <p className="text-[11px] text-muted-foreground">Ditt mål ({currentKcal} kcal) stämmer med din faktiska förbrukning.</p>
          )}
        </>
      )}
    </div>
  );
}
