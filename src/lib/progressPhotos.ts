import { supabase } from "@/integrations/supabase/client";

export const PROGRESS_BUCKET = "progress-photos";
export type Pose = "front" | "side" | "back";
export const POSE_LABEL: Record<Pose, string> = { front: "Fram", side: "Sida", back: "Bak" };
export interface ProgressPhoto {
  id: string; user_id: string; taken_on: string; storage_path: string;
  note: string | null; pose: Pose | null; created_at: string; url?: string;
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

export async function listProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await (supabase as any).from("progress_photos")
    .select("*").eq("user_id", userId).order("taken_on", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ProgressPhoto[];
  if (!rows.length) return rows;
  const { data: signed } = await supabase.storage.from(PROGRESS_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const map = new Map((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, url: map.get(r.storage_path) }));
}

export async function uploadProgressPhoto(userId: string, dataUrl: string, meta: { taken_on: string; note?: string; pose?: Pose | null }) {
  const blob = await compressImage(dataUrl);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from(PROGRESS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const { error } = await (supabase as any).from("progress_photos").insert({
    user_id: userId, storage_path: path, taken_on: meta.taken_on, note: meta.note?.trim() || null, pose: meta.pose || null,
  });
  if (error) { await supabase.storage.from(PROGRESS_BUCKET).remove([path]); throw error; }
}

export async function deleteProgressPhoto(p: ProgressPhoto) {
  const { error } = await (supabase as any).from("progress_photos").delete().eq("id", p.id);
  if (error) throw error;
  await supabase.storage.from(PROGRESS_BUCKET).remove([p.storage_path]);
}
