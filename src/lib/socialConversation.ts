export const MESSAGE_PAGE_SIZE = 50;

export function mergeMessages<T extends { id: string; created_at: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map(row => [row.id, row]));
  incoming.forEach(row => byId.set(row.id, row));
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** Only a confirmed write may clear a draft or trigger a notification. */
export async function confirmMessageWrite<T>(write: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await write();
  if (error) throw error;
  if (!data) throw new Error("Meddelandet kunde inte bekräftas");
  return data;
}

export function challengePhase(start: string, end: string, today: string): "upcoming" | "active" | "finished" {
  if (end < today) return "finished";
  return start > today ? "upcoming" : "active";
}

export function socialAudience(visibility: string, groupName?: string | null): string {
  return visibility === "friends" ? "Bara vänner" : visibility === "group" ? groupName || "Eventgruppen" : "Offentligt";
}