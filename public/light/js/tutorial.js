(function (global) {
  var ui, api, state;

  var STEPS = [
    { id: "stock", title: "Étape 1 : Gestion des stocks", desc: "Ouvrez l'onglet Stock pour gérer vos produits." },
    { id: "first-product", title: "Étape 2 : Premier produit", desc: "Ajoutez au moins un produit (nom, prix, quantité)." },
    { id: "sales", title: "Étape 3 : Découvrir la vente", desc: "Effectuez une vente test depuis l'onglet Vente." },
    { id: "report", title: "Étape 4 : Exporter un rapport", desc: "Téléchargez un rapport depuis l'onglet Rapport." },
    { id: "security", title: "Étape 5 : Sécuriser le compte", desc: "Configurez un code PIN gérant (recommandé)." }
  ];

  function shouldShow(profile) {
    if (!profile) return false;
    if (profile.tutorialCompleted) return false;
    return true;
  }

  function currentStep(profile) {
    var s = profile && profile.tutorialStep;
    if (!s || s === "completed") return STEPS[0].id;
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === s) return s;
    return STEPS[0].id;
  }

  function ensureModal() {
    if (ui.$("modal-tutorial")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div id="modal-tutorial-overlay" class="lg-modal-overlay lg-hidden" style="display:none"></div>' +
      '<div id="modal-tutorial" class="lg-modal lg-hidden" role="dialog" style="display:none">' +
        '<button type="button" class="lg-modal-close" id="tut-close">×</button>' +
        '<h2 id="tut-title"></h2>' +
        '<p class="lg-modal-desc" id="tut-desc"></p>' +
        '<div class="lg-modal-progress" id="tut-progress"></div>' +
        '<div class="lg-modal-actions">' +
          '<button type="button" class="lg-btn lg-btn-secondary" id="tut-prev">Précédent</button>' +
          '<button type="button" class="lg-btn lg-btn-nack" id="tut-next">Suivant</button>' +
        '</div></div>';
    document.body.appendChild(wrap.firstChild);
    document.body.appendChild(wrap.firstChild);
  }

  function paint(stepId, profile, onSave) {
    ensureModal();
    var idx = 0;
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === stepId) idx = i;
    var step = STEPS[idx];
    ui.$("tut-title").textContent = step.title;
    ui.$("tut-desc").textContent = step.desc;
    ui.$("tut-progress").textContent = "Étape " + (idx + 1) + " / " + STEPS.length;
    ui.showEl(ui.$("modal-tutorial-overlay"));
    ui.showEl(ui.$("modal-tutorial"));

    ui.$("tut-close").onclick = function () { close(); };
    ui.$("tut-prev").onclick = function () {
      if (idx > 0) {
        var prev = STEPS[idx - 1].id;
        saveStep(profile, prev, onSave, function () { paint(prev, profile, onSave); });
      }
    };
    ui.$("tut-next").onclick = function () {
      if (idx < STEPS.length - 1) {
        var next = STEPS[idx + 1].id;
        saveStep(profile, next, onSave, function () { paint(next, profile, onSave); });
      } else {
        saveStep(profile, "completed", onSave, function () {
          api.patchProfile(profile.id || profile.uid, { tutorialCompleted: true, tutorialStep: "completed" }, ["tutorialCompleted", "tutorialStep"])
            .catch(function () {});
          ui.toast("Tutoriel terminé !", "ok");
          close();
        });
      }
    };
  }

  function saveStep(profile, step, onSave, cb) {
    if (onSave) onSave(step);
    else if (profile && (profile.id || profile.uid)) {
      api.patchProfile(profile.id || profile.uid, { tutorialStep: step }, ["tutorialStep"]).then(cb).catch(cb);
    } else cb();
  }

  function close() {
    ui.closeModal("modal-tutorial");
  }

  function init(profile, onSave) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    if (!shouldShow(profile)) return;
    paint(currentStep(profile), profile, onSave);
  }

  global.NACK_LIGHT.tutorial = { init: init, shouldShow: shouldShow, close: close };
})(window);
