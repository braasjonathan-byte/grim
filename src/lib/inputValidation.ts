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
  /** Sekunder (planka, cirkel) eller meter (farmers walk, sled) – lagras i reps-fältet. */
  setTimeDist: { min: 0, max: 36000, integer: true, optional: true },
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

/** Ett loggat set räknas bara om vikt och reps ligger inom gränserna (negativ vikt = assisterad, tolereras om |kg| ≤ 500). Reps-fältet kan även hålla sekunder/meter, därför gäller den högre gränsen setTimeDist. */
export const isPlausibleSet = (kg: unknown, reps: unknown): boolean => {
  const k = parseDecimal(kg === undefined || kg === null || kg === "" ? "0" : String(kg));
  const r = parseDecimal(reps === undefined || reps === null || reps === "" ? "0" : String(reps));
  if (isNaN(k) || isNaN(r)) return true; // icke-numeriskt (t.ex. tid) – hanteras ej här
  return Math.abs(k) <= RULES.setKg.max && r >= 0 && r <= RULES.setTimeDist.max;
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

/** Som parseFloat men godkänner decimalkomma ("82,5" → 82.5). */
export const parseNum = (v: unknown): number => parseFloat(String(v ?? "").trim().replace(",", "."));

/* ---------- Kondition: rimlighetskontroll ---------- */

export type CardioSportKind = "running" | "cycling" | "swimming" | "other";

const CARDIO_SPORT_PATTERNS: { key: CardioSportKind; re: RegExp }[] = [
  { key: "cycling", re: /cykl|cykel|spinning|motionscykel|zwift|mtb|mountainbike|gravel|\bbike\b|cycling|\bride\b/i },
  { key: "swimming", re: /simning|simma|\bsim\b/i },
  { key: "running", re: /löpning|löpband|löp|jogg|spring|intervall|sprint|tröskel|maraton|milen/i },
];

export const detectCardioSportKind = (sportName: string): CardioSportKind => {
  const n = String(sportName || "");
  for (const p of CARDIO_SPORT_PATTERNS) if (p.re.test(n)) return p.key;
  return "other";
};

export interface CardioEntryInput {
  sport: string;
  /** Total tid i minuter. */
  timeMin?: number | string | null;
  /** Total distans i km. */
  distanceKm?: number | string | null;
}

export interface CardioValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Enkel rimlighetskontroll av ett konditionspass innan det sparas.
 * Kräver minst tid eller distans, och om båda finns kontrolleras att
 * farten/tempot är rimligt för sporten (stoppar t.ex. 99 km på 10 min).
 */
export const validateCardioEntry = ({ sport, timeMin, distanceKm }: CardioEntryInput): CardioValidationResult => {
  const t = parseDecimal(timeMin === null || timeMin === undefined ? "" : String(timeMin));
  const d = parseDecimal(distanceKm === null || distanceKm === undefined ? "" : String(distanceKm));

  // Negativa värden är alltid fel – de får inte tyst tolkas som "saknas".
  if (isFinite(t) && t < 0) return { valid: false, error: "Tiden kan inte vara negativ." };
  if (isFinite(d) && d < 0) return { valid: false, error: "Distansen kan inte vara negativ." };
  if (isFinite(t) && t > RULES.cardioTimeMin.max) return { valid: false, error: `Tiden kan vara högst ${RULES.cardioTimeMin.max} min.` };
  if (isFinite(d) && d > RULES.cardioDistanceKm.max) return { valid: false, error: `Distansen kan vara högst ${RULES.cardioDistanceKm.max} km.` };

  const hasTime = isFinite(t) && t > 0;
  const hasDist = isFinite(d) && d > 0;

  if (!hasTime && !hasDist) {
    return { valid: false, error: "Ange minst tid eller distans för passet." };
  }

  if (!hasTime || !hasDist) return { valid: true, error: null };

  const speedKmh = d / (t / 60);
  const paceMinPerKm = t / d;
  const kind = detectCardioSportKind(sport);

  if (kind === "running") {
    if (speedKmh > 25) return { valid: false, error: "Orimlig fart för löpning (över 25 km/h) – kontrollera tid och distans." };
    if (paceMinPerKm < 2.5 || paceMinPerKm > 20) {
      return { valid: false, error: "Orimligt löptempo – kontrollera tid och distans (rimligt tempo är ca 2:30–20:00 min/km)." };
    }
  } else if (kind === "cycling") {
    if (speedKmh > 80) return { valid: false, error: "Orimlig fart för cykling (över 80 km/h) – kontrollera tid och distans." };
  } else if (kind === "swimming") {
    if (paceMinPerKm < 8 || paceMinPerKm > 60) {
      return { valid: false, error: "Orimligt simtempo – kontrollera tid och distans." };
    }
  } else {
    if (speedKmh > 60) return { valid: false, error: "Orimlig fart – kontrollera tid och distans." };
  }

  return { valid: true, error: null };
};

/**
 * Rimlighetskontroll kcal ↔ makron (4/9/4 kcal per g). Returnerar fel när
 * makronas energi tydligt överstiger angivna kalorier (20 % + 15 kcal marginal).
 */
export function macroKcalMismatch(kcal: number, protein: number, fat: number, carbs: number): string | null {
  if (!(kcal > 0)) return null;
  const fromMacros = 4 * (protein || 0) + 9 * (fat || 0) + 4 * (carbs || 0);
  if (fromMacros > kcal * 1.2 + 15) {
    return `Makronas energi blir ${Math.round(fromMacros)} kcal, mer än ${Math.round(kcal)} kcal – kontrollera värdena.`;
  }
  return null;
}
