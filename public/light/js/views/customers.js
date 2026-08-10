(function (global) {
  var ui, api, state;

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { ctx: ctx, customers: [], query: "" };
    root.innerHTML =
      '<div class="lg-search"><input class="lg-input" id="cust-search" type="search" placeholder="Rechercher un client…"></div>' +
      '<div id="cust-summary" class="lg-stats"></div>' +
      '<div id="cust-list" class="lg-loading">Chargement des clients…</div>';
    var search = ui.$("cust-search");
    if (search) {
      search.oninput = function () {
        state.query = String(search.value || "").toLowerCase();
        paint();
      };
    }
    load();
  }

  function customersPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/customers"; }

  function load() {
    api.listDocs(customersPath(), 200).then(function (docs) {
      state.customers = docs || [];
      state.customers.sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      paint();
    }).catch(function (err) {
      var el = ui.$("cust-list");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function paint() {
    var q = state.query || "";
    var filtered = [];
    var pointsTotal = 0;
    for (var i = 0; i < state.customers.length; i++) {
      var c = state.customers[i];
      pointsTotal += Number(c.points) || 0;
      var hay = ((c.name || "") + " " + (c.phone || "")).toLowerCase();
      if (!q || hay.indexOf(q) !== -1) filtered.push(c);
    }
    var sum = ui.$("cust-summary");
    if (sum) {
      sum.innerHTML =
        '<div class="lg-stat"><div class="lg-stat-label">Clients</div><div class="lg-stat-value">' + state.customers.length + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Points fidélité</div><div class="lg-stat-value">' + pointsTotal + '</div></div>';
    }
    var list = ui.$("cust-list");
    if (!list) return;
    if (!filtered.length) {
      list.innerHTML = '<div class="lg-empty">Aucun client</div>';
      return;
    }
    var html = "";
    for (var j = 0; j < filtered.length; j++) {
      var cust = filtered[j];
      html +=
        '<div class="lg-list-item">' +
          '<div class="lg-list-item-main">' +
            '<div class="lg-list-item-title">' + ui.escapeHtml(cust.name || "Client") + '</div>' +
            '<div class="lg-list-item-meta">' + ui.escapeHtml(cust.phone || "—") +
              (cust.loyaltyType ? " · " + ui.escapeHtml(cust.loyaltyType) : "") +
            '</div>' +
          '</div>' +
          '<span class="lg-badge lg-badge-ok">' + (Number(cust.points) || 0) + ' pts</span>' +
        '</div>';
    }
    list.innerHTML = html;
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.customers = { render: render };
})(window);
