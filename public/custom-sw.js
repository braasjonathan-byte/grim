import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

// Force new service worker to take over immediately
self.skipWaiting();
clientsClaim();

// Clean up old caches from previous versions
cleanupOutdatedCaches();

// On activate, clear ALL caches (including old precache) to force fresh content
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    })
  );
});

// Serve navigation requests (HTML) with Network First strategy
// so users always get fresh HTML when online
const navigationHandler = new NetworkFirst({
  cacheName: "navigations",
  networkTimeoutSeconds: 3,
});
registerRoute(new NavigationRoute(navigationHandler));

// Workbox precaching (injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST);

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: data.icon || "/favicon.ico",
      badge: "/favicon.ico",
      vibrate: [100, 50, 100],
      data: data.data || {},
      tag: data.tag || "gymberget-notification",
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Grim", options)
    );
  } catch (e) {
    // Fallback for plain text
    event.waitUntil(
      self.registration.showNotification("Grim", {
        body: event.data.text(),
        icon: "/favicon.ico",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  const fullUrl = new URL(targetUrl, self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(fullUrl);
            return client.focus();
          }
        }
        return clients.openWindow(fullUrl);
      })
  );
});
