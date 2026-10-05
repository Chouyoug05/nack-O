(function (global) {
  var ui, api, state, pollId;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { token: ctx.token, agent: null, profile: null, root: root, events: [], tickets: [], eventId: null };

    root.innerHTML = '<div class="lg-loading">Connexion agent événement…</div>';
    api.resolveAgentToken(ctx.token).then(function (agent) {
      if (!agent) { root.innerHTML = '<div class="lg-empty">Lien agent invalide</div>'; return; }
      state.agent = agent;
      return api.getPublicProfile(agent.ownerUid).then(function (p) { state.profile = p; });
    }).then(function () {
      if (!state.agent) return;
      return loadEvents();
    }).then(function () {
      if (!state.agent) return;
      paintShell();
      if (state.events.length) {
        state.eventId = state.events[0].id;
        loadTickets();
        if (pollId) api.stopPolling(pollId);
        pollId = api.startPolling(loadTickets, 10000);
      }
    }).catch(function (err) {
      root.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message || "Erreur") + '</div>';
    });
  }

  function dataRoot() {
    return api.ownerDataRoot(state.agent.ownerUid, state.profile);
  }

  function loadEvents() {
    return api.publicListDocs(dataRoot() + "/events", 50).then(function (docs) {
      state.events = docs || [];
    });
  }

  function loadTickets() {
    if (!state.eventId) return;
    api.publicListDocs(dataRoot() + "/events/" + state.eventId + "/tickets", 200).then(function (docs) {
      docs = docs || [];
      docs.sort(function (a, b) { return (Number(b.purchaseDate || b.createdAt) || 0) - (Number(a.purchaseDate || a.createdAt) || 0); });
      state.tickets = docs;
      paintTickets();
    }).catch(function () {});
  }

  function paintShell() {
    var evBtns = "";
    for (var i = 0; i < state.events.length; i++) {
      var e = state.events[i];
      evBtns += '<button type="button" class="lg-tab' + (state.eventId === e.id ? " active" : "") + '" data-ev="' + ui.escapeHtml(e.id) + '">' +
        ui.escapeHtml(e.title || "Événement") + '</button>';
    }
    state.root.innerHTML =
      '<div class="lg-team-header">' +
        '<div><div class="lg-card-title">' + ui.escapeHtml(state.agent.agentName) + '</div>' +
        '<div class="lg-card-desc">Agent Événement</div></div>' +
        '<a class="lg-btn lg-btn-secondary lg-btn-sm" href="' + ui.escapeHtml(api.lightHref("")) + '">Accueil</a>' +
      '</div>' +
      '<div class="lg-section-title">Sélectionner un événement</div>' +
      '<div class="lg-tabs" style="flex-wrap:wrap">' + (evBtns || '<span class="lg-card-desc">Aucun événement</span>') + '</div>' +
      '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" id="ae-scan" style="margin:12px 0" ' + (state.eventId ? '' : 'disabled') + '>Scanner un billet</button>' +
      '<div id="ae-scan-slot"></div>' +
      '<div id="ae-tickets"></div>';
    var tabs = state.root.querySelectorAll("[data-ev]");
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].onclick = function () {
        stopScan();
        state.eventId = this.getAttribute("data-ev");
        paintShell();
        loadTickets();
      };
    }
    var scanBtn = state.root.querySelector("#ae-scan");
    if (scanBtn) scanBtn.onclick = startScan;
    paintTickets();
  }

  var scanStream = null, scanRaf = null;

  function stopScan() {
    if (scanRaf) { cancelAnimationFrame(scanRaf); scanRaf = null; }
    if (scanStream) {
      try { scanStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      scanStream = null;
    }
    var slot = state.root && state.root.querySelector("#ae-scan-slot");
    if (slot) slot.innerHTML = "";
  }

  function startScan() {
    var slot = state.root.querySelector("#ae-scan-slot");
    if (!slot) return;
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      slot.innerHTML = '<div class="lg-card-desc" style="color:#b91c1c;margin-bottom:8px">Le scan caméra n\'est pas supporté sur cet appareil. Utilisez la validation manuelle ci-dessous.</div>';
      return;
    }
    slot.innerHTML = '<div style="text-align:center">' +
      '<video id="ae-video" autoplay muted playsinline style="width:100%;max-width:360px;border-radius:12px;background:#000"></video>' +
      '<div class="lg-card-desc" style="margin-top:8px">Visez le QR code du billet…</div>' +
      '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" id="ae-scan-stop" style="margin-top:8px">Arrêter</button>' +
    '</div>';
    var stopBtn = slot.querySelector("#ae-scan-stop");
    if (stopBtn) stopBtn.onclick = stopScan;

    var detector;
    try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); }
    catch (e) { detector = new window.BarcodeDetector(); }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
      scanStream = stream;
      var video = slot.querySelector("#ae-video");
      if (!video) { stopScan(); return; }
      video.srcObject = stream;
      var detect = function () {
        if (!scanStream) return;
        detector.detect(video).then(function (codes) {
          if (codes && codes.length) {
            var value = codes[0].rawValue || "";
            var match = null;
            for (var i = 0; i < state.tickets.length; i++) {
              if (state.tickets[i].qrCode === value || state.tickets[i].id === value) { match = state.tickets[i]; break; }
            }
            stopScan();
            if (!match) { ui.toast("Billet introuvable pour cet événement", "error"); return; }
            if (match.validated) { ui.toast("Billet déjà validé", "error"); return; }
            toggleTicket(match.id, true);
            return;
          }
          scanRaf = requestAnimationFrame(detect);
        }).catch(function () { scanRaf = requestAnimationFrame(detect); });
      };
      detect();
    }).catch(function (err) {
      slot.innerHTML = '<div class="lg-card-desc" style="color:#b91c1c;margin-bottom:8px">Caméra indisponible : ' + ui.escapeHtml((err && err.message) || "accès refusé") + '</div>';
    });
  }

  function paintTickets() {
    var el = state.root.querySelector("#ae-tickets");
    if (!el) return;
    if (!state.eventId) {
      el.innerHTML = '<div class="lg-empty">Choisissez un événement</div>';
      return;
    }
    if (!state.tickets.length) {
      el.innerHTML = '<div class="lg-empty">Aucun billet pour cet événement</div>';
      return;
    }
    var html = '<div class="lg-section-title">Billets (' + state.tickets.length + ')</div>';
    for (var i = 0; i < state.tickets.length; i++) {
      var t = state.tickets[i];
      var validated = !!t.validated;
      html +=
        '<div class="lg-card">' +
          '<div class="lg-card-title">' + ui.escapeHtml(t.customerName || "Client") + '</div>' +
          '<div class="lg-card-desc">' + ui.escapeHtml(t.customerPhone || t.customerEmail || "—") + '</div>' +
          '<div class="lg-card-desc">Qté: ' + (Number(t.quantity) || 1) + ' • ' + ui.escapeHtml(ui.formatMoney(t.totalAmount)) + '</div>' +
          '<div class="lg-card-desc">Statut: <strong>' + (validated ? "Validé" : (t.status || "payé")) + '</strong></div>' +
          '<div class="lg-row-actions" style="margin-top:10px">' +
            (validated
              ? '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-inv="' + ui.escapeHtml(t.id) + '">Invalider</button>'
              : '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-val="' + ui.escapeHtml(t.id) + '">Valider entrée</button>') +
          '</div></div>';
    }
    el.innerHTML = html;
    var vals = el.querySelectorAll("[data-val]");
    for (var j = 0; j < vals.length; j++) vals[j].onclick = function () { toggleTicket(this.getAttribute("data-val"), true); };
    var invs = el.querySelectorAll("[data-inv]");
    for (var k = 0; k < invs.length; k++) invs[k].onclick = function () { toggleTicket(this.getAttribute("data-inv"), false); };
  }

  function toggleTicket(id, validated) {
    var path = dataRoot() + "/events/" + state.eventId + "/tickets/" + id;
    var payload = { validated: validated, validatedAt: validated ? Date.now() : null, updatedAt: Date.now() };
    var session = api.getSession();
    var chain;
    if (session && session.uid === state.agent.ownerUid) {
      chain = api.patchDoc(path, payload, ["validated", "validatedAt", "updatedAt"]);
    } else {
      chain = api.publicPatchDoc(path, payload, ["validated", "validatedAt", "updatedAt"]);
    }
    chain.then(function () {
      ui.toast(validated ? "Billet validé" : "Validation annulée", "ok");
      loadTickets();
    }).catch(function (err) {
      ui.toast(err.message || "Validation impossible (connexion gérant requise)", "error");
    });
  }

  global.NACK_LIGHT.interfaces = global.NACK_LIGHT.interfaces || {};
  global.NACK_LIGHT.interfaces.agentEvent = { render: render };
})(window);
