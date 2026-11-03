import { supabase } from "@/integrations/supabase/client";

export const PROGRESS_BUCKET = "progress-photos";
export type Pose = "front" | "side" | "back";
export const POSE_LABEL: Record<Pose, string> = { front: "Fram", side: "Sida", back: "Bak" };
export interface ProgressPhoto {
  id: string; user_id: string; taken_on: string; storage_path: string;
  note: string | null; pose: Pose | null; created_at: string; url?: string;
  session_id?: string | null;
  /** Satt när bilden ägs av en vän och delats med mig. */
  shared_by?: string | null;
}

/** Skala ned till max 1280 px och JPEG ~0.8 så uppladdningen hålls liten. */
export async function compressImage(dataUrl: string, max = 1280, q = 0.8): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Komprimering misslyckades"))), "image/jpeg", q));
}

async function sign(rows: ProgressPhoto[]): Promise<ProgressPhoto[]> {
  if (!rows.length) return rows;
  const { data: signed } = await supabase.storage.from(PROGRESS_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const map = new Map((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, url: map.get(r.storage_path) }));
}

/** Bara mina egna bilder (filtrerar bort delade från vänner). */
export async function listProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await (supabase as any).from("progress_photos")
    .select("*").eq("user_id", userId).order("taken_on", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return sign((data ?? []) as ProgressPhoto[]);
}

/** Bilder som vänner uttryckligen delat med mig. RLS släpper bara igenom delade rader. */
export async function listSharedWithMe(userId: string): Promise<ProgressPhoto[]> {
  const { data: shares, error } = await (supabase as any).from("progress_photo_shares")
    .select("photo_id, owner_id").eq("recipient_id", userId);
  if (error) throw error;
  const ids = (shares ?? []).map((s: any) => s.photo_id);
  if (!ids.length) return [];
  const { data } = await (supabase as any).from("progress_photos").select("*").in("id", ids)
    .order("taken_on", { ascending: false });
  const owners = [...new Set((data ?? []).map((r: any) => r.user_id))] as string[];
  const { data: profs } = await supabase.from("profiles").select("user_id, nickname, display_name").in("user_id", owners);
  const name = new Map((profs ?? []).map((p: any) => [p.user_id, p.display_name || p.nickname || "Vän"]));
  return sign(((data ?? []) as ProgressPhoto[]).map((r) => ({ ...r, shared_by: name.get(r.user_id) ?? "Vän" })));
}

export interface Friend { id: string; name: string }
export async function listFriends(userId: string): Promise<Friend[]> {
  const { data } = await supabase.from("friendships").select("user_id, friend_id").eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  const ids = (data ?? []).map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
  if (!ids.length) return [];
  const { data: profs } = await supabase.from("profiles").select("user_id, nickname, display_name").in("user_id", ids);
  const name = new Map((profs ?? []).map((p: any) => [p.user_id, p.display_name || p.nickname]));
  return ids.map((id) => ({ id, name: name.get(id) || "Vän" })).sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

export async function getShares(photoIds: string[]): Promise<{ photo_id: string; recipient_id: string }[]> {
  if (!photoIds.length) return [];
  const { data, error } = await (supabase as any).from("progress_photo_shares").select("photo_id, recipient_id").in("photo_id", photoIds);
  if (error) throw error;
  return data ?? [];
}

/** Sätt exakt vilka vänner som får se dessa bilder (tom lista = helt privat). */
export async function setShares(ownerId: string, photoIds: string[], recipientIds: string[]) {
  const { error: delErr } = await (supabase as any).from("progress_photo_shares").delete()
    .eq("owner_id", ownerId).in("photo_id", photoIds);
  if (delErr) throw delErr;
  const rows = photoIds.flatMap((photo_id) => recipientIds.map((recipient_id) => ({ photo_id, owner_id: ownerId, recipient_id })));
  if (!rows.length) return;
  const { error } = await (supabase as any).from("progress_photo_shares").insert(rows);
  if (error) throw error;
}

export async function uploadProgressPhoto(userId: string, dataUrl: string, meta: { taken_on: string; note?: string; pose?: Pose | null; session_id?: string | null }) {
  const blob = await compressImage(dataUrl);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from(PROGRESS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const { error } = await (supabase as any).from("progress_photos").insert({
    user_id: userId, storage_path: path, taken_on: meta.taken_on, note: meta.note?.trim() || null, pose: meta.pose || null,
    ...(meta.session_id ? { session_id: meta.session_id } : {}),
  });
  if (error) { await supabase.storage.from(PROGRESS_BUCKET).remove([path]); throw error; }
}

export async function deleteProgressPhoto(p: ProgressPhoto) {
  const { error } = await (supabase as any).from("progress_photos").delete().eq("id", p.id);
  if (error) throw error;
  await supabase.storage.from(PROGRESS_BUCKET).remove([p.storage_path]);
}
