/*!
 * Tournée calendriers — histo.js (résultats des tournées précédentes, pour comparer)
 * Briec : aucune tournée précédente saisie. Pour comparer, ajouter des lignes { y: année, total: montant, net: montant } dans T.HISTO.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  T.TOURNEE.year = 2026;
  T.HISTO = [];
  // Comparaison de la tournée en cours avec chaque année passée
  T.histoCompare = function () {
    var f = T.store.finance().all, ind = T.store.indemnite();
    return T.HISTO.slice().reverse().map(function (h) {
      return { y: h.y, total: h.total, net: h.net, dTotal: Math.round((f.total - h.total) * 100) / 100,
        dNet: h.net == null ? null : Math.round((ind.net - h.net) * 100) / 100 };
    });
  };
})();
