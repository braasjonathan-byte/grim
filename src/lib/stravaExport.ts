import { supabase } from "@/integrations/supabase/client";
import { buildHealthExport, isExternalImport, type CompletionRow, type PlanRow, type ProfileRow } from "@/lib/healthWriteSync";
import { allCheckedSets } from "@/lib/checkedSets";
import { readSessionHr } from "@/lib/sessionHeartRate";
import { stravaSportType, type StravaExportInput } from "../../supabase/functions/_shared/stravaTcx";

export type StravaActivityPayload = Omit<StravaExportInput, "completionId">;

const fmtKg = (kg: string) => String(kg).replace(".", ",");
const pad = (n: number) => String(n).padStart(2, "0");
const localWallClock = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const parseCond = (v: unknown): Record<string, any> | null => {
  if (!v) return null;
  if (typeof v === "object") return v as Record<string, any>;
  try { const o = JSON.parse(String(v)); return o && typeof o === "object" ? o : null; } catch { return null; }
};

/** Beskrivning till Strava: övningar med set, sedan "Loggat i Grim". */
export function stravaDescription(lw: Record<string, unknown>, comment?: string | null): string {
  const lines: string[] = [];
  for (const [name, sets] of allCheckedSets(lw)) {
    if (!sets.length) continue;
    const parts = sets.map((s) => (Number(s.kg) > 0 ? `${s.reps}×${fmtKg(s.kg)} kg` : `${s.reps} reps`));
    lines.push(`${name.replace(/( —)+$/, "").trim()}: ${parts.join(", ")}`);
    if (lines.length >= 15) break;
  }
  if (comment?.trim() && !/^Strava:/.test(comment.trim())) lines.push("", comment.trim().slice(0, 300));
  lines.push("", "Loggat i Grim 💪");
  return lines.join("\n").slice(0, 1000);
}

/**
 * Bygger Strava-aktiviteten för ett Grim-pass. Null för pass som inte ska exporteras
 * (ej klara, importerade från Strava/Health Connect).
 */
export function buildStravaActivity(c: CompletionRow, plan: PlanRow | undefined, profile: ProfileRow | null): StravaActivityPayload | null {
  if (isExternalImport(c)) return null;
  const base = buildHealthExport(c, plan, profile);
  if (!base) return null;
  const lw = (c.logged_weights || {}) as Record<string, unknown>;
  const start = new Date(base.startTime);
  const end = new Date(base.endTime);
  const elapsedSec = Math.max(60, Math.round((end.getTime() - start.getTime()) / 1000));

  const hasStrength = [...allCheckedSets(lw).values()].some((s) => s.length > 0);
  const sportType = stravaSportType(`${plan?.session_name ?? ""} ${plan?.details ?? ""}`, hasStrength);

  // Puls: helpassets serie från pulsbandet, annars en inspelad konditionsserie (jämnt fördelad)
  let hr: { t: number; bpm: number }[] | null = readSessionHr(lw)?.raw ?? null;
  let route: [number, number][] | null = null;
  for (const [k, v] of Object.entries(lw)) {
    if (!k.startsWith("__cond__")) continue;
    const d = parseCond(v);
    if (!d) continue;
    if (!route && Array.isArray(d.route) && d.route.length >= 2) route = d.route as [number, number][];
    if (!hr && Array.isArray(d.hr) && d.hr.length >= 2) {
      const series = d.hr as number[];
      hr = series.map((bpm, i) => ({ t: start.getTime() + Math.round((elapsedSec * 1000 * i) / Math.max(1, series.length - 1)), bpm }));
    }
  }

  return {
    name: base.title || "Grim-pass",
    sportType,
    startIso: start.toISOString(),
    startLocal: localWallClock(start),
    elapsedSec,
    distanceM: base.distanceMeters ?? null,
    calories: base.calories ?? null,
    description: stravaDescription(lw, c.user_comment),
    hr,
    route,
  };
}

export type StravaExportResult = { ok: boolean; status?: string; activityId?: number | null; error?: string };

/** Skickar ett avslutat pass till Strava via edge-funktionen (tokens finns bara på servern). */
export async function exportWorkoutToStrava(userId: string, week: number, day: string, opts?: { force?: boolean }): Promise<StravaExportResult> {
  const [{ data: c }, { data: plans }, { data: profile }] = await Promise.all([
    supabase.from("workout_completions")
      .select("id, week, day, done, skipped, updated_at, logged_weights, logged_distance_km, logged_pulse, logged_tempo, user_comment")
      .eq("user_id", userId).eq("week", week).eq("day", day).maybeSingle(),
    supabase.from("workout_plans").select("week, day, details, session_name").eq("user_id", userId).eq("week", week).eq("day", day),
    supabase.from("profiles").select("weight_kg, gender, age").eq("user_id", userId).maybeSingle(),
  ]);
  if (!c) return { ok: false, error: "completion_not_found" };
  const planRows = (plans || []) as PlanRow[];
  const plan: PlanRow | undefined = planRows.length
    ? { week, day, session_name: planRows.map((p) => p.session_name).filter(Boolean).join(" + ") || null, details: planRows.map((p) => p.details || "").join("\n") }
    : undefined;
  const activity = buildStravaActivity(c as unknown as CompletionRow, plan, (profile as ProfileRow) ?? null);
  if (!activity) return { ok: false, error: "not_exportable" };
  const { data, error } = await supabase.functions.invoke("strava-upload", {
    body: { completionId: (c as any).id, activity, force: !!opts?.force },
  });
  if (error) {
    let msg = error.message;
    try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* ignore */ }
    return { ok: false, error: msg };
  }
  return { ok: !!data && !data.error, status: data?.status, activityId: data?.activityId ?? null, error: data?.error };
}

export type StravaExportSettings = { connected: boolean; canWrite: boolean; autoExport: boolean };

export async function getStravaExportSettings(): Promise<StravaExportSettings> {
  const { data } = await (supabase as any).rpc("get_my_strava_export_settings");
  const row = Array.isArray(data) ? data[0] : data;
  return { connected: !!row?.connected, canWrite: !!row?.can_write, autoExport: !!row?.auto_export };
}

export async function setStravaAutoExport(enabled: boolean): Promise<boolean> {
  const { error } = await (supabase as any).rpc("set_my_strava_auto_export", { enabled });
  return !error;
}

/** Efter "Klart": skicka passet till Strava om användaren slagit på automatisk export. */
export async function maybeAutoExportToStrava(userId: string, week: number, day: string): Promise<StravaExportResult | null> {
  try {
    const s = await getStravaExportSettings();
    if (!s.connected || !s.canWrite || !s.autoExport) return null;
    return await exportWorkoutToStrava(userId, week, day);
  } catch (e) {
    console.warn("[strava] auto-export failed", e);
    return null;
  }
}

export const STRAVA_ERROR_TEXT: Record<string, string> = {
  needs_reconnect: "Koppla om Strava och godkänn att Grim får ladda upp pass.",
  not_connected: "Koppla ditt Strava-konto först.",
  strava_not_configured: "Strava-kopplingen är inte aktiverad än.",
  not_exportable: "Passet kommer från Strava eller Health Connect och skickas inte tillbaka.",
  completion_not_found: "Passet hittades inte.",
};
