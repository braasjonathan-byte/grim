/**
 * Sammanfattningar av tidigare löp- och cykelpass för jämförelsen i
 * pulsanalysen. Läser bara via workoutHistory (samma källa som historiken).
 */
import { loadWorkoutHistory, WORKOUTS_CHANGED_EVENT, type HistorySession } from "@/lib/workoutHistory";
import { parseMinPerKm } from "@/lib/workoutDistance";
import { sportKind, type CardioSummary } from "@/lib/pulseAnalysis";

export const COND_PREFIX = "__cond__";

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export interface CondEntry { name: string; data: Record<string, any> }

/** Alla konditionsrader i ett pass (tål trasig JSON). */
export function condEntries(loggedWeights: unknown): CondEntry[] {
  if (!loggedWeights || typeof loggedWeights !== "object") return [];
  const out: CondEntry[] = [];
  for (const [k, v] of Object.entries(loggedWeights as Record<string, unknown>)) {
    if (!k.startsWith(COND_PREFIX)) continue;
    try {
      const data = typeof v === "string" ? JSON.parse(v) : v;
      if (data && typeof data === "object") out.push({ name: k.slice(COND_PREFIX.length), data: data as Record<string, any> });
    } catch { /* hoppa över */ }
  }
  return out;
}

/** Huvudraden för löpning/cykling: den längsta konditionsraden av rätt sport. */
export function mainCardioEntry(loggedWeights: unknown, sessionName = ""): CondEntry | null {
  const entries = condEntries(loggedWeights).filter((e) => sportKind(e.name) ?? sportKind(sessionName));
  if (!entries.length) return null;
  return entries.reduce((best, e) => (num(e.data.time) > num(best.data.time) ? e : best));
}

/** Sammanfattning för jämförelse, eller null om passet saknar sport, distans, tid eller puls. */
export function cardioSummaryFromSession(s: HistorySession): CardioSummary | null {
  if (!s.date) return null;
  const entry = mainCardioEntry(s.completion?.logged_weights, s.name);
  if (entry) {
    const sport = sportKind(entry.name) ?? sportKind(s.name);
    const distanceKm = num(entry.data.dist);
    const minutes = num(entry.data.time);
    const avgHr = num(entry.data.pulse) || (condEntries(s.completion?.logged_weights).length === 1 ? Number(s.pulse) || 0 : 0);
    if (!sport || !(distanceKm > 0) || !(minutes > 0) || !(avgHr > 0)) return null;
    return { id: s.id, date: s.date, sport, distanceKm, minutes, avgHr };
  }
  // Pass utan konditionsrad (t.ex. tidigare Strava-import): värden på passnivå.
  const sport = sportKind(s.name) ?? sportKind(s.details);
  const distanceKm = Number(s.distanceKm) || 0;
  const minPerKm = parseMinPerKm(String(s.tempo ?? ""));
  const minutes = minPerKm > 0 ? minPerKm * distanceKm : 0;
  const avgHr = Number(s.pulse) || 0;
  if (!sport || !(distanceKm > 0) || !(minutes > 0) || !(avgHr > 0)) return null;
  return { id: s.id, date: s.date, sport, distanceKm, minutes, avgHr };
}

/** Matchar konditionsraden som visas mot rätt pass i historiken. */
export function findSessionForEntry(sessions: HistorySession[], name: string, data: Record<string, any> | null): HistorySession | null {
  if (!data) return null;
  const key = `${COND_PREFIX}${name}`;
  const same = (v: unknown) => {
    try {
      const o = typeof v === "string" ? JSON.parse(v) : v;
      return !!o && String(o.time ?? "") === String(data.time ?? "") && String(o.dist ?? "") === String(data.dist ?? "") && String(o.pulse ?? "") === String(data.pulse ?? "");
    } catch { return false; }
  };
  return sessions.find((s) => same(s.completion?.logged_weights?.[key])) ?? null;
}

let cache: { userId: string; at: number; promise: Promise<HistorySession[]> } | null = null;
if (typeof window !== "undefined") window.addEventListener(WORKOUTS_CHANGED_EVENT, () => { cache = null; });

/** Historiken laddas en gång per minut och delas mellan alla analyser på skärmen. */
export function loadHistoryCached(userId: string): Promise<HistorySession[]> {
  if (cache && cache.userId === userId && Date.now() - cache.at < 60000) return cache.promise;
  const promise = loadWorkoutHistory(userId).catch((e) => { cache = null; throw e; });
  cache = { userId, at: Date.now(), promise };
  return promise;
}
