import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Map as MapIcon, MapPinOff, Navigation, RefreshCw, WifiOff } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import grimMarker from "@/assets/grim-marker.png";

type Point = [number, number]; // [lat, lng]

interface Props {
  route: Point[];
  height?: number;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** When true, follows current position with an animated pulse and shows a return-to-start arrow. */
  live?: boolean;
  /** Optional historic routes drawn as a faint heatmap-style overlay underneath the main line. */
  heatmap?: Point[][];
  /** Alternativa vägval (punkt-till-punkt) – ritas i avvikande färg ovanpå huvudrutten. */
  alternatives?: Point[][];
  /** Antal punkter i början av rutten som redan avverkats – ritas grå. */
  traveledCount?: number;
  /** Aktuell GPS-position (för navigering där route är den planerade rundan). */
  livePosition?: Point | null;
}

const useIsDark = () => {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
};

/** Fel som gör att kartan inte kan visas – används för att välja rätt meddelande. */
export type MapLoadErrorKind = "offline" | "auth" | "network" | "config";

export class MapLoadError extends Error {
  kind: MapLoadErrorKind;
  constructor(kind: MapLoadErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

/* ---------- Kartlager (OpenStreetMap – ingen API-nyckel krävs) ---------- */
const LIGHT_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const bearing = (a: Point, b: Point) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a[0]);
  const φ2 = toRad(b[0]);
  const Δλ = toRad(b[1] - a[1]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const distanceM = (a: Point, b: Point) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a[0]);
  const φ2 = toRad(b[0]);
  const dφ = toRad(b[0] - a[0]);
  const dλ = toRad(b[1] - a[1]);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Statisk minikarta av rutten (SVG) – visas när kartan inte kan laddas. */
const RouteSketch = ({ route }: { route: Point[] }) => {
  if (route.length < 2) return null;
  const lats = route.map((p) => p[0]);
  const lngs = route.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 1e-5);
  const spanLng = Math.max(maxLng - minLng, 1e-5);
  const pts = route
    .map((p) => `${(((p[1] - minLng) / spanLng) * 96 + 2).toFixed(2)},${((1 - (p[0] - minLat) / spanLat) * 56 + 2).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 60" className="w-32 h-20 opacity-70" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const FALLBACK_TEXT: Record<MapLoadErrorKind, { title: string; body: string }> = {
  offline: { title: "Ingen internetanslutning", body: "Kartan kan inte laddas offline. Din rutt sparas ändå och visas när du är online igen." },
  auth: { title: "Kartan är inte tillgänglig", body: "Karttjänsten nekade begäran. Försök igen senare." },
  network: { title: "Kartan kunde inte laddas", body: "Anslutningen till karttjänsten misslyckades. Kontrollera nätet och försök igen." },
  config: { title: "Kartan är inte konfigurerad", body: "Kartlagret kunde inte initieras." },
};

const MapFallback = ({
  error,
  route,
  onRetry,
}: {
  error: MapLoadError;
  route: Point[];
  onRetry: () => void;
}) => {
  const t = FALLBACK_TEXT[error.kind] ?? FALLBACK_TEXT.network;
  const Icon = error.kind === "offline" ? WifiOff : MapPinOff;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-muted/60 backdrop-blur-sm px-4 text-center text-muted-foreground">
      <Icon className="w-6 h-6" />
      <p className="text-xs font-bold text-foreground">{t.title}</p>
      <p className="text-[11px] leading-snug max-w-[36ch]">{t.body}</p>
      <RouteSketch route={route} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRetry(); }}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Försök igen
      </button>
    </div>
  );
};

const dotIcon = (color: string) =>
  L.divIcon({
    className: "grim-route-dot",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const pulseIcon = (color: string) =>
  L.divIcon({
    className: "",
    html:
      `<div class="grim-gps-pulse grim-gps-pulse--logo" style="--pulse-color:${color}">` +
      `<img src="${grimMarker}" alt="Din position" class="grim-gps-pulse__logo" /></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const RouteMap = ({
  route,
  height = 200,
  className = "",
  collapsible = false,
  defaultOpen = false,
  live = false,
  heatmap,
  alternatives,
  traveledCount = 0,
  livePosition = null,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const doneLineRef = useRef<L.Polyline | null>(null);
  const haloLineRef = useRef<L.Polyline | null>(null);
  const heatLinesRef = useRef<L.Polyline[]>([]);
  const altLinesRef = useRef<L.Polyline[]>([]);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const pulseRef = useRef<L.Marker | null>(null);

  const fittedOnceRef = useRef(false);
  const followPausedRef = useRef(false);
  const followTimerRef = useRef<number | null>(null);

  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<MapLoadError | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const dark = useIsDark();

  const primary = useMemo(() => {
    if (typeof document === "undefined") return "#2563eb";
    const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    return v ? `hsl(${v})` : "#2563eb";
  }, [dark, mapReady]);

  // Init map once
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;
    setLoadError(null);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setLoadError(new MapLoadError("offline", "Ingen internetanslutning"));
      return;
    }
    try {
      const center: L.LatLngExpression = route.length ? [route[0][0], route[0][1]] : [59.3293, 18.0686];
      const map = L.map(containerRef.current, {
        center,
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      });
      tileRef.current = L.tileLayer(dark ? DARK_TILES : LIGHT_TILES, {
        maxZoom: 19,
        attribution: ATTRIBUTION,
      }).addTo(map);
      mapRef.current = map;

      // Användaren får panorera fritt – auto-centrering pausas i 5 s efter senaste interaktion.
      const pauseFollow = () => {
        followPausedRef.current = true;
        if (followTimerRef.current) window.clearTimeout(followTimerRef.current);
        followTimerRef.current = window.setTimeout(() => {
          followPausedRef.current = false;
        }, 5000);
      };
      map.on("dragstart", pauseFollow);
      map.on("dragend", pauseFollow);
      window.setTimeout(() => map.invalidateSize(), 60);
      setMapReady(true);
    } catch (e) {
      setLoadError(new MapLoadError("network", (e as Error)?.message ?? "Kartan kunde inte laddas"));
    }

    return () => {
      heatLinesRef.current = [];
      altLinesRef.current = [];
      routeLineRef.current = null;
      doneLineRef.current = null;
      haloLineRef.current = null;
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      pulseRef.current = null;
      tileRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
      fittedOnceRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, retryKey]);

  // Theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    tileRef.current?.remove();
    tileRef.current = L.tileLayer(dark ? DARK_TILES : LIGHT_TILES, {
      maxZoom: 19,
      attribution: ATTRIBUTION,
    }).addTo(map);
    tileRef.current.bringToBack();
  }, [dark, mapReady]);

  // Overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const path: L.LatLngExpression[] = route.map((p) => [p[0], p[1]]);

    // Heatmap (historic routes)
    if (heatmap && heatmap.length) {
      heatLinesRef.current.forEach((l) => l.remove());
      heatLinesRef.current = heatmap
        .filter((r) => r.length > 1)
        .map((r) =>
          L.polyline(r.map((p) => [p[0], p[1]] as L.LatLngExpression), {
            color: primary,
            opacity: 0.18,
            weight: 3,
            interactive: false,
          }).addTo(map),
        );
    }

    // Alternativa vägval – rita ENDAST de delar som avviker från huvudrutten,
    // i bärnsten och ovanpå, så kortaste vägen (temats färg) alltid syns tydligt.
    altLinesRef.current.forEach((l) => l.remove());
    const cellKey = (lat: number, lng: number) => `${Math.round(lat / 0.0004)}:${Math.round(lng / 0.0004)}`;
    const primaryCells = new Set<string>();
    for (const p of route ?? []) {
      const [la, ln] = p;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          primaryCells.add(cellKey(la + dy * 0.0004, ln + dx * 0.0004));
        }
      }
    }
    const divergent: Point[][] = [];
    for (const alt of alternatives ?? []) {
      let seg: Point[] = [];
      for (const p of alt) {
        if (primaryCells.has(cellKey(p[0], p[1]))) {
          if (seg.length > 1) divergent.push(seg);
          seg = [];
        } else {
          seg.push(p);
        }
      }
      if (seg.length > 1) divergent.push(seg);
    }
    altLinesRef.current = divergent.map((r) =>
      L.polyline(r.map((p) => [p[0], p[1]] as L.LatLngExpression), {
        color: "#f59e0b",
        opacity: 1,
        weight: 5,
        interactive: false,
      }).addTo(map),
    );

    // Main route + halo. Avverkad del ritas grå, återstående i temats färg.
    const cut = Math.max(0, Math.min(traveledCount, path.length));
    const donePath = cut > 1 ? path.slice(0, cut) : [];
    const remainingPath = cut > 0 ? path.slice(Math.max(0, cut - 1)) : path;
    if (!haloLineRef.current) {
      haloLineRef.current = L.polyline(path, {
        color: dark ? "#000000" : "#ffffff",
        opacity: 0.7,
        weight: 8,
        interactive: false,
      }).addTo(map);
      doneLineRef.current = L.polyline(donePath, {
        color: "#9ca3af",
        opacity: 1,
        weight: 5,
        interactive: false,
      }).addTo(map);
      routeLineRef.current = L.polyline(remainingPath, {
        color: primary,
        opacity: 1,
        weight: 5,
        interactive: false,
      }).addTo(map);
    } else {
      haloLineRef.current.setLatLngs(path);
      haloLineRef.current.setStyle({ color: dark ? "#000000" : "#ffffff" });
      doneLineRef.current?.setLatLngs(donePath);
      routeLineRef.current?.setLatLngs(remainingPath);
      routeLineRef.current?.setStyle({ color: primary });
    }
    altLinesRef.current.forEach((l) => l.bringToFront());

    // Start marker
    if (path.length > 0) {
      if (!startMarkerRef.current) {
        startMarkerRef.current = L.marker(path[0], { icon: dotIcon("#16a34a"), interactive: false }).addTo(map);
      } else {
        startMarkerRef.current.setLatLng(path[0]);
      }
    }

    // End marker — playback only
    if (!live && path.length > 1) {
      const end = path[path.length - 1];
      if (!endMarkerRef.current) {
        endMarkerRef.current = L.marker(end, { icon: dotIcon("#dc2626"), interactive: false }).addTo(map);
      } else {
        endMarkerRef.current.setLatLng(end);
      }
    }

    // Live pulsing dot
    const livePoint: L.LatLngExpression | null = livePosition ? [livePosition[0], livePosition[1]] : null;
    if (live && (livePoint || path.length > 0)) {
      const cur = livePoint ?? path[path.length - 1];
      if (!pulseRef.current) {
        pulseRef.current = L.marker(cur, { icon: pulseIcon(primary), interactive: false, zIndexOffset: 1000 }).addTo(map);
      } else {
        pulseRef.current.setLatLng(cur);
        pulseRef.current.setIcon(pulseIcon(primary));
      }
    }

    // Camera
    if (path.length === 1 && !livePoint) {
      map.setView(path[0], 16);
    } else if (live && (livePoint || path.length > 1)) {
      if (!followPausedRef.current) {
        map.panTo(livePoint ?? path[path.length - 1], { animate: true });
        if (map.getZoom() < 15) map.setZoom(15);
      }
    } else if (path.length > 1 && !fittedOnceRef.current) {
      map.fitBounds(L.latLngBounds(path as L.LatLngTuple[]), { padding: [30, 30] });
      fittedOnceRef.current = true;
    }
  }, [mapReady, route, heatmap, alternatives, live, primary, dark, traveledCount, livePosition]);

  // Return-to-start data
  const returnInfo = useMemo(() => {
    if (!live || route.length < 2) return null;
    const start = route[0];
    const cur = route[route.length - 1];
    const d = distanceM(cur, start);
    if (d < 30) return null;
    return { bearing: bearing(cur, start), distanceM: d };
  }, [route, live]);

  if (route.length === 0 && !live) return null;

  const mapInner = (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {loadError && <MapFallback error={loadError} route={route} onRetry={() => setRetryKey((k) => k + 1)} />}
      {returnInfo && (
        <div className="absolute top-2 left-2 z-[500] flex items-center gap-2 bg-background/90 backdrop-blur border border-border rounded-md px-2.5 py-1.5 shadow-sm">
          <Navigation
            className="w-4 h-4 text-primary"
            style={{ transform: `rotate(${returnInfo.bearing}deg)` }}
          />
          <span className="text-[11px] font-bold tracking-tight text-foreground">
            {returnInfo.distanceM < 1000
              ? `${Math.round(returnInfo.distanceM)} m till start`
              : `${(returnInfo.distanceM / 1000).toFixed(2)} km till start`}
          </span>
        </div>
      )}
    </div>
  );

  if (collapsible) {
    return (
      <div className={`w-full border border-border rounded-md overflow-hidden ${className}`} style={{ position: "relative", zIndex: 0, isolation: "isolate" }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 text-xs font-semibold text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <MapIcon className="w-3.5 h-3.5" /> Karta ({route.length} punkter)
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {open && (
          <div className="w-full" style={{ height }}>{mapInner}</div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-md overflow-hidden border border-border ${className}`}
      style={{ height: height === 0 ? "100%" : height, position: "relative", zIndex: 0, isolation: "isolate" }}
    >
      {mapInner}
    </div>
  );
};

export default RouteMap;
