import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Plus, RotateCcw } from "lucide-react";
import type { PickedItem } from "./FoodPickerDialog";

/** Map clock time to a default meal slot (Lifesum-style). */
export function slotForNow(d = new Date()): string {
  const h = d.getHours();
  if (h >= 4 && h < 10) return "frukost";
  if (h >= 10 && h < 14) return "lunch";
  if (h >= 17 && h < 21) return "middag";
  return "mellanmål";
}

type Log = { item_name: string; amount: number; unit: string; kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number | null; food_id: string | null; custom_food_id: string | null; recipe_id: string | null; meal_type: string; log_date: string; created_at: string; sugar_g: number | null; nova_group: number | null };

function toPicked(l: Log): PickedItem {
  const source: PickedItem["source"] = l.recipe_id ? "recipe" : l.food_id ? "food" : "custom_food";
  return {
    source, id: l.recipe_id || l.food_id || l.custom_food_id || `hist-${l.item_name}`,
    name: l.item_name, amount: Number(l.amount), unit: l.unit,
    kcal: Number(l.kcal), protein_g: Number(l.protein_g), fat_g: Number(l.fat_g), carbs_g: Number(l.carbs_g),
    fiber_g: Number(l.fiber_g || 0), sugar_g: l.sugar_g, nova_group: l.nova_group,
  };
}

interface Props {
  userId: string;
  meal?: string | null;
  onPick: (item: PickedItem) => void;
  onPickMany: (items: PickedItem[]) => void;
}

/** One-tap suggestions for the current meal, based on the user's own history at that meal. */
export default function MealSuggestions({ userId, meal, onPick, onPickMany }: Props) {
  const slot = (meal || slotForNow()).toLowerCase();
  const [items, setItems] = useState<{ p: PickedItem; n: number }[]>([]);
  const [lastMeal, setLastMeal] = useState<{ date: string; items: PickedItem[] } | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      const { data } = await supabase.from("meal_logs")
        .select("item_name,amount,unit,kcal,protein_g,fat_g,carbs_g,fiber_g,food_id,custom_food_id,recipe_id,meal_type,log_date,created_at,sugar_g,nova_group")
        .eq("user_id", userId).gte("log_date", since)
        .order("created_at", { ascending: false }).limit(800);
      if (cancelled || !data) return;
      const rows = (data as Log[]).filter((l) => (l.meal_type || "").toLowerCase() === slot);
      const groups = new Map<string, { p: PickedItem; n: number }>();
      for (const l of rows) {
        const k = l.item_name.trim().toLowerCase();
        const g = groups.get(k);
        if (g) g.n++; else groups.set(k, { p: toPicked(l), n: 1 });
      }
      setItems([...groups.values()].sort((a, b) => b.n - a.n).slice(0, 8));
      const today = new Date().toISOString().slice(0, 10);
      const prevDate = rows.find((r) => r.log_date < today)?.log_date;
      const prev = prevDate ? rows.filter((r) => r.log_date === prevDate) : [];
      setLastMeal(prev.length > 1 ? { date: prevDate!, items: prev.map(toPicked) } : null);
    })();
    return () => { cancelled = true; };
  }, [userId, slot]);

  if (!items.length && !lastMeal) return null;
  const label = slot.charAt(0).toUpperCase() + slot.slice(1);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Förslag till {slot}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {lastMeal && (
          <button onClick={() => onPickMany(lastMeal.items)}
            className="shrink-0 flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold">
            <RotateCcw className="w-3 h-3" /> Samma {label.toLowerCase()} som {new Date(lastMeal.date).toLocaleDateString("sv-SE", { weekday: "short" })} · {Math.round(lastMeal.items.reduce((s, i) => s + i.kcal, 0))} kcal
          </button>
        )}
        {items.map(({ p }) => {
          const k = p.name.toLowerCase();
          const done = added.has(k);
          return (
            <button key={k} disabled={done}
              onClick={() => { setAdded((s) => new Set(s).add(k)); onPick(p); }}
              className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${done ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              {!done && <Plus className="w-3 h-3" />}{done && "✓ "}
              <span className="max-w-[9rem] truncate">{p.name}</span>
              <span className="text-[10px] opacity-70 tabular-nums">{Math.round(p.amount)}{p.unit === "g" ? "g" : ` ${p.unit}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
