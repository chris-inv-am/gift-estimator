/* Detail-panel basemap for the gift estimate card. Reference implementation.

   renderDetailMap(opts) draws the selected ZIP code(s) on an OpenStreetMap
   basemap (OpenFreeMap, Positron style) with the repo's own ZCTA polygons on
   top, waits for the tiles, and resolves to a PNG data URL the card can drop
   into an <img>. If tiles do not arrive in time, or WebGL is missing, it
   resolves to null and the caller draws the outline-only panel instead.

   Requires maplibre-gl (UMD) loaded first:
     <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
     <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">

   Usage:
     const png = await renderDetailMap({ zips: ['60637'], width: 400, height: 400 });          // one ZIP
     const png = await renderDetailMap({ zips: chicagoZips, frame: chicagoOutline, width: 400, height: 400 }); // whole city
     if (png) img.src = png; else drawOutlinePanel();

   When a basemap is drawn the card footnote must add:
     "Map data © OpenStreetMap contributors, © OpenMapTiles."
*/
(function () {
  var GEO = 'https://cdn.jsdelivr.net/gh/chris-inv-am/gift-estimator@main/geo/';
  var STYLE = 'https://tiles.openfreemap.org/styles/positron';
  var NAVY = '#002858';
  var geoCache = {};

  function shard(prefix) {
    if (!geoCache[prefix]) geoCache[prefix] = fetch(GEO + 'zcta/' + prefix + '.json').then(function (r) { if (!r.ok) throw new Error('geo ' + prefix + ' ' + r.status); return r.json(); });
    return geoCache[prefix];
  }

  /** Fetch ZCTA polygons for a list of ZIP codes, from the repo's prefix shards. */
  function polygons(zips) {
    var prefixes = []; zips.forEach(function (z) { var p = z.slice(0, 3); if (prefixes.indexOf(p) === -1) prefixes.push(p); });
    return Promise.all(prefixes.map(shard)).then(function (shards) {
      var want = {}; zips.forEach(function (z) { want[z] = true; });
      var out = [];
      shards.forEach(function (s) { s.features.forEach(function (f) { if (want[f.properties.zip]) out.push(f); }); });
      return { type: 'FeatureCollection', features: out };
    });
  }

  function bbox(fc) {
    var w = 180, s = 90, e = -180, n = -90;
    (function walk(c) { if (typeof c[0] === 'number') { if (c[0] < w) w = c[0]; if (c[0] > e) e = c[0]; if (c[1] < s) s = c[1]; if (c[1] > n) n = c[1]; } else c.forEach(walk); })(fc.features.map(function (f) { return f.geometry.coordinates; }));
    return [[w, s], [e, n]];
  }

  /** Rough width of a bbox in km, to decide whether a basemap still helps. */
  function widthKm(bb) {
    var lat = (bb[0][1] + bb[1][1]) / 2;
    return (bb[1][0] - bb[0][0]) * 111.32 * Math.cos(lat * Math.PI / 180);
  }

  function webglOk() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  /**
   * opts.zips       selected ZIP codes (required)
   * opts.neighbors  other ZIPs to tint lightly for context, e.g. the rest of the city (optional)
   * opts.width/height  pixels, default 400 x 400; drawn at 2x for the card's export
   * opts.frame      optional GeoJSON Feature to fit the map to and draw as a dashed navy line,
   *                 e.g. the city or county outline from geo/places or geo/counties. When given,
   *                 the map is framed to it instead of to the selected ZIPs.
   * opts.timeoutMs  how long to wait for tiles before giving up, default 6000
   * opts.maxKm      widest frame that still gets a basemap, default 60 (a whole city or county
   *                 fits; a state does not and should use the state outline panel instead)
   * Resolves to a PNG data URL, or null when the caller should fall back.
   */
  function renderDetailMap(opts) {
    if (!window.maplibregl || !webglOk()) return Promise.resolve(null);
    var W = opts.width || 400, H = opts.height || 400, timeout = opts.timeoutMs || 6000, maxKm = opts.maxKm || 60;
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + W + 'px;height:' + H + 'px;';
    document.body.appendChild(host);
    var map = null;
    function done(v) { try { if (map) map.remove(); } catch (e) {} host.remove(); return v; }

    return Promise.all([polygons(opts.zips), opts.neighbors && opts.neighbors.length ? polygons(opts.neighbors) : null]).then(function (r) {
      var sel = r[0], nei = r[1];
      if (!sel.features.length) return done(null);
      var bb = bbox(opts.frame ? { type: 'FeatureCollection', features: [opts.frame] } : sel);
      if (widthKm(bb) > maxKm) return done(null); // too wide: the state outline or the national map is the better picture
      return new Promise(function (resolve) {
        var finished = false;
        var timer = setTimeout(function () { if (!finished) { finished = true; resolve(done(null)); } }, timeout);
        map = new maplibregl.Map({
          container: host, style: STYLE, bounds: bb, fitBoundsOptions: { padding: Math.round(Math.min(W, H) * 0.12) },
          interactive: false, attributionControl: false, preserveDrawingBuffer: true, pixelRatio: 2, fadeDuration: 0
        });
        map.on('error', function (e) { /* a single missing tile is not fatal; the timeout decides */ });
        map.on('load', function () {
          if (nei) {
            map.addSource('nei', { type: 'geojson', data: nei });
            map.addLayer({ id: 'nei-fill', type: 'fill', source: 'nei', paint: { 'fill-color': NAVY, 'fill-opacity': 0.06 } });
            map.addLayer({ id: 'nei-line', type: 'line', source: 'nei', paint: { 'line-color': NAVY, 'line-width': 0.6, 'line-opacity': 0.45 } });
          }
          if (opts.frame) {
            map.addSource('frame', { type: 'geojson', data: opts.frame });
            map.addLayer({ id: 'frame-line', type: 'line', source: 'frame', paint: { 'line-color': NAVY, 'line-width': 2, 'line-dasharray': [2, 1.5] } });
          }
          map.addSource('sel', { type: 'geojson', data: sel });
          map.addLayer({ id: 'sel-fill', type: 'fill', source: 'sel', paint: { 'fill-color': NAVY, 'fill-opacity': 0.18 } });
          map.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': NAVY, 'line-width': 3 } });
        });
        map.once('idle', function () {
          if (finished) return; finished = true; clearTimeout(timer);
          try { resolve(done(map.getCanvas().toDataURL('image/png'))); } catch (e) { resolve(done(null)); }
        });
      });
    }).catch(function () { return done(null); });
  }

  window.renderDetailMap = renderDetailMap;
  window.renderDetailMap.ATTRIBUTION = 'Map data © OpenStreetMap contributors, © OpenMapTiles.';
})();
