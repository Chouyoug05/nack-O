(function (global) {
  function render(root, ctx) {
    var ui = global.NACK_LIGHT.ui;
    var icon = global.NACK_LIGHT.icon;
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
      '<div class="lg-grid" id="home-menu">' +
        card("stock", "Stock", "package", "stock") +
        card("sales", "Vente", "cart", "sales") +
        card("reports", "Rapport", "chart", "reports") +
        card("team", "Équipe", "users", "team") +
        card("menu", "Menu Digital", "qrcode", "menu") +
        card("events", "Événements", "calendar", "events") +
        card("customers", "Clients", "heart", "customers") +
        card("profile", "Mon Profil", "user", "profile") +
        card("logout", "Déconnexion", "logout", "logout") +
      '</div>';
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
