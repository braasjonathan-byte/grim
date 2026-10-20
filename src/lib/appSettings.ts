import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rememberPrevious } from "@/lib/contentHistory";
import { normalizeFeatureFlags, type FeatureFlagMap } from "@/lib/featureFlags";
import { EMPTY_PLAN_CATALOG, normalizePlanCatalog, type PlanCatalog } from "@/lib/planCatalog";

/** Global app settings controlled by admins (table app_settings). */
export interface AppSettings {
  /** Notice shown to everyone at the top of the app. Empty = hidden. */
  banner_message: string;
  /** Let every member (not only honorary) use "Beskriv dagens kost med AI". */
  ai_food_for_all: boolean;
  /** Show the "Grim Supporter" info dialog to new users. */
  supporter_promo: boolean;
  /** Block the app for everyone except admins. */
  maintenance_mode: boolean;
  maintenance_message: string;
  /** ISO build time. Older bundles must reload. Empty = off. */
  force_update_after: string;
  force_update_message: string;
  feature_flags: FeatureFlagMap;
  plan_catalog: PlanCatalog;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  banner_message: "",
  ai_food_for_all: false,
  supporter_promo: true,
  maintenance_mode: false,
  maintenance_message: "",
  force_update_after: "",
  force_update_message: "",
  feature_flags: {},
  plan_catalog: EMPTY_PLAN_CATALOG,
};

let cached: AppSettings | null = null;
let inflight: Promise<AppSettings> | null = null;
const listeners = new Set<(s: AppSettings) => void>();

async function load(): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const out: AppSettings = { ...DEFAULT_APP_SETTINGS, feature_flags: {}, plan_catalog: { ...EMPTY_PLAN_CATALOG, descriptions: {} } };
  for (const row of data || []) {
    if (row.value === null || row.value === undefined) continue;
    if (row.key === "feature_flags") out.feature_flags = normalizeFeatureFlags(row.value);
    else if (row.key === "plan_catalog") out.plan_catalog = normalizePlanCatalog(row.value);
    else if (row.key === "maintenance_mode") out.maintenance_mode = row.value === true;
    else if (row.key === "ai_food_for_all") out.ai_food_for_all = row.value === true;
    else if (row.key === "supporter_promo") out.supporter_promo = row.value !== false;
    else if (row.key in out) (out as Record<string, unknown>)[row.key] = row.value;
  }
  return out;
}

export async function refreshAppSettings() {
  cached = await load();
  listeners.forEach((l) => l(cached!));
  return cached;
}

export async function saveAppSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
  userId?: string,
  opts?: { history?: boolean },
) {
  const { data: previous } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await supabase.from("app_settings").upsert({
    key,
    value: value as never,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  });
  if (error) throw error;
  if (opts?.history !== false) await rememberPrevious(key, previous?.value ?? null, userId);
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
