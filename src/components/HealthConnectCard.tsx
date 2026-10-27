import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, Download, Loader2, RefreshCw, Settings, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  activityTrend,
  checkHealthAccess,
  FEATURE_LABELS,
  formatSleep,
  HealthError,
  getLastHealthSync,
  healthAvailability,
  formatHealthError,
  installHealthConnect,
  isHealthSupported,
  loadStoredHealthDays,
  openHealthSettings,
  openHealthPermissions,
  readHealthDays,
  readHealthWorkouts,
  saveHealthDays,
  setLastHealthSync,
  syncWindowDays,
  withTimeout,
  requestHealthPermissions,
  runHealthDiagnostics,
  subscribeHealthTrail,
  testHealthPermissionRequest,
  HEALTH_TEST_SETS,
  type HealthDiagnostics,
  type HealthAccess,
  type HealthAvailability,
  type HealthDay,
  type HealthFeature,
  healthLog,
  type HealthWorkout,
  checkHealthWriteAccess,
  clearHealthSyncError,
  getLastHealthSyncError,
  isHealthWriteSupported,
  requestHealthWriteAccess,
  type HealthWriteAccess,
  disableBackgroundSync,
  enableBackgroundSync,
  getBackgroundSyncState,
  isBackgroundSyncEnabled,
  type BackgroundSyncState,
} from "@/lib/healthSync";
import { isHealthWriteEnabled, setHealthWriteEnabled, syncGrimWorkoutsToHealth } from "@/lib/healthWriteSync";
import { findImportedHealthWorkouts, healthWorkoutDayKey, importHealthWorkouts, relocateHealthImports, cleanupHealthImportDetails } from "@/lib/healthWorkoutImport";

const WEEKDAYS = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];
const FEATURES: HealthFeature[] = ["activity", "workouts", "heartRate", "sleep", "weight"];
// Sista skyddsnätet måste ligga efter native-dialogens egen diagnostik så att
// användaren får den verkliga HC-koden i stället för ett för tidigt HC-04.
const SYNC_HARD_TIMEOUT_MS = 60000;
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
  const [lastError, setLastError] = useState<{ ref: string; message: string } | null>(null);
  const [diag, setDiag] = useState<HealthDiagnostics | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [writeSupported, setWriteSupported] = useState(false);
  const [writeAccess, setWriteAccess] = useState<HealthWriteAccess | null>(null);
  const [writeEnabled, setWriteEnabledState] = useState(isHealthWriteEnabled());
  const [writeBusy, setWriteBusy] = useState(false);
  const [bgError] = useState(getLastHealthSyncError);
  const [bgState, setBgState] = useState<BackgroundSyncState | null>(null);
  const [bgEnabled, setBgEnabled] = useState(isBackgroundSyncEnabled());
  const [bgBusy, setBgBusy] = useState(false);
  /** Satt när Health Connect inte gick att fråga – då vet vi INTE att Grim saknar åtkomst. */
  const [accessError, setAccessError] = useState<string | null>(null);
  const connected = !!access?.activity;
  const available = availability === null ? null : availability === "available";

  /**
   * Läser behörigheterna och skiljer på "nekad" och "gick inte att läsa".
   * Tidigare blev ett fel tyst EMPTY_ACCESS och kortet visade "Inte kopplad"
   * trots att allt var tillåtet i Health Connect.
   */
  const refreshAccess = useCallback(async (): Promise<HealthAccess | null> => {
    try {
      const res = await checkHealthAccess(true);
      setAccess(res);
      setAccessError(null);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      healthLog("status check failed", msg);
      setAccessError(msg);
      return null;
    }
  }, []);

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
      if (isHealthSupported()) {
        await refreshAccess();
        const ws = await isHealthWriteSupported();
        setWriteSupported(ws);
        if (ws) setWriteAccess(await checkHealthWriteAccess());
        setBgState(await getBackgroundSyncState());
      }
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
          await refreshAccess();
          if (await isHealthWriteSupported()) setWriteAccess(await checkHealthWriteAccess());
        } catch (err) {
          healthLog("status refresh on resume failed", err);
        }
      })();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  const openPermissionsRef = useRef<() => Promise<void>>(async () => {});
  /** Ger varje feltillstånd ett eget, konkret besked – med felkod. */
  const reportError = useCallback((err: unknown, fallback: string) => {
    const { code, ref, message, label } = formatHealthError(err, fallback);
    setLastError({ ref, message });
    if (code === "not-installed" || code === "update-required") {
      setAvailability(code === "not-installed" ? "not-installed" : "update-required");
      toast.error(`${message} (${label})`, {
        description: code === "not-installed" ? "Installera Health Connect från Play Store." : "Uppdatera Health Connect från Play Store.",
        action: { label: "Installera", onClick: () => void installHealthConnect() },
      });
      return;
    }
    if (code === "denied") {
      toast.error(message, {
        description: label,
        action: {
          label: "Behörigheter",
          onClick: () => void openPermissionsRef.current(),
        },
      });
      return;
    }
    toast.error(message, { description: label });
  }, []);

  const [openingPermissions, setOpeningPermissions] = useState(false);
  const openingRef = useRef(false);
  const openPermissions = useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpeningPermissions(true);
    toast.message("Öppnar Health Connect…");
    try {
      const res = await openHealthPermissions();
      toast.success("Health Connect öppnades. Tillåt Grim och gå tillbaka till appen.", {
        description: res.result.opened ? `Väg: ${res.result.opened}` : undefined,
      });
    } catch (err) {
      reportError(err, "Kunde inte öppna Health Connect-inställningarna");
    } finally {
      openingRef.current = false;
      setOpeningPermissions(false);
    }
  }, [reportError]);
  openPermissionsRef.current = openPermissions;

  const sync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      healthLog("manual sync entry point started");
      // Förstagångskoppling: Grim syns ofta inte i Health Connect förrän en
      // behörighetsbegäran gjorts. Utan grunddata frågar Synka därför EN gång via
      // godkännanderutan (egna hårda gränser: 12 s om ingen ruta syns, längre bara
      // medan rutan faktiskt visas). Blir det fortfarande nej ges ett tydligt fel
      // direkt – ingen datahämtning mot den hårda synkgränsen.
      await withTimeout((async () => {
      // Hela synken – även behörighetsfrågan – ligger under den hårda gränsen.
      // null = statusen gick inte att läsa: försök hämta data ändå (läsningen är facit).
      let current = await refreshAccess();
      if (current && !current.activity) {
        healthLog("sync: not connected -> one permission request");
        try {
          current = await requestHealthPermissions();
          setAccess(current);
        } catch (err) {
          healthLog("sync: permission request failed", err);
          current = await refreshAccess();
        }
        if (current && !current.activity) {
          throw new HealthError(
            "denied",
            "Grim är inte kopplat till Health Connect. Tryck på Behörigheter, tillåt Grim (Steg, Aktiva kalorier) och tryck sedan på Synka hälsodata igen.",
          );
        }
      }
        healthLog("reading health connect");
        const windowDays = Math.max(7, syncWindowDays(getLastHealthSync()));
        const days = await readHealthDays(windowDays);
        healthLog("days read", days.length);
        setLastError(null);
        setRows(days.slice(-7));
        try {
          await saveHealthDays(userId, days);
          setLastHealthSync();
          clearHealthSyncError();
        } catch (err) {
          healthLog("save failed", err);
          throw err;
        }
        // Data lästes – då har Grim åtkomst även om statusfrågan krånglar.
        void refreshAccess().then((a) => {
          if (!a) setAccess((prev) => ({ ...(prev ?? { workouts: false, heartRate: false, sleep: false, weight: false }), activity: true }));
        });
        toast.success("Hälsodata hämtad");
        if (isHealthWriteEnabled()) {
          void syncGrimWorkoutsToHealth(userId)
            .then((r) => {
              healthLog("write sync done", r);
              if (r.failed > 0) toast.error(`${r.failed} pass kunde inte sparas i Health Connect`);
              else if (r.written + r.deleted > 0) toast.success(`${r.written} pass sparade i Health Connect`);
            })
            .catch((err) => reportError(err, "Kunde inte spara pass i Health Connect"));
        }
      })(), SYNC_HARD_TIMEOUT_MS, "Hälsosynken svarade inte inom den maximala tidsgränsen.", "sync-timeout");
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
  }, [userId, reportError, refreshAccess]);

  const loadWorkouts = useCallback(async () => {
    if (!userId) return;
    setLoadingWorkouts(true);
    try {
      healthLog("workout fetch started");
      const list = await readHealthWorkouts(30);
      setWorkouts(list);
      setImportedKeys(await findImportedHealthWorkouts(userId, list));
      void relocateHealthImports(userId, list);
      void cleanupHealthImportDetails(userId);
      if (list.length === 0) toast.info("Inga pass hittades de senaste 30 dagarna");
    } catch (err: any) {
      healthLog("workout fetch failed", err?.message);
      reportError(err, "Kunde inte hämta pass");
    } finally {
      setLoadingWorkouts(false);
    }
  }, [userId, reportError, refreshAccess]);



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
      if (res.failed > 0) {
        toast.warning(`${res.imported} pass importerade – ${res.failed} misslyckades, försök igen.`);
      } else {
        toast.success(`${res.imported} pass importerade`);
      }
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
        const res = await importHealthWorkouts(userId, [w]);
        if (res.failed > 0) {
          toast.error("Kunde inte importera passet – försök igen.");
          return;
        }
        setImportedKeys((prev) => new Set(prev).add(healthWorkoutDayKey(w)));
        toast.success(res.skipped > 0 ? `${w.label} var redan importerat` : `${w.label} importerat`);
      } catch (err: any) {
        toast.error(err?.message || "Kunde inte importera passet");
      }
    },
    [userId],
  );

  const [trail, setTrail] = useState<string[]>([]);
  useEffect(() => (diagOpen ? subscribeHealthTrail(setTrail) : undefined), [diagOpen]);

  const refreshDiag = useCallback(async () => {
    setDiagBusy(true);
    try {
      setDiag(await runHealthDiagnostics());
    } catch (err: any) {
      setTestLog((l) => [`${new Date().toLocaleTimeString("sv-SE")} diagnostik: ${err?.message}`, ...l]);
    } finally {
      setDiagBusy(false);
    }
  }, []);

  const runTest = useCallback(async (set: keyof typeof HEALTH_TEST_SETS) => {
    const t = () => new Date().toLocaleTimeString("sv-SE");
    setTestLog((l) => [`${t()} Test ${set}: läser behörigheter…`, ...l]);
    try {
      const granted = await testHealthPermissionRequest(set);
      setTestLog((l) => [`${t()} Test ${set}: svar ${JSON.stringify(granted)}`, ...l]);
      setAccess(await checkHealthAccess());
    } catch (err) {
      const f = formatHealthError(err);
      setTestLog((l) => [`${t()} Test ${set}: ${f.ref} ${f.message}`, ...l]);
    } finally {
      void refreshDiag();
    }
  }, [refreshDiag]);

  const toggleWrite = useCallback(async () => {
    if (!userId) return;
    setWriteBusy(true);
    try {
      if (writeEnabled) {
        setHealthWriteEnabled(false);
        setWriteEnabledState(false);
        toast.message("Grim slutar spara nya pass i Health Connect. Redan sparade pass ligger kvar.");
        return;
      }
      const granted = writeAccess?.workouts ? writeAccess : await requestHealthWriteAccess();
      setWriteAccess(granted);
      setHealthWriteEnabled(true);
      setWriteEnabledState(true);
      const r = await syncGrimWorkoutsToHealth(userId);
      toast.success(
        r.written > 0 ? `${r.written} pass sparade i Health Connect` : "Nya pass sparas nu i Health Connect",
        r.skippedOverlap > 0 ? { description: `${r.skippedOverlap} pass fanns redan från klocka/annan app och hoppades över.` } : undefined,
      );
    } catch (err) {
      reportError(err, "Kunde inte slå på sparande till Health Connect");
    } finally {
      setWriteBusy(false);
    }
  }, [userId, writeEnabled, writeAccess, reportError]);

  const toggleBackground = useCallback(async () => {
    setBgBusy(true);
    try {
      if (bgEnabled) {
        await disableBackgroundSync();
        setBgEnabled(false);
        toast.message("Bakgrundssynken är avstängd.");
      } else {
        const state = await enableBackgroundSync();
        setBgEnabled(true);
        setBgState(state);
        toast.success(
          state?.featureAvailable && state.permissionGranted
            ? "Grim hämtar hälsodata i bakgrunden ungefär varannan timme."
            : "Bakgrundsjobbet är på. Den här telefonens Health Connect tillåter inte läsning i bakgrunden, så data hämtas när du öppnar appen.",
        );
      }
    } catch (err) {
      reportError(err, "Kunde inte ändra bakgrundssynken");
    } finally {
      setBgBusy(false);
    }
  }, [bgEnabled, reportError]);

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
            ? availability === "not-installed"
              ? "Health Connect saknas – installera det från Play Store"
              : availability === "update-required"
                ? "Health Connect behöver uppdateras från Play Store"
              : availability === "not-supported"
                ? "Hälsodata stöds inte på den här enheten"
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
              {accessError && !connected
                ? `Kunde inte läsa Grims behörigheter från Health Connect (${accessError}). Tryck på Synka hälsodata för att hämta ändå.`
                : connected
                ? "Kopplingen är aktiv – Grim läser din hälsodata (t.ex. Samsung Health via Health Connect)."
                : "Inte kopplad ännu. Tryck på Behörigheter, tillåt Grim i Health Connect och tryck sedan på Synka hälsodata."}
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
              onClick={() => {
                toast.message("Öppnar Health Connect…");
                void openHealthSettings()
                  .then(() => toast.success("Health Connect öppnades. Tillåt Grim och gå tillbaka till appen."))
                  .catch((err) => reportError(err, "Kunde inte öppna behörigheterna"));
              }}
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              Tillåt {missing.map((f) => FEATURE_LABELS[f].toLowerCase()).join(", ")}
            </Button>
          )}
          {writeSupported && (
            <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
              <span className={writeEnabled && writeAccess?.workouts ? "" : "text-muted-foreground"}>
                {writeEnabled && writeAccess?.workouts
                  ? `Grim-pass sparas i Health Connect${writeAccess.calories ? " (med kalorier" + (writeAccess.distance ? " och distans)" : ")") : ""}.`
                  : writeEnabled
                    ? "Spara pass är på, men behörigheten saknas i Health Connect."
                    : "Spara dina Grim-pass i Health Connect (frivilligt)."}
              </span>
              <Button size="sm" variant="outline" className="shrink-0 rounded-full" disabled={writeBusy || !userId} onClick={() => void toggleWrite()}>
                {writeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : writeEnabled ? "Stäng av" : "Slå på"}
              </Button>
            </div>
          )}
          {bgState && (
            <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
              <span className={bgEnabled ? "" : "text-muted-foreground"}>
                {!bgEnabled
                  ? "Synka i bakgrunden ungefär varannan timme (frivilligt)."
                  : !bgState.featureAvailable
                    ? "Bakgrundsjobbet är på, men telefonens Health Connect stöder inte läsning i bakgrunden. Data hämtas när appen öppnas."
                    : !bgState.permissionGranted
                      ? "Bakgrundsjobbet är på, men läsning i bakgrunden är inte tillåten i Health Connect."
                      : `Synkar i bakgrunden${bgState.cache?.lastRun?.ranAt ? `, senast ${new Date(bgState.cache.lastRun.ranAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}` : ""}.`}
                {bgState.pendingWrites > 0 && ` ${bgState.pendingWrites} pass väntar på att sparas.`}
              </span>
              <Button size="sm" variant="outline" className="shrink-0 rounded-full" disabled={bgBusy} onClick={() => void toggleBackground()}>
                {bgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : bgEnabled ? "Stäng av" : "Slå på"}
              </Button>
            </div>
          )}
          {!lastError && bgError && (
            <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
              Senaste automatiska synk misslyckades {new Date(bgError.at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}: {bgError.message} (Felkod {bgError.ref})
            </p>
          )}
          {lastError && (
            <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">
              {lastError.message} (Felkod {lastError.ref})
            </p>
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
          {today && (today.totalCalories || today.distanceM || today.avgHeartRate || today.restingHeartRate || today.weightKg) ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {[
                today.totalCalories ? `${today.totalCalories.toLocaleString("sv-SE")} kcal totalt` : null,
                today.distanceM ? `${(today.distanceM / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km` : null,
                today.avgHeartRate ? `puls snitt ${today.avgHeartRate}${today.minHeartRate && today.maxHeartRate ? ` (${today.minHeartRate}–${today.maxHeartRate})` : ""}` : null,
                today.restingHeartRate ? `vilopuls ${today.restingHeartRate}` : null,
                today.weightKg ? `${today.weightKg.toLocaleString("sv-SE")} kg` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}

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
        {isHealthSupported() && (availability === "not-installed" || availability === "update-required") && (
          <Button variant="outline" className="rounded-full" onClick={() => void installHealthConnect()}>
            <Download className="mr-2 h-4 w-4" />
            {availability === "update-required" ? "Uppdatera Health Connect" : "Installera Health Connect"}
          </Button>
        )}
        {isHealthSupported() && available !== false && (
          <Button
            variant="outline"
            className="rounded-full"
            disabled={openingPermissions}
            onClick={() => {
              void openPermissions();
            }}
          >
            {openingPermissions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
            Behörigheter
          </Button>
        )}
      </div>

      {isHealthSupported() && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3 text-xs">
          <button
            type="button"
            className="font-semibold text-muted-foreground"
            onClick={() => {
              const next = !diagOpen;
              setDiagOpen(next);
              if (next && !diag) void refreshDiag();
            }}
          >
            {diagOpen ? "Dölj diagnostik" : "Visa diagnostik (felsökning)"}
          </button>
          {diagOpen && (
            <div className="mt-2 space-y-2">
              {diag && (
                <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 break-all">
                  {[
                    ["Installerat", diag.installed],
                    ["SDK tillgänglig", `${diag.sdkAvailable} (status ${diag.sdkStatus})`],
                    ["HC-paket", diag.installedPackages],
                    ["Grim-paket", diag.packageName],
                    ["API-nivå", `${diag.apiLevel} ${diag.manufacturer ?? ""} ${diag.model ?? ""}`],
                    ["Rutans intent", `${diag.permissionIntentAction ?? ""} → ${diag.permissionIntentPackage || "–"}`],
                    ["Intent-resolvers", diag.permissionIntentResolvers],
                    ["Begärda", diag.requestedPermissions],
                    ["Beviljade", diag.grantedPermissions ?? diag.grantedError],
                    ["Saknas", diag.missingPermissions],
                    ["Launcher registrerad", diag.launcherRegistered],
                    ["Launch försökt", diag.launchAttempted],
                    ["Launch returnerade", diag.launchReturned],
                    ["Resultat mottaget", diag.resultReceived],
                    ["Senaste fel", diag.lastError || "–"],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="contents">
                      <dt className="text-muted-foreground">{String(k)}</dt>
                      <dd>{Array.isArray(v) ? (v.length ? v.join(", ") : "–") : String(v ?? "–")}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" disabled={diagBusy} onClick={() => void refreshDiag()}>
                  Uppdatera
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => void runTest("A")}>
                  Test A: steg
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => void runTest("B")}>
                  Test B: steg + distans
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => void runTest("C")}>
                  Test C: alla
                </Button>
              </div>
              {diagBusy && <p className="text-muted-foreground">Arbetar…</p>}
              {trail.length > 0 && (
                <details>
                  <summary className="text-muted-foreground">Steglogg ({trail.length})</summary>
                  <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-muted-foreground">
                    {trail.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                </details>
              )}
              {testLog.length > 0 && (
                <ul className="space-y-0.5 text-muted-foreground">
                  {testLog.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

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
