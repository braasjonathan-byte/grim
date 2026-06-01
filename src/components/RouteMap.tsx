import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronDown, ChevronUp, Map as MapIcon } from "lucide-react";

type Point = [number, number];

interface Props {
  route: Point[];
  height?: number;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const RouteMap = ({ route, height = 200, className = "", collapsible = false, defaultOpen = false }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);

  useEffect(() => {
    if (!open) return;
    if (!containerRef.current || route.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    } else {
      // ensure size recalculates after re-show
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    }

    const map = mapRef.current;
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    const primaryVar = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const lineColor = primaryVar ? `hsl(${primaryVar})` : "#2563eb";
    const line = L.polyline(route, {
      color: lineColor,
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    const start = route[0];
    const end = route[route.length - 1];
    L.circleMarker(start, { radius: 6, color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1, weight: 2 }).addTo(map);
    L.circleMarker(end, { radius: 6, color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1, weight: 2 }).addTo(map);

    map.fitBounds(line.getBounds(), { padding: [16, 16] });
  }, [route, open]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (route.length === 0) return null;

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
          <div ref={containerRef} className="w-full" style={{ height }} />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-md overflow-hidden border border-border ${className}`}
      style={{ height, position: "relative", zIndex: 0, isolation: "isolate" }}
    />
  );
};

export default RouteMap;
