import { supabase } from "@/integrations/supabase/client";
import type { PickedItem } from "@/components/FoodPickerDialog";
import { isPlausibleMealLog } from "@/lib/inputValidation";
import { pickMicros } from "@/lib/micronutrients";

export async function loadDayGoalFoods(userId: string, dateKey: string): Promise<PickedItem[]> {
  const since = new Date(`${dateKey}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 60);
  const [history, basics] = await Promise.all([
    supabase.from("meal_logs").select("*").eq("user_id", userId)
      .gte("log_date", since.toISOString().slice(0, 10)).lte("log_date", dateKey)
      .order("created_at", { ascending: false }).limit(500),
    supabase.from("foods").select("*")
      .or("name.ilike.kvarg%,name.ilike.ägg%kokt%,name.ilike.havregryn%,name.ilike.banan%,name.ilike.blåbär%,name.ilike.knäckebröd%,name.ilike.keso%")
      .or("nutrition_source.is.null,nutrition_source.neq.off").order("name").limit(40),
  ]);
  if (history.error || basics.error) throw new Error("Matunderlaget kunde inte hämtas. Försök igen.");
  const counts = new Map<string, { item: PickedItem; count: number }>();
  for (const row of history.data ?? []) {
    const id = row.recipe_id || row.food_id || row.custom_food_id;
    if (!id || !isPlausibleMealLog(row)) continue;
    const source: PickedItem["source"] = row.recipe_id ? "recipe" : row.food_id ? "food" : "custom_food";
    const key = `${source}:${id}`;
    const previous = counts.get(key);
    if (previous) { previous.count++; continue; }
    counts.set(key, { count: 1, item: { id, source, name: row.item_name, amount: Number(row.amount), unit: row.unit,
      kcal: Number(row.kcal), protein_g: Number(row.protein_g), fat_g: Number(row.fat_g), carbs_g: Number(row.carbs_g),
      fiber_g: Number(row.fiber_g ?? 0), sugar_g: row.sugar_g, nova_group: row.nova_group, micros: pickMicros(row) } });
  }
  const items = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 20).map(row => row.item);
  // One real database food per staple; a missing staple is omitted, never fabricated.
  const groups = new Set<string>();
  for (const food of basics.data ?? []) {
    const group = food.name.toLowerCase().match(/^(kvarg|ägg|havregryn|banan|blåbär|knäckebröd|keso)/)?.[0];
    if (!group || groups.has(group)) continue;
    groups.add(group);
    const amount = group === "havregryn" ? 40 : group === "knäckebröd" ? 30 : group === "kvarg" || group === "keso" ? 200 : 100;
    const factor = amount / 100;
    items.push({ source: "food", id: food.id, name: food.name, amount, unit: "g", kcal: food.kcal * factor,
      protein_g: food.protein_g * factor, fat_g: food.fat_g * factor, carbs_g: food.carbs_g * factor,
      fiber_g: (food.fiber_g ?? 0) * factor });
  }
  return items;
}

export async function saveDayGoalSuggestion(userId: string, dateKey: string, meal: string, items: PickedItem[]): Promise<string[]> {
  if (!meal || !items.length || items.some(item => !isPlausibleMealLog(item))) throw new Error("Förslaget innehåller en ogiltig mängd.");
  const { data, error } = await supabase.from("meal_logs").insert(items.map(item => ({
    user_id: userId, log_date: dateKey, meal_type: meal, item_name: item.name, amount: item.amount, unit: item.unit,
    kcal: item.kcal, protein_g: item.protein_g, fat_g: item.fat_g, carbs_g: item.carbs_g, fiber_g: item.fiber_g ?? 0,
    food_id: item.source === "food" ? item.id : null, custom_food_id: item.source === "custom_food" ? item.id : null,
    recipe_id: item.source === "recipe" ? item.id : null, sugar_g: item.sugar_g ?? null, nova_group: item.nova_group ?? null,
    ...(item.micros ?? {}),
  }))).select("id");
  if (error || !data?.length) throw new Error("Förslaget kunde inte sparas. Det finns kvar så att du kan försöka igen.");
  return data.map(row => row.id);
}