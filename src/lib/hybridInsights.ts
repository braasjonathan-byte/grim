import type { HistorySession } from "@/lib/workoutHistory";
import { allCheckedSets, sessionVolumeKg } from "@/lib/checkedSets";
import { summarizeCompletion } from "@/lib/workoutSummary";
import type { InsightAnswer } from "@/lib/trainingInsights";

const fmt = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
const lowerBody = /^(knäböj|frontböj|pausböj|benpress|marklyft|rumänsk marklyft|sumo marklyft|bulgarska utfall|enbensutfall|bencurl|benextension|hip thrust)$/i;
const running = /^(löpning|löpband|jogg|jogging)$/i;
const timestamp = (s: HistorySession) => {
  const raw = s.completion.logged_weights?.__first_set_at__;
  const value = typeof raw === "string" ? Date.parse(raw) : NaN;
  return Number.isFinite(value) && s.date === new Date(value).toISOString().slice(0, 10) ? value : null;
};

/** Separate measured units: never invent a combined strength/cardio load score. */
export function hybridAnswers(sessions: HistorySession[], today: string): InsightAnswer[] {
  const offset = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const unique = [...new Map(sessions.map(s => [s.id, s])).values()].filter(s => s.date && s.date >= offset(89) && s.date <= today);
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const from = offset(27 - i * 7), to = offset(21 - i * 7);
    const rows = unique.filter(s => s.date && s.date >= from && s.date <= to);
    const cardio = rows.map(s => summarizeCompletion(s.completion.logged_weights).cardio).filter(c => c && c.minutes > 0 && c.minutes <= 1440 && c.distanceKm >= 0 && c.distanceKm <= 300);
    return { title: `${from} – ${to}`, detail: `${fmt(rows.reduce((n, s) => n + sessionVolumeKg(s.completion.logged_weights), 0) / 1000)} ton lyft · ${fmt(cardio.reduce((n, c) => n + (c?.minutes ?? 0), 0))} min kondition · ${fmt(cardio.reduce((n, c) => n + (c?.distanceKm ?? 0), 0))} km. ${rows.length} registrerade pass.` };
  });
  const legs = unique.filter(s => [...allCheckedSets(s.completion.logged_weights)].some(([name, rows]) => lowerBody.test(name) && rows.length > 0));
  const groups = new Map<string, { after: number[]; other: number[]; name: string; km: number }>();
  for (const s of unique) {
    const time = timestamp(s), c = summarizeCompletion(s.completion.logged_weights).cardio;
    if (time === null || !c || c.count !== 1 || !running.test(c.primaryName) || c.minutes <= 0 || c.minutes > 1440 || c.distanceKm <= 0 || c.distanceKm > 300) continue;
    // Date-only leg sessions cannot establish a 48-hour interval: omit ambiguous runs.
    if (legs.some(l => timestamp(l) === null && l.date && l.date <= (s.date ?? "") && l.date >= new Date(time - 2 * 86400000).toISOString().slice(0, 10))) continue;
    const after = legs.some(l => { const t = timestamp(l); return t !== null && time > t && time - t <= 48 * 3600000; });
    // A mixed run/leg session is not an unexposed comparison.
    if (legs.some(l => l.id === s.id)) continue;
    const key = `${c.primaryName.toLowerCase()}:${c.distanceKm.toFixed(3)}`;
    const group = groups.get(key) ?? { after: [], other: [], name: c.primaryName, km: c.distanceKm };
    (after ? group.after : group.other).push(c.minutes / c.distanceKm);
    groups.set(key, group);
  }
  const candidates = [...groups.values()].filter(g => g.after.length >= 3 && g.other.length >= 3).sort((a, b) => (b.after.length + b.other.length) - (a.after.length + a.other.length));
  const g = candidates[0];
  const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  return [
    { question: "Styrka och kondition tillsammans", period: `${offset(27)} – ${today} · fyra sjudagarsperioder`, items: weeks },
    { question: "Löpning efter benpass", period: `${offset(89)} – ${today} · 48-timmarsfönster`, items: [g ? { title: `${g.name} · ${fmt(g.km)} km`, detail: `${fmt(average(g.after))} min/km efter registrerat benpass (${g.after.length} löppass), mot ${fmt(average(g.other))} min/km utan registrerat benpass inom 48 timmar (${g.other.length} löppass). Samma övning och distans. Detta är ett samband, inte bevis på påverkan eller utvilade ben; terräng, väder, ansträngning och oregistrerad träning kan skilja.` } : { title: "För lite underlag", detail: "Minst tre löppass i varje grupp på samma distans och med samma övningsnamn behövs. Bara pass med registrerad starttid används för 48 timmar; datum räcker inte. Benpass utan känd tid gör närliggande löppass osäkra." }] },
  ];
}