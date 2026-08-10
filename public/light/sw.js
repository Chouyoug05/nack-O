/* Service worker NACK Light — fallback si le SW racine n'est pas dispo */
var CACHE = "nack-light-shell-v1";
var SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/app.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/offline.js",
  "./js/pwa.js",
  "./js/receipt.js",
  "./js/icons.js",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/favicon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {});
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf("nack-light-shell-") === 0) return caches.delete(k);
        return Promise.resolve();
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    fetch(req).then(function (res) {
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || caches.match("./index.html");
      });
    })
  );
});
