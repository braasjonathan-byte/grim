// Lightweight client-only history of recorded GPS routes for heatmap overlay.
// Stored per-device in localStorage; keeps last ~25 routes (capped by size).

const KEY = "grim_route_history_v1";
const MAX_ROUTES = 25;
const MAX_POINTS_PER_ROUTE = 400;

export type StoredRoute = [number, number][];

const downsample = (route: StoredRoute, max: number): StoredRoute => {
  if (route.length <= max) return route;
  const step = route.length / max;
  const out: StoredRoute = [];
  for (let i = 0; i < max; i++) out.push(route[Math.floor(i * step)]);
  return out;
};

export const loadRouteHistory = (): StoredRoute[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r) => Array.isArray(r) && r.length > 1);
  } catch {
    return [];
  }
};

export const appendRouteToHistory = (route: StoredRoute) => {
  if (route.length < 2) return;
  try {
    const existing = loadRouteHistory();
    const next = [downsample(route, MAX_POINTS_PER_ROUTE), ...existing].slice(0, MAX_ROUTES);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
};
