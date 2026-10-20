async function db() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export interface ContentRevision {
  key: string;
  at: string;
  value: unknown;
}

export const HISTORY_KEY = "content_history";
const MAX_REVISIONS = 25;

export function pushRevision(list: ContentRevision[], revision: ContentRevision, max = MAX_REVISIONS): ContentRevision[] {
  return [revision, ...list].slice(0, max);
}

export function takeRevision(list: ContentRevision[], key: string): { rest: ContentRevision[]; rev: ContentRevision | null } {
  const index = list.findIndex((revision) => revision.key === key);
  if (index < 0) return { rest: list, rev: null };
  return { rest: list.filter((_, i) => i !== index), rev: list[index] };
}

async function writeRow(key: string, value: unknown, userId?: string) {
  const supabase = await db();
  const { error } = await supabase.from("app_settings").upsert({
    key,
    value: value as never,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  });
  if (error) throw error;
}

export async function rememberPrevious(key: string, previous: unknown, userId?: string) {
  if (key === HISTORY_KEY) return;
  const supabase = await db();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", HISTORY_KEY).maybeSingle();
  if (error) throw error;
  const list = Array.isArray(data?.value) ? (data!.value as ContentRevision[]) : [];
  await writeRow(HISTORY_KEY, pushRevision(list, { key, at: new Date().toISOString(), value: previous ?? null }), userId);
}

/** Lägger tillbaka senaste sparade värdet för en nyckel. Returnerar false om det inte finns något att ångra. */
export async function undoContent(key: string, userId?: string): Promise<boolean> {
  const supabase = await db();
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", HISTORY_KEY).maybeSingle();
  if (error) throw error;
  const list = Array.isArray(data?.value) ? (data!.value as ContentRevision[]) : [];
  const { rest, rev } = takeRevision(list, key);
  if (!rev) return false;
  if (rev.value == null) {
    const { error: deleteError } = await supabase.from("app_settings").delete().eq("key", key);
    if (deleteError) throw deleteError;
  } else {
    await writeRow(key, rev.value, userId);
  }
  if (key === "feature_flags" && rev.value && typeof rev.value === "object" && !Array.isArray(rev.value)) {
    const ai = (rev.value as { ai_food?: unknown }).ai_food;
    if (ai === "all" || ai === "honorary" || ai === "off") await writeRow("ai_food_for_all", ai === "all", userId);
  }
  await writeRow(HISTORY_KEY, rest, userId);
  const [{ refreshAppSettings }, { refreshLiveContent }] = await Promise.all([
    import("@/lib/appSettings"),
    import("@/lib/liveContent"),
  ]);
  await Promise.all([refreshAppSettings().catch(() => undefined), refreshLiveContent().catch(() => undefined)]);
  return true;
}
