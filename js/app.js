/*!
 * Tournée calendriers — app.js (navigation, connexion, fiche habitation, bilan)
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var cur = null, token = 0, lastStreet = '';

  /* ---------- en-tête ---------- */
  function renderStats() {
    var s = T.store.stats();
    T.$('#statsBar').innerHTML = T.STATUS_ORDER.map(function (k) {
      return '<span><i class="dot s-' + k + '"></i>' + s[k] + ' ' + T.STATUS[k].label.toLowerCase() + '</span>';
    }).join('');
    T.$('#teamBadge').textContent = T.sync.user() ? T.sync.user() : '';
  }

  /* ---------- onglets ---------- */
  function showTab(name) {
    T.$$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    T.$$('.tabs button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    if (name === 'map') T.map.refresh();
    if (name !== 'map') T.map.stopAdd();
    if (name === 'dons') T.finance.show();
    if (name === 'stats' && T.stats) T.stats.render();
  }

  /* ---------- connexion ---------- */
  function showLogin(msg) {
    T.$('#login').classList.remove('hidden');
    T.$('#loginErr').textContent = msg || '';
  }
  function hideLogin() { T.$('#login').classList.add('hidden'); }

  function bindLogin() {
    T.$('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var id = T.auth.normId(T.$('#lgId').value), pw = T.$('#lgPw').value;
      var btn = T.$('#lgBtn'), err = T.$('#loginErr');
      if (!id || !pw) { err.textContent = 'Saisissez votre identifiant et votre mot de passe'; return; }
      btn.disabled = true; btn.textContent = 'Connexion…'; err.textContent = '';
      fetch('users.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('Fichier des comptes introuvable (users.json)');
          return r.json();
        })
        .then(function (users) { return T.auth.login(users, id, pw); })
        .then(function (payload) {
          if (!payload || !payload.repo || !payload.token) throw new Error('Compte mal configuré, prévenez l\'administrateur');
          T.$('#lgPw').value = '';
          hideLogin();
          T.store.setTeam(id);
          T.sync.signIn(payload, id);
          refresh();
          T.toast('Bonjour ' + id);
        })
        .catch(function (ex) {
          err.textContent = ex && ex.message === 'BAD' ? 'Identifiant ou mot de passe incorrect'
            : (ex && ex.message === 'Failed to fetch' ? 'Réseau indisponible' : (ex && ex.message) || 'Connexion impossible');
        })
        .then(function () { btn.disabled = false; btn.textContent = 'Se connecter'; });
    });
  }

  /* ---------- fiche habitation ---------- */
  function buildStatusBtns() {
    T.$('#statusBtns').innerHTML = T.STATUS_ORDER.map(function (k) {
      return '<button type="button" data-s="' + k + '" class="s-' + k + '">' + T.STATUS[k].label + '</button>';
    }).join('');
    T.$('#statusBtns').addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]');
      if (b) commit(b.getAttribute('data-s'));
    });
  }

  // Autres logements de la même adresse, pour passer de l'un à l'autre
  function renderUnitChips(h) {
    var box = T.$('#unitChips');
    var list = h ? T.store.atAddress(h.street, h.number) : [];
    if (list.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = list.map(function (x) {
      return '<button type="button" class="chip' + (x.id === h.id ? ' on' : '') + '" data-u="' + x.id + '">' +
        '<i class="dot s-' + x.status + '"></i>' + T.esc(x.unit || 'Sans nom') + '</button>';
    }).join('');
  }

  // Montant masqué si « gratuit » ou sans paiement ; e-mail visible seulement si reçu demandé
  // Montants rapides : une touche choisit le montant et le paiement ; une 2e touche sur la même efface
  function buildQuick() {
    function row(kind, label) {
      return '<p class="quick-l">' + label + '</p><div class="quick ' + kind + '">' + T.QUICK[kind].map(function (v) {
        return '<button type="button" data-q="' + kind + '" data-v="' + v + '">' + v + '</button>';
      }).join('') + '</div>';
    }
    T.$('#quickBox').innerHTML = row('esp', '💶 Espèces') + row('chq', '🧾 Chèque') +
      '<div class="quick misc" style="margin-top:6px"><button type="button" data-q="gratuit">🎁 Gratuit</button><button type="button" data-q="autre">Autre montant…</button></div>';
    T.$('#quickBox').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-q]');
      if (!b) return;
      var q = b.getAttribute('data-q'), pay = T.$('#fPay'), amt = T.$('#fAmount');
      if (q === 'autre') {
        if (pay.value !== 'esp' && pay.value !== 'chq') pay.value = 'esp';
        syncDonUi(); amt.focus(); amt.select();
        return;
      }
      if (b.classList.contains('on')) { pay.value = ''; amt.value = ''; }                 // même touche : on annule
      else if (q === 'gratuit') { pay.value = 'gratuit'; amt.value = ''; }
      else { pay.value = q; amt.value = b.getAttribute('data-v'); }
      syncDonUi();
    });
  }
  function updateQuick() {
    var pay = T.$('#fPay').value, v = T.money.parse(T.$('#fAmount').value);
    T.$$('#quickBox button[data-q]').forEach(function (b) {
      var q = b.getAttribute('data-q');
      b.classList.toggle('on', q === 'gratuit' ? pay === 'gratuit' : (q === pay && !isNaN(v) && v === parseFloat(b.getAttribute('data-v'))));
    });
  }

  function syncDonUi() {
    updateQuick();
    var pay = T.$('#fPay').value;
    T.$('#fAmount').parentNode.classList.toggle('hidden', pay !== 'esp' && pay !== 'chq' && pay !== '');
    T.$('#rowEmail').classList.toggle('hidden', !T.$('#fReceipt').checked);
    T.$('#rowCal').classList.toggle('hidden', !pay);
    T.$('#rowSouche').classList.toggle('hidden', pay !== 'esp' && pay !== 'chq');
    T.$('#rowMotif').classList.toggle('hidden', pay !== 'gratuit');
  }

  // Lit le bloc « don » ; renvoie null si une valeur est invalide (message déjà affiché)
  function readDon() {
    var pay = T.$('#fPay').value, amount = null;
    if (pay === 'esp' || pay === 'chq') {
      amount = T.money.parse(T.$('#fAmount').value);
      if (isNaN(amount) || amount <= 0) { T.toast('Montant invalide (ex : 10 ou 12,50)'); return null; }
    } else if (pay === 'gratuit') amount = 0;
    else if (T.$('#fAmount').value.trim()) { T.toast('Choisissez le mode de paiement'); return null; }
    var motif = pay === 'gratuit' ? T.$('#fMotif').value : '';
    if (pay === 'gratuit' && !motif) { T.toast('Choisissez le motif du calendrier gratuit'); return null; }
    var cal = pay ? parseInt(T.$('#fCal').value, 10) : 0;
    if (pay && !(cal > 0)) { T.toast('Indiquez le nombre de calendriers remis (1 au minimum)'); return null; }
    return { pay: pay, amount: amount, cal: cal, motif: motif, souche: (pay === 'esp' || pay === 'chq') ? T.$('#fSouche').value.trim() : '', donor: T.$('#fDonor').value.trim(),
      receipt: T.$('#fReceipt').checked, email: T.$('#fReceipt').checked ? T.$('#fEmail').value.trim() : '' };
  }

  function renderVisits(h) {
    var v = h && h.visits || [];
    var box = T.$('#visitInfo');
    if (!v.length) { box.textContent = ''; return; }
    var by = {};
    v.forEach(function (x) { by[x.by || '?'] = (by[x.by || '?'] || 0) + 1; });
    var last = v[v.length - 1];
    box.textContent = 'Passages : ' + v.length + ' (' + Object.keys(by).map(function (k) { return k + ' ' + by[k]; }).join(', ') +
      ') — dernier le ' + new Date(last.d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' par ' + (last.by || '?');
  }

  function openSheet(id, opts) {
    var h = id ? T.store.get(id) : null;
    if (id && !h) return;
    opts = opts || {};
    cur = { id: id || null, lat: opts.lat, lng: opts.lng };
    var my = ++token;
    T.$('#sheetTitle').textContent = h ? 'Modifier l\'habitation' : (opts.street ? 'Autre logement' : 'Nouvelle habitation');
    T.$('#fStreet').value = h ? h.street : (opts.street || '');
    T.$('#fNumber').value = h ? h.number : (opts.number || '');
    T.$('#fUnit').value = h ? (h.unit || '') : '';
    T.$('#fNote').value = h ? h.note : '';
    T.$('#fCount').value = 1;
    T.$('#fDog').checked = !!(h && h.dog);
    T.$('#fFF').checked = !!(h && h.ff);
    T.$('#fPay').value = h && h.pay || '';
    T.$('#fAmount').value = h && h.pay && h.pay !== 'gratuit' && h.amount != null ? String(h.amount).replace('.', ',') : '';
    T.$('#fMotif').value = h && h.motif || '';
    T.$('#fCal').value = h && h.pay ? (h.cal > 0 ? h.cal : 1) : 1;
    T.$('#fSouche').value = h && h.souche || '';
    T.$('#fDonor').value = h && h.donor || '';
    T.$('#fReceipt').checked = !!(h && h.receipt);
    T.$('#fEmail').value = h && h.email || '';
    syncDonUi();
    T.$('#rowCount').classList.toggle('hidden', !!h || !!opts.street);
    T.$('#streetList').innerHTML = T.store.streets().map(function (s) { return '<option value="' + T.esc(s) + '">'; }).join('');
    T.$$('#statusBtns button').forEach(function (b) {
      b.classList.toggle('cur', !!h && b.getAttribute('data-s') === h.status);
    });
    renderUnitChips(h);
    renderVisits(h);
    T.$('#sheetExtra').classList.toggle('hidden', !h);
    T.$('#sheet').classList.remove('hidden');

    if (!h && !opts.street && cur.lat != null) {
      // Nouvelle habitation : on propose la rue et le numéro d'après la carte
      T.map.reverse(cur.lat, cur.lng).then(function (r) {
        if (token !== my || cur.id) return;
        if (!T.$('#fStreet').value) T.$('#fStreet').value = r.street || lastStreet;
        if (!T.$('#fNumber').value) T.$('#fNumber').value = r.number;
      });
    }
  }

  function closeSheet() {
    T.$('#sheet').classList.add('hidden');
    cur = null; token++;
  }

  function commit(status) {
    if (!cur) return;
    var street = T.$('#fStreet').value.trim();
    var number = T.$('#fNumber').value.trim();
    var unit = T.$('#fUnit').value.trim();
    var note = T.$('#fNote').value.trim();
    var dog = T.$('#fDog').checked, ff = T.$('#fFF').checked;
    if (!street && !number) { T.toast('Indiquez au moins une rue ou un numéro'); return; }
    var don = readDon();
    if (!don) return;
    if (don.pay && status !== 'passe') { T.toast('Un don se saisit avec le statut « Passé »'); return; }
    if (cur.id) {
      T.store.update(cur.id, { street: street, number: number, unit: unit, note: note, dog: dog, ff: ff, status: status,
        pay: don.pay, amount: don.amount, cal: don.cal, motif: don.motif, donor: don.donor, receipt: don.receipt, email: don.email, souche: don.souche }, { visit: true });
    } else {
      var count = Math.max(1, Math.min(60, parseInt(T.$('#fCount').value, 10) || 1));
      if (count === 1) {
        var dup = T.store.atAddress(street, number).some(function (h) {
          return (h.unit || '').toLowerCase() === unit.toLowerCase();
        });
        if (dup) { T.toast('Cette habitation existe déjà : précisez le logement (ex. Apt 2)'); return; }
        T.store.add({ street: street, number: number, unit: unit, note: note, dog: dog, ff: ff, status: status, lat: cur.lat, lng: cur.lng,
          pay: don.pay, amount: don.amount, cal: don.cal, motif: don.motif, donor: don.donor, receipt: don.receipt, email: don.email, souche: don.souche });
      } else {
        // Immeuble : plusieurs logements créés d'un coup à la même adresse
        for (var i = 1; i <= count; i++) {
          T.store.add({ street: street, number: number, unit: (unit ? unit + ' ' : 'Logt ') + i, note: note, dog: dog, ff: ff, status: status, lat: cur.lat, lng: cur.lng });
        }
      }
    }
    lastStreet = street;
    closeSheet();
    T.toast('Enregistré : ' + T.STATUS[status].label);
  }

  /* ---------- bilan ---------- */
  function buildBilan() {
    T.$('#bilanBody').innerHTML =
      '<div class="grid" id="kpiBox"></div>' +
      '<div class="card"><h3>Avancement</h3><div class="bar" id="barBox"></div><small id="barTxt" class="hint"></small></div>' +
      '<div class="card"><h3>Par équipe</h3><div id="teamBox"></div></div>' +
      '<div class="card"><h3>Par secteur</h3><div id="sectorBox2"></div></div>' +
      '<div class="card"><h3>Passages (nombre de visites)</h3><div id="visitBox"></div></div>' +
      '<div class="card"><h3>Compte</h3>' +
        '<p id="accountTxt" style="margin:0 0 8px"></p>' +
        '<div class="btn-col"><button id="btnSyNow" class="btn-sec" type="button">Synchroniser maintenant</button>' +
        '<button id="btnLogout" class="btn-sec" type="button">Se déconnecter</button></div>' +
        '<p id="syncStatus" class="hint"></p></div>' +
      '<div class="card"><h3>Sauvegardes automatiques</h3>' +
        '<p class="hint" style="margin-top:0">Une copie de toutes les données est envoyée toutes les heures dans le dépôt privé (un fichier par jour). Elle est suspendue si les données disparaissent d\'un coup.</p>' +
        '<p id="bkInfo" class="hint"></p><div id="bkList"></div>' +
        '<button id="btnBkList" class="btn-sec" type="button" style="width:100%">Voir les sauvegardes</button></div>' +
      '<div class="card"><h3>Sauvegarde</h3><div class="btn-col">' +
        '<button id="btnJson" class="btn-sec" type="button">Exporter (JSON)</button>' +
        '<button id="btnCsv" class="btn-sec" type="button">Exporter pour Excel (CSV)</button>' +
        '<button id="btnImport" class="btn-sec" type="button">Importer une sauvegarde</button>' +
        '<button id="btnReset" class="btn-danger" type="button">Tout effacer</button></div></div>' +
      '<p class="hint" style="text-align:center">Version ' + T.VERSION + ' · © Jérémy Bizeul / Vigie-lance</p>';

    T.$('#btnSyNow').addEventListener('click', function () {
      if (!T.sync.isOn()) { T.toast('Non connecté'); return; }
      T.sync.now();
    });
    T.$('#btnLogout').addEventListener('click', function () {
      if (!confirm('Se déconnecter ? Les modifications non envoyées restent sur cet appareil.')) return;
      T.sync.signOut();
      T.store.setTeam('');
      showTab('map');
      showLogin();
      refresh();
    });

    T.$('#btnBkList').addEventListener('click', function () {
      var box = T.$('#bkList');
      if (!T.sync.isOn()) { T.toast('Non connecté'); return; }
      box.innerHTML = '<p class="hint">Chargement…</p>';
      T.sync.listBackups().then(function (l) {
        box.innerHTML = l.length ? l.map(function (f) {
          var d = f.name.replace('.json', '').split('-');
          return '<div class="row-h"><div class="main"><b>' + (d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : T.esc(f.name)) + '</b><small>' + Math.round(f.size / 1024) + ' Ko</small></div>' +
            '<button class="btn-sec" type="button" data-bk="' + T.esc(f.name) + '" data-a="restore">Restaurer</button> ' +
            '<button class="btn-sec" type="button" data-bk="' + T.esc(f.name) + '" data-a="dl">Télécharger</button></div>';
        }).join('') : '<p class="hint">Aucune sauvegarde pour l\'instant (la première part après une synchronisation réussie).</p>';
      }).catch(function (e) { box.innerHTML = '<p class="hint">' + T.esc(e.message || 'Erreur') + '</p>'; });
    });
    T.$('#bkList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-bk]');
      if (!b) return;
      var name = b.getAttribute('data-bk'), act = b.getAttribute('data-a');
      if (act === 'restore' && !confirm('Remettre les adresses de la sauvegarde du ' + name.replace('.json', '') + ' qui ont disparu ?\nRien d\'existant n\'est modifié ni supprimé.')) return;
      T.sync.getBackup(name).then(function (txt) {
        if (act === 'dl') { T.download('sauvegarde-tournee-' + name, txt, 'application/json'); return; }
        var res = T.store.restoreMissing(JSON.parse(txt));
        T.toast(res.msg);
      }).catch(function (err) { T.toast(err.message || 'Erreur'); });
    });
    T.$('#btnJson').addEventListener('click', function () {
      T.download('tournee-' + new Date().toISOString().slice(0, 10) + '.json', T.store.exportJSON(), 'application/json');
    });
    T.$('#btnCsv').addEventListener('click', function () {
      T.download('tournee-' + new Date().toISOString().slice(0, 10) + '.csv', T.store.exportCSV(), 'text/csv;charset=utf-8');
    });
    T.$('#btnImport').addEventListener('click', function () { T.$('#fileImport').click(); });
    T.$('#fileImport').addEventListener('change', function () {
      var f = this.files && this.files[0];
      var input = this;
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var res = T.store.importJSON(String(r.result));
        T.toast(res.ok ? 'Import : ' + res.msg : res.msg);
        input.value = '';
      };
      r.readAsText(f);
    });
    T.$('#btnReset').addEventListener('click', function () {
      var msg = 'Effacer toutes les habitations ?' + (T.sync.isOn() ? '\nElles seront aussi effacées chez les autres testeurs.' : '');
      if (confirm(msg)) { T.store.reset(); T.toast('Tout est effacé'); }
    });
  }

  function renderBilan() {
    (function () {
      var i = T.sync.backupInfo(), el = T.$('#bkInfo');
      if (!el) return;
      el.textContent = !T.sync.isOn() ? '' : i.skipped ? '⚠ Sauvegarde suspendue : le nombre d\'adresses a fortement baissé. La dernière bonne copie est conservée.' :
        i.at ? 'Dernière sauvegarde de cet appareil : ' + new Date(i.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' (' + i.n + ' adresses)' : 'Pas encore de sauvegarde envoyée depuis cet appareil.';
    })();
    var s = T.store.stats();
    var kpis = [['Habitations', s.total, '#1d2024']].concat(T.STATUS_ORDER.map(function (k) { return [T.STATUS[k].label, s[k], T.STATUS[k].color]; }));
    T.$('#kpiBox').innerHTML = kpis.map(function (k) {
      return '<div class="kpi" style="border-left-color:' + k[2] + '"><b>' + k[1] + '</b><span>' + T.esc(k[0]) + '</span></div>';
    }).join('');
    T.$('#barBox').innerHTML = s.total ? T.STATUS_ORDER.map(function (k) {
      return '<i style="width:' + (100 * s[k] / s.total) + '%;background:' + T.STATUS[k].color + '"></i>';
    }).join('') : '';
    var done = s.total ? Math.round(100 * (s.total - s.todo) / s.total) : 0;
    T.$('#barTxt').textContent = done + ' % des habitations visitées';
    var vs = T.store.visitStats();
    T.$('#visitBox').innerHTML = vs.total
      ? '<p style="margin:0 0 6px"><b>' + vs.total + '</b> passage(s) sur <b>' + vs.housesVisited + '</b> habitation(s) — <b>' + vs.multi + '</b> visitée(s) plus d\'une fois</p>' +
        '<table><tr><th>Équipe</th><th>Passages</th></tr>' + Object.keys(vs.byTeam).sort().map(function (k) {
          return '<tr><td>' + T.esc(k) + '</td><td>' + vs.byTeam[k] + '</td></tr>'; }).join('') + '</table>'
      : '<p class="hint">Aucun passage enregistré.</p>';
    var bt = T.store.byTeam(), keys = Object.keys(bt);
    T.$('#teamBox').innerHTML = keys.length
      ? '<table><tr><th>Équipe</th><th>Passé</th><th>À repasser</th><th>Refus</th><th>Inhabité</th></tr>' +
        keys.sort().map(function (k) {
          return '<tr><td>' + T.esc(k) + '</td><td>' + bt[k].passe + '</td><td>' + bt[k].repasser + '</td><td>' + bt[k].refus + '</td><td>' + bt[k].inhabite + '</td></tr>';
        }).join('') + '</table>'
      : '<p class="hint">Rien de saisi pour l\'instant.</p>';
    var bs = T.store.bySector(), sk = Object.keys(bs);
    T.$('#sectorBox2').innerHTML = T.store.sectors().length && sk.length
      ? '<table><tr><th>Secteur</th><th>Passé</th><th>À repasser</th><th>Refus</th><th>Inhab.</th><th>Reste</th></tr>' +
        sk.sort(function (a, b) { return a === 'Hors secteur' ? 1 : b === 'Hors secteur' ? -1 : a.localeCompare(b, 'fr'); }).map(function (k) {
          var x = bs[k];
          return '<tr><td>' + T.esc(k) + ' <small>(' + (x.total - x.todo) + '/' + x.total + ')</small></td><td>' + x.passe + '</td><td>' + x.repasser + '</td><td>' + x.refus + '</td><td>' + x.inhabite + '</td><td>' + x.todo + '</td></tr>';
        }).join('') + '</table>'
      : '<p class="hint">Aucun secteur créé : Liste → Secteurs.</p>';
    T.$('#accountTxt').textContent = T.sync.user() ? 'Connecté : ' + T.sync.user() : 'Non connecté';
  }

  function refresh() { renderStats(); renderBilan(); }

  /* ---------- démarrage ---------- */
  function init() {
    T.$$('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
    });
    buildStatusBtns();
    buildBilan();
    if (T.stats) T.stats.init();
    bindLogin();
    // La case « chien » s'enregistre tout de suite pour une habitation existante
    T.$('#fFF').addEventListener('change', function () {
      if (cur && cur.id) { T.store.update(cur.id, { ff: this.checked }); T.toast(this.checked ? '🧑‍🚒 Ancien pompier noté' : 'Ancien pompier retiré'); }
    });
    T.$('#fDog').addEventListener('change', function () {
      if (cur && cur.id) { T.store.update(cur.id, { dog: this.checked }); T.toast(this.checked ? '🐶 Chien noté' : 'Chien retiré'); }
    });
    buildQuick();
    T.$('#fPay').addEventListener('change', syncDonUi);
    T.$('#fAmount').addEventListener('input', updateQuick);
    T.$('#fReceipt').addEventListener('change', syncDonUi);
    T.$('#btnClose').addEventListener('click', closeSheet);
    T.$('#sheet').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });

    T.$('#unitChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-u]');
      if (b) openSheet(b.getAttribute('data-u'));
    });
    T.$('#btnAddUnit').addEventListener('click', function () {
      var h = cur && T.store.get(cur.id);
      if (!h) return;
      var street = h.street, number = h.number, lat = h.lat, lng = h.lng;
      closeSheet();
      openSheet(null, { street: street, number: number, lat: lat, lng: lng });
      T.$('#fUnit').focus();
    });
    T.$('#btnGoMap').addEventListener('click', function () {
      var h = cur && T.store.get(cur.id);
      if (!h) return;
      closeSheet(); showTab('map');
      if (h.lat == null) T.map.startPlacing(h.id);                    // pas encore placée : on propose de la placer
      else T.map.focus(h);
    });
    T.$('#btnPlace').addEventListener('click', function () {
      var id = cur && cur.id;
      if (!id) return;
      closeSheet(); showTab('map'); T.map.startPlacing(id);
    });
    T.$('#btnDelete').addEventListener('click', function () {
      var id = cur && cur.id;
      if (id && confirm('Supprimer cette habitation ?')) { T.store.remove(id); closeSheet(); T.toast('Supprimée'); }
    });

    T.bus.on('change', refresh);
    T.map.init();
    T.list.init();
    T.imp.init();
    T.finance.init();
    T.pull.init();
    T.store.dedupe();               // nettoie d'éventuels doublons déjà présents
    T.sync.init();
    refresh();
    if (T.sync.isOn()) hideLogin(); else showLogin();
  }

  T.app = { openSheet: openSheet, showTab: showTab };
  init();
})();
