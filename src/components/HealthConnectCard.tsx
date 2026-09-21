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
  getLastHealthSync,
  healthAvailability,
  healthErrorCode,
  installHealthConnect,
  isHealthSupported,
  loadStoredHealthDays,
  openHealthSettings,
  readHealthDays,
  readHealthWorkouts,
  requestHealthPermissions,
  saveHealthDays,
  setLastHealthSync,
  syncWindowDays,
  type HealthAccess,
  type HealthAvailability,
  type HealthDay,
  type HealthFeature,
  withTimeout,
  withDialogTimeout,
  STEP_TIMEOUT_MS,
  healthLog,
  type HealthWorkout,
} from "@/lib/healthSync";
import { findImportedHealthWorkouts, healthWorkoutDayKey, importHealthWorkouts } from "@/lib/healthWorkoutImport";

const WEEKDAYS = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];
const FEATURES: HealthFeature[] = ["activity", "workouts", "heartRate", "sleep"];
/**
 * Varje steg får 20 sekunder. Under själva godkännandedialogen ligger Grim i
 * bakgrunden, och då pausas klockan av withDialogTimeout inne i healthSync.
 */
const STEP_WATCHDOG_MS = STEP_TIMEOUT_MS;

/** Kopplar appen mot Apple Health / Health Connect och visar veckans rörelse. */
const HealthConnectCard = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<HealthDay[]>([]);
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [access, setAccess] = useState<HealthAccess | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [workouts, setWorkouts] = useState<HealthWorkout[] | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const connected = !!access?.activity;
  const available = availability === null ? null : availability === "available";

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
      setAvailability(isHealthSupported() ? await healthAvailability() : "not-supported");
      if (isHealthSupported()) setAccess(await checkHealthAccess());
    })();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Användaren kan dra tillbaka åtkomsten i Health Connect medan Grim ligger i
   * bakgrunden – läs därför om statusen varje gång appen kommer fram igen.
   */
  useEffect(() => {
    if (!isHealthSupported() || typeof document === "undefined") return;
    const refresh = () => {
      if (document.hidden) return;
      void (async () => {
        try {
          setAccess(await checkHealthAccess());
        } catch (err) {
          healthLog("status refresh on resume failed", err);
        }
      })();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  /** Ger varje feltillstånd ett eget, konkret besked. */
  const reportError = useCallback((err: unknown, fallback: string) => {
    const code = healthErrorCode(err);
    const message = (err as { message?: string })?.message || fallback;
    if (code === "not-installed") {
      setAvailability("not-installed");
      toast.error("Health Connect saknas eller behöver uppdateras", {
        description: "Installera Health Connect från Play Store och försök igen.",
        action: { label: "Installera", onClick: () => void installHealthConnect() },
      });
      return;
    }
    if (code === "denied") {
      toast.error(message, {
        action: { label: "Behörigheter", onClick: () => void openHealthSettings() },
      });
      return;
    }
    toast.error(message);
  }, []);

  const sync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      // Säkerhetsnät: hänger något i bryggan mot Health Connect ska knappen
      // släppa laddningsläget med ett tydligt fel i stället för att snurra.
      healthLog("sync started");
      const granted = await withDialogTimeout(
        requestHealthPermissions(),
        "Health Connect svarade inte i tid. Försök igen.",
        STEP_WATCHDOG_MS,
      );
      setAccess(granted);
      // Hämta från senaste lyckade synk så inga dagar hoppas över.
      const windowDays = Math.max(7, syncWindowDays(getLastHealthSync()));
      healthLog("permissions ok, reading days", { granted, windowDays });
      const days = await withTimeout(
        readHealthDays(windowDays),
        STEP_WATCHDOG_MS,
        "Health Connect svarade inte med någon data. Försök igen.",
      );
      healthLog("days read", days.length);
      setRows(days.slice(-7));
      try {
        await saveHealthDays(userId, days);
        setLastHealthSync();
      } catch (err) {
        healthLog("save failed", err);
        toast.warning("Hälsodatan visas, men kunde inte sparas – ingen kontakt med servern.");
      }
      if (!granted.workouts || !granted.heartRate || !granted.sleep) {
        toast.success("Hälsodata hämtad – vissa datatyper saknar fortfarande behörighet");
      } else {
        toast.success("Hälsodata hämtad");
      }
    } catch (err: any) {
      healthLog("sync failed", err?.message);
      reportError(err, "Kunde inte hämta hälsodata");
      try {
        setAccess(await checkHealthAccess());
      } catch (statusErr) {
        healthLog("status refresh failed", statusErr);
      }
    } finally {
      setSyncing(false);
    }
  }, [userId, reportError]);

  const loadWorkouts = useCallback(async () => {
    if (!userId) return;
    setLoadingWorkouts(true);
    try {
      healthLog("workout fetch started");
      const granted = await withDialogTimeout(
        requestHealthPermissions(),
        "Health Connect svarade inte i tid. Försök igen.",
        STEP_WATCHDOG_MS,
      );
      setAccess(granted);
      if (!granted.workouts) {
        throw new Error("Grim saknar åtkomst till Genomförda pass. Tillåt det i Health Connect.");
      }
      const list = await withTimeout(
        readHealthWorkouts(30),
        STEP_WATCHDOG_MS,
        "Health Connect svarade inte med några pass. Försök igen.",
      );
      setWorkouts(list);
      setImportedKeys(await findImportedHealthWorkouts(userId, list));
      if (list.length === 0) toast.info("Inga pass hittades de senaste 30 dagarna");
    } catch (err: any) {
      healthLog("workout fetch failed", err?.message);
      reportError(err, "Kunde inte hämta pass");
    } finally {
      setLoadingWorkouts(false);
    }
  }, [userId, reportError]);



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
