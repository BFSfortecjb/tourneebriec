/*!
 * Tournée calendriers — map.js (carte Leaflet / OpenStreetMap)
 * © Jérémy Bizeul / Vigie-lance — Tous droits réservés
 */
(function () {
  'use strict';
  var T = window.Tour;
  var map, layer, addMode = false, placingId = null, fitted = false, mePin = null;

  // Statut affiché pour une adresse : celui des logements s'ils sont tous pareils ;
  // sinon « à repasser » s'il reste à faire, puis « passé », sinon « refus ».
  function aggregate(list) {
    var set = {};
    list.forEach(function (h) { set[h.status] = 1; });
    var keys = Object.keys(set);
    if (keys.length === 1) return keys[0];
    if (set.repasser || set.todo) return 'repasser';
    if (set.passe) return 'passe';
    if (set.refus) return 'refus';
    return 'inhabite';
  }

  function icon(group) {
    var h = group[0];
    var st = group.length > 1 ? aggregate(group) : h.status;
    var txt = T.esc(String(h.number || '').slice(0, 4));
    var cnt = group.length > 1 ? '<b class="cnt">' + group.length + '</b>' : '';
    var dog = group.some(function (x) { return x.dog; }) ? '<i class="dogb">🐶</i>' : '';
    if (group.some(function (x) { return x.ff; })) dog += '<i class="dogb ffb">🧑‍🚒</i>';
    return L.divIcon({
      className: '',
      html: '<div class="pinw"><div class="pin s-' + st + '">' + txt + '</div>' + cnt + dog + '</div>',
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
  }

  // Logement à ouvrir en touchant la pastille : le premier qui reste à faire
  function pick(group) {
    var order = ['todo', 'repasser'];
    for (var i = 0; i < order.length; i++) {
      var f = group.filter(function (h) { return h.status === order[i]; })[0];
      if (f) return f;
    }
    return group[0];
  }

  function render() {
    if (!map) return;
    layer.clearLayers();
    var groups = {}, order = [], pts = [];
    T.store.sorted().forEach(function (h) {
      if (h.lat == null || h.lng == null) return;
      var k = h.street.toLowerCase() + '|' + String(h.number).toLowerCase();
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(h);
    });
    order.forEach(function (k) {
      var g = groups[k];
      var m = L.marker([g[0].lat, g[0].lng], { icon: icon(g) });
      m.on('click', function () { T.app.openSheet(pick(g).id); });
      m.addTo(layer);
      pts.push([g[0].lat, g[0].lng]);
    });
    if (!fitted && pts.length) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 18 });
      fitted = true;
    }
  }

  function setAddMode(on) {
    addMode = !!on;
    T.$('#btnAdd').classList.toggle('on', addMode);
    T.$('#btnAdd').textContent = addMode ? '✕' : '＋';
    T.$('#addBanner').classList.toggle('hidden', !addMode);
  }

  function startPlacing(id) {
    placingId = id;
    setAddMode(false);
    var h = T.store.get(id);
    T.$('#placeTxt').textContent = 'Touchez la carte pour placer ' + (h ? h.street + ' ' + h.number : 'l\'habitation');
    T.$('#placeBanner').classList.remove('hidden');
    // On cadre la carte sur la rue : les autres numéros déjà placés servent de repère
    if (h && map) {
      var pts = T.store.all().filter(function (x) { return x.street === h.street && x.lat != null; })
        .map(function (x) { return [x.lat, x.lng]; });
      if (h.lat != null) map.setView([h.lat, h.lng], Math.max(map.getZoom(), 18));
      else if (pts.length) map.fitBounds(pts, { padding: [60, 60], maxZoom: 18 });
    }
  }
  function stopPlacing() {
    placingId = null;
    T.$('#placeBanner').classList.add('hidden');
  }

  function init() {
    map = L.map('map', { zoomControl: false }).setView([48.1, -3.99], 13);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    layer = L.layerGroup().addTo(map);

    map.on('click', function (e) {
      if (placingId) {
        var cur = T.store.get(placingId);
        // Tous les logements de l'adresse suivent la même position
        (cur ? T.store.atAddress(cur.street, cur.number) : []).forEach(function (h) {
          T.store.update(h.id, { lat: e.latlng.lat, lng: e.latlng.lng });
        });
        var id = placingId;
        stopPlacing();
        T.toast('Habitation placée');
        T.app.openSheet(id);
      } else if (addMode) {
        T.app.openSheet(null, { lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    T.$('#btnAdd').addEventListener('click', function () { setAddMode(!addMode); });
    T.$('#btnCancelPlace').addEventListener('click', stopPlacing);
    T.$('#btnLocate').addEventListener('click', locate);
    T.$('#searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      search(T.$('#searchInput').value);
    });
    T.bus.on('change', render);
    render();
  }

  function locate() {
    if (!navigator.geolocation) { T.toast('Position non disponible'); return; }
    T.toast('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(function (p) {
      var ll = [p.coords.latitude, p.coords.longitude];
      map.setView(ll, 18);
      if (mePin) map.removeLayer(mePin);
      mePin = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map);
    }, function () {
      T.toast('Position refusée (vérifiez l\'autorisation et le HTTPS)');
    }, { enableHighAccuracy: true, timeout: 15000 });
  }

  function search(q) {
    q = String(q || '').trim();
    if (!q) return;
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (a) {
        if (!a.length) { T.toast('Adresse introuvable'); return; }
        map.setView([parseFloat(a[0].lat), parseFloat(a[0].lon)], 18);
      })
      .catch(function () { T.toast('Recherche impossible (réseau)'); });
  }

  // Rue + numéro d'après des coordonnées (OpenStreetMap), au mieux
  function reverse(lat, lng) {
    return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=' + lat + '&lon=' + lng)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var a = (d && d.address) || {};
        return { street: a.road || a.pedestrian || a.path || '', number: a.house_number || '' };
      })
      .catch(function () { return { street: '', number: '' }; });
  }

  T.map = {
    init: init,
    render: render,
    reverse: reverse,
    startPlacing: startPlacing,
    focus: function (h) {
      if (h.lat == null) return;
      map.setView([h.lat, h.lng], Math.max(map.getZoom(), 18));
    },
    refresh: function () { if (map) setTimeout(function () { map.invalidateSize(); }, 50); },
    stopAdd: function () { setAddMode(false); }
  };
})();
