import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-ts";

/**
 * React.lazy with resilience against stale/failed chunk fetches.
 * A new deploy invalidates old hashed chunk filenames, which makes
 * dynamic imports fail with "Failed to fetch dynamically imported module".
 * We retry once, then force a single hard reload to pick up the new build.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // One silent retry (handles transient network hiccups)
      await new Promise((r) => setTimeout(r, 600));
      try {
        return await factory();
      } catch (err2) {
        // Likely a stale build: reload once (guarded to avoid loops)
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Never resolves; page is reloading
          return await new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
