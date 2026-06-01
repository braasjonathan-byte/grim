import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = [number, number];

interface Props {
  route: Point[];
  height?: number;
  className?: string;
}

const RouteMap = ({ route, height = 200, className = "" }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
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
    }

    const map = mapRef.current;
    // Clear previous layers (polyline + markers)
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    const line = L.polyline(route, {
      color: "hsl(var(--primary))",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    const start = route[0];
    const end = route[route.length - 1];
    L.circleMarker(start, { radius: 6, color: "#16a34a", fillColor: "#16a34a", fillOpacity: 1, weight: 2 }).addTo(map);
    L.circleMarker(end, { radius: 6, color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1, weight: 2 }).addTo(map);

    map.fitBounds(line.getBounds(), { padding: [16, 16] });

    return () => {
      // keep map instance across re-renders for performance
    };
  }, [route]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (route.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-md overflow-hidden border border-border ${className}`}
      style={{ height }}
    />
  );
};

export default RouteMap;
