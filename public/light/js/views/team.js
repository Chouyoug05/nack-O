(function (global) {
  var ui, api, state;
  var ROLE_LABELS = {
    serveur: "Serveur",
    caissier: "Caissier",
    cuisinier: "Cuisinier",
    "agent-evenement": "Agent événement"
  };

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    state = { ctx: ctx, members: [] };
    root.innerHTML = '<div id="team-list" class="lg-loading">Chargement de l\'équipe…</div>';
    load();
  }

  function teamPath() { return api.dataRoot(state.ctx.profile, state.ctx.uid) + "/team"; }

  function roleLink(role, token) {
    var base = api.publicBase();
    if (role === "serveur") return base + "/serveur/" + token;
    if (role === "caissier") return base + "/caisse/" + token;
    if (role === "cuisinier") return base + "/cuisine/" + token;
    return base + "/agent-evenement/" + token;
  }

  function load() {
    api.listDocs(teamPath(), 100).then(function (docs) {
      state.members = docs || [];
      state.members.sort(function (a, b) {
        return String(a.lastName || "").localeCompare(String(b.lastName || ""));
      });
      paint();
      if (state.ctx.onStats) state.ctx.onStats({ teamCount: state.members.length });
    }).catch(function (err) {
      var el = ui.$("team-list");
      if (el) el.innerHTML = '<div class="lg-empty">' + ui.escapeHtml(err.message) + '</div>';
    });
  }

  function paint() {
    var el = ui.$("team-list");
    if (!el) return;
    if (!state.members.length) {
      el.innerHTML = '<div class="lg-empty">Aucun membre d\'équipe<br><span class="lg-card-desc">Ajoutez-les depuis un appareil récent.</span></div>';
      return;
    }
    var html = "";
    for (var i = 0; i < state.members.length; i++) {
      var m = state.members[i];
      var name = ((m.firstName || "") + " " + (m.lastName || "")).trim() || "Membre";
      var role = ROLE_LABELS[m.role] || m.role || "—";
      var token = m.agentToken || m.agentCode || "";
      html +=
        '<div class="lg-card">' +
          '<div class="lg-card-title">' + ui.escapeHtml(name) + '</div>' +
          '<div class="lg-card-desc">' + ui.escapeHtml(role) +
            (m.phone ? " · " + ui.escapeHtml(m.phone) : "") +
            (m.agentCode ? "<br>Code : " + ui.escapeHtml(m.agentCode) : "") +
          '</div>' +
          (token
            ? '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" style="margin-top:10px" data-action="copy-text" data-arg="' +
                ui.escapeHtml(roleLink(m.role, token)) + '">Copier le lien</button>'
            : "") +
        '</div>';
    }
    el.innerHTML = html;
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.team = { render: render };
})(window);
