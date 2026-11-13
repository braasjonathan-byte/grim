import { useEffect, useRef, useState } from "react";

/** Per-user session drafts survive navigation/reload, never replay writes automatically. */
export function useSessionDraft<T>(key: string, initial: T) {
  const fallback = useRef(initial);
  const read = (k: string): T => { try { const raw = sessionStorage.getItem(k); return raw ? JSON.parse(raw) : fallback.current; } catch { return fallback.current; } };
  const [entry, setEntry] = useState(() => ({ key, value: read(key) }));
  const value = entry.key === key ? entry.value : read(key);
  useEffect(() => { if (entry.key !== key) setEntry({ key, value: read(key) }); }, [key, entry.key]);
  const setValue = (next: T | ((previous: T) => T)) => {
    const updated = typeof next === "function" ? (next as (previous: T) => T)(value) : next;
    try { sessionStorage.setItem(key, JSON.stringify(updated)); } catch { /* keep the in-memory draft */ }
    setEntry({ key, value: updated });
  };
  return [value, setValue] as const;
}