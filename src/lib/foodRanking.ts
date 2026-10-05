export type UsageMap = Map<string, { count: number; last: number }>;

export const usageKey = (source: string, id: string) => `${source}:${id}`;

/**
 * Personal ranking: (1) used + starts with, (2) used + contains,
 * (3) unused + starts with, (4) unused + contains. Alphabetical within group.
 */
export function rankFoods<T extends { id: string; name: string; source: string }>(
  items: T[],
  term: string,
  usage: UsageMap,
): T[] {
  const t = term.trim().toLowerCase();
  const tier = (it: T) => {
    const used = usage.has(usageKey(it.source, it.id));
    const starts = t ? it.name.toLowerCase().startsWith(t) : true;
    return (used ? 0 : 2) + (starts ? 0 : 1);
  };
  return items
    .map((it) => ({ it, g: tier(it) }))
    .sort((a, b) => a.g - b.g || a.it.name.localeCompare(b.it.name, "sv"))
    .map((x) => x.it);
}
