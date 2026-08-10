(function (global) {
  var ui, api, state, icon, sub;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    sub = global.NACK_LIGHT.subscription || {};
    state = { ctx: ctx, events: [], editingId: null, root: root };
    ensureEventModal();
    root.innerHTML =
      '<div class="lg-row-actions">' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm lg-btn-icon" data-action="add-event">' + icon("plus", 16) + ' Nouvel événement</button>' +
      '</div>' +
      '<div id="events-list" class="lg-loading">Chargement des événements…</div>' +
      '<button type="button" class="lg-fab" data-action="add-event" aria-label="Ajouter">' + icon("plus", 28) + '</button>';
    loadEvents();
  }

  function ensureEventModal() {
    if (ui.$("modal-event-edit")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div id="modal-event-participants-overlay" class="lg-modal-overlay lg-hidden" data-action="close-modal" data-arg="modal-event-participants" style="display:none"></div>' +
      '<div id="modal-event-participants" class="lg-modal lg-hidden" style="display:none"><button type="button" class="lg-modal-close" data-action="close-modal" data-arg="modal-event-participants">×</button>' +
        '<h2>Participants</h2><div id="event-participants-body"></div></div>';
    document.body.appendChild(wrap);
    var evModal = ui.$("modal-event");
    if (evModal && !ui.$("ev-image")) {
      var imgField = document.createElement("div");
      imgField.className = "lg-field";
      imgField.innerHTML = '<label class="lg-label" for="ev-image">Image (URL)</label><input class="lg-input" id="ev-image" />';
      var cap = ui.$("ev-capacity");
      if (cap && cap.parentNode) cap.parentNode.parentNode.insertBefore(imgField, cap.parentNode);
      var hid = document.createElement("input");
      hid.type = "hidden"; hid.id = "ev-edit-id"; hid.value = "";
      var form = ui.$("event-form");
      if (form) form.insertBefore(hid, form.firstChild);
    }
  }

  function eventsPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/events"; }

  function loadEvents() {
    api.listDocs(eventsPath(), 100).then(function (docs) {
      state.events = docs || [];
      state.events.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      paint();
    }).catch(function (err) {
      ui.$("events-list").innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function publicLink(ev) {
    return api.publicBase() + "/event/" + (ev.id || "");
  }

  function paint() {
    var el = ui.$("events-list");
    if (!el) return;
    if (!state.events.length) {
      el.innerHTML = '<div class="lg-empty">Aucun événement<br><span class="lg-card-desc">Créez votre premier événement</span></div>';
      return;
    }
    var html = "";
    for (var i = 0; i < state.events.length; i++) {
      var ev = state.events[i];
      var link = ev.shareableLink || publicLink(ev);
      html +=
        '<div class="lg-card">' +
          (ev.imageUrl ? '<img src="' + ui.escapeHtml(ev.imageUrl) + '" alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:10px;margin-bottom:8px">' : '') +
          '<div class="lg-card-title lg-btn-icon">' + icon("calendar", 18) + ' ' + ui.escapeHtml(ev.title || "Événement") + '</div>' +
          (ev.description ? '<div class="lg-card-desc" style="margin-top:4px">' + ui.escapeHtml(ev.description) + '</div>' : '') +
          '<div class="lg-card-desc" style="margin-top:6px">' +
            icon("calendar", 14) + ' ' + ui.escapeHtml(ev.date || "") +
            (ev.time ? " · " + ui.escapeHtml(ev.time) : "") +
            (ev.location ? '<br>' + icon("map", 14) + ' ' + ui.escapeHtml(ev.location) : "") +
          '</div>' +
          '<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-weight:700;color:#dc2626">' + icon("ticket", 16) + ' ' + ui.escapeHtml(ui.formatMoney(ev.ticketPrice)) + '</span>' +
            (ev.maxCapacity ? '<span class="lg-badge">' + ui.escapeHtml(String(ev.maxCapacity)) + ' places</span>' : '') +
          '</div>' +
          '<div class="lg-row-actions" style="margin-top:10px">' +
            '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="event-participants" data-arg="' + ui.escapeHtml(ev.id) + '">Participants</button>' +
            '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="copy-text" data-arg="' + ui.escapeHtml(link) + '">Lien public</button>' +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="event-edit" data-arg="' + ui.escapeHtml(ev.id) + '">Modifier</button>' +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="event-del" data-arg="' + ui.escapeHtml(ev.id) + '">Suppr.</button>' +
            '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="event-pay-extra" data-arg="' + ui.escapeHtml(ev.id) + '">Payer extra</button>' +
          '</div></div>';
    }
    el.innerHTML = html;
  }

  function findEvent(id) {
    for (var i = 0; i < state.events.length; i++) if (state.events[i].id === id) return state.events[i];
    return null;
  }

  function openEdit(id) {
    var ev = findEvent(id);
    if (!ev) return;
    state.editingId = id;
    ui.$("ev-edit-id").value = id;
    ui.$("ev-title").value = ev.title || "";
    ui.$("ev-desc").value = ev.description || "";
    ui.$("ev-date").value = ev.date || "";
    ui.$("ev-time").value = ev.time || "";
    ui.$("ev-location").value = ev.location || "";
    ui.$("ev-capacity").value = ev.maxCapacity || "";
    ui.$("ev-price").value = ev.ticketPrice || "";
    if (ui.$("ev-image")) ui.$("ev-image").value = ev.imageUrl || "";
    ui.$("ev-submit").textContent = "Enregistrer";
    ui.openModal("modal-event");
  }

  function submitEvent() {
    var editId = (ui.$("ev-edit-id") && ui.$("ev-edit-id").value) || state.editingId;
    var title = (ui.$("ev-title") && ui.$("ev-title").value || "").trim();
    var description = (ui.$("ev-desc") && ui.$("ev-desc").value || "").trim();
    var date = (ui.$("ev-date") && ui.$("ev-date").value || "").trim();
    var time = (ui.$("ev-time") && ui.$("ev-time").value || "").trim();
    var location = (ui.$("ev-location") && ui.$("ev-location").value || "").trim();
    var maxCapacity = Number(ui.$("ev-capacity") && ui.$("ev-capacity").value);
    var ticketPrice = Number(ui.$("ev-price") && ui.$("ev-price").value);
    var imageUrl = (ui.$("ev-image") && ui.$("ev-image").value || "").trim();
    if (!title || !date || isNaN(ticketPrice)) {
      ui.toast("Titre, date et prix requis", "error");
      return;
    }
    if (!editId && sub.canCreateEvent) {
      var check = sub.canCreateEvent(state.ctx.profile);
      if (check && check.needsPayment) {
        ui.toast("Limite atteinte — paiement extra requis", "error");
        return;
      }
    }
    var btn = ui.$("ev-submit");
    ui.setLoading(btn, true);
    var payload = {
      title: title, description: description, date: date, time: time, location: location,
      ticketPrice: ticketPrice, currency: "XAF", isActive: true, imageUrl: imageUrl || null,
      updatedAt: Date.now()
    };
    if (!isNaN(maxCapacity) && maxCapacity > 0) payload.maxCapacity = maxCapacity;
    var chain;
    if (editId) {
      chain = api.patchDoc(eventsPath() + "/" + editId, payload, Object.keys(payload));
    } else {
      payload.createdAt = Date.now();
      payload.shareableLink = "";
      chain = api.createDoc(eventsPath(), payload).then(function (doc) {
        if (doc && doc.id) {
          return api.patchDoc(eventsPath() + "/" + doc.id, { shareableLink: publicLink(doc) }, ["shareableLink"]);
        }
      });
    }
    chain.then(function () {
      ui.closeModal("modal-event");
      state.editingId = null;
      if (ui.$("ev-edit-id")) ui.$("ev-edit-id").value = "";
      if (ui.$("ev-submit")) ui.$("ev-submit").textContent = "Créer";
      ui.toast(editId ? "Événement modifié" : "Événement créé", "ok");
      loadEvents();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); })
      .then(function () { ui.setLoading(btn, false); });
  }

  function deleteEvent(id) {
    ui.requireManagerAuth(state.ctx.profile, function () {
      if (!confirm("Supprimer cet événement ?")) return;
      api.deleteDoc(eventsPath() + "/" + id).then(function () {
        ui.toast("Événement supprimé", "ok");
        loadEvents();
      }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
    });
  }

  function showParticipants(id) {
    var body = ui.$("event-participants-body");
    if (!body) return;
    body.innerHTML = '<div class="lg-loading">Chargement…</div>';
    ui.openModal("modal-event-participants");
    api.listDocs(eventsPath() + "/" + id + "/tickets", 200).then(function (docs) {
      if (!docs.length) {
        body.innerHTML = '<div class="lg-empty">Aucun participant</div>';
        return;
      }
      var html = "";
      for (var i = 0; i < docs.length; i++) {
        var t = docs[i];
        html += '<div class="lg-list-item"><div class="lg-list-item-main"><div class="lg-list-item-title">' +
          ui.escapeHtml(t.customerName || "Client") + '</div><div class="lg-list-item-meta">' +
          ui.escapeHtml(t.customerEmail || "") + " · " + (t.quantity || 1) + " billet(s) · " +
          ui.escapeHtml(t.status || "paid") + '</div></div><span>' + ui.escapeHtml(ui.formatMoney(t.totalAmount)) + '</span></div>';
      }
      body.innerHTML = html;
    }).catch(function () {
      body.innerHTML = '<div class="lg-empty">Impossible de charger les participants</div>';
    });
  }

  function payExtra() {
    var extra = 1000;
    if (sub.PLANS && sub.PLANS.transition) extra = sub.PLANS.transition.features.eventsExtraPrice || 1000;
    var base = (api.publicBase() || "https://nack.pro").replace("://www.nack.pro", "://nack.pro");
    var txnId = "EVT-EXTRA-" + Date.now();
    ui.toast("Préparation du paiement…", "ok");
    api.createPaymentLink({
      reference: "event-extra-" + txnId,
      redirect_success: base + "/payment/success?reference=event-extra&transactionId=" + encodeURIComponent(txnId),
      redirect_error: base + "/payment/error?transactionId=" + encodeURIComponent(txnId),
      amount: extra,
      logoURL: base + "/favicon.png",
      isTransfer: false
    }).then(function (link) {
      window.location.assign(link);
    }).catch(function (err) {
      ui.toast((err && err.message) || "Paiement indisponible", "error");
    });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.events = {
    render: render, submitEvent: submitEvent, openEdit: openEdit,
    deleteEvent: deleteEvent, showParticipants: showParticipants, payExtra: payExtra
  };
})(window);
