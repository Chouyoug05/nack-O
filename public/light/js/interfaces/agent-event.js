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
      '<div id="ae-tickets"></div>';
    var tabs = state.root.querySelectorAll("[data-ev]");
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].onclick = function () {
        state.eventId = this.getAttribute("data-ev");
        paintShell();
        loadTickets();
      };
    }
    paintTickets();
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
