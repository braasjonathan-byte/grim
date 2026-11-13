import type { HistorySession } from "@/lib/workoutHistory";
import { allCheckedSets, setVolumeKg } from "@/lib/checkedSets";
import { summarizeCompletion } from "@/lib/workoutSummary";

export interface TrainingInsight { title: string; detail: string; kind?: "strength" | "cardio" | "frequency" | "weight" }
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
    results.push({ kind: "strength", title: change === 0 ? "Samma träningsvolym" : `${fmt(Math.abs(change))} % ${change > 0 ? "mer" : "mindre"} lyft`, detail: `${entries.map(([name]) => name).join(", ")} · ${fmt(current)} mot ${fmt(before)} kg. Samma övningar, antal set och repetitioner (${latest.date} mot ${previous.date}). Det visar volym, inte ett mått på maximal styrka.` });
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
    results.push({ kind: "cardio", title: difference === 0 ? `${cardio.primaryName}: samma tid` : `${cardio.primaryName}: ${fmt(Math.abs(difference))} min ${difference < 0 ? "snabbare" : "långsammare"}`, detail: `${fmt(cardio.distanceKm)} km på ${fmt(cardio.minutes)} mot ${fmt(before.minutes)} min (${latest.date} mot ${previous.date}). Samma övning och distans; väder, terräng och ansträngning kan skilja.` });
    break;
  }
  if (days.length) results.push({ kind: "frequency", title: `${days.length} träningsdagar registrerade`, detail: `${ordered.length} genomförda pass mellan ${days[days.length - 1]} och ${days[0]}. Flera pass samma dag räknas som en träningsdag.` });
  return results;
}

export function weightInsight(rows: { log_date: string; weight_kg: number }[]): TrainingInsight | null {
  const ordered = rows.filter(row => Number.isFinite(row.weight_kg) && row.weight_kg >= 30 && row.weight_kg <= 300).sort((a, b) => a.log_date.localeCompare(b.log_date));
  const first = ordered[0], last = ordered[ordered.length - 1];
  if (!first || !last || first.log_date === last.log_date) return null;
  const difference = last.weight_kg - first.weight_kg;
  return { kind: "weight", title: `Vikt: ${difference > 0 ? "+" : difference < 0 ? "−" : ""}${fmt(Math.abs(difference))} kg`, detail: `${fmt(first.weight_kg)} till ${fmt(last.weight_kg)} kg mellan ${first.log_date} och ${last.log_date}, baserat på ${ordered.length} vägningar. Skillnaden mellan två vägningar är inte samma sak som förändrad fettmassa.` };
}

export interface InsightAnswer { question: string; period: string; items: TrainingInsight[] }
export function insightAnswers(sessions: HistorySession[], weights: { log_date: string; weight_kg: number }[], today = new Date().toISOString().slice(0, 10)): InsightAnswer[] {
  const offset = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const start = offset(27), comparisonStart = offset(89);
  const recent = sessions.filter(s => s.date && s.date >= start && s.date <= today);
  const weeklyDays = Array.from({ length: 4 }, (_, index) => {
    const from = offset(27 - index * 7), to = offset(21 - index * 7);
    return new Set(recent.filter(s => s.date && s.date >= from && s.date <= to).map(s => s.date)).size;
  });
  const weeks = weeklyDays.filter(n => n > 0).length;
  const comparisons = trainingInsights(sessions.filter(s => s.date && s.date >= comparisonStart && s.date <= today)).filter(item => item.kind === "strength" || item.kind === "cardio");
  const weight = weightInsight(weights.filter(row => row.log_date >= comparisonStart && row.log_date <= today));
  return [
    { question: "Tränar jag regelbundet?", period: `${start} – ${today} · senaste 28 dagarna`, items: [{ title: recent.length ? `Träning under ${weeks} av 4 veckor` : "För lite underlag", detail: `${recent.length} genomförda pass, ${new Set(recent.map(s => s.date)).size} träningsdagar. Träningsdagar per sjudagarsperiod, äldst först: ${weeklyDays.join(" / ")}. Bara registrerade pass ingår; en tom period bevisar inte att du inte tränat.` }] },
    { question: "Ökar mina jämförbara resultat?", period: `${comparisonStart} – ${today} · senaste 90 dagarna`, items: comparisons.length ? comparisons : [{ title: "För lite underlag", detail: "Det behövs två pass på olika dagar med samma avbockade övningar, antal set och repetitioner, eller samma konditionsövning och distans. Olika pass jämförs inte som förbättring." }] },
    { question: "Hur förändras min vikt?", period: `${comparisonStart} – ${today} · senaste 90 dagarna`, items: weight ? [weight] : [{ title: "För lite underlag", detail: "Det behövs minst två vägningar på olika dagar. Inga antagna vikter eller prognoser ingår." }] },
  ];
}