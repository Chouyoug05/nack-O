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
    var fields = doc.fields || {};
    for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) obj[k] = fromFsValue(fields[k]);
    return obj;
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

  global.NACK_LIGHT.api = {
    xhr: xhr, getSession: getSession, saveSession: saveSession, clearSession: clearSession,
    signIn: signIn, refreshIdToken: refreshIdToken,
    getDoc: getDoc, listDocs: listDocs, createDoc: createDoc, patchDoc: patchDoc, deleteDoc: deleteDoc,
    dataRoot: dataRoot, publicBase: publicBase,
    getProfile: function (uid) { return getDoc("profiles/" + uid); }
  };
})(window);
