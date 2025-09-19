const CACHE_NAME = 'nack-cleanup-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch {}
    try {
      await self.clients.claim();
    } catch {}
    try {
      await self.registration.unregister();
    } catch {}
  })());
});

self.addEventListener('fetch', (event) => {
  // Ne pas intercepter: laisser le réseau gérer
});