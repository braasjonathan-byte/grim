import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Download, Loader2, RefreshCw, Settings, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  activityTrend,
  checkHealthAccess,
  FEATURE_LABELS,
  formatSleep,
  installHealthConnect,
  isHealthAvailable,
  isHealthSupported,
  loadStoredHealthDays,
  openHealthSettings,
  readHealthDays,
  readHealthWorkouts,
  requestHealthPermissions,
  saveHealthDays,
  type HealthAccess,
  type HealthDay,
  type HealthFeature,
  type HealthWorkout,
} from "@/lib/healthSync";
import { findImportedHealthWorkouts, healthWorkoutDayKey, importHealthWorkouts } from "@/lib/healthWorkoutImport";

const WEEKDAYS = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];
const FEATURES: HealthFeature[] = ["activity", "workouts", "heartRate", "sleep"];

/** Kopplar appen mot Apple Health / Health Connect och visar veckans rörelse. */
const HealthConnectCard = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<HealthDay[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [access, setAccess] = useState<HealthAccess | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [workouts, setWorkouts] = useState<HealthWorkout[] | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const connected = !!access?.activity;

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
      if (isHealthSupported()) setAccess(await checkHealthAccess());
    })();
    return () => {
      active = false;
    };
  }, []);


  const sync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      setAccess(await requestHealthPermissions());
      const days = await readHealthDays(7);
      setRows(days);
      try {
        await saveHealthDays(userId, days);
      } catch {
        /* spara kan misslyckas offline – visa ändå datan */
      }
      toast.success("Hälsodata hämtad");

    } catch (err: any) {
      toast.error(err?.message || "Kunde inte hämta hälsodata");
      setAccess(await checkHealthAccess());
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  const loadWorkouts = useCallback(async () => {
    if (!userId) return;
    setLoadingWorkouts(true);
    try {
      const granted = await requestHealthPermissions();
      setAccess(granted);
      if (!granted.workouts) {
        toast.error("Grim saknar åtkomst till Genomförda pass. Tillåt det i Health Connect.");
        return;
      }
      const list = await readHealthWorkouts(30);
      setWorkouts(list);
      setImportedKeys(await findImportedHealthWorkouts(userId, list));
      if (list.length === 0) toast.info("Inga pass hittades de senaste 30 dagarna");
    } catch (err: any) {
      toast.error(err?.message || "Kunde inte hämta pass");
    } finally {
      setLoadingWorkouts(false);
    }
  }, [userId]);


  const importAll = useCallback(async () => {
    if (!userId || !workouts) return;
    const pending = workouts.filter((w) => !importedKeys.has(healthWorkoutDayKey(w)));
    if (pending.length === 0) {
      toast.info("Alla pass är redan importerade");
      return;
    }
    setLoadingWorkouts(true);
    try {
      const res = await importHealthWorkouts(userId, pending);
      setImportedKeys(await findImportedHealthWorkouts(userId, workouts));
      toast.success(`${res.imported} pass importerade`);
    } catch (err: any) {
      toast.error(err?.message || "Kunde inte importera passen");
    } finally {
      setLoadingWorkouts(false);
    }
  }, [userId, workouts, importedKeys]);

  const importOne = useCallback(
    async (w: HealthWorkout) => {
      if (!userId) return;
      try {
        await importHealthWorkouts(userId, [w]);
        setImportedKeys((prev) => new Set(prev).add(healthWorkoutDayKey(w)));
        toast.success(`${w.label} importerat`);
      } catch (err: any) {
        toast.error(err?.message || "Kunde inte importera passet");
      }
    },
    [userId],
  );

  const maxSteps = Math.max(1, ...rows.map((r) => r.steps));
  const today = rows[rows.length - 1];
  const trend = activityTrend(rows);
  const missing = access ? FEATURES.filter((f) => !access[f]) : [];


  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="h-4 w-4" />
        <span>
          {isHealthSupported()
            ? available === false
              ? "Health Connect / Apple Health hittades inte"
              : "Hämta steg, aktiva kalorier och genomförda pass från din hälsoapp"
            : "Fungerar i Grim-appen på mobilen"}
        </span>
      </div>

      {isHealthSupported() && (
        <div
          className={`space-y-2 rounded-2xl border p-3 text-sm ${
            connected ? "border-success/40 bg-success/10" : "border-border/60 bg-card/60"
          }`}
        >
          <div className={`flex items-center gap-2 ${connected ? "text-success" : "text-muted-foreground"}`}>
            {connected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Activity className="h-4 w-4 shrink-0" />}
            <span>
              {connected
                ? "Kopplingen är aktiv – Grim läser din hälsodata (t.ex. Samsung Health via Health Connect)."
                : "Inte kopplad ännu. Tryck på Synka hälsodata och godkänn behörigheterna."}
            </span>
          </div>
          {access && (
            <ul className="space-y-1">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs">
                  {access[feature] ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className={access[feature] ? "" : "text-muted-foreground"}>
                    {FEATURE_LABELS[feature]}
                    {!access[feature] && " – saknas"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {access && missing.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => void openHealthSettings()}
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              Tillåt {missing.map((f) => FEATURE_LABELS[f].toLowerCase()).join(", ")}
            </Button>
          )}
        </div>
      )}

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
              {today.sleepMinutes > 0 && ` · ${formatSleep(today.sleepMinutes)} sömn`}
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
        {isHealthSupported() && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={loadWorkouts}
            disabled={!userId || loadingWorkouts}
          >
            {loadingWorkouts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Hämta genomförda pass
          </Button>
        )}
        {isHealthSupported() && available === false && (
          <Button variant="outline" className="rounded-full" onClick={() => void installHealthConnect()}>
            <Download className="mr-2 h-4 w-4" />
            Installera Health Connect
          </Button>
        )}
        {isHealthSupported() && available !== false && (
          <Button variant="outline" className="rounded-full" onClick={() => void openHealthSettings()}>
            <Settings className="mr-2 h-4 w-4" />
            Behörigheter
          </Button>
        )}
      </div>

      {workouts && workouts.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Pass senaste 30 dagarna</p>
            <Button size="sm" className="rounded-full" onClick={importAll} disabled={loadingWorkouts}>
              Importera alla
            </Button>
          </div>
          <ul className="space-y-2">
            {workouts.map((w) => {
              const done = importedKeys.has(healthWorkoutDayKey(w));
              const info = [
                w.minutes ? `${Math.round(w.minutes)} min` : null,
                w.distanceKm ? `${w.distanceKm} km` : null,
                w.calories ? `${w.calories} kcal` : null,
                w.avgHeartRate ? `${w.avgHeartRate} bpm` : null,
              ].filter(Boolean);
              return (
                <li key={healthWorkoutDayKey(w)} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{w.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(w.start).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                      {info.length > 0 && ` · ${info.join(" · ")}`} · {w.source}
                    </p>
                  </div>
                  {done ? (
                    <span className="shrink-0 text-xs font-semibold text-success">Importerat</span>
                  ) : (
                    <Button size="sm" variant="outline" className="shrink-0 rounded-full" onClick={() => void importOne(w)}>
                      Importera
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HealthConnectCard;
