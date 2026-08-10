(function (global) {
  var ui, api, state, icon;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    state = { ctx: ctx, events: [], root: root };
    root.innerHTML =
      '<div class="lg-row-actions">' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm lg-btn-icon" data-action="add-event">' + icon("plus", 16) + ' Nouvel événement</button>' +
      '</div>' +
      '<div id="events-list" class="lg-loading">Chargement des événements…</div>' +
      '<button type="button" class="lg-fab" data-action="add-event" aria-label="Ajouter">' + icon("plus", 28) + '</button>';
    loadEvents();
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
      html +=
        '<div class="lg-card">' +
          '<div class="lg-card-title lg-btn-icon">' + icon("calendar", 18) + ' ' + ui.escapeHtml(ev.title || "Événement") + '</div>' +
          (ev.description ? '<div class="lg-card-desc" style="margin-top:4px">' + ui.escapeHtml(ev.description) + '</div>' : '') +
          '<div class="lg-card-desc" style="margin-top:6px">' +
            icon("calendar", 14) + ' ' + ui.escapeHtml(ev.date || "") +
            (ev.time ? " · " + ui.escapeHtml(ev.time) : "") +
            (ev.location ? '<br>' + icon("map", 14) + ' ' + ui.escapeHtml(ev.location) : "") +
          '</div>' +
          '<div style="margin-top:8px;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;align-items:center">' +
            '<span style="font-weight:700;color:#dc2626">' + icon("ticket", 16) + ' ' + ui.escapeHtml(ui.formatMoney(ev.ticketPrice)) + '</span>' +
            (ev.maxCapacity ? '<span class="lg-badge">' + ui.escapeHtml(String(ev.maxCapacity)) + ' places</span>' : '') +
          '</div></div>';
    }
    el.innerHTML = html;
  }

  function submitEvent() {
    var title = (ui.$("ev-title") && ui.$("ev-title").value || "").trim();
    var description = (ui.$("ev-desc") && ui.$("ev-desc").value || "").trim();
    var date = (ui.$("ev-date") && ui.$("ev-date").value || "").trim();
    var time = (ui.$("ev-time") && ui.$("ev-time").value || "").trim();
    var location = (ui.$("ev-location") && ui.$("ev-location").value || "").trim();
    var maxCapacity = Number(ui.$("ev-capacity") && ui.$("ev-capacity").value);
    var ticketPrice = Number(ui.$("ev-price") && ui.$("ev-price").value);
    if (!title || !date || isNaN(ticketPrice)) {
      ui.toast("Titre, date et prix requis", "error");
      return;
    }
    var btn = ui.$("ev-submit");
    ui.setLoading(btn, true);
    var payload = {
      title: title, description: description, date: date, time: time, location: location,
      ticketPrice: ticketPrice, currency: "XAF", isActive: true,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    if (!isNaN(maxCapacity) && maxCapacity > 0) payload.maxCapacity = maxCapacity;
    api.createDoc(eventsPath(), payload).then(function () {
      ui.closeModal("modal-event");
      ui.toast("Événement créé", "ok");
      loadEvents();
    }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); })
      .then(function () { ui.setLoading(btn, false); });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.events = { render: render, submitEvent: submitEvent };
})(window);
