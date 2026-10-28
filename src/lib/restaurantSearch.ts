import { RESTAURANT_MENU, SWEDISH_CHAINS, type MenuItem } from "@/data/restaurantMenu";

/** gemener, utan diakritik (behåller å/ä/ö som a/a/o), apostrofer och skiljetecken bort. */
export function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´.]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}
const SYN: Record<string, string> = {
  trippel: "triple", tredubbel: "triple", dubbel: "double", cheeseburgare: "cheeseburger",
  ostburgare: "cheeseburger", hamburger: "hamburgare", mcdonalds: "mcdonalds", mcd: "mcdonalds", mackan: "mcdonalds",
  fries: "pommes", nugget: "nuggets", whoper: "whopper",
};
export function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean).map((t) => SYN[t] ?? t);
}
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
/** 0 = perfekt, 1 = ingen träff, för en query-token mot doc-tokens. */
function tokScore(q: string, doc: string[]): number {
  let best = 1;
  for (const d of doc) {
    if (d === q) return 0;
    if (d.startsWith(q)) best = Math.min(best, 0.1);
    else if (q.length >= 4 && d.includes(q)) best = Math.min(best, 0.2);
    else if (q.length >= 4) {
      const r = lev(q, d.slice(0, Math.max(q.length, d.length))) / Math.max(q.length, d.length);
      if (r <= 0.34) best = Math.min(best, 0.3 + r);
    }
  }
  return best;
}
export const chainRank = (r: string) => {
  const i = SWEDISH_CHAINS.findIndex((c) => norm(c) === norm(r));
  return i < 0 ? 99 : i;
};
export interface MenuHit { item: MenuItem; score: number }

/** Söker maträtter över ALLA restauranger. Restaurangnamn i frågan filtrerar/boostar. */
export function searchMenu(query: string, menu: MenuItem[] = RESTAURANT_MENU, limit = 12): MenuHit[] {
  const q = tokens(query);
  if (!q.length) return [];
  const hits: MenuHit[] = [];
  for (const item of menu) {
    const dish = tokens([item.n, ...(item.a ?? [])].join(" "));
    const rest = tokens(item.r);
    let total = 0, restHits = 0, dishHits = 0, miss = false;
    for (const t of q) {
      const ds = tokScore(t, dish), rs = tokScore(t, rest);
      if (rs < 0.3 && rs <= ds) { restHits++; continue; }
      if (ds >= 1) { miss = true; break; }
      total += ds; dishHits++;
    }
    if (miss || (dishHits === 0 && restHits === 0)) continue;
    const exactName = norm(item.n) === norm(query) ? -0.5 : 0;
    const score = (dishHits ? total / dishHits : 0.5) + exactName - restHits * 0.3 + chainRank(item.r) * 0.002;
    hits.push({ item, score });
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, limit);
}
