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