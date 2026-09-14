import { useCallback, useEffect, useState } from "react";
import { Activity, Download, Loader2, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  activityTrend,
  installHealthConnect,
  isHealthAvailable,
  isHealthSupported,
  loadStoredHealthDays,
  openHealthSettings,
  readHealthDays,
  requestHealthPermissions,
  saveHealthDays,
  type HealthDay,
} from "@/lib/healthSync";

const WEEKDAYS = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];

/** Kopplar appen mot Apple Health / Health Connect och visar veckans rörelse. */
const HealthConnectCard = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<HealthDay[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) {
        try {
          setRows(await loadStoredHealthDays(id));
        } catch {
          /* ignore */
        }
      }
      setAvailable(isHealthSupported() ? await isHealthAvailable() : false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const sync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      await requestHealthPermissions();
      const days = await readHealthDays(7);
      await saveHealthDays(userId, days);
      setRows(days);
      toast.success("Hälsodata hämtad");
    } catch (err: any) {
      toast.error(err?.message || "Kunde inte hämta hälsodata");
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  const maxSteps = Math.max(1, ...rows.map((r) => r.steps));
  const today = rows[rows.length - 1];
  const trend = activityTrend(rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="h-4 w-4" />
        <span>
          {isHealthSupported()
            ? available === false
              ? "Health Connect / Apple Health hittades inte"
              : "Hämta steg och aktiva kalorier från din hälsoapp"
            : "Fungerar i Grim-appen på mobilen"}
        </span>
      </div>

      {rows.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <div className="flex items-end justify-between gap-1">
            {rows.map((row) => {
              const date = new Date(`${row.day}T00:00:00`);
              const height = Math.max(6, Math.round((row.steps / maxSteps) * 56));
              return (
                <div key={row.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-primary/70"
                    style={{ height }}
                    aria-label={`${row.steps} steg`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {WEEKDAYS[date.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
          {today && (
            <p className="mt-3 text-sm">
              Idag: <strong>{today.steps.toLocaleString("sv-SE")}</strong> steg
              {today.activeCalories > 0 && ` · ${today.activeCalories} kcal`}
            </p>
          )}
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={sync} disabled={!userId || syncing || !isHealthSupported()} className="rounded-full">
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Synka hälsodata
        </Button>
        {isHealthSupported() && available === false && (
          <Button variant="outline" className="rounded-full" onClick={() => void installHealthConnect()}>
            <Download className="mr-2 h-4 w-4" />
            Installera Health Connect
          </Button>
        )}
        {isHealthSupported() && available && (
          <Button variant="outline" className="rounded-full" onClick={() => void openHealthSettings()}>
            <Settings className="mr-2 h-4 w-4" />
            Behörigheter
          </Button>
        )}
      </div>
    </div>
  );
};

export default HealthConnectCard;
