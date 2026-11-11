/*!
 * Tournée calendriers — auth.js (connexion identifiant / mot de passe)
 * Chaque compte = une entrée de users.json qui contient l'accès au dépôt de données,
 * chiffré (AES-GCM) avec une clé dérivée du mot de passe (PBKDF2).
 * Le bon mot de passe est la seule façon d'ouvrir l'entrée.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function (root) {
  'use strict';
  var T = root.Tour = root.Tour || {};
  var ITER = 250000;

  function b64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function norm(id) { return String(id || '').trim().toLowerCase(); }
  function utf8(s) { return new TextEncoder().encode(s); }

  function deriveKey(password, salt) {
    return crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' },
        k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  T.auth = {
    normId: norm,

    // Crée l'entrée chiffrée d'un compte (utilisé par l'outil admin)
    seal: function (id, password, payload) {
      id = norm(id);
      var salt = crypto.getRandomValues(new Uint8Array(16));
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return deriveKey(password, salt).then(function (key) {
        return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(id) }, key, utf8(JSON.stringify(payload)));
      }).then(function (ct) {
        return { id: id, v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
      });
    },

    // Ouvre une entrée avec le mot de passe ; rejette Error('BAD') si identifiant ou mot de passe faux
    login: function (users, id, password) {
      id = norm(id);
      var list = users && Array.isArray(users.users) ? users.users : [];
      var entry = list.filter(function (u) { return u.id === id; })[0];
      if (!entry || !password) return Promise.reject(new Error('BAD'));
      return deriveKey(password, unb64(entry.salt)).then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv), additionalData: utf8(id) }, key, unb64(entry.ct));
      }).then(function (buf) {
        return JSON.parse(new TextDecoder().decode(buf));
      }, function () {
        throw new Error('BAD');
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
