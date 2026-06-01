import { useEffect, useState } from "react";
import { getGpsVoiceIntervalMin, speakPace } from "@/lib/gpsSettings";

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
  distanceKm: number;
  elapsedSec: number;
  accuracy: number | null;
  error: string | null;
  route: RoutePoint[];
  start: () => Promise<void>;
  stop: () => { distanceKm: number; elapsedSec: number; route: RoutePoint[] };
};

// ---------------- Singleton store (persists across tab/component unmounts) ----------------

type Snapshot = {
  isTracking: boolean;
  distanceKm: number;
  elapsedSec: number;
  accuracy: number | null;
  error: string | null;
  route: RoutePoint[];
};

let snapshot: Snapshot = {
  isTracking: false,
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
let visibilityHandlerInstalled = false;

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

const cleanup = () => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (tickInterval !== null) { window.clearInterval(tickInterval); tickInterval = null; }
  if (voiceInterval !== null) { window.clearInterval(voiceInterval); voiceInterval = null; }
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  try { window.speechSynthesis?.cancel(); } catch {}
};

const startTracking = async () => {
  if (snapshot.isTracking) return;
  if (!navigator.geolocation) {
    setSnap({ error: "GPS stöds inte i denna webbläsare" });
    return;
  }
  installVisibilityHandler();
  distAcc = 0;
  lastCoord = null;
  routeAcc = [];
  kmCount = 0;
  kmMarkSec = 0;
  lastKmSec = null;
  startTime = Date.now();
  setSnap({ isTracking: true, distanceKm: 0, elapsedSec: 0, route: [], error: null, accuracy: null });

  try {
    // @ts-ignore
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {}

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
      speakPace(distAcc, elapsed, lastKmSec);
    }, voiceMin * 60 * 1000);
  }
};

const stopTracking = () => {
  const result = {
    distanceKm: distAcc,
    elapsedSec: Math.floor((Date.now() - startTime) / 1000),
    route: routeAcc,
  };
  cleanup();
  setSnap({ isTracking: false });
  return result;
};

export const useGpsTracker = (): GpsState => {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => n + 1)), []);
  return {
    isTracking: snapshot.isTracking,
    distanceKm: snapshot.distanceKm,
    elapsedSec: snapshot.elapsedSec,
    accuracy: snapshot.accuracy,
    error: snapshot.error,
    route: snapshot.route,
    start: startTracking,
    stop: stopTracking,
  };
};
