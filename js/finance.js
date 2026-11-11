/*!
 * Tournée calendriers — finance.js (onglet Comptage : en tournée, ponctuel, à rendre)
 * Les montants viennent des fiches habitations ; le comptage de caisse reprend celui du tableur de la tournée.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var ESP = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
  var group = 'team', caisseTeam = '', caisseDay = '', panel = 'tournee';
  try { panel = localStorage.getItem('bfs_briec_panel') || 'tournee'; } catch (e) { panel = 'tournee'; }
  if (['tournee', 'ponctuel', 'rendre'].indexOf(panel) < 0) panel = 'tournee';
  var fmt = function (n) { return T.money.fmt(n); };

  function active() { return T.$('#view-dons').classList.contains('active'); }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ---------- bilan ---------- */
  var GROUP_LABEL = { team: 'Équipe', quartier: 'Quartier', sector: 'Secteur', day: 'Jour', souche: 'Souche' };
  function calTxt(b) {
    var x = [];
    if (b.gift) x.push(b.gift + ' donnés');
    if (b.cs) x.push(b.cs + ' autre CS');
    return b.cal + (x.length ? '<br><small>dont ' + x.join(', ') + '</small>' : '');
  }

  function renderSummary() {
    var f = T.store.finance(), a = f.all;
    var kpis = [
      ['Total collecté', fmt(a.total), '#1d2024'],
      ['Don moyen (' + a.nPaid + ' dons payants)', fmt(a.avg), '#1d2024'],
      ['Espèces', fmt(a.esp), '#2e9e4f'],
      ['Chèques', fmt(a.chq), '#f0952b'],
      ['Calendriers distribués', String(a.cal), '#1d2024'],
      ['Vendus (contre un don)', String(a.sold), '#2e9e4f'],
      ['Donnés / autre CS / gardés', a.gift + ' / ' + a.cs + ' / ' + a.kept, '#8a8f98']
    ];
    T.$('#finKpi').innerHTML = kpis.map(function (k) {
      return '<div class="kpi" style="border-left-color:' + k[2] + '"><b style="font-size:20px">' + T.esc(k[1]) + '</b><span>' + T.esc(k[0]) + '</span></div>';
    }).join('');

    T.$$('#finGroups .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-g') === group); });
    var rows = f[group], keys = Object.keys(rows).sort(function (x, y) { return x.localeCompare(y, 'fr'); });
    T.$('#finTable').innerHTML = keys.length
      ? '<table><tr><th>' + GROUP_LABEL[group] + '</th><th>Total</th><th>Esp.</th><th>Chq.</th><th>Moy.</th><th>Cal.</th></tr>' +
        keys.map(function (k) {
          var b = rows[k];
          return '<tr><td>' + T.esc(k) + '</td><td>' + fmt(b.total) + '</td><td>' + fmt(b.esp) + '</td><td>' + fmt(b.chq) + '</td><td>' + (b.nPaid ? fmt(b.avg) : '—') + '</td><td>' + calTxt(b) + '</td></tr>';
        }).join('') +
        (group === 'souche' ? '' : '<tr><th>Total</th><th>' + fmt(a.total) + '</th><th>' + fmt(a.esp) + '</th><th>' + fmt(a.chq) + '</th><th>' + (a.nPaid ? fmt(a.avg) : '—') + '</th><th>' + calTxt(a) + '</th></tr>') + '</table>' +
        (group === 'souche' ? '<p class="hint">Dons sans n° de souche : ils apparaissent sur la ligne « sans n° de souche ». Le n° se note dans la fiche, à côté du don.</p>' : '')
      : '<p class="hint">Aucun don saisi pour l\'instant. Ouvrez une habitation, notez le montant et le paiement, puis touchez « Passé ».</p>';

    renderStock();
    renderIndemnite();
    renderHisto();
    renderReceipts();
  }

  /* ---------- stock de calendriers ---------- */
  var stockTeam = '';
  function renderStock() {
    var teams = teamList();
    if (!stockTeam || teams.indexOf(stockTeam) < 0) stockTeam = teams.indexOf(T.store.team()) >= 0 ? T.store.team() : teams[0];
    var sel = T.$('#stockTeam');
    // on ne reconstruit pas les champs pendant la saisie
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#stockForm')) return renderStockTable();
    sel.innerHTML = teams.map(function (t) { return '<option' + (t === stockTeam ? ' selected' : '') + '>' + T.esc(t) + '</option>'; }).join('');
    var s = T.store.getStock(stockTeam);
    T.$('#stRecu').value = s ? s.recu : '';
    T.$('#stRendu').value = s ? s.rendu : '';
    renderStockTable();
  }
  function renderStockTable() {
    var C = T.store.calendriers();
    T.$('#stockTable').innerHTML = '<table><tr><th>Personne</th><th>Reçus</th><th>Vendus</th><th>Donnés</th><th>Autre CS</th><th>Gardés</th><th>Rendus</th><th>Écart</th></tr>' +
      C.rows.map(function (r) {
        return '<tr><td>' + T.esc(r.who) + '</td><td>' + (r.recu === null ? '—' : r.recu) + '</td><td>' + r.sold + '</td><td>' + r.gift + '</td><td>' + r.cs + '</td><td>' + r.kept + '</td><td>' + (r.rendu === null ? '—' : r.rendu) + '</td>' +
          (r.ecart === null ? '<td class="hint">à saisir</td>' : r.ecart === 0 ? '<td class="ok">OK</td>' : '<td class="ko">' + (r.ecart > 0 ? '+' : '') + r.ecart + '</td>') + '</tr>';
      }).join('') + '<tr><th>Total</th><th>' + C.rows.reduce(function (s, r) { return s + (r.recu || 0); }, 0) + '</th><th>' + C.all.sold + '</th><th>' + C.all.gift + '</th><th>' + C.all.cs + '</th><th>' + C.all.kept + '</th><th>' + C.rows.reduce(function (s, r) { return s + (r.rendu || 0); }, 0) + '</th><th></th></tr></table>' +
      '<p class="hint">Autre CS = calendriers donnés à d\'autres centres (échange entre casernes). Écart = reçus − vendus − donnés − autre CS − gardés − rendus. À 0, tous les calendriers sont justifiés. Positif : il manque des calendriers.</p>';
  }

  /* ---------- indemnisation des distributeurs ---------- */
  function renderIndemnite() {
    var I = T.store.indemnite();
    // on ne touche pas aux champs pendant la saisie
    if (!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#indForm'))) {
      T.$('#indRate').value = String(I.rate).replace('.', ',');
      T.$('#indFixe').value = String(I.fixe).replace('.', ',');
      T.$('#indNb').value = I.nb;
    }
    T.$('#indRes').innerHTML = '<table><tr><td>' + I.dist + ' calendriers × ' + fmt(I.rate) + ' + forfait ' + fmt(I.fixe) + '</td><td class="n"><b>' + fmt(I.cost) + '</b></td></tr>' +
      '<tr><td>Par personne (' + I.nb + ')</td><td class="n"><b>' + fmt(I.each) + '</b></td></tr>' +
      '<tr><td>Total collecté − coût</td><td class="n"><b>' + fmt(I.net) + '</b></td></tr></table>';
  }

  /* ---------- comparaison avec les années passées ---------- */
  function renderHisto() {
    var I = T.store.indemnite(), rows = T.histoCompare();
    function d(v) { return v == null ? '—' : '<span class="' + (v >= 0 ? 'ok' : 'ko') + '">' + (v > 0 ? '+' : '') + fmt(v) + '</span>'; }
    T.$('#histoTable').innerHTML = '<table><tr><th>Année</th><th>Total</th><th>Écart</th><th>Net</th><th>Écart</th></tr>' +
      '<tr><td><b>' + T.TOURNEE.year + '</b></td><td><b>' + fmt(I.total) + '</b></td><td></td><td><b>' + fmt(I.net) + '</b></td><td></td></tr>' +
      rows.map(function (r) {
        return '<tr><td>' + r.y + '</td><td>' + fmt(r.total) + '</td><td>' + d(r.dTotal) + '</td><td>' + (r.net == null ? '—' : fmt(r.net)) + '</td><td>' + d(r.dNet) + '</td></tr>';
      }).join('') + '</table>' +
      '<p class="hint">Écart = cette année moins l\'année du tableau. Net = total collecté moins le coût des calendriers.</p>';
  }

  /* ---------- reçus / factures ---------- */
  function renderReceipts() {
    var list = T.store.receipts();
    T.$('#rcTxt').textContent = list.length + ' reçu(s) ou facture(s) demandé(s)';
    T.$('#rcList').innerHTML = list.map(function (h) {
      var addr = h.street + ' ' + h.number + (h.unit ? ' · ' + h.unit : '');
      return '<div class="row-h" data-id="' + h.id + '"><div class="main"><b>' + T.esc(h.donor || '(nom à compléter)') + '</b>' +
        '<small>' + T.esc(addr) + ' · ' + T.esc(T.money.label(h) || 'pas de don saisi') + (h.email ? ' · ' + T.esc(h.email) : '') + '</small></div></div>';
    }).join('');
  }

  /* ---------- caisse ---------- */
  function teamList() {
    var f = T.store.finance(), seen = {};
    Object.keys(f.team).forEach(function (t) { seen[t] = 1; });
    T.store.teamsWithCaisse().forEach(function (t) { seen[t] = 1; });
    if (T.store.team()) seen[T.store.team()] = 1;
    var l = Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    return l.length ? l : ['(sans équipe)'];
  }

  function dayLabel(d) {
    var p = d.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] + (d === T.store.today() ? ' (aujourd\'hui)' : '') : d;
  }
  function key(v) { return String(v).replace('.', '_'); }

  function table(title, denoms, kind, saved) {
    return '<table class="caisse"><tr><th>' + title + '</th><th>Quantité</th><th>Montant</th></tr>' +
      denoms.map(function (d) {
        var q = saved && saved[kind] && saved[kind][key(d)] || '';
        return '<tr><td>' + fmt(d) + '</td><td><input type="number" min="0" step="1" inputmode="numeric" class="cq" data-k="' + kind + '" data-d="' + d + '" value="' + q + '"></td>' +
          '<td class="cm" data-m="' + kind + '-' + key(d) + '"></td></tr>';
      }).join('') + '</table>';
  }

  // Chèques : pas de saisie à refaire. On liste ceux saisis ce jour-là (par montant) et on confirme chaque quantité.
  function chequeTable(prev) {
    var seen = T.store.chequesDay(caisseTeam, caisseDay), done = prev ? prev.chq : {}, keys = [];
    Object.keys(seen).forEach(function (k) { if (seen[k] - (done[k] || 0) > 0) keys.push(k); });   // reste à compter
    keys.sort(function (a, b) { return parseFloat(b.replace('_', '.')) - parseFloat(a.replace('_', '.')); });
    if (!keys.length) return '<table class="caisse"><tr><th>Chèques</th></tr><tr><td class="hint">' +
      (Object.keys(seen).length ? 'Tous les chèques saisis ce jour-là sont déjà comptés.' : 'Aucun chèque saisi ce jour-là.') + '</td></tr></table>';
    return '<table class="caisse"><tr><th>Chèques</th><th>À compter</th><th>Quantité</th><th>Confirmé</th></tr>' + keys.map(function (k) {
      var d = parseFloat(k.replace('_', '.')), n = seen[k] - (done[k] || 0);
      return '<tr><td>' + fmt(d) + '</td><td>' + n + '</td><td><input type="number" min="0" step="1" inputmode="numeric" class="cqc" data-d="' + k + '" data-n="' + n + '" value="' + n + '"></td>' +
        '<td><input type="checkbox" class="cqk" data-d="' + k + '"></td></tr>';
    }).join('') + '</table><p class="hint">Cochez chaque ligne quand le nombre de chèques en main est bon (corrigez la quantité si besoin).</p>';
  }

  // Historique de tous les comptages (récents en premier) : touchez une ligne pour voir la quantité de chaque valeur
  var openCount = {};
  function detailRows(map) {
    return Object.keys(map).sort(function (a, b) { return parseFloat(b.replace('_', '.')) - parseFloat(a.replace('_', '.')); }).map(function (k) {
      var d = parseFloat(k.replace('_', '.'));
      return '<tr><td>' + fmt(d) + '</td><td class="n">× ' + map[k] + '</td><td class="n">' + fmt(d * map[k]) + '</td></tr>';
    }).join('');
  }
  function renderCountHist() {
    var box = T.$('#countHist');
    if (!box) return;
    var l = T.store.countings();
    box.innerHTML = l.length ? '<table><tr><th>Quand</th><th>Qui / jour</th><th>Esp.</th><th>Chq.</th><th>Total</th><th></th></tr>' + l.map(function (c) {
      var dt = c.at ? new Date(c.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—', op = !!openCount[c.key];
      var det = '';
      if (op) {
        var e = detailRows(c.esp), q = detailRows(c.chq);
        det = '<tr><td colspan="6" style="background:#f6f7f9">' +
          (e ? '<b>Espèces</b><table class="caisse">' + e + '</table>' : '') +
          (q ? '<b>Chèques</b><table class="caisse">' + q + '</table>' : '') +
          (c.chqOther ? '<p class="hint">Autres chèques : ' + fmt(c.chqOther) + '</p>' : '') +
          (!e && !q && !c.chqOther ? '<p class="hint">Comptage vide.</p>' : '') + '</td></tr>';
      }
      return '<tr data-toggle="' + T.esc(c.key) + '" style="cursor:pointer"><td>' + (op ? '▾ ' : '▸ ') + dt + '</td><td>' + T.esc(c.who) + '<br><small>' + dayLabel(c.day).replace(' (aujourd\'hui)', '') + '</small></td><td class="n">' + fmt(c.tEsp) + '</td><td class="n">' + fmt(c.tChq) + '</td><td class="n"><b>' + fmt(c.tEsp + c.tChq) + '</b></td>' +
        '<td><button type="button" class="btn-danger" data-delcount="' + T.esc(c.key) + '">✕</button></td></tr>' + det;
    }).join('') + '</table><p class="hint">Touchez une ligne pour voir la quantité de chaque coupure et de chaque montant de chèque.</p>' : '<p class="hint">Aucun comptage enregistré.</p>';
  }

  function buildCaisse() {
    var sel = T.$('#caisseTeam');
    var teams = teamList();
    var days = T.store.caisseDays();
    if (!caisseDay || days.indexOf(caisseDay) < 0) caisseDay = days[0];
    T.$('#caisseDay').innerHTML = days.map(function (d) {
      return '<option value="' + d + '"' + (d === caisseDay ? ' selected' : '') + '>' + dayLabel(d) + '</option>';
    }).join('');
    if (!caisseTeam || teams.indexOf(caisseTeam) < 0) caisseTeam = teams.indexOf(T.store.team()) >= 0 ? T.store.team() : teams[0];
    sel.innerHTML = teams.map(function (t) { return '<option' + (t === caisseTeam ? ' selected' : '') + '>' + T.esc(t) + '</option>'; }).join('');
    // Le formulaire repart toujours à zéro : chaque enregistrement est un comptage de plus (voir l'historique)
    var prev = T.store.getCaisse(caisseTeam, caisseDay);
    T.$('#caisseBox').innerHTML = table('Espèces', ESP, 'esp', null) + chequeTable(prev) + '<div id="caisseRes"></div>';
    T.$('#caisseMsg').textContent = prev ? prev.n + ' comptage(s) déjà enregistré(s) pour ce jour : ' + fmt(prev.tEsp + prev.tChq) + '.' : 'Aucun comptage enregistré pour ce jour.';
    computeCaisse();
    renderCountHist();
  }

  // Lecture des quantités saisies
  function readCaisse() {
    var out = { esp: {}, chq: {}, chqOther: 0 };
    T.$$('#caisseBox .cq').forEach(function (i) {
      var q = parseInt(i.value, 10);
      if (q > 0) out.esp[key(i.getAttribute('data-d'))] = q;
    });
    T.$$('#caisseBox .cqk').forEach(function (c) {
      if (!c.checked) return;
      var k = c.getAttribute('data-d'), i = T.$('#caisseBox .cqc[data-d="' + k + '"]'), q = parseInt(i.value, 10);
      if (q >= 0) out.chq[k] = q;
    });
    return out;
  }

  function computeCaisse() {
    var c = readCaisse(), counted = { esp: 0, chq: 0 };
    T.$$('#caisseBox .cq').forEach(function (i) {
      var k = i.getAttribute('data-k'), d = parseFloat(i.getAttribute('data-d')), q = parseInt(i.value, 10) || 0;
      counted[k] += Math.round(d * 100) * q;
      var cell = T.$('[data-m="' + k + '-' + key(d) + '"]');
      if (cell) cell.textContent = q ? fmt(d * q) : '';
    });
    Object.keys(c.chq).forEach(function (k) { counted.chq += Math.round(parseFloat(k.replace('_', '.')) * 100) * c.chq[k]; });
    var prev = T.store.getCaisse(caisseTeam, caisseDay);
    if (prev) { counted.esp += Math.round(prev.tEsp * 100); counted.chq += Math.round(prev.tChq * 100); }
    var todo = 0, diffq = 0;
    T.$$('#caisseBox .cqk').forEach(function (cb) {
      var k = cb.getAttribute('data-d'), q = T.$('#caisseBox .cqc[data-d="' + k + '"]');
      if (!cb.checked) todo++; else if (parseInt(q.value, 10) !== parseInt(q.getAttribute('data-n'), 10)) diffq++;
    });
    var t = T.store.financeDay(caisseTeam, caisseDay);
    function line(label, cnt, exp) {
      var diff = r2(cnt / 100 - exp);
      return '<tr><td>' + label + '</td><td>' + fmt(cnt / 100) + '</td><td>' + fmt(exp) + '</td>' +
        '<td class="' + (Math.abs(diff) < 0.005 ? 'ok' : 'ko') + '">' + (Math.abs(diff) < 0.005 ? 'OK' : (diff > 0 ? '+' : '') + fmt(diff)) + '</td></tr>';
    }
    T.$('#caisseRes').innerHTML = '<table><tr><th></th><th>Compté' + (prev ? ' (cumul du jour)' : '') + '</th><th>Saisi</th><th>Écart</th></tr>' +
      line('Espèces', counted.esp, t.esp) + line('Chèques', counted.chq, t.chq) +
      line('Total', counted.esp + counted.chq, t.esp + t.chq) + '</table>' +
      (todo ? '<p class="hint" style="color:#d6402f">' + todo + ' montant(s) de chèques pas encore confirmé(s).</p>' : '') +
      (diffq ? '<p class="hint" style="color:#d6402f">Quantité confirmée différente du saisi sur ' + diffq + ' ligne(s).</p>' : '') +
      '<p class="hint">' + t.n + ' don(s) saisi(s) ce jour-là' + (t.gratuit ? ' dont ' + t.gratuit + ' gratuit(s)' : '') + '. Enveloppe attendue : ' + fmt(t.esp + t.chq) + '.</p>';
  }

  /* ---------- démarrage ---------- */
  function showPanel(name) {
    panel = name;
    try { localStorage.setItem('bfs_briec_panel', name); } catch (e) { /* sans stockage : on garde en mémoire */ }
    T.$$('#finPanels .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-p') === name); });
    T.$$('#donsBody .fpan').forEach(function (x) { x.classList.toggle('hidden', x.getAttribute('data-p') !== name); });
  }

  function build() {
    T.$('#donsBody').innerHTML =
      '<div id="finPanels" class="chips" style="margin-bottom:10px"><button class="chip on" data-p="tournee">🚶 En tournée</button>' +
        '<button class="chip" data-p="ponctuel">🧮 Ponctuel</button><button class="chip" data-p="rendre">📋 À rendre</button></div>' +
      '<section class="fpan" data-p="tournee">' +
      '<div class="grid" id="finKpi"></div>' +
      '<div class="card"><h3>Bilan</h3>' +
        '<div id="finGroups" class="chips" style="margin-bottom:8px"><button class="chip on" data-g="team">Par équipe</button>' +
        '<button class="chip" data-g="quartier">Par quartier</button><button class="chip" data-g="sector">Par secteur</button><button class="chip" data-g="day">Par jour</button><button class="chip" data-g="souche">Par souche</button></div>' +
        '<div id="finTable" style="overflow-x:auto"></div></div>' +
      '<div class="card"><h3>Reçus et factures demandés</h3><p id="rcTxt" class="hint" style="margin-top:0"></p><div id="rcList"></div>' +
        '<div class="btn-col" style="margin-top:8px"><button id="btnRcCsv" class="btn-sec" type="button">Exporter les demandes de reçu (CSV)</button></div></div>' +
      '</section>' +
      '<section class="fpan hidden" data-p="ponctuel">' +
      '<div class="card"><h3>Caisse</h3>' +
        '<div class="row"><label class="grow">Personne<select id="caisseTeam"></select></label>' +
        '<label class="grow">Jour<select id="caisseDay"></select></label></div>' +
        '<div id="caisseBox"></div>' +
        '<button id="btnCaisseSave" class="btn-main" type="button">Enregistrer le comptage</button>' +
        '<p id="caisseMsg" class="hint"></p></div>' +
      '<div class="card"><h3>Historique des comptages</h3><div id="countHist" style="overflow-x:auto"></div></div>' +
      '<div class="card"><h3>Calendriers : stock et restitution</h3>' +
        '<form id="stockForm"><label>Personne<select id="stockTeam"></select></label>' +
        '<div class="row"><label class="grow">Calendriers reçus au départ<input id="stRecu" type="number" min="0" inputmode="numeric"></label>' +
        '<label class="grow">Calendriers rendus (non distribués)<input id="stRendu" type="number" min="0" inputmode="numeric"></label></div>' +
        '<button id="btnStockSave" class="btn-main" type="submit">Enregistrer</button></form>' +
        '<div id="stockTable" style="margin-top:10px;overflow-x:auto"></div>' +
        '</div>' +
      '</section>' +
      '<section class="fpan hidden" data-p="rendre">' +
      '<div class="card"><h3>Bordereau commun — ' + T.esc(T.TOURNEE.titre) + '</h3>' +
        '<p class="hint" style="margin-top:0">Une feuille à imprimer (ou enregistrer en PDF) avec les dons et les caisses comptées de tout le monde, par jour et par quartier, avec cases de signature.</p>' +
        '<div class="btn-col"><button id="btnBordereau" class="btn-main" type="button">Ouvrir le bordereau</button>' +
        '<button id="btnBordCsv" class="btn-sec" type="button">Exporter le tableau (CSV)</button></div></div>' +
      '<div class="card"><h3>Bordereau de restitution des calendriers</h3>' +
        '<p class="hint" style="margin-top:0">Calendriers reçus, vendus, donnés, gardés et rendus par personne, avec signatures.</p>' +
        '<button id="btnRestit" class="btn-main" type="button" style="width:100%">Ouvrir le bordereau de restitution</button></div>' +
      '<div class="card"><h3>Indemnisation des distributeurs</h3>' +
        '<form id="indForm"><div class="row"><label class="grow">€ par calendrier distribué<input id="indRate" type="text" inputmode="decimal"></label>' +
        '<label class="grow">Forfait (€)<input id="indFixe" type="text" inputmode="decimal"></label>' +
        '<label class="grow">Nb de personnes<input id="indNb" type="number" min="1" inputmode="numeric"></label></div>' +
        '<button class="btn-main" type="submit">Enregistrer les paramètres</button></form>' +
        '<div id="indRes" style="margin-top:10px"></div></div>' +
      '<div class="card"><h3>Comparaison avec les années passées</h3><div id="histoTable" style="overflow-x:auto"></div></div>' +
      '<div class="card"><h3>Exports</h3><button id="btnDonsCsv" class="btn-sec" type="button" style="width:100%">Exporter tous les dons (CSV)</button></div>' +
      '</section>' +
      '<p class="hint">Les noms et montants sont des données personnelles : à ne garder que le temps de la tournée, puis à supprimer.</p>';


    T.$('#finPanels').addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]');
      if (b) showPanel(b.getAttribute('data-p'));
    });
    showPanel(panel);
    T.$('#finGroups').addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]');
      if (b) { group = b.getAttribute('data-g'); renderSummary(); }
    });
    T.$('#caisseTeam').addEventListener('change', function () { caisseTeam = this.value; buildCaisse(); });
    T.$('#caisseDay').addEventListener('change', function () { caisseDay = this.value; buildCaisse(); });
    T.$('#countHist').addEventListener('click', function (e) {
      var b = e.target.closest('[data-delcount]');
      if (!b) {
        var r = e.target.closest('[data-toggle]');
        if (r) { var k = r.getAttribute('data-toggle'); openCount[k] = !openCount[k]; renderCountHist(); }
        return;
      }
      if (!confirm('Supprimer ce comptage ? Les totaux de la caisse seront recalculés.')) return;
      T.store.delCaisse(b.getAttribute('data-delcount'));
      buildCaisse();
    });
    T.$('#caisseBox').addEventListener('input', computeCaisse);
    T.$('#caisseBox').addEventListener('change', computeCaisse);
    T.$('#btnCaisseSave').addEventListener('click', function () {
      var c = readCaisse();
      if (!Object.keys(c.esp).length && !Object.keys(c.chq).length) { T.toast('Rien à enregistrer : saisissez des quantités ou confirmez des chèques'); return; }
      T.store.addCaisse(caisseTeam, caisseDay, c);
      T.toast('Comptage enregistré');
      buildCaisse();
    });
    T.$('#rcList').addEventListener('click', function (e) {
      var r = e.target.closest('[data-id]');
      if (r) T.app.openSheet(r.getAttribute('data-id'));
    });
    T.$('#stockTeam').addEventListener('change', function () { stockTeam = this.value; var s = T.store.getStock(stockTeam); T.$('#stRecu').value = s ? s.recu : ''; T.$('#stRendu').value = s ? s.rendu : ''; });
    T.$('#stockForm').addEventListener('submit', function (e) {
      e.preventDefault();
      T.store.setStock(stockTeam, T.$('#stRecu').value, T.$('#stRendu').value);
      T.toast('Stock enregistré');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      renderStock();
    });
    T.$('#indForm').addEventListener('submit', function (e) {
      e.preventDefault();
      function n(id) { return parseFloat(String(T.$(id).value).replace(',', '.')); }
      var r = n('#indRate'), f = n('#indFixe'), nb = parseInt(T.$('#indNb').value, 10);
      if (isNaN(r) || r < 0 || isNaN(f) || f < 0 || !(nb >= 1)) { T.toast('Valeurs invalides (nombres positifs, au moins 1 personne)'); return; }
      T.store.setParams(r, f, nb);
      T.toast('Paramètres enregistrés');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      renderIndemnite(); renderHisto();
    });
    T.$('#btnRestit').addEventListener('click', function () { T.bordereau.openRestitution(); });
    T.$('#btnBordereau').addEventListener('click', function () { T.bordereau.open(); });
    T.$('#btnBordCsv').addEventListener('click', function () {
      T.download('bordereau-tournee' + T.TOURNEE.num + '-' + new Date().toISOString().slice(0, 10) + '.csv', T.bordereau.csv(), 'text/csv;charset=utf-8');
    });
    T.$('#btnRcCsv').addEventListener('click', function () {
      T.download('recus-tournee' + T.TOURNEE.num + '-' + new Date().toISOString().slice(0, 10) + '.csv', T.store.exportDonsCSV(true), 'text/csv;charset=utf-8');
    });
    T.$('#btnDonsCsv').addEventListener('click', function () {
      T.download('dons-tournee' + T.TOURNEE.num + '-' + new Date().toISOString().slice(0, 10) + '.csv', T.store.exportDonsCSV(false), 'text/csv;charset=utf-8');
    });
  }

  function init() {
    build();
    // Le formulaire de caisse n'est pas redessiné à chaque changement (pour ne pas perdre la saisie en cours)
    T.bus.on('change', function () { if (active()) { renderSummary(); computeCaisse(); renderCountHist(); } });
  }

  function show() { renderSummary(); buildCaisse(); }

  T.finance = { init: init, show: show, ESP: ESP };
})();
