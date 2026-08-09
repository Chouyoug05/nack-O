// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// --- Offline / PWA cache (app shell) - ES5 compatible ---
var APP_SHELL_CACHE = 'nack-app-shell-v1';
var APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/Design sans titre.svg',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(function (cache) {
        return cache.addAll(APP_SHELL_URLS).catch(function () {
          // ignore cache addAll errors for individual files
        });
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function () {
        // ignore
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            return k === APP_SHELL_CACHE ? Promise.resolve() : caches.delete(k);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
      .catch(function () {
        // ignore
      })
  );
});

// Navigation: network-first avec fallback sur index.html cache (SPA offline)
function handleNavigation(request) {
  return fetch(request)
    .then(function (fresh) {
      // Mettre à jour index.html dans le cache si possible
      caches.open(APP_SHELL_CACHE).then(function (cache) {
        cache.put('/index.html', fresh.clone());
        cache.put('/', fresh.clone());
      }).catch(function () {});
      return fresh;
    })
    .catch(function () {
      return caches.open(APP_SHELL_CACHE).then(function (cache) {
        return cache.match('/index.html').then(function (cached) {
          return cached || cache.match('/').then(function (cachedRoot) {
            return cachedRoot || Response.error();
          });
        });
      });
    });
}

// Assets: cache-first (js/css/images/fonts) pour pouvoir relancer l'app hors-ligne
function handleAsset(request) {
  return caches.open(APP_SHELL_CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (fresh) {
        // Cache uniquement les réponses valides de même origine
        try {
          var url = new URL(request.url);
          if (url.origin === self.location.origin && fresh && fresh.ok) {
            cache.put(request, fresh.clone());
          }
        } catch (e) { /* ignore */ }
        return fresh;
      }).catch(function () {
        return cached || Response.error();
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Ne pas intercepter Firebase/Google externes (messaging, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // Navigations SPA
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Static assets
  var pathname = url.pathname;
  var isAsset =
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.ttf');

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
    measurementId: "G-CZC9NPN8T1"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    var notificationTitle = payload.notification.title;
    var notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
