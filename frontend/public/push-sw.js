/**
 * sw.js — SipSip Service Worker
 * Handles Web Push events (fires even when the browser tab is closed).
 */

// Wait until the SW is activated before claiming clients
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ─── Push event ───────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'SipSip 💧', body: 'Time for a sip! Your body needs water to stay energized.', url: '/' };

  if (event.data) {
    try { data = { ...data, ...JSON.parse(event.data.text()) }; } catch (_) {}
  }

  event.waitUntil((async () => {
    // Tell open app tabs to show in-app toast (React listens on navigator.serviceWorker)
    try {
      const origin = self.location.origin;
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url && client.url.startsWith(origin)) {
          client.postMessage({
            type: 'SIPSIP_PUSH',
            title: data.title,
            body: data.body,
            url: data.url || '/',
          });
        }
      }
    } catch (_) { /* ignore */ }

    await self.registration.showNotification(data.title, {
      body:     data.body,
      tag:      data.tag   || 'sipsip-hydration',
      renotify: data.renotify ?? true,
      data:     { url: data.url || '/' },
    });
  })());
});

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If we already have the app open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
