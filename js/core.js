/*!
 * Tournée calendriers — core.js (constantes, utilitaires, bus d'événements)
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour = window.Tour || {};

  // Identité de la tournée (titre des exports et du bordereau)
  T.TOURNEE = { num: 1, titre: 'Tournée de calendriers — Briec', commune: 'Briec' };

  T.VERSION = '0.27-briec';

  T.STATUS = {
    todo:     { label: 'Pas visité', color: '#8a8f98' },
    passe:    { label: 'Passé',      color: '#2e9e4f' },
    repasser: { label: 'À repasser', color: '#f0952b' },
    refus:    { label: 'Refus',      color: '#d6402f' },
    inhabite: { label: 'Inhabité',   color: '#7a4fb5' }
  };
  T.STATUS_ORDER = ['passe', 'repasser', 'refus', 'inhabite', 'todo'];

  T.$ = function (s, r) { return (r || document).querySelector(s); };
  T.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  T.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  T.uid = function () {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  var tt;
  T.toast = function (msg) {
    var el = T.$('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(tt);
    tt = setTimeout(function () { el.classList.add('hidden'); }, 2500);
  };

  // Petit bus d'événements
  var handlers = {};
  T.bus = {
    on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit: function (name, data) { (handlers[name] || []).forEach(function (fn) { fn(data); }); }
  };

  // Montants en euros
  T.money = {
    // « 12,5 » ou « 12.50 » → 12.5 ; NaN si ce n'est pas un montant
    parse: function (s) {
      s = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.');
      if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
      return Math.round(parseFloat(s) * 100) / 100;
    },
    fmt: function (n) {
      return (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    },
    label: function (h) {
      if (!h || !h.pay) return '';
      if (h.pay === 'gratuit') return 'Gratuit';
      return T.money.fmt(h.amount) + (h.pay === 'esp' ? ' espèces' : ' chèque');
    }
  };
  // Motifs d'un calendrier gratuit
  T.MOTIFS = { garde: 'Gardé', nouveau: 'Nouveaux habitants de la commune', ancien: 'Ancien pompier', echange: 'Échange entre casernes' };
  // Montants proposés en une touche dans la fiche d'une adresse (espèces / chèque)
  T.QUICK = { esp: [5, 10, 15, 20, 25], chq: [10, 15, 20, 30, 50] };
  T.PAY = { esp: 'Espèces', chq: 'Chèque', gratuit: 'Gratuit' };

  T.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
