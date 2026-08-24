(function (global) {
  var ui, api;

  function needsLocation(profile) {
    if (!profile) return false;
    if (profile.locationAsked) return false;
    try {
      if (sessionStorage.getItem("nack_loc_skip") === "1") return false;
    } catch (e) {}
    // Ne pas ouvrir l'adresse tant que le profil de base n'est pas prêt
    if (!String(profile.establishmentName || "").trim() || !String(profile.ownerName || "").trim()) return false;
    if (profile.latitude || profile.longitude || profile.address) return false;
    return true;
  }

  function ensureModal() {
    if (document.getElementById("modal-location")) return;
    var overlay = document.createElement("div");
    overlay.id = "modal-location-overlay";
    overlay.className = "lg-modal-overlay lg-hidden";
    overlay.style.display = "none";
    var modal = document.createElement("div");
    modal.id = "modal-location";
    modal.className = "lg-modal lg-hidden";
    modal.style.display = "none";
    modal.setAttribute("role", "dialog");
    modal.innerHTML =
      '<h2>Complétez votre adresse</h2>' +
      '<p class="lg-modal-desc">Indiquez votre adresse ou utilisez la géolocalisation pour la carte.</p>' +
      '<div class="lg-field"><label class="lg-label">Adresse</label><input class="lg-input" id="loc-address"></div>' +
      '<div class="lg-modal-actions">' +
        '<button type="button" class="lg-btn lg-btn-secondary" data-action="loc-skip">Plus tard</button>' +
        '<button type="button" class="lg-btn lg-btn-outline" data-action="loc-geo">Ma position</button>' +
        '<button type="button" class="lg-btn lg-btn-nack" data-action="loc-save">Enregistrer</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
  }

  function open(profile, uid, onUpdate) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    ensureModal();
    var addr = ui.$("loc-address");
    if (addr) addr.value = (profile && profile.address) || "";
    ui.openModal("modal-location");
    global.NACK_LIGHT._locCtx = { profile: profile, uid: uid, onUpdate: onUpdate };
  }

  function markAsked(extra) {
    var ctx = global.NACK_LIGHT._locCtx;
    if (!ctx || !ctx.uid) return Promise.resolve();
    var data = { locationAsked: true, updatedAt: Date.now() };
    var mask = ["locationAsked", "updatedAt"];
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) {
          data[k] = extra[k];
          mask.push(k);
        }
      }
    }
    return api.patchProfile(ctx.uid, data, mask).then(function () {
      ctx.profile.locationAsked = true;
      for (var key in extra || {}) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) ctx.profile[key] = extra[key];
      }
      if (ctx.onUpdate) ctx.onUpdate(ctx.profile);
    }).catch(function () {});
  }

  function save() {
    var ctx = global.NACK_LIGHT._locCtx;
    if (!ctx) return;
    var address = (ui.$("loc-address").value || "").trim();
    markAsked({ address: address }).then(function () {
      ui.closeModal("modal-location");
      ui.toast("Adresse enregistrée", "ok");
    });
  }

  function useGeo() {
    var ctx = global.NACK_LIGHT._locCtx;
    if (!ctx || !navigator.geolocation) { ui.toast("Géolocalisation indisponible", "error"); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      markAsked({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      }).then(function () {
        ui.closeModal("modal-location");
        ui.toast("Position enregistrée", "ok");
      });
    }, function () { ui.toast("Impossible d'obtenir la position", "error"); });
  }

  function skip() {
    try { sessionStorage.setItem("nack_loc_skip", "1"); } catch (e) {}
    markAsked({}).then(function () {
      ui.closeModal("modal-location");
    });
    ui.closeModal("modal-location");
  }

  function maybeShow(profile, uid, onUpdate) {
    if (needsLocation(profile)) open(profile, uid, onUpdate);
  }

  global.NACK_LIGHT.locationDialog = { maybeShow: maybeShow, save: save, useGeo: useGeo, skip: skip };
})(window);
