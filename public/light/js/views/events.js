(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { ctx: ctx, events: [], root: root };
    root.innerHTML =
      '<div class="lg-row-actions"><button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="add-event">+ Événement</button></div>' +
      '<div id="events-list" class="lg-loading">Chargement des événements…</div>' +
      '<button type="button" class="lg-fab" data-action="add-event" aria-label="Ajouter">+</button>';
    loadEvents();
  }

  function eventsPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/events"; }

  function loadEvents() {
    api.listDocs(eventsPath(), 100).then(function (docs) {
      state.events = docs || [];
      state.events.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
      paint();
    }).catch(function (err) {
      var el = ui.$("events-list");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function paint() {
    var el = ui.$("events-list");
    if (!el) return;
    if (!state.events.length) { el.innerHTML = '<div class="lg-empty">Aucun événement</div>'; return; }
    var html = "";
    for (var i = 0; i < state.events.length; i++) {
      var ev = state.events[i];
      html +=
        '<div class="lg-card">' +
          '<div class="lg-card-title">' + ui.escapeHtml(ev.title || "Événement") + '</div>' +
          '<div class="lg-card-desc">' +
            ui.escapeHtml(ev.date || "") + (ev.time ? " · " + ui.escapeHtml(ev.time) : "") +
            (ev.location ? "<br>" + ui.escapeHtml(ev.location) : "") +
          '</div>' +
          '<div style="margin-top:8px;font-weight:700;color:#dc2626">' +
            ui.escapeHtml(ui.formatMoney(ev.ticketPrice)) + " / billet" +
          '</div>' +
        '</div>';
    }
    el.innerHTML = html;
  }

  function submitEvent() {
    if (!state || !state.ctx) { ui.toast("Ouvrez Événements", "error"); return; }
    var title = (ui.$("ev-title") && ui.$("ev-title").value || "").trim();
    var date = (ui.$("ev-date") && ui.$("ev-date").value || "").trim();
    var time = (ui.$("ev-time") && ui.$("ev-time").value || "").trim();
    var location = (ui.$("ev-location") && ui.$("ev-location").value || "").trim();
    var ticketPrice = Number(ui.$("ev-price") && ui.$("ev-price").value);
    if (!title || !date || isNaN(ticketPrice)) { ui.toast("Titre, date et prix requis", "error"); return; }
    var btn = ui.$("ev-submit");
    ui.setLoading(btn, true);
    api.createDoc(eventsPath(), {
      title: title, date: date, time: time, location: location, ticketPrice: ticketPrice,
      createdAt: Date.now(), updatedAt: Date.now()
    }).then(function () {
      ui.closeModal("modal-event");
      ui.toast("Événement créé", "ok");
      loadEvents();
    }).catch(function (err) {
      ui.toast(err.message || "Erreur", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.events = { render: render, submitEvent: submitEvent };
})(window);
