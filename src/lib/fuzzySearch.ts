/**
 * Lättviktig fuzzy-sökning för övningar och liknande listor.
 *
 * Stödjer:
 *  - Diakritik-okänslig matchning (a/å/ä, o/ö, e/é)
 *  - Delordssökning: varje sökord kan matcha var som helst i namnet
 *  - Felstavningstolerans via Levenshtein-distans (1 fel på korta ord, 2 på längre)
 *  - Relevanssortering (exakt > prefix > delsträng > fuzzy)
 */

/** Normaliserar text: gemener, trimmad, utan diakritiska tecken och skiljetecken. */
export function normalizeSearchText(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Levenshtein-distans med tidig avbrytning när distansen överstiger `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

/** Hur många teckenfel som tillåts för ett sökord av given längd. */
function allowedDistance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

/**
 * Poängsätter hur väl `target` matchar `query`.
 * Returnerar 0 om ingen matchning, annars ett positivt tal (högre = bättre).
 */
export function fuzzyScore(target: string, query: string): number {
  const t = normalizeSearchText(target);
  const q = normalizeSearchText(query);
  if (!q) return 1;
  if (!t) return 0;

  const terms = q.split(" ").filter(Boolean);
  const words = t.split(" ").filter(Boolean);
  let total = 0;

  for (const term of terms) {
    let best = 0;

    if (t === term) best = 1000;
    else if (t.startsWith(term)) best = 700;
    else if (t.includes(term)) best = 500;

    if (best < 700) {
      for (const w of words) {
        if (w === term) best = Math.max(best, 800);
        else if (w.startsWith(term)) best = Math.max(best, 650);
        else if (w.includes(term)) best = Math.max(best, 450);
      }
    }

    if (best === 0) {
      // Felstavningstolerans: jämför sökordet mot varje ord och mot inledningen av ordet
      const max = allowedDistance(term.length);
      if (max > 0) {
        for (const w of words) {
          const dist = levenshtein(term, w, max);
          if (dist <= max) {
            best = Math.max(best, 300 - dist * 50);
            continue;
          }
          // Prefix-fuzzy: "bänkpres" mot "bänkpressmaskin"
          if (w.length > term.length) {
            const head = w.slice(0, term.length + max);
            const d2 = levenshtein(term, head, max);
            if (d2 <= max) best = Math.max(best, 250 - d2 * 50);
          }
        }
      }
    }

    if (best === 0) return 0; // alla sökord måste matcha något
    total += best;
  }

  // Kortare namn som matchar hela sökningen rankas något högre
  return total + Math.max(0, 40 - t.length);
}

/** True om `target` matchar sökfrågan (fuzzy). */
export function fuzzyMatch(target: string, query: string): boolean {
  return fuzzyScore(target, query) > 0;
}

/**
 * Matchar mot flera fält (t.ex. svenskt namn + engelskt namn + muskelgrupp)
 * och returnerar bästa poängen.
 */
export function fuzzyScoreMulti(fields: (string | undefined | null)[], query: string): number {
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    const s = fuzzyScore(f, query);
    if (s > best) best = s;
  }
  return best;
}

/** Filtrerar och relevanssorterar en lista utifrån en sökfråga. */
export function fuzzyFilterSort<T>(
  items: T[],
  query: string,
  getFields: (item: T) => (string | undefined | null)[]
): T[] {
  const q = (query || "").trim();
  if (!q) return items;
  return items
    .map((item) => ({ item, score: fuzzyScoreMulti(getFields(item), q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
