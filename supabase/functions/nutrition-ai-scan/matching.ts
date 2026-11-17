export const normalizeFoodName = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Main ingredient and preparation must match; ambiguous candidates are never guessed. */
export function bestFoodMatch<T extends { name: string }>(query: string, candidates: T[]): T | null {
  const words = normalizeFoodName(query).split(" ").filter(Boolean);
  if (!words.length) return null;
  const ranked = candidates.flatMap(food => {
    const name = normalizeFoodName(food.name);
    const tokens = name.split(" ");
    if (!words.every(word => tokens.some(token => token === word || (word.length >= 4 && token.startsWith(word))))) return [];
    if (tokens[0] !== words[0] && !tokens[0]?.startsWith(words[0])) return [];
    return [{ food, score: name === normalizeFoodName(query) ? 0 : 10 + tokens.length - words.length }];
  }).sort((a, b) => a.score - b.score);
  if (!ranked.length || (ranked[1] && ranked[0].score === ranked[1].score && ranked[0].food.name !== ranked[1].food.name)) return null;
  return ranked[0].food;
}