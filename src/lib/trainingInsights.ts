import type { HistorySession } from "@/lib/workoutHistory";
import { allCheckedSets, setVolumeKg } from "@/lib/checkedSets";
import { summarizeCompletion } from "@/lib/workoutSummary";

export interface TrainingInsight { title: string; detail: string }
const fmt = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
/** Only compare sessions with identical counted strength rosters and rep targets. */
export function trainingInsights(sessions: HistorySession[]): TrainingInsight[] {
  const ordered = sessions.filter(s => s.date).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const results: TrainingInsight[] = [];
  for (const latest of ordered) {
    const sets = allCheckedSets(latest.completion.logged_weights);
    const entries = [...sets].filter(([, rows]) => rows.length);
    if (!entries.length) continue;
    const signature = (session: HistorySession) => [...allCheckedSets(session.completion.logged_weights)]
      .filter(([, rows]) => rows.length).map(([name, rows]) => `${name}:${rows.map(r => r.reps).join(",")}`).sort().join("|");
    const previous = ordered.find(s => (s.date || "") < (latest.date || "") && signature(s) === signature(latest));
    if (!previous) continue;
    const volume = (session: HistorySession) => [...allCheckedSets(session.completion.logged_weights).values()].flat().reduce((sum, s) => sum + setVolumeKg(s), 0);
    const current = volume(latest), before = volume(previous);
    if (before <= 0 || current <= 0) continue;
    const change = (current - before) / before * 100;
    results.push({ title: change === 0 ? "Samma träningsvolym" : `${fmt(Math.abs(change))} % ${change > 0 ? "mer" : "mindre"} lyft`, detail: `${entries.map(([name]) => name).join(", ")} · ${fmt(current)} mot ${fmt(before)} kg. Samma övningar, antal set och repetitioner (${latest.date} mot ${previous.date}). Det visar volym, inte ett mått på maximal styrka.` });
    break;
  }
  const days = [...new Set(ordered.map(s => s.date))];
  for (const latest of ordered) {
    const cardio = summarizeCompletion(latest.completion.logged_weights).cardio;
    if (!cardio || cardio.count !== 1 || cardio.distanceKm <= 0 || cardio.minutes <= 0) continue;
    const previous = ordered.find(s => {
      const before = summarizeCompletion(s.completion.logged_weights).cardio;
      return (s.date || "") < (latest.date || "") && before?.count === 1 && before.primaryName === cardio.primaryName && Math.abs(before.distanceKm - cardio.distanceKm) < 0.001 && before.minutes > 0;
    });
    if (!previous) continue;
    const before = summarizeCompletion(previous.completion.logged_weights).cardio;
    if (!before) continue;
    const difference = cardio.minutes - before.minutes;
    results.push({ title: difference === 0 ? `${cardio.primaryName}: samma tid` : `${cardio.primaryName}: ${fmt(Math.abs(difference))} min ${difference < 0 ? "snabbare" : "långsammare"}`, detail: `${fmt(cardio.distanceKm)} km på ${fmt(cardio.minutes)} mot ${fmt(before.minutes)} min (${latest.date} mot ${previous.date}). Samma övning och distans; väder, terräng och ansträngning kan skilja.` });
    break;
  }
  if (days.length) results.push({ title: `${days.length} träningsdagar registrerade`, detail: `${ordered.length} genomförda pass mellan ${days[days.length - 1]} och ${days[0]}. Flera pass samma dag räknas som en träningsdag.` });
  return results;
}

export function weightInsight(rows: { log_date: string; weight_kg: number }[]): TrainingInsight | null {
  const ordered = rows.filter(row => Number.isFinite(row.weight_kg) && row.weight_kg >= 30 && row.weight_kg <= 300).sort((a, b) => a.log_date.localeCompare(b.log_date));
  const first = ordered[0], last = ordered[ordered.length - 1];
  if (!first || !last || first.log_date === last.log_date) return null;
  const difference = last.weight_kg - first.weight_kg;
  return { title: `Vikt: ${difference > 0 ? "+" : ""}${fmt(difference)} kg`, detail: `${fmt(first.weight_kg)} till ${fmt(last.weight_kg)} kg mellan ${first.log_date} och ${last.log_date}, baserat på ${ordered.length} vägningar. Skillnaden mellan två vägningar är inte samma sak som förändrad fettmassa.` };
}