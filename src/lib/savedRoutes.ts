/** Typer för rundor som delats i chatten (äldre meddelanden). */
export type RoutePoint = [number, number];

export interface RouteData {
  distanceKm: number;
  points: RoutePoint[];
  pavedRatio: number | null;
  surfaces: string[];
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  /** Höjd (m ö.h.) per punkt – finns bara på nygenererade rutter. */
  elevations?: number[] | null;
  /** Uppskattad tid i minuter från ruttleverantören. */
  durationMin?: number | null;
}
