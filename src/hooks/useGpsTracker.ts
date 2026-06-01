import { useEffect, useRef, useState, useCallback } from "react";

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

export const useGpsTracker = (): GpsState => {
  const [isTracking, setIsTracking] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RoutePoint[]>([]);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const tickRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastCoordRef = useRef<GeolocationCoordinates | null>(null);
  const distRef = useRef(0);
  const routeRef = useRef<RoutePoint[]>([]);

  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible" && isTracking && !wakeLockRef.current) {
        try {
          // @ts-ignore
          wakeLockRef.current = await navigator.wakeLock?.request("screen");
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isTracking]);

  const start = useCallback(async () => {
    if (isTracking) return;
    setError(null);
    if (!navigator.geolocation) {
      setError("GPS stöds inte i denna webbläsare");
      return;
    }
    setDistanceKm(0);
    setElapsedSec(0);
    setRoute([]);
    distRef.current = 0;
    lastCoordRef.current = null;
    routeRef.current = [];
    startTimeRef.current = Date.now();

    try {
      // @ts-ignore
      wakeLockRef.current = await navigator.wakeLock?.request("screen");
    } catch {}

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setAccuracy(pos.coords.accuracy);
        if (pos.coords.accuracy > 50) return;
        const last = lastCoordRef.current;
        const pt: RoutePoint = [pos.coords.latitude, pos.coords.longitude];
        if (last) {
          const d = haversineKm(last, pos.coords);
          if (d > 0.003) {
            distRef.current += d;
            setDistanceKm(distRef.current);
            lastCoordRef.current = pos.coords;
            routeRef.current = [...routeRef.current, pt];
            setRoute(routeRef.current);
          }
        } else {
          lastCoordRef.current = pos.coords;
          routeRef.current = [pt];
          setRoute(routeRef.current);
        }
      },
      (err) => setError(err.message || "GPS-fel"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

    tickRef.current = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    setIsTracking(true);
  }, [isTracking]);

  const stop = useCallback(() => {
    const result = {
      distanceKm: distRef.current,
      elapsedSec: Math.floor((Date.now() - startTimeRef.current) / 1000),
      route: routeRef.current,
    };
    cleanup();
    setIsTracking(false);
    return result;
  }, [cleanup]);

  return { isTracking, distanceKm, elapsedSec, accuracy, error, route, start, stop };
};
