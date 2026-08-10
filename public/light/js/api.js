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
        req.open(method, url, true);
        req.timeout = 30000;
        var h = headers || {};
        for (var k in h) {
          if (Object.prototype.hasOwnProperty.call(h, k)) req.setRequestHeader(k, h[k]);
        }
        req.onreadystatechange = function () {
          if (req.readyState !== 4) return;
          var text = req.responseText || "";
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
          if (req.status >= 200 && req.status < 300) resolve(data);
          else {
            var msg = (data && data.error && (data.error.message || data.error.status)) || ("HTTP " + req.status);
            reject(new Error(msg));
          }
        };
        req.onerror = function () { reject(new Error("Erreur réseau")); };
        req.ontimeout = function () { reject(new Error("Délai dépassé")); };
        if (body != null) {
          if (typeof body === "string") req.send(body);
          else {
            req.setRequestHeader("Content-Type", "application/json");
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
    if (profile && profile.activeEstablishmentId) return "establishments/" + profile.activeEstablishmentId;
    return "profiles/" + ownerUid;
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
      return xhr("GET", FS_BASE + "/" + path, null, authHeaders(token)).then(docToObj);
    });
  }

  function listDocs(path, pageSize) {
    var qs = pageSize ? ("?pageSize=" + pageSize) : "";
    return withToken(function (token) {
      return xhr("GET", FS_BASE + "/" + path + qs, null, authHeaders(token)).then(function (res) {
        var docs = res.documents || [], out = [];
        for (var i = 0; i < docs.length; i++) out.push(docToObj(docs[i]));
        return out;
      });
    });
  }

  function createDoc(path, data) {
    return withToken(function (token) {
      return xhr("POST", FS_BASE + "/" + path, { fields: toFsFields(data) }, authHeaders(token)).then(docToObj);
    });
  }

  function patchDoc(path, data, maskFields) {
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

  function deleteDoc(path) {
    return withToken(function (token) {
      return xhr("DELETE", FS_BASE + "/" + path, null, authHeaders(token));
    });
  }

  function dataRoot(profile, uid) {
    if (profile && profile.activeEstablishmentId) return "establishments/" + profile.activeEstablishmentId;
    return "profiles/" + uid;
  }

  function publicBase() {
    try {
      var origin = window.location.origin || "";
      // /light/ → racine app
      var path = window.location.pathname || "";
      var idx = path.indexOf("/light");
      var basePath = idx >= 0 ? path.substring(0, idx) : "";
      if (basePath && basePath.charAt(basePath.length - 1) === "/") basePath = basePath.slice(0, -1);
      return origin + basePath;
    } catch (e) { return ""; }
  }

  function resolvePaymentProxy() {
    var base = publicBase();
    return base + "/.netlify/functions/create-payment-link";
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

  function createPaymentLink(params) {
    return xhr("POST", resolvePaymentProxy(), params, { "Content-Type": "application/json" }).then(function (res) {
      if (typeof res === "string") {
        try { res = JSON.parse(res); } catch (e) { throw new Error(res); }
      }
      if (res && res.link) return res.link;
      throw new Error("Lien de paiement introuvable");
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
    findAgentByCode: findAgentByCode, loginAffiliate: loginAffiliate, queryReferrals: queryReferrals,
    createPaymentLink: createPaymentLink, patchProfile: patchProfile, teamPath: teamPath,
    isAdmin: isAdmin, startPolling: startPolling, stopPolling: stopPolling, exportCsv: exportCsv,
    dataRoot: dataRoot, ownerDataRoot: ownerDataRoot, publicBase: publicBase, resolvePaymentProxy: resolvePaymentProxy,
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
