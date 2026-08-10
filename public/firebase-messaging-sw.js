// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// --- Offline / PWA cache (app shell) - ES5 compatible ---
// v2 : le nom de cache est incrémenté à chaque déploiement pour forcer
// le re-téléchargement de l'app shell et éviter de servir une version cassée.
var APP_SHELL_CACHE = 'nack-app-shell-v3';
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

// Réponse réseau par défaut (error) pour fallback offline
var NETWORK_ERROR_RESPONSE = Response.error();

// Permettre au client d'activer immédiatement un nouveau SW (mise à jour PWA)
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

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
        // Supprimer TOUS les caches d'app shell sauf le courant (v1, v2, etc.)
        return Promise.all(
          keys.map(function (k) {
            if (k === APP_SHELL_CACHE) return Promise.resolve();
            if (k.indexOf('nack-app-shell-') === 0) return caches.delete(k);
            return Promise.resolve();
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

// Navigation: network-first. Le réseau est TOUJOURS prioritaire pour index.html
// afin qu'une nouvelle version déployée soit servie immédiatement.
// Le cache sert uniquement de fallback hors-ligne.
function handleNavigation(request) {
  return fetch(request)
    .then(function (fresh) {
      // Mettre à jour le cache index.html AVEC la réponse réseau (stale-while-revalidate)
      if (fresh && fresh.ok) {
        caches.open(APP_SHELL_CACHE).then(function (cache) {
          cache.put('/index.html', fresh.clone());
          cache.put('/', fresh.clone());
        }).catch(function () {});
      }
      return fresh;
    })
    .catch(function () {
      return caches.open(APP_SHELL_CACHE).then(function (cache) {
        return cache.match('/index.html').then(function (cached) {
          return cached || cache.match('/').then(function (cachedRoot) {
            return cachedRoot || NETWORK_ERROR_RESPONSE;
          });
        });
      });
    });
}

// Assets: stale-while-revalidate. On sert le cache immédiatement (rapide),
// et on met à jour en arrière-plan pour la prochaine visite.
// Les noms de fichiers Vite sont content-hashed : l'ancienne version est
// toujours valide pour l'index.html qui la référence.
function handleAsset(request) {
  // Les requêtes Range renvoient souvent un 206 — Cache.put refuse les réponses partielles
  if (request.headers && request.headers.get('range')) {
    return fetch(request);
  }
  return caches.open(APP_SHELL_CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var networkFetch = fetch(request).then(function (fresh) {
        try {
          var url = new URL(request.url);
          // Uniquement 200 complet (pas 206 Partial Content)
          if (fresh && fresh.status === 200 && url.origin === self.location.origin) {
            cache.put(request, fresh.clone()).catch(function () { /* ignore quota / 206 */ });
          }
        } catch (e) { /* ignore */ }
        return fresh;
      }).catch(function () {
        return cached || NETWORK_ERROR_RESPONSE;
      });

      if (cached) {
        return cached;
      }
      return networkFetch;
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
