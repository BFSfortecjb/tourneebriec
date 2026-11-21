/*!
 * Tournée calendriers — quartiers.js (regroupement des voies en quartiers)
 * Les noms de voies sont ceux de la Base Adresse Nationale de Bannalec.
 * Pour ajouter un quartier ou une voie, modifier la liste ci-dessous.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour = window.Tour || {};

  T.QUARTIERS = [
    { name: 'Kergoz',          voies: ['Kergoz'] },
    { name: 'Kerliver',        voies: ['Kerliver', 'Rue de Kerliver'] },
    { name: 'Coatéréac',       voies: ['Coatéréac'] },
    { name: 'Menez Coatéréac', voies: ['Menez Coatéréac'] },
    { name: 'Saint Thurien',   voies: ['Rue de Saint Thurien'] }
  ];

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
