/*
 * Offline shell for Dagara Germanist AI.
 *
 * Strategy:
 *   - navigations: network first, fall back to the cached shell (so the app
 *     opens offline);
 *   - hashed assets (JS/CSS/SVG): cache first (they are immutable);
 *   - API calls (/api/nvidia): never cached — AI generation needs a connection.
 *
 * The cache name carries a version so a deploy invalidates the old shell.
 */

const CACHE_VERSION = 'dagara-shell-v1';
const SHELL_ASSETS = ['./', './index.html', './manifest.json', './favicon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(error => console.warn(' Pré-cache impossible :', error))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // AI generation must never be served from cache.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached ?? caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
