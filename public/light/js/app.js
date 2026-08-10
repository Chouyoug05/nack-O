(function (global) {
  var api = global.NACK_LIGHT.api;
  var ui = global.NACK_LIGHT.ui;
  var views = global.NACK_LIGHT.views;
  var pendingOrdersCount = 0;

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

  global.NACK_LIGHT.setPendingOrdersCount = function (n) {
    pendingOrdersCount = n || 0;
  };

  function boot() {
    ui.paintNavIcons();
    bindForms();
    ui.installGlobalTaps(handleAction);
    if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.init) global.NACK_LIGHT.login.init();
    var session = api.getSession();
    if (session && session.idToken && session.uid) {
      state.uid = session.uid;
      state.email = session.email;
      showAppShell();
      loadProfile().then(function () {
        navigate("home");
        refreshStats();
        prefetchOrdersCount();
      }).catch(function (err) {
        ui.toast(err.message || "Session invalide", "error");
        logout();
      });
    } else {
      showLogin();
    }
  }

  function prefetchOrdersCount() {
    if (!state.profile || !state.uid) return;
    api.listDocs(api.dataRoot(state.profile, state.uid) + "/orders", 50).then(function (docs) {
      var n = 0;
      for (var i = 0; i < (docs || []).length; i++) {
        if ((docs[i].status || "pending") === "pending") n++;
      }
      global.NACK_LIGHT.setPendingOrdersCount(n);
      updateNavSalesBadge(n);
    }).catch(function () {});
  }

  function updateNavSalesBadge(n) {
    var nav = ui.$("nav-sales");
    if (!nav) return;
    var old = nav.querySelector(".lg-nav-badge");
    if (old) old.parentNode.removeChild(old);
    if (n > 0) {
      var b = document.createElement("span");
      b.className = "lg-nav-badge";
      b.textContent = String(n);
      nav.appendChild(b);
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
    bindForm("team-login-form", function () {
      if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.doTeamLogin) global.NACK_LIGHT.login.doTeamLogin();
    });
    bindForm("affiliate-login-form", function () {
      if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.doAffiliateLogin) global.NACK_LIGHT.login.doAffiliateLogin();
    });
    bindForm("team-form", function () {
      if (views.team && views.team.submitMember) views.team.submitMember();
    });
    bindForm("profile-form", function () {
      if (views.profile && views.profile.saveProfile) views.profile.saveProfile();
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
        if (views.sales && views.sales.addToCart) views.sales.addToCart(arg);
        break;
      case "cart-dec":
        if (views.sales && views.sales.decCart) views.sales.decCart(arg);
        break;
      case "cart-remove":
        if (views.sales && views.sales.removeCart) views.sales.removeCart(arg);
        break;
      case "cart-clear":
        if (views.sales && views.sales.clearCart) views.sales.clearCart();
        break;
      case "hold-order":
        if (views.sales && views.sales.holdOrder) views.sales.holdOrder();
        break;
      case "sales-tab":
        if (views.sales && views.sales.setTab) views.sales.setTab(arg);
        break;
      case "edit-order":
        if (views.sales && views.sales.loadOrderToCart) views.sales.loadOrderToCart(arg);
        break;
      case "pay-order":
        if (views.sales && views.sales.payOrder) views.sales.payOrder(arg);
        break;
      case "cancel-order":
        if (views.sales && views.sales.cancelOrder) views.sales.cancelOrder(arg);
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
      case "stock-toggle-zero":
        if (views.stock && views.stock.toggleZero) views.stock.toggleZero();
        break;
      case "reports-period":
        if (views.reports && views.reports.setPeriod) views.reports.setPeriod(arg);
        break;
      case "copy-text":
        ui.copyText(arg);
        break;
      case "login-type":
        if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.setLoginType) global.NACK_LIGHT.login.setLoginType(arg);
        break;
      case "aff-logout":
        if (global.NACK_LIGHT.login && global.NACK_LIGHT.login.affiliateLogout) global.NACK_LIGHT.login.affiliateLogout();
        break;
      case "team-add-role":
        ui.requireManagerAuth(state.profile, function () {
          if (views.team && views.team.openAddModal) views.team.openAddModal(arg);
        });
        break;
      case "team-edit":
        ui.requireManagerAuth(state.profile, function () {
          if (views.team && views.team.openEditModal) views.team.openEditModal(arg);
        });
        break;
      case "team-regen":
        if (views.team && views.team.regenerateCodes) views.team.regenerateCodes(arg);
        break;
      case "team-cancel":
        ui.closeModal("modal-team");
        break;
      case "profile-tab":
        if (views.profile && views.profile.setTab) views.profile.setTab(arg);
        break;
      case "profile-edit":
        if (views.profile && views.profile.openEditModal) views.profile.openEditModal();
        break;
      case "profile-pay":
        if (views.profile && views.profile.payNow) views.profile.payNow(arg);
        break;
      case "prof-cancel":
        ui.closeModal("modal-profile");
        break;
      default:
        console.warn("[NACK Light] action inconnue:", action);
    }
  }

  global.NACK_LIGHT.handleAction = handleAction;

  function showLogin() {
    ui.showEl(ui.$("screen-login"));
    ui.hideEl(ui.$("screen-app"));
    ui.hideEl(ui.$("screen-affiliate"));
  }
  function showAppShell() {
    ui.hideEl(ui.$("screen-login"));
    ui.hideEl(ui.$("screen-affiliate"));
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
      prefetchOrdersCount();
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
    var ownerLetter = ((state.profile && state.profile.ownerName) || "G").charAt(0).toUpperCase();

    var estAvatar = ui.$("hdr-avatar");
    if (estAvatar) {
      if (logo) estAvatar.innerHTML = '<img src="' + ui.escapeHtml(logo) + '" alt="" style="width:100%;height:100%;border-radius:10px;object-fit:cover">';
      else { estAvatar.textContent = letter; estAvatar.style.background = "#dc2626"; }
    }
    var right = ui.$("hdr-avatar-right");
    if (right) {
      right.textContent = ownerLetter;
      right.style.background = "#6C757D";
    }
    var hdrBrand = ui.$("hdr-brand");
    if (hdrBrand) ui.showEl(hdrBrand);
  }

  function ctx() {
    return {
      profile: state.profile,
      uid: state.uid,
      email: state.email,
      stats: state.stats,
      onNavigate: navigate,
      onLogout: logout,
      onProfileUpdate: function (profile) {
        state.profile = profile;
        updateHeader();
      },
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

    var nav = ui.$("bottom-nav");
    if (nav) {
      var buttons = nav.querySelectorAll("[data-action='nav']");
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (b.getAttribute("data-arg") === view) {
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
    updateNavSalesBadge(pendingOrdersCount);
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
