/** Stoppar dubbelklick: samma nyckel inom `ms` körs bara en gång (skyddar mot dubbletter i databasen). */
const recent = new Map<string, number>();
export function firstClick(key: string, ms = 1500): boolean {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < ms) return false;
  recent.set(key, now);
  return true;
}

/** Kör en async-funktion högst en gång åt gången per nyckel. */
const running = new Set<string>();
export async function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (running.has(key)) return undefined;
  running.add(key);
  try { return await fn(); } finally { setTimeout(() => running.delete(key), 400); }
}
