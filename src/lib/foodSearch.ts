/**
 * Ordbaserad livsmedelssökning: alla sökord måste finnas i namnet (valfri ordning),
 * accent-okänslig (é→e, å/ä/ö behålls), sammansatta ord matchar delade namn
 * ("nötfärs" → "Nöt färs"), plus en liten synonymtabell.
 */

const ACCENTS: Record<string, string> = {
  é: "e", è: "e", ê: "e", ë: "e", á: "a", à: "a", â: "a", í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o", ú: "u", ù: "u", û: "u", ü: "u", ç: "c", ñ: "n", ø: "ö", æ: "ä",
};

export function normalizeFoodText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[éèêëáàâíìîïóòôúùûüçñøæ]/g, (c) => ACCENTS[c] || c)
    .replace(/[^a-z0-9åäö%]+/g, " ")
    .trim();
}

/** Sökord (normaliserat) → extra söktermer. */
export const FOOD_SYNONYMS: Record<string, string[]> = {
  socker: ["socker strö", "socker"],
  keso: ["cottage cheese"],
  hushallsost: ["ost hård"],
  hushållsost: ["ost hård"],
  cheddar: ["ost hård"],
  knackebrod: ["hårt bröd"],
  knäckebröd: ["hårt bröd"],
  standardmjolk: ["mjölk fett 3%"],
  standardmjölk: ["mjölk fett 3%"],
  proteinpulver: ["proteinpulver"],
  räkor: ["räka"],
  rakor: ["räka"],
  mandlar: ["sötmandel"],
  mandel: ["sötmandel"],
  "creme fraiche": ["creme fraiche"],
  cremefraiche: ["creme fraiche"],
};

export function expandQueries(query: string): string[] {
  const q = normalizeFoodText(query);
  if (!q) return [];
  const out = [q, ...(FOOD_SYNONYMS[q] || []).map(normalizeFoodText)];
  return Array.from(new Set(out));
}

/** Lägre = bättre. null = ingen träff. */
function scoreOne(name: string, q: string): number | null {
  const words = q.split(" ").filter(Boolean);
  if (!words.length) return null;
  const tokens = name.split(" ").filter(Boolean);
  const compact = name.replace(/ /g, "");
  let tier = 0;
  let firstPos = Infinity;
  for (const w of words) {
    let wTier: number | null = null;
    let pos = Infinity;
    tokens.forEach((t, i) => {
      const tt = t === w ? 0 : t.startsWith(w) ? 2 : t.includes(w) ? 3 : null;
      if (tt != null && (wTier == null || tt < wTier)) { wTier = tt; pos = i; }
    });
    if (wTier == null) {
      // Sammansatt sökord mot delat namn: "nötfärs" ~ "nöt färs"
      const idx = compact.indexOf(w);
      if (idx < 0) return null;
      wTier = idx === 0 ? 1 : 3;
      pos = 0;
    }
    tier = Math.max(tier, wTier === 0 ? 2 : wTier); // hel-ords-träff räknas som "ord börjar med"
    firstPos = Math.min(firstPos, pos);
  }
  if (tokens[0] === words[0]) tier = 0;
  else if (name.startsWith(q) || compact.startsWith(q.replace(/ /g, ""))) tier = Math.min(tier, 1);
  return tier * 1000 + Math.min(firstPos, 50) * 10;
}

export function foodMatchScore(name: string, queries: string[]): number | null {
  const n = normalizeFoodText(name);
  let best: number | null = null;
  queries.forEach((q, i) => {
    const s = scoreOne(n, q);
    if (s == null) return;
    const v = s + (i > 0 ? 1 : 0); // synonym strax efter direktträff
    if (best == null || v < best) best = v;
  });
  return best;
}

const SOURCE_ORDER: Record<string, number> = { food: 0, custom_food: 1, recipe: 2, off: 3 };

/** Filtrerar + rangordnar: träffnivå, sedan baslivsmedel före Egna, använd före oanvänd, kortare namn. */
export function searchFoods<T extends { name: string; source: string }>(
  items: T[],
  query: string,
  isUsed: (it: T) => boolean = () => false,
): T[] {
  const qs = expandQueries(query);
  if (!qs.length) return items;
  return items
    .map((it) => ({ it, s: foodMatchScore(it.name, qs) }))
    .filter((x): x is { it: T; s: number } => x.s != null)
    .sort((a, b) =>
      Math.floor(a.s / 1000) - Math.floor(b.s / 1000) ||
      (SOURCE_ORDER[a.it.source] ?? 9) - (SOURCE_ORDER[b.it.source] ?? 9) ||
      Number(isUsed(b.it)) - Number(isUsed(a.it)) ||
      a.s - b.s ||
      a.it.name.length - b.it.name.length ||
      a.it.name.localeCompare(b.it.name, "sv"))
    .map((x) => x.it);
}
