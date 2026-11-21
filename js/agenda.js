/*!
 * Tournée calendriers — agenda.js (événements de la mairie à proposer en un geste)
 * Liste relevée le 8/11/2026 sur https://www.bannalec.fr/systeme/agenda/ (page 1 seulement) et sur la page Téléthon de Bannalec (telethon-bannalec.webnode.fr).
 * L'appli ne peut pas lire ce site toute seule (protection du site) : la liste se met à jour dans ce fichier.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  window.Tour.AGENDA = {
    url: 'https://www.bannalec.fr/systeme/agenda/',
    releve: '2026-11-08',
    items: [
      { title: 'Randonnée solidaire (Téléthon)', kind: 'rando', date: '2026-11-08', start: '', end: '' },
      { title: 'Bal country solidaire (Téléthon)', kind: 'fete', date: '2026-11-08', start: '14:00', end: '18:00', note: 'portes 14 h, bal 14 h 30 ; fin estimée' },
      { title: 'Repas de l\'UNC', kind: 'fete', date: '2026-11-11', start: '', end: '' },
      { title: 'Cross du 11 novembre', kind: 'sport', date: '2026-11-11', start: '', end: '' },
      { title: 'Cérémonie du 11 Novembre', kind: 'fete', date: '2026-11-11', start: '11:00', end: '12:00', note: 'durée estimée' },
      { title: 'Super loto des parents d\'élèves', kind: 'fete', date: '2026-11-15', start: '', end: '' },
      { title: 'Tombola du Téléthon (sur le marché)', kind: 'marche', date: '2026-11-26', start: '', end: '', note: 'jour de marché ; horaires non précisés' },
      { title: 'Tombola du Téléthon (sur le marché)', kind: 'marche', date: '2026-12-03', start: '', end: '', note: 'jour de marché ; horaires non précisés' },
      { title: 'Téléthon : ventes à Intermarché', kind: 'fete', date: '2026-12-04', start: '', end: '' },
      { title: 'Téléthon : ventes à Intermarché', kind: 'fete', date: '2026-12-05', start: '', end: '' },
      { title: 'Téléthon : ventes place de la Libération', kind: 'fete', date: '2026-12-05', start: '', end: '', note: 'crêpes, gâteaux, fleurs…' },
      { title: 'Téléthon : ventes place de la Libération', kind: 'fete', date: '2026-12-06', start: '', end: '', note: 'crêpes, gâteaux, fleurs…' }
    ]
  };
})();
