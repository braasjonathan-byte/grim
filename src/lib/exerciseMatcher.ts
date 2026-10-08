import { normalizeSearchText } from "@/lib/fuzzySearch";

/**
 * Sökord -> synonym(er) (svenska och engelska). Används för att hitta rätt
 * övning även när användaren söker på ett engelskt ord eller en vanlig
 * synonym. Allt normaliseras (gemener, utan diakritik) vid matchning.
 */
export const EXERCISE_SEARCH_SYNONYMS: Record<string, string[]> = {
  bike: ["cykel", "cykling", "spinning", "motionscykel"],
  cycling: ["cykel", "cykling"],
  deadlift: ["marklyft"],
  rdl: ["rumansk marklyft"],
  squat: ["knaboj", "boj"],
  bench: ["bankpress"],
  row: ["rodd"],
  hip: ["hoft"],
  hoft: ["hip"],
  run: ["lopning", "lopband"],
  running: ["lopning", "lopband"],
  treadmill: ["lopband"],
  swim: ["simning"],
  swimming: ["simning"],
  walk: ["promenad"],
  walking: ["promenad"],
  rowing: ["rodd", "roddmaskin"],
  pulldown: ["latsdrag"],
  pullup: ["chins"],
  chinup: ["chins"],
  pushup: ["armhavning"],
};

export interface MatchableExercise {
  name: string;
  englishName?: string | null;
}

const prefixMatchWord = (text: string, term: string): boolean =>
  text.split(" ").some((w) => w.startsWith(term));

const exactMatchWord = (text: string, term: string): boolean =>
  text.split(" ").some((w) => w === term);

/**
 * Poängsätter en övning mot en sökterm med ord-prefix-matchning (ingen
 * fuzzy-substring-brus). Rangordning: exakt namn > exakt ord i namnet >
 * namnet börjar med termen > ett ord i namnet börjar med termen.
 * Synonymer expanderas till extra sökkandidater.
 */
export function scoreExerciseMatch(exercise: MatchableExercise, query: string): number {
  const q = normalizeSearchText(query);
  if (!q) return 1;

  const terms = q.split(" ").filter(Boolean);
  const nameN = normalizeSearchText(exercise.name);
  const enN = exercise.englishName ? normalizeSearchText(exercise.englishName) : "";
  const wordCount = nameN.split(" ").filter(Boolean).length;

  let total = 0;
  for (const term of terms) {
    const synonyms = EXERCISE_SEARCH_SYNONYMS[term] || [];
    const candidates = [term, ...synonyms.map((s) => normalizeSearchText(s))];

    let best = 0;
    for (const cand of candidates) {
      if (!cand) continue;
      if (nameN === cand || enN === cand) best = Math.max(best, 1000);
      else if (exactMatchWord(nameN, cand) || exactMatchWord(enN, cand)) best = Math.max(best, 900);
      else if (nameN.startsWith(cand) || enN.startsWith(cand)) best = Math.max(best, 700);
      else if (prefixMatchWord(nameN, cand) || prefixMatchWord(enN, cand)) best = Math.max(best, 500);
    }
    if (best === 0) return 0; // alla sökord måste matcha något
    total += best;
  }

  // Tiebreak: kortare namn med färre ord rankas något högre
  // (t.ex. "Löpning" före "Low Row (Technogym)" för sökningen "lö").
  total += Math.max(0, 10 - wordCount * 3) + Math.max(0, 20 - nameN.length);
  return total;
}

/** Filtrerar och relevanssorterar övningar med ord-prefix-matchning. */
export function matchExercises<T extends MatchableExercise>(items: T[], query: string): T[] {
  const q = (query || "").trim();
  if (!q) return items;
  return items
    .map((item) => ({ item, score: scoreExerciseMatch(item, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
