import type { HistorySession } from "@/lib/workoutHistory";
import { allCheckedSets, setVolumeKg } from "@/lib/checkedSets";

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
  if (days.length) results.push({ title: `${days.length} träningsdagar registrerade`, detail: `${ordered.length} genomförda pass mellan ${days[days.length - 1]} och ${days[0]}. Flera pass samma dag räknas som en träningsdag.` });
  return results;
}