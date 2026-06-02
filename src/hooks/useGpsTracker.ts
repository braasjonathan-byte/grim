import { useEffect, useState } from "react";
import { getGpsVoiceIntervalMin, getGpsVoiceIntervalKm, speakPace } from "@/lib/gpsSettings";

type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (t: string, l: () => void) => void };

const haversineKm = (a: GeolocationCoordinates, b: GeolocationCoordinates) => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
};

export type RoutePoint = [number, number]; // [lat, lng]

export type GpsState = {
  isTracking: boolean;
  isPaused: boolean;
  distanceKm: number;
  elapsedSec: number;
  accuracy: number | null;
  error: string | null;
  route: RoutePoint[];
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => { distanceKm: number; elapsedSec: number; route: RoutePoint[] };
};

// ---------------- Singleton store (persists across tab/component unmounts) ----------------

type Snapshot = {
  isTracking: boolean;
  isPaused: boolean;
  distanceKm: number;
  elapsedSec: number;
  accuracy: number | null;
  error: string | null;
  route: RoutePoint[];
};

let snapshot: Snapshot = {
  isTracking: false,
  isPaused: false,
  distanceKm: 0,
  elapsedSec: 0,
  accuracy: null,
  error: null,
  route: [],
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const emit = () => { listeners.forEach(l => l()); };
const setSnap = (patch: Partial<Snapshot>) => { snapshot = { ...snapshot, ...patch }; emit(); };

let watchId: number | null = null;
let wakeLock: WakeLockSentinel | null = null;
let tickInterval: number | null = null;
let voiceInterval: number | null = null;
let startTime = 0;
let lastCoord: GeolocationCoordinates | null = null;
let distAcc = 0;
let routeAcc: RoutePoint[] = [];
let kmCount = 0;
let kmMarkSec = 0;
let lastKmSec: number | null = null;
let distAnnounceMarkKm = 0;
let distAnnounceMarkSec = 0;
let visibilityHandlerInstalled = false;
let notifInterval: number | null = null;

const installVisibilityHandler = () => {
  if (visibilityHandlerInstalled || typeof document === "undefined") return;
  visibilityHandlerInstalled = true;
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && snapshot.isTracking && !wakeLock) {
      try {
        // @ts-ignore
        wakeLock = await navigator.wakeLock?.request("screen");
      } catch {}
    }
  });
};

const NOTIF_TAG = "grim-gps-tracking";

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const showStatusNotification = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const km = (Math.round(distAcc * 100) / 100).toFixed(2);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    await reg.showNotification("GRIM – GPS-spårning pågår", {
      body: `${km} km · ${fmtTime(elapsed)}`,
      tag: NOTIF_TAG,
      renotify: false,
      requireInteraction: true,
      silent: true,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: "/" },
    } as NotificationOptions);
  } catch {
    // ignore
  }
};

const closeStatusNotification = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const notifs = await reg.getNotifications({ tag: NOTIF_TAG });
    notifs.forEach(n => n.close());
  } catch {
    // ignore
  }
};

const cleanup = () => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (tickInterval !== null) { window.clearInterval(tickInterval); tickInterval = null; }
  if (voiceInterval !== null) { window.clearInterval(voiceInterval); voiceInterval = null; }
  if (notifInterval !== null) { window.clearInterval(notifInterval); notifInterval = null; }
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  try { window.speechSynthesis?.cancel(); } catch {}
  closeStatusNotification();
};

const startTracking = async () => {
  if (snapshot.isTracking) return;
  if (!navigator.geolocation) {
    setSnap({ error: "GPS stöds inte i denna webbläsare" });
    return;
  }

  // Check permission state up-front so we can prompt clearly
  setSnap({ error: null });
  try {
    // @ts-ignore - permissions API not in all TS lib versions
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (perm?.state === "denied") {
      setSnap({
        error:
          "Platstillstånd är blockerat. Aktivera plats för denna sida i webbläsarens inställningar (lås-ikonen i adressfältet → Behörigheter → Plats → Tillåt) och försök igen.",
      });
      return;
    }
  } catch {
    // permissions API not supported — fall through to getCurrentPosition prompt
  }

  // Trigger the native permission prompt explicitly before starting watchPosition
  try {
    await new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  } catch (err: any) {
    if (err?.code === 1 /* PERMISSION_DENIED */) {
      setSnap({
        error:
          "Du nekade platstillstånd. Tillåt plats för denna sida (lås-ikonen i adressfältet → Behörigheter → Plats → Tillåt) och tryck på Starta GPS-inspelning igen.",
      });
    } else if (err?.code === 2 /* POSITION_UNAVAILABLE */) {
      setSnap({ error: "GPS-signal hittades inte. Gå utomhus och försök igen." });
    } else if (err?.code === 3 /* TIMEOUT */) {
      setSnap({ error: "GPS-signalen tog för lång tid. Försök igen utomhus med fri sikt mot himlen." });
    } else {
      setSnap({ error: err?.message || "Kunde inte starta GPS" });
    }
    return;
  }

  installVisibilityHandler();
  distAcc = 0;
  lastCoord = null;
  routeAcc = [];
  kmCount = 0;
  kmMarkSec = 0;
  lastKmSec = null;
  distAnnounceMarkKm = 0;
  distAnnounceMarkSec = 0;
  startTime = Date.now();
  setSnap({ isTracking: true, isPaused: false, distanceKm: 0, elapsedSec: 0, route: [], error: null, accuracy: null });

  try {
    // @ts-ignore
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {}

  // Request notification permission and show persistent status notification
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch {}
  }


  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      setSnap({ accuracy: pos.coords.accuracy });
      if (pos.coords.accuracy > 50) return;
      const pt: RoutePoint = [pos.coords.latitude, pos.coords.longitude];
      if (lastCoord) {
        const d = haversineKm(lastCoord, pos.coords);
        if (d > 0.003) {
          distAcc += d;
          lastCoord = pos.coords;
          routeAcc = [...routeAcc, pt];
          setSnap({ distanceKm: distAcc, route: routeAcc });
          const newKmCount = Math.floor(distAcc);
          if (newKmCount > kmCount) {
            const nowSec = (Date.now() - startTime) / 1000;
            lastKmSec = nowSec - kmMarkSec;
            kmMarkSec = nowSec;
            kmCount = newKmCount;
          }
          // Distance-based voice announcement
          const distInterval = getGpsVoiceIntervalKm();
          if (distInterval > 0 && distAcc - distAnnounceMarkKm >= distInterval) {
            const nowSec = (Date.now() - startTime) / 1000;
            const segKm = distAcc - distAnnounceMarkKm;
            const segSec = nowSec - distAnnounceMarkSec;
            const segPace = segSec / segKm;
            distAnnounceMarkKm = distAcc;
            distAnnounceMarkSec = nowSec;
            speakPace(distAcc, Math.floor(nowSec), {
              label: `Senaste ${segKm.toFixed(1).replace(".", " komma ")} kilometer`,
              secPerKm: segPace,
            });
          }
        }
      } else {
        lastCoord = pos.coords;
        routeAcc = [pt];
        setSnap({ route: routeAcc });
      }
    },
    (err) => setSnap({ error: err.message || "GPS-fel" }),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );

  tickInterval = window.setInterval(() => {
    setSnap({ elapsedSec: Math.floor((Date.now() - startTime) / 1000) });
  }, 1000);

  const voiceMin = getGpsVoiceIntervalMin();
  if (voiceMin > 0) {
    voiceInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      speakPace(distAcc, elapsed, lastKmSec != null && lastKmSec > 0 ? { label: "Senaste kilometer", secPerKm: lastKmSec } : null);
    }, voiceMin * 60 * 1000);
  }

  // Persistent status notification while tracking — updates every 15s
  showStatusNotification();
  notifInterval = window.setInterval(() => { showStatusNotification(); }, 15000);
};

const pauseTracking = () => {
  if (!snapshot.isTracking || snapshot.isPaused) return;
  // Stop GPS watch + ticks but keep accumulated state
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (tickInterval !== null) { window.clearInterval(tickInterval); tickInterval = null; }
  if (voiceInterval !== null) { window.clearInterval(voiceInterval); voiceInterval = null; }
  try { window.speechSynthesis?.cancel(); } catch {}
  lastCoord = null; // avoid huge jump when resuming
  setSnap({ isPaused: true, accuracy: null });
};

const resumeTracking = async () => {
  if (!snapshot.isTracking || !snapshot.isPaused) return;
  // Shift startTime so elapsedSec continues from where it paused
  startTime = Date.now() - snapshot.elapsedSec * 1000;
  // Reset segment markers so we don't announce huge gaps
  const nowSec = snapshot.elapsedSec;
  kmMarkSec = nowSec;
  distAnnounceMarkSec = nowSec;
  distAnnounceMarkKm = distAcc;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      setSnap({ accuracy: pos.coords.accuracy });
      if (pos.coords.accuracy > 50) return;
      const pt: RoutePoint = [pos.coords.latitude, pos.coords.longitude];
      if (lastCoord) {
        const d = haversineKm(lastCoord, pos.coords);
        if (d > 0.003) {
          distAcc += d;
          lastCoord = pos.coords;
          routeAcc = [...routeAcc, pt];
          setSnap({ distanceKm: distAcc, route: routeAcc });
        }
      } else {
        lastCoord = pos.coords;
      }
    },
    (err) => setSnap({ error: err.message || "GPS-fel" }),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );

  tickInterval = window.setInterval(() => {
    setSnap({ elapsedSec: Math.floor((Date.now() - startTime) / 1000) });
  }, 1000);

  const voiceMin = getGpsVoiceIntervalMin();
  if (voiceMin > 0) {
    voiceInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      speakPace(distAcc, elapsed, lastKmSec != null && lastKmSec > 0 ? { label: "Senaste kilometer", secPerKm: lastKmSec } : null);
    }, voiceMin * 60 * 1000);
  }

  setSnap({ isPaused: false, error: null });
};

const stopTracking = () => {
  const result = {
    distanceKm: distAcc,
    elapsedSec: snapshot.isPaused ? snapshot.elapsedSec : Math.floor((Date.now() - startTime) / 1000),
    route: routeAcc,
  };
  cleanup();
  setSnap({ isTracking: false, isPaused: false });
  return result;
};

export const useGpsTracker = (): GpsState => {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => n + 1)), []);
  return {
    isTracking: snapshot.isTracking,
    isPaused: snapshot.isPaused,
    distanceKm: snapshot.distanceKm,
    elapsedSec: snapshot.elapsedSec,
    accuracy: snapshot.accuracy,
    error: snapshot.error,
    route: snapshot.route,
    start: startTracking,
    pause: pauseTracking,
    resume: resumeTracking,
    stop: stopTracking,
  };
};
