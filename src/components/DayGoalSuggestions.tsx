import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PickedItem } from "./FoodPickerDialog";
import { buildDayGoalSuggestions, suggestionTotals, type GoalNutrition } from "@/lib/dayGoalSuggestions";
import { loadDayGoalFoods, saveDayGoalSuggestion } from "@/lib/dayGoalFoods";
import { showUndoToast } from "@/lib/undoToast";
import { supabase } from "@/integrations/supabase/client";

interface Props { userId: string; dateKey: string; remaining: GoalNutrition; slots: string[]; hasGoals: boolean; onSaved: () => void; shortcuts?: ReactNode }

export default function DayGoalSuggestions({ userId, dateKey, remaining, slots, hasGoals, onSaved, shortcuts }: Props) {
  const [open, setOpen] = useState(false);
  const [foods, setFoods] = useState<PickedItem[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [meal, setMeal] = useState(() => slots.find(slot => /kväll|mellan/i.test(slot)) ?? slots[slots.length - 1] ?? "");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); setError(""); setFoods([]); setExcluded(new Set());
    loadDayGoalFoods(userId, dateKey).then(items => { if (!cancelled) setFoods(items); })
      .catch(() => { if (!cancelled) setError("Matunderlaget kunde inte hämtas. Försök igen."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, userId, dateKey, retry]);
  const suggestions = useMemo(() => buildDayGoalSuggestions(foods.filter(item => !excluded.has(`${item.source}:${item.id}`)), remaining), [foods, excluded, remaining]);
  const destination = slots.includes(meal) ? meal : slots[slots.length - 1] ?? "";
  async function save(items: PickedItem[]) {
    if (lock.current || !destination) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const ids = await saveDayGoalSuggestion(userId, dateKey, destination, items);
      onSaved(); setOpen(false);
      showUndoToast(`Loggade ${items.length} livsmedel i ${destination}`, async () => {
        const result = await supabase.from("meal_logs").delete().eq("user_id", userId).in("id", ids);
        if (result.error) throw result.error;
        onSaved();
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Förslaget kunde inte sparas."); }
    finally { lock.current = false; setSaving(false); }
  }
  return <section className="space-y-3 border-t border-border py-3" aria-label="Rädda dagsmålet">
    <div className={shortcuts ? "grid grid-cols-2 gap-2" : ""}>
      <Button variant="outline" className="w-full h-auto min-h-12 rounded-lg px-3 justify-start gap-2 whitespace-normal text-left text-xs" aria-expanded={open} onClick={() => setOpen(value => !value)} disabled={saving}>
        <Sparkles className="h-4 w-4 shrink-0" /><span className="flex-1">Rädda dagsmålet</span><ChevronDown className="h-4 w-4 shrink-0" />
      </Button>
      {shortcuts}
    </div>
    {open && <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{Math.round(Math.max(0, remaining.kcal))} kcal och {Math.round(Math.max(0, remaining.protein_g))} g protein kvar av {hasGoals ? "ditt mål" : "standardmålet"}. Näringsvärden är ungefärliga, inte ett krav att äta mer.</p>
      {remaining.kcal <= 0 ? <p className="text-sm">Kalorimålet är uppnått. Inga extra matförslag för att fylla målet.</p> : <>
        <Select value={destination} onValueChange={setMeal} disabled={saving}><SelectTrigger aria-label="Måltid för förslaget"><SelectValue /></SelectTrigger><SelectContent>{slots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}</SelectContent></Select>
        {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Hämtar matförslag…</p>}
        {error && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p>{!foods.length && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>Försök igen</Button>}</div>}
        {!loading && !error && !suggestions.length && <p className="text-sm text-muted-foreground">Inget förslag passar kalorierna som är kvar.</p>}
        {suggestions.map((items, index) => {
          const total = suggestionTotals(items);
          return <article key={items.map(item => item.id).join(":")} className="rounded-lg border border-border p-3 space-y-3">
            <h3 className="text-sm font-bold">Förslag {index + 1}</h3>
            <ul className="space-y-1">{items.map(item => <li key={`${item.source}:${item.id}`} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 break-words">{item.name} · {item.amount} {item.unit}</span><Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`Välj bort ${item.name}`} title={`Välj bort ${item.name}`} disabled={saving} onClick={() => setExcluded(previous => new Set(previous).add(`${item.source}:${item.id}`))}><X className="h-4 w-4" /></Button></li>)}</ul>
            <p className="text-sm tabular-nums">{Math.round(total.kcal)} kcal · {Math.round(total.protein_g)} g protein · {Math.round(total.fat_g)} g fett · {Math.round(total.carbs_g)} g kolhydrater</p>
            <p className="text-xs text-muted-foreground">Efteråt: {Math.round(Math.max(0, remaining.kcal - total.kcal))} kcal och {Math.round(Math.max(0, remaining.protein_g - total.protein_g))} g protein kvar.</p>
            <Button className="w-full min-h-11" disabled={saving || !destination} onClick={() => void save(items)}>{saving ? "Sparar…" : "Logga förslag"}</Button>
          </article>;
        })}
        {excluded.size > 0 && <Button variant="ghost" disabled={saving} onClick={() => setExcluded(new Set())}>Återställ bortval</Button>}
      </>}
    </div>}
  </section>;
}