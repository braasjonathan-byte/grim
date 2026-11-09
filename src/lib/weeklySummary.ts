import { allCheckedSets, sessionVolumeKg } from "@/lib/checkedSets";
import { normalizeExerciseName } from "@/lib/exerciseNormalization";
import { parseNum } from "@/lib/inputValidation";
import { epley1RM } from "@/lib/strengthStats";
import { toLocalDateKey } from "@/lib/dateUtils";

/** Ett genomfört pass med det datum det räknas till i statistiken. */
export interface DatedCompletion { date: Date; logged_weights: unknown }
export interface MealRow { log_date: string; kcal: number | null; protein_g?: number | null }
export interface WeightRow { log_date: string; weight_kg: number | null }

export interface WeekPr { exercise: string; e1rm: number; previous: number; kg: number; reps: number }

export interface WeekNumbers {
  sessions: number;
  volumeKg: number;
  prs: WeekPr[];
  /** Snitt kcal per loggad dag, null om inget loggats */
  avgKcal: number | null;
  avgProteinG: number | null;
  loggedDays: number;
  /** Snittvikt under veckan, null om ingen vägning */
  avgWeightKg: number | null;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  current: WeekNumbers;
  previous: WeekNumbers;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Måndag i veckan som innehåller `d` (lokal tid). */
export function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const cleanName = (name: string) => normalizeExerciseName(name.replace(/( —)+$/, "").trim());

/** Bästa e1RM per övning i ett pass (endast avbockade arbetsset). */
function sessionBestE1rm(lw: unknown): Map<string, { e1rm: number; kg: number; reps: number; label: string }> {
  const out = new Map<string, { e1rm: number; kg: number; reps: number; label: string }>();
  for (const [name, sets] of allCheckedSets(lw)) {
    const key = cleanName(name);
    if (!key) continue;
    for (const s of sets) {
      const kg = parseNum(s.kg) || 0;
      const reps = Math.round(parseNum(s.reps) || 0);
      if (kg <= 0 || reps <= 0 || reps > 15) continue; // e1RM blir opålitligt över ~15 reps
      const e = epley1RM(kg, reps);
      const cur = out.get(key);
      if (!cur || e > cur.e1rm) out.set(key, { e1rm: e, kg, reps, label: name.replace(/( —)+$/, "").trim() });
    }
  }
  return out;
}

/**
 * Nya rekord (e1RM) i intervallet [from, to): veckans bästa e1RM per övning som slår
 * allt som loggats före `from`. Första gången en övning görs räknas inte som rekord.
 */
export function prsInRange(completions: DatedCompletion[], from: Date, to: Date): WeekPr[] {
  const before = new Map<string, number>();
  const inRange = new Map<string, { e1rm: number; kg: number; reps: number; label: string }>();
  for (const c of completions) {
    const t = c.date.getTime();
    if (!isFinite(t) || t >= to.getTime()) continue;
    const best = sessionBestE1rm(c.logged_weights);
    if (t < from.getTime()) {
      for (const [k, v] of best) if (!(before.get(k)! >= v.e1rm)) before.set(k, v.e1rm);
    } else {
      for (const [k, v] of best) { const cur = inRange.get(k); if (!cur || v.e1rm > cur.e1rm) inRange.set(k, v); }
    }
  }
  const prs: WeekPr[] = [];
  for (const [k, v] of inRange) {
    const prev = before.get(k) ?? 0;
    if (prev > 0 && v.e1rm > prev + 0.05) prs.push({ exercise: v.label, e1rm: v.e1rm, previous: prev, kg: v.kg, reps: v.reps });
  }
  return prs.sort((a, b) => (b.e1rm - b.previous) - (a.e1rm - a.previous));
}

function weekNumbers(completions: DatedCompletion[], meals: MealRow[], weights: WeightRow[], from: Date, to: Date): WeekNumbers {
  let sessions = 0;
  let volumeKg = 0;
  for (const c of completions) {
    const t = c.date.getTime();
    if (t < from.getTime() || t >= to.getTime()) continue;
    sessions++;
    volumeKg += sessionVolumeKg(c.logged_weights);
  }
  const fromKey = toLocalDateKey(from);
  const toKey = toLocalDateKey(to);
  const kcalByDay = new Map<string, { kcal: number; protein: number }>();
  for (const m of meals) {
    if (m.log_date < fromKey || m.log_date >= toKey) continue;
    const v = kcalByDay.get(m.log_date) ?? { kcal: 0, protein: 0 };
    v.kcal += Number(m.kcal) || 0;
    v.protein += Number(m.protein_g) || 0;
    kcalByDay.set(m.log_date, v);
  }
  // Dagar med under 300 kcal räknas inte – oftast bara en kaffe eller ett snabbt test
  const days = [...kcalByDay.values()].filter((d) => d.kcal >= 300);
  const avgKcal = days.length ? days.reduce((s, d) => s + d.kcal, 0) / days.length : null;
  const avgProteinG = days.length ? days.reduce((s, d) => s + d.protein, 0) / days.length : null;
  const ws = weights.filter((w) => w.log_date >= fromKey && w.log_date < toKey && Number(w.weight_kg) > 0).map((w) => Number(w.weight_kg));
  const avgWeightKg = ws.length ? ws.reduce((s, w) => s + w, 0) / ws.length : null;
  return { sessions, volumeKg, prs: prsInRange(completions, from, to), avgKcal, avgProteinG, loggedDays: days.length, avgWeightKg };
}

/** Den här veckan (mån–sön som innehåller `today`) jämfört med förra veckan. */
export function computeWeeklySummary(completions: DatedCompletion[], meals: MealRow[], weights: WeightRow[], today = new Date()): WeeklySummary {
  const start = mondayOf(today);
  const end = addDays(start, 7);
  const prevStart = addDays(start, -7);
  return {
    weekStart: toLocalDateKey(start),
    weekEnd: toLocalDateKey(addDays(start, 6)),
    current: weekNumbers(completions, meals, weights, start, end),
    previous: weekNumbers(completions, meals, weights, prevStart, start),
  };
}

/** Procentuell förändring, null när förra veckan saknar data. */
export function pctChange(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}
