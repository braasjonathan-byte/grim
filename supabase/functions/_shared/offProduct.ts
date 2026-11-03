export interface OFFProduct {
  code?: string;
  product_name_sv?: string;
  product_name?: string;
  generic_name_sv?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
  nova_group?: number;
}

/** Barcode and text search must accept the same products and nutrition data. */
export function offFood(product: OFFProduct) {
  const name = product.product_name_sv || product.product_name || product.generic_name_sv || product.generic_name;
  if (!name) return null;
  const brand = (product.brands || "").split(",")[0]?.trim() || "";
  const n = product.nutriments || {};
  const number = (key: string) => {
    const value = Number(n[key]);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };
  return {
    name: brand ? `${name} (${brand})` : name,
    brand,
    kcal: number("energy-kcal_100g") || number("energy_100g") / 4.184,
    protein_g: number("proteins_100g"),
    fat_g: number("fat_100g"),
    carbs_g: number("carbohydrates_100g"),
    fiber_g: number("fiber_100g"),
  };
}
/**
 * Cacha OFF-produkter i public.foods via RPC cache_off_food (kvalitetsfilter + dubblettskydd i DB).
 * Fel sväljs: cachen får aldrig påverka sök/skanning.
 */
// deno-lint-ignore no-explicit-any
export async function cacheOffProducts(client: any, products: OFFProduct[], max = 25) {
  const jobs = products.filter((p) => p.code && /^\d{6,14}$/.test(p.code)).slice(0, max).map((p) => {
    const f = offFood(p);
    if (!f) return Promise.resolve();
    const sugar = Number((p.nutriments || {})["sugars_100g"]);
    return client.rpc("cache_off_food", {
      p_barcode: p.code, p_name: f.name, p_brand: f.brand,
      p_kcal: f.kcal, p_protein: f.protein_g, p_fat: f.fat_g, p_carbs: f.carbs_g,
      p_fiber: f.fiber_g, p_sugar: Number.isFinite(sugar) ? sugar : null, p_nova: p.nova_group ?? null,
    }).then(() => {}, () => {});
  });
  await Promise.allSettled(jobs);
}
