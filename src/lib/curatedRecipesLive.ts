import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CURATED_RECIPES, type CuratedRecipe } from "@/data/curatedRecipes";

/**
 * Bundled curated recipes merged with admin overrides from the database
 * (edit, hide, or add new recipes without a new app release).
 */
export interface RecipeOverrideRow { recipe_id: string; data: any; hidden: boolean }

let cached: CuratedRecipe[] | null = null;
let rowsCache: RecipeOverrideRow[] = [];
const listeners = new Set<(r: CuratedRecipe[]) => void>();

export function mergeRecipes(rows: RecipeOverrideRow[]): CuratedRecipe[] {
  const byId = new Map(rows.map((r) => [r.recipe_id, r]));
  const base = CURATED_RECIPES.filter((r) => !byId.get(r.id)?.hidden).map((r) => {
    const o = byId.get(r.id);
    return o?.data ? ({ ...r, ...o.data, id: r.id } as CuratedRecipe) : r;
  });
  const baseIds = new Set(CURATED_RECIPES.map((r) => r.id));
  const extra = rows.filter((r) => !baseIds.has(r.recipe_id) && !r.hidden && r.data).map((r) => ({ ...r.data, id: r.recipe_id } as CuratedRecipe));
  return [...base, ...extra];
}

export async function loadRecipeOverrides(): Promise<RecipeOverrideRow[]> {
  const { data } = await supabase.from("curated_recipe_overrides").select("recipe_id, data, hidden");
  rowsCache = (data || []) as RecipeOverrideRow[];
  cached = mergeRecipes(rowsCache);
  listeners.forEach((l) => l(cached!));
  return rowsCache;
}

export function getRecipeOverrideRows() { return rowsCache; }

export function useCuratedRecipes(): CuratedRecipe[] {
  const [r, setR] = useState<CuratedRecipe[]>(cached ?? CURATED_RECIPES);
  useEffect(() => {
    let alive = true;
    const l = (v: CuratedRecipe[]) => alive && setR(v);
    listeners.add(l);
    if (cached) setR(cached); else loadRecipeOverrides().catch(() => {});
    return () => { alive = false; listeners.delete(l); };
  }, []);
  return r;
}
