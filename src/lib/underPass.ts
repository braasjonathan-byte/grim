/**
 * "Under passet"-hjälpare för styrka v2:
 *  - Förra gången-sammanfattning ("3×8 @ 80 kg")
 *  - RPE per set (lagras i logged_weights: __rpe__<övning> = "8,,9.5")
 *  - Uppvärmningsrampa 40/60/80 %
 *  - Smart ersättning (samma muskel + utrustning)
 */
export type PrevSet = { kg: string; reps: string };

const num = (v: string | undefined) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? null : n;
};
const fmtKg = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

/** "3×8 @ 80 kg" om alla set lika, annars "80×8 · 80×8 · 75×6". */
export function formatPrevSummary(sets: PrevSet[]): string | null {
  const clean = sets.filter((s) => (num(s.reps) ?? 0) > 0 || (num(s.kg) ?? 0) !== 0);
  if (!clean.length) return null;
  const allSame = clean.every((s) => s.kg === clean[0].kg && s.reps === clean[0].reps);
  const kg0 = num(clean[0].kg);
  if (allSame) {
    const reps = clean[0].reps || "?";
    return kg0 ? `${clean.length}×${reps} @ ${fmtKg(kg0)} kg` : `${clean.length}×${reps}`;
  }
  const parts = clean.slice(0, 6).map((s) => {
    const k = num(s.kg);
    return k ? `${fmtKg(k)}×${s.reps || "?"}` : `${s.reps || "?"} reps`;
  });
  return parts.join(" · ") + (clean.length > 6 ? " …" : "");
}

// ---------- RPE ----------
export const RPE_KEY = (exercise: string) => `__rpe__${exercise}`;
export const RPE_VALUES = ["6", "7", "7.5", "8", "8.5", "9", "9.5", "10"] as const;

export function getRpes(weights: Record<string, any> | null | undefined, exercise: string): string[] {
  const raw = weights?.[RPE_KEY(exercise)];
  return typeof raw === "string" ? raw.split(",") : [];
}
export function getRpe(weights: Record<string, any> | null | undefined, exercise: string, si: number): string | null {
  const v = getRpes(weights, exercise)[si];
  return v ? v : null;
}
/** Sätt/ta bort (value=null) RPE för ett set. Returnerar ny sträng eller "" om tomt. */
export function withRpe(current: string[], si: number, value: string | null): string {
  const arr = Array.from({ length: Math.max(current.length, si + 1) }, (_, i) => current[i] || "");
  arr[si] = value ?? "";
  while (arr.length && !arr[arr.length - 1]) arr.pop();
  return arr.join(",");
}
/** RIR motsvarande RPE (10 − RPE). */
export const rpeToRir = (rpe: string) => {
  const n = num(rpe);
  return n === null ? null : Math.max(0, 10 - n);
};

// ---------- Uppvärmning ----------
export type WarmupStep = { pct: number; kg: number; reps: number };
/** 40/60/80 % av arbetsvikten, avrundat till 2,5 kg, minst 20 kg (stång). Tomt om < 40 kg. */
export function warmupRamp(workKg: number, step = 2.5): WarmupStep[] {
  if (!isFinite(workKg) || workKg < 40) return [];
  const plan: Array<[number, number]> = [[0.4, 8], [0.6, 5], [0.8, 3]];
  const out: WarmupStep[] = [];
  for (const [p, reps] of plan) {
    const kg = Math.max(20, Math.round((workKg * p) / step) * step);
    if (out.length && out[out.length - 1].kg === kg) continue;
    if (kg >= workKg) continue;
    out.push({ pct: Math.round(p * 100), kg, reps });
  }
  return out;
}

const HEAVY_RE = /(knäböj|squat|marklyft|deadlift|bänkpress|bench|press|rodd|row|frontböj|hip thrust|chins|pull.?up|dips)/i;
/** Är övningen en "tung" basövning där uppvärmningsrampa är rimlig? */
export const isHeavyCompound = (name: string) => HEAVY_RE.test(name) && !/(flyes?|curl|lateral|sidolyft|kabel.*fly)/i.test(name);

// ---------- Smart ersättning ----------
export type Equipment = "skivstång" | "hantel" | "kabel" | "maskin" | "kettlebell" | "kroppsvikt" | "band" | "övrigt";
export function equipmentOf(name: string): Equipment {
  const n = name.toLowerCase();
  if (/hantel|hantlar|dumbbell|\bdb\b/.test(n)) return "hantel";
  if (/kabel|cable|cablecross|pulldown|latsdrag|face ?pull/.test(n)) return "kabel";
  if (/maskin|machine|smith|leg press|benpress|hack|pec deck|leg curl|leg extension|bencurl|bensträck/.test(n)) return "maskin";
  if (/kettlebell|\bkb\b/.test(n)) return "kettlebell";
  if (/band/.test(n)) return "band";
  if (/armhävning|push.?up|pull.?up|chins|dips|plank|sit.?up|utfall utan|kroppsvikt|pistol|inverted|ring/.test(n)) return "kroppsvikt";
  if (/skivstång|stång|barbell|marklyft|knäböj|bänkpress|militärpress|frontböj|good morning|hip thrust/.test(n)) return "skivstång";
  return "övrigt";
}

export type LibEx = { name: string; muscleGroup: string; category: string };
/**
 * 3–5 ersättare: samma muskelgrupp och kategori; samma utrustning först,
 * sedan övningar du loggat förut, sedan övriga.
 */
export function suggestSubstitutes(
  current: string,
  library: LibEx[],
  opts?: { hasHistory?: (name: string) => boolean; exclude?: string[]; max?: number },
): string[] {
  const lc = current.trim().toLowerCase();
  const me = library.find((e) => e.name.toLowerCase() === lc);
  if (!me) return [];
  const eq = equipmentOf(me.name);
  const excl = new Set([lc, ...(opts?.exclude || []).map((x) => x.trim().toLowerCase())]);
  const cands = library.filter((e) => e.muscleGroup === me.muscleGroup && e.category === me.category && !excl.has(e.name.toLowerCase()));
  const seen = new Set<string>();
  const scored = cands
    .filter((e) => (seen.has(e.name.toLowerCase()) ? false : (seen.add(e.name.toLowerCase()), true)))
    .map((e, i) => ({
      name: e.name,
      s: (equipmentOf(e.name) === eq ? 10 : 0) + (opts?.hasHistory?.(e.name) ? 5 : 0) - i * 0.01,
    }))
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, opts?.max ?? 5).map((x) => x.name);
}

/**
 * Lägg uppvärmningsset först i en övnings loggdata. Flyttar setdata, bockar,
 * settyper, RPE och per-set kroppsviktsläge så att arbetsseten behåller sina värden.
 */
export function prependWarmups(
  lw: Record<string, any>,
  exercise: string,
  ramp: WarmupStep[],
  oldCount: number,
): Record<string, any> {
  const n = ramp.length;
  if (!n) return lw;
  const out = { ...lw };
  let rows: any[] = [];
  try {
    const raw = lw[`__setdata__${exercise}`];
    const p = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(p)) rows = p;
  } catch { /* tomt */ }
  const padded = Array.from({ length: Math.max(oldCount, rows.length) }, (_, i) => rows[i] ?? { kg: "", reps: "" });
  out[`__setdata__${exercise}`] = JSON.stringify([...ramp.map((r) => ({ kg: String(r.kg), reps: String(r.reps) })), ...padded]);
  const marks = String(lw[`__sets__${exercise}`] ?? "").padEnd(oldCount, "0");
  out[`__sets__${exercise}`] = "0".repeat(n) + marks;
  const types = String(lw[`__settypes__${exercise}`] ?? "").padEnd(oldCount, "n");
  out[`__settypes__${exercise}`] = "w".repeat(n) + types;
  const rpe = typeof lw[RPE_KEY(exercise)] === "string" ? String(lw[RPE_KEY(exercise)]) : "";
  if (rpe) out[RPE_KEY(exercise)] = ",".repeat(n) + rpe;
  for (let i = oldCount - 1; i >= 0; i--) {
    const k = `__bw_mode__${exercise}__${i}`;
    if (k in lw) { out[`__bw_mode__${exercise}__${i + n}`] = lw[k]; delete out[k]; }
  }
  delete out[`__copied_ex__${exercise}`];
  return out;
}

/** Plan-raden "Knäböj — 3×5 @ 100 kg" → "Knäböj — 6×5 @ 100 kg" (n extra set). */
export function bumpLineSets(line: string, n: number): string {
  if (/(\d+)\s*[×x]/i.test(line)) return line.replace(/(\d+)\s*([×x])/i, (_m, s) => `${parseInt(s) + n}×`);
  return line;
}
