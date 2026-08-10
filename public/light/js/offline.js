(function (global) {
  var CACHE_PREFIX = "nack_light_cache_";
  var QUEUE_KEY = "nack_light_offline_queue";
  var MAX_DOCS = 300;

  function isOnline() {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }

  function cacheKey(path) {
    return CACHE_PREFIX + String(path || "").replace(/\//g, "_");
  }

  function getCache(path) {
    try {
      var raw = localStorage.getItem(cacheKey(path));
      var parsed = safeParse(raw, null);
      if (!parsed || !parsed.data) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function setCache(path, data) {
    try {
      var payload = { savedAt: Date.now(), data: data };
      localStorage.setItem(cacheKey(path), JSON.stringify(payload));
    } catch (e) {
      // Quota dépassé : tenter de nettoyer les plus anciennes entrées
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(CACHE_PREFIX) === 0) keys.push(k);
        }
        keys.sort();
        for (var j = 0; j < Math.min(5, keys.length); j++) localStorage.removeItem(keys[j]);
        localStorage.setItem(cacheKey(path), JSON.stringify({ savedAt: Date.now(), data: data }));
      } catch (e2) {}
    }
  }

  function getQueue() {
    try { return safeParse(localStorage.getItem(QUEUE_KEY), []) || []; }
    catch (e) { return []; }
  }

  function setQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q || [])); }
    catch (e) {}
  }

  function enqueue(op) {
    var q = getQueue();
    op.id = "op_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    op.createdAt = Date.now();
    q.push(op);
    setQueue(q);
    refreshBar();
    return op;
  }

  function collectionOfDoc(path) {
    var parts = String(path || "").split("/");
    if (parts.length < 2) return path;
    return parts.slice(0, parts.length - 1).join("/");
  }

  function upsertCachedDoc(colPath, docObj) {
    var cached = getCache(colPath);
    var list = (cached && cached.data) ? cached.data.slice() : [];
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === docObj.id) {
        for (var k in docObj) if (Object.prototype.hasOwnProperty.call(docObj, k)) list[i][k] = docObj[k];
        found = true;
        break;
      }
    }
    if (!found) list.unshift(docObj);
    if (list.length > MAX_DOCS) list = list.slice(0, MAX_DOCS);
    setCache(colPath, list);
  }

  function removeCachedDoc(colPath, docId) {
    var cached = getCache(colPath);
    if (!cached || !cached.data) return;
    var list = [];
    for (var i = 0; i < cached.data.length; i++) {
      if (cached.data[i].id !== docId) list.push(cached.data[i]);
    }
    setCache(colPath, list);
  }

  function patchCachedDoc(colPath, docId, data) {
    var cached = getCache(colPath);
    if (!cached || !cached.data) return;
    for (var i = 0; i < cached.data.length; i++) {
      if (cached.data[i].id === docId) {
        for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) cached.data[i][k] = data[k];
        setCache(colPath, cached.data);
        return;
      }
    }
  }

  var flushing = false;
  function flushQueue() {
    if (flushing || !isOnline()) return Promise.resolve({ done: 0, left: getQueue().length });
    var api = global.NACK_LIGHT && global.NACK_LIGHT.api;
    if (!api) return Promise.resolve({ done: 0, left: getQueue().length });
    var q = getQueue();
    if (!q.length) return Promise.resolve({ done: 0, left: 0 });
    flushing = true;
    var done = 0;

    function next() {
      q = getQueue();
      if (!q.length || !isOnline()) {
        flushing = false;
        refreshBar();
        return Promise.resolve({ done: done, left: q.length });
      }
      var op = q[0];
      var p;
      if (op.method === "patch") p = api._rawPatchDoc(op.path, op.data, op.maskFields);
      else if (op.method === "create") p = api._rawCreateDoc(op.path, op.data);
      else if (op.method === "set") p = api._rawSetDoc(op.path, op.data, op.createOnly);
      else if (op.method === "delete") p = api._rawDeleteDoc(op.path);
      else p = Promise.resolve();

      return p.then(function () {
        done++;
        q = getQueue();
        q.shift();
        setQueue(q);
        return next();
      }).catch(function (err) {
        flushing = false;
        refreshBar();
        var msg = (err && err.message) || "";
        // Erreur réseau : garder la file
        if (/HTTP 0|réseau|network|timeout|Délai/i.test(msg) || !isOnline()) {
          return { done: done, left: getQueue().length, error: msg };
        }
        // Erreur métier : abandonner cette op pour ne pas bloquer la file
        q = getQueue();
        q.shift();
        setQueue(q);
        return next();
      });
    }

    return next();
  }

  function refreshBar() {
    var bar = document.getElementById("lg-offline-bar");
    if (!bar) return;
    var offline = !isOnline();
    var pending = getQueue().length;
    if (offline) {
      bar.style.display = "block";
      bar.textContent = pending
        ? "Hors ligne — stock en cache local (" + pending + " action(s) en attente)"
        : "Hors ligne — lecture depuis le cache local";
    } else if (pending) {
      bar.style.display = "block";
      bar.textContent = "En ligne — synchronisation de " + pending + " action(s)…";
    } else {
      bar.style.display = "none";
    }
  }

  function init() {
    var bar = document.getElementById("lg-offline-bar");
    var auth = document.getElementById("lg-offline-auth");
    var retry = document.getElementById("offline-auth-retry");
    function upd() {
      var offline = !isOnline();
      refreshBar();
      if (auth) {
        var app = document.getElementById("screen-app");
        var aff = document.getElementById("screen-affiliate");
        var appVisible = app && app.style.display !== "none" && !app.classList.contains("lg-hidden");
        var affVisible = aff && aff.style.display !== "none" && !aff.classList.contains("lg-hidden");
        // Ne bloquer que l'écran de login, pas l'app déjà connectée
        if (offline && !appVisible && !affVisible) {
          auth.style.display = "flex";
          auth.classList.remove("lg-hidden");
        } else {
          auth.style.display = "none";
          auth.classList.add("lg-hidden");
        }
      }
      if (!offline) flushQueue();
    }
    upd();
    window.addEventListener("online", upd, false);
    window.addEventListener("offline", upd, false);
    if (retry) retry.onclick = function () { window.location.reload(); };
    global.NACK_LIGHT.offline.refresh = upd;
  }

  function warmCollections(api, profile, uid) {
    if (!api || !uid || !isOnline()) return;
    var root = api.dataRoot(profile, uid);
    var paths = [root + "/products", root + "/sales", root + "/orders", root + "/team"];
    for (var i = 0; i < paths.length; i++) {
      (function (path) {
        api.listDocs(path, 200).catch(function () {});
      })(paths[i]);
    }
  }

  global.NACK_LIGHT.offline = global.NACK_LIGHT.offline || {};
  global.NACK_LIGHT.offline.init = init;
  global.NACK_LIGHT.offline.isOnline = isOnline;
  global.NACK_LIGHT.offline.getCache = getCache;
  global.NACK_LIGHT.offline.setCache = setCache;
  global.NACK_LIGHT.offline.enqueue = enqueue;
  global.NACK_LIGHT.offline.flushQueue = flushQueue;
  global.NACK_LIGHT.offline.getQueue = getQueue;
  global.NACK_LIGHT.offline.upsertCachedDoc = upsertCachedDoc;
  global.NACK_LIGHT.offline.removeCachedDoc = removeCachedDoc;
  global.NACK_LIGHT.offline.patchCachedDoc = patchCachedDoc;
  global.NACK_LIGHT.offline.collectionOfDoc = collectionOfDoc;
  global.NACK_LIGHT.offline.warmCollections = warmCollections;
  global.NACK_LIGHT.offline.refreshBar = refreshBar;
})(window);
