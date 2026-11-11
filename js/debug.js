/*!
 * Tournée calendriers — debug.js
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour = window.Tour || {};
  T.debug = { log: [] };

  console.log('%cTournée calendriers — © Jérémy Bizeul / Vigie-lance',
    'color:#b3261e;font-weight:bold');

  function push(msg) {
    T.debug.log.push(new Date().toISOString() + ' ' + msg);
    if (T.debug.log.length > 100) T.debug.log.shift();
    console.error(msg);
    if (T.toast) T.toast('Erreur : ' + msg.slice(0, 80));
  }

  window.addEventListener('error', function (e) {
    push((e.message || 'erreur') + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')');
  });
  window.addEventListener('unhandledrejection', function (e) {
    push('promesse rejetée : ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
})();
