import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Map as MapIcon, MapPinOff, Navigation, RefreshCw, WifiOff } from "lucide-react";

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
  /** Antal punkter i början av rutten som redan avverkats – ritas grå. */
  traveledCount?: number;
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

/* ---------- Google Maps JS API loader (singleton) ---------- */
let mapsPromise: Promise<void> | null = null;

/** Fel som gör att kartan inte kan visas – används för att välja rätt meddelande. */
export type MapLoadErrorKind = "offline" | "auth" | "network" | "config";

export class MapLoadError extends Error {
  kind: MapLoadErrorKind;
  constructor(kind: MapLoadErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const MAPS_LOAD_TIMEOUT_MS = 15000;

const loadGoogleMaps = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.reject(new MapLoadError("network", "Ingen webbläsarmiljö"));
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!key) return Promise.reject(new MapLoadError("config", "Google Maps-nyckel saknas"));
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.reject(new MapLoadError("offline", "Ingen internetanslutning"));
  }

  mapsPromise = new Promise<void>((resolve, reject) => {
    const cbName = "__grimInitGoogleMaps";
    let settled = false;
    const fail = (err: MapLoadError) => {
      if (settled) return;
      settled = true;
      mapsPromise = null;
      reject(err);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // Google anropar denna globalt vid nyckel-/kvotfel (t.ex. OverQuotaMapError).
    (window as any).gm_authFailure = () => {
      fail(new MapLoadError("auth", "Google Maps nekade begäran (nyckel eller kvot)"));
    };
    (window as any)[cbName] = () => done();

    const timer = window.setTimeout(
      () => fail(new MapLoadError("network", "Kartan tog för lång tid att ladda")),
      MAPS_LOAD_TIMEOUT_MS,
    );
    const clear = () => window.clearTimeout(timer);
    const s = document.createElement("script");
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=${cbName}` +
      (channel ? `&channel=${encodeURIComponent(channel)}` : "");
    s.async = true;
    s.onerror = () => {
      clear();
      s.remove();
      fail(
        new MapLoadError(
          typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network",
          "Kunde inte ladda Google Maps",
        ),
      );
    };
    s.onload = () => {
      // Skriptet laddades – vänta på callback, men rensa timeouten när den kommit.
      window.setTimeout(() => clear(), MAPS_LOAD_TIMEOUT_MS);
    };
    document.head.appendChild(s);
  })
    .then(() => {
      // låt callback rensa
    });
  return mapsPromise;
};

/** Lazy accessor for the Google Maps namespace (script is loaded on demand). */
const gm: any = new Proxy({}, {
  get: (_t, prop) => (window as any).google?.maps?.[prop as string],
});

const DARK_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
];

const LIGHT_STYLE: any[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

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

/** Statisk minikarta av rutten (SVG) – visas när Google Maps inte kan laddas. */
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
  auth: { title: "Kartan är inte tillgänglig", body: "Google Maps nekade begäran – kvoten kan vara slut eller nyckeln ogiltig. Försök igen senare." },
  network: { title: "Kartan kunde inte laddas", body: "Anslutningen till Google Maps misslyckades. Kontrollera nätet och försök igen." },
  config: { title: "Kartan är inte konfigurerad", body: "Ingen Google Maps-nyckel är kopplad till appen." },
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
      {error.kind !== "config" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Försök igen
        </button>
      )}
    </div>
  );
};

/** DOM overlay for the pulsing live-position dot (keeps the existing CSS animation). */
const createPulseOverlay = (map: any, position: any, color: string) => {
  class PulseOverlay extends (gm.OverlayView as { new (): any }) {
    private el: HTMLDivElement | null = null;
    private pos: any;
    constructor(p: any) {
      super();
      this.pos = p;
    }
    onAdd() {
      const el = document.createElement("div");
      el.className = "grim-gps-pulse";
      el.style.position = "absolute";
      el.style.setProperty("--pulse-color", color);
      this.el = el;
      this.getPanes()?.overlayMouseTarget.appendChild(el);
    }
    draw() {
      if (!this.el) return;
      const p = this.getProjection()?.fromLatLngToDivPixel(new gm.LatLng(this.pos));
      if (!p) return;
      this.el.style.left = `${p.x - 9}px`;
      this.el.style.top = `${p.y - 9}px`;
    }
    onRemove() {
      this.el?.remove();
      this.el = null;
    }
    setPosition(p: any) {
      this.pos = p;
      this.draw();
    }
    setColor(c: string) {
      this.el?.style.setProperty("--pulse-color", c);
    }
  }
  const overlay = new PulseOverlay(position);
  overlay.setMap(map);
  return overlay as any & {
    setPosition: (p: any) => void;
    setColor: (c: string) => void;
  };
};

const RouteMap = ({
  route,
  height = 200,
  className = "",
  collapsible = false,
  defaultOpen = false,
  live = false,
  heatmap,
  traveledCount = 0,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const routeLineRef = useRef<any | null>(null);
  const doneLineRef = useRef<any | null>(null);
  const haloLineRef = useRef<any | null>(null);
  const heatLinesRef = useRef<any[]>([]);
  const startMarkerRef = useRef<any | null>(null);
  const endMarkerRef = useRef<any | null>(null);
  const pulseRef = useRef<ReturnType<typeof createPulseOverlay> | null>(null);
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
    let cancelled = false;
    setLoadError(null);
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const center = route.length
          ? { lat: route[0][0], lng: route[0][1] }
          : { lat: 59.3293, lng: 18.0686 };
        const map = new gm.Map(containerRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: dark ? DARK_STYLE : LIGHT_STYLE,
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(
          e instanceof MapLoadError
            ? e
            : new MapLoadError("network", e?.message ?? "Kartan kunde inte laddas"),
        );
      });

    return () => {
      cancelled = true;
      routeLineRef.current?.setMap(null);
      haloLineRef.current?.setMap(null);
      heatLinesRef.current.forEach((l) => l.setMap(null));
      heatLinesRef.current = [];
      startMarkerRef.current?.setMap(null);
      endMarkerRef.current?.setMap(null);
      pulseRef.current?.setMap(null);
      routeLineRef.current = null;
      haloLineRef.current = null;
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      pulseRef.current = null;
      mapRef.current = null;
      setMapReady(false);
      fittedOnceRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, retryKey]);

  // Theme changes
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.setOptions({ styles: dark ? DARK_STYLE : LIGHT_STYLE });
  }, [dark, mapReady]);

  // Overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const path = route.map((p) => ({ lat: p[0], lng: p[1] }));

    // Heatmap (historic routes)
    if (heatmap && heatmap.length) {
      heatLinesRef.current.forEach((l) => l.setMap(null));
      heatLinesRef.current = heatmap
        .filter((r) => r.length > 1)
        .map(
          (r) =>
            new gm.Polyline({
              map,
              path: r.map((p) => ({ lat: p[0], lng: p[1] })),
              strokeColor: primary,
              strokeOpacity: 0.18,
              strokeWeight: 3,
              clickable: false,
              zIndex: 1,
            }),
        );
    }

    // Main route + halo
    if (!haloLineRef.current) {
      haloLineRef.current = new gm.Polyline({
        map,
        path,
        strokeColor: dark ? "#000000" : "#ffffff",
        strokeOpacity: 0.7,
        strokeWeight: 8,
        clickable: false,
        zIndex: 2,
      });
      routeLineRef.current = new gm.Polyline({
        map,
        path,
        strokeColor: primary,
        strokeOpacity: 1,
        strokeWeight: 5,
        clickable: false,
        zIndex: 3,
      });
    } else {
      haloLineRef.current.setPath(path);
      haloLineRef.current.setOptions({ strokeColor: dark ? "#000000" : "#ffffff" });
      routeLineRef.current?.setPath(path);
      routeLineRef.current?.setOptions({ strokeColor: primary });
    }

    // Start marker
    if (path.length > 0) {
      const icon: any = {
        path: gm.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#16a34a",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      };
      if (!startMarkerRef.current) {
        startMarkerRef.current = new gm.Marker({ map, position: path[0], icon, zIndex: 4 });
      } else {
        startMarkerRef.current.setPosition(path[0]);
      }
    }

    // End marker — playback only
    if (!live && path.length > 1) {
      const icon: any = {
        path: gm.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#dc2626",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      };
      const end = path[path.length - 1];
      if (!endMarkerRef.current) {
        endMarkerRef.current = new gm.Marker({ map, position: end, icon, zIndex: 4 });
      } else {
        endMarkerRef.current.setPosition(end);
      }
    }

    // Live pulsing dot
    if (live && path.length > 0) {
      const cur = path[path.length - 1];
      if (!pulseRef.current) {
        pulseRef.current = createPulseOverlay(map, cur, primary);
      } else {
        pulseRef.current.setPosition(cur);
        pulseRef.current.setColor(primary);
      }
    }

    // Camera
    if (path.length === 1) {
      map.setCenter(path[0]);
      map.setZoom(16);
    } else if (path.length > 1) {
      if (live) {
        map.panTo(path[path.length - 1]);
        if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
      } else if (!fittedOnceRef.current) {
        const bounds = new gm.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 30);
        fittedOnceRef.current = true;
      }
    }
  }, [mapReady, route, heatmap, live, primary, dark]);

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
      {loadError && <MapFallback error={loadError} route={route} onRetry={() => { mapsPromise = null; setRetryKey((k) => k + 1); }} />}
      {returnInfo && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-background/90 backdrop-blur border border-border rounded-md px-2.5 py-1.5 shadow-sm">
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
      style={{ height, position: "relative", zIndex: 0, isolation: "isolate" }}
    >
      {mapInner}
    </div>
  );
};

export default RouteMap;
