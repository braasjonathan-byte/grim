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

export const MICRO_SELECT = MICROS.map((m) => m.key).join(",") + ",nova_group,sugar_g";

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

/** Daily food-quality score 0–100. NOVA (1–4) when known, else fiber/sugar heuristic per 1000 kcal. */
export function foodQualityScore(logs: any[]): number | null {
  let wSum = 0, sSum = 0;
  for (const l of logs) {
    const kcal = Number(l.kcal) || 0;
    if (kcal <= 0) continue;
    let s: number;
    const nova = Number(l.nova_group);
    if (nova >= 1 && nova <= 4) s = ({ 1: 100, 2: 80, 3: 55, 4: 15 } as Record<number, number>)[nova];
    else {
      const fiberPer1000 = (Number(l.fiber_g) || 0) / kcal * 1000;
      s = 40 + Math.min(45, fiberPer1000 * 3);
      if (l.sugar_g != null) {
        const sugarShare = (Number(l.sugar_g) * 4) / kcal;
        s -= Math.min(40, sugarShare * 100);
      }
      s = Math.max(0, Math.min(100, s));
    }
    wSum += kcal; sSum += s * kcal;
  }
  return wSum > 0 ? Math.round(sSum / wSum) : null;
}

export const qualityTone = (s: number) => s >= 70 ? "bg-success/15 text-success" : s >= 40 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
