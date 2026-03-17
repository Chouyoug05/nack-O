// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// --- Offline / PWA cache (app shell) ---
const APP_SHELL_CACHE = 'nack-app-shell-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/Design sans titre.svg',
  // Icons principaux (si présents)
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(APP_SHELL_CACHE);
      await cache.addAll(APP_SHELL_URLS);
    } catch {
      // ignore cache install errors
    }
    try { await self.skipWaiting(); } catch { /* ignore */ }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === APP_SHELL_CACHE ? Promise.resolve() : caches.delete(k))));
    } catch { /* ignore */ }
    try { await self.clients.claim(); } catch { /* ignore */ }
  })());
});

// Navigation: network-first avec fallback sur index.html cache (SPA offline)
async function handleNavigation(request) {
  try {
    const fresh = await fetch(request);
    // Mettre à jour index.html dans le cache si possible
    try {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put('/index.html', fresh.clone());
      cache.put('/', fresh.clone());
    } catch { /* ignore */ }
    return fresh;
  } catch {
    const cache = await caches.open(APP_SHELL_CACHE);
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}

// Assets: cache-first (js/css/images/fonts) pour pouvoir relancer l’app hors-ligne
async function handleAsset(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    // Cache uniquement les réponses valides de même origine
    try {
      const url = new URL(request.url);
      if (url.origin === self.location.origin && fresh && fresh.ok) {
        cache.put(request, fresh.clone());
      }
    } catch { /* ignore */ }
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Ne pas intercepter Firebase/Google externes (messaging, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Navigations SPA
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Static assets
  const isAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf');

  if (isAsset) {
    event.respondWith(handleAsset(request));
  }
});

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyCHbORTw-dgJW4OWIRazYrhAemERLV68sM",
    authDomain: "nack-8c299.firebaseapp.com",
    projectId: "nack-8c299",
    storageBucket: "nack-8c299.firebasestorage.app",
    messagingSenderId: "94970966128",
    appId: "1:94970966128:web:e3af16bcd2a262e66cc4b5",
    measurementId: "G-CZC9NPN8T1",
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
