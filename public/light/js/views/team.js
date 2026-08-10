(function (global) {
  var ui, api, state, icon;
  var ROLE_LABELS = {
    serveur: "Serveur", caissier: "Caissier", cuisinier: "Cuisinier", "agent-evenement": "Agent événement"
  };

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    icon = global.NACK_LIGHT.icon;
    state = { ctx: ctx, members: [], editingId: null, selectedRole: null };

    root.innerHTML =
      '<div class="lg-section-title">Ajouter un équipier</div>' +
      '<div class="lg-grid" style="margin-bottom:16px">' +
        roleCard("serveur", "Serveur") +
        roleCard("caissier", "Caissier") +
        roleCard("cuisinier", "Cuisinier") +
        roleCard("agent-evenement", "Agent événement") +
      '</div>' +
      '<div class="lg-section-title">Mon équipe</div>' +
      '<div id="team-list" class="lg-loading">Chargement de l\'équipe…</div>';

    load();
  }

  function roleCard(role, label) {
    return (
      '<div><div class="lg-menu-card" data-action="team-add-role" data-arg="' + role + '" role="button">' +
        '<div class="lg-menu-icon team">' + icon("users", 24) + '</div>' +
        '<div class="lg-menu-label">' + label + '</div>' +
      '</div></div>'
    );
  }

  function load() {
    api.listDocs(api.teamPath(state.ctx.uid), 100).then(function (docs) {
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

  function roleLink(role, token) {
    var base = api.publicBase();
    if (role === "serveur") return base + "/serveur/" + token;
    if (role === "caissier") return base + "/caisse/" + token;
    if (role === "cuisinier") return base + "/cuisine/" + token;
    return base + "/agent-evenement/" + token;
  }

  function paint() {
    var el = ui.$("team-list");
    if (!el) return;
    if (!state.members.length) {
      el.innerHTML = '<div class="lg-empty">Aucun membre d\'équipe<br><span class="lg-card-desc">Ajoutez un serveur, caissier ou cuisinier ci-dessus</span></div>';
      return;
    }
    var html = "";
    for (var i = 0; i < state.members.length; i++) {
      var m = state.members[i];
      var name = ((m.firstName || "") + " " + (m.lastName || "")).trim() || "Membre";
      var role = ROLE_LABELS[m.role] || m.role || "—";
      var token = m.agentToken || m.agentCode || "";
      var status = m.status === "inactive" ? " (inactif)" : "";
      html +=
        '<div class="lg-card">' +
          '<div class="lg-card-title">' + ui.escapeHtml(name) + status + '</div>' +
          '<div class="lg-card-desc">' + ui.escapeHtml(role) +
            (m.phone ? " · " + ui.escapeHtml(m.phone) : "") +
            (m.agentCode ? "<br>Code : <strong>" + ui.escapeHtml(m.agentCode) + "</strong>" : "") +
          '</div>' +
          '<div class="lg-row-actions" style="margin-top:10px">' +
            (token ? '<button type="button" class="lg-btn lg-btn-outline lg-btn-sm" data-action="copy-text" data-arg="' + ui.escapeHtml(roleLink(m.role, token)) + '">Copier lien</button>' : "") +
            '<button type="button" class="lg-btn lg-btn-secondary lg-btn-sm" data-action="team-edit" data-arg="' + ui.escapeHtml(m.id) + '">Modifier</button>' +
            '<button type="button" class="lg-btn lg-btn-nack lg-btn-sm" data-action="team-regen" data-arg="' + ui.escapeHtml(m.id) + '">Régénérer</button>' +
          '</div></div>';
    }
    el.innerHTML = html;
  }

  function openAddModal(role) {
    state.editingId = null;
    state.selectedRole = role;
    var title = ui.$("team-modal-title");
    if (title) title.textContent = "Ajouter un " + (ROLE_LABELS[role] || "équipier");
    ui.$("team-form-role").value = role;
    ui.$("team-form-id").value = "";
    ui.$("team-form").reset();
    ui.openModal("modal-team");
  }

  function openEditModal(id) {
    var m = findMember(id);
    if (!m) return;
    state.editingId = id;
    state.selectedRole = m.role;
    var title = ui.$("team-modal-title");
    if (title) title.textContent = "Modifier " + ((m.firstName || "") + " " + (m.lastName || "")).trim();
    ui.$("team-form-role").value = m.role || "";
    ui.$("team-form-id").value = id;
    ui.$("team-first").value = m.firstName || "";
    ui.$("team-last").value = m.lastName || "";
    ui.$("team-phone").value = m.phone || "";
    ui.$("team-email").value = m.email || "";
    ui.openModal("modal-team");
  }

  function findMember(id) {
    for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) return state.members[i];
    return null;
  }

  function genAgentCode() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    function rnd(n) {
      var s = "";
      for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
      return s;
    }
    var existing = {};
    for (var j = 0; j < state.members.length; j++) if (state.members[j].agentCode) existing[state.members[j].agentCode] = true;
    var code = "AGT-" + rnd(4) + "-" + rnd(4);
    while (existing[code]) code = "AGT-" + rnd(4) + "-" + rnd(4);
    return code;
  }

  function genAgentToken() {
    var hex = "0123456789abcdef", out = "";
    for (var i = 0; i < 32; i++) out += hex.charAt(Math.floor(Math.random() * 16));
    return out;
  }

  function dashboardLink(role, token) {
    if (role === "serveur") return "/serveur/" + token;
    if (role === "caissier") return "/caisse/" + token;
    if (role === "cuisinier") return "/cuisine/" + token;
    return "/agent-evenement/" + token;
  }

  function submitMember() {
    var first = (ui.$("team-first").value || "").trim();
    var last = (ui.$("team-last").value || "").trim();
    var phone = (ui.$("team-phone").value || "").trim();
    var email = (ui.$("team-email").value || "").trim();
    var role = ui.$("team-form-role").value;
    var editId = ui.$("team-form-id").value;
    if (!first || !last || !phone || !role) { ui.toast("Prénom, nom, téléphone et rôle requis", "error"); return; }

    var btn = ui.$("team-form-submit");
    ui.setLoading(btn, true);

    if (editId) {
      var payload = { firstName: first, lastName: last, phone: phone, updatedAt: Date.now() };
      if (email) payload.email = email;
      api.patchDoc(api.teamPath(state.ctx.uid) + "/" + editId, payload, ["firstName", "lastName", "phone", "email", "updatedAt"]).then(function () {
        var m = findMember(editId);
        if (m && m.agentToken) {
          return api.patchDoc("agentTokens/" + m.agentToken, { firstName: first, lastName: last, updatedAt: Date.now() }, ["firstName", "lastName", "updatedAt"]);
        }
      }).then(function () {
        ui.closeModal("modal-team");
        ui.toast("Membre mis à jour", "ok");
        load();
      }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); })
        .then(function () { ui.setLoading(btn, false); });
      return;
    }

    var agentCode = genAgentCode();
    var agentToken = genAgentToken();
    var link = dashboardLink(role, agentToken);
    var data = {
      firstName: first, lastName: last, phone: phone, role: role,
      status: "active", agentCode: agentCode, agentToken: agentToken,
      dashboardLink: link, createdAt: Date.now(), updatedAt: Date.now()
    };
    if (email) data.email = email;

    api.createDoc(api.teamPath(state.ctx.uid), data).then(function () {
      return api.setDoc("agentTokens/" + agentToken, {
        ownerUid: state.ctx.uid, agentCode: agentCode,
        firstName: first, lastName: last, role: role, createdAt: Date.now()
      }, true);
    }).then(function () {
      ui.closeModal("modal-team");
      ui.copyText(api.publicBase() + link);
      ui.toast("Équipier ajouté — lien copié", "ok");
      load();
    }).catch(function (err) { ui.toast(err.message || "Erreur ajout", "error"); })
      .then(function () { ui.setLoading(btn, false); });
  }

  function regenerateCodes(id) {
    var m = findMember(id);
    if (!m) return;
    ui.requireManagerAuth(state.ctx.profile, function () {
      var newCode = genAgentCode();
      var newToken = genAgentToken();
      var newLink = dashboardLink(m.role, newToken);
      var chain = api.patchDoc(api.teamPath(state.ctx.uid) + "/" + id, {
        agentCode: newCode, agentToken: newToken, dashboardLink: newLink, updatedAt: Date.now()
      }, ["agentCode", "agentToken", "dashboardLink", "updatedAt"]);
      if (m.agentToken) chain = chain.then(function () { return api.deleteDoc("agentTokens/" + m.agentToken).catch(function () {}); });
      chain.then(function () {
        return api.setDoc("agentTokens/" + newToken, {
          ownerUid: state.ctx.uid, agentCode: newCode,
          firstName: m.firstName, lastName: m.lastName, role: m.role, createdAt: Date.now()
        }, true);
      }).then(function () {
        ui.copyText(api.publicBase() + newLink);
        ui.toast("Codes régénérés — lien copié", "ok");
        load();
      }).catch(function (err) { ui.toast(err.message || "Erreur", "error"); });
    });
  }

  global.NACK_LIGHT.views = global.NACK_LIGHT.views || {};
  global.NACK_LIGHT.views.team = {
    render: render, openAddModal: openAddModal, openEditModal: openEditModal,
    submitMember: submitMember, regenerateCodes: regenerateCodes
  };
})(window);
