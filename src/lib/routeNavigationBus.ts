import type { RouteData, RoutePoint } from "@/lib/savedRoutes";

export interface RouteNavRequest {
  route: RouteData;
  activity: string;
  name?: string;
  /** Alternativa vägval (längre rutter) – ritas i avvikande färg. */
  alternatives?: RoutePoint[][];
  onClose?: (result?: { distanceKm: number; points: RoutePoint[] }) => void;
}

type Listener = (req: RouteNavRequest | null) => void;

let current: RouteNavRequest | null = null;
const listeners = new Set<Listener>();

export const getRouteNav = () => current;

export const subscribeRouteNav = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const emit = () => listeners.forEach((l) => l(current));

/** Startar navigeringen i den globala värden – helt frikopplad från anropande komponent. */
export const startRouteNavigation = (req: RouteNavRequest) => {
  current = req;
  emit();
};

export const stopRouteNavigation = () => {
  current = null;
  emit();
};
