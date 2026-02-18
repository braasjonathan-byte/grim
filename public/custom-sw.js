import { precacheAndRoute } from "workbox-precaching";

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
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
