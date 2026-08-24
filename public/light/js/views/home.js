(function (global) {
  function render(root, ctx) {
    var ui = global.NACK_LIGHT.ui;
    var icon = global.NACK_LIGHT.icon;
    var api = global.NACK_LIGHT.api;
    var est = global.NACK_LIGHT.establishment;
    var profile = ctx.profile || {};
    var stats = ctx.stats || { salesToday: 0, productsCount: 0, teamCount: 0 };
    var owner = profile.ownerName || "";
    var lbl = est && est.labels ? est.labels(profile) : { products: "Produits", stock: "Stock", sales: "Vente", team: "Équipe", welcome: "Bonjour" };

    var welcome = owner
      ? '<div class="lg-welcome-simple">' + ui.escapeHtml(lbl.welcome) + ', ' + ui.escapeHtml(owner) + '</div>'
      : "";

    root.innerHTML =
      welcome +
      '<div class="lg-stats">' +
        '<div class="lg-stat"><div class="lg-stat-label">' + ui.escapeHtml(lbl.sales) + ' du jour</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(stats.salesToday)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">' + ui.escapeHtml(lbl.products) + '</div><div class="lg-stat-value">' + ui.escapeHtml(String(stats.productsCount)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">' + ui.escapeHtml(lbl.team) + '</div><div class="lg-stat-value">' + ui.escapeHtml(String(stats.teamCount)) + '</div></div>' +
      '</div>' +
      '<div id="home-foodcost"></div>' +
      '<div id="home-boutique"></div>' +
      '<div class="lg-grid" id="home-menu">' +
        card("stock", lbl.stock, "package", "stock") +
        card("sales", lbl.sales, "cart", "sales") +
        card("reports", "Rapport", "chart", "reports") +
        card("team", lbl.team, "users", "team") +
        card("events", "Événements", "calendar", "events") +
        card("customers", "Clients", "heart", "customers") +
        card("notifications", "Notifications", "bell", "notifications") +
        card("profile", "Mon Profil", "user", "profile") +
        (ctx.isAdmin ? card("admin", "Administration", "shield", "sales") : "") +
        card("logout", "Déconnexion", "logout", "logout") +
      '</div>';

    loadFoodCost(ctx, profile);
    paintBoutiqueHub(profile, lbl);
  }

  function loadFoodCost(ctx, profile) {
    var el = document.getElementById("home-foodcost");
    if (!el || !ctx.uid) return;
    if (global.NACK_LIGHT.establishment && global.NACK_LIGHT.establishment.isShopProfile(profile)) {
      el.innerHTML = "";
      return;
    }
    var api = global.NACK_LIGHT.api;
    api.listDocs(api.dataRoot(ctx.profile, ctx.uid) + "/products", 200).then(function (docs) {
      var rows = [];
      for (var i = 0; i < (docs || []).length; i++) {
        var p = docs[i];
        if (p.foodCost != null && Number(p.price) > 0) {
          var fc = Number(p.foodCost) || 0;
          var price = Number(p.price) || 0;
          var pct = Math.round((fc / price) * 100);
          rows.push({ name: p.name, pct: pct, margin: price - fc });
        }
      }
      if (!rows.length) { el.innerHTML = ""; return; }
      rows.sort(function (a, b) { return b.pct - a.pct; });
      var html = '<div class="lg-section-title">Rentabilité plats</div><div class="lg-card">';
      for (var j = 0; j < rows.length && j < 5; j++) {
        html += '<div class="lg-profile-row"><span>' + global.NACK_LIGHT.ui.escapeHtml(rows[j].name) + '</span><span>Food cost ' + rows[j].pct + '%</span></div>';
      }
      html += '</div>';
      el.innerHTML = html;
    }).catch(function () { el.innerHTML = ""; });
  }

  function paintBoutiqueHub(profile, lbl) {
    var el = document.getElementById("home-boutique");
    if (!el) return;
    var est = global.NACK_LIGHT.establishment;
    if (!est || !est.isShopProfile(profile)) { el.innerHTML = ""; return; }
    el.innerHTML =
      '<div class="lg-section-title">Raccourcis boutique</div>' +
      '<div class="lg-grid">' +
        hubCard("stock", lbl.stock) + hubCard("sales", lbl.sales) + hubCard("customers", "Clients") +
        hubCard("reports", "Statistiques") +
      '</div>';
  }

  function hubCard(view, label) {
    return '<div><div class="lg-menu-card" data-action="nav" data-arg="' + view + '" role="button"><div class="lg-menu-label">' + label + '</div></div></div>';
  }

  function card(key, label, iconName, tone) {
    var icon = global.NACK_LIGHT.icon(iconName, 26);
    var action = key === "logout" ? "logout" : "nav";
    var argAttr = key === "logout" ? "" : ' data-arg="' + key + '"';
    return (
      '<div><div class="lg-menu-card" data-action="' + action + '"' + argAttr + ' role="button">' +
        '<div class="lg-menu-icon ' + tone + '">' + icon + '</div>' +
        '<div class="lg-menu-label">' + label + '</div>' +
      '</div></div>'
    );
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.home = { render: render };
})(window);
