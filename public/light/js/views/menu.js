(function (global) {
  function render(root, ctx) {
    var ui = global.NACK_LIGHT.ui;
    var api = global.NACK_LIGHT.api;
    var uid = ctx.uid || "";
    var url = api.publicBase() + "/commande/" + uid;

    root.innerHTML =
      '<div class="lg-card">' +
        '<div class="lg-card-title">Menu Digital</div>' +
        '<div class="lg-card-desc">Partagez ce lien pour que vos clients commandent en ligne.</div>' +
        '<div class="lg-link-box" id="menu-url">' + ui.escapeHtml(url) + '</div>' +
        '<button type="button" class="lg-btn lg-btn-nack lg-btn-block" data-action="copy-text" data-arg="' + ui.escapeHtml(url) + '">Copier le lien</button>' +
        '<a class="lg-btn lg-btn-outline lg-btn-block" style="margin-top:8px;display:block" href="' + ui.escapeHtml(url) + '" target="_blank" rel="noopener">Ouvrir le menu</a>' +
      '</div>' +
      '<div class="lg-card">' +
        '<div class="lg-card-title">Astuce tablette</div>' +
        '<div class="lg-card-desc">Affichez le QR code depuis un téléphone récent, ou collez le lien dans un navigateur pour vos clients.</div>' +
      '</div>';
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.menu = { render: render };
})(window);
