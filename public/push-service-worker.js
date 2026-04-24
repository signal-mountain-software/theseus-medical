// AVA Push Notification Service Worker
// Handles background push events and notification display.
// This file lives in public/ so CRA copies it to build/ unchanged.
// Intentionally does NOT do any caching — that keeps installation
// trivial and avoids conflicts with the CRA app shell.

// ---------- Lifecycle ----------

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Do not call clients.claim() — we don't need to control any page clients.
  // Claiming causes 'InvalidStateError: Only the active worker can claim clients'
  // when competing with the CRA dev service worker at the same scope.
  event.waitUntil(Promise.resolve());
});

// ---------- Push ----------

self.addEventListener('push', (event) => {
  const rawText = event.data ? event.data.text() : '(no data)';
  let data = { title: 'AVA', body: '' };
  if (event.data) {
    try {
      data = Object.assign(data, JSON.parse(rawText));
    } catch (_) {
      data.body = rawText;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/favicon-32x32.png',
    tag: data.tag || 'ava-notification',
    data: data.data || {},
    requireInteraction: data.requireInteraction !== false,
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ---------- Notification click ----------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Re-use an existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            if ('navigate' in client) client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
