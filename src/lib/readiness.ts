import type { HealthDay } from "@/lib/healthSync";

export type Readiness = { score: number; label: string; advice: string; reasons: string[] };

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/**
 * Enkel dagsform 0–100 från vilopuls (vs 7 d), nattens sömn och gårdagens belastning
 * (aktiva kcal vs snitt). Kräver minst två signaler, annars null.
 */
export function computeReadiness(days: HealthDay[], todayKey: string): Readiness | null {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const today = sorted.find((d) => d.day === todayKey);
  const prior = sorted.filter((d) => d.day < todayKey).slice(-7);
  let score = 70;
  let signals = 0;
  const reasons: string[] = [];

  const rhr = today?.restingHeartRate;
  const rhrBase = avg(prior.map((d) => d.restingHeartRate).filter((v): v is number => typeof v === "number" && v > 0));
  if (rhr && rhrBase && prior.filter((d) => d.restingHeartRate).length >= 3) {
    signals++;
    const delta = rhr - rhrBase;
    score -= Math.max(-10, Math.min(25, delta * 4));
    if (delta >= 4) reasons.push(`Vilopuls +${Math.round(delta)}`);
    else if (delta <= -2) reasons.push("Låg vilopuls");
  }

  const sleep = today?.sleepMinutes ?? 0;
  if (sleep > 120) {
    signals++;
    const h = sleep / 60;
    score += h >= 7.5 ? 10 : h >= 6.5 ? 0 : h >= 5.5 ? -12 : -22;
    reasons.push(`Sömn ${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`);
  }

  const yesterday = prior[prior.length - 1];
  const loadBase = avg(prior.slice(0, -1).map((d) => d.activeCalories).filter((v) => v > 0));
  if (yesterday && yesterday.activeCalories > 0 && loadBase) {
    signals++;
    const ratio = yesterday.activeCalories / loadBase;
    if (ratio > 1.6) { score -= 10; reasons.push("Tung dag igår"); }
    else if (ratio < 0.6) { score += 5; reasons.push("Vilodag igår"); }
  }

  if (signals < 2) return null;
  score = Math.round(Math.max(0, Math.min(100, score)));
  if (score >= 75) return { score, label: "Kör tungt", advice: "Kroppen verkar utvilad – bra dag för ett tufft pass.", reasons };
  if (score >= 50) return { score, label: "Normal dag", advice: "Kör som planerat och lyssna på kroppen.", reasons };
  return { score, label: "Ta det lugnt", advice: "Tecken på trötthet – välj ett lättare pass eller vila.", reasons };
}
