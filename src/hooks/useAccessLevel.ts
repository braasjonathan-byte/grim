import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccessRole = "admin" | "member";

export interface AccessLevel {
  role: AccessRole;
  /** Skapare/Admin */
  isAdmin: boolean;
  /** Hedersmedlem — admins räknas alltid som hedersmedlem */
  isHonorary: boolean;
  loading: boolean;
}

const DEFAULT: AccessLevel = { role: "member", isAdmin: false, isHonorary: false, loading: true };

let cached: AccessLevel | null = null;
let inflight: Promise<AccessLevel> | null = null;
const listeners = new Set<(a: AccessLevel) => void>();

async function load(): Promise<AccessLevel> {
  try {
    const { data, error } = await (supabase as any).rpc("get_my_access_status");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const role: AccessRole = row?.role === "admin" ? "admin" : "member";
    return {
      role,
      isAdmin: role === "admin",
      isHonorary: Boolean(row?.is_honorary) || role === "admin",
      loading: false,
    };
  } catch {
    return { ...DEFAULT, loading: false };
  }
}

/** Tvinga omladdning (t.ex. efter att en admin ändrat behörighet eller efter betalning). */
export async function refreshAccessLevel(): Promise<AccessLevel> {
  inflight = load();
  cached = await inflight;
  inflight = null;
  listeners.forEach((l) => l(cached as AccessLevel));
  return cached;
}

/**
 * Enda källan till sanning för behörighetsnivå i appen.
 * Läser get_my_access_status som i sin tur väger in user_roles + profiles.is_honorary.
 */
export function useAccessLevel(): AccessLevel {
  const [state, setState] = useState<AccessLevel>(cached ?? DEFAULT);

  useEffect(() => {
    let cancelled = false;
    const listener = (a: AccessLevel) => {
      if (!cancelled) setState(a);
    };
    listeners.add(listener);

    if (cached) {
      setState(cached);
    } else {
      (inflight ?? (inflight = load())).then((a) => {
        cached = a;
        inflight = null;
        if (!cancelled) setState(a);
      });
    }

    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  return state;
}
