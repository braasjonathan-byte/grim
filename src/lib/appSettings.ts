import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Global app settings controlled by admins (table app_settings). */
export interface AppSettings {
  /** Notice shown to everyone at the top of the app. Empty = hidden. */
  banner_message: string;
  /** Let every member (not only honorary) use "Beskriv dagens kost med AI". */
  ai_food_for_all: boolean;
  /** Show the "Grim Supporter" info dialog to new users. */
  supporter_promo: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  banner_message: "",
  ai_food_for_all: false,
  supporter_promo: true,
};

let cached: AppSettings | null = null;
let inflight: Promise<AppSettings> | null = null;
const listeners = new Set<(s: AppSettings) => void>();

async function load(): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const out: any = { ...DEFAULT_APP_SETTINGS };
  for (const row of data || []) if (row.key in out && row.value !== null) out[row.key] = row.value;
  return out;
}

export async function refreshAppSettings() {
  cached = await load();
  listeners.forEach((l) => l(cached!));
  return cached;
}

export async function saveAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K], userId?: string) {
  const { error } = await supabase.from("app_settings").upsert({ key, value: value as any, updated_at: new Date().toISOString(), updated_by: userId ?? null });
  if (error) throw error;
  await refreshAppSettings();
}

export function useAppSettings(): AppSettings {
  const [s, setS] = useState<AppSettings>(cached ?? DEFAULT_APP_SETTINGS);
  useEffect(() => {
    let alive = true;
    const l = (v: AppSettings) => alive && setS(v);
    listeners.add(l);
    if (cached) setS(cached);
    else (inflight ??= load()).then((v) => { cached = v; inflight = null; if (alive) setS(v); }).catch(() => { inflight = null; });
    return () => { alive = false; listeners.delete(l); };
  }, []);
  return s;
}
