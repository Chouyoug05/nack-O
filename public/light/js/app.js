(function (global) {
  var api = global.NACK_LIGHT.api;
  var ui = global.NACK_LIGHT.ui;
  var views = global.NACK_LIGHT.views;

  var state = {
    view: "home",
    profile: null,
    uid: null,
    email: null,
    stats: { salesToday: 0, productsCount: 0, teamCount: 0 }
  };

  var TITLES = {
    home: "NACK Pro",
    stock: "Stock",
    sales: "Vente",
    reports: "Rapport",
    team: "Équipe",
    menu: "Menu Digital",
    events: "Événements",
    customers: "Clients",
    profile: "Mon Profil"
  };

  function boot() {
    bindForms();
    ui.installGlobalTaps(handleAction);
    var session = api.getSession();
    if (session && session.idToken && session.uid) {
      state.uid = session.uid;
      state.email = session.email;
      showAppShell();
      loadProfile().then(function () {
        navigate("home");
        refreshStats();
      }).catch(function (err) {
        ui.toast(err.message || "Session invalide", "error");
        logout();
      });
    } else {
      showLogin();
    }
  }

  function bindForms() {
    bindForm("login-form", function () { doLogin(); });
    bindForm("mgr-form", function () { ui.submitManagerAuth(state.profile); });
    bindForm("product-form", function () {
      if (views.stock && views.stock.submitAddProduct) views.stock.submitAddProduct();
    });
    bindForm("event-form", function () {
      if (views.events && views.events.submitEvent) views.events.submitEvent();
    });
  }

  function bindForm(id, fn) {
    var form = ui.$(id);
    if (!form || form.getAttribute("data-bound") === "1") return;
    form.setAttribute("data-bound", "1");
    form.addEventListener("submit", function (e) {
      if (e.preventDefault) e.preventDefault();
      fn();
    }, false);
  }

  function handleAction(action, arg) {
    switch (action) {
      case "nav": navigate(arg); break;
      case "back": navigate("home"); break;
      case "logout": logout(); break;
      case "close-modal": ui.closeModal(arg); break;
      case "mgr-cancel": ui.closeModal("modal-manager"); break;
      case "prod-cancel": ui.closeModal("modal-product"); break;
      case "ev-cancel": ui.closeModal("modal-event"); break;
      case "cart-cancel": ui.closeModal("modal-cart"); break;
      case "cart-pay":
        if (views.sales && views.sales.checkout) views.sales.checkout();
        break;
      case "open-cart":
        if (views.sales && views.sales.openCartModal) views.sales.openCartModal();
        break;
      case "add-cart":
        if (views.sales && views.sales.addToCart) views.sales.addToCart(arg);
        break;
      case "cart-inc":
        if (views.sales && views.sales.addToCart) {
          views.sales.addToCart(arg);
          views.sales.openCartModal();
        }
        break;
      case "cart-dec":
        if (views.sales && views.sales.decCart) {
          views.sales.decCart(arg);
          views.sales.openCartModal();
        }
        break;
      case "add-product":
        ui.requireManagerAuth(state.profile, function () {
          var form = ui.$("product-form");
          if (form) form.reset();
          ui.openModal("modal-product");
        });
        break;
      case "add-event":
        ui.requireManagerAuth(state.profile, function () {
          var form = ui.$("event-form");
          if (form) form.reset();
          ui.openModal("modal-event");
        });
        break;
      case "stock-inc":
        if (views.stock && views.stock.adjustStock) views.stock.adjustStock(arg, 1);
        break;
      case "stock-dec":
        if (views.stock && views.stock.adjustStock) views.stock.adjustStock(arg, -1);
        break;
      case "stock-filter-zero":
        if (views.stock && views.stock.toggleZeroFilter) views.stock.toggleZeroFilter();
        break;
      case "reports-period":
        if (views.reports && views.reports.setPeriod) views.reports.setPeriod(arg);
        break;
      case "copy-text":
        ui.copyText(arg);
        break;
      default:
        console.warn("[NACK Light] action inconnue:", action);
    }
  }

  global.NACK_LIGHT.handleAction = handleAction;

  function showLogin() {
    ui.showEl(ui.$("screen-login"));
    ui.hideEl(ui.$("screen-app"));
  }
  function showAppShell() {
    ui.hideEl(ui.$("screen-login"));
    ui.showEl(ui.$("screen-app"));
  }

  function doLogin() {
    var email = (ui.$("login-email") && ui.$("login-email").value || "").trim();
    var password = (ui.$("login-password") && ui.$("login-password").value || "");
    if (!email || !password) { ui.toast("Email et mot de passe requis", "error"); return; }
    var btn = ui.$("login-submit");
    ui.setLoading(btn, true);
    api.signIn(email, password).then(function (res) {
      state.uid = res.localId;
      state.email = res.email || email;
      return loadProfile();
    }).then(function () {
      showAppShell();
      navigate("home");
      refreshStats();
      ui.toast("Connexion réussie", "ok");
    }).catch(function (err) {
      ui.toast(err.message || "Échec de connexion", "error");
    }).then(function () { ui.setLoading(btn, false); });
  }

  function loadProfile() {
    return api.getProfile(state.uid).then(function (profile) {
      if (!profile) throw new Error("Profil introuvable");
      state.profile = profile;
      updateHeader();
      return profile;
    });
  }

  function updateHeader() {
    var name = (state.profile && state.profile.establishmentName) || "NACK";
    var brand = ui.$("hdr-brand-name");
    if (brand) brand.textContent = name;
    var letter = (name.charAt(0) || "N").toUpperCase();
    var logo = state.profile && state.profile.logoUrl;
    ["hdr-avatar", "hdr-avatar-right"].forEach(function (id) {
      var el = ui.$(id);
      if (!el) return;
      if (logo) el.innerHTML = '<img src="' + ui.escapeHtml(logo) + '" alt="" style="width:100%;height:100%;border-radius:10px;object-fit:cover">';
      else el.textContent = letter;
    });
  }

  function ctx() {
    return {
      profile: state.profile,
      uid: state.uid,
      email: state.email,
      stats: state.stats,
      onNavigate: navigate,
      onLogout: logout,
      onStats: function (partial) {
        for (var k in partial) {
          if (Object.prototype.hasOwnProperty.call(partial, k)) state.stats[k] = partial[k];
        }
      },
      refreshStats: refreshStats
    };
  }

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) ui.hideEl(el); else ui.showEl(el);
  }

  function navigate(view) {
    if (!views[view]) view = "home";
    state.view = view;
    var titleEl = ui.$("hdr-title");
    if (titleEl) titleEl.textContent = TITLES[view] || "NACK Pro";
    setHidden(ui.$("hdr-back"), view === "home");
    setHidden(ui.$("hdr-brand"), view !== "home");

    var nav = ui.$("bottom-nav");
    if (nav) {
      var buttons = nav.querySelectorAll("[data-action='nav']");
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var arg = b.getAttribute("data-arg");
        if (arg === view) {
          if (b.className.indexOf("active") === -1) b.className += " active";
        } else {
          b.className = String(b.className || "").replace(/\bactive\b/g, "");
        }
      }
    }

    var main = ui.$("view-root");
    if (!main) return;
    var renderer = views[view];
    if (renderer && renderer.render) renderer.render(main, ctx());
  }

  function refreshStats() {
    if (!state.profile || !state.uid) return;
    var root = api.dataRoot(state.profile, state.uid);
    var start = new Date();
    start.setHours(0, 0, 0, 0);
    var startTs = start.getTime();
    Promise.all([
      api.listDocs(root + "/products", 200).catch(function () { return []; }),
      api.listDocs(root + "/sales", 100).catch(function () { return []; }),
      api.listDocs(root + "/team", 50).catch(function () { return []; })
    ]).then(function (results) {
      var products = results[0] || [];
      var sales = results[1] || [];
      var team = results[2] || [];
      var salesToday = 0;
      for (var i = 0; i < sales.length; i++) {
        if (Number(sales[i].createdAt) >= startTs) salesToday += Number(sales[i].total) || 0;
      }
      state.stats = { salesToday: salesToday, productsCount: products.length, teamCount: team.length };
      if (state.view === "home") navigate("home");
    });
  }

  function logout() {
    api.clearSession();
    state.profile = null;
    state.uid = null;
    state.email = null;
    showLogin();
  }

  if (typeof Promise === "undefined") {
    document.body.innerHTML = "<p style='padding:2rem;text-align:center'>Navigateur trop ancien (Promise manquant).</p>";
    return;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, false);
  else boot();
})(window);
