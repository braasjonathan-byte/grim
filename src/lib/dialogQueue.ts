import { useEffect, useState } from "react";

/**
 * Enkel kö för automatiska dialoger: bara EN visas åt gången.
 * Ordning: välkomstflöde → supporterinfo → nyheter (changelog) → admin-nyhet → installationstips.
 * Allt utom välkomstflödet väntar dessutom tills introt är klart (se setIntroReady).
 */
export type DialogSlot = "required" | "tour" | "grim-info" | "whats-new" | "news" | "install";

// "required" = obligatoriska steg (byt lösenord, återställnings-e-post) – går alltid först.
const ORDER: DialogSlot[] = ["required", "tour", "grim-info", "whats-new", "news", "install"];
const wanting = new Set<DialogSlot>();
let introReady = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

const activeSlot = (): DialogSlot | null => {
  for (const slot of ORDER) {
    if (!wanting.has(slot)) continue;
    if (slot !== "tour" && slot !== "required" && !introReady) continue;
    return slot;
  }
  return null;
};

/** Sätts från Index när välkomstflödet är avklarat och kontot är minst 24 h gammalt. */
export const setIntroReady = (ready: boolean) => {
  if (introReady === ready) return;
  introReady = ready;
  emit();
};

export const isIntroReady = () => introReady;

/** Returnerar true när just den här dialogen får visas. */
export function useDialogTurn(slot: DialogSlot, wants: boolean): boolean {
  const [active, setActive] = useState(() => activeSlot() === slot);
  useEffect(() => {
    const update = () => setActive(activeSlot() === slot);
    listeners.add(update);
    if (wants) wanting.add(slot);
    else wanting.delete(slot);
    emit();
    return () => {
      listeners.delete(update);
      wanting.delete(slot);
      emit();
    };
  }, [slot, wants]);
  return wants && active;
}

/** Kontot skapat för mindre än 24 h sedan? */
export const isAccountYoungerThan24h = (createdAt?: string | null) => {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && Date.now() - t < 24 * 60 * 60 * 1000;
};

/** Olästa-tidsstämpel: saknas nyckeln används kontots created_at (och sparas). */
export const getLastReadOrCreatedAt = (key: string, createdAt?: string | null) => {
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const fallback = createdAt || new Date().toISOString();
  try { localStorage.setItem(key, fallback); } catch { /* ignore */ }
  return fallback;
};

/** Används av tester. */
export const __resetDialogQueue = () => {
  wanting.clear();
  introReady = false;
  emit();
};
