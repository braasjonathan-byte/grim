import { useState, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { toPng } from "html-to-image";
import { Heart, MapPin, Maximize2, Minimize2, Pause, Play, Settings, Share2, Square, X } from "lucide-react";
import { GPS_FIX_MAX_ACCURACY_M, useGpsTracker } from "@/hooks/useGpsTracker";
import { useHeartRate } from "@/hooks/useHeartRate";
import { openAppSettings } from "@/lib/openSettings";
import RouteMap from "@/components/RouteMap";
import { appendRouteToHistory, loadRouteHistory } from "@/lib/routeHistory";

// Inline conditioning editing card (green, open by default)
export const GpsTrackerControl = ({ onStop, autoStart = false }: { onStop: (km: number, sec: number, route: [number, number][]) => void; autoStart?: boolean }) => {
  const gps = useGpsTracker();
  const hr = useHeartRate();
  const myId = useId();
  const isOwner = gps.ownerId === myId;
  const otherActive = gps.isTracking && !isOwner;
  const didAutoStart = useRef(false);
  const [summary, setSummary] = useState<{ km: number; sec: number; route: [number, number][]; splits?: number[] } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // "Primed" = användaren har öppnat GPS-vyn men inte tryckt Starta än.
  // Vi söker GPS-signal i bakgrunden men startar inte tid/distans-räknaren.
  const [primed, setPrimed] = useState(false);
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);
  const [primePoint, setPrimePoint] = useState<[number, number] | null>(null);
  const [primeError, setPrimeError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const fixWatchId = useRef<number | null>(null);
  const goodFixSamples = useRef(0);
  const summaryCardRef = useRef<HTMLDivElement | null>(null);
  const [heatmap, setHeatmap] = useState<[number, number][][]>([]);
  useEffect(() => { setHeatmap(loadRouteHistory()); }, []);

  // Lås bakgrunden när helskärmsvyn är öppen så man inte råkar trycka/scrolla bakom
  const [fsOpen, setFsOpen] = useState(false);
  useEffect(() => {
    if (!fsOpen) return;
    const { overflow, touchAction } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.touchAction = touchAction;
    };
  }, [fsOpen]);


  const stopPrimeWatch = () => {
    if (fixWatchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(fixWatchId.current);
      fixWatchId.current = null;
    }
  };

  // Starta lokal positionssökning så snart vyn är "primed" men ej ägare ännu.
  useEffect(() => {
    if (!primed || isOwner) return;
    if (!navigator.geolocation) {
      setPrimeError("GPS stöds inte i denna enhet");
      return;
    }
    setPrimeError(null);
    if (fixWatchId.current != null) return;
    fixWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy ?? null;
        setFixAccuracy(accuracy);
        if (accuracy != null && accuracy <= GPS_FIX_MAX_ACCURACY_M) {
          goodFixSamples.current += 1;
          setPrimePoint([pos.coords.latitude, pos.coords.longitude]);
        } else {
          goodFixSamples.current = 0;
          setPrimePoint(null);
        }
      },
      (err) => {
        if (err.code === 1) setPrimeError("Platstillstånd nekades – tillåt plats och försök igen.");
        else if (err.code === 2) setPrimeError("GPS-signal hittades inte. Gå utomhus.");
        else if (err.code === 3) setPrimeError("GPS-signalen tog för lång tid. Försök utomhus med fri sikt.");
        else setPrimeError(err.message || "GPS-fel");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => { stopPrimeWatch(); };
  }, [primed, isOwner]);

  // Stoppa lokal sökning så fort vi blir ägare (riktig inspelning igång).
  useEffect(() => {
    if (isOwner) stopPrimeWatch();
  }, [isOwner]);

  useEffect(() => () => { stopPrimeWatch(); }, []);

  const hasFix = fixAccuracy != null && fixAccuracy <= GPS_FIX_MAX_ACCURACY_M;
  const canStart = hasFix && goodFixSamples.current >= 2 && !starting && !otherActive;
  const fullscreenRoute = isOwner ? gps.route : primePoint ? [primePoint] : [];

  const beginRecording = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      const started = await gps.start(myId);
      if (started) {
        setFullscreen(true);
        setPrimed(false);
      }
    } finally {
      setStarting(false);
    }
  };

  const cancelPrime = () => {
    stopPrimeWatch();
    setPrimed(false);
    setFixAccuracy(null);
    setPrimePoint(null);
    setPrimeError(null);
    goodFixSamples.current = 0;
    setFullscreen(false);
  };

  useEffect(() => {
    if (autoStart && !didAutoStart.current && !gps.isTracking) {
      didAutoStart.current = true;
      setPrimed(true);
      setFullscreen(true);
    }
  }, [autoStart, gps.isTracking]);

  // Auto-open fullscreen when this control becomes the owner of a fresh recording
  useEffect(() => {
    if (isOwner && gps.isTracking && !summary) {
      setFullscreen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, gps.isTracking]);


  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };
  const fmtPace = (km: number, sec: number) => {
    if (km <= 0.01) return "–";
    const p = sec / km; // sec per km
    const mn = Math.floor(p / 60);
    const sc = Math.round(p % 60);
    return `${mn}:${String(sc).padStart(2, "0")}/km`;
  };
  const fmtKmh = (km: number, sec: number) => {
    if (sec <= 0) return "–";
    return `${(km / (sec / 3600)).toFixed(1)} km/h`;
  };

  if (summary) {
    const shareImage = async () => {
      if (!summaryCardRef.current) return;
      try {
        const dataUrl = await toPng(summaryCardRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor || "#0a0a0a" });
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `pass-${Date.now()}.png`, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void> };
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          await nav.share({ files: [file], title: "Mitt pass", text: `${summary.km.toFixed(2)} km på ${fmtTime(summary.sec)}` });
        } else {
          const a = document.createElement("a");
          a.href = dataUrl; a.download = file.name; a.click();
        }
      } catch {
        toast.error("Kunde inte skapa delningsbild");
      }
    };
    return (
      <div className="space-y-2">
        <div ref={summaryCardRef} className="space-y-2 bg-background border border-primary rounded-md p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <MapPin className="w-3.5 h-3.5" /> Pass slutfört
          </div>
          {summary.route.length > 1 && (
            <RouteMap route={summary.route} height={180} heatmap={heatmap} />
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="border border-border rounded-md p-2 text-center bg-secondary">
              <p className="text-lg font-black leading-tight">{(Math.round(summary.km * 100) / 100).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">km</p>
            </div>
            <div className="border border-border rounded-md p-2 text-center bg-secondary">
              <p className="text-lg font-black leading-tight font-mono">{fmtTime(summary.sec)}</p>
              <p className="text-[10px] text-muted-foreground">tid</p>
            </div>
            <div className="border border-border rounded-md p-2 text-center bg-secondary">
              <p className="text-lg font-black leading-tight font-mono">{fmtPace(summary.km, summary.sec)}</p>
              <p className="text-[10px] text-muted-foreground">snittempo</p>
            </div>
            <div className="border border-border rounded-md p-2 text-center bg-secondary">
              <p className="text-lg font-black leading-tight font-mono">{fmtKmh(summary.km, summary.sec)}</p>
              <p className="text-[10px] text-muted-foreground">snitthastighet</p>
            </div>
          </div>
          {summary.splits && summary.splits.length > 0 && (
            <div className="border border-border rounded-md p-2 bg-secondary/50">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Splits</p>
              <div className="grid grid-cols-5 gap-1">
                {summary.splits.map((sec, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[9px] opacity-70">km {i + 1}</div>
                    <div className="font-mono text-[11px] font-black tabular-nums">{fmtTime(Math.round(sec))}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStop(summary.km, summary.sec, summary.route); setSummary(null); }}
            className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md"
          >
            Spara pass
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); shareImage(); }}
            className="px-3 py-2 bg-secondary text-foreground text-xs font-semibold rounded-md border border-border flex items-center gap-1"
          >
            <Share2 className="w-3.5 h-3.5" /> Dela
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSummary(null); }}
            className="px-3 py-2 bg-secondary text-foreground text-xs font-semibold rounded-md border border-border"
          >
            Släng
          </button>
        </div>
      </div>
    );

  }

  return (
    <div className={`space-y-2 bg-background border border-border rounded-md p-1 max-w-full ${isOwner ? "w-full" : "w-fit"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {!isOwner ? (
          <button
            type="button"
            disabled={otherActive}
            onClick={(e) => {
              e.stopPropagation();
              if (otherActive) return;
              setPrimed(true);
              setFullscreen(true);
            }}
            className="w-full h-11 flex items-center justify-center gap-1.5 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-full shadow-soft active:scale-[0.98] transition-all disabled:opacity-50"
            title={otherActive ? "En GPS-inspelning pågår redan på en annan övning" : undefined}
          >
            <MapPin className="w-3.5 h-3.5" /> Starta GPS-inspelning
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (gps.isPaused) gps.resume(); else gps.pause();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-md border border-border"
            >
              {gps.isPaused ? (<><Play className="w-3.5 h-3.5 fill-current" /> Fortsätt</>) : (<><Pause className="w-3.5 h-3.5 fill-current" /> Pausa</>)}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const r = gps.stop();
                setSummary({ km: r.distanceKm, sec: r.elapsedSec, route: r.route });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground text-xs font-semibold rounded-md"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Stoppa
            </button>
            <div className="flex flex-col text-[10px] leading-tight">
              <span className="font-mono font-bold text-foreground">{fmtTime(gps.elapsedSec)} · {(Math.round(gps.distanceKm * 100) / 100).toFixed(2)} km</span>
              <span className="text-muted-foreground">
                {gps.isPaused ? "Pausad" : (gps.accuracy != null ? `Noggrannhet ±${Math.round(gps.accuracy)}m` : "Söker signal…")}
              </span>
            </div>
          </>
        )}
      </div>

      {isOwner && (
        <div className="grid grid-cols-3 gap-2 bg-secondary border border-border rounded-md p-2">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">Tid</span>
            <span className="font-mono font-bold text-sm text-foreground">{fmtTime(gps.elapsedSec)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">Distans</span>
            <span className="font-mono font-bold text-sm text-foreground">{(Math.round(gps.distanceKm * 100) / 100).toFixed(2)} km</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold">Tempo</span>
            <span className="font-mono font-bold text-sm text-foreground">
              {gps.distanceKm >= 0.05
                ? (() => {
                    const sPerKm = gps.elapsedSec / gps.distanceKm;
                    const m = Math.floor(sPerKm / 60);
                    const s = Math.round(sPerKm % 60);
                    return `${m}:${String(s).padStart(2, "0")}/km`;
                  })()
                : "—"}
            </span>
          </div>
        </div>
      )}


      {gps.error && (
        <div className="bg-destructive/10 border border-destructive rounded-md p-2 text-[11px] text-destructive font-semibold leading-snug space-y-2">
          <div>{gps.error}</div>
          {/Platstillstånd|nekade platstillstånd|Tillåt plats/i.test(gps.error) && (
            <button
              type="button"
              onClick={async () => {
                const opened = await openAppSettings("location");
                if (!opened && !Capacitor.isNativePlatform()) {
                  toast.info("Öppna webbläsarens platsinställningar för denna sida och försök igen.");
                }
              }}
              className="w-full py-2 bg-destructive text-destructive-foreground rounded-md text-xs font-bold flex items-center justify-center gap-2"
            >
              <Settings className="w-3.5 h-3.5" /> Öppna platsinställningar
            </button>
          )}
        </div>
      )}
      {isOwner && !Capacitor.isNativePlatform() && (
        <p className="text-[10px] text-warning font-semibold">
          ⚠️ Släck inte skärmen – inspelningen pausas om skärmen släcks.
        </p>
      )}
      {isOwner && gps.route.length > 0 && (
        <div className="relative">
          <RouteMap route={gps.route} height={280} live heatmap={heatmap} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
            className="absolute top-2 right-2 z-[1000] bg-background/95 border border-border rounded-md p-1.5 shadow"
            aria-label="Öppna karta i helskärm"
          >
            <Maximize2 className="w-4 h-4 text-foreground" />
          </button>
        </div>
      )}
      {createPortal(
        fullscreen && (isOwner || primed) ? (
        <div
          className="fixed inset-0 z-[9999] bg-background flex flex-col overscroll-contain"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Map area – tar ~60% av höjden */}
          <div className="relative basis-[60%] grow-0 shrink-0 min-h-0">
            {fullscreenRoute.length > 0 ? (
              <RouteMap
                route={fullscreenRoute}
                height={9999}
                className="!h-full !rounded-none !border-0"
                live={isOwner}
                heatmap={heatmap}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground bg-secondary/30">
                {isOwner && gps.accuracy != null && gps.accuracy <= GPS_FIX_MAX_ACCURACY_M
                  ? `GPS-kontakt ±${Math.round(gps.accuracy)}m – väntar på rörelse…`
                  : "Söker GPS-signal…"}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isOwner) setFullscreen(false);
                else cancelPrime();
              }}
              className="absolute top-3 right-3 z-[1000] bg-background/95 border border-border rounded-md p-2 shadow"
              aria-label={isOwner ? "Stäng helskärm" : "Avbryt"}
            >
              {isOwner ? <Minimize2 className="w-5 h-5 text-foreground" /> : <X className="w-5 h-5 text-foreground" />}
            </button>
            {isOwner && gps.autoPaused && (
              <div className="absolute top-3 left-3 z-[1000] bg-warning text-warning-foreground rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow animate-pulse">
                Auto-pausad
              </div>
            )}
            {hr.connected && hr.bpm != null && (
              <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2 bg-destructive text-destructive-foreground rounded-md px-3 py-2 shadow-lg">
                <Heart className="w-5 h-5 fill-current animate-pulse" />
                <span className="font-mono font-black text-xl tabular-nums">{hr.bpm}</span>
                <span className="text-[10px] font-bold uppercase opacity-80">bpm</span>
              </div>
            )}
          </div>

          {/* Stats / kontroll-panel */}
          <div className="basis-[40%] grow shrink-0 min-h-0 flex flex-col bg-background border-t border-border">
            {isOwner ? (
              <>
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-background p-3 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tid</span>
                    <span className="font-mono font-black text-3xl text-foreground tabular-nums">{fmtTime(gps.elapsedSec)}</span>
                  </div>
                  <div className="bg-background p-3 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Distans</span>
                    <span className="font-mono font-black text-3xl text-primary tabular-nums">{(Math.round(gps.distanceKm * 100) / 100).toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground">km</span>
                  </div>
                  <div className="bg-background p-3 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tempo</span>
                    <span className="font-mono font-black text-2xl text-foreground tabular-nums">{fmtPace(gps.distanceKm, gps.elapsedSec)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (hr.connected) hr.disconnect(); else hr.connect(); }}
                    disabled={hr.connecting}
                    className="bg-background p-3 flex flex-col items-center justify-center"
                  >
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                      <Heart className={`w-3 h-3 ${hr.connected ? "text-destructive fill-current" : ""}`} /> Puls
                    </span>
                    <span className={`font-mono font-black text-2xl tabular-nums ${hr.connected ? "text-destructive" : "text-muted-foreground"}`}>
                      {hr.connected ? (hr.bpm ?? "--") : (hr.connecting ? "…" : "anslut")}
                    </span>
                  </button>
                </div>

                {gps.kmSplits.length > 0 && (
                  <div className="px-3 py-2 border-t border-border overflow-y-auto max-h-32">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Splits per km</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {gps.kmSplits.map((sec, i) => {
                        const best = Math.min(...gps.kmSplits);
                        const isBest = sec === best && gps.kmSplits.length > 1;
                        return (
                          <div
                            key={i}
                            className={`rounded-md px-2 py-1 text-center border ${isBest ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-foreground"}`}
                          >
                            <div className="text-[9px] font-bold opacity-70">km {i + 1}</div>
                            <div className="font-mono font-black text-sm tabular-nums">{fmtTime(Math.round(sec))}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-auto p-3 border-t border-border flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (gps.isPaused) gps.resume(); else gps.pause(); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-secondary-foreground text-sm font-bold rounded-md border border-border"
                  >
                    {gps.isPaused ? (<><Play className="w-4 h-4 fill-current" /> Fortsätt</>) : (<><Pause className="w-4 h-4 fill-current" /> Pausa</>)}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = gps.stop();
                      appendRouteToHistory(r.route);
                      setSummary({ km: r.distanceKm, sec: r.elapsedSec, route: r.route, splits: r.kmSplits });
                      setFullscreen(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-destructive text-destructive-foreground text-sm font-black rounded-md shadow"
                  >
                    <Square className="w-4 h-4 fill-current" /> Avsluta
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 p-4 h-full">
                {primeError && (
                  <div className="bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-xs font-semibold text-center max-w-full">
                    {primeError}
                  </div>
                )}
                <div className="flex items-center gap-2 bg-secondary border border-border rounded-full px-4 py-2 text-xs font-bold">
                  <span className={`w-2 h-2 rounded-full ${hasFix ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
                  {hasFix
                    ? goodFixSamples.current >= 2
                      ? `GPS-kontakt ±${Math.round(fixAccuracy!)}m`
                      : `Bekräftar GPS-kontakt… ±${Math.round(fixAccuracy!)}m`
                    : fixAccuracy != null
                      ? `Söker bättre signal… ±${Math.round(fixAccuracy)}m`
                      : "Söker GPS-signal…"}
                </div>
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={(e) => { e.stopPropagation(); beginRecording(); }}
                  className="flex items-center gap-3 px-10 py-5 bg-primary text-primary-foreground text-lg font-black rounded-full shadow-xl ring-4 ring-primary/30 disabled:opacity-40 disabled:ring-0 transition-all"
                >
                  <Play className="w-6 h-6 fill-current" />
                  {starting ? "Startar…" : "Starta"}
                </button>
                <p className="text-[11px] text-muted-foreground text-center max-w-xs">
                  Träningen startar först när GPS-signalen är stabil. Gå gärna utomhus för bästa precision.
                </p>
              </div>
            )}
          </div>
        </div>
        ) : null,
        document.body,
      )}

    </div>
  );
};

export default GpsTrackerControl;
