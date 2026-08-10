(function (global) {
  function render(root, ctx) {
    var ui = global.NACK_LIGHT.ui;
    var icon = global.NACK_LIGHT.icon;
    var api = global.NACK_LIGHT.api;
    var profile = ctx.profile || {};
    var stats = ctx.stats || { salesToday: 0, productsCount: 0, teamCount: 0 };
    var est = profile.establishmentName || "NACK Pro";
    var owner = profile.ownerName || "";
    var logo = profile.logoUrl;
    var letter = (est.charAt(0) || "N").toUpperCase();

    var welcome =
      '<div class="lg-welcome">' +
        (logo
          ? '<img class="lg-welcome-est" src="' + ui.escapeHtml(logo) + '" alt="">'
          : '<div class="lg-welcome-est-letter">' + ui.escapeHtml(letter) + '</div>') +
        '<div><div style="font-weight:700;font-size:1rem">' + ui.escapeHtml(est) + '</div>' +
        (owner ? '<div class="lg-card-desc">Bonjour, ' + ui.escapeHtml(owner) + '</div>' : '') +
        '</div></div>';

    root.innerHTML =
      welcome +
      '<div class="lg-stats">' +
        '<div class="lg-stat"><div class="lg-stat-label">Vente du jour</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(stats.salesToday)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Produits</div><div class="lg-stat-value">' + ui.escapeHtml(String(stats.productsCount)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Équipe</div><div class="lg-stat-value">' + ui.escapeHtml(String(stats.teamCount)) + '</div></div>' +
      '</div>' +
      '<div id="home-foodcost"></div>' +
      '<div id="home-boutique"></div>' +
      '<div class="lg-grid" id="home-menu">' +
        card("stock", "Stock", "package", "stock") +
        card("sales", "Vente", "cart", "sales") +
        card("reports", "Rapport", "chart", "reports") +
        card("team", "Équipe", "users", "team") +
        card("menu", "Menu Digital", "qrcode", "menu") +
        card("events", "Événements", "calendar", "events") +
        card("customers", "Clients", "heart", "customers") +
        card("notifications", "Notifications", "clock", "reports") +
        card("profile", "Mon Profil", "user", "profile") +
        (ctx.isAdmin ? card("admin", "Administration", "shield", "sales") : "") +
        card("logout", "Déconnexion", "logout", "logout") +
      '</div>';

    loadFoodCost(ctx);
    paintBoutiqueHub(profile);
  }

  function loadFoodCost(ctx) {
    var el = document.getElementById("home-foodcost");
    if (!el || !ctx.uid) return;
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

  function paintBoutiqueHub(profile) {
    var el = document.getElementById("home-boutique");
    if (!el) return;
    var type = (profile.establishmentType || "").toLowerCase();
    if (type.indexOf("boutique") === -1 && type.indexOf("commerce") === -1) { el.innerHTML = ""; return; }
    el.innerHTML =
      '<div class="lg-section-title">Boutique — raccourcis</div>' +
      '<div class="lg-grid">' +
        hubCard("stock", "Produits") + hubCard("sales", "Ventes") + hubCard("customers", "Clients") +
        hubCard("reports", "Statistiques") + hubCard("menu", "Boutique en ligne") +
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
