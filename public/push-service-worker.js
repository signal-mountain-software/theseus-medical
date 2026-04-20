// AVA Push Notification Service Worker
// Handles background push events and notification display.
// This file lives in public/ so CRA copies it to build/ unchanged,
// separate from the Workbox-generated service-worker.js.

const CACHE_NAME = 'ava-push-sw-v1';
const STATIC_URLS = ['/', '/index.html', '/manifest.json'];

// ---------- Lifecycle ----------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      ),
      clients.claim(),
    ])
  );
});

// Network-first fetch; fall back to cache for GET requests only.
// Skip AWS/API calls so they are never served stale.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('amazonaws.com') || url.includes('execute-api') || url.includes('cognito')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ---------- Push ----------

self.addEventListener('push', (event) => {
  let data = { title: 'AVA', body: '' };
  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (_) {
      data.body = event.data.text();
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
