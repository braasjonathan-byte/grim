import { supabase } from "@/integrations/supabase/client";

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

export interface SavedRoute extends RouteData {
  id: string;
  name: string;
  activity: string;
  createdAt: string;
}

const rowToRoute = (r: any): SavedRoute => ({
  id: r.id,
  name: r.name,
  activity: r.activity,
  createdAt: r.created_at,
  distanceKm: Number(r.distance_km),
  points: (r.points ?? []) as RoutePoint[],
  pavedRatio: r.paved_ratio == null ? null : Number(r.paved_ratio),
  surfaces: r.surfaces ?? [],
  elevationGainM: r.elevation_gain_m == null ? null : Number(r.elevation_gain_m),
  elevationLossM: r.elevation_loss_m == null ? null : Number(r.elevation_loss_m),
});

export const listSavedRoutes = async (): Promise<SavedRoute[]> => {
  const { data, error } = await supabase
    .from("saved_routes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRoute);
};

export const saveRoute = async (
  userId: string,
  name: string,
  activity: string,
  route: RouteData,
): Promise<SavedRoute> => {
  const { data, error } = await supabase
    .from("saved_routes")
    .insert({
      user_id: userId,
      name,
      activity,
      distance_km: route.distanceKm,
      elevation_gain_m: route.elevationGainM ?? null,
      elevation_loss_m: route.elevationLossM ?? null,
      paved_ratio: route.pavedRatio ?? null,
      surfaces: route.surfaces ?? [],
      points: route.points,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToRoute(data);
};

export const deleteSavedRoute = async (id: string) => {
  const { error } = await supabase.from("saved_routes").delete().eq("id", id);
  if (error) throw error;
};

/** Delar en runda till en vän via chatten. */
export const shareRouteToChat = async (
  senderId: string,
  receiverId: string,
  name: string,
  activity: string,
  route: RouteData,
) => {
  const { error } = await supabase.from("chat_messages").insert({
    sender_id: senderId,
    receiver_id: receiverId,
    message: `Delade rundan "${name}" (${route.distanceKm.toFixed(1)} km)`,
    message_type: "route",
    shared_workout: {
      kind: "route",
      name,
      activity,
      distanceKm: route.distanceKm,
      pavedRatio: route.pavedRatio,
      surfaces: route.surfaces,
      elevationGainM: route.elevationGainM ?? null,
      elevationLossM: route.elevationLossM ?? null,
      points: route.points,
    },
  });
  if (error) throw error;
};

/** Hämtar aktuell position med robust fallback (hög noggrannhet → låg → cachad). */
export const getPositionRobust = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS stöds inte på den här enheten"));
      return;
    }
    let settled = false;
    const done = (p: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      resolve(p);
    };
    const fail = (e: GeolocationPositionError) => {
      if (settled) return;
      settled = true;
      reject(e);
    };
    navigator.geolocation.getCurrentPosition(done, () => {
      // Andra försöket: snabbare, tillåt cachad position
      navigator.geolocation.getCurrentPosition(done, fail, {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000,
      });
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 });
  });
