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
  proteinpulver: ["proteinpulver", "vassle", "whey", "kasein", "protein pulver"],
  vassle: ["proteinpulver", "whey", "vassle"],
  vassleprotein: ["proteinpulver", "vassle", "whey"],
  kasein: ["proteinpulver", "kasein"],
  casein: ["kasein", "proteinpulver"],
  gainer: ["gainer", "proteinpulver"],
  bcaa: ["bcaa", "aminosyror"],
  kreatin: ["kreatin", "creatine"],
  creatine: ["kreatin"],
  proteinbar: ["proteinbar", "protein bar"],
  proteinpudding: ["proteinpudding", "pudding protein"],
  proteindryck: ["proteindryck", "proteinshake"],
  proteinshake: ["proteindryck", "proteinshake"],
  räkor: ["räka"],
  rakor: ["räka"],
  mandlar: ["sötmandel"],
  mandel: ["sötmandel"],
  "creme fraiche": ["creme fraiche"],
  cremefraiche: ["creme fraiche"],
  mjolk: ["mjölk"], ost: ["ost"], agg: ["ägg"], farsk: ["färsk"], kottfars: ["nöt färs", "köttfärs"],
  kycklingfile: ["kyckling filé", "kyckling bröstfilé", "kyckling"], kycklingbrost: ["kyckling bröst", "kyckling"],
  whey: ["proteinpulver", "vassle"], protein: ["proteinpulver"],
  energigel: ["sportgel", "energigel", "druvsocker"], gel: ["sportgel", "energigel"], sportdryck: ["sportdryck"],
  // Engelska vardagsord
  rice: ["ris"], oatmeal: ["havregryn", "gröt havre"], oats: ["havregryn"], chicken: ["kyckling"], milk: ["mjölk"],
  egg: ["ägg"], eggs: ["ägg"], bread: ["bröd"], cheese: ["ost"], banana: ["banan"], apple: ["äpple"], potato: ["potatis"],
  pasta: ["pasta", "makaroner", "spagetti"], salmon: ["lax"], beef: ["nöt"], pork: ["fläsk"], butter: ["smör"],
  yoghurt: ["yoghurt"], yogurt: ["yoghurt"], tuna: ["tonfisk"], coffee: ["kaffe"], tea: ["te"],
  // Vanliga butiksnamn → Livsmedelsverkets namn
  fetaost: ["feta", "ost feta"], feta: ["feta"],
  flaskfars: ["fläsk färs"], fläskfärs: ["fläsk färs"],
  kycklinglarfile: ["kyckling lår"], kycklinglårfilé: ["kyckling lår"],
  kycklingbrostfile: ["kyckling bröstfilé", "kyckling bröst"], kycklingbröstfilé: ["kyckling bröstfilé", "kyckling bröst"],
  kycklingfars: ["kyckling färs"], kycklingfärs: ["kyckling färs"],
  musslor: ["mussla"], isbergssallad: ["isbergssallat", "sallad isberg"],
  zucchini: ["squash"], champinjoner: ["champinjon"], champinjon: ["champinjon"],
  rodbetor: ["rödbeta"], rödbetor: ["rödbeta"], rodbeta: ["rödbeta"], rödbeta: ["rödbeta"],
  rodlok: ["lök röd"], rödlök: ["lök röd"],
  ragbrod: ["råg bröd", "bröd råg"], rågbröd: ["råg bröd", "bröd råg"],
  fullkornsbrod: ["bröd fullkorn"], fullkornsbröd: ["bröd fullkorn"],
  spaghetti: ["spagetti", "pasta"], spagetti: ["spagetti", "pasta"],
  makaroner: ["makaroner", "pasta"],
  basmatiris: ["ris basmati"], pannkakor: ["pannkaka"], pannkaka: ["pannkaka"],
  solroskarnor: ["solrosfrö"], solroskärnor: ["solrosfrö"], solrosfron: ["solrosfrö"], solrosfrön: ["solrosfrö"],
  "coca-cola": ["läsk cola", "läsk"], cola: ["läsk cola", "läsk"], lask: ["läsk"], läsk: ["läsk"],
  quorn: ["mykoprotein"],
  prastost: ["ost hård", "ost präst"], prästost: ["ost hård", "ost präst"],
  "krossade tomater": ["tomat krossad", "krossade tomater"], krossadetomater: ["tomat krossad"],
  oboy: ["kakaodryck", "chokladdryck", "oboy"], chokladdryck: ["kakaodryck", "oboy"],
  vegoburgare: ["vego burgare", "burgare veg", "sojafärs"], vego: ["vego", "sojafärs"],
  vispgradde: ["grädde visp", "vispgrädde"], vispgrädde: ["grädde visp", "vispgrädde"],
  gradde: ["grädde visp", "grädde"], grädde: ["grädde visp", "grädde"],
  hallonsylt: ["sylt hallon"], sojasas: ["soja"], sojasås: ["soja"],
  tortilla: ["tortilla"], vetetortilla: ["tortilla"],
};

export function expandQueries(query: string): string[] {
  const q = normalizeFoodText(query);
  if (!q) return [];
  // "mjolk" → "mjölk": prova även med å/ä/ö återställda för vanliga stavningar utan prickar.
  const deAccented = q.replace(/[åä]/g, "a").replace(/ö/g, "o");
  const syn = [...(FOOD_SYNONYMS[q] || []), ...(FOOD_SYNONYMS[deAccented] || [])];
  // Ord-för-ord-synonymer (t.ex. "chicken breast" → "kyckling breast")
  const words = q.split(" ");
  if (words.length > 1) {
    const mapped = words.map((w) => FOOD_SYNONYMS[w]?.[0] ?? w).join(" ");
    if (mapped !== q) syn.push(mapped);
  }
  const out = [q, ...syn.map(normalizeFoodText)];
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
