/**
 * Gemensam valideringsmodul för alla sifferfält i appen.
 * Regler + hjälpfunktioner. Samma gränser används i databasens triggers.
 */

export interface NumberRule {
  min: number;
  max: number;
  unit?: string;
  integer?: boolean;
  /** Tomt fält är tillåtet (ger value = null). */
  optional?: boolean;
}

export const RULES = {
  setKg: { min: 0, max: 500, unit: "kg", optional: true },
  setReps: { min: 0, max: 100, integer: true, optional: true },
  oneRm: { min: 1, max: 500, unit: "kg", optional: true },
  cardioDistanceKm: { min: 0, max: 300, unit: "km", optional: true },
  cardioTimeMin: { min: 1, max: 1440, unit: "min", optional: true },
  bodyWeightKg: { min: 30, max: 300, unit: "kg", optional: true },
  heightCm: { min: 100, max: 250, unit: "cm", optional: true },
  ageYears: { min: 13, max: 100, unit: "år", integer: true, optional: true },
  foodGrams: { min: 1, max: 5000, unit: "g" },
  quickKcal: { min: 1, max: 5000, unit: "kcal" },
  goalKcal: { min: 1000, max: 6000, unit: "kcal" },
  goalProtein: { min: 0, max: 400, unit: "g" },
  goalFat: { min: 0, max: 300, unit: "g" },
  goalCarbs: { min: 0, max: 1000, unit: "g" },
  goalFiber: { min: 0, max: 100, unit: "g", optional: true },
  customKcal: { min: 0, max: 900, unit: "kcal" },
  customMacro: { min: 0, max: 100, unit: "g", optional: true },
} satisfies Record<string, NumberRule>;

export type RuleName = keyof typeof RULES;

/** Tolkar "82,5" och "82.5" som 82.5. Returnerar NaN om texten inte är ett tal. */
export const parseDecimal = (raw: string | number | null | undefined): number => {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return raw;
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$|^-?\d+\.$/.test(s)) return NaN;
  return Number(s);
};

/** Visar ett tal med decimalkomma, utan onödiga decimaler. */
export const formatDecimal = (n: number | string | null | undefined, maxDecimals = 2): string => {
  const v = typeof n === "string" ? parseDecimal(n) : n;
  if (v === null || v === undefined || !isFinite(v)) return typeof n === "string" ? n : "";
  const f = Math.pow(10, maxDecimals);
  return String(Math.round(v * f) / f).replace(".", ",");
};

const fmt = (n: number) => String(n).replace(".", ",");

export interface ValidationResult {
  value: number | null;
  error: string | null;
}

export const validateNumber = (raw: string | number | null | undefined, rule: NumberRule | RuleName): ValidationResult => {
  const r: NumberRule = typeof rule === "string" ? RULES[rule] : rule;
  const text = raw === null || raw === undefined ? "" : String(raw).trim();
  const range = `Ange ett tal mellan ${fmt(r.min)} och ${fmt(r.max)}${r.unit ? ` ${r.unit}` : ""}.`;
  if (text === "") return r.optional ? { value: null, error: null } : { value: null, error: "Fältet måste fyllas i." };
  const v = parseDecimal(text);
  if (isNaN(v)) return { value: null, error: `Ange ett tal. ${range}` };
  if (v < 0) return { value: null, error: "Negativa värden går inte att spara." };
  if (r.integer && !Number.isInteger(v)) return { value: null, error: "Ange ett heltal." };
  if (v < r.min || v > r.max) return { value: null, error: range };
  return { value: v, error: null };
};

/** Kortform: true om värdet följer regeln. */
export const isValidNumber = (raw: string | number | null | undefined, rule: NumberRule | RuleName) =>
  validateNumber(raw, rule).error === null;

/** Normaliserad sträng för lagring ("82,5" → "82.5"). Tom sträng om tomt. */
export const toStorageString = (raw: string): string => {
  const t = raw.trim();
  if (!t) return "";
  const v = parseDecimal(t);
  return isNaN(v) ? t : String(v);
};

/** Absolut kcal-skillnad i procent mot makrona (4/4/9). */
export const macroKcal = (protein: number, carbs: number, fat: number) => 4 * protein + 4 * carbs + 9 * fat;
export const kcalDeviation = (kcal: number, protein: number, carbs: number, fat: number): number => {
  const calc = macroKcal(protein, carbs, fat);
  if (calc <= 0 && kcal <= 0) return 0;
  return Math.abs(kcal - calc) / Math.max(calc, 1);
};

/** Gränsen för "ovanligt mycket" i kost. */
export const UNUSUAL_FOOD_GRAMS = 2000;
export const UNUSUAL_QUICK_KCAL = 2000;

/* ---------- Befintlig data utanför gränserna ---------- */

/** Ett loggat set räknas bara om vikt och reps ligger inom gränserna (negativ vikt = assisterad, tolereras om |kg| ≤ 500). */
export const isPlausibleSet = (kg: unknown, reps: unknown): boolean => {
  const k = parseDecimal(kg === undefined || kg === null || kg === "" ? "0" : String(kg));
  const r = parseDecimal(reps === undefined || reps === null || reps === "" ? "0" : String(reps));
  if (isNaN(k) || isNaN(r)) return true; // icke-numeriskt (t.ex. tid) – hanteras ej här
  return Math.abs(k) <= RULES.setKg.max && r >= 0 && r <= RULES.setReps.max;
};

export const IMPLAUSIBLE_LABEL = "Orimligt värde – redigera";

/** Kostpost: rimlig om mängd och kcal är positiva och inom gränserna. */
export const isPlausibleMealLog = (row: { amount?: unknown; unit?: unknown; kcal?: unknown; protein_g?: unknown; fat_g?: unknown; carbs_g?: unknown }): boolean => {
  const amount = Number(row.amount);
  const kcal = Number(row.kcal);
  if (!(amount > 0) || !(kcal >= 0)) return false;
  if (row.unit === "g" && amount > RULES.foodGrams.max) return false;
  if (kcal > 20000) return false;
  for (const k of ["protein_g", "fat_g", "carbs_g"] as const) {
    const v = Number(row[k] ?? 0);
    if (v < 0 || v > 5000) return false;
  }
  return true;
};
