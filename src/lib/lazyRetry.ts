import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-ts";
const HARD_RELOAD_KEY = "chunk-hard-reload-ts";
const IMPORT_TIMEOUT_MS = 20_000;

/** Rensa SW + Cache Storage så nästa laddning hämtar färsk index.html + chunks. */
export async function purgeAppCaches(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
  } catch { /* ignore */ }
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch { /* ignore */ }
}

export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Loading chunk|ChunkLoadError|Failed to fetch|MIME type|Lazy import timeout/i.test(msg);
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Lazy import timeout")), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });

/**
 * React.lazy med skydd mot gamla/misslyckade chunk-hämtningar.
 * Efter en Publish försvinner gamla hashade chunk-filer (404). Tidigare:
 * ett retry + en reload, sedan kastades felet – utan ErrorBoundary blev
 * appen en tom skärm (bara temabakgrunden) för alltid.
 * Nu: retry → mjuk reload → hård reload (rensa SW + caches, cache-bust-URL)
 * → sist kastas felet till AppErrorBoundary som visar knappar.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await withTimeout(factory(), IMPORT_TIMEOUT_MS);
    } catch {
      await new Promise((r) => setTimeout(r, 600));
      try {
        return await withTimeout(factory(), IMPORT_TIMEOUT_MS);
      } catch (err2) {
        const now = Date.now();
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (now - last > 15000) {
          sessionStorage.setItem(RELOAD_KEY, String(now));
          window.location.reload();
          return await new Promise<{ default: T }>(() => {});
        }
        const lastHard = Number(sessionStorage.getItem(HARD_RELOAD_KEY) || 0);
        if (now - lastHard > 60000) {
          sessionStorage.setItem(HARD_RELOAD_KEY, String(now));
          await purgeAppCaches();
          const url = new URL(window.location.href);
          url.searchParams.set("_r", String(now));
          window.location.replace(url.toString());
          return await new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
