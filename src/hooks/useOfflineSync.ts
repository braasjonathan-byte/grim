import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countCheckmarks, logDestructiveWrite } from "@/lib/completionGuard";

interface PendingUpsert {
  table: string;
  data: Record<string, unknown>;
  onConflict: string;
  timestamp: number;
}

const QUEUE_KEY = "grim_offline_queue";
/** Queued writes older than this are considered stale and are discarded. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getQueue(): PendingUpsert[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingUpsert[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueOfflineUpsert(table: string, data: Record<string, unknown>, onConflict: string) {
  const queue = getQueue();
  // Keep only the newest pending write per row so an older snapshot can never
  // replay on top of a newer one.
  const sameRow = (item: PendingUpsert) =>
    item.table === table &&
    item.data.user_id === data.user_id &&
    item.data.week === data.week &&
    item.data.day === data.day;
  const filtered = table === "workout_completions" ? queue.filter((i) => !sameRow(i)) : queue;
  filtered.push({ table, data, onConflict, timestamp: Date.now() });
  saveQueue(filtered);
}

export function dequeueOfflineUpsert(table: string, match: Partial<Record<string, unknown>>) {
  const queue = getQueue();
  const filtered = queue.filter(
    (item) => !(item.table === table && Object.entries(match).every(([k, v]) => item.data[k] === v))
  );
  saveQueue(filtered);
}

/**
 * Replaying a queued workout_completions row is only safe when the backend row
 * has not been changed by a newer save since the item was queued, and when the
 * replay does not remove logged data.
 */
async function isSafeToReplay(item: PendingUpsert): Promise<boolean> {
  if (item.table !== "workout_completions") return true;

  const { data: serverRow, error } = await supabase
    .from("workout_completions")
    .select("done, updated_at, logged_weights")
    .eq("user_id", item.data.user_id as string)
    .eq("week", item.data.week as number)
    .eq("day", item.data.day as string)
    .maybeSingle();

  if (error) return false; // can't verify -> don't risk it now, retry later
  if (!serverRow) return true; // nothing to overwrite

  const serverUpdated = serverRow.updated_at ? new Date(serverRow.updated_at).getTime() : 0;
  const serverCount = countCheckmarks(serverRow.logged_weights as any, !!serverRow.done);
  const queuedCount = countCheckmarks(item.data.logged_weights as any, !!item.data.done);

  // The backend already has a save that happened after this item was queued.
  if (serverUpdated > item.timestamp) {
    if (queuedCount < serverCount) {
      logDestructiveWrite(
        "offline-queue-replay",
        String(item.data.user_id),
        item.data.week as number,
        String(item.data.day),
        { previousCount: serverCount, nextCount: queuedCount },
        true
      );
      return false;
    }
  }

  // Never let a replay reduce the amount of logged data.
  if (queuedCount < serverCount) {
    logDestructiveWrite(
      "offline-queue-replay",
      String(item.data.user_id),
      item.data.week as number,
      String(item.data.day),
      { previousCount: serverCount, nextCount: queuedCount },
      true
    );
    return false;
  }

  return true;
}

async function flushQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  const now = Date.now();
  const remaining: PendingUpsert[] = [];

  for (const item of queue) {
    if (!item.timestamp || now - item.timestamp > MAX_AGE_MS) {
      // Too old to trust — dropping is safer than overwriting newer data.
      console.warn("[Grim][offline-queue] discarding stale queued write", item.table);
      continue;
    }

    let safe = false;
    try {
      safe = await isSafeToReplay(item);
    } catch {
      remaining.push(item);
      continue;
    }
    if (!safe) continue; // drop: backend already holds equal or better data

    try {
      const { error } = await supabase
        .from(item.table as any)
        .upsert(item.data as any, { onConflict: item.onConflict });
      if (error) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  saveQueue(remaining);
}

export function useOfflineSync() {
  useEffect(() => {
    // Flush on mount (app start)
    flushQueue();

    const handleOnline = () => {
      flushQueue();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);
}
