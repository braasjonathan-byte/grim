/**
 * Triggers an app update flow.
 * Clears caches, unregisters the service worker and forces a hard reload
 * so the newest build is fetched from the network. Works the same on
 * web/PWA and inside the native Capacitor webview (which loads the same
 * web bundle), so the user always gets the latest version without having
 * to reinstall the app.
 */
export async function updateApp(): Promise<void> {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignore
  }

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString());
  window.location.replace(url.toString());
}
