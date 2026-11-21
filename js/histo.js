/*!
 * Tournée calendriers — histo.js (résultats des tournées précédentes, pour comparer)
 * Source : tableur « calendrier 2025.xlsx ». « net » = total collecté moins le coût des calendriers
 * (indemnisation des distributeurs) ; avant 2022 il n'y avait pas de coût, net = total. 2020 : pas de tournée.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  T.TOURNEE.year = 2026;
  T.HISTO = [
    { y: 2017, total: 3056,   net: 3056 },
    { y: 2018, total: 3425,   net: 3425 },
    { y: 2019, total: 3193,   net: 3193 },
    { y: 2021, total: 3748.5, net: null },
    { y: 2022, total: 3841.2, net: 3631 },
    { y: 2023, total: 4135,   net: 3883 },
    { y: 2024, total: 3873,   net: 3661.5 },
    { y: 2025, total: 4239.1, net: 4014 }
  ];
  // Comparaison de la tournée en cours avec chaque année passée
  T.histoCompare = function () {
    var f = T.store.finance().all, ind = T.store.indemnite();
    return T.HISTO.slice().reverse().map(function (h) {
      return { y: h.y, total: h.total, net: h.net, dTotal: Math.round((f.total - h.total) * 100) / 100,
        dNet: h.net == null ? null : Math.round((ind.net - h.net) * 100) / 100 };
    });
  };
})();
