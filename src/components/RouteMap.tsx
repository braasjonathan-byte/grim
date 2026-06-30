import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronDown, ChevronUp, Map as MapIcon, Navigation } from "lucide-react";

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
}

const CARTO_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const CARTO_DARK = "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png";

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

const buildStyle = (dark: boolean): maplibregl.StyleSpecification => {
  const tmpl = dark ? CARTO_DARK : CARTO_LIGHT;
  const tiles = ["a", "b", "c", "d"].map((s) =>
    tmpl.replace("{s}", s).replace("{r}", window.devicePixelRatio >= 2 ? "@2x" : ""),
  );
  return {
    version: 8,
    sources: {
      base: { type: "raster", tiles, tileSize: 256, attribution: "© OpenStreetMap © CARTO" },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
};

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

const RouteMap = ({
  route,
  height = 200,
  className = "",
  collapsible = false,
  defaultOpen = false,
  live = false,
  heatmap,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const [mapReady, setMapReady] = useState(false);
  const dark = useIsDark();
  const fittedOnceRef = useRef(false);

  const primary = useMemo(() => {
    if (typeof document === "undefined") return "#2563eb";
    const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    return v ? `hsl(${v})` : "#2563eb";
  }, [dark, mapReady]);

  // Init map once
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;
    const center: [number, number] = route.length
      ? [route[0][1], route[0][0]]
      : [18.0686, 59.3293];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(dark),
      center,
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
    map.on("load", () => setMapReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      setMapReady(false);
      fittedOnceRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // React to theme changes (rebuild basemap)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.setStyle(buildStyle(dark));
    mapRef.current.once("styledata", () => {
      // re-add overlays after style swap
      applyOverlays();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  const applyOverlays = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Heatmap (historic) overlay
    if (heatmap && heatmap.length) {
      const fc = {
        type: "FeatureCollection",
        features: heatmap
          .filter((r) => r.length > 1)
          .map((r) => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: r.map((p) => [p[1], p[0]]) },
            properties: {},
          })),
      } as any;
      if (!map.getSource("heat")) {
        map.addSource("heat", { type: "geojson", data: fc });
        map.addLayer({
          id: "heat-line",
          type: "line",
          source: "heat",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": primary, "line-width": 3, "line-opacity": 0.18, "line-blur": 2 },
        });
      } else {
        (map.getSource("heat") as maplibregl.GeoJSONSource).setData(fc);
      }
    }

    // Main route
    const coords = route.map((p) => [p[1], p[0]]);
    const routeFc = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {},
    } as any;
    if (!map.getSource("route")) {
      map.addSource("route", { type: "geojson", data: routeFc });
      map.addLayer({
        id: "route-halo",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": dark ? "#000" : "#fff", "line-width": 8, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": primary, "line-width": 5 },
      });
    } else {
      (map.getSource("route") as maplibregl.GeoJSONSource).setData(routeFc);
      map.setPaintProperty("route-line", "line-color", primary);
      map.setPaintProperty("route-halo", "line-color", dark ? "#000" : "#fff");
    }

    // Start marker
    if (route.length > 0) {
      const start = route[0];
      const startId = "route-start";
      const startFc = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [start[1], start[0]] },
        properties: {},
      } as any;
      if (!map.getSource(startId)) {
        map.addSource(startId, { type: "geojson", data: startFc });
        map.addLayer({
          id: startId,
          type: "circle",
          source: startId,
          paint: {
            "circle-radius": 7,
            "circle-color": "#16a34a",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });
      } else {
        (map.getSource(startId) as maplibregl.GeoJSONSource).setData(startFc);
      }
    }

    // End marker — only in playback mode (not live)
    if (!live && route.length > 1) {
      const end = route[route.length - 1];
      const endId = "route-end";
      const endFc = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [end[1], end[0]] },
        properties: {},
      } as any;
      if (!map.getSource(endId)) {
        map.addSource(endId, { type: "geojson", data: endFc });
        map.addLayer({
          id: endId,
          type: "circle",
          source: endId,
          paint: {
            "circle-radius": 7,
            "circle-color": "#dc2626",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });
      } else {
        (map.getSource(endId) as maplibregl.GeoJSONSource).setData(endFc);
      }
    }

    // Live current-position pulsing dot
    if (live && route.length > 0) {
      const cur = route[route.length - 1];
      if (!userMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "grim-gps-pulse";
        el.style.setProperty("--pulse-color", primary);
        userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([cur[1], cur[0]])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([cur[1], cur[0]]);
        (userMarkerRef.current.getElement() as HTMLDivElement).style.setProperty("--pulse-color", primary);
      }
    }

    // Camera handling
    if (route.length === 1) {
      map.jumpTo({ center: [route[0][1], route[0][0]], zoom: 16 });
    } else if (route.length > 1) {
      if (live) {
        const last = route[route.length - 1];
        map.easeTo({ center: [last[1], last[0]], duration: 600, zoom: Math.max(map.getZoom(), 15) });
      } else if (!fittedOnceRef.current) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
        );
        map.fitBounds(bounds, { padding: 30, duration: 0 });
        fittedOnceRef.current = true;
      }
    }
  };

  useEffect(() => {
    if (!mapReady) return;
    applyOverlays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, route, heatmap, live, primary]);

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
