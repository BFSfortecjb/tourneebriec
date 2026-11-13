/*!
 * Tournée calendriers — import.js (import d'adresses depuis la Base Adresse Nationale)
 * Source des données : Base Adresse Nationale (BAN), Licence Ouverte.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var voies = [], sel = {}, kind = 'all', query = '', defaultSide = 'all', sides = {}, ranges = {};
  var SIDE_ORDER = ['all', 'odd', 'even'];
  var SIDE_LABEL = { all: 'Tous', odd: 'Impairs', even: 'Pairs' };

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function numKey(n) {
    var m = String(n || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 1e9;
  }

  // Garde les numéros pairs, impairs ou tous (« 12 bis » compte comme 12)
  function bySide(items, side) {
    if (side !== 'odd' && side !== 'even') return items;
    var want = side === 'odd' ? 1 : 0;
    return items.filter(function (a) {
      var m = String(a.num).match(/\d+/);
      return m && parseInt(m[0], 10) % 2 === want;
    });
  }
  function sideOf(i) { return sides[i] || defaultSide; }
  // Garde les numéros entre min et max (vide = pas de limite) ; « 12 bis » compte comme 12
  function byRange(items, min, max) {
    if (!min && !max) return items;
    return items.filter(function (a) {
      var m = String(a.num).match(/\d+/);
      if (!m) return false;
      var n = parseInt(m[0], 10);
      return (!min || n >= min) && (!max || n <= max);
    });
  }
  function rangeOf(i) { return ranges[i] || {}; }
  function itemsOf(i) { var r = rangeOf(i); return byRange(bySide(voies[i].items, sideOf(i)), r.min, r.max); }

  // Lecture CSV (séparateur ; ou , détecté, guillemets gérés)
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var first = text.slice(0, text.indexOf('\n') + 1 || text.length);
    var sep = first.split(';').length >= first.split(',').length ? ';' : ',';
    var rows = [], row = [], f = '', q = false, c;
    for (var i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  // Regroupe les adresses par voie. Retourne { ok, voies } ou { ok:false, msg }
  function build(text, suffix) {
    var rows = parseCSV(text);
    if (rows.length < 2) return { ok: false, msg: 'Fichier vide' };
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var ix = {};
    ['numero', 'rep', 'nom_voie', 'id_fantoir', 'lon', 'lat', 'type_position'].forEach(function (k) { ix[k] = head.indexOf(k); });
    if (ix.numero < 0 || ix.nom_voie < 0 || ix.lon < 0 || ix.lat < 0) {
      return { ok: false, msg: 'Ce fichier n\'est pas un CSV d\'adresses de la BAN (colonnes numero, nom_voie, lon, lat attendues)' };
    }
    var map = {}, list = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var name = (r[ix.nom_voie] || '').trim();
      if (name && suffix) name += suffix;   // communes voisines : « Rue X (Edern) », pour ne pas mélanger deux rues de même nom
      var lat = parseFloat(r[ix.lat]), lng = parseFloat(r[ix.lon]);
      var num = (r[ix.numero] || '').trim();
      if (!name || !num || isNaN(lat) || isNaN(lng)) continue;
      var rep = ix.rep >= 0 ? (r[ix.rep] || '').trim() : '';
      var label = rep ? num + ' ' + rep : num;
      var v = map[name];
      if (!v) {
        v = map[name] = { name: name, ld: ix.id_fantoir >= 0 ? !(r[ix.id_fantoir] || '').trim() : false, items: [], seen: {} };
        list.push(v);
      }
      var key = label.toLowerCase();
      var entree = ix.type_position >= 0 && r[ix.type_position] === 'entrée';
      var prev = v.seen[key];
      if (prev === undefined) {
        v.seen[key] = v.items.length;
        v.items.push({ num: label, lat: lat, lng: lng, e: entree });
      } else if (entree && !v.items[prev].e) {
        v.items[prev] = { num: label, lat: lat, lng: lng, e: true };
      }
    }
    list.forEach(function (v) {
      delete v.seen;
      v.items.sort(function (a, b) { return numKey(a.num) - numKey(b.num) || a.num.localeCompare(b.num); });
    });
    list.sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
    return { ok: true, voies: list };
  }

  /* ---------- interface ---------- */
  function visible() {
    var q = norm(query);
    return voies.map(function (v, i) { return { v: v, i: i }; }).filter(function (o) {
      if (kind === 'rue' && o.v.ld) return false;
      if (kind === 'ld' && !o.v.ld) return false;
      return !q || norm(o.v.name).indexOf(q) >= 0;
    });
  }

  function summary() {
    var nv = 0, na = 0;
    voies.forEach(function (v, i) { if (sel[i]) { nv++; na += itemsOf(i).length; } });
    return { nv: nv, na: na };
  }

  // Positions (dans voies) des voies d'un quartier présentes dans le fichier chargé
  function quartierIdx(q) {
    var names = {};
    q.voies.forEach(function (v) { names[T.normName(v)] = 1; });
    var out = [];
    voies.forEach(function (v, i) { if (names[T.normName(v.name)]) out.push(i); });
    return out;
  }

  function renderQuartiers() {
    var html = '';
    (T.QUARTIERS || []).forEach(function (q, qi) {
      var idx = quartierIdx(q);
      if (!idx.length) return;
      var n = idx.reduce(function (s, i) { return s + itemsOf(i).length; }, 0);
      var on = idx.every(function (i) { return sel[i]; });
      html += '<button class="chip' + (on ? ' on' : '') + '" data-q="' + qi + '">' + T.esc(q.name) + ' (' + n + ')</button>';
    });
    T.$('#impQuartiers').innerHTML = html || '<small class="hint">Aucun quartier défini pour ce fichier.</small>';
  }

  function renderSummary() {
    var s = summary();
    T.$('#impSum').textContent = s.nv + ' voie(s) cochée(s) — ' + s.na + ' adresse(s)';
    T.$('#impGo').disabled = !s.na;
    T.$('#impGo').textContent = s.na ? 'Importer ' + s.na + ' adresse(s)' : 'Cochez des rues à importer';
  }

  function render() {
    renderQuartiers();
    var box = T.$('#impList'), top = box.scrollTop;
    var vis = visible();
    box.innerHTML = vis.length ? vis.map(function (o) {
      var s = sideOf(o.i);
      return '<label class="imp-row"><input type="checkbox" data-i="' + o.i + '"' + (sel[o.i] ? ' checked' : '') + '>' +
        '<span>' + T.esc(o.v.name) + (o.v.ld ? ' <em>lieu-dit</em>' : '') + '</span>' +
        '<button type="button" class="side' + (s !== 'all' ? ' on' : '') + '" data-side="' + o.i + '">' + SIDE_LABEL[s] + '</button>' +
        '<small>' + itemsOf(o.i).length + '</small></label>' +
        (sel[o.i] ? '<div class="imp-range">du n° <input type="number" min="1" inputmode="numeric" data-rmin="' + o.i + '" value="' + (rangeOf(o.i).min || '') + '" placeholder="début">' +
          ' au n° <input type="number" min="1" inputmode="numeric" data-rmax="' + o.i + '" value="' + (rangeOf(o.i).max || '') + '" placeholder="fin"></div>' : '');
    }).join('') : '<p class="empty">Aucune voie.</p>';
    box.scrollTop = top;
    T.$$('#impKinds .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === kind); });
    T.$$('#impSides .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sd') === defaultSide); });
    renderSummary();
  }

  function setData(text, label, suffix) {
    var res = build(text, suffix);
    if (!res.ok) { T.toast(res.msg); return false; }
    voies = res.voies; sel = {}; sides = {}; ranges = {}; defaultSide = 'all';
    var total = voies.reduce(function (n, v) { return n + v.items.length; }, 0);
    T.$('#impSrc').textContent = label + ' : ' + voies.length + ' voies, ' + total + ' adresses';
    render();
    return true;
  }

  // Communes proposées : data/communes.json  [{ "nom": "Briec", "insee": "29020", "file": "data/briec.csv", "principale": true }, ...]
  // Pour ajouter une commune : déposer son CSV dans data/ et ajouter une ligne dans communes.json.
  var communes = null, communeIdx = 0;

  function loadCommunes(cb) {
    if (communes) { cb(); return; }
    fetch('data/communes.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('absent');
      return r.json();
    }).then(function (j) {
      communes = (j && j.length) ? j : null;
    }).catch(function () { communes = null; }).then(function () {
      if (!communes) communes = [{ nom: 'Briec', insee: '29020', file: 'data/briec.csv', principale: true }];
      var sel = T.$('#impCommune');
      sel.innerHTML = communes.map(function (c, i) {
        return '<option value="' + i + '">' + T.esc(c.nom) + (c.insee ? ' (' + T.esc(c.insee) + ')' : '') + '</option>';
      }).join('');
      sel.style.display = communes.length > 1 ? '' : 'none';
      var lab = T.$('label[for="impCommune"]');
      if (lab) lab.style.display = communes.length > 1 ? '' : 'none';
      cb();
    });
  }

  function loadCommune(i) {
    var c = communes[i];
    communeIdx = i;
    T.$('#impSrc').textContent = 'Chargement des adresses de ' + c.nom + '…';
    fetch(c.file, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('absent');
      return r.text();
    }).then(function (t) { setData(t, c.nom + (c.insee ? ' (' + c.insee + ')' : ''), c.principale ? '' : ' (' + c.nom + ')'); })
      .catch(function () {
        voies = []; sel = {}; render();
        T.$('#impSrc').textContent = 'Fichier ' + c.file + ' introuvable pour ' + c.nom + ' : chargez le CSV de la BAN avec le bouton ci-dessous.';
      });
  }

  function open() {
    T.$('#imp').classList.remove('hidden');
    if (voies.length) { render(); return; }
    loadCommunes(function () {
      var p = 0;
      communes.forEach(function (c, i) { if (c.principale) p = i; });
      T.$('#impCommune').value = String(p);
      loadCommune(p);
    });
  }

  function doImport() {
    var items = [];
    voies.forEach(function (v, i) {
      if (!sel[i]) return;
      itemsOf(i).forEach(function (a) { items.push({ street: v.name, number: a.num, lat: a.lat, lng: a.lng }); });
    });
    if (!items.length) return;
    if (T.store.all().length + items.length > 5000 &&
        !confirm('Cela porte le total à plus de 5 000 habitations : le partage de la version test risque de devenir trop lourd (limite GitHub environ 1 Mo). Continuer ?')) return;
    var r = T.store.addAddresses(items);
    T.$('#imp').classList.add('hidden');
    sel = {}; ranges = {};
    T.toast(r.created + ' ajoutée(s)' + (r.placed ? ', ' + r.placed + ' placée(s) sur la carte' : '') + (r.skipped ? ', ' + r.skipped + ' déjà présente(s)' : ''));
  }

  function init() {
    T.$('#btnOpenImp').addEventListener('click', open);
    T.$('#impClose').addEventListener('click', function () { T.$('#imp').classList.add('hidden'); });
    T.$('#impCommune').addEventListener('change', function () { loadCommune(parseInt(this.value, 10)); });
    T.$('#impSearch').addEventListener('input', function () { query = this.value; render(); });
    T.$('#impQuartiers').addEventListener('click', function (e) {
      var b = e.target.closest('[data-q]');
      if (!b) return;
      var idx = quartierIdx(T.QUARTIERS[parseInt(b.getAttribute('data-q'), 10)]);
      var all = idx.every(function (i) { return sel[i]; });
      idx.forEach(function (i) { if (all) delete sel[i]; else sel[i] = 1; });
      render();
    });
    T.$('#impKinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (b) { kind = b.getAttribute('data-k'); render(); }
    });
    // Côté de la rue : choix général (remet toutes les voies sur ce côté)
    T.$('#impSides').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sd]');
      if (!b) return;
      defaultSide = b.getAttribute('data-sd'); sides = {};
      render();
    });
    T.$('#impList').addEventListener('click', function (e) {
      // Côté propre à une voie : touche pour passer Tous → Impairs → Pairs
      var b = e.target.closest('[data-side]');
      if (!b) return;
      e.preventDefault();
      var i = b.getAttribute('data-side');
      sides[i] = SIDE_ORDER[(SIDE_ORDER.indexOf(sideOf(i)) + 1) % SIDE_ORDER.length];
      render();
    });
    T.$('#impList').addEventListener('change', function (e) {
      var i = e.target.getAttribute('data-i');
      var rk = e.target.hasAttribute('data-rmin') ? 'min' : e.target.hasAttribute('data-rmax') ? 'max' : '';
      if (rk) {
        var ri = e.target.getAttribute('data-r' + rk);
        var v = parseInt(e.target.value, 10);
        ranges[ri] = ranges[ri] || {};
        if (v > 0) ranges[ri][rk] = v; else delete ranges[ri][rk];
        render();
        return;
      }
      if (i === null) return;
      if (e.target.checked) sel[i] = 1; else delete sel[i];
      render();
    });
    T.$('#impAll').addEventListener('click', function () { visible().forEach(function (o) { sel[o.i] = 1; }); render(); });
    T.$('#impNone').addEventListener('click', function () { visible().forEach(function (o) { delete sel[o.i]; }); render(); });
    T.$('#impGo').addEventListener('click', doImport);
    T.$('#btnImpFile').addEventListener('click', function () { T.$('#impFile').click(); });
    T.$('#impFile').addEventListener('change', function () {
      var f = this.files && this.files[0], input = this;
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { setData(String(r.result), f.name); input.value = ''; };
      r.readAsText(f);
    });
  }

  T.imp = { init: init, parse: build, bySide: bySide, byRange: byRange };
})();
