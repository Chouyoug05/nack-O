(function (global) {
  var CFG = global.NACK_LIGHT.FIREBASE;
  var KEYS = global.NACK_LIGHT.STORAGE_KEYS;
  var PROJECT = CFG.projectId;
  var API_KEY = CFG.apiKey;
  var AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";
  var SECURE_BASE = "https://securetoken.googleapis.com/v1";
  var FS_BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";

  function xhr(method, url, body, headers) {
    return new Promise(function (resolve, reject) {
      try {
        var req = new XMLHttpRequest();
        // false = async; old Android parfois plus fiable sans withCredentials
        req.open(method, url, true);
        try { req.withCredentials = false; } catch (e0) {}
        req.timeout = 45000;
        var h = headers || {};
        var contentTypeSet = false;
        for (var k in h) {
          if (Object.prototype.hasOwnProperty.call(h, k)) {
            try {
              req.setRequestHeader(k, h[k]);
              if (String(k).toLowerCase() === "content-type") contentTypeSet = true;
            } catch (e1) {}
          }
        }
        req.onreadystatechange = function () {
          if (req.readyState !== 4) return;
          var text = req.responseText || "";
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
          if (req.status >= 200 && req.status < 300) resolve(data);
          else {
            var msg = "HTTP " + req.status;
            if (data) {
              if (typeof data.error === "string") msg = data.error;
              else if (data.error && (data.error.message || data.error.status)) {
                msg = data.error.message || data.error.status;
              } else if (typeof data.message === "string") msg = data.message;
              if (data.detail && typeof data.detail === "string") msg += " — " + data.detail;
              else if (data.hint && typeof data.hint === "string") msg += " — " + data.hint;
            } else if (text && text.length < 200 && text.indexOf("<") === -1) {
              msg = text;
            }
            if (req.status === 0) msg = "Impossible de joindre le serveur. Vérifiez votre connexion.";
            reject(new Error(msg));
          }
        };
        req.onerror = function () { reject(new Error("Impossible de joindre le serveur. Vérifiez votre connexion.")); };
        req.ontimeout = function () { reject(new Error("La requête a pris trop de temps. Réessayez.")); };
        if (body != null) {
          if (typeof body === "string") {
            if (!contentTypeSet) {
              try { req.setRequestHeader("Content-Type", "application/json;charset=UTF-8"); } catch (e2) {}
            }
            req.send(body);
          } else {
            if (!contentTypeSet) {
              try { req.setRequestHeader("Content-Type", "application/json;charset=UTF-8"); } catch (e3) {}
            }
            req.send(JSON.stringify(body));
          }
        } else req.send();
      } catch (err) { reject(err); }
    });
  }

  function storageGet(k) {
    try {
      var v = localStorage.getItem(k);
      if (v) return v;
      // migration anciennes clés nack_lg_*
      var map = {
        nack_light_idToken: "nack_lg_idToken",
        nack_light_refreshToken: "nack_lg_refreshToken",
        nack_light_uid: "nack_lg_uid",
        nack_light_email: "nack_lg_email"
      };
      if (map[k]) {
        v = localStorage.getItem(map[k]);
        if (v) { localStorage.setItem(k, v); return v; }
      }
      return null;
    } catch (e) { return null; }
  }
  function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function storageDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function getSession() {
    return {
      idToken: storageGet(KEYS.idToken),
      refreshToken: storageGet(KEYS.refreshToken),
      uid: storageGet(KEYS.uid),
      email: storageGet(KEYS.email)
    };
  }
  function saveSession(data) {
    if (data.idToken) storageSet(KEYS.idToken, data.idToken);
    if (data.refreshToken) storageSet(KEYS.refreshToken, data.refreshToken);
    if (data.localId || data.uid) storageSet(KEYS.uid, data.localId || data.uid);
    if (data.email) storageSet(KEYS.email, data.email);
  }
  function clearSession() {
    storageDel(KEYS.idToken); storageDel(KEYS.refreshToken);
    storageDel(KEYS.uid); storageDel(KEYS.email);
  }

  function signIn(email, password) {
    return xhr("POST", AUTH_BASE + "/accounts:signInWithPassword?key=" + API_KEY, {
      email: email, password: password, returnSecureToken: true
    }).then(function (res) { saveSession(res); return res; });
  }

  function refreshIdToken() {
    var s = getSession();
    if (!s.refreshToken) return Promise.reject(new Error("Session expirée"));
    return xhr("POST", SECURE_BASE + "/token?key=" + API_KEY, {
      grant_type: "refresh_token", refresh_token: s.refreshToken
    }).then(function (res) {
      saveSession({ idToken: res.id_token, refreshToken: res.refresh_token, uid: res.user_id });
      return res.id_token;
    });
  }

  function authHeaders(token) { return { Authorization: "Bearer " + token }; }

  function withToken(fn) {
    var s = getSession();
    if (!s.idToken) return Promise.reject(new Error("Non connecté"));
    return fn(s.idToken).catch(function (err) {
      var msg = (err && err.message) || "";
      if (msg.indexOf("UNAUTHENTICATED") !== -1 || msg.indexOf("401") !== -1 || msg.indexOf("403") !== -1) {
        return refreshIdToken().then(function (token) { return fn(token); });
      }
      throw err;
    });
  }

  function fromFsValue(v) {
    if (!v || typeof v !== "object") return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return !!v.booleanValue;
    if ("nullValue" in v) return null;
    if ("timestampValue" in v) return v.timestampValue;
    if ("mapValue" in v) {
      var out = {}, fields = (v.mapValue && v.mapValue.fields) || {};
      for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) out[k] = fromFsValue(fields[k]);
      return out;
    }
    if ("arrayValue" in v) {
      var vals = (v.arrayValue && v.arrayValue.values) || [], arr = [];
      for (var i = 0; i < vals.length; i++) arr.push(fromFsValue(vals[i]));
      return arr;
    }
    return null;
  }

  function docToObj(doc) {
    if (!doc) return null;
    var obj = { id: doc.name ? doc.name.split("/").pop() : "" };
    if (doc.name) obj._path = doc.name.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\//, "");
    var fields = doc.fields || {};
    for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) obj[k] = fromFsValue(fields[k]);
    return obj;
  }

  function ownerUidFromTeamPath(path) {
    if (!path) return null;
    var m = String(path).match(/\/profiles\/([^/]+)\/team\//);
    return m ? m[1] : null;
  }

  function ownerDataRoot(ownerUid, profile) {
    // Aligné sur Pro : données métier sous profiles/{uid}
    return "profiles/" + ownerUid;
  }

  function dataRoot(profile, uid) {
    // Même source que la version Pro (React StockPage/SalesPage) :
    // profiles/{uid}/products|sales|... — pas establishments/...
    return "profiles/" + uid;
  }

  var EST_MIGRATE_COLS = [
    "products", "sales", "orders", "losses", "events", "team",
    "customers", "notifications", "barOrders", "tables"
  ];

  function copyDocFields(d) {
    var payload = {};
    for (var k in d) {
      if (!Object.prototype.hasOwnProperty.call(d, k)) continue;
      if (k === "id" || k === "_path" || k === "_fromCache" || k === "_pendingSync") continue;
      payload[k] = d[k];
    }
    return payload;
  }

  /** Si Lite a écrit sous establishments/ alors que Pro lit profiles/, on rapatrie. */
  function migrateEstablishmentCollectionsToProfile(uid, profile) {
    if (!uid) return Promise.resolve(0);
    var eids = [];
    var active = profile && profile.activeEstablishmentId;
    if (active) eids.push(String(active));
    if (eids.indexOf(String(uid)) === -1) eids.push(String(uid));

    var totalMoved = 0;
    var chain = Promise.resolve();

    function migrateCol(eid, col) {
      var fromPath = "establishments/" + eid + "/" + col;
      var toPath = "profiles/" + uid + "/" + col;
      return Promise.all([
        listDocsRaw(fromPath, 200).catch(function () { return []; }),
        listDocsRaw(toPath, 5).catch(function () { return []; })
      ]).then(function (pair) {
        var fromDocs = pair[0] || [];
        var toDocs = pair[1] || [];
        if (!fromDocs.length || toDocs.length > 0) return 0;
        var ops = [];
        for (var i = 0; i < fromDocs.length; i++) {
          var d = fromDocs[i];
          var payload = copyDocFields(d);
          if (d.id) {
            ops.push(setDocRaw(toPath + "/" + d.id, payload, false).catch(function () { return null; }));
          } else {
            ops.push(createDocRaw(toPath, payload).catch(function () { return null; }));
          }
        }
        return Promise.all(ops).then(function (res) {
          var n = 0;
          for (var j = 0; j < res.length; j++) if (res[j]) n++;
          return n;
        });
      });
    }

    for (var i = 0; i < eids.length; i++) {
      (function (eid) {
        for (var c = 0; c < EST_MIGRATE_COLS.length; c++) {
          (function (col) {
            chain = chain.then(function () {
              return migrateCol(eid, col).then(function (n) {
                totalMoved += n || 0;
              });
            });
          })(EST_MIGRATE_COLS[c]);
        }
      })(eids[i]);
    }

    return chain.then(function () { return totalMoved; });
  }

  /** Remplit le profil depuis establishments/ si des champs nom/gérant manquent. */
  function enrichProfileFromEstablishment(uid, profile) {
    if (!profile || !uid) return Promise.resolve(profile);
    var needName = !String(profile.establishmentName || "").trim();
    var needOwner = !String(profile.ownerName || "").trim();
    if (!needName && !needOwner) return Promise.resolve(profile);
    var eid = profile.activeEstablishmentId || uid;
    return getDoc("establishments/" + eid).then(function (est) {
      if (!est) return profile;
      var patch = {};
      var mask = [];
      if (needName && est.name) {
        profile.establishmentName = est.name;
        patch.establishmentName = est.name;
        mask.push("establishmentName");
      }
      if (needOwner && est.ownerName) {
        profile.ownerName = est.ownerName;
        patch.ownerName = est.ownerName;
        mask.push("ownerName");
      }
      if (!profile.establishmentType && est.type) {
        profile.establishmentType = est.type;
        patch.establishmentType = est.type;
        mask.push("establishmentType");
      }
      if (!profile.phone && est.phone) {
        profile.phone = est.phone;
        patch.phone = est.phone;
        mask.push("phone");
      }
      if (!profile.whatsapp && est.whatsapp) {
        profile.whatsapp = est.whatsapp;
        patch.whatsapp = est.whatsapp;
        mask.push("whatsapp");
      }
      if (!profile.logoUrl && est.logoUrl) {
        profile.logoUrl = est.logoUrl;
        patch.logoUrl = est.logoUrl;
        mask.push("logoUrl");
      }
      if (!mask.length) return profile;
      patch.updatedAt = Date.now();
      mask.push("updatedAt");
      return patchProfile(uid, patch, mask).then(function () { return profile; }).catch(function () { return profile; });
    }).catch(function () { return profile; });
  }

  function publicListDocs(path, pageSize) {
    var qs = "?key=" + API_KEY + (pageSize ? ("&pageSize=" + pageSize) : "");
    return xhr("GET", FS_BASE + "/" + path + qs, null, null).then(function (res) {
      var docs = res.documents || [], out = [];
      for (var i = 0; i < docs.length; i++) out.push(docToObj(docs[i]));
      return out;
    });
  }

  function publicCreateDoc(path, data) {
    return xhr("POST", FS_BASE + "/" + path + "?key=" + API_KEY, { fields: toFsFields(data) }, { "Content-Type": "application/json" }).then(docToObj);
  }

  function publicPatchDoc(path, data, maskFields) {
    var qs = "?key=" + API_KEY;
    if (maskFields && maskFields.length) {
      for (var i = 0; i < maskFields.length; i++) qs += "&updateMask.fieldPaths=" + encodeURIComponent(maskFields[i]);
    }
    return xhr("PATCH", FS_BASE + "/" + path + qs, { fields: toFsFields(data) }, { "Content-Type": "application/json" }).then(docToObj);
  }

  function resolveAgentToken(token) {
    var t = String(token || "").trim();
    if (!t) return Promise.resolve(null);
    return getPublicDoc("agentTokens/" + t).then(function (doc) {
      if (doc && doc.ownerUid) {
        return {
          ownerUid: doc.ownerUid,
          agentToken: t,
          agentCode: doc.agentCode || t,
          agentName: ((doc.firstName || "") + " " + (doc.lastName || "")).trim() || "Agent",
          memberId: doc.memberId || null,
          role: doc.role || null
        };
      }
      return runPublicQuery({
        from: [{ collectionId: "team", allDescendants: true }],
        where: {
          fieldFilter: {
            field: { fieldPath: "agentToken" },
            op: "EQUAL",
            value: { stringValue: t }
          }
        },
        limit: 1
      }).then(function (docs) {
        if (docs.length) return docs;
        return runPublicQuery({
          from: [{ collectionId: "team", allDescendants: true }],
          where: {
            fieldFilter: {
              field: { fieldPath: "agentCode" },
              op: "EQUAL",
              value: { stringValue: t }
            }
          },
          limit: 1
        });
      }).then(function (docs) {
        if (!docs || !docs.length) return null;
        var d = docs[0];
        var ownerUid = ownerUidFromTeamPath(d._path);
        if (!ownerUid) return null;
        return {
          ownerUid: ownerUid,
          agentToken: d.agentToken || t,
          agentCode: d.agentCode || t,
          agentName: ((d.firstName || "") + " " + (d.lastName || "")).trim() || "Agent",
          memberId: d.id || null,
          role: d.role || null
        };
      });
    });
  }

  function toFsValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    var t = typeof val;
    if (t === "string") return { stringValue: val };
    if (t === "boolean") return { booleanValue: val };
    if (t === "number") {
      if (Math.floor(val) === val) return { integerValue: String(val) };
      return { doubleValue: val };
    }
    if (Object.prototype.toString.call(val) === "[object Array]") {
      var values = [];
      for (var i = 0; i < val.length; i++) values.push(toFsValue(val[i]));
      return { arrayValue: { values: values } };
    }
    if (t === "object") {
      var fields = {};
      for (var k in val) {
        if (Object.prototype.hasOwnProperty.call(val, k) && k !== "id") fields[k] = toFsValue(val[k]);
      }
      return { mapValue: { fields: fields } };
    }
    return { stringValue: String(val) };
  }

  function toFsFields(obj) {
    var fields = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k) && k !== "id") fields[k] = toFsValue(obj[k]);
    }
    return fields;
  }

  function getDoc(path) {
    return withToken(function (token) {
      return xhr("GET", FS_BASE + "/" + path, null, authHeaders(token)).then(function (doc) {
        var obj = docToObj(doc);
        var off = global.NACK_LIGHT.offline;
        if (off && off.setCache) off.setCache("doc:" + path, obj);
        return obj;
      });
    }).catch(function (err) {
      var off = global.NACK_LIGHT.offline;
      if (off && off.getCache) {
        var cached = off.getCache("doc:" + path);
        if (cached && cached.data) {
          // Ancien cache brut Firestore (fields.*) → convertir
          var data = cached.data;
          if (data && data.fields && !data.establishmentName && !data.name) {
            data = docToObj(data);
          }
          if (data) data._fromCache = true;
          return data;
        }
      }
      throw err;
    });
  }

  function listDocsRaw(path, pageSize) {
    var qs = pageSize ? ("?pageSize=" + pageSize) : "";
    return withToken(function (token) {
      return xhr("GET", FS_BASE + "/" + path + qs, null, authHeaders(token)).then(function (res) {
        var docs = res.documents || [], out = [];
        for (var i = 0; i < docs.length; i++) out.push(docToObj(docs[i]));
        return out;
      });
    });
  }

  function listDocs(path, pageSize) {
    return listDocsRaw(path, pageSize).then(function (out) {
      var off = global.NACK_LIGHT.offline;
      if (off && off.setCache) off.setCache(path, out);
      return out;
    }).catch(function (err) {
      var off = global.NACK_LIGHT.offline;
      if (off && off.getCache) {
        var cached = off.getCache(path);
        if (cached && cached.data && cached.data.length != null) {
          var copy = cached.data.slice();
          for (var i = 0; i < copy.length; i++) copy[i]._fromCache = true;
          return copy;
        }
      }
      throw err;
    });
  }

  function createDocRaw(path, data) {
    return withToken(function (token) {
      return xhr("POST", FS_BASE + "/" + path, { fields: toFsFields(data) }, authHeaders(token)).then(docToObj);
    });
  }

  function createDoc(path, data) {
    var off = global.NACK_LIGHT.offline;
    if (off && !off.isOnline()) {
      var localId = "local_" + Date.now();
      var localDoc = {};
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) localDoc[k] = data[k];
      localDoc.id = localId;
      localDoc._pendingSync = true;
      off.enqueue({ method: "create", path: path, data: data, localId: localId });
      if (off.upsertCachedDoc) off.upsertCachedDoc(path, localDoc);
      return Promise.resolve(localDoc);
    }
    return createDocRaw(path, data).then(function (doc) {
      if (off && off.upsertCachedDoc) off.upsertCachedDoc(path, doc);
      return doc;
    }).catch(function (err) {
      if (off && (!off.isOnline() || /HTTP 0|réseau|network|Délai|joindre|trop de temps|timeout|Failed to fetch/i.test((err && err.message) || ""))) {
        var localId2 = "local_" + Date.now();
        var localDoc2 = {};
        for (var k2 in data) if (Object.prototype.hasOwnProperty.call(data, k2)) localDoc2[k2] = data[k2];
        localDoc2.id = localId2;
        localDoc2._pendingSync = true;
        off.enqueue({ method: "create", path: path, data: data, localId: localId2 });
        if (off.upsertCachedDoc) off.upsertCachedDoc(path, localDoc2);
        return localDoc2;
      }
      throw err;
    });
  }

  function patchDocRaw(path, data, maskFields) {
    var qs = "";
    if (maskFields && maskFields.length) {
      var parts = [];
      for (var i = 0; i < maskFields.length; i++) parts.push("updateMask.fieldPaths=" + encodeURIComponent(maskFields[i]));
      qs = "?" + parts.join("&");
    }
    return withToken(function (token) {
      return xhr("PATCH", FS_BASE + "/" + path + qs, { fields: toFsFields(data) }, authHeaders(token)).then(docToObj);
    });
  }

  function patchDoc(path, data, maskFields) {
    var off = global.NACK_LIGHT.offline;
    var col = off && off.collectionOfDoc ? off.collectionOfDoc(path) : path.replace(/\/[^/]+$/, "");
    var docId = path.split("/").pop();
    function applyLocal() {
      if (off && off.patchCachedDoc) off.patchCachedDoc(col, docId, data);
      var out = { id: docId };
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) out[k] = data[k];
      out._pendingSync = true;
      return out;
    }
    if (off && !off.isOnline()) {
      off.enqueue({ method: "patch", path: path, data: data, maskFields: maskFields });
      return Promise.resolve(applyLocal());
    }
    return patchDocRaw(path, data, maskFields).then(function (doc) {
      if (off && off.patchCachedDoc) off.patchCachedDoc(col, docId, data);
      return doc;
    }).catch(function (err) {
      if (off && (!off.isOnline() || /HTTP 0|réseau|network|Délai|joindre|trop de temps|timeout|Failed to fetch/i.test((err && err.message) || ""))) {
        off.enqueue({ method: "patch", path: path, data: data, maskFields: maskFields });
        return applyLocal();
      }
      throw err;
    });
  }

  function deleteDocRaw(path) {
    return withToken(function (token) {
      return xhr("DELETE", FS_BASE + "/" + path, null, authHeaders(token));
    });
  }

  function deleteDoc(path) {
    var off = global.NACK_LIGHT.offline;
    var col = off && off.collectionOfDoc ? off.collectionOfDoc(path) : path.replace(/\/[^/]+$/, "");
    var docId = path.split("/").pop();
    if (off && !off.isOnline()) {
      off.enqueue({ method: "delete", path: path });
      if (off.removeCachedDoc) off.removeCachedDoc(col, docId);
      return Promise.resolve();
    }
    return deleteDocRaw(path).then(function () {
      if (off && off.removeCachedDoc) off.removeCachedDoc(col, docId);
    }).catch(function (err) {
      if (off && (!off.isOnline() || /HTTP 0|réseau|network|Délai|joindre|trop de temps|timeout|Failed to fetch/i.test((err && err.message) || ""))) {
        off.enqueue({ method: "delete", path: path });
        if (off.removeCachedDoc) off.removeCachedDoc(col, docId);
        return;
      }
      throw err;
    });
  }

  function getPageOrigin() {
    try {
      if (window.location.origin) return String(window.location.origin);
    } catch (e) {}
    try {
      return window.location.protocol + "//" + window.location.host;
    } catch (e2) {
      return "https://nack.pro";
    }
  }

  function publicBase() {
    try {
      var origin = getPageOrigin().replace("://www.nack.pro", "://nack.pro");
      var path = window.location.pathname || "";
      var idx = path.indexOf("/light");
      var basePath = idx >= 0 ? path.substring(0, idx) : "";
      if (basePath && basePath.charAt(basePath.length - 1) === "/") {
        basePath = basePath.slice(0, -1);
      }
      return origin + basePath;
    } catch (e) {
      return "https://nack.pro";
    }
  }

  function resolvePaymentProxy() {
    // URL absolue obligatoire sur tablettes anciennes :
    // une URL relative depuis /light/ devient /light/.netlify/... (cassé → erreur).
    return "https://nack.pro/.netlify/functions/create-payment-link";
  }

  function createPaymentLink(params) {
    params = params || {};
    var amount = Math.round(Number(params.amount) || 0);
    if (!amount || amount < 100) {
      return Promise.reject(new Error("Montant de paiement invalide"));
    }
    var base = publicBase() || "https://nack.pro";
    base = String(base).replace("://www.nack.pro", "://nack.pro");
    var payload = {
      reference: String(params.reference || ("nack-" + Date.now())),
      redirect_success: String(params.redirect_success || (base + "/payment/success")),
      redirect_error: String(params.redirect_error || (base + "/payment/error")),
      amount: amount,
      logoURL: String(params.logoURL || (base + "/favicon.png")),
      isTransfer: params.isTransfer === true
    };
    if (params.portefeuille) payload.portefeuille = String(params.portefeuille);
    if (params.disbursement) payload.disbursement = String(params.disbursement);

    function postOnce(url) {
      return xhr("POST", url, payload, {
        "Content-Type": "application/json;charset=UTF-8",
        Accept: "application/json"
      });
    }

    return postOnce(resolvePaymentProxy()).then(function (res) {
      if (typeof res === "string") {
        try { res = JSON.parse(res); } catch (e) { throw new Error("Réponse paiement invalide"); }
      }
      if (res && res.link) return String(res.link);
      throw new Error("Lien de paiement introuvable");
    }).catch(function (err) {
      // Second essai via chemin relatif racine (si DNS/apex bloqué sur le WebView)
      var fallback = getPageOrigin().replace("://www.nack.pro", "://nack.pro") +
        "/.netlify/functions/create-payment-link";
      if (fallback.indexOf("nack.pro") !== -1 && fallback !== resolvePaymentProxy()) {
        return postOnce(fallback).then(function (res) {
          if (typeof res === "string") {
            try { res = JSON.parse(res); } catch (e) { throw err; }
          }
          if (res && res.link) return String(res.link);
          throw err;
        });
      }
      throw err;
    });
  }

  function getPublicDoc(path) {
    return xhr("GET", FS_BASE + "/" + path + "?key=" + API_KEY, null, null).then(docToObj).catch(function () { return null; });
  }

  function runPublicQuery(structuredQuery) {
    return xhr("POST", FS_BASE + ":runQuery?key=" + API_KEY, { structuredQuery: structuredQuery }, { "Content-Type": "application/json" }).then(function (res) {
      var rows = res || [], out = [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].document) out.push(docToObj(rows[i].document));
      }
      return out;
    });
  }

  function runQuery(structuredQuery) {
    return withToken(function (token) {
      return xhr("POST", FS_BASE + ":runQuery", { structuredQuery: structuredQuery }, authHeaders(token)).then(function (res) {
        var rows = res || [], out = [];
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].document) out.push(docToObj(rows[i].document));
        }
        return out;
      });
    });
  }

  function setDoc(path, data, createOnly) {
    var off = global.NACK_LIGHT.offline;
    function setRaw() {
      var qs = createOnly ? "?currentDocument.exists=false" : "";
      return withToken(function (token) {
        return xhr("PATCH", FS_BASE + "/" + path + qs, { fields: toFsFields(data) }, authHeaders(token)).then(docToObj);
      });
    }
    if (off && !off.isOnline()) {
      off.enqueue({ method: "set", path: path, data: data, createOnly: createOnly });
      var col = off.collectionOfDoc ? off.collectionOfDoc(path) : path.replace(/\/[^/]+$/, "");
      var local = { id: path.split("/").pop() };
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) local[k] = data[k];
      local._pendingSync = true;
      if (off.upsertCachedDoc) off.upsertCachedDoc(col, local);
      if (off.setCache) off.setCache("doc:" + path, local);
      return Promise.resolve(local);
    }
    return setRaw().then(function (doc) {
      if (off && off.setCache) off.setCache("doc:" + path, doc);
      return doc;
    }).catch(function (err) {
      if (off && (!off.isOnline() || /HTTP 0|réseau|network|Délai|joindre|trop de temps|timeout|Failed to fetch/i.test((err && err.message) || ""))) {
        off.enqueue({ method: "set", path: path, data: data, createOnly: createOnly });
        var col2 = off.collectionOfDoc ? off.collectionOfDoc(path) : path.replace(/\/[^/]+$/, "");
        var local2 = { id: path.split("/").pop() };
        for (var k2 in data) if (Object.prototype.hasOwnProperty.call(data, k2)) local2[k2] = data[k2];
        local2._pendingSync = true;
        if (off.upsertCachedDoc) off.upsertCachedDoc(col2, local2);
        return local2;
      }
      throw err;
    });
  }

  function setDocRaw(path, data, createOnly) {
    var qs = createOnly ? "?currentDocument.exists=false" : "";
    return withToken(function (token) {
      return xhr("PATCH", FS_BASE + "/" + path + qs, { fields: toFsFields(data) }, authHeaders(token)).then(docToObj);
    });
  }

  function teamPath(uid) { return "profiles/" + uid + "/team"; }

  function findAgentByCode(agentCode, role) {
    return runPublicQuery({
      from: [{ collectionId: "agentTokens" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "agentCode" },
          op: "EQUAL",
          value: { stringValue: agentCode }
        }
      },
      limit: 1
    }).then(function (docs) {
      if (docs.length && docs[0].role === role) return docs[0].id;
      return runPublicQuery({
        from: [{ collectionId: "team", allDescendants: true }],
        where: {
          fieldFilter: {
            field: { fieldPath: "agentCode" },
            op: "EQUAL",
            value: { stringValue: agentCode }
          }
        },
        limit: 1
      }).then(function (teamDocs) {
        if (!teamDocs.length) return null;
        var data = teamDocs[0];
        if (data.role !== role) return null;
        return data.agentToken || agentCode;
      });
    });
  }

  function loginAffiliate(identifier, password) {
    var id = String(identifier || "").trim();
    var pass = String(password || "").trim();
    if (!id || !pass) return Promise.reject(new Error("Code et mot de passe requis"));
    var code = id.toUpperCase();
    return getPublicDoc("affiliates/" + code).then(function (doc) {
      if (doc && doc.id) {
        if (doc.password && doc.password !== pass) throw new Error("Mot de passe incorrect");
        return doc;
      }
      return runPublicQuery({
        from: [{ collectionId: "affiliates" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "whatsapp" },
            op: "EQUAL",
            value: { stringValue: id }
          }
        },
        limit: 1
      }).then(function (docs) {
        if (!docs.length) throw new Error("Identifiant inconnu");
        var aff = docs[0];
        if (aff.password && aff.password !== pass) throw new Error("Mot de passe incorrect");
        return aff;
      });
    });
  }

  function queryReferrals(code) {
    return runPublicQuery({
      from: [{ collectionId: "profiles" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "referredBy" },
          op: "EQUAL",
          value: { stringValue: code }
        }
      }
    });
  }

  function patchProfile(uid, data, maskFields) {
    return patchDoc("profiles/" + uid, data, maskFields);
  }

  function signUp(email, password) {
    return xhr("POST", AUTH_BASE + "/accounts:signUp?key=" + API_KEY, {
      email: email, password: password, returnSecureToken: true
    }).then(function (res) { saveSession(res); return res; });
  }

  function resetPassword(email) {
    return xhr("POST", AUTH_BASE + "/accounts:sendOobCode?key=" + API_KEY, {
      requestType: "PASSWORD_RESET", email: email
    });
  }

  function isAdmin(uid) {
    return getPublicDoc("admins/" + uid).then(function (d) { return !!(d && d.id); });
  }

  function startPolling(fn, ms) {
    fn();
    return setInterval(fn, ms || 8000);
  }

  function stopPolling(id) { if (id) clearInterval(id); }

  function exportCsv(filename, rows) {
    var csv = rows.map(function (row) {
      return row.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  function sanitizeImei(v) {
    return String(v || "").replace(/\D/g, "").slice(0, 15);
  }

  function validateImei(v) {
    var s = sanitizeImei(v);
    return s.length >= 14 && s.length <= 15;
  }

  function tabletStorageKey(uid) {
    return "nack_tablet_imei_" + uid;
  }

  function rememberTabletImei(uid, imei) {
    try { localStorage.setItem(tabletStorageKey(uid), sanitizeImei(imei)); } catch (e) {}
  }

  function getRememberedTabletImei(uid) {
    try { return localStorage.getItem(tabletStorageKey(uid)) || ""; } catch (e) { return ""; }
  }

  function registerTablet(uid, profile, imeiInput, label) {
    var imei = sanitizeImei(imeiInput);
    if (!validateImei(imei)) return Promise.reject(new Error("IMEI invalide (14 ou 15 chiffres)"));
    var now = Date.now();
    var data = {
      imei: imei,
      ownerUid: uid,
      establishmentName: (profile && profile.establishmentName) || "",
      ownerName: (profile && profile.ownerName) || "",
      email: (profile && profile.email) || "",
      phone: (profile && profile.phone) || "",
      whatsapp: (profile && profile.whatsapp) || "",
      label: label || "Tablette principale",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      platform: typeof navigator !== "undefined" ? navigator.platform : "",
      registeredAt: now,
      lastSeenAt: now,
      status: "active"
    };
    return setDoc("tablets/" + imei, data, false).then(function () {
      rememberTabletImei(uid, imei);
      return data;
    });
  }

  function touchTabletLastSeen(uid, imeiInput) {
    var imei = sanitizeImei(imeiInput);
    if (!imei || !uid) return Promise.resolve();
    return patchDoc("tablets/" + imei, { lastSeenAt: Date.now(), ownerUid: uid }, ["lastSeenAt", "ownerUid"]).catch(function () {});
  }

  function listTabletsByOwner(uid) {
    return runQuery({
      from: [{ collectionId: "tablets" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "ownerUid" },
          op: "EQUAL",
          value: { stringValue: uid }
        }
      },
      limit: 50
    });
  }

  function listAllTablets() {
    return runQuery({ from: [{ collectionId: "tablets" }], limit: 500 });
  }

  function createSupportTicket(uid, profile, input) {
    var subject = String((input && input.subject) || "").trim();
    var message = String((input && input.message) || "").trim();
    if (!subject || !message) return Promise.reject(new Error("Sujet et message requis"));
    var now = Date.now();
    var data = {
      ownerUid: uid,
      establishmentName: (profile && profile.establishmentName) || "",
      ownerName: (profile && profile.ownerName) || "",
      email: (profile && profile.email) || "",
      whatsapp: (profile && profile.whatsapp) || "",
      tabletImei: input && input.tabletImei ? sanitizeImei(input.tabletImei) : "",
      subject: subject,
      message: message,
      status: "open",
      createdAt: now,
      updatedAt: now
    };
    return createDoc("supportTickets", data);
  }

  function listSupportTicketsByOwner(uid) {
    return runQuery({
      from: [{ collectionId: "supportTickets" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "ownerUid" },
          op: "EQUAL",
          value: { stringValue: uid }
        }
      },
      limit: 50
    }).then(function (docs) {
      docs.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      return docs;
    });
  }

  function listAllSupportTickets() {
    return runQuery({ from: [{ collectionId: "supportTickets" }], limit: 200 }).then(function (docs) {
      docs.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      return docs;
    });
  }

  function replySupportTicket(ticketId, adminUid, reply, status) {
    var text = String(reply || "").trim();
    if (!text) return Promise.reject(new Error("Réponse requise"));
    return patchDoc("supportTickets/" + ticketId, {
      adminReply: text,
      adminRepliedAt: Date.now(),
      adminUid: adminUid,
      status: status || "in_progress",
      updatedAt: Date.now()
    }, ["adminReply", "adminRepliedAt", "adminUid", "status", "updatedAt"]);
  }

  function pingRegisteredTablet(uid) {
    var imei = getRememberedTabletImei(uid);
    if (!imei) return Promise.resolve();
    return touchTabletLastSeen(uid, imei);
  }

  global.NACK_LIGHT.api = {
    xhr: xhr, getSession: getSession, saveSession: saveSession, clearSession: clearSession,
    signIn: signIn, signUp: signUp, resetPassword: resetPassword, refreshIdToken: refreshIdToken,
    getDoc: getDoc, listDocs: listDocs, createDoc: createDoc, patchDoc: patchDoc, deleteDoc: deleteDoc,
    setDoc: setDoc, getPublicDoc: getPublicDoc, runPublicQuery: runPublicQuery, runQuery: runQuery,
    _rawCreateDoc: createDocRaw, _rawPatchDoc: patchDocRaw, _rawDeleteDoc: deleteDocRaw, _rawSetDoc: setDocRaw,
    findAgentByCode: findAgentByCode, loginAffiliate: loginAffiliate, queryReferrals: queryReferrals,
    createPaymentLink: createPaymentLink, patchProfile: patchProfile, teamPath: teamPath,
    isAdmin: isAdmin, startPolling: startPolling, stopPolling: stopPolling, exportCsv: exportCsv,
    dataRoot: dataRoot, ownerDataRoot: ownerDataRoot, publicBase: publicBase, resolvePaymentProxy: resolvePaymentProxy,
    migrateEstablishmentCollectionsToProfile: migrateEstablishmentCollectionsToProfile,
    enrichProfileFromEstablishment: enrichProfileFromEstablishment,
    publicListDocs: publicListDocs, publicCreateDoc: publicCreateDoc, publicPatchDoc: publicPatchDoc,
    resolveAgentToken: resolveAgentToken,
    sanitizeImei: sanitizeImei, validateImei: validateImei,
    registerTablet: registerTablet, touchTabletLastSeen: touchTabletLastSeen,
    listTabletsByOwner: listTabletsByOwner, listAllTablets: listAllTablets,
    createSupportTicket: createSupportTicket, listSupportTicketsByOwner: listSupportTicketsByOwner,
    listAllSupportTickets: listAllSupportTickets, replySupportTicket: replySupportTicket,
    pingRegisteredTablet: pingRegisteredTablet, rememberTabletImei: rememberTabletImei,
    getRememberedTabletImei: getRememberedTabletImei,
    getProfile: function (uid) { return getDoc("profiles/" + uid); },
    getPublicProfile: function (uid) { return getPublicDoc("profiles/" + uid); },
    lightHref: function (hash) {
      var h = hash || "";
      if (h.charAt(0) !== "#") h = "#/" + h.replace(/^\//, "");
      return publicBase() + "/light/" + h;
    }
  };
})(window);
