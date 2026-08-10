(function (global) {
  function render(root, ctx) {
    var ui = global.NACK_LIGHT.ui;
    var profile = ctx.profile || {};
    var stats = ctx.stats || { salesToday: 0, productsCount: 0, teamCount: 0 };
    var name = profile.establishmentName || "NACK Pro";

    root.innerHTML =
      '<div class="lg-banner">Mode léger — interface native pour appareils anciens. Même design NACK Pro.</div>' +
      '<div class="lg-stats">' +
        '<div class="lg-stat"><div class="lg-stat-label">Vente du jour</div><div class="lg-stat-value">' + ui.escapeHtml(ui.formatMoney(stats.salesToday)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Produits</div><div class="lg-stat-value">' + ui.escapeHtml(String(stats.productsCount)) + '</div></div>' +
        '<div class="lg-stat"><div class="lg-stat-label">Équipe</div><div class="lg-stat-value">' + ui.escapeHtml(String(stats.teamCount)) + '</div></div>' +
      '</div>' +
      '<p style="margin-bottom:12px;color:#737373;font-size:0.9rem">Bonjour' +
        (profile.ownerName ? ", " + ui.escapeHtml(profile.ownerName) : "") +
        " — <strong>" + ui.escapeHtml(name) + "</strong></p>" +
      '<div class="lg-grid" id="home-menu">' +
        card("stock", "Stock", "📦", "stock") +
        card("sales", "Vente", "🛒", "sales") +
        card("reports", "Rapport", "📊", "reports") +
        card("team", "Équipe", "👥", "team") +
        card("menu", "Menu Digital", "📱", "menu") +
        card("events", "Événements", "📅", "events") +
        card("customers", "Clients", "❤️", "customers") +
        card("profile", "Mon Profil", "👤", "profile") +
        card("logout", "Déconnexion", "🚪", "logout") +
      '</div>';
  }

  function card(key, label, icon, tone) {
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
