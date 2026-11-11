/*!
 * Tournée calendriers — pull.js (tirer vers le bas pour actualiser)
 * Fonctionne en haut des onglets Liste, Dons et Bilan (la carte garde son glissement habituel).
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var THRESHOLD = 70, startY = null, view = null, dy = 0, busy = false;

  function activeView() {
    var v = T.$('.view.active');
    return v && v.id !== 'view-map' ? v : null;
  }
  function show(msg, offset) {
    var el = T.$('#ptr');
    el.classList.remove('hidden');
    el.innerHTML = '<span>' + T.esc(msg) + '</span>';
    el.style.transform = 'translateY(' + Math.round(offset || 0) + 'px)';
  }
  function hide() { T.$('#ptr').classList.add('hidden'); }

  function refreshNow() {
    if (busy) return;
    busy = true;
    show('⟳ Actualisation…', 20);
    var p = T.sync.isOn() ? T.sync.now() : Promise.resolve();
    Promise.resolve(p).then(function () {
      show(T.sync.isOn() ? '✓ À jour' : 'Non connecté : rien à actualiser', 20);
    }).catch(function () { show('⚠ Échec, réessayez', 20); })
      .then(function () { setTimeout(function () { hide(); busy = false; }, 900); });
  }

  function init() {
    var main = T.$('main');
    main.addEventListener('touchstart', function (e) {
      view = activeView();
      // seulement si on est tout en haut de la page et qu'aucune fiche n'est ouverte
      if (!view || view.scrollTop > 0 || busy || !T.$('#sheet').classList.contains('hidden') || !T.$('#imp').classList.contains('hidden')) { startY = null; return; }
      startY = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    main.addEventListener('touchmove', function (e) {
      if (startY === null) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) { hide(); return; }
      show(dy >= THRESHOLD ? '↓ Relâchez pour actualiser' : '↓ Tirez pour actualiser', Math.min(dy / 2, 50));
    }, { passive: true });
    function end() {
      if (startY === null) return;
      var go = dy >= THRESHOLD;
      startY = null; dy = 0;
      if (go) refreshNow(); else hide();
    }
    main.addEventListener('touchend', end, { passive: true });
    main.addEventListener('touchcancel', end, { passive: true });
  }

  T.pull = { init: init, refresh: refreshNow };
})();
