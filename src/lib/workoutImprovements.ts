import { supabase } from "@/integrations/supabase/client";
import { summarizeCompletion, formatCardioPace, formatCardioDistance, type WorkoutSummary } from "@/lib/workoutSummary";

export interface Improvement {
  emoji: string;
  title: string;
  text: string;
}

type Kind =
  | "heavier"
  | "moreReps"
  | "exerciseVolume"
  | "faster"
  | "longerDistance"
  | "longerTime"
  | "lowerPulse"
  | "sessionVolume"
  | "moreSets";

interface Fact {
  kind: Kind;
  /** Higher = more impressive, used to rank */
  weight: number;
  vars: Record<string, string>;
}

/** Many phrasings per kind so the overlay never feels repetitive. {x} gets filled in. */
const TEMPLATES: Record<Kind, Array<{ emoji: string; title: string; text: string }>> = {
  heavier: [
    { emoji: "🏋️", title: "Tyngre än någonsin", text: "{ex}: {now} – {diff} mer än ditt förra bästa. Starkt!" },
    { emoji: "💥", title: "Ny vikt i boken", text: "Du tog {now} i {ex}. Förra toppen var {prev}." },
    { emoji: "🦍", title: "Råstyrka", text: "{diff} tyngre i {ex} än tidigare. Kroppen svarar på jobbet." },
    { emoji: "🚀", title: "Uppåt igen", text: "{ex} har gått från {prev} till {now}. Så bygger man styrka." },
    { emoji: "🔩", title: "Järnet rör sig", text: "{now} i {ex}! Det är ditt tyngsta hittills." },
    { emoji: "🧗", title: "Ny nivå", text: "Du klättrade {diff} i {ex}. Nästa gång blir det ännu mer." },
  ],
  moreReps: [
    { emoji: "🔁", title: "Fler reps, samma vikt", text: "{ex}: {now} reps på {kg} – förra gången {prev}. Det är progression!" },
    { emoji: "📈", title: "Uthålligare", text: "Du pressade ut {diff} reps mer på {kg} i {ex}." },
    { emoji: "💪", title: "Mer i tanken", text: "{now} reps på {kg} i {ex}. Snart är det dags att höja vikten." },
    { emoji: "🎯", title: "Repsen tickar upp", text: "{ex} på {kg}: från {prev} till {now} reps. Snyggt." },
  ],
  exerciseVolume: [
    { emoji: "📦", title: "Mer jobb gjort", text: "Total volym i {ex}: {now} – {pct} % mer än förra gången." },
    { emoji: "⚙️", title: "Volymen växer", text: "{ex} gav {now} idag mot {prev} senast. Mer arbete = mer resultat." },
    { emoji: "🧱", title: "Byggsten för byggsten", text: "{pct} % mer volym i {ex} än förra passet." },
  ],
  faster: [
    { emoji: "⚡", title: "Snabbare än förut", text: "{sport}: {now} idag mot {prev} senast. Benen är vassare!" },
    { emoji: "🏎️", title: "Tempot sitter", text: "Ditt snabbaste {sport}-pass hittills: {now}." },
    { emoji: "💨", title: "Vinden i ryggen?", text: "Nej, det är du som blivit bättre – {now} i {sport}, förra bästa {prev}." },
    { emoji: "🐆", title: "Kvick idag", text: "Du höll {now} i {sport}. Det är snabbare än någon tidigare gång." },
    { emoji: "⏱️", title: "Klockan ljuger inte", text: "{sport} på {now} – en tydlig förbättring från {prev}." },
  ],
  longerDistance: [
    { emoji: "🛣️", title: "Längre än någonsin", text: "{now} {sport} – din längsta sträcka hittills!" },
    { emoji: "🗺️", title: "Ny distans", text: "{sport}: {now}, förra längsta var {prev}. Uthålligheten växer." },
    { emoji: "🧭", title: "Längre bort", text: "Du tog dig {diff} längre i {sport} än tidigare." },
    { emoji: "🏁", title: "Fler kilometer", text: "{now} {sport} i ett svep. Det är riktigt bra." },
  ],
  longerTime: [
    { emoji: "⏳", title: "Mer tid i rörelse", text: "{now} {sport} – ditt längsta pass hittills." },
    { emoji: "🔋", title: "Batteriet räckte längre", text: "{sport} i {now}, mot {prev} som mest tidigare." },
    { emoji: "🌄", title: "Uthållig", text: "Du höll på {diff} längre i {sport} än någonsin." },
  ],
  lowerPulse: [
    { emoji: "❤️", title: "Hjärtat jobbar smartare", text: "Snittpuls {now} i {sport} mot {prev} senast – med samma eller bättre tempo. Konditionen växer!" },
    { emoji: "🫀", title: "Lugnare puls", text: "{diff} lägre puls i {sport} utan att tappa fart. Det är ren formkurva." },
    { emoji: "🧘", title: "Mindre ansträngning", text: "Samma jobb, lägre puls ({now}). Kroppen har anpassat sig." },
  ],
  sessionVolume: [
    { emoji: "🏆", title: "Tyngsta passet på länge", text: "{now} totalt idag – {pct} % mer än ditt snittpass." },
    { emoji: "🔥", title: "Över snittet", text: "Du lyfte {now} – klart mer än vanligt ({prev} i snitt)." },
    { emoji: "🐘", title: "Mycket järn", text: "{pct} % mer total volym än ett vanligt pass för dig. Imponerande." },
  ],
  moreSets: [
    { emoji: "🧮", title: "Fler set än vanligt", text: "{now} set idag mot {prev} i snitt. Stark arbetsmoral!" },
    { emoji: "🪜", title: "Extra steg", text: "Du körde {diff} set mer än ett vanligt pass." },
  ],
};

const RECENT_KEY = "grim_recent_improvement_templates";

const readRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};
const writeRecent = (ids: string[]) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 20))); } catch { /* ignore */ }
};

const fmtKg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} kg`;
const fmtVol = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} ton` : `${Math.round(n)} kg`);
const fmtMin = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${Math.round(n % 60)} min` : `${Math.round(n)} min`);
const lc = (s: string) => s.toLowerCase();

/** Compares the finished session with the user's history and lists real improvements. */
function findFacts(current: WorkoutSummary, history: WorkoutSummary[]): Fact[] {
  const facts: Fact[] = [];
  if (history.length === 0) return facts;

  // Strength, per exercise
  for (const [ex, st] of Object.entries(current.exerciseStats ?? {})) {
    const prev = history.map((h) => h.exerciseStats?.[ex]).filter(Boolean) as NonNullable<WorkoutSummary["exerciseStats"]>[string][];
    if (prev.length === 0) continue;
    const bestKg = Math.max(...prev.map((p) => p.maxKg));
    if (st.maxKg > 0 && bestKg > 0 && st.maxKg > bestKg) {
      facts.push({ kind: "heavier", weight: 10 + (st.maxKg - bestKg) / bestKg * 20, vars: { ex, now: fmtKg(st.maxKg), prev: fmtKg(bestKg), diff: fmtKg(st.maxKg - bestKg) } });
      continue;
    }
    const last = prev[0];
    const sameKg = prev.filter((p) => p.maxKg === st.maxKg);
    const bestRepsAtKg = sameKg.length ? Math.max(...sameKg.map((p) => p.repsAtMax)) : 0;
    if (st.maxKg > 0 && bestRepsAtKg > 0 && st.repsAtMax > bestRepsAtKg) {
      facts.push({ kind: "moreReps", weight: 7 + (st.repsAtMax - bestRepsAtKg), vars: { ex, kg: fmtKg(st.maxKg), now: String(st.repsAtMax), prev: String(bestRepsAtKg), diff: String(st.repsAtMax - bestRepsAtKg) } });
      continue;
    }
    if (last.volumeKg > 0 && st.volumeKg > last.volumeKg * 1.1) {
      const pct = Math.round((st.volumeKg / last.volumeKg - 1) * 100);
      facts.push({ kind: "exerciseVolume", weight: 4 + pct / 10, vars: { ex, now: fmtVol(st.volumeKg), prev: fmtVol(last.volumeKg), pct: String(pct) } });
    }
  }

  // Cardio, same primary sport
  const c = current.cardio;
  if (c) {
    const sport = c.primaryName;
    const prev = history.map((h) => h.cardio).filter((h): h is NonNullable<typeof h> => !!h && lc(h.primaryName) === lc(sport));
    if (prev.length > 0) {
      const paceOf = (x: { minutes: number; distanceKm: number }) => (x.minutes > 0 && x.distanceKm >= 0.3 ? x.minutes / x.distanceKm : Infinity);
      const nowPace = paceOf(c);
      const bestPrev = prev.reduce((b, p) => (paceOf(p) < paceOf(b) ? p : b), prev[0]);
      const bestPace = paceOf(bestPrev);
      if (isFinite(nowPace) && isFinite(bestPace) && nowPace < bestPace * 0.99) {
        facts.push({ kind: "faster", weight: 9 + (bestPace / nowPace - 1) * 40, vars: {
          sport: lc(sport),
          now: formatCardioPace(c.minutes, c.distanceKm, sport).value,
          prev: formatCardioPace(bestPrev.minutes, bestPrev.distanceKm, sport).value,
        } });
      } else {
        const lastP = prev[0];
        if (c.pulse && lastP.pulse && isFinite(nowPace) && nowPace <= paceOf(lastP) * 1.01 && c.pulse < lastP.pulse - 2) {
          facts.push({ kind: "lowerPulse", weight: 7, vars: { sport: lc(sport), now: `${c.pulse} bpm`, prev: `${lastP.pulse} bpm`, diff: `${lastP.pulse - c.pulse} slag` } });
        }
      }
      const bestKm = Math.max(...prev.map((p) => p.distanceKm));
      if (c.distanceKm > 0 && bestKm > 0 && c.distanceKm > bestKm * 1.02) {
        facts.push({ kind: "longerDistance", weight: 8 + (c.distanceKm / bestKm - 1) * 20, vars: {
          sport: lc(sport),
          now: formatCardioDistance(c.distanceKm, sport),
          prev: formatCardioDistance(bestKm, sport),
          diff: formatCardioDistance(c.distanceKm - bestKm, sport),
        } });
      } else {
        const bestMin = Math.max(...prev.map((p) => p.minutes));
        if (c.minutes > 0 && bestMin > 0 && c.minutes > bestMin * 1.05) {
          facts.push({ kind: "longerTime", weight: 6, vars: { sport: lc(sport), now: fmtMin(c.minutes), prev: fmtMin(bestMin), diff: fmtMin(c.minutes - bestMin) } });
        }
      }
    }
  }

  // Whole session vs. average
  const strengthHist = history.filter((h) => h.volumeKg > 0);
  if (current.volumeKg > 0 && strengthHist.length >= 3) {
    const avg = strengthHist.reduce((s, h) => s + h.volumeKg, 0) / strengthHist.length;
    if (current.volumeKg > avg * 1.15) {
      const pct = Math.round((current.volumeKg / avg - 1) * 100);
      facts.push({ kind: "sessionVolume", weight: 5 + pct / 15, vars: { now: fmtVol(current.volumeKg), prev: fmtVol(avg), pct: String(pct) } });
    }
  }
  const setHist = history.filter((h) => h.sets > 0);
  if (current.sets > 0 && setHist.length >= 3) {
    const avg = Math.round(setHist.reduce((s, h) => s + h.sets, 0) / setHist.length);
    if (current.sets >= avg + 3) {
      facts.push({ kind: "moreSets", weight: 3, vars: { now: String(current.sets), prev: String(avg), diff: String(current.sets - avg) } });
    }
  }

  return facts.sort((a, b) => b.weight - a.weight);
}

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/** Turns facts into messages, avoiding phrasings shown recently. */
function render(facts: Fact[], max: number): Improvement[] {
  const recent = readRecent();
  const usedKinds = new Set<Kind>();
  const out: Improvement[] = [];
  const shown: string[] = [];
  for (const f of facts) {
    if (out.length >= max) break;
    // Max one message per kind, except heavier lifts which are always worth celebrating
    if (usedKinds.has(f.kind) && f.kind !== "heavier") continue;
    const list = TEMPLATES[f.kind].map((t, i) => ({ t, id: `${f.kind}:${i}` }));
    const fresh = list.filter((x) => !recent.includes(x.id) && !shown.includes(x.id));
    const pool = fresh.length ? fresh : list;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    shown.push(chosen.id);
    usedKinds.add(f.kind);
    out.push({ emoji: chosen.t.emoji, title: chosen.t.title, text: fill(chosen.t.text, f.vars) });
  }
  if (shown.length) writeRecent([...shown, ...recent]);
  return out;
}

const signature = (s: WorkoutSummary) => `${s.sets}|${s.volumeKg}|${Math.round(s.cardio?.minutes ?? 0)}|${(s.cardio?.distanceKm ?? 0).toFixed(2)}`;

/** Finds up to `max` real improvements in the finished workout compared with earlier sessions. */
export async function findWorkoutImprovements(userId: string, current: WorkoutSummary | null, max = 2): Promise<Improvement[]> {
  if (!userId || !current) return [];
  try {
    const [compRes, archRes] = await Promise.all([
      supabase
        .from("workout_completions")
        .select("logged_weights, updated_at")
        .eq("user_id", userId)
        .eq("done", true)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase.from("archived_plans").select("completion_data").eq("user_id", userId),
    ]);
    let history = ((compRes.data || []) as any[]).map((r) => summarizeCompletion(r.logged_weights));
    // The just-finished workout may already be saved – drop it once.
    const sig = signature(current);
    const idx = history.findIndex((h) => signature(h) === sig);
    if (idx !== -1) history.splice(idx, 1);
    for (const row of (archRes.data || []) as any[]) {
      if (!Array.isArray(row?.completion_data)) continue;
      for (const c of row.completion_data) {
        if (c?.done && c.logged_weights) history.push(summarizeCompletion(c.logged_weights));
      }
    }
    history = history.filter((h) => h.sets > 0 || h.cardio);
    return render(findFacts(current, history), max);
  } catch {
    return [];
  }
}
