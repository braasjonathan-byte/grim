import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bilder i bucketen social-images ska bara visas för inloggade användare som
 * får läsa inlägget. Lagrade URL:er är publika objekt-URL:er; vid visning byts
 * de mot kortlivade signerade URL:er (storage-RLS avgör åtkomst). Om signering
 * misslyckas används original-URL:en som reserv.
 */
const BUCKET = "social-images";
const MARKER = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/social-images\/([^?#]+)/;
const TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string>>();

export function socialImagePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(MARKER);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

export async function resolveSocialImageUrl(url: string): Promise<string> {
  const path = socialImagePath(url);
  if (!path) return url;
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const pending = inflight.get(path);
  if (pending) return pending;
  const p = (async () => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS);
      if (error || !data?.signedUrl) return url;
      cache.set(path, { url: data.signedUrl, expires: Date.now() + (TTL_SECONDS - 300) * 1000 });
      return data.signedUrl;
    } catch {
      return url;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, p);
  return p;
}

/** Ger en visningsbar URL för en (ev.) social-images-URL. */
export function useSocialImageUrl(url: string | null | undefined): string | undefined {
  const isSocial = !!socialImagePath(url);
  const [resolved, setResolved] = useState<string | undefined>(() => {
    if (!url) return undefined;
    if (!isSocial) return url;
    const hit = cache.get(socialImagePath(url)!);
    return hit && hit.expires > Date.now() ? hit.url : undefined;
  });
  useEffect(() => {
    let alive = true;
    if (!url) { setResolved(undefined); return; }
    if (!isSocial) { setResolved(url); return; }
    void resolveSocialImageUrl(url).then((u) => { if (alive) setResolved(u); });
    return () => { alive = false; };
  }, [url, isSocial]);
  return resolved;
}
