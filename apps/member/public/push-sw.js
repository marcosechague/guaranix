// Push handlers, imported into the Workbox service worker (vite.config.ts,
// `workbox.importScripts`). The payload is what `createWebPushChannel` sends:
// { title, body, url?, tag? }, already in es-PY.
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  if (!payload.title) return;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      lang: 'es-PY',
      data: { url: payload.url || '/' },
      ...(payload.tag ? { tag: payload.tag, renotify: true } : {}),
    }),
  );
});

// Focus an open window of the app on the notification's screen, or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === target.origin);
      if (open) {
        return open.focus().then((client) => (client ? client.navigate(target.href) : undefined));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
