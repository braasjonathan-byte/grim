import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PendingUpsert {
  table: string;
  data: Record<string, unknown>;
  onConflict: string;
  timestamp: number;
}

const QUEUE_KEY = "grim_offline_queue";

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
  queue.push({ table, data, onConflict, timestamp: Date.now() });
  saveQueue(queue);
}

async function flushQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining: PendingUpsert[] = [];

  for (const item of queue) {
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
