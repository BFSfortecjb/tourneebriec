/*!
 * Tournée calendriers — sync.js (partage via un dépôt GitHub privé)
 * Le fichier tournee-data.json du dépôt sert de base commune.
 * Chaque appareil connecté le lit toutes les 20 s et y écrit ses modifications.
 * L'accès au dépôt vient de la connexion (auth.js), jamais saisi par l'utilisateur.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var CFG_KEY = 'bfs_briec_sync_v2';
  var FILE = 'tournee-data.json';
  var BK_DIR = 'sauvegardes';
  var BK_EVERY = 3600000;           // une sauvegarde automatique par heure et par appareil, au plus
  var cfg = loadCfg();
  var sha = null, busy = false, again = false, rev = 0, timer = null, lastOk = null, lastErr = '', bkBusy = false;

  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCfg() {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
  }
  function enabled() { return !!(cfg.repo && cfg.token && cfg.user); }

  function enc(s) {
    var bytes = new TextEncoder().encode(s), bin = '';
    for (var i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(bin);
  }
  function dec(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function url() { return 'https://api.github.com/repos/' + cfg.repo + '/contents/' + FILE; }
  function headers(json) {
    var h = { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }
  function httpError(res, what) {
    if (res.status === 401) return new Error('Accès expiré : déconnectez-vous puis reconnectez-vous (ou prévenez l\'administrateur)');
    if (res.status === 403) return new Error('Accès refusé ou limite GitHub atteinte, nouvel essai plus tard');
    if (res.status === 404) return new Error('Dépôt de données introuvable (« ' + cfg.repo + ' ») : le jeton n\'y a pas accès ou le nom est faux');
    return new Error(what + ' : erreur ' + res.status);
  }

  function pull() {
    return fetch(url() + '?t=' + Date.now(), { headers: headers(false), cache: 'no-store' }).then(function (res) {
      if (res.status === 404) {
        // Soit le fichier n'existe pas encore, soit le dépôt est introuvable : on le vérifie
        return fetch('https://api.github.com/repos/' + cfg.repo, { headers: headers(false), cache: 'no-store' }).then(function (r2) {
          if (!r2.ok) throw httpError(r2, 'Lecture du dépôt');
          return { exists: false };
        });
      }
      if (!res.ok) throw httpError(res, 'Lecture');
      return res.json().then(function (j) {
        if (!j.content) throw new Error('Fichier de données trop gros pour cette version test');
        return { exists: true, sha: j.sha, data: JSON.parse(dec(j.content)) };
      });
    });
  }

  function push(sentRev) {
    var body = { message: 'Tournée — mise à jour par ' + cfg.user + ' ' + new Date().toISOString(), content: enc(T.store.snapshot()) };
    if (sha) body.sha = sha;
    return fetch(url(), { method: 'PUT', headers: headers(true), body: JSON.stringify(body) }).then(function (res) {
      if (res.status === 409 || res.status === 422) return { conflict: true };
      if (!res.ok) throw httpError(res, 'Envoi');
      return res.json().then(function (j) {
        sha = j.content && j.content.sha;
        if (rev === sentRev) { cfg.dirty = false; saveCfg(); }
        return { conflict: false };
      });
    });
  }

  function doSync(attempt) {
    return pull().then(function (r) {
      if (r.exists) { T.store.merge(r.data, true); sha = r.sha; } else { sha = null; }
      if (!cfg.dirty && r.exists) return null;
      return push(rev).then(function (p) {
        if (p.conflict) {
          if (attempt >= 2) throw new Error('Conflit d\'envoi, nouvel essai dans un instant');
          return doSync(attempt + 1);
        }
        return null;
      });
    });
  }

  /* ---------- sauvegardes automatiques : sauvegardes/AAAA-MM-JJ.json dans le dépôt de données ---------- */
  function bkUrl(name) { return 'https://api.github.com/repos/' + cfg.repo + '/contents/' + BK_DIR + (name ? '/' + name : ''); }
  function dayStr() { return T.store.today(); }
  // Un fichier par jour, mis à jour au fil de la journée. On ne sauvegarde pas si les données ont fondu
  // (par exemple après « Tout effacer ») : la dernière bonne copie reste alors intacte.
  function backupMaybe() {
    if (!enabled() || bkBusy) return;
    var n = T.store.all().length, now = Date.now();
    if (!n || (cfg.bkAt && now - cfg.bkAt < BK_EVERY)) return;
    if (cfg.bkN && n < cfg.bkN * 0.5) { cfg.bkSkip = true; saveCfg(); return; }
    bkBusy = true;
    var name = dayStr() + '.json';
    fetch(bkUrl(name) + '?t=' + now, { headers: headers(false), cache: 'no-store' }).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw httpError(res, 'Sauvegarde');
      return res.json().then(function (j) { return j.sha; });
    }).then(function (oldSha) {
      var body = { message: 'Sauvegarde automatique ' + name + ' (' + cfg.user + ')', content: enc(T.store.snapshot()) };
      if (oldSha) body.sha = oldSha;
      return fetch(bkUrl(name), { method: 'PUT', headers: headers(true), body: JSON.stringify(body) });
    }).then(function (res) {
      if (res && res.ok) { cfg.bkAt = now; cfg.bkN = n; cfg.bkSkip = false; saveCfg(); }
    }).catch(function () { /* silencieux : on réessaiera à la prochaine synchro */ }).then(function () { bkBusy = false; });
  }
  function listBackups() {
    return fetch(bkUrl() + '?t=' + Date.now(), { headers: headers(false), cache: 'no-store' }).then(function (res) {
      if (res.status === 404) return [];
      if (!res.ok) throw httpError(res, 'Liste des sauvegardes');
      return res.json().then(function (l) {
        return l.filter(function (f) { return /\.json$/.test(f.name); }).map(function (f) { return { name: f.name, size: f.size }; })
          .sort(function (a, b) { return a.name < b.name ? 1 : -1; });
      });
    });
  }
  function getBackup(name) {
    return fetch(bkUrl(name) + '?t=' + Date.now(), { headers: headers(false), cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw httpError(res, 'Lecture de la sauvegarde');
      return res.json().then(function (j) {
        if (!j.content) throw new Error('Sauvegarde trop grosse pour être lue ici');
        return dec(j.content);
      });
    });
  }

  function setStatus(kind, msg) {
    var el = T.$('#syncStatus');
    if (!el) return;
    var txt = '';
    if (!enabled()) txt = 'Non connecté : les données restent sur cet appareil.';
    else if (kind === 'busy') txt = '⟳ Synchronisation…';
    else if (kind === 'err') txt = '⚠ ' + msg + (cfg.dirty ? ' — vos modifications sont gardées et seront envoyées dès que possible.' : '');
    else txt = '✓ Partagé' + (lastOk ? ' — à jour à ' + lastOk.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
    el.textContent = txt;
  }

  function sync() {
    if (!enabled()) { setStatus(); return Promise.resolve(); }
    if (busy) { again = true; return Promise.resolve(); }
    busy = true;
    setStatus('busy');
    return doSync(0).then(function () {
      lastOk = new Date(); lastErr = ''; setStatus('ok');
      backupMaybe();
    }).catch(function (e) {
      lastErr = (e && e.message === 'Failed to fetch') ? 'Réseau indisponible' : (e && e.message) || 'Erreur';
      setStatus('err', lastErr);
    }).then(function () {
      busy = false;
      if (again) { again = false; schedule(800); }
    });
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(sync, ms);
  }

  T.sync = {
    init: function () {
      T.bus.on('local', function () {
        if (!enabled()) return;
        cfg.dirty = true; rev++; saveCfg();
        schedule(2000);
      });
      setInterval(function () { if (!document.hidden) sync(); }, 20000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });
      window.addEventListener('online', function () { sync(); });
      setStatus();
      if (enabled()) sync();
    },
    // Appelé après une connexion réussie : payload = { repo, token } déchiffré
    signIn: function (payload, user) {
      var keepDirty = cfg.user === user ? cfg.dirty : true;
      var old = cfg;
      cfg = { repo: payload.repo, token: payload.token, user: user, dirty: keepDirty !== false };
      if (old.user === user) { cfg.bkAt = old.bkAt; cfg.bkN = old.bkN; cfg.bkSkip = old.bkSkip; }
      rev++; saveCfg();
      sha = null; lastErr = '';
      return sync();
    },
    signOut: function () {
      cfg = {}; saveCfg(); sha = null; lastOk = null;
      setStatus();
    },
    user: function () { return cfg.user || ''; },
    now: sync,
    listBackups: function () { return enabled() ? listBackups() : Promise.reject(new Error('Non connecté')); },
    getBackup: function (n) { return getBackup(n); },
    backupInfo: function () { return { at: cfg.bkAt || 0, n: cfg.bkN || 0, skipped: !!cfg.bkSkip }; },
    isOn: enabled
  };
})();
