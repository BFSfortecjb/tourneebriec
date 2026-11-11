/*!
 * Tournée calendriers — list.js (liste par rue)
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var filter = 'all', quartier = 'all', sector = 'all', ed = null, edSearch = '';
  // Rues dépliées (par défaut tout est replié) ; mémorisé sur cet appareil seulement
  var FOLD_KEY = 'bfs_briec_open_v1', open = loadOpen();
  function loadOpen() { try { return JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch (e) { return {}; } }
  function saveOpen() { try { localStorage.setItem(FOLD_KEY, JSON.stringify(open)); } catch (e) { /* ignore */ } }

  function renderFilters() {
    var s = T.store.stats();
    var items = [['all', 'Tout (' + s.total + ')']].concat(T.STATUS_ORDER.map(function (k) {
      return [k, T.STATUS[k].label + ' (' + s[k] + ')'];
    }));
    T.$('#filters').innerHTML = items.map(function (it) {
      return '<button class="chip' + (filter === it[0] ? ' on' : '') + '" data-f="' + it[0] + '">' + T.esc(it[1]) + '</button>';
    }).join('');
  }

  function renderSectorSelect() {
    var secs = T.store.sectors(), sel = T.$('#sFilter');
    if (sector !== 'all' && sector !== '_none' && !secs.some(function (s) { return s.name === sector; })) sector = 'all';
    sel.classList.toggle('hidden', !secs.length);
    sel.innerHTML = '<option value="all">Tous les secteurs</option>' +
      secs.map(function (s) { return '<option value="' + T.esc(s.name) + '"' + (sector === s.name ? ' selected' : '') + '>' + T.esc(s.name) + '</option>'; }).join('') +
      '<option value="_none"' + (sector === '_none' ? ' selected' : '') + '>Hors secteur</option>';
  }

  function sectorStats(s) {
    var tot = 0, vis = 0;
    T.store.all().forEach(function (h) {
      if (T.store.sectorOf(h.street) !== s.name) return;
      tot++; if (h.status !== 'todo') vis++;
    });
    return vis + '/' + tot + ' visitées';
  }

  function renderSectorBox() {
    var box = T.$('#sectorBox');
    if (box.classList.contains('hidden')) return;
    var html;
    if (!ed) {
      var secs = T.store.sectors();
      html = '<h4>Secteurs</h4><p class="small">Un secteur regroupe des quartiers et/ou des rues (par exemple un secteur par distributeur).</p>' +
        (secs.length ? secs.map(function (s) {
          var parts = s.quartiers.concat(s.streets), ty = s.type === 'ville' ? ' · ville' : s.type === 'campagne' ? ' · campagne' : '';
          return '<div class="srow"><div class="grow"><b>' + T.esc(s.name) + '</b><small>' + parts.length + ' quartier(s)/rue(s)' + ty + ' · ' + sectorStats(s) + '</small></div>' +
            '<button type="button" class="btn-sec" data-sedit="' + s.id + '">Modifier</button></div>';
        }).join('') : '<p class="empty">Aucun secteur pour l\'instant.</p>') +
        '<div class="acts"><button type="button" class="btn-main" id="sNew">＋ Nouveau secteur</button><button type="button" class="btn-sec" id="sClose">Fermer</button></div>';
    } else {
      var q = edSearch.toLowerCase();
      html = '<h4>' + (ed.id ? 'Modifier le secteur' : 'Nouveau secteur') + '</h4>' +
        '<label>Nom du secteur<input id="sName" type="text" value="' + T.esc(ed.name) + '" placeholder="Ex : Secteur Centre-bourg" autocomplete="off"></label>' +
        '<label>Type de secteur<select id="sType"><option value="">Non précisé</option><option value="ville"' + (ed.type === 'ville' ? ' selected' : '') + '>Ville (bourg)</option><option value="campagne"' + (ed.type === 'campagne' ? ' selected' : '') + '>Campagne (hameaux, lieux-dits)</option></select></label>' +
        '<p class="sheet-label">Quartiers</p><div class="pick">' +
        T.QUARTIERS.map(function (qt) {
          var other = '';
          T.store.sectors().forEach(function (s) { if (s.id !== ed.id && s.quartiers.indexOf(qt.name) >= 0) other = s.name; });
          return '<label class="chk"><input type="checkbox" data-sq="' + T.esc(qt.name) + '"' + (ed.quartiers.indexOf(qt.name) >= 0 ? ' checked' : '') + '> ' + T.esc(qt.name) + (other ? ' <small>(actuellement : ' + T.esc(other) + ')</small>' : '') + '</label>';
        }).join('') + '</div>' +
        '<p class="sheet-label">Rues en plus (ou à part d\'un quartier)</p>' +
        '<input id="sSearch" type="text" placeholder="Chercher une rue…" value="' + T.esc(edSearch) + '" autocomplete="off"><div class="pick">' +
        T.store.streets().filter(function (st) { return !q || st.toLowerCase().indexOf(q) >= 0; }).map(function (st) {
          var qn = T.quartierOf(st);
          return '<label class="chk"><input type="checkbox" data-ss="' + T.esc(st) + '"' + (ed.streets.indexOf(st) >= 0 ? ' checked' : '') + '> ' + T.esc(st) + (qn ? ' <small>(' + T.esc(qn) + ')</small>' : '') + '</label>';
        }).join('') + '</div>' +
        '<div class="acts"><button type="button" class="btn-main" id="sSave">Enregistrer</button><button type="button" class="btn-sec" id="sCancel">Annuler</button>' +
        (ed.id ? '<button type="button" class="btn-danger" id="sDel">Supprimer ce secteur</button>' : '') + '</div>';
    }
    box.innerHTML = html;
  }

  function initSectors() {
    var box = T.$('#sectorBox');
    T.$('#btnSectors').addEventListener('click', function () { box.classList.toggle('hidden'); ed = null; renderSectorBox(); });
    T.$('#sFilter').addEventListener('change', function () { sector = this.value; render(); });
    box.addEventListener('click', function (e) {
      var id = e.target.id, ev = e.target.closest('[data-sedit]');
      if (ev) {
        var s = T.store.sectors().filter(function (x) { return x.id === ev.getAttribute('data-sedit'); })[0];
        if (s) { ed = { id: s.id, name: s.name, quartiers: s.quartiers.slice(), streets: s.streets.slice(), type: s.type || '' }; edSearch = ''; renderSectorBox(); }
      } else if (id === 'sNew') { ed = { id: '', name: '', quartiers: [], streets: [], type: '' }; edSearch = ''; renderSectorBox(); }
      else if (id === 'sClose') { box.classList.add('hidden'); }
      else if (id === 'sCancel') { ed = null; renderSectorBox(); }
      else if (id === 'sSave') {
        ed.name = T.$('#sName').value;
        if (!ed.name.trim()) { T.toast('Donnez un nom au secteur'); return; }
        if (T.store.sectors().some(function (s) { return s.id !== ed.id && s.name.toLowerCase() === ed.name.trim().toLowerCase(); })) { T.toast('Un secteur porte déjà ce nom'); return; }
        T.store.saveSector(ed.id, ed.name, ed.quartiers, ed.streets, T.$('#sType').value);
        ed = null; T.toast('Secteur enregistré'); renderSectorBox(); render();
      } else if (id === 'sDel') {
        if (confirm('Supprimer le secteur « ' + ed.name + ' » ? Les rues et quartiers ne sont pas supprimés.')) {
          T.store.deleteSector(ed.id); ed = null; renderSectorBox(); render();
        }
      }
    });
    box.addEventListener('change', function (e) {
      var q = e.target.getAttribute('data-sq'), s = e.target.getAttribute('data-ss'), arr;
      if (q != null) arr = ed.quartiers; else if (s != null) { arr = ed.streets; q = s; } else return;
      var i = arr.indexOf(q); if (e.target.checked && i < 0) arr.push(q); else if (!e.target.checked && i >= 0) arr.splice(i, 1);
    });
    box.addEventListener('input', function (e) {
      if (e.target.id === 'sName') ed.name = e.target.value;
      if (e.target.id === 'sSearch') { ed.name = T.$('#sName').value; edSearch = e.target.value; renderSectorBox(); var f = T.$('#sSearch'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    });
  }

  function render() {
    renderSectorSelect();
    if (!ed) renderSectorBox();
    renderFilters();
    var list = T.store.sorted(filter).filter(function (h) {
      if (sector !== 'all') {
        var sn = T.store.sectorOf(h.street);
        if (sector === '_none' ? sn : sn !== sector) return false;
      }
      if (quartier === 'all') return true;
      var q = T.quartierOf(h.street);
      return quartier === '_none' ? !q : q === quartier;
    });
    var body = T.$('#listBody');
    if (!list.length) {
      body.innerHTML = '<p class="empty">' + (T.store.all().length
        ? 'Aucune habitation avec ce statut.'
        : 'Aucune habitation pour l\'instant.<br>Ajoutez une rue ici, ou touchez la carte avec le bouton ＋.') + '</p>';
      return;
    }
    var html = '', cur = null, isOpen = false;
    T.store.streetTwins().forEach(function (t, i) {
      html += '<div class="twin">⚠ Même rue écrite de plusieurs façons : ' + t.names.map(function (n) { return '« ' + T.esc(n) + ' » (' + t.counts[n] + ')'; }).join(', ') +
        '<button type="button" class="btn-main" data-twin="' + i + '">Fusionner en « ' + T.esc(t.best) + ' »</button></div>';
    });
    var all = T.store.all();
    // Totaux par rue calculés une seule fois
    var tot = {}, vis = {}, rep = {};
    all.forEach(function (x) {
      var k = x.street || '(sans rue)';
      tot[k] = (tot[k] || 0) + 1;
      if (x.status !== 'todo') vis[k] = (vis[k] || 0) + 1;
      if (x.status === 'repasser') rep[k] = (rep[k] || 0) + 1;
    });
    list.forEach(function (h) {
      var street = h.street || '(sans rue)';
      if (street !== cur) {
        cur = street;
        isOpen = !!open[street];
        html += '<div class="street-h' + (isOpen ? ' open' : '') + '" data-street="' + T.esc(street) + '">' +
          '<span><i class="chev">' + (isOpen ? '▾' : '▸') + '</i> ' + T.esc(street) + (T.store.sectorOf(h.street) ? '<span class="sec-tag">' + T.esc(T.store.sectorOf(h.street)) + '</span>' : '') + (h.street ? ' <button type="button" class="ren" data-ren="' + T.esc(street) + '" title="Renommer ou fusionner cette rue">✎</button>' : '') + '</span>' +
          '<small>' + (rep[street] ? '<b class="rep">' + rep[street] + ' à repasser</b> · ' : '') + (vis[street] || 0) + '/' + tot[street] + ' visitées</small></div>';
      }
      if (!isOpen) return;
      html += '<div class="row-h" data-id="' + h.id + '">' +
        '<div class="pin s-' + h.status + '">' + T.esc(String(h.number || '').slice(0, 4)) + '</div>' +
        '<div class="main"><b>' + T.esc(street) + ' ' + T.esc(h.number) + (h.unit ? ' · ' + T.esc(h.unit) : '') + (h.dog ? ' 🐶' : '') + (h.ff ? ' 🧑‍🚒' : '') + '</b>' +
        '<small>' + ((h.visits || []).length > 1 ? (h.visits.length + ' passages · ') : '') + T.esc(h.note || '') + (h.lat == null ? ' · non placée sur la carte' : '') + '</small></div>' +
        (h.lat == null ? '<button type="button" class="btn-sec place" data-place="' + h.id + '">📍 Placer</button>' : '') +
        '<span class="st">' + T.STATUS[h.status].label + '</span></div>';
    });
    body.innerHTML = html;
  }

  function init() {
    T.$('#qFilter').innerHTML = '<option value="all">Tous les quartiers</option>' +
      T.QUARTIERS.map(function (q) { return '<option value="' + T.esc(q.name) + '">' + T.esc(q.name) + '</option>'; }).join('') +
      '<option value="_none">Autres rues</option>';
    initSectors();
    T.$('#qFilter').addEventListener('change', function () { quartier = this.value; render(); });
    T.$('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]');
      if (!b) return;
      filter = b.getAttribute('data-f');
      render();
    });
    T.$('#listBody').addEventListener('click', function (e) {
      var tw = e.target.closest('[data-twin]');
      if (tw) {
        var t = T.store.streetTwins()[parseInt(tw.getAttribute('data-twin'), 10)], n = 0;
        if (t) { t.names.forEach(function (nm) { if (nm !== t.best) n += T.store.renameStreet(nm, t.best); }); T.toast('Rues fusionnées : ' + n + ' adresse(s) renommée(s)'); }
        return;
      }
      var pl = e.target.closest('[data-place]');
      if (pl) { T.app.showTab('map'); T.map.startPlacing(pl.getAttribute('data-place')); return; }
      var rn = e.target.closest('[data-ren]');
      if (rn) {
        var from = rn.getAttribute('data-ren'), to = prompt('Nouveau nom de la rue « ' + from + ' ».\nSi une rue porte déjà ce nom, les deux seront fusionnées.', from);
        if (to != null && to.trim() && to.trim() !== from) {
          var c = T.store.renameStreet(from, to);
          open[to.replace(/\s+/g, ' ').trim()] = open[from]; saveOpen();
          T.toast(c + ' adresse(s) renommée(s)');
        }
        return;
      }
      var sh = e.target.closest('[data-street]');
      if (sh) {
        var name = sh.getAttribute('data-street');
        if (open[name]) delete open[name]; else open[name] = 1;
        saveOpen(); render();
        return;
      }
      var r = e.target.closest('[data-id]');
      if (r) T.app.openSheet(r.getAttribute('data-id'));
    });
    T.$('#btnFoldAll').addEventListener('click', function () { open = {}; saveOpen(); render(); });
    T.$('#btnUnfoldAll').addEventListener('click', function () {
      T.store.streets().forEach(function (s) { open[s] = 1; });
      open['(sans rue)'] = 1;
      saveOpen(); render();
    });
    T.$('#btnToggleRange').addEventListener('click', function () {
      T.$('#rangeForm').classList.toggle('hidden');
    });
    T.$('#rangeForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = T.store.addRange(T.$('#rgStreet').value, T.$('#rgFrom').value, T.$('#rgTo').value, T.$('#rgStep').value);
      T.toast(n + ' habitation(s) créée(s)');
      T.$('#rangeForm').classList.add('hidden');
      T.$('#rgStreet').value = '';
    });
    T.bus.on('change', render);
    render();
  }

  T.list = { init: init, render: render, setFilter: function (f) { filter = f; render(); } };
})();
