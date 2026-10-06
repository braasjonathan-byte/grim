export type MicroKey =
  | "iron_mg" | "calcium_mg" | "vitamin_d_ug" | "vitamin_c_mg"
  | "vitamin_b12_ug" | "magnesium_mg" | "potassium_mg" | "sodium_mg";

export type Micros = Partial<Record<MicroKey, number | null>>;

/** off = Open Food Facts nutriment key (values per 100 g in grams). factor converts g → unit. */
export const MICROS: { key: MicroKey; label: string; unit: string; off: string; factor: number }[] = [
  { key: "iron_mg", label: "Järn", unit: "mg", off: "iron_100g", factor: 1000 },
  { key: "calcium_mg", label: "Kalcium", unit: "mg", off: "calcium_100g", factor: 1000 },
  { key: "vitamin_d_ug", label: "Vitamin D", unit: "µg", off: "vitamin-d_100g", factor: 1e6 },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg", off: "vitamin-c_100g", factor: 1000 },
  { key: "vitamin_b12_ug", label: "Vitamin B12", unit: "µg", off: "vitamin-b12_100g", factor: 1e6 },
  { key: "magnesium_mg", label: "Magnesium", unit: "mg", off: "magnesium_100g", factor: 1000 },
  { key: "potassium_mg", label: "Kalium", unit: "mg", off: "potassium_100g", factor: 1000 },
  { key: "sodium_mg", label: "Natrium", unit: "mg", off: "sodium_100g", factor: 1000 },
];

export const MICRO_SELECT = MICROS.map((m) => m.key).join(",");

/** Read micronutrients per 100 g from an Open Food Facts nutriments object. */
export function microsFromOFF(n: Record<string, any>): Micros {
  const out: Micros = {};
  for (const m of MICROS) {
    const v = Number(n?.[m.off]);
    if (Number.isFinite(v) && v > 0) out[m.key] = Math.round(v * m.factor * 1000) / 1000;
  }
  return out;
}

export function pickMicros(row: any): Micros {
  const out: Micros = {};
  for (const m of MICROS) {
    const v = row?.[m.key];
    if (v != null && Number.isFinite(Number(v))) out[m.key] = Number(v);
  }
  return out;
}

export function scaleMicros(src: Micros, factor: number): Micros {
  const out: Micros = {};
  for (const m of MICROS) {
    const v = src[m.key];
    if (v != null) out[m.key] = Number(v) * factor;
  }
  return out;
}

export function formatMicro(v: number) {
  return v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(0) : v.toFixed(1);
}
