/*!
 * Tournée calendriers — store.js (données locales + fusion pour le partage)
 * Les données sont gardées dans le navigateur ; sync.js les partage via GitHub.
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var KEY = 'bfs_briec_v1';
  var state = { houses: [], settings: { team: '' }, deleted: [], caisse: {}, stock: {}, params: null, sectors: {}, events: {} };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.houses)) {
          state.houses = d.houses;
          state.settings = d.settings || { team: '' };
          state.deleted = Array.isArray(d.deleted) ? d.deleted : [];
          state.caisse = d.caisse && typeof d.caisse === 'object' ? d.caisse : {};
          state.stock = d.stock && typeof d.stock === 'object' ? d.stock : {};
          state.params = d.params && typeof d.params === 'object' ? d.params : null;
          state.sectors = d.sectors && typeof d.sectors === 'object' ? d.sectors : {};
          state.events = d.events && typeof d.events === 'object' ? d.events : {};
        }
      }
    } catch (e) { console.error('Lecture impossible', e); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { T.toast('Enregistrement impossible (stockage plein ou bloqué)'); }
  }
  // fromRemote = true : changement venu du partage (ne doit pas être renvoyé)
  function save(fromRemote) {
    persist();
    T.bus.emit('change');
    if (!fromRemote) T.bus.emit('local');
  }
  function numKey(n) {
    var m = String(n || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 1e9;
  }
  function same(h, street, number) {
    return h.street.toLowerCase() === street.toLowerCase() &&
           String(h.number).toLowerCase() === String(number).toLowerCase();
  }
  function isDeleted(id) { return state.deleted.indexOf(id) >= 0; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  // Nombre de calendriers remis pour ce don (1 par défaut)
  function calOf(h) { var n = parseInt(h.cal, 10); return h.pay ? (n > 0 ? n : 1) : 0; }
  function cents(h) { return h.pay === 'gratuit' ? 0 : Math.round((Number(h.amount) || 0) * 100); }
  function csvLine(r) {
    return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
  }
  // Journal des passages d'un logement : [{d: date ISO, by: équipe, s: statut}]
  function visitKey(v) { return v.d + '|' + v.by + '|' + v.s; }
  function unionVisits(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (v) {
      if (!v || !v.d || seen[visitKey(v)]) return;
      seen[visitKey(v)] = 1; out.push(v);
    });
    return out.sort(function (x, y) { return x.d < y.d ? -1 : 1; });
  }
  // Ajoute un passage (sauf double touche : même équipe, même statut, moins de 2 minutes)
  function addVisit(h, status) {
    if (status === 'todo') return;
    var team = state.settings.team || '', now = Date.now();
    var last = (h.visits || []).filter(function (v) { return v.by === team; }).pop();
    if (last && last.s === status && now - Date.parse(last.d) < 120000) return;
    h.visits = (h.visits || []).concat([{ d: new Date(now).toISOString(), by: team, s: status }]);
  }
  // Identifiant stable pour une adresse importée : deux appareils qui importent la même
  // adresse obtiennent le même id, la fusion ne crée donc pas de doublon
  function addrId(street, number) {
    var str = String(street).toLowerCase() + '|' + String(number).toLowerCase(), h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return 'a' + h.toString(36) + str.length.toString(36);
  }
  // Clé de comparaison des noms de rue : sans majuscules, accents, tirets ni apostrophes
  function skey(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function addrKey(h) {
    return String(h.street).toLowerCase().trim() + '|' + String(h.number).toLowerCase().trim() + '|' + String(h.unit || '').toLowerCase().trim();
  }
  function rank(h) {
    return [h.status !== 'todo' ? 1 : 0, (h.visits || []).length, h.pay ? 1 : 0, h.updated || '', h.id];
  }
  function better(a, b) {
    var ra = rank(a), rb = rank(b);
    for (var i = 0; i < ra.length; i++) { if (ra[i] > rb[i]) return true; if (ra[i] < rb[i]) return false; }
    return false;
  }
  // Fusionne les fiches qui désignent la même adresse (même rue, numéro, logement).
  // Retourne le nombre de fiches supprimées. Le choix du gagnant est déterministe :
  // tous les appareils gardent la même fiche.
  function dedupe() {
    var groups = {}, removed = 0;
    state.houses.forEach(function (h) { (groups[addrKey(h)] = groups[addrKey(h)] || []).push(h); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 2 || !g[0].street || !g[0].number) return;   // adresses incomplètes : on ne touche pas
      var win = g.reduce(function (a, b) { return better(b, a) ? b : a; });
      g.forEach(function (h) {
        if (h === win) return;
        win.visits = unionVisits(win.visits, h.visits);
        if (win.lat == null && h.lat != null) { win.lat = h.lat; win.lng = h.lng; }
        if (!win.note && h.note) win.note = h.note;
        if (!win.dog && h.dog) win.dog = true;
        if (!win.ff && h.ff) win.ff = true;
        if (!win.pay && h.pay) { ['pay', 'amount', 'cal', 'motif', 'donor', 'receipt', 'email', 'paid_on', 'paid_by'].forEach(function (f) { win[f] = h[f]; }); }
        if (!isDeleted(h.id)) state.deleted.push(h.id);
        removed++;
      });
      if (removed) win.updated = new Date().toISOString();
    });
    if (removed) {
      state.houses = state.houses.filter(function (h) { return !isDeleted(h.id); });
    }
    return removed;
  }
  function quartier(street) { return (T.quartierOf && T.quartierOf(street)) || 'Autres rues'; }

  T.store = {
    all: function () { return state.houses; },
    get: function (id) { return state.houses.filter(function (h) { return h.id === id; })[0] || null; },
    team: function () { return state.settings.team || ''; },
    setTeam: function (t) {
      state.settings.team = String(t || '').trim();
      persist();
      T.bus.emit('change');
    },

    add: function (h) {
      var pay = h.pay || '';
      var o = {
        id: T.uid(),
        street: String(h.street || '').trim(),
        number: String(h.number || '').trim(),
        unit: String(h.unit || '').trim(),
        lat: h.lat == null ? null : h.lat,
        lng: h.lng == null ? null : h.lng,
        status: h.status || 'todo',
        note: String(h.note || '').trim(),
        dog: !!h.dog,
        ff: !!h.ff,
        amount: pay ? (h.amount == null ? null : h.amount) : null,
        pay: pay,
        cal: pay ? (parseInt(h.cal, 10) > 0 ? parseInt(h.cal, 10) : 1) : 0,
        motif: pay === 'gratuit' ? String(h.motif || '') : '',
        donor: String(h.donor || '').trim(),
        receipt: !!h.receipt,
        email: String(h.email || '').trim(),
        souche: (pay === 'esp' || pay === 'chq') ? String(h.souche || '').trim() : '',
        paid_on: pay ? today() : '',
        paid_by: pay ? (state.settings.team || '') : '',
        team: h.team || state.settings.team || '',
        visits: [],
        updated: new Date().toISOString()
      };
      addVisit(o, o.status);
      state.houses.push(o);
      save();
      return o;
    },
    update: function (id, patch, opts) {
      var h = T.store.get(id);
      if (!h) return null;
      // Un don modifié est daté et attribué à l'équipe qui le saisit
      var donChanged = (patch.amount !== undefined && patch.amount !== h.amount) ||
                       (patch.pay !== undefined && patch.pay !== h.pay);
      Object.keys(patch).forEach(function (k) { h[k] = patch[k]; });
      if (h.pay !== 'gratuit') h.motif = '';
      if (h.pay !== 'esp' && h.pay !== 'chq') h.souche = '';
      if (opts && opts.visit) addVisit(h, h.status);
      if (donChanged) {
        if (h.pay) { h.paid_on = today(); h.paid_by = state.settings.team || h.paid_by || ''; }
        else { h.paid_on = ''; h.paid_by = ''; h.amount = null; h.cal = 0; }
      }
      if (patch.status !== undefined || patch.note !== undefined || donChanged) {
        h.team = state.settings.team || h.team || '';
      }
      h.updated = new Date().toISOString();
      save();
      return h;
    },
    remove: function (id) {
      state.houses = state.houses.filter(function (h) { return h.id !== id; });
      if (!isDeleted(id)) state.deleted.push(id);
      save();
    },
    // Crée une série de numéros dans une rue (ignore les doublons)
    addRange: function (street, from, to, step) {
      street = String(street || '').trim();
      from = parseInt(from, 10); to = parseInt(to, 10);
      if (!street || isNaN(from) || isNaN(to)) return 0;
      if (from > to) { var t = from; from = to; to = t; }
      var created = 0;
      for (var n = from; n <= to; n++) {
        if (step === 'even' && n % 2 !== 0) continue;
        if (step === 'odd' && n % 2 !== 1) continue;
        var dup = state.houses.some(function (h) { return same(h, street, n); });
        if (dup) continue;
        state.houses.push({
          id: T.uid(), street: street, number: String(n), unit: '', lat: null, lng: null,
          status: 'todo', note: '', team: state.settings.team || '',
          updated: new Date().toISOString()
        });
        created++;
      }
      if (created) save();
      return created;
    },
    // Ajoute des adresses importées (rue, numéro, lat, lng). Une habitation déjà créée
    // sans position reçoit ses coordonnées ; les autres doublons sont ignorés.
    addAddresses: function (items) {
      // Plusieurs logements peuvent partager une adresse : on regarde rue + numéro, tous logements confondus
      var idx = {};
      state.houses.forEach(function (h) {
        var k = h.street.toLowerCase() + '|' + String(h.number).toLowerCase();
        (idx[k] = idx[k] || []).push(h);
      });
      var created = 0, placed = 0, skipped = 0, now = new Date().toISOString();
      items.forEach(function (a) {
        var key = a.street.toLowerCase() + '|' + String(a.number).toLowerCase();
        var ex = idx[key];
        if (ex) {
          var did = false;
          ex.forEach(function (h) {
            if (h.lat == null && a.lat != null) { h.lat = a.lat; h.lng = a.lng; h.updated = now; did = true; }
          });
          if (did) placed++; else skipped++;
          return;
        }
        var h = { id: addrId(a.street, a.number), street: a.street, number: String(a.number), unit: '', lat: a.lat, lng: a.lng,
          status: 'todo', note: '', team: '', updated: now };
        state.houses.push(h);
        idx[key] = [h];
        created++;
      });
      if (created || placed) save();
      return { created: created, placed: placed, skipped: skipped };
    },
    // Tous les logements d'une même adresse (rue + numéro)
    atAddress: function (street, number) {
      var s = String(street || '').toLowerCase(), n = String(number || '').toLowerCase();
      return T.store.sorted().filter(function (h) {
        return h.street.toLowerCase() === s && String(h.number).toLowerCase() === n;
      });
    },
    streets: function () {
      var seen = {};
      state.houses.forEach(function (h) { if (h.street) seen[h.street] = 1; });
      return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    },
    sorted: function (filter) {
      return state.houses
        .filter(function (h) { return !filter || filter === 'all' || h.status === filter; })
        .sort(function (a, b) {
          var s = (a.street || '~').localeCompare(b.street || '~', 'fr');
          return s || numKey(a.number) - numKey(b.number) ||
            String(a.number).localeCompare(String(b.number)) ||
            String(a.unit || '').localeCompare(String(b.unit || ''), 'fr', { numeric: true });
        });
    },
    stats: function () {
      var s = { total: state.houses.length, todo: 0, passe: 0, repasser: 0, refus: 0, inhabite: 0 };
      state.houses.forEach(function (h) { if (s[h.status] !== undefined) s[h.status]++; });
      return s;
    },
    // Passages : total, par équipe, adresses visitées plusieurs fois
    visitStats: function () {
      var out = { total: 0, byTeam: {}, multi: 0, housesVisited: 0 };
      state.houses.forEach(function (h) {
        var v = h.visits || [];
        if (!v.length) return;
        out.housesVisited++;
        if (v.length > 1) out.multi++;
        v.forEach(function (x) { out.total++; out.byTeam[x.by || '(sans équipe)'] = (out.byTeam[x.by || '(sans équipe)'] || 0) + 1; });
      });
      return out;
    },
    byTeam: function () {
      var out = {};
      state.houses.forEach(function (h) {
        if (h.status === 'todo') return;
        var k = h.team || '(sans équipe)';
        out[k] = out[k] || { passe: 0, repasser: 0, refus: 0, inhabite: 0 };
        out[k][h.status]++;
      });
      return out;
    },

    // Avancement par secteur (toutes les habitations, y compris « pas visité »)
    bySector: function () {
      var out = {};
      state.houses.forEach(function (h) {
        var k = T.store.sectorOf(h.street) || 'Hors secteur';
        out[k] = out[k] || { passe: 0, repasser: 0, refus: 0, inhabite: 0, todo: 0, total: 0 };
        out[k][h.status]++; out[k].total++;
      });
      return out;
    },

    /* ---------- argent ---------- */
    // Totaux des dons (en euros), globalement et par équipe / quartier / jour
    finance: function () {
      function blank() { return { c: 0, esp: 0, chq: 0, gratuit: 0, n: 0, sold: 0, gift: 0, cs: 0, kept: 0, nesp: 0, nchq: 0 }; }
      function bucket(o, k) { return (o[k] = o[k] || blank()); }
      function add(b, h) {
        var c = cents(h);
        b.n++;
        if (h.pay === 'gratuit') {
          b.gratuit++;
          if (h.motif === 'garde') b.kept += calOf(h);
          else if (h.motif === 'echange') b.cs += calOf(h);
          else b.gift += calOf(h);
        } else {
          b.sold += calOf(h); b.c += c;
          if (h.pay === 'esp') { b.esp += c; b.nesp++; } else { b.chq += c; b.nchq++; }
        }
      }
      var out = { all: blank(), team: {}, quartier: {}, sector: {}, day: {}, souche: {} }, chqAmt = {};
      state.houses.forEach(function (h) {
        if (!h.pay) return;
        var who = h.paid_by || h.team || '(sans équipe)';
        add(out.all, h);
        add(bucket(out.team, who), h);
        add(bucket(out.quartier, quartier(h.street)), h);
        add(bucket(out.sector, T.store.sectorOf(h.street) || 'Hors secteur'), h);
        add(bucket(out.day, h.paid_on || '(sans date)'), h);
        if (h.pay === 'esp' || h.pay === 'chq') {
          add(bucket(out.souche, who + ' — ' + (h.souche ? 'souche ' + h.souche : 'sans n° de souche')), h);
        }
        if (h.pay === 'chq') { var ak = String(Number(h.amount) || 0); chqAmt[ak] = (chqAmt[ak] || 0) + 1; }
      });
      function eur(b) {
        var np = b.nesp + b.nchq;
        return { total: b.c / 100, esp: b.esp / 100, chq: b.chq / 100, gratuit: b.gratuit, n: b.n, sold: b.sold, gift: b.gift, cs: b.cs, kept: b.kept,
          cal: b.sold + b.gift + b.cs, nesp: b.nesp, nchq: b.nchq, nPaid: np, avg: np ? Math.round(b.c / np) / 100 : 0 };
      }
      var res = { all: eur(out.all), team: {}, quartier: {}, sector: {}, day: {}, souche: {}, chqAmt: chqAmt };
      ['team', 'quartier', 'sector', 'day', 'souche'].forEach(function (g) {
        Object.keys(out[g]).forEach(function (k) { res[g][k] = eur(out[g][k]); });
      });
      return res;
    },
    /* Secteurs : groupes de quartiers et de rues (partagés). { id: {name, quartiers[], streets[], updated, deleted?} } */
    sectors: function () {
      return Object.keys(state.sectors).filter(function (id) { return !state.sectors[id].deleted; })
        .map(function (id) { var s = state.sectors[id]; return { id: id, name: s.name, quartiers: s.quartiers || [], streets: s.streets || [], type: s.type || '' }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
    },
    // Secteur d'une rue : l'affectation de la rue prime sur celle de son quartier
    sectorOf: function (street) {
      var k = skey(street), q = (T.quartierOf && T.quartierOf(street)) || '', byQ = '';
      var list = T.store.sectors();
      for (var i = 0; i < list.length; i++) {
        if (list[i].streets.some(function (x) { return skey(x) === k; })) return list[i].name;
        if (q && list[i].quartiers.indexOf(q) >= 0) byQ = list[i].name;
      }
      return byQ;
    },
    // Type du secteur de la rue : 'ville', 'campagne' ou '' (non précisé / hors secteur)
    zoneOf: function (street) {
      var n = T.store.sectorOf(street);
      if (!n) return '';
      var l = T.store.sectors().filter(function (s) { return s.name === n; })[0];
      return (l && l.type) || '';
    },
    saveSector: function (id, name, quartiers, streets, type) {
      name = String(name || '').replace(/\s+/g, ' ').trim();
      if (!name) return null;
      if (!id) id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      var now = new Date().toISOString();
      // une rue ou un quartier n'appartient qu'à un secteur : on le retire des autres
      Object.keys(state.sectors).forEach(function (o) {
        var s = state.sectors[o]; if (o === id || s.deleted) return;
        var nq = (s.quartiers || []).filter(function (x) { return quartiers.indexOf(x) < 0; });
        var ns = (s.streets || []).filter(function (x) { return !streets.some(function (y) { return skey(y) === skey(x); }); });
        if (nq.length !== (s.quartiers || []).length || ns.length !== (s.streets || []).length) state.sectors[o] = { name: s.name, quartiers: nq, streets: ns, type: s.type || '', updated: now };
      });
      state.sectors[id] = { name: name, quartiers: quartiers.slice(), streets: streets.slice(), type: type === 'ville' || type === 'campagne' ? type : '', updated: now };
      save();
      return id;
    },
    deleteSector: function (id) {
      if (!state.sectors[id]) return;
      state.sectors[id] = { name: state.sectors[id].name, quartiers: [], streets: [], type: '', deleted: true, updated: new Date().toISOString() };
      save();
    },
    /* Événements de la commune (marché, marche, vide-grenier…), partagés : { id: {title, kind, date, start, end, repeat, until, updated, deleted?} } */
    events: function () {
      return Object.keys(state.events).filter(function (id) { return !state.events[id].deleted; })
        .map(function (id) { var e = state.events[id]; return { id: id, title: e.title, kind: e.kind || 'autre', date: e.date, start: e.start || '', end: e.end || '', repeat: e.repeat || '', until: e.until || '' }; })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    },
    saveEvent: function (id, e) {
      var title = String(e.title || '').replace(/\s+/g, ' ').trim();
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) return null;
      if (!id) id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      state.events[id] = { title: title, kind: e.kind || 'autre', date: e.date, start: e.start || '', end: e.end || '', repeat: e.repeat === 'weekly' ? 'weekly' : '', until: e.until || '', updated: new Date().toISOString() };
      save();
      return id;
    },
    deleteEvent: function (id) {
      if (!state.events[id]) return;
      state.events[id] = { title: state.events[id].title, date: state.events[id].date, deleted: true, updated: new Date().toISOString() };
      save();
    },
    // Paramètres de l'indemnisation des distributeurs (partagés) : coût = tarif × calendriers distribués + forfait
    getParams: function () {
      var p = state.params || {};
      function num(v, d) { v = parseFloat(String(v).replace(',', '.')); return isNaN(v) || v < 0 ? d : v; }
      return { rate: num(p.rate, 0.8), fixe: num(p.fixe, 20), nb: Math.max(1, parseInt(p.nb, 10) || 3), set: !!state.params };
    },
    setParams: function (rate, fixe, nb) {
      state.params = { rate: rate, fixe: fixe, nb: nb, updated: new Date().toISOString() };
      var ok = T.store.getParams();                       // valeurs corrigées si saisie invalide
      state.params = { rate: ok.rate, fixe: ok.fixe, nb: ok.nb, updated: state.params.updated };
      save();
    },
    indemnite: function () {
      var p = T.store.getParams(), f = T.store.finance().all;
      var cost = Math.round((p.rate * f.cal + p.fixe) * 100) / 100;
      return { rate: p.rate, fixe: p.fixe, nb: p.nb, dist: f.cal, cost: cost, each: Math.round(cost / p.nb * 100) / 100,
        total: f.total, net: Math.round((f.total - cost) * 100) / 100 };
    },
    // Dons avec demande de reçu ou de facture
    receipts: function () {
      return T.store.sorted().filter(function (h) { return h.receipt; });
    },
    exportDonsCSV: function (onlyReceipts) {
      var rows = [['Date', 'Équipe', 'Rue', 'Numéro', 'Logement', 'Quartier', 'Montant', 'Paiement', 'Calendriers', 'Motif gratuit', 'N° de souche', 'Donateur', 'Reçu demandé', 'E-mail']];
      T.store.sorted().filter(function (h) { return onlyReceipts ? h.receipt : h.pay; }).forEach(function (h) {
        rows.push([h.paid_on || '', h.paid_by || h.team || '', h.street, h.number, h.unit || '', quartier(h.street),
          h.pay ? (h.pay === 'gratuit' ? 0 : Number(h.amount) || 0) : '', h.pay ? T.PAY[h.pay] : '', calOf(h) || '', h.motif ? T.MOTIFS[h.motif] || '' : '', h.souche || '',
          h.donor || '', h.receipt ? 'oui' : '', h.email || '']);
      });
      return '﻿' + rows.map(csvLine).join('\r\n');
    },
    // Comptage de caisse d'une équipe : { esp: {valeur: quantité}, chq: {...}, chqOther: euros, updated }
    // Stock de calendriers d'une personne : reçus au départ, rendus (non distribués) à la fin
    getStock: function (team) { return state.stock[team] || null; },
    setStock: function (team, recu, rendu) {
      state.stock[team] = { recu: Math.max(0, parseInt(recu, 10) || 0), rendu: Math.max(0, parseInt(rendu, 10) || 0), updated: new Date().toISOString() };
      save();
    },
    // Bilan des calendriers par personne : reçus, vendus (contre un don), donnés, distribués, rendus, reste théorique
    calendriers: function () {
      var f = T.store.finance(), seen = {}, rows = [];
      Object.keys(f.team).forEach(function (t) { seen[t] = 1; });
      Object.keys(state.stock).forEach(function (t) { seen[t] = 1; });
      Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).forEach(function (t) {
        var d = f.team[t] || { sold: 0, gift: 0, cs: 0, kept: 0, cal: 0 }, s = state.stock[t] || null;
        rows.push({ who: t, recu: s ? s.recu : null, rendu: s ? s.rendu : null, sold: d.sold, gift: d.gift, cs: d.cs, kept: d.kept, dist: d.cal,
          reste: s ? s.recu - d.cal - d.kept : null, ecart: s ? s.recu - d.cal - d.kept - s.rendu : null });
      });
      // Calendriers gratuits par motif (tous confondus)
      var motifs = {};
      state.houses.forEach(function (h) { if (h.pay === 'gratuit') { var m = h.motif || '(motif non précisé)'; motifs[m] = (motifs[m] || 0) + calOf(h); } });
      return { rows: rows, all: f.all, motifs: motifs };
    },
    // Un comptage par personne et par jour : clé « identifiant|AAAA-MM-JJ »
    today: today,
    // Plusieurs comptages possibles par personne et par jour (clé « identifiant|jour|n° ») ; les anciens (2 parties) restent lus.
    // Un comptage supprimé reste en place, marqué « deleted », pour que la suppression se propage aux autres appareils.
    countings: function (team, day) {
      var out = [];
      Object.keys(state.caisse).forEach(function (k) {
        var c = state.caisse[k], p = k.split('|');
        if (p.length < 2 || c.deleted) return;
        if ((team != null && p[0] !== team) || (day != null && p[1] !== day)) return;
        var t = T.store.caisseTotals(c);
        out.push({ key: k, who: p[0], day: p[1], esp: c.esp || {}, chq: c.chq || {}, tEsp: t.esp, tChq: t.chq, chqOther: Number(c.chqOther) || 0, at: c.created || c.updated || '' });
      });
      return out.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
    },
    // Cumul des comptages d'une personne pour un jour : quantités par valeur + totaux en euros ; null s'il n'y en a pas
    getCaisse: function (team, day) {
      var l = T.store.countings(team, day);
      if (!l.length) return null;
      var r = { esp: {}, chq: {}, tEsp: 0, tChq: 0, n: l.length };
      l.forEach(function (c) {
        Object.keys(c.esp).forEach(function (d) { r.esp[d] = (r.esp[d] || 0) + c.esp[d]; });
        Object.keys(c.chq).forEach(function (d) { r.chq[d] = (r.chq[d] || 0) + c.chq[d]; });
        r.tEsp += c.tEsp; r.tChq += c.tChq;
      });
      r.tEsp = Math.round(r.tEsp * 100) / 100; r.tChq = Math.round(r.tChq * 100) / 100;
      return r;
    },
    addCaisse: function (team, day, data) {
      var now = new Date().toISOString(), k = team + '|' + day + '|c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      state.caisse[k] = { esp: data.esp || {}, chq: data.chq || {}, chqOther: 0, created: now, updated: now };
      save();
      return k;
    },
    delCaisse: function (key) {
      if (!state.caisse[key]) return;
      state.caisse[key] = { deleted: true, updated: new Date().toISOString() };
      save();
    },
    teamsWithCaisse: function () {
      var seen = {};
      T.store.countings().forEach(function (c) { seen[c.who] = 1; });
      return Object.keys(seen);
    },
    // Jours connus : jours où un don a été saisi, jours déjà comptés, aujourd'hui (du plus récent au plus ancien)
    caisseDays: function () {
      var seen = {}; seen[today()] = 1;
      state.houses.forEach(function (h) { if (h.pay && h.paid_on) seen[h.paid_on] = 1; });
      T.store.countings().forEach(function (c) { seen[c.day] = 1; });
      return Object.keys(seen).sort().reverse();
    },
    // Dons saisis par une personne un jour donné (en euros)
    financeDay: function (team, day) {
      var esp = 0, chq = 0, n = 0, gratuit = 0, cal = 0, kept = 0;
      state.houses.forEach(function (h) {
        if (!h.pay || (h.paid_by || h.team || '(sans équipe)') !== team || h.paid_on !== day) return;
        n++;
        if (h.pay === 'gratuit') { gratuit++; if (h.motif === 'garde') kept += calOf(h); else cal += calOf(h); return; }
        cal += calOf(h);
        if (h.pay === 'esp') esp += cents(h); else chq += cents(h);
      });
      return { esp: esp / 100, chq: chq / 100, total: (esp + chq) / 100, n: n, gratuit: gratuit, cal: cal, kept: kept };
    },
    // Chèques saisis par une personne un jour donné : { 'montant': nombre }
    chequesDay: function (team, day) {
      var out = {};
      state.houses.forEach(function (h) {
        if (h.pay !== 'chq' || (h.paid_by || h.team || '(sans équipe)') !== team || h.paid_on !== day) return;
        var k = String(Number(h.amount) || 0).replace('.', '_');
        out[k] = (out[k] || 0) + 1;
      });
      return out;
    },
    // Total d'un comptage enregistré (en euros) : { esp, chq }
    caisseTotals: function (c) {
      var esp = 0, chq = 0;
      Object.keys(c.esp || {}).forEach(function (k) { esp += Math.round(parseFloat(k.replace('_', '.')) * 100) * c.esp[k]; });
      Object.keys(c.chq || {}).forEach(function (k) { chq += Math.round(parseFloat(k.replace('_', '.')) * 100) * c.chq[k]; });
      chq += Math.round((Number(c.chqOther) || 0) * 100);
      return { esp: esp / 100, chq: chq / 100 };
    },
    // Données du bordereau commun : une ligne par personne et par jour, avec le saisi et le compté
    bordereau: function () {
      var keys = {};
      state.houses.forEach(function (h) { if (h.pay && h.paid_on) keys[(h.paid_by || h.team || '(sans équipe)') + '|' + h.paid_on] = 1; });
      T.store.countings().forEach(function (c) { keys[c.who + '|' + c.day] = 1; });
      var rows = Object.keys(keys).sort(function (a, b) {
        var x = a.split('|'), y = b.split('|');
        return x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : x[0].localeCompare(y[0], 'fr');
      }).map(function (k) {
        var p = k.split('|'), s = T.store.financeDay(p[0], p[1]), c = T.store.getCaisse(p[0], p[1]);
        return { who: p[0], day: p[1], saisi: s, caisse: c, compte: c ? { esp: c.tEsp, chq: c.tChq } : null, n: c ? c.n : 0 };
      });
      // Détail des coupures comptées (tous comptages confondus), utile pour la remise en banque
      var esp = {}, chq = {}, other = 0;
      T.store.countings().forEach(function (c) {
        Object.keys(c.esp || {}).forEach(function (d) { esp[d] = (esp[d] || 0) + c.esp[d]; });
        Object.keys(c.chq || {}).forEach(function (d) { chq[d] = (chq[d] || 0) + c.chq[d]; });
        other += Number(c.chqOther) || 0;
      });
      var nBillets = 0, nPieces = 0;
      Object.keys(esp).forEach(function (d) { if (parseFloat(d.replace('_', '.')) >= 5) nBillets += esp[d]; else nPieces += esp[d]; });
      return { rows: rows, nBillets: nBillets, nPieces: nPieces, esp: esp, chq: chq, chqOther: Math.round(other * 100) / 100, fin: T.store.finance() };
    },
    setCaisse: function (team, day, data) {
      state.caisse[team + '|' + day] = { esp: data.esp || {}, chq: data.chq || {}, chqOther: Number(data.chqOther) || 0, updated: new Date().toISOString() };
      save();
    },

    /* ---------- sauvegarde, partage ---------- */
    // Contenu partagé (sans les réglages propres à l'appareil)
    snapshot: function () {
      return JSON.stringify({ app: 'bfs-tournee', version: T.VERSION, saved: new Date().toISOString(),
        houses: state.houses, deleted: state.deleted, caisse: state.caisse, stock: state.stock, params: state.params, sectors: state.sectors, events: state.events });
    },
    exportJSON: function () {
      return JSON.stringify({ app: 'bfs-tournee', version: T.VERSION, exported: new Date().toISOString(),
        houses: state.houses, deleted: state.deleted, caisse: state.caisse, stock: state.stock, params: state.params, sectors: state.sectors, events: state.events }, null, 2);
    },
    exportCSV: function () {
      var rows = [['Rue', 'Numéro', 'Logement', 'Statut', 'Note', 'Équipe', 'Latitude', 'Longitude', 'Passages', 'Mis à jour']];
      T.store.sorted().forEach(function (h) {
        rows.push([h.street, h.number, h.unit || '', T.STATUS[h.status].label, h.note, h.team,
          h.lat == null ? '' : h.lat, h.lng == null ? '' : h.lng, (h.visits || []).length, h.updated]);
      });
      return '﻿' + rows.map(csvLine).join('\r\n');
    },

    // Fusion : même id => la modification la plus récente gagne ; les suppressions sont conservées
    merge: function (d, fromRemote) {
      if (!d || !Array.isArray(d.houses)) return { ok: false, msg: 'Contenu non reconnu' };
      var added = 0, updated = 0, removed = 0, cch = 0;
      (Array.isArray(d.deleted) ? d.deleted : []).forEach(function (id) {
        if (!isDeleted(id)) state.deleted.push(id);
      });
      state.houses = state.houses.filter(function (h) {
        if (isDeleted(h.id)) { removed++; return false; }
        return true;
      });
      d.houses.forEach(function (n) {
        if (!n || !n.id || !T.STATUS[n.status] || isDeleted(n.id)) return;
        var cur = T.store.get(n.id);
        if (!cur) { state.houses.push(n); added++; }
        else if ((n.updated || '') > (cur.updated || '')) {
          var mine = cur.visits;
          Object.keys(n).forEach(function (k) { cur[k] = n[k]; });
          cur.visits = unionVisits(mine, n.visits);
          updated++;
        } else if (n.visits && n.visits.length) {
          // même plus ancienne, une fiche peut contenir des passages que nous n'avons pas encore
          var u = unionVisits(cur.visits, n.visits);
          if (u.length !== (cur.visits || []).length) { cur.visits = u; updated++; }
        }
      });
      var dc = d.caisse && typeof d.caisse === 'object' ? d.caisse : {};
      Object.keys(dc).forEach(function (t) {
        var n = dc[t], c = state.caisse[t];
        if (n && (!c || (n.updated || '') > (c.updated || ''))) { state.caisse[t] = n; cch++; }
      });
      if (d.params && typeof d.params === 'object' && (!state.params || (d.params.updated || '') > (state.params.updated || ''))) { state.params = d.params; cch++; }
      var dsec = d.sectors && typeof d.sectors === 'object' ? d.sectors : {};
      Object.keys(dsec).forEach(function (id) {
        var n = dsec[id], c = state.sectors[id];
        if (n && (!c || (n.updated || '') > (c.updated || ''))) { state.sectors[id] = n; cch++; }
      });
      var dev = d.events && typeof d.events === 'object' ? d.events : {};
      Object.keys(dev).forEach(function (id) {
        var n = dev[id], c = state.events[id];
        if (n && (!c || (n.updated || '') > (c.updated || ''))) { state.events[id] = n; cch++; }
      });
      var ds = d.stock && typeof d.stock === 'object' ? d.stock : {};
      Object.keys(ds).forEach(function (t) {
        var n = ds[t], c = state.stock[t];
        if (n && (!c || (n.updated || '') > (c.updated || ''))) { state.stock[t] = n; cch++; }
      });
      var dup = dedupe();
      if (dup) save(false);            // les suppressions de doublons doivent être partagées
      else if (added || updated || removed || cch) save(!!fromRemote); else persist();
      return { ok: true, added: added, updated: updated, removed: removed,
        msg: added + ' ajoutée(s), ' + updated + ' mise(s) à jour, ' + removed + ' supprimée(s)' };
    },
    importJSON: function (text) {
      var d;
      try { d = JSON.parse(text); } catch (e) { return { ok: false, msg: 'Fichier illisible' }; }
      if (!d || d.app !== 'bfs-tournee') return { ok: false, msg: 'Ce fichier n\'est pas une sauvegarde de l\'appli' };
      return T.store.merge(d, false);
    },
    // Rues écrites de plusieurs façons (« Venelle de poulgast » / « Venelle de Poulgast ») : [{ names, counts, best }]
    streetTwins: function () {
      var g = {};
      state.houses.forEach(function (h) {
        var k = skey(h.street);
        if (!k) return;
        g[k] = g[k] || {};
        g[k][h.street] = (g[k][h.street] || 0) + 1;
      });
      return Object.keys(g).filter(function (k) { return Object.keys(g[k]).length > 1; }).map(function (k) {
        var names = Object.keys(g[k]).sort(function (a, b) { return g[k][b] - g[k][a] || a.localeCompare(b, 'fr'); });
        return { names: names, counts: g[k], best: names[0] };
      });
    },
    // Renomme une rue (toutes ses habitations). Si une rue porte déjà ce nom, les deux sont fusionnées.
    renameStreet: function (from, to) {
      to = String(to || '').replace(/\s+/g, ' ').trim();
      if (!to || from === to) return 0;
      var n = 0, now = new Date().toISOString();
      state.houses.forEach(function (h) { if (h.street === from) { h.street = to; h.updated = now; n++; } });
      if (n) { T.store.dedupe(); save(); }
      return n;
    },
    // Restauration non destructive : ajoute les adresses d'une sauvegarde qui n'existent plus ici
    // (elles reçoivent un nouvel identifiant, car les anciens sont marqués supprimés chez tout le monde)
    restoreMissing: function (d) {
      if (!d || !Array.isArray(d.houses)) return { ok: false, msg: 'Sauvegarde non reconnue' };
      var have = {}, n = 0, now = new Date().toISOString();
      state.houses.forEach(function (h) { have[addrKey(h)] = 1; });
      d.houses.forEach(function (o) {
        if (!o || !T.STATUS[o.status] || have[addrKey(o)]) return;
        var h = JSON.parse(JSON.stringify(o));
        h.id = T.uid(); h.updated = now; have[addrKey(h)] = 1;
        state.houses.push(h); n++;
      });
      T.store.merge({ houses: [], deleted: [], caisse: d.caisse, stock: d.stock, params: d.params, sectors: d.sectors, events: d.events }, false);
      save();
      return { ok: true, n: n, msg: n + ' adresse(s) restaurée(s)' };
    },
    dedupe: function () { var n = dedupe(); if (n) save(); return n; },
    reset: function () {
      state.houses.forEach(function (h) { if (!isDeleted(h.id)) state.deleted.push(h.id); });
      state.houses = [];
      save();
    }
  };

  load();
})();
