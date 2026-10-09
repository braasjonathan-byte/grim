import { allCheckedSets } from "@/lib/checkedSets";
import { parseNum } from "@/lib/inputValidation";

/** Epley – samma formel som 1RM-kalkylatorn. */
export const epley1RM = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));
/** Omvänd Epley: vikt du klarar för `reps` reps givet en 1RM. */
export const epleyWeightForReps = (oneRM: number, reps: number) => (reps <= 1 ? oneRM : oneRM / (1 + reps / 30));

export type MainLift = "squat" | "bench" | "deadlift";
export const LIFT_LABELS: Record<MainLift, string> = { squat: "Knäböj", bench: "Bänkpress", deadlift: "Marklyft" };

export function classifyLift(name: string): MainLift | null {
  const n = name.toLowerCase().replace(/( —)+$/, "").trim();
  if (/rumänsk|rdl|stiff|raka ben|sumo.*high|marklyft.*hantel|hantel.*marklyft/.test(n)) return null;
  if (/^(marklyft|deadlift|conventional deadlift|sumo deadlift|sumomarklyft)\b/.test(n)) return "deadlift";
  if (/^(bänkpress|bench press|bänk\b|bench\b)/.test(n) && !/hantel|dumbbell|lutande|incline|smal|close/.test(n)) return "bench";
  if (/^(knäböj|back squat|squat|böj\b)/.test(n) && !/front|goblet|bulgar|split|hantel|box|jump|pistol/.test(n)) return "squat";
  return null;
}

export interface StrengthCompletion { logged_weights: unknown; date: Date }

export interface LiftBest { kg: number; reps: number; e1rm: number }
export interface WeekRow { weekStart: string; e1rm: Partial<Record<MainLift, number>>; tonnage: Partial<Record<MainLift, number>> }

const mondayKey = (d: Date) => {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
};

export function computeStrengthStats(completions: StrengthCompletion[]) {
  const best: Partial<Record<MainLift, LiftBest>> = {};
  const bestE1rm: Partial<Record<MainLift, number>> = {};
  const weeks = new Map<string, WeekRow>();
  for (const c of completions) {
    for (const [name, sets] of allCheckedSets(c.logged_weights)) {
      const lift = classifyLift(name);
      if (!lift) continue;
      const wk = mondayKey(c.date);
      const row = weeks.get(wk) || { weekStart: wk, e1rm: {}, tonnage: {} };
      for (const s of sets) {
        const kg = parseNum(s.kg) || 0;
        const reps = Math.round(parseNum(s.reps) || 0);
        if (kg <= 0 || reps <= 0) continue;
        const e = epley1RM(kg, reps);
        const b = best[lift];
        if (!b || kg > b.kg || (kg === b.kg && reps > b.reps)) best[lift] = { kg, reps, e1rm: e };
        if (!(bestE1rm[lift]! >= e)) bestE1rm[lift] = e;
        if (!(row.e1rm[lift]! >= e)) row.e1rm[lift] = e;
        row.tonnage[lift] = (row.tonnage[lift] || 0) + kg * reps;
      }
      weeks.set(wk, row);
    }
  }
  const sbdTotal = (best.squat?.kg || 0) + (best.bench?.kg || 0) + (best.deadlift?.kg || 0);
  return { best, bestE1rm, sbdTotal, weeks: [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)) };
}

const DOTS = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};
/** DOTS-poäng. gender: "man" | "kvinna". */
export function dotsScore(totalKg: number, bodyKg: number, gender: string): number | null {
  const g = /^(man|male|m)$/i.test(gender) ? "male" : /^(kvinna|female|f|k)$/i.test(gender) ? "female" : null;
  if (!g || !(bodyKg > 0) || !(totalKg > 0)) return null;
  const bw = Math.min(Math.max(bodyKg, g === "male" ? 40 : 40), g === "male" ? 210 : 150);
  const [a, b, c, d, e] = DOTS[g];
  const denom = a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4;
  return denom > 0 ? (totalKg * 500) / denom : null;
}
