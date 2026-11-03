// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Map files: KML and KMZ (Google Earth), GPX (GPS tracks) and TopoJSON. Like the GeoJSON importer, every
 * place becomes a row with its properties, `geometry_type` and the geometry as GeoJSON text, so the map charts
 * and geodata operations work on the result. Coordinates are longitude and latitude (WGS 84), which all three
 * formats use. A file with several kinds of content offers them as layers: GPX waypoints, routes, tracks and
 * track points (one row per point, with time and elevation), and the objects of a TopoJSON topology.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/geo', ['data/encoding', 'platform/storage/zip'], (encoding, zip) => {
    const EXT = /\.(kml|kmz|gpx|topojson)$/i;
    /** @type {WeakMap<File, Promise<Array<{id: string, label: string, rows: object[]}>>>} */
    const cache = new WeakMap();

    /** @param {File} file */
    function detect(file) { return EXT.test(file.name); }

    const num = (v) => { const n = Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n; };
    const kids = (el, name) => Array.from(el.children).filter((c) => c.localName === name);
    const kid = (el, name) => kids(el, name)[0] || null;
    const text = (el) => (el ? String(el.textContent || '').trim() : '');
    const row = (props, geometry) => Object.assign({}, props, { geometry_type: geometry ? geometry.type : null, geometry: geometry ? JSON.stringify(geometry) : null });

    // ---- KML ----
    function kmlCoords(el) {
      return text(el).split(/\s+/).filter(Boolean).map((t) => t.split(',').map(Number)).filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => [c[0], c[1]]);
    }
    function kmlGeometry(el) {
      switch (el.localName) {
        case 'Point': { const c = kmlCoords(kid(el, 'coordinates')); return c.length ? { type: 'Point', coordinates: c[0] } : null; }
        case 'LineString': return { type: 'LineString', coordinates: kmlCoords(kid(el, 'coordinates')) };
        case 'LinearRing': return { type: 'Polygon', coordinates: [kmlCoords(kid(el, 'coordinates'))] };
        case 'Polygon': {
          const ring = (b) => { const r = b ? kid(b, 'LinearRing') : null; return r ? kmlCoords(kid(r, 'coordinates')) : []; };
          const outer = ring(kid(el, 'outerBoundaryIs'));
          return { type: 'Polygon', coordinates: [outer].concat(kids(el, 'innerBoundaryIs').map(ring)).filter((r) => r.length) };
        }
        case 'MultiGeometry': {
          const parts = Array.from(el.children).map(kmlGeometry).filter(Boolean);
          const types = new Set(parts.map((p) => p.type));
          if (parts.length && types.size === 1 && !types.has('GeometryCollection')) {
            const t = parts[0].type;
            return { type: 'Multi' + t.replace(/^Multi/, ''), coordinates: parts.flatMap((p) => (p.type.startsWith('Multi') ? p.coordinates : [p.coordinates])) };
          }
          return parts.length ? { type: 'GeometryCollection', geometries: parts } : null;
        }
        default: return null;
      }
    }
    const GEOMETRY = ['Point', 'LineString', 'LinearRing', 'Polygon', 'MultiGeometry'];
    function kmlLayers(xmlText) {
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error(D.t('import.err.geo'));
      const rows = [];
      for (const pm of Array.from(doc.getElementsByTagNameNS('*', 'Placemark'))) {
        const props = { name: text(kid(pm, 'name')) || null, description: text(kid(pm, 'description')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null };
        // Folder path: the names of the enclosing folders and documents.
        const path = [];
        for (let p = pm.parentElement; p; p = p.parentElement) if (p.localName === 'Folder' || p.localName === 'Document') { const n = text(kid(p, 'name')); if (n) path.unshift(n); }
        if (path.length) props.folder = path.join(' / ');
        const when = kid(pm, 'TimeStamp');
        if (when) props.time = text(kid(when, 'when')) || null;
        const ext = kid(pm, 'ExtendedData');
        if (ext) {
          for (const d of Array.from(ext.getElementsByTagNameNS('*', 'Data'))) { const k = d.getAttribute('name'); if (k) props[k] = text(kid(d, 'value')) || null; }
          for (const d of Array.from(ext.getElementsByTagNameNS('*', 'SimpleData'))) { const k = d.getAttribute('name'); if (k) props[k] = text(d) || null; }
        }
        const gEl = Array.from(pm.children).find((c) => GEOMETRY.includes(c.localName));
        rows.push(row(props, gEl ? kmlGeometry(gEl) : null));
      }
      return [{ id: 'placemarks', rows }];
    }

    // ---- GPX ----
    function gpxPoint(pt) {
      return { lon: num(pt.getAttribute('lon')), lat: num(pt.getAttribute('lat')), ele: num(text(kid(pt, 'ele'))), time: text(kid(pt, 'time')) || null };
    }
    const haversine = (a, b) => {
      const R = 6371.0088; const r = Math.PI / 180;
      const dLat = (b[1] - a[1]) * r; const dLon = (b[0] - a[0]) * r;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    };
    const lengthKm = (lines) => Math.round(lines.reduce((s, l) => s + l.reduce((t, p, i) => (i ? t + haversine(l[i - 1], p) : t), 0), 0) * 1000) / 1000;
    function gpxLayers(xmlText) {
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error(D.t('import.err.geo'));
      const root = doc.documentElement;
      const info = (el) => ({ name: text(kid(el, 'name')) || null, description: text(kid(el, 'desc')) || null, type: text(kid(el, 'type')) || null });
      const coords = (pts) => pts.map(gpxPoint).filter((p) => p.lon !== null && p.lat !== null).map((p) => [p.lon, p.lat]);
      const waypoints = kids(root, 'wpt').map((w) => { const p = gpxPoint(w); return row(Object.assign(info(w), { symbol: text(kid(w, 'sym')) || null }, p), p.lon !== null && p.lat !== null ? { type: 'Point', coordinates: [p.lon, p.lat] } : null); });
      const routes = kids(root, 'rte').map((r) => { const c = coords(kids(r, 'rtept')); return row(Object.assign(info(r), { points: c.length, length_km: lengthKm([c]) }), c.length ? { type: 'LineString', coordinates: c } : null); });
      const tracks = []; const trackpoints = [];
      kids(root, 'trk').forEach((trk, t) => {
        const segs = kids(trk, 'trkseg').map((s) => kids(s, 'trkpt'));
        const lines = segs.map(coords).filter((l) => l.length);
        const meta = info(trk);
        tracks.push(row(Object.assign({}, meta, { segments: segs.length, points: lines.reduce((s, l) => s + l.length, 0), length_km: lengthKm(lines) }), lines.length ? { type: 'MultiLineString', coordinates: lines } : null));
        segs.forEach((pts, s) => pts.forEach((pt, i) => trackpoints.push(Object.assign({ track: meta.name || String(t + 1), segment: s + 1, point: i + 1 }, gpxPoint(pt)))));
      });
      return [
        { id: 'waypoints', rows: waypoints }, { id: 'routes', rows: routes },
        { id: 'tracks', rows: tracks }, { id: 'trackpoints', rows: trackpoints },
      ].filter((l) => l.rows.length);
    }

    // ---- TopoJSON ----
    /**
     * Features of a TopoJSON topology, per object (layer). Quantized arcs are delta-decoded and transformed.
     * @param {any} topo
     */
    function topoLayers(topo) {
      if (!topo || topo.type !== 'Topology' || !topo.objects) throw new Error(D.t('import.err.topojson'));
      const tf = topo.transform;
      const arcs = (topo.arcs || []).map((arc) => {
        if (!tf) return arc.map((p) => [p[0], p[1]]);
        let x = 0; let y = 0;
        return arc.map((p) => { x += p[0]; y += p[1]; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]; });
      });
      const point = (p) => (tf ? [p[0] * tf.scale[0] + tf.translate[0], p[1] * tf.scale[1] + tf.translate[1]] : [p[0], p[1]]);
      const arc = (i) => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]) || [];
      const line = (ids) => { const out = []; ids.forEach((i, k) => { const a = arc(i); out.push(...(k ? a.slice(1) : a)); }); return out; };
      function geom(o) {
        switch (o && o.type) {
          case 'Point': return { type: 'Point', coordinates: point(o.coordinates) };
          case 'MultiPoint': return { type: 'MultiPoint', coordinates: o.coordinates.map(point) };
          case 'LineString': return { type: 'LineString', coordinates: line(o.arcs) };
          case 'MultiLineString': return { type: 'MultiLineString', coordinates: o.arcs.map(line) };
          case 'Polygon': return { type: 'Polygon', coordinates: o.arcs.map(line) };
          case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: o.arcs.map((p) => p.map(line)) };
          case 'GeometryCollection': return { type: 'GeometryCollection', geometries: o.geometries.map(geom).filter(Boolean) };
          default: return null;
        }
      }
      return Object.entries(topo.objects).map(([name, obj]) => {
        const list = obj.type === 'GeometryCollection' ? obj.geometries : [obj];
        return { id: 'object:' + name, name, rows: list.map((g) => row(Object.assign(g.id !== undefined ? { id: g.id } : {}, g.properties || {}), geom(g))) };
      });
    }

    /** All layers of a file, with display labels. */
    function layersOf(file) {
      let p = cache.get(file);
      if (!p) {
        p = (async () => {
          const name = file.name.toLowerCase();
          let layers;
          if (name.endsWith('.kmz')) {
            const entries = await zip.readZip(file);
            const kmlPath = Object.keys(entries).filter((k) => /\.kml$/i.test(k)).sort((a, b) => (a === 'doc.kml' ? -1 : b === 'doc.kml' ? 1 : a.length - b.length))[0];
            if (!kmlPath) throw new Error(D.t('import.err.kmz'));
            layers = kmlLayers(new TextDecoder('utf-8').decode(entries[kmlPath]));
          } else {
            const { text: content } = await encoding.readText(file);
            if (name.endsWith('.kml')) layers = kmlLayers(content);
            else if (name.endsWith('.gpx')) layers = gpxLayers(content);
            else {
              let topo;
              try { topo = JSON.parse(content.replace(/^﻿/, '')); } catch (_e) { throw new Error(D.t('import.err.topojson')); }
              layers = topoLayers(topo);
            }
          }
          layers = layers.filter((l) => l.rows.length);
          if (!layers.length) throw new Error(D.t('import.err.nogeo'));
          return layers.map((l) => Object.assign({}, l, { label: l.id.startsWith('object:') ? l.name : D.t('import.geo.layer.' + l.id) }));
        })();
        cache.set(file, p);
      }
      return p;
    }

    /** Rows of objects as a table; the columns are the union of the keys in order of appearance. */
    function tabulate(objects) {
      const columns = [];
      const seen = new Set();
      for (const o of objects) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
      // The geometry stays last, as in the GeoJSON importer.
      for (const k of ['geometry_type', 'geometry']) if (seen.has(k)) { columns.splice(columns.indexOf(k), 1); columns.push(k); }
      return { columns, rows: objects.map((o) => columns.map((c) => (o[c] === undefined ? null : o[c]))) };
    }
    const pick = (layers, label) => layers.find((l) => l.label === label) || layers[0];

    /** @param {File} file @param {{layer?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const layers = await layersOf(file);
      const layer = pick(layers, options.layer);
      const { columns, rows } = tabulate(layer.rows);
      return { kind: 'geo', layers: layers.map((l) => l.label), layer: layer.label, header: true, columns, dataRows: rows.slice(0, options.previewRows || 100), totalRows: rows.length };
    }

    /** @param {File} file @param {{layer?: string}} options */
    async function parse(file, options = {}) {
      const layers = await layersOf(file);
      const layer = pick(layers, options.layer);
      const { columns, rows } = tabulate(layer.rows);
      return { columns, rows, meta: { format: 'geo', layer: layer.label } };
    }

    return { id: 'geo', detect, preview, parse, kmlLayers, gpxLayers, topoLayers };
  });
})();
