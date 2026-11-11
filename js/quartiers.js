/*!
 * Tournée calendriers — quartiers.js (regroupement des voies en quartiers)
 * Les noms de voies sont ceux de la Base Adresse Nationale de Briec.
 * Pour ajouter un quartier ou une voie, modifier la liste ci-dessous.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour = window.Tour || {};

  T.QUARTIERS = [];

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  }

  var byVoie = {};
  T.QUARTIERS.forEach(function (q) {
    q.voies.forEach(function (v) { byVoie[norm(v)] = q.name; });
  });

  // Nom du quartier d'une voie, ou '' si elle n'appartient à aucun quartier
  T.quartierOf = function (street) { return byVoie[norm(street)] || ''; };
  T.normName = norm;
})();
