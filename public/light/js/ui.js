(function (global) {
  var toastTimer = null;
  var pendingManagerAction = null;
  var lastTapAt = 0;
  var lastTapKey = "";

  function $(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatMoney(n) {
    var v = Math.round(Number(n) || 0);
    try { return v.toLocaleString("fr-FR") + " XAF"; }
    catch (e) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " XAF"; }
  }

  function formatDate(ts) {
    try {
      var d = new Date(Number(ts) || ts);
      if (isNaN(d.getTime())) return String(ts || "—");
      return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return "—"; }
  }

  function showEl(el) {
    if (!el) return;
    el.className = String(el.className || "").replace(/\blg-hidden\b/g, "").replace(/\s+/g, " ");
    el.style.display = "";
  }
  function hideEl(el) {
    if (!el) return;
    if (String(el.className || "").indexOf("lg-hidden") === -1) el.className += " lg-hidden";
    el.style.display = "none";
  }

  function toast(message, type) {
    var el = $("lg-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "lg-toast";
      el.className = "lg-toast lg-hidden";
      document.body.appendChild(el);
    }
    el.className = "lg-toast" + (type === "error" ? " error" : type === "ok" ? " ok" : "");
    el.textContent = message;
    showEl(el);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { hideEl(el); }, 2800);
  }

  function openModal(id) {
    showEl($(id + "-overlay"));
    showEl($(id));
    try { document.body.style.overflow = "hidden"; } catch (e) {}
  }
  function closeModal(id) {
    hideEl($(id + "-overlay"));
    hideEl($(id));
    try { document.body.style.overflow = ""; } catch (e) {}
  }

  function closestAction(start) {
    var el = start;
    while (el && el !== document && el !== document.body) {
      if (el.getAttribute) {
        var action = el.getAttribute("data-action");
        if (action) return el;
      }
      el = el.parentNode;
    }
    return null;
  }

  function shouldIgnoreTap(e) {
    var t = e.target;
    if (!t) return true;
    var tag = (t.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "OPTION") return true;
    return false;
  }

  function debounceTap(key) {
    var now = Date.now();
    if (key === lastTapKey && now - lastTapAt < 500) return false;
    lastTapAt = now;
    lastTapKey = key;
    return true;
  }

  function installGlobalTaps(onAction) {
    if (document.documentElement.getAttribute("data-nack-taps") === "1") return;
    document.documentElement.setAttribute("data-nack-taps", "1");

    function handle(e) {
      if (shouldIgnoreTap(e)) return;
      var el = closestAction(e.target);
      if (!el) return;
      if (el.getAttribute("disabled") != null) return;
      var action = el.getAttribute("data-action");
      var arg = el.getAttribute("data-arg") || "";
      var key = action + "|" + arg + "|" + (el.id || "");
      if (!debounceTap(key)) {
        if (e.preventDefault) e.preventDefault();
        return;
      }
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      try { onAction(action, arg, el, e); }
      catch (err) {
        console.error("[NACK Light] action", action, err);
        toast((err && err.message) || "Erreur bouton", "error");
      }
    }

    document.addEventListener("touchend", function (e) {
      if (!closestAction(e.target)) return;
      handle(e);
    }, false);
    document.addEventListener("click", function (e) {
      if (!closestAction(e.target)) return;
      handle(e);
    }, false);
  }

  function requireManagerAuth(profile, action) {
    if (!profile || !profile.managerPinHash) { action(); return; }
    var until = 0;
    try { until = Number(sessionStorage.getItem(global.NACK_LIGHT.STORAGE_KEYS.managerAuthUntil) || 0); } catch (e) {}
    if (Date.now() < until) { action(); return; }
    pendingManagerAction = action;
    var input = $("mgr-code-input");
    if (input) input.value = "";
    openModal("modal-manager");
  }

  function submitManagerAuth(profile) {
    var input = $("mgr-code-input");
    var code = input ? String(input.value || "") : "";
    if (!code) { toast("Code requis", "error"); return; }
    if (!profile || !profile.managerPinHash) {
      closeModal("modal-manager");
      var fn0 = pendingManagerAction; pendingManagerAction = null; if (fn0) fn0();
      return;
    }
    var hash = global.NACK_LIGHT.sha256Hex(code);
    if (hash !== profile.managerPinHash) { toast("Code incorrect", "error"); return; }
    var until = Date.now() + global.NACK_LIGHT.AUTH_WINDOW_MS;
    try { sessionStorage.setItem(global.NACK_LIGHT.STORAGE_KEYS.managerAuthUntil, String(until)); } catch (e) {}
    closeModal("modal-manager");
    toast("Vérification réussie", "ok");
    var fn = pendingManagerAction; pendingManagerAction = null; if (fn) fn();
  }

  function setLoading(el, on) {
    if (!el) return;
    if (on) {
      el.setAttribute("data-prev", el.innerHTML);
      el.innerHTML = "…";
      el.setAttribute("disabled", "disabled");
    } else {
      var prev = el.getAttribute("data-prev");
      if (prev != null) el.innerHTML = prev;
      el.removeAttribute("disabled");
    }
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () {
          toast("Lien copié", "ok");
        }).catch(function () { fallbackCopy(text); });
      }
    } catch (e) {}
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Lien copié", "ok");
    } catch (e) {
      toast("Copiez manuellement : " + text, "error");
    }
  }

  global.NACK_LIGHT.ui = {
    $: $, escapeHtml: escapeHtml, formatMoney: formatMoney, formatDate: formatDate,
    toast: toast, openModal: openModal, closeModal: closeModal,
    showEl: showEl, hideEl: hideEl,
    installGlobalTaps: installGlobalTaps,
    requireManagerAuth: requireManagerAuth, submitManagerAuth: submitManagerAuth,
    setLoading: setLoading, copyText: copyText
  };
})(window);
