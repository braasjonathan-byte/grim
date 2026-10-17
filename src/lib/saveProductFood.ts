import { supabase } from "@/integrations/supabase/client";

type ProductFood = {
  name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number | null;
};

/** Persist only on explicit add, so scanned products also become searchable. */
export async function saveProductFood(userId: string, food: ProductFood, extra: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await supabase.from("custom_foods").insert({
    ...extra,
    user_id: userId,
    name: food.name,
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    fiber_g: Number(food.fiber_g) || 0,
  }).select("id").single();
  if (error) throw error;
  if (!data) throw new Error("Livsmedlet kunde inte sparas.");
  window.dispatchEvent(new Event("grim:foods-changed"));
  return data.id;
}