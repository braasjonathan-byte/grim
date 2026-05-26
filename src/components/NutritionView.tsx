import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, Target, BookOpen, Trash2, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import MacroRings from "./MacroRings";
import FoodPickerDialog, { PickedItem } from "./FoodPickerDialog";
import RecipeEditor from "./RecipeEditor";
import NutritionGoalsDialog from "./NutritionGoalsDialog";
import { toLocalDateKey } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

interface Props { userId: string }

const DEFAULT_SLOTS = ["frukost", "lunch", "middag", "mellanmål"];

interface MealLog {
  id: string;
  meal_type: string;
  item_name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

const DEFAULT_TARGETS = { kcal: 2000, protein_g: 100, fat_g: 70, carbs_g: 250 };

export default function NutritionView({ userId }: Props) {
  const [date, setDate] = useState(() => new Date());
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [picker, setPicker] = useState<string | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const { toast } = useToast();

  const dateKey = toLocalDateKey(date);

  async function load() {
    const [logsR, goalsR] = await Promise.all([
      supabase.from("meal_logs").select("*").eq("user_id", userId).eq("log_date", dateKey).order("created_at"),
      supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    setLogs((logsR.data as MealLog[]) || []);
    if (goalsR.data) {
      setTargets({ kcal: goalsR.data.daily_kcal, protein_g: goalsR.data.protein_g, fat_g: goalsR.data.fat_g, carbs_g: goalsR.data.carbs_g });
      const ms = (goalsR.data as any).meal_slots as string[] | null;
      if (ms && ms.length) setSlots(ms);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId, dateKey]);

  // Include any extra meal_types found in logs that aren't in slots (legacy data)
  const allSlots = useMemo(() => {
    const extras = Array.from(new Set(logs.map((l) => l.meal_type))).filter((m) => !slots.includes(m));
    return [...slots, ...extras];
  }, [slots, logs]);

  const totals = useMemo(() => ({
    kcal: logs.reduce((s, l) => s + Number(l.kcal), 0),
    protein: logs.reduce((s, l) => s + Number(l.protein_g), 0),
    fat: logs.reduce((s, l) => s + Number(l.fat_g), 0),
    carbs: logs.reduce((s, l) => s + Number(l.carbs_g), 0),
  }), [logs]);

  async function persistSlots(next: string[]) {
    setSlots(next);
    const { error } = await supabase.from("nutrition_goals").upsert(
      { user_id: userId, meal_slots: next } as any,
      { onConflict: "user_id" }
    );
    if (error) toast({ title: "Kunde inte spara måltider", description: error.message, variant: "destructive" });
  }

  function addMealSlot() {
    const name = window.prompt("Namn på måltid (t.ex. kvällsmål, pre-workout)")?.trim().toLowerCase();
    if (!name) return;
    if (allSlots.includes(name)) { toast({ title: "Måltiden finns redan" }); return; }
    persistSlots([...slots, name]);
  }

  function renameSlot(idx: number) {
    const current = slots[idx];
    const name = window.prompt("Nytt namn", current)?.trim().toLowerCase();
    if (!name || name === current) return;
    const next = [...slots];
    next[idx] = name;
    persistSlots(next);
    // Rename existing logs for the day in DB so they keep showing under the renamed slot
    supabase.from("meal_logs").update({ meal_type: name }).eq("user_id", userId).eq("meal_type", current).then(() => load());
  }

  function moveSlot(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= slots.length) return;
    const next = [...slots];
    [next[idx], next[j]] = [next[j], next[idx]];
    persistSlots(next);
  }

  function deleteSlot(idx: number) {
    const name = slots[idx];
    const hasLogs = logs.some((l) => l.meal_type === name);
    if (hasLogs && !window.confirm(`Ta bort "${name}"? Alla loggade livsmedel under denna måltid tas också bort.`)) return;
    if (!hasLogs && !window.confirm(`Ta bort "${name}"?`)) return;
    persistSlots(slots.filter((_, i) => i !== idx));
    if (hasLogs) {
      supabase.from("meal_logs").delete().eq("user_id", userId).eq("meal_type", name).then(() => load());
    }
  }

  async function addLog(meal: string, item: PickedItem) {
    const { error } = await supabase.from("meal_logs").insert({
      user_id: userId, log_date: dateKey, meal_type: meal, item_name: item.name,
      amount: item.amount, unit: item.unit,
      kcal: item.kcal, protein_g: item.protein_g, fat_g: item.fat_g, carbs_g: item.carbs_g,
      food_id: item.source === "food" ? item.id : null,
      custom_food_id: item.source === "custom_food" ? item.id : null,
      recipe_id: item.source === "recipe" ? item.id : null,
    });
    if (error) toast({ title: "Fel", description: error.message, variant: "destructive" });
    else { setPicker(null); load(); }
  }

  async function removeLog(id: string) {
    await supabase.from("meal_logs").delete().eq("id", id);
    load();
  }

  function shiftDay(n: number) {
    const d = new Date(date); d.setDate(d.getDate() + n); setDate(d);
  }

  const isToday = dateKey === toLocalDateKey(new Date());
  const dateLabel = date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      {/* Header bar with date nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDay(-1)} className="p-2 hover:bg-accent"><ChevronLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <p className="font-serif text-lg capitalize">{dateLabel}</p>
          {!isToday && <button onClick={() => setDate(new Date())} className="text-[10px] text-primary font-bold">Gå till idag</button>}
        </div>
        <button onClick={() => shiftDay(1)} className="p-2 hover:bg-accent"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Day card */}
      <div className="border border-border bg-card p-4 space-y-4">
        <MacroRings kcal={totals.kcal} protein={totals.protein} fat={totals.fat} carbs={totals.carbs} targets={targets} />

        <div className="flex gap-2">
          <button onClick={() => setGoalsOpen(true)} className="flex-1 flex items-center justify-center gap-1 py-2 border border-input text-xs font-bold">
            <Target className="w-3 h-3" /> Mål
          </button>
          <button onClick={() => setRecipeOpen(true)} className="flex-1 flex items-center justify-center gap-1 py-2 border border-input text-xs font-bold">
            <BookOpen className="w-3 h-3" /> Nytt recept
          </button>
        </div>

        {/* Meals */}
        <div className="space-y-3">
          {allSlots.map((meal, idx) => {
            const isCustom = idx < slots.length; // controllable slot (extras are legacy and not reorderable)
            const ml = logs.filter((l) => l.meal_type === meal);
            const mealKcal = ml.reduce((s, l) => s + Number(l.kcal), 0);
            return (
              <div key={meal} className="border border-border">
                <div className="flex items-center justify-between bg-muted/40 px-3 py-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold capitalize font-serif truncate">{meal}</p>
                    <p className="text-[10px] text-muted-foreground">{Math.round(mealKcal)} kcal</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isCustom && (
                      <>
                        <button onClick={() => moveSlot(idx, -1)} disabled={idx === 0} className="p-1 disabled:opacity-30" aria-label="Flytta upp"><ArrowUp className="w-3 h-3" /></button>
                        <button onClick={() => moveSlot(idx, 1)} disabled={idx === slots.length - 1} className="p-1 disabled:opacity-30" aria-label="Flytta ner"><ArrowDown className="w-3 h-3" /></button>
                        <button onClick={() => renameSlot(idx)} className="p-1" aria-label="Byt namn"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => deleteSlot(idx)} className="p-1 text-destructive" aria-label="Ta bort"><Trash2 className="w-3 h-3" /></button>
                      </>
                    )}
                    <button onClick={() => setPicker(meal)} className="flex items-center gap-1 text-xs font-bold text-primary ml-1">
                      <Plus className="w-3 h-3" /> Lägg till
                    </button>
                  </div>
                </div>
                {ml.length > 0 && (
                  <ul className="divide-y divide-border">
                    {ml.map((l) => (
                      <li key={l.id} className="flex items-center justify-between px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{l.item_name}</p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {l.amount} {l.unit} · {Math.round(Number(l.kcal))} kcal · P{Number(l.protein_g).toFixed(0)} F{Number(l.fat_g).toFixed(0)} K{Number(l.carbs_g).toFixed(0)}
                          </p>
                        </div>
                        <button onClick={() => removeLog(l.id)} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <button onClick={addMealSlot} className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-input text-xs font-bold">
            <Plus className="w-3 h-3" /> Lägg till måltid
          </button>
        </div>
      </div>

      <FoodPickerDialog open={!!picker} onOpenChange={(v) => !v && setPicker(null)} userId={userId} onPick={(item) => picker && addLog(picker, item)} />
      <RecipeEditor open={recipeOpen} onOpenChange={setRecipeOpen} userId={userId} onSaved={load} />
      <NutritionGoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} userId={userId} onSaved={load} />
    </div>
  );
}
