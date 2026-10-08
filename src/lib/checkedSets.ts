import { isPlausibleSet, parseNum } from "@/lib/inputValidation";

/**
 * Single rule for which logged sets count (PR, volume, history, calendar, stats):
 * only checked-off sets (`__sets__<name>` = "1" at that index). Legacy rows that
 * never had check marks count when they carry real values. Implausible values never count.
 */
export type CheckedSet = { kg: string; reps: string };

const parseRows = (raw: unknown): any[] => {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

export function checkedSetsFor(lw: Record<string, any>, name: string): CheckedSet[] {
  const rows = parseRows(lw[`__setdata__${name}`]);
  const hasMarks = Object.prototype.hasOwnProperty.call(lw, `__sets__${name}`);
  const marks = String(lw[`__sets__${name}`] ?? "");
  const out: CheckedSet[] = [];
  rows.forEach((r, i) => {
    const kg = String(r?.kg ?? "");
    const reps = String(r?.reps ?? "");
    if (hasMarks ? marks[i] !== "1" : !((parseNum(kg) || 0) > 0 || (parseInt(reps) || 0) > 0)) return;
    if (!isPlausibleSet(kg, reps)) return;
    out.push({ kg, reps });
  });
  return out;
}

/** All exercises with set data → their counting sets. */
export function allCheckedSets(lw: unknown): Map<string, CheckedSet[]> {
  const map = new Map<string, CheckedSet[]>();
  if (!lw || typeof lw !== "object") return map;
  const w = lw as Record<string, any>;
  for (const key of Object.keys(w)) {
    if (!key.startsWith("__setdata__")) continue;
    const name = key.slice("__setdata__".length);
    map.set(name, checkedSetsFor(w, name));
  }
  return map;
}

export const setVolumeKg = (s: CheckedSet) => {
  const kg = parseNum(s.kg) || 0;
  const reps = parseInt(s.reps) || 0;
  return kg > 0 && reps > 0 ? kg * reps : 0;
};

/** Total lifted kg for one workout, from checked sets only. */
export function sessionVolumeKg(lw: unknown): number {
  let total = 0;
  for (const sets of allCheckedSets(lw).values()) for (const s of sets) total += setVolumeKg(s);
  return total;
}
