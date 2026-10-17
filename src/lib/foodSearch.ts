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
  proteindryck: ["proteindryck", "proteinshake", "måltidsersättning"],
  proteinshake: ["proteindryck", "proteinshake", "måltidsersättning"],
  räkor: ["räka"],
  rakor: ["räka"],
  mandlar: ["sötmandel"],
  mandel: ["sötmandel"],
  "creme fraiche": ["creme fraiche"],
  cremefraiche: ["creme fraiche"],
  mjolk: ["mjölk"], ost: ["ost"], agg: ["ägg"], farsk: ["färsk"], kottfars: ["nöt färs", "köttfärs"],
  kycklingfile: ["kyckling bröstfilé", "kyckling filé", "kycklingfilé"], kycklingbrost: ["kyckling bröst", "kyckling"],
  whey: ["proteinpulver", "vassle"], protein: ["proteinpulver"],
  energigel: ["sportgel", "energigel", "druvsocker"], gel: ["sportgel", "energigel"], sportdryck: ["sportdryck"],
  // Livsmedelsverkets namn skiljer sig från butiksnamnet
  cocacola: ["läsk cola"],
  pepsi: ["läsk cola"],
  herrgårdsost: ["ost hårdost"], grevé: ["ost hårdost"], greve: ["ost hårdost"], västerbottensost: ["ost hårdost fett 31%"],
  "o boy": ["chokladdryckspulver"], nesquik: ["chokladdryckspulver"],
  pumpakärnor: ["pumpafrö"],
  penne: ["pasta"], fusilli: ["pasta"], tagliatelle: ["pasta"],
  kinasoja: ["sojasås"], tortillabröd: ["vetetortilla"],
  gullök: ["lök gul"], vitlöksklyfta: ["vitlök"],
  wraps: ["vetetortilla"], wrap: ["vetetortilla", "wrap"], sylt: ["jordgubbssylt", "blåbärssylt"],
  // Engelska vardagsord
  rice: ["ris"], oatmeal: ["havregryn", "gröt havre"], oats: ["havregryn"], chicken: ["kyckling"], milk: ["mjölk"],
  egg: ["ägg"], eggs: ["ägg"], bread: ["bröd"], cheese: ["ost"], banana: ["banan"], apple: ["äpple"], potato: ["potatis"],
  pasta: ["pasta", "makaroner", "spagetti"], salmon: ["lax"], beef: ["nöt"], pork: ["fläsk"], butter: ["smör"],
  yoghurt: ["yoghurt"], yogurt: ["yoghurt"], tuna: ["tonfisk"], coffee: ["kaffe"], tea: ["te"],
  // Vanliga butiksnamn → Livsmedelsverkets namn
  fetaost: ["feta", "ost feta"], feta: ["feta"],
  flaskfars: ["fläsk färs", "gris färs"], fläskfärs: ["fläsk färs", "gris färs"],
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
  "coca-cola": ["läsk cola", "läsk"], "coca cola": ["läsk cola", "läsk"], cola: ["läsk cola", "läsk"], lask: ["läsk"], läsk: ["läsk"],
  quorn: ["mykoprotein"],
  prastost: ["ost hårdost fett 31%", "ost hård", "ost präst"], prästost: ["ost hårdost fett 31%", "ost hård", "ost präst"],
  "krossade tomater": ["tomat krossad", "krossade tomater"], krossadetomater: ["tomat krossad"],
  oboy: ["kakaodryck", "chokladdryck", "chokladdryckspulver", "oboy"], chokladdryck: ["kakaodryck", "oboy"],
  vegoburgare: ["vego burgare", "burgare veg", "grönsaksbiff", "sojafärs"], vego: ["vego", "sojafärs"],
  vispgradde: ["grädde visp", "vispgrädde"], vispgrädde: ["grädde visp", "vispgrädde"],
  gradde: ["grädde visp", "grädde", "mellangrädde", "matlagningsgrädde"], grädde: ["grädde visp", "grädde", "mellangrädde", "matlagningsgrädde"],
  hallonsylt: ["sylt hallon"], sojasas: ["soja"], sojasås: ["soja"],
  tortilla: ["tortilla"], vetetortilla: ["tortilla"],
};

/** Sökord där butiksbetydelsen ska rankas FÖRE direktträffar ("soja" i butiken = sojasås). */
export const FOOD_PREFERRED: Record<string, string[]> = {
  soja: ["sojasås"], tortilla: ["vetetortilla"], grädde: ["vispgrädde"], sylt: ["hallonsylt", "lingonsylt"],
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
  const out = [...(FOOD_PREFERRED[q] || []).map(normalizeFoodText), q, ...syn.map(normalizeFoodText)];
  return Array.from(new Set(out));
}


/** Svenska böjningsändelser: "rödbetor" → "rödbet", "champinjoner" → "champinjon", "krossade" → "krossad". */
const SUFFIXES = ["arna", "erna", "orna", "ornas", "or", "ar", "er", "na", "en", "et", "e", "n"];
export function stems(w: string): string[] {
  const out: string[] = [];
  for (const suf of SUFFIXES) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) out.push(w.slice(0, -suf.length));
  }
  return out;
}

/** Levenshtein ≤ max (tidig avbrytning). */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/**
 * 0 = exakt, 1 = efterled i sammansättning ("hallonsylt" för "sylt" – huvudordet står sist på svenska),
 * 2 = ordet börjar med / böjd form, 3 = finns inne i ordet / stavfel. null = ingen träff.
 */
function wordTier(t: string, w: string): number | null {
  if (t === w) return 0;
  if (w.length >= 4 && t.endsWith(w)) return 1;
  if (t.startsWith(w)) return 2;
  const st = stems(w);
  if (st.includes(t)) return 0; // böjd form av samma ord: "champinjoner" = "champinjon"
  for (const x of st) if (t.startsWith(x) || (x.length >= 5 && t.endsWith(x))) return 2;
  if (t.includes(w)) return 3;
  if (w.length >= 6 && within(t, w, w.length >= 9 ? 2 : 1)) return 3;
  return null;
}

/** Delar sammansatta sökord mot ordförrådet i databasen: "rödlök" → "röd lök", "fullkornsbröd" → "fullkorn bröd". */
export function splitCompound(w: string, vocab: Set<string>, depth = 0): string[] | null {
  if (depth > 2 || w.length < 6) return null;
  for (let i = w.length - 3; i >= 3; i--) {
    let head = w.slice(0, i);
    const tail = w.slice(i);
    const tailOk = vocab.has(tail) || stems(tail).some((st) => vocab.has(st));
    if (!tailOk) continue;
    if (!vocab.has(head) && head.endsWith("s") && vocab.has(head.slice(0, -1))) head = head.slice(0, -1); // fogemorfem
    if (vocab.has(head)) return [head, tail];
    const sub = splitCompound(head, vocab, depth + 1);
    if (sub) return [...sub, tail];
  }
  return null;
}

const vocabCache = new WeakMap<object, Set<string>>();
function vocabFor(items: { name: string }[]): Set<string> {
  let v = vocabCache.get(items);
  if (!v) {
    v = new Set();
    for (const it of items) for (const t of normalizeFoodText(it.name).split(" ")) if (t.length >= 3 && !/\d/.test(t)) v.add(t);
    vocabCache.set(items, v);
  }
  return v;
}

const OFFAL_GROUP = "Lever, njure, tunga etc.";
const OFFAL_WORDS = /lever|njure|hjärta|tunga|mage|bräss|blod|kräs/;
/** Straff inom samma träffnivå: rätter och inälvsmat efter råvaror (om sökningen inte ber om dem). */
function basicPenalty(it: { name: string; group_name?: string | null }, q: string): number {
  let p = 0;
  const n = it.name.toLowerCase();
  if (/ m\. (?!salt|skinn|svål|lag|sockerlag|juice|olja|vatten|kryddor)|hemlagad|restaurang/.test(n) || it.group_name === "Rätter") p += 300;
  if ((it.group_name === OFFAL_GROUP || OFFAL_WORDS.test(n)) && !OFFAL_WORDS.test(q)) p += 400;
  return p;
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
      const tt = wordTier(t, w);
      // Efterledsträff ("vaxbönor") strax efter helt ord ("gröna bönor") inom samma nivå
      if (tt != null && (wTier == null || tt < wTier)) { wTier = tt; pos = tt === 1 && t !== w ? i + 3 : i; }
    });
    if (wTier == null) {
      // Sammansatt sökord mot delat namn: "nötfärs" ~ "nöt färs"
      const idx = compact.indexOf(w);
      if (idx < 0) return null;
      wTier = idx === 0 ? 1 : 3;
      pos = 0;
    }
    tier = Math.max(tier, wTier === 0 ? 1 : wTier); // helt ord senare i namnet ≈ efterled ("Gröna bönor", "Vaniljsås m. grädde")
    firstPos = Math.min(firstPos, pos);
  }
  if (tokens[0] === words[0] || stems(words[0]).includes(tokens[0])) tier = 0;
  else if (name.startsWith(q) || compact.startsWith(q.replace(/ /g, ""))) tier = Math.min(tier, 1);
  return tier * 1000 + Math.min(firstPos, 50) * 10;
}

export function foodMatchScore(name: string, queries: string[]): number | null {
  const n = normalizeFoodText(name);
  let best: number | null = null;
  queries.forEach((q, i) => {
    const s = scoreOne(n, q);
    if (s == null) return;
    const v = s + i; // synonymer i angiven ordning, strax efter direktträff
    if (best == null || v < best) best = v;
  });
  return best;
}

const SOURCE_ORDER: Record<string, number> = { food: 0, custom_food: 1, recipe: 2, off: 3 };

/** Filtrerar + rangordnar: träffnivå, sedan baslivsmedel före Egna, använd före oanvänd, kortare namn. */
export function searchFoods<T extends { name: string; source: string; group_name?: string | null }>(
  items: T[],
  query: string,
  isUsed: (it: T) => boolean = () => false,
): T[] {
  const qs = expandQueries(query);
  if (!qs.length) return items;
  // Sammansatta sökord som inte finns som eget ord: lägg till delad variant ("basmatiris" → "basmati ris").
  const vocab = vocabFor(items);
  const q0 = normalizeFoodText(query);
  const split = q0.split(" ").map((w) => splitCompound(w, vocab) || [w]).flat().join(" ");
  if (split !== q0 && !qs.includes(split)) qs.push(split);
  return items
    .map((it) => {
      const s = foodMatchScore(it.name, qs);
      return { it, s, t: s == null ? 0 : Math.floor(s / 1000), p: s == null ? 0 : (s % 1000) + basicPenalty(it, q0) };
    })
    .filter((x): x is { it: T; s: number; t: number; p: number } => x.s != null)
    .sort((a, b) =>
      a.t - b.t ||
      (SOURCE_ORDER[a.it.source] ?? 9) - (SOURCE_ORDER[b.it.source] ?? 9) ||
      Number(isUsed(b.it)) - Number(isUsed(a.it)) ||
      a.p - b.p ||
      a.it.name.length - b.it.name.length ||
      a.it.name.localeCompare(b.it.name, "sv"))
    .map((x) => x.it);
}
