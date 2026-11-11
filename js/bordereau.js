/*!
 * Tournée calendriers — bordereau.js (bordereau commun et bordereau de restitution des calendriers)
 * Pages à imprimer ou enregistrer en PDF. Aucun nom de donateur n'y figure.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var fmt = function (n) { return T.money.fmt(n); };
  function dayFr(d) { var p = String(d).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
  function denomList(map) {
    return Object.keys(map).sort(function (a, b) { return parseFloat(b.replace('_', '.')) - parseFloat(a.replace('_', '.')); })
      .map(function (k) { return [parseFloat(k.replace('_', '.')), map[k]]; });
  }

  var CSS = 'body{font:14px/1.35 system-ui,sans-serif;color:#1d2024;margin:16px;max-width:900px}h1{margin:0 0 2px;font-size:22px}h2{font-size:15px;margin:20px 0 6px;border-bottom:2px solid #b3261e;padding-bottom:2px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:6px}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;font-size:13px}th{background:#f1f1f1}td.n{text-align:right;white-space:nowrap}' +
    'table.sm{width:auto;min-width:260px}.ok{color:#1b7a3a;font-weight:700}.ko{color:#c0301f;font-weight:700}.nc{color:#888}' +
    '.cols{display:flex;gap:20px;flex-wrap:wrap}.sign{display:flex;gap:30px;margin-top:30px}.sign div{flex:1;border-top:1px solid #333;padding-top:4px;min-height:60px;font-size:13px}' +
    '.bar{margin:10px 0}.bar button{padding:10px 16px;font-size:15px;border:0;border-radius:8px;background:#b3261e;color:#fff}.tot td{font-weight:700;background:#fafafa}.note{font-size:12px;color:#555}' +
    '@media print{.bar{display:none}body{margin:8mm}}';

  function wrap(title, body) {
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="author" content="Jérémy Bizeul / Vigie-lance"><meta name="copyright" content="© Jérémy Bizeul / Vigie-lance">' +
      '<title>' + T.esc(title) + ' — ' + T.esc(T.TOURNEE.titre) + '</title><style>' + CSS + '</style></head><body>' +
      '<div class="bar"><button onclick="window.print()">Imprimer / enregistrer en PDF</button></div>' +
      '<h1>' + T.esc(title) + ' — ' + T.esc(T.TOURNEE.titre) + '</h1>' +
      '<div>' + T.esc(T.TOURNEE.commune) + ' · édité le ' + new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</div>' +
      body + '<p style="font-size:11px;color:#777;margin-top:16px">© Jérémy Bizeul / Vigie-lance</p></body></html>';
  }

  // Calendriers : reçus, vendus (contre un don), donnés, gardés, rendus, écart
  function calTable(C) {
    var t = { recu: 0, sold: 0, gift: 0, cs: 0, kept: 0, rendu: 0, ecart: 0, n: 0 };
    var rows = C.rows.map(function (r) {
      t.recu += r.recu || 0; t.sold += r.sold; t.gift += r.gift; t.cs += r.cs; t.kept += r.kept; t.rendu += r.rendu || 0;
      if (r.ecart !== null) { t.ecart += r.ecart; t.n++; }
      var ec = r.ecart === null ? '<span class="nc">stock non saisi</span>' : (r.ecart === 0 ? '<span class="ok">OK</span>' : '<span class="ko">' + (r.ecart > 0 ? '+' : '') + r.ecart + '</span>');
      return '<tr><td>' + T.esc(r.who) + '</td><td class="n">' + (r.recu === null ? '—' : r.recu) + '</td><td class="n">' + r.sold + '</td><td class="n">' + r.gift + '</td><td class="n">' + r.cs + '</td><td class="n">' + r.kept + '</td>' +
        '<td class="n">' + (r.rendu === null ? '—' : r.rendu) + '</td><td class="n">' + ec + '</td></tr>';
    }).join('') || '<tr><td colspan="8">Aucun calendrier enregistré.</td></tr>';
    var motifs = Object.keys(C.motifs).map(function (m) {
      return '<tr><td>' + T.esc(T.MOTIFS[m] || m) + '</td><td class="n">' + C.motifs[m] + '</td></tr>';
    }).join('') || '<tr><td colspan="2">—</td></tr>';
    return '<table><tr><th>Personne</th><th>Reçus</th><th>Vendus (contre un don)</th><th>Donnés</th><th>Autre CS</th><th>Gardés</th><th>Rendus</th><th>Écart</th></tr>' + rows +
      '<tr class="tot"><td>TOTAL</td><td class="n">' + t.recu + '</td><td class="n">' + t.sold + '</td><td class="n">' + t.gift + '</td><td class="n">' + t.cs + '</td><td class="n">' + t.kept + '</td><td class="n">' + t.rendu + '</td><td class="n">' + (t.n ? (t.ecart === 0 ? '<span class="ok">OK</span>' : '<span class="ko">' + (t.ecart > 0 ? '+' : '') + t.ecart + '</span>') : '') + '</td></tr></table>' +
      '<p class="note">Autre CS = donnés à d\'autres centres (échange entre casernes). Écart = reçus − vendus − donnés − autre CS − gardés − rendus. 0 = tous les calendriers sont justifiés.</p>' +
      '<table class="sm"><tr><th>Calendriers gratuits : motif</th><th>Nombre</th></tr>' + motifs + '</table>';
  }

  function htmlRestitution() {
    return wrap('Bordereau de restitution des calendriers',
      '<h2>Calendriers par personne</h2>' + calTable(T.store.calendriers()) +
      '<div class="sign"><div>Les distributeurs<br>Nom, date, signature</div><div>Responsable de la tournée<br>Nom, date, signature</div></div>');
  }

  // Total par carnet de souches (personne + n°), comparé au total collecté
  function soucheTable(f) {
    var keys = Object.keys(f.souche).sort(function (a, b) { return a.localeCompare(b, 'fr', { numeric: true }); }), tot = 0;
    var rows = keys.map(function (k) {
      var b = f.souche[k]; tot += b.total;
      return '<tr><td>' + T.esc(k) + '</td><td class="n">' + b.nPaid + '</td><td class="n">' + fmt(b.total) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">—</td></tr>';
    var d = Math.round((tot - f.all.total) * 100) / 100;
    return '<table class="sm"><tr><th>Souche</th><th>Dons</th><th>Total</th></tr>' + rows +
      '<tr class="tot"><td>Total souches</td><td class="n"></td><td class="n">' + fmt(tot) + '</td></tr>' +
      '<tr><td>Total collecté</td><td class="n"></td><td class="n">' + fmt(f.all.total) + '</td></tr>' +
      '<tr><td>Différence</td><td class="n"></td><td class="n">' + (Math.abs(d) < 0.005 ? '<span class="ok">0 — OK</span>' : '<span class="ko">' + fmt(d) + '</span>') + '</td></tr></table>';
  }
  function indTable() {
    var I = T.store.indemnite();
    return '<table class="sm"><tr><td>' + I.dist + ' calendriers × ' + fmt(I.rate) + ' + forfait ' + fmt(I.fixe) + '</td><td class="n"><b>' + fmt(I.cost) + '</b></td></tr>' +
      '<tr><td>Par personne (' + I.nb + ')</td><td class="n"><b>' + fmt(I.each) + '</b></td></tr>' +
      '<tr><td>Total collecté − coût</td><td class="n"><b>' + fmt(I.net) + '</b></td></tr></table>';
  }
  function histoTable() {
    var I = T.store.indemnite();
    function d(v) { return v == null ? '—' : '<span class="' + (v >= 0 ? 'ok' : 'ko') + '">' + (v > 0 ? '+' : '') + fmt(v) + '</span>'; }
    return '<table class="sm"><tr><th>Année</th><th>Total</th><th>Écart</th><th>Net</th><th>Écart</th></tr>' +
      '<tr class="tot"><td>' + T.TOURNEE.year + '</td><td class="n">' + fmt(I.total) + '</td><td></td><td class="n">' + fmt(I.net) + '</td><td></td></tr>' +
      T.histoCompare().map(function (r) {
        return '<tr><td>' + r.y + '</td><td class="n">' + fmt(r.total) + '</td><td class="n">' + d(r.dTotal) + '</td><td class="n">' + (r.net == null ? '—' : fmt(r.net)) + '</td><td class="n">' + d(r.dNet) + '</td></tr>';
      }).join('') + '</table><p class="note">Écart = cette année moins l\'année indiquée.</p>';
  }
  function chqAmtTable(f) {
    var keys = Object.keys(f.chqAmt).sort(function (a, b) { return parseFloat(b) - parseFloat(a); }), n = 0, tot = 0;
    var rows = keys.map(function (k) { n += f.chqAmt[k]; tot += parseFloat(k) * f.chqAmt[k];
      return '<tr><td>' + fmt(parseFloat(k)) + '</td><td class="n">' + f.chqAmt[k] + '</td><td class="n">' + fmt(parseFloat(k) * f.chqAmt[k]) + '</td></tr>'; }).join('') || '<tr><td colspan="3">—</td></tr>';
    return '<table class="sm"><tr><th>Montant du chèque</th><th>Nombre</th><th>Total</th></tr>' + rows +
      '<tr class="tot"><td>Total</td><td class="n">' + n + '</td><td class="n">' + fmt(tot) + '</td></tr></table>';
  }

  function html() {
    var B = T.store.bordereau(), f = B.fin;
    var totCompte = 0, nCompte = 0;
    var lines = B.rows.map(function (r) {
      var cEsp = '—', cChq = '—', ecart = '<span class="nc">non compté</span>';
      if (r.compte) {
        totCompte += r.compte.esp + r.compte.chq; nCompte++;
        cEsp = fmt(r.compte.esp); cChq = fmt(r.compte.chq);
        var d = Math.round((r.compte.esp + r.compte.chq - r.saisi.total) * 100) / 100;
        ecart = Math.abs(d) < 0.005 ? '<span class="ok">OK</span>' : '<span class="ko">' + (d > 0 ? '+' : '') + fmt(d) + '</span>';
      }
      return '<tr><td>' + dayFr(r.day) + '</td><td>' + T.esc(r.who) + '</td><td class="n">' + r.saisi.cal + (r.saisi.kept ? ' (+' + r.saisi.kept + ' gardés)' : '') + '</td><td class="n">' + fmt(r.saisi.esp) + '</td><td class="n">' + fmt(r.saisi.chq) + '</td>' +
        '<td class="n"><b>' + fmt(r.saisi.total) + '</b></td><td class="n">' + cEsp + '</td><td class="n">' + cChq + '</td><td class="n">' + ecart + '</td></tr>';
    }).join('') || '<tr><td colspan="9">Aucun don saisi.</td></tr>';

    var dEsp = denomList(B.esp), dChq = denomList(B.chq);
    var espTotal = dEsp.reduce(function (s, x) { return s + Math.round(x[0] * 100) * x[1]; }, 0) / 100;
    var chqTotal = dChq.reduce(function (s, x) { return s + Math.round(x[0] * 100) * x[1]; }, 0) / 100 + B.chqOther;
    function coupures(title, list, extra) {
      return '<table class="sm"><tr><th>' + title + '</th><th>Quantité</th><th>Montant</th></tr>' +
        (list.map(function (x) { return '<tr><td>' + fmt(x[0]) + '</td><td class="n">' + x[1] + '</td><td class="n">' + fmt(x[0] * x[1]) + '</td></tr>'; }).join('') || '<tr><td colspan="3">—</td></tr>') +
        (extra || '') + '</table>';
    }
    var qRows = Object.keys(f.quartier).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (k) {
      var b = f.quartier[k];
      return '<tr><td>' + T.esc(k) + '</td><td class="n">' + b.cal + '</td><td class="n">' + fmt(b.esp) + '</td><td class="n">' + fmt(b.chq) + '</td><td class="n"><b>' + fmt(b.total) + '</b></td></tr>';
    }).join('') || '<tr><td colspan="5">—</td></tr>';

    var sRows = Object.keys(f.sector).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (k) {
      var b = f.sector[k];
      return '<tr><td>' + T.esc(k) + '</td><td class="n">' + b.cal + '</td><td class="n">' + fmt(b.esp) + '</td><td class="n">' + fmt(b.chq) + '</td><td class="n"><b>' + fmt(b.total) + '</b></td></tr>';
    }).join('');
    var gd = Math.round((totCompte - f.all.total) * 100) / 100;
    var allCounted = nCompte === B.rows.length && B.rows.length > 0;
    return wrap('Bordereau commun',
      '<h2>Synthèse</h2><table class="sm">' +
      '<tr><td>Calendriers distribués</td><td class="n">' + f.all.cal + ' (' + f.all.sold + ' vendus + ' + f.all.gift + ' donnés + ' + f.all.cs + ' autre CS)</td></tr>' +
      '<tr><td>Calendriers gardés</td><td class="n">' + f.all.kept + '</td></tr>' +
      '<tr><td>Total espèces saisi</td><td class="n">' + fmt(f.all.esp) + '</td></tr><tr><td>Total chèques saisi</td><td class="n">' + fmt(f.all.chq) + '</td></tr>' +
      '<tr class="tot"><td>TOTAL COLLECTÉ (saisi)</td><td class="n">' + fmt(f.all.total) + '</td></tr>' +
      '<tr><td>Don moyen (' + f.all.nPaid + ' dons)</td><td class="n">' + fmt(f.all.avg) + '</td></tr>' +
      '<tr><td>Nombre de chèques / billets / pièces</td><td class="n">' + f.all.nchq + ' / ' + B.nBillets + ' / ' + B.nPieces + '</td></tr>' +
      '<tr><td>Total compté en caisse</td><td class="n">' + fmt(totCompte) + '</td></tr>' +
      '<tr><td>Écart global</td><td class="n">' + (allCounted ? (Math.abs(gd) < 0.005 ? '<span class="ok">OK</span>' : '<span class="ko">' + (gd > 0 ? '+' : '') + fmt(gd) + '</span>') : '<span class="nc">comptages incomplets</span>') + '</td></tr></table>' +
      '<h2>Par personne et par jour</h2><table><tr><th>Jour</th><th>Personne</th><th>Calendriers</th><th>Espèces saisies</th><th>Chèques saisis</th><th>Total saisi</th><th>Espèces comptées</th><th>Chèques comptés</th><th>Écart</th></tr>' + lines + '</table>' +
      '<h2>Par quartier</h2><table><tr><th>Quartier</th><th>Calendriers</th><th>Espèces</th><th>Chèques</th><th>Total</th></tr>' + qRows + '</table>' +
      (T.store.sectors().length ? '<h2>Par secteur</h2><table><tr><th>Secteur</th><th>Calendriers</th><th>Espèces</th><th>Chèques</th><th>Total</th></tr>' + sRows + '</table>' : '') +
      '<h2>Par souche</h2>' + soucheTable(f) +
      '<h2>Calendriers : stock et restitution</h2>' + calTable(T.store.calendriers()) +
      '<h2>Indemnisation des distributeurs</h2>' + indTable() +
      '<h2>Comparaison avec les années passées</h2>' + histoTable() +
      '<h2>Chèques saisis, par montant</h2>' + chqAmtTable(f) +
      '<h2>Détail de la caisse comptée (tous comptages)</h2><div class="cols">' +
      coupures('Espèces', dEsp) + coupures('Chèques', dChq, B.chqOther ? '<tr><td>Autres chèques</td><td class="n">—</td><td class="n">' + fmt(B.chqOther) + '</td></tr>' : '') + '</div>' +
      '<p>Total espèces comptées : <b>' + fmt(espTotal) + '</b> · Total chèques comptés : <b>' + fmt(chqTotal) + '</b></p>' +
      '<div class="sign"><div>Responsable de la tournée<br>Nom, date, signature</div><div>Trésorier(ère)<br>Nom, date, signature</div></div>' +
      '<p class="note">Montants issus de la saisie des équipes. Les noms de donateurs n\'y figurent pas.</p>');
  }

  function show(content, name) {
    var blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    if (!w) T.download(name + '-tournee' + T.TOURNEE.num + '.html', content, 'text/html;charset=utf-8');
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function open() { show(html(), 'bordereau'); }
  function openRestitution() { show(htmlRestitution(), 'restitution'); }

  function csv() {
    var B = T.store.bordereau();
    function c(r) { return r.map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(';'); }
    var rows = [['Jour', 'Personne', 'Calendriers', 'Gardés', 'Espèces saisies', 'Chèques saisis', 'Total saisi', 'Espèces comptées', 'Chèques comptés', 'Écart']];
    B.rows.forEach(function (r) {
      rows.push([r.day, r.who, r.saisi.cal, r.saisi.kept, r.saisi.esp, r.saisi.chq, r.saisi.total,
        r.compte ? r.compte.esp : '', r.compte ? r.compte.chq : '',
        r.compte ? Math.round((r.compte.esp + r.compte.chq - r.saisi.total) * 100) / 100 : '']);
    });
    return '﻿' + rows.map(c).join('\r\n');
  }

  T.bordereau = { open: open, html: html, htmlRestitution: htmlRestitution, openRestitution: openRestitution, csv: csv };
})();
