import { isPlausibleSet, parseNum } from "@/lib/inputValidation";
import { getSetTypes } from "@/lib/setTypes";
import { summarizeCompletion } from "@/lib/workoutSummary";

export interface SparringReference { post_id: string; nickname: string | null; logged_weights: Record<string, unknown> | null }
export function readSparring(raw: unknown): SparringReference | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.post_id !== "string") return null;
  return { post_id: r.post_id, nickname: typeof r.nickname === "string" ? r.nickname : null, logged_weights: r.logged_weights && typeof r.logged_weights === "object" && !Array.isArray(r.logged_weights) ? r.logged_weights as Record<string, unknown> : null };
}
export function sparringSet(lw: Record<string, unknown> | null, name: string, index: number): { kg: string; reps: string } | null {
  if (!lw || String(lw[`__sets__${name}`] ?? "")[index] !== "1" || getSetTypes(lw, name)[index] === "w") return null;
  try {
    const raw = lw[`__setdata__${name}`];
    const rows = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(rows)) return null;
    const row = rows[index];
    return row && isPlausibleSet(row.kg, row.reps) ? { kg: String(row.kg), reps: String(row.reps) } : null;
  } catch { return null; }
}
export function compareSparring(reference: SparringReference, current: Record<string, unknown>, details: string): { matched: number; higher: number; compared: number; cardio: string | null } {
  let matched = 0, higher = 0, compared = 0;
  for (const key of Object.keys(reference.logged_weights ?? {})) {
    if (!key.startsWith("__setdata__")) continue;
    const name = key.slice(11);
    // Never score altered rosters, timed/distance exercises, or bodyweight modes as lifted kg.
    if (!details.split(/[;\n]/).some(l => l.trim().split(" — ")[0] === name) || /planka|walk|sled|burpee|pull.up|armhäv|dips|jump/i.test(name)) continue;
    const marks = String(reference.logged_weights?.[`__sets__${name}`] ?? "");
    for (let i = 0; i < marks.length; i++) {
      const before = sparringSet(reference.logged_weights, name, i), now = sparringSet(current, name, i);
      if (!before || !now || parseNum(before.reps) !== parseNum(now.reps) || parseNum(before.kg) <= 0 || parseNum(now.kg) <= 0) continue;
      if ([reference.logged_weights, current].some(w => w && Object.keys(w).some(k => k.startsWith(`__bw_mode__${name}`)))) continue;
      compared++;
      if (parseNum(now.kg) === parseNum(before.kg)) matched++;
      if (parseNum(now.kg) > parseNum(before.kg)) higher++;
    }
  }
  const a = summarizeCompletion(reference.logged_weights).cardio, b = summarizeCompletion(current).cardio;
  const comparable = a && b && a.count === 1 && b.count === 1 && a.primaryName === b.primaryName && a.distanceKm > 0 && Math.abs(a.distanceKm - b.distanceKm) < 0.001 && a.minutes > 0 && b.minutes > 0;
  const delta = comparable ? b.minutes - a.minutes : null;
  return { matched, higher, compared, cardio: delta === null ? null : delta === 0 ? "Samma tid på samma distans" : `${Math.abs(delta).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} min ${delta < 0 ? "snabbare" : "långsammare"} på samma distans` };
}