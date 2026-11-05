const APP_CACHE = 'diur-app-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith('diur-app-shell-') && name !== APP_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(APP_CACHE);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        const cachedPage = await caches.match('/index.html');
        if (cachedPage) return cachedPage;
        return new Response('La aplicación aún no se ha cargado en este dispositivo. Conéctate una vez para prepararla.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;

      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(APP_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { message: event.data?.text() || 'Hay una actualización en DIUR SYSTEM.' };
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'DIUR SYSTEM', {
    body: payload.message || 'Hay una actualización en el sistema.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: '/dashboard' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const targetUrl = new URL(event.notification.data?.url || '/dashboard', self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      if ('focus' in client) {
        if ('navigate' in client && new URL(client.url).pathname !== targetUrl.pathname) {
          await client.navigate(targetUrl.href);
        }
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl.href);
  })());
});
