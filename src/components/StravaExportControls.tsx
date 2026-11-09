import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { isCompletedWorkout } from "@/lib/completionCounting";
import { isExternalImport } from "@/lib/healthWriteSync";
import { exportWorkoutToStrava, getStravaExportSettings, setStravaAutoExport, STRAVA_ERROR_TEXT, type StravaExportSettings } from "@/lib/stravaExport";

/** Inställningar för att skicka Grim-pass till Strava (visas när Strava är kopplat). */
export default function StravaExportControls({ userId, onReconnect }: { userId: string; onReconnect: () => void }) {
  const [settings, setSettings] = useState<StravaExportSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { getStravaExportSettings().then(setSettings).catch(() => {}); }, []);

  if (!settings?.connected) return null;

  if (!settings.canWrite) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-secondary/40 p-3 space-y-2 text-xs">
        <p className="font-semibold text-foreground">Skicka pass till Strava</p>
        <p className="text-muted-foreground">För att Grim ska kunna ladda upp dina pass behöver du koppla om Strava och godkänna uppladdning.</p>
        <button type="button" onClick={onReconnect} className="w-full rounded-md bg-primary px-2.5 py-2 font-semibold text-primary-foreground">
          Koppla om Strava
        </button>
      </div>
    );
  }

  const toggle = async (on: boolean) => {
    setSettings({ ...settings, autoExport: on });
    if (!(await setStravaAutoExport(on))) setSettings({ ...settings, autoExport: !on });
  };

  const sendLatest = async () => {
    setBusy(true);
    setMessage("");
    const { data } = await supabase.from("workout_completions")
      .select("week, day, done, skipped, updated_at, logged_weights, logged_distance_km")
      .eq("user_id", userId).eq("done", true).order("updated_at", { ascending: false }).limit(20);
    const latest = ((data || []) as any[]).find((c) => isCompletedWorkout(c) && !isExternalImport(c));
    if (!latest) { setBusy(false); setMessage("Hittade inget avslutat pass att skicka."); return; }
    const r = await exportWorkoutToStrava(userId, latest.week, latest.day);
    setBusy(false);
    if (r.status === "already") setMessage("Senaste passet finns redan på Strava.");
    else if (r.ok) setMessage(r.status === "processing" ? "Passet laddas upp – det syns på Strava om en stund." : "Senaste passet skickades till Strava ✅");
    else setMessage(STRAVA_ERROR_TEXT[r.error || ""] || "Kunde inte skicka passet. Försök igen.");
  };

  return (
    <div className="mb-2 rounded-lg border border-border bg-secondary/40 p-3 space-y-2 text-xs">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-semibold text-foreground">Skicka avslutade pass till Strava</span>
          <span className="block text-muted-foreground">Med puls från pulsbandet och GPS-rutt om du har det.</span>
        </span>
        <Switch checked={settings.autoExport} onCheckedChange={toggle} aria-label="Skicka avslutade pass till Strava" />
      </label>
      <button type="button" onClick={sendLatest} disabled={busy}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-border px-2.5 py-2 font-semibold disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Skicka senaste passet nu
      </button>
      {message && <p className="text-muted-foreground">{message}</p>}
    </div>
  );
}
