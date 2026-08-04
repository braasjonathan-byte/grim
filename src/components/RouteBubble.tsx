import { useMemo, useState } from "react";
import { MapPin, MoveUp, Navigation, Route as RouteIcon } from "lucide-react";
import type { RouteData, RoutePoint } from "@/lib/savedRoutes";
import RouteNavigation from "@/components/RouteNavigation";

/** Liten SVG-skiss av rundan – lätt att rendera i chattbubblan. */
const Sketch = ({ points }: { points: RoutePoint[] }) => {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const sLat = Math.max(maxLat - minLat, 1e-5);
    const sLng = Math.max(maxLng - minLng, 1e-5);
    return points
      .map((p) => `${(((p[1] - minLng) / sLng) * 96 + 2).toFixed(1)},${((1 - (p[0] - minLat) / sLat) * 56 + 2).toFixed(1)}`)
      .join(" ");
  }, [points]);
  if (!path) return null;
  return (
    <svg viewBox="0 0 100 60" className="h-16 w-full">
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const RouteBubble = ({ payload, isMine }: { payload: any; isMine: boolean }) => {
  const [nav, setNav] = useState(false);
  const route: RouteData = {
    distanceKm: Number(payload?.distanceKm ?? 0),
    points: (payload?.points ?? []) as RoutePoint[],
    pavedRatio: Number(payload?.pavedRatio ?? 0),
    surfaces: payload?.surfaces ?? [],
    elevationGainM: payload?.elevationGainM ?? null,
    elevationLossM: payload?.elevationLossM ?? null,
  };

  return (
    <div className={`w-56 ${isMine ? "text-primary-foreground" : "text-foreground"}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold">
        <RouteIcon className="h-4 w-4" /> {payload?.name ?? "Runda"}
      </p>
      <Sketch points={route.points} />
      <p className={`flex flex-wrap items-center gap-x-2 text-[11px] ${isMine ? "opacity-80" : "text-muted-foreground"}`}>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {route.distanceKm.toFixed(2)} km
        </span>
        {route.elevationGainM != null && (
          <span className="flex items-center gap-1">
            <MoveUp className="h-3 w-3" /> {Math.round(route.elevationGainM)} m
          </span>
        )}
      </p>
      <button
        onClick={() => setNav(true)}
        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
          isMine ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground"
        }`}
      >
        <Navigation className="h-3.5 w-3.5" /> Starta rundan
      </button>
      {nav && (
        <RouteNavigation
          route={route}
          activity={payload?.activity ?? "running"}
          name={payload?.name}
          onClose={() => setNav(false)}
        />
      )}
    </div>
  );
};

export default RouteBubble;
