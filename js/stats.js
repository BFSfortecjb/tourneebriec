/*!
 * Tournée calendriers — stats.js (présence selon le jour et l'heure de passage)
 * Chaque visite enregistrée (date + heure + statut) sert de mesure : « présent » = quelqu'un a ouvert,
 * « absent » = à repasser. Les adresses inhabitées ne comptent pas.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  var DAYS_FULL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  var SLOTS = [
    { k: 'm', label: 'Matin', sub: 'avant 12 h', max: 12 },
    { k: 'd', label: 'Midi', sub: '12–14 h', max: 14 },
    { k: 'a', label: 'Après-midi', sub: '14–17 h', max: 17 },
    { k: 'f', label: 'Fin de journée', sub: '17–19 h', max: 19 },
    { k: 's', label: 'Soir', sub: 'dès 19 h', max: 99 }
  ];
  var MIN_N = 5;            // en dessous, le taux n'est pas fiable
  var sel = { sector: 'all', who: 'all', zone: 'all', quartier: 'all' };
  var open = false;

  function slotOf(h) { for (var i = 0; i < SLOTS.length; i++) if (h < SLOTS[i].max) return i; return SLOTS.length - 1; }
  function dowOf(d) { return (d.getDay() + 6) % 7; }          // lundi = 0

  // Toutes les visites exploitables : [{day, slot, hour, present, who, house}]
  function visits() {
    var out = [];
    T.store.all().forEach(function (h) {
      (h.visits || []).forEach(function (v) {
        if (!v.d || String(v.d).length < 16) return;           // date seule : pas d'heure connue
        if (v.s !== 'passe' && v.s !== 'refus' && v.s !== 'repasser') return;
        var d = new Date(v.d);
        if (isNaN(d.getTime())) return;
        out.push({ day: dowOf(d), hour: d.getHours(), slot: slotOf(d.getHours()), present: v.s !== 'repasser', who: v.by || '(?)', street: h.street, date: d });
      });
    });
    return out;
  }

  function filtered() {
    return visits().filter(function (v) {
      if (sel.who !== 'all' && v.who !== sel.who) return false;
      if (sel.zone !== 'all') { var z = T.store.zoneOf(v.street); if (sel.zone === '_none' ? z : z !== sel.zone) return false; }
      if (sel.quartier !== 'all') { var q = (T.quartierOf && T.quartierOf(v.street)) || ''; if (sel.quartier === '_none' ? q : q !== sel.quartier) return false; }
      if (sel.sector === 'all') return true;
      var sn = T.store.sectorOf(v.street);
      return sel.sector === '_none' ? !sn : sn === sel.sector;
    });
  }

  function cells(list) {
    var c = {};
    list.forEach(function (v) {
      var k = v.day + '|' + v.slot;
      c[k] = c[k] || { n: 0, p: 0, day: v.day, slot: v.slot };
      c[k].n++; if (v.present) c[k].p++;
    });
    return c;
  }

  function pct(c) { return c.n ? Math.round(100 * c.p / c.n) : 0; }
  function color(c) {
    if (!c || c.n < MIN_N) return c && c.n ? '#eef0f3' : '#fff';
    var t = pct(c) / 100;                                       // 0 rouge pâle → 1 vert
    return 'hsl(' + Math.round(10 + t * 110) + ',60%,' + Math.round(88 - t * 22) + '%)';
  }

  // Maisons restant à voir (pas visité ou à repasser) dans le périmètre choisi
  function remaining() {
    return T.store.all().filter(function (h) {
      if (h.status !== 'todo' && h.status !== 'repasser') return false;
      if (sel.zone !== 'all') { var z = T.store.zoneOf(h.street); if (sel.zone === '_none' ? z : z !== sel.zone) return false; }
      if (sel.quartier !== 'all') { var q = (T.quartierOf && T.quartierOf(h.street)) || ''; if (sel.quartier === '_none' ? q : q !== sel.quartier) return false; }
      if (sel.sector === 'all') return true;
      var sn = T.store.sectorOf(h.street);
      return sel.sector === '_none' ? !sn : sn === sel.sector;
    });
  }

  function compute() {
    var list = filtered(), c = cells(list), rem = remaining();
    var ranked = Object.keys(c).map(function (k) { return c[k]; }).filter(function (x) { return x.n >= MIN_N; })
      .sort(function (a, b) { return pct(b) - pct(a) || b.n - a.n; });
    var allP = list.filter(function (v) { return v.present; }).length;
    // rythme par personne : nombre de passages par créneau
    var who = {};
    visits().forEach(function (v) {
      who[v.who] = who[v.who] || { n: 0, slots: [0, 0, 0, 0, 0], days: [0, 0, 0, 0, 0, 0, 0] };
      who[v.who].n++; who[v.who].slots[v.slot]++; who[v.who].days[v.day]++;
    });
    return { list: list, cells: c, ranked: ranked, rem: rem, nVis: list.length, rate: list.length ? Math.round(100 * allP / list.length) : 0, who: who };
  }

  function renderPres() {
    var box = T.$('#presBox');
    if (!box) return;
    var r = compute(), all = visits();
    var wo = {}; all.forEach(function (v) { wo[v.who] = 1; });
    var whos = Object.keys(wo).sort();
    var secs = T.store.sectors();
    var head = '<div class="pres-sel">' +
      '<label>Secteur <select id="presSec"><option value="all">Tous</option>' +
        secs.map(function (s) { return '<option value="' + T.esc(s.name) + '"' + (sel.sector === s.name ? ' selected' : '') + '>' + T.esc(s.name) + '</option>'; }).join('') +
        (secs.length ? '<option value="_none"' + (sel.sector === '_none' ? ' selected' : '') + '>Hors secteur</option>' : '') + '</select></label>' +
      '<label>Zone <select id="presZone"><option value="all">Toutes</option><option value="ville"' + (sel.zone === 'ville' ? ' selected' : '') + '>Ville</option><option value="campagne"' + (sel.zone === 'campagne' ? ' selected' : '') + '>Campagne</option><option value="_none"' + (sel.zone === '_none' ? ' selected' : '') + '>Non précisée</option></select></label>' +
      '<label>Quartier <select id="presQuart"><option value="all">Tous</option>' +
        (T.QUARTIERS || []).map(function (q) { return '<option value="' + T.esc(q.name) + '"' + (sel.quartier === q.name ? ' selected' : '') + '>' + T.esc(q.name) + '</option>'; }).join('') +
        '<option value="_none"' + (sel.quartier === '_none' ? ' selected' : '') + '>Hors quartier</option></select></label>' +
      '<label>Personne <select id="presWho"><option value="all">Toutes</option>' +
        whos.map(function (w) { return '<option value="' + T.esc(w) + '"' + (sel.who === w ? ' selected' : '') + '>' + T.esc(w) + '</option>'; }).join('') + '</select></label></div>';
    if (!all.length) {
      box.innerHTML = '<p class="hint">Pas encore de passage avec date et heure. Les statistiques apparaîtront au fil des visites enregistrées.</p>';
      return;
    }
    var html = head +
      '<p style="margin:6px 0"><b>' + r.nVis + '</b> passage(s) analysé(s) · présence moyenne <b>' + r.rate + ' %</b>' +
      (r.nVis < 30 ? ' <span class="hint">(encore peu de données : les chiffres se précisent avec les passages)</span>' : '') + '</p>';

    // carte de chaleur jour × créneau
    html += '<div style="overflow-x:auto"><table class="heat"><tr><th></th>' + SLOTS.map(function (s) { return '<th>' + s.label + '<small>' + s.sub + '</small></th>'; }).join('') + '</tr>';
    for (var d = 0; d < 7; d++) {
      html += '<tr><th>' + DAYS[d] + '</th>';
      for (var s = 0; s < SLOTS.length; s++) {
        var x = r.cells[d + '|' + s];
        html += '<td style="background:' + color(x) + '">' + (x ? (x.n >= MIN_N ? '<b>' + pct(x) + ' %</b>' : '<span class="low">—</span>') + '<small>' + x.n + ' pass.</small>' : '') + '</td>';
      }
      html += '</tr>';
    }
    html += '</table></div><p class="hint" style="margin:4px 0 8px">Taux de présence = passages où quelqu\'un était là (passé ou refus) sur tous les passages du créneau. Un « — » signifie moins de ' + MIN_N + ' passages : trop peu pour conclure.</p>';

    // meilleurs créneaux
    html += '<h4>Meilleurs créneaux</h4>';
    if (!r.ranked.length) html += '<p class="hint">Pas encore assez de passages par créneau (au moins ' + MIN_N + ' nécessaires).</p>';
    else html += '<ol class="best">' + r.ranked.slice(0, 5).map(function (x) {
      return '<li><b>' + DAYS_FULL[x.day] + ' · ' + SLOTS[x.slot].label.toLowerCase() + ' (' + SLOTS[x.slot].sub + ')</b> — ' + pct(x) + ' % de présence <span class="hint">(' + x.n + ' passages)</span></li>';
    }).join('') + '</ol>';

    // projection
    var rem = r.rem.length;
    html += '<h4>Projection sur ce qui reste</h4>';
    if (!rem) html += '<p class="hint">Plus aucune maison à voir ou à repasser dans ce périmètre.</p>';
    else if (!r.ranked.length) html += '<p class="hint">' + rem + ' maison(s) restent à voir. La projection s\'affichera dès qu\'un créneau aura au moins ' + MIN_N + ' passages.</p>';
    else {
      html += '<p style="margin:0 0 4px"><b>' + rem + '</b> maison(s) restent à voir ou à repasser. Si on les visite sur un même créneau :</p>' +
        '<table><tr><th>Créneau</th><th>Présence</th><th>Maisons jointes</th><th>Tours pour tout finir*</th></tr>' +
        r.ranked.slice(0, 3).map(function (x) {
          var p = pct(x) / 100, got = Math.round(rem * p);
          var tours = p >= 1 ? 1 : (p <= 0 ? 0 : Math.ceil(Math.log(0.05) / Math.log(1 - p)));
          return '<tr><td>' + DAYS_FULL[x.day] + ' ' + SLOTS[x.slot].label.toLowerCase() + '</td><td>' + pct(x) + ' %</td><td>≈ ' + got + ' sur ' + rem + '</td><td>' + (tours ? tours + ' tour' + (tours > 1 ? 's' : '') : '—') + '</td></tr>';
        }).join('') + '</table><p class="hint" style="margin:4px 0 0">* Nombre de tours complets de ce créneau pour avoir vu 95 % des maisons, en supposant que les foyers sont indépendants d\'un passage à l\'autre. Estimation indicative.</p>';
    }

    // rythme des distributeurs
    var wk = Object.keys(r.who).sort();
    html += '<h4>Rythme des distributeurs</h4><div style="overflow-x:auto"><table><tr><th>Personne</th><th>Passages</th>' + SLOTS.map(function (s) { return '<th>' + s.label + '</th>'; }).join('') + '<th>Jour le plus actif</th></tr>' +
      wk.map(function (k) {
        var w = r.who[k], mx = 0, md = 0;
        w.days.forEach(function (n, i) { if (n > mx) { mx = n; md = i; } });
        return '<tr><td>' + T.esc(k) + '</td><td>' + w.n + '</td>' + w.slots.map(function (n) { return '<td>' + n + '</td>'; }).join('') + '<td>' + DAYS_FULL[md] + ' (' + mx + ')</td></tr>';
      }).join('') + '</table></div>';
    box.innerHTML = html;
  }

  /* ---------- événements de la commune ---------- */
  var KINDS = { marche: 'Marché', rando: 'Marche / randonnée', vide: 'Vide-grenier', sport: 'Match / sport', fete: 'Fête / cérémonie', autre: 'Autre' };
  var evEdit = null;       // id de l'événement en modification ('' = nouveau, null = formulaire fermé)

  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function hm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function dayLabel(ds) { var d = new Date(ds + 'T12:00:00'); return DAYS_FULL[dowOf(d)] + ' ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }

  // L'événement a-t-il lieu à ce jour (et à cette heure) ?
  function occursAt(e, date) {
    var ds = ymd(date);
    var dayOk = ds === e.date || (e.repeat === 'weekly' && ds > e.date && (!e.until || ds <= e.until) && dowOf(new Date(e.date + 'T12:00:00')) === dowOf(date));
    if (!dayOk) return false;
    if (!e.start && !e.end) return true;
    var t = hm(date);
    return t >= (e.start || '00:00') && t <= (e.end || '23:59');
  }

  function renderEvents() {
    var box = T.$('#evBox');
    if (!box) return;
    var list = T.store.events(), today = ymd(new Date());
    var cur = evEdit ? list.filter(function (x) { return x.id === evEdit; })[0] : null;
    cur = cur || { title: '', kind: 'marche', date: today, start: '', end: '', repeat: '', until: '' };
    var html = '<p class="hint" style="margin-top:0">Ajoutez ce qui se passe dans la commune (marché, marche, vide-grenier, match…). L\'appli compare ensuite la présence des gens pendant ces moments et le reste du temps.</p>';
    if (evEdit === null) {
      html += '<div class="btn-col"><button type="button" class="btn-main" id="evNew">＋ Ajouter un événement</button></div>';
    } else {
      html += '<div class="evform">' +
        '<label>Nom<input id="evTitle" type="text" value="' + T.esc(cur.title) + '" placeholder="Ex : Marché du samedi" autocomplete="off"></label>' +
        '<label>Type<select id="evKind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (cur.kind === k ? ' selected' : '') + '>' + KINDS[k] + '</option>'; }).join('') + '</select></label>' +
        '<label>Date (ou 1re date)<input id="evDate" type="date" value="' + T.esc(cur.date) + '"></label>' +
        '<div class="two2"><label>De<input id="evStart" type="time" value="' + T.esc(cur.start) + '"></label><label>À<input id="evEnd" type="time" value="' + T.esc(cur.end) + '"></label></div>' +
        '<p class="hint" style="margin:0">Sans horaire : toute la journée.</p>' +
        '<label>Répétition<select id="evRep"><option value="">Une seule fois</option><option value="weekly"' + (cur.repeat === 'weekly' ? ' selected' : '') + '>Chaque semaine (même jour)</option></select></label>' +
        '<label>Jusqu\'au (facultatif)<input id="evUntil" type="date" value="' + T.esc(cur.until) + '"></label>' +
        '<div class="acts"><button type="button" class="btn-main" id="evSave">Enregistrer</button><button type="button" class="btn-sec" id="evCancel">Annuler</button>' +
        (evEdit ? '<button type="button" class="btn-danger" id="evDel">Supprimer</button>' : '') + '</div></div>';
    }
    var A = T.AGENDA, have = {};
    list.forEach(function (e) { have[e.title.toLowerCase() + '|' + e.date] = 1; });
    var sugg = A ? A.items.filter(function (x) { return !have[x.title.toLowerCase() + '|' + x.date]; }) : [];
    if (A && evEdit === null) {
      html += '<div class="evagenda"><b>Agenda de la mairie</b> <small>(relevé du ' + new Date(A.releve + 'T12:00:00').toLocaleDateString('fr-FR') + ')</small>' +
        (sugg.length ? sugg.map(function (x, i) {
          return '<div class="srow"><div class="grow"><b>' + T.esc(x.title) + '</b><small>' + dayLabel(x.date) + (x.start ? ' · ' + x.start : '') + (x.note ? ' · ' + T.esc(x.note) : '') + '</small></div><button type="button" class="btn-sec" data-evadd="' + i + '">Ajouter</button></div>';
        }).join('') + '<div class="acts" style="margin-top:6px"><button type="button" class="btn-sec" id="evAddAll">Tout ajouter</button></div>' : '<p class="hint" style="margin:4px 0">Tout est déjà ajouté.</p>') +
        '<p class="hint" style="margin:6px 0 0">Seuls les événements d\'un jour sont proposés (période du 1/11 au 20/12, liste incomplète). <a href="' + A.url + '" target="_blank" rel="noopener">Ouvrir l\'agenda complet</a> pour en ajouter d\'autres à la main.</p></div>';
      box.__sugg = sugg;
    }
    if (list.length) {
      html += '<table class="evt"><tr><th>Quand</th><th>Événement</th><th></th></tr>' + list.map(function (e) {
        var when = e.repeat === 'weekly' ? 'Chaque ' + DAYS_FULL[dowOf(new Date(e.date + 'T12:00:00'))] + (e.until ? ' jusqu\'au ' + new Date(e.until + 'T12:00:00').toLocaleDateString('fr-FR') : '') : dayLabel(e.date);
        var hrs = e.start || e.end ? ' · ' + (e.start || '…') + '–' + (e.end || '…') : '';
        return '<tr><td>' + T.esc(when) + hrs + '</td><td><b>' + T.esc(e.title) + '</b><small>' + KINDS[e.kind] + '</small></td><td><button type="button" class="btn-sec" data-evedit="' + e.id + '">Modifier</button></td></tr>';
      }).join('') + '</table>';
    } else html += '<p class="hint">Aucun événement pour l\'instant.</p>';
    box.innerHTML = html;
  }

  function renderImpact() {
    var box = T.$('#impBox');
    if (!box) return;
    var evs = T.store.events();
    if (!evs.length) { box.innerHTML = '<p class="hint">Ajoutez des événements ci-dessus pour mesurer leur effet sur la présence.</p>'; return; }
    var all = visits();
    if (!all.length) { box.innerHTML = '<p class="hint">Pas encore de passage avec date et heure.</p>'; return; }
    var rows = Object.keys(KINDS).map(function (k) {
      var ofKind = evs.filter(function (e) { return e.kind === k; });
      if (!ofKind.length) return null;
      var during = { n: 0, p: 0 }, outside = { n: 0, p: 0 };
      all.forEach(function (v) {
        var hit = ofKind.some(function (e) { return occursAt(e, v.date); });
        var b = hit ? during : outside; b.n++; if (v.present) b.p++;
      });
      return { k: k, d: during, o: outside };
    }).filter(Boolean);
    var html = '<table><tr><th>Type</th><th>Pendant</th><th>Hors événement</th><th>Écart</th></tr>' + rows.map(function (r) {
      var rd = r.d.n ? Math.round(100 * r.d.p / r.d.n) : null, ro = r.o.n ? Math.round(100 * r.o.p / r.o.n) : null;
      var ok = r.d.n >= MIN_N && r.o.n >= MIN_N, diff = ok ? rd - ro : null;
      return '<tr><td>' + KINDS[r.k] + '</td><td>' + (rd == null ? '—' : rd + ' %') + '<small>' + r.d.n + ' pass.</small></td><td>' + (ro == null ? '—' : ro + ' %') + '<small>' + r.o.n + ' pass.</small></td><td>' +
        (ok ? '<b style="color:' + (diff < -5 ? '#b3261e' : diff > 5 ? '#2e9e4f' : '#555') + '">' + (diff > 0 ? '+' : '') + diff + ' pts</b>' : '<span class="low">trop peu de passages</span>') + '</td></tr>';
    }).join('') + '</table>' +
      '<p class="hint" style="margin:4px 0 0">Écart = présence pendant l\'événement moins présence le reste du temps (au moins ' + MIN_N + ' passages de chaque côté). Un écart négatif veut dire que les gens sont moins souvent chez eux pendant l\'événement. C\'est une corrélation : d\'autres facteurs (heure, jour, quartier) jouent aussi.</p>';
    // événements à venir (14 jours)
    var now = new Date(), upcoming = [];
    for (var i = 0; i < 14; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12, 0);
      evs.forEach(function (e) { if (occursAt(Object.assign({}, e, { start: '', end: '' }), d)) upcoming.push({ d: d, e: e }); });
    }
    html += '<h4>À venir (14 jours)</h4>' + (upcoming.length ? '<ul class="upc">' + upcoming.map(function (u) {
      return '<li>' + dayLabel(ymd(u.d)) + ' — <b>' + T.esc(u.e.title) + '</b>' + (u.e.start || u.e.end ? ' (' + (u.e.start || '…') + '–' + (u.e.end || '…') + ')' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="hint">Rien de prévu.</p>');
    box.innerHTML = html;
  }

  function render() { renderPres(); renderEvents(); renderImpact(); }

  function init() {
    var body = T.$('#statsBody');
    if (!body) return;
    body.innerHTML =
      '<div class="card"><h3>Présence : jours et horaires</h3><div id="presBox"></div></div>' +
      '<div class="card"><h3>Événements de la commune</h3><div id="evBox"></div></div>' +
      '<div class="card"><h3>Effet des événements sur la présence</h3><div id="impBox"></div></div>';
    var box = T.$('#presBox');
    box.addEventListener('change', function (e) {
      if (e.target.id === 'presSec') { sel.sector = e.target.value; renderPres(); }
      if (e.target.id === 'presZone') { sel.zone = e.target.value; renderPres(); }
      if (e.target.id === 'presQuart') { sel.quartier = e.target.value; renderPres(); }
      if (e.target.id === 'presWho') { sel.who = e.target.value; renderPres(); }
    });
    T.$('#evBox').addEventListener('click', function (e) {
      var id = e.target.id, ed = e.target.getAttribute('data-evedit');
      var ad = e.target.getAttribute('data-evadd'), sg = T.$('#evBox').__sugg || [];
      if (ad != null && sg[ad]) { T.store.saveEvent('', sg[ad]); T.toast('Événement ajouté'); renderEvents(); renderImpact(); }
      else if (id === 'evAddAll') { sg.forEach(function (x) { T.store.saveEvent('', x); }); T.toast(sg.length + ' événement(s) ajouté(s)'); renderEvents(); renderImpact(); }
      else if (ed) { evEdit = ed; renderEvents(); }
      else if (id === 'evNew') { evEdit = ''; renderEvents(); }
      else if (id === 'evCancel') { evEdit = null; renderEvents(); }
      else if (id === 'evSave') {
        var r = T.store.saveEvent(evEdit, { title: T.$('#evTitle').value, kind: T.$('#evKind').value, date: T.$('#evDate').value, start: T.$('#evStart').value, end: T.$('#evEnd').value, repeat: T.$('#evRep').value, until: T.$('#evUntil').value });
        if (!r) { T.toast('Indiquez un nom et une date'); return; }
        evEdit = null; T.toast('Événement enregistré'); renderEvents(); renderImpact();
      } else if (id === 'evDel') {
        if (confirm('Supprimer cet événement ?')) { T.store.deleteEvent(evEdit); evEdit = null; renderEvents(); renderImpact(); }
      }
    });
    T.bus.on('change', function () { if (T.$('#view-stats').classList.contains('active') && evEdit === null) render(); });
  }

  T.stats = { render: render, init: init, occursAt: occursAt, _visits: visits, _compute: compute };
})();
