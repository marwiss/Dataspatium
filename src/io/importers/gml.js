// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * GML (F130 a): the features of a WFS answer or a .gml file, one row per feature with its properties as columns and its
 * geometry as GeoJSON. GML 3.2 as WFS 2.0 sends it (wfs:member), GML 3.1.1 (gml:featureMember, gml:featureMembers) and GML
 * 2.1.2 (gml:coordinates, outerBoundaryIs). Simple features: points, lines, surfaces and their multi forms, and the usual
 * curves simplified: line segments, arcs and circles through three points drawn as short chords, a circle by its centre, and
 * splines and geodesics through their control points. A nested property (an object inside a property) becomes columns with
 * dotted names, the object's own element left out; repeated values are joined with "; ".
 *
 * Axis order follows srsName. An EPSG code as a URN (urn:ogc:def:crs:EPSG::4326) or as an http URI
 * (http://www.opengis.net/def/crs/EPSG/0/4326) is read in EPSG's own order: latitude before longitude, and northing before
 * easting for the grids EPSG defines so (SWEREF 99, RT 90, ETRS-TM, the Finnish GK zones). CRS84, "EPSG:4326" and
 * http://www.opengis.net/gml/srs/epsg.xml#4326 are read as x and y (longitude, latitude), as deegree (Kartverket, 2026-11-28),
 * GeoServer and MapServer write them. A first position that cannot lie in its system the declared way (a latitude beyond 90,
 * an easting a zone cannot have) is read the other way, for servers that write otherwise. Every position comes out as x, y
 * (longitude, latitude or easting, northing): the app's own order.
 *
 * DOMParser does the parsing; the features are read in slices so that the page is not held long. The same reader serves the
 * WFS family's GML answers (api/parsers, format "gml", converted to WGS 84) and .gml files in Inhämta (in their own system).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/gml', ['data/encoding', 'data/geo'], (encoding, geo) => {
    const EXT = /\.gml$/i;
    /** @type {WeakMap<File, Promise<any>>} */
    const cache = new WeakMap();
    const GML = /^https?:\/\/www\.opengis\.net\/gml(\/3\.2)?$/;
    const WFS = /^https?:\/\/www\.opengis\.net\/wfs(\/2\.0)?$/;
    const isGml = (el) => GML.test(el.namespaceURI || '');
    const kids = (el) => Array.from(el.children || []);
    const kid = (el, name) => kids(el).find((c) => c.localName === name) || null;
    const text = (el) => (el ? String(el.textContent || '').trim() : '');
    /** Time to give the page back: after this many milliseconds of reading, the next slice waits for a macrotask. */
    const SLICE_MS = 25;
    const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

    /** True when the start of a text is GML or a WFS answer (its namespaces). @param {string} head */
    function sniff(head) {
      const t = String(head || '').slice(0, 8192);
      return /<[\w.-]*:?FeatureCollection\b|<[\w.-]+:\w+[^>]*\bgml:id=/.test(t) && /www\.opengis\.net\/(gml|wfs)/.test(t);
    }

    // ---- coordinate systems and axis order ----
    /** EPSG grids whose first axis is northing (EPSG's definitions): SWEREF 99, RT 90, ETRS-LCC/LAEA, ETRS-TM, GK FIN, NTM and others. */
    function northFirstGrid(code) {
      return (code >= 3006 && code <= 3024) || code === 3034 || code === 3035 || (code >= 3038 && code <= 3051) || (code >= 3873 && code <= 3885)
        || (code >= 5105 && code <= 5130) || (code >= 31466 && code <= 31469) || code === 2180;
    }
    /** Geographic systems (EPSG 4001–4999, latitude first), except the geocentric ones. */
    const geographic = (code) => code >= 4001 && code <= 4999 && code !== 4978 && code !== 4936;
    /** ETRS-TM zones that are UTM zones with the axes the other way: once read as x, y they are the UTM zone (EPSG:258xx). */
    const SAME_AS = { 3044: 25832, 3045: 25833, 3046: 25834, 3047: 25835 };
    /**
     * The EPSG code of an srsName and whether its positions are written y before x.
     * @param {string} srs @returns {{code: number|null, yx: boolean, name: string}}
     */
    function srsInfo(srs) {
      const s = String(srs || '').trim();
      if (!s) return { code: null, yx: false, name: '' };
      if (/(^|[:/])CRS:?84h?$/i.test(s)) return { code: 4326, yx: false, name: s };
      const uri = /^urn:(?:x-)?ogc:def:crs:EPSG:[\d.]*:(\d+)$/i.exec(s) || /opengis\.net\/def\/crs\/EPSG\/[\d.]+\/(\d+)$/i.exec(s);
      if (uri) { const code = Number(uri[1]); return { code, yx: geographic(code) || northFirstGrid(code), name: s }; }
      const plain = /^EPSG:(\d+)$/i.exec(s) || /epsg\.xml#(\d+)$/i.exec(s);
      if (plain) return { code: Number(plain[1]), yx: false, name: s };
      return { code: geo.crsCode(s), yx: false, name: s };
    }
    /** Whether [x, y] can lie in the system: degrees within their range, a transverse Mercator easting near its zone. */
    function plausible(x, y, code) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (code === null || code === undefined) return true;
      if (geographic(code)) return Math.abs(y) <= 90 && Math.abs(x) <= 180;
      const zone = geo.SWEREF_ZONES[SAME_AS[code] || code] || geo.TM_ZONES[SAME_AS[code] || code];
      if (zone) return Math.abs(x - zone.falseE) <= 1000000 && y > -100000 && y < 10000000;
      return true;
    }
    /** The system as the app names it once the positions are x, y: "EPSG:<code>" (an ETRS-TM zone as its UTM zone), or the text. */
    const crsName = (info) => (info.code ? 'EPSG:' + (SAME_AS[info.code] || info.code) : info.name);

    /**
     * A reading of one document: the srsName that applies to an element (its own or the nearest above it, else the document's),
     * the order each srsName is read in (decided at its first position), and the systems met.
     * @param {string} fallbackSrs
     */
    function reading(fallbackSrs) {
      const orders = new Map();
      const srsOf = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const v = e.getAttribute('srsName'); if (v) return v; } return fallbackSrs || ''; };
      const dimOf = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const v = Number(e.getAttribute('srsDimension') || e.getAttribute('dimension')); if (v >= 1) return v; } return 2; };
      /** Whether positions under this srsName are swapped, decided once at its first position. */
      function swapFor(srs, first) {
        if (orders.has(srs)) return orders.get(srs).swap;
        const info = srsInfo(srs);
        let swap = info.yx;
        if (first && first.length >= 2) {
          const [a, b] = first;
          const asIs = swap ? plausible(b, a, info.code) : plausible(a, b, info.code);
          const other = swap ? plausible(a, b, info.code) : plausible(b, a, info.code);
          if (!asIs && other) swap = !swap;
        }
        orders.set(srs, { swap, info });
        return swap;
      }
      /** Positions from flat numbers, in groups of `dim`, as [x, y] (and z) in the app's order. */
      function fromNumbers(nums, dim, el) {
        const out = [];
        for (let i = 0; i + dim <= nums.length; i += dim) out.push(nums.slice(i, i + Math.min(dim, 3)));
        if (!out.length) return out;
        const swap = swapFor(srsOf(el), out[0]);
        return swap ? out.map((p) => [p[1], p[0]].concat(p.slice(2))) : out;
      }
      const numbers = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).map(Number);
      /** GML 2's coordinates: tuples split by `ts`, values by `cs`, with `decimal` as the decimal sign. */
      function coordinates(el) {
        const cs = el.getAttribute('cs') || ','; const ts = el.getAttribute('ts') || ' '; const dec = el.getAttribute('decimal') || '.';
        const tuples = text(el).split(ts === ' ' ? /\s+/ : ts).map((x) => x.trim()).filter(Boolean);
        const rows = tuples.map((tp) => tp.split(cs).map((v) => Number(dec === '.' ? v : v.split(dec).join('.'))));
        const dim = Math.max(2, Math.min(3, rows.reduce((m, r) => Math.max(m, r.length), 0)));
        return fromNumbers(rows.flatMap((r) => r.slice(0, dim).concat(new Array(Math.max(0, dim - r.length)).fill(0))), dim, el);
      }
      /** The positions of a linear element: posList, a row of pos, pointProperty or pointRep, GML 2's coordinates or coord. */
      /** A pos (or lowerCorner, upperCorner) element's positions. */
      const pos = (el) => fromNumbers(numbers(el.textContent), dimOf(el), el);
      function positions(el) {
        const list = kid(el, 'posList');
        if (list) return fromNumbers(numbers(list.textContent), dimOf(list), list);
        const coords = kid(el, 'coordinates');
        if (coords) return coordinates(coords);
        const out = [];
        for (const c of kids(el)) {
          if (c.localName === 'pos') out.push(...pos(c));
          else if (c.localName === 'pointProperty' || c.localName === 'pointRep') { const p = kid(c, 'Point'); if (p) { const g = point(p); if (g) out.push(g.coordinates); } }
          else if (c.localName === 'coord') { const xy = ['X', 'Y', 'Z'].map((n) => kid(c, n)).filter(Boolean).map((n) => Number(text(n))); out.push(...fromNumbers(xy, xy.length, c)); }
        }
        return out;
      }
      function point(el) {
        const p = positions(el);
        return p.length ? { type: 'Point', coordinates: p[0] } : null;
      }
      return { srsOf, positions, pos, point, orders };
    }

    // ---- curves ----
    /** The circle through three points: centre and radius, or null when they lie on a line. */
    function circle3(a, b, c) {
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      if (Math.abs(d) < 1e-12) return null;
      const s = (p) => p[0] * p[0] + p[1] * p[1];
      const x = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
      const y = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
      return { x, y, r: Math.hypot(a[0] - x, a[1] - y) };
    }
    /** Points along the arc from a through b to c (or the whole circle), about every 4 degrees. */
    function arcPoints(a, b, c, whole) {
      const k = circle3(a, b, c);
      if (!k) return whole ? [a, b, c, a] : [a, b, c];
      const ang = (p) => Math.atan2(p[1] - k.y, p[0] - k.x);
      const t0 = ang(a); let t1 = ang(b); let t2 = ang(c);
      const norm = (t) => { while (t < t0) t += 2 * Math.PI; while (t >= t0 + 2 * Math.PI) t -= 2 * Math.PI; return t; };
      t1 = norm(t1); t2 = norm(t2);
      // The arc runs from a to c the way that passes b.
      let sweep = t1 <= t2 ? t2 - t0 : t2 - t0 - 2 * Math.PI;
      if (whole) sweep = t1 <= t2 || Math.abs(t2 - t0) < 1e-12 ? 2 * Math.PI : -2 * Math.PI;
      const n = Math.max(2, Math.ceil(Math.abs(sweep) / (4 * Math.PI / 180)));
      const out = [];
      for (let i = 0; i <= n; i++) { const t = t0 + (sweep * i) / n; out.push([k.x + k.r * Math.cos(t), k.y + k.r * Math.sin(t)]); }
      out[0] = a.slice(0, 2); if (!whole) out[n] = c.slice(0, 2); else out[n] = a.slice(0, 2);
      return out;
    }
    /** Join lines, without repeating the point where one ends and the next begins. */
    function join(lines) {
      const out = [];
      for (const l of lines) for (const p of l) { const last = out[out.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p); }
      return out;
    }

    /**
     * GeoJSON geometry of a GML geometry element, or null for what is not a simple feature.
     * @param {Element} el @param {any} r a reading()
     */
    function geometry(el, r) {
      const members = (names) => kids(el).filter((c) => names.includes(c.localName)).flatMap((m) => (/Members$/.test(m.localName) ? kids(m) : kids(m).slice(0, 1)));
      switch (el.localName) {
        case 'Point': return r.point(el);
        case 'LineString': case 'LinearRing': { const c = r.positions(el); return c.length ? { type: 'LineString', coordinates: c } : null; }
        case 'Curve': case 'CompositeCurve': case 'OrientableCurve': case 'Ring': { const c = line(el, r); return c.length ? { type: 'LineString', coordinates: c } : null; }
        case 'Polygon': case 'PolygonPatch': case 'Rectangle': case 'Triangle': { const rings = polygonRings(el, r); return rings.length ? { type: 'Polygon', coordinates: rings } : null; }
        case 'Surface': case 'PolyhedralSurface': case 'TriangulatedSurface': case 'Tin': case 'CompositeSurface': case 'OrientableSurface': case 'Shell': {
          const polys = surfacePolygons(el, r);
          return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
        }
        case 'MultiPoint': { const pts = members(['pointMember', 'pointMembers']).map((p) => r.point(p)).filter(Boolean).map((g) => g.coordinates); return pts.length ? { type: 'MultiPoint', coordinates: pts } : null; }
        case 'MultiLineString': case 'MultiCurve': {
          const lines = members(['lineStringMember', 'curveMember', 'curveMembers']).map((m) => line(m, r)).filter((c) => c.length);
          return lines.length ? { type: 'MultiLineString', coordinates: lines } : null;
        }
        case 'MultiPolygon': case 'MultiSurface': case 'CompositeSolid': case 'Solid': case 'MultiSolid': {
          const polys = (el.localName === 'Solid' ? surfacePolygons(el, r) : members(['polygonMember', 'surfaceMember', 'surfaceMembers', 'solidMember', 'solidMembers']).flatMap((m) => surfacePolygons(m, r)));
          return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
        }
        case 'MultiGeometry': {
          const parts = members(['geometryMember', 'geometryMembers']).map((m) => geometry(m, r)).filter(Boolean);
          return parts.length ? { type: 'GeometryCollection', geometries: parts } : null;
        }
        case 'Envelope': case 'Box': {
          const lo = kid(el, 'lowerCorner'); const hi = kid(el, 'upperCorner');
          const corners = lo && hi ? [lo, hi].map((x) => r.pos(x)[0]).filter(Boolean) : r.positions(el);
          if (corners.length < 2) return null;
          const [a, b] = corners;
          return { type: 'Polygon', coordinates: [[[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]]] };
        }
        default: return null;
      }
    }
    /** The positions of anything linear: a line, a curve's segments, a ring of curve members, an orientable curve (reversed for "-"). */
    function line(el, r) {
      const one = (g) => {
        switch (g.localName) {
          case 'LineString': case 'LinearRing': case 'LineStringSegment': case 'GeodesicString': case 'Geodesic': case 'CubicSpline': case 'BSpline': case 'Bezier': return r.positions(g);
          case 'Arc': case 'ArcString': case 'Circle': {
            const p = r.positions(g);
            if (g.localName === 'Circle' && p.length >= 3) return arcPoints(p[0], p[1], p[2], true);
            const parts = [];
            for (let i = 0; i + 2 < p.length; i += 2) parts.push(arcPoints(p[i], p[i + 1], p[i + 2], false));
            return parts.length ? join(parts) : p;
          }
          case 'ArcByCenterPoint': case 'CircleByCenterPoint': return byCentre(g, r);
          case 'Curve': { const segs = kid(g, 'segments'); return segs ? join(kids(segs).map(one)) : []; }
          case 'CompositeCurve': case 'Ring': return join(kids(g).filter((m) => /^curveMembers?$/.test(m.localName)).flatMap((m) => (m.localName === 'curveMembers' ? kids(m) : kids(m).slice(0, 1))).map(one));
          case 'OrientableCurve': {
            const base = kid(g, 'baseCurve'); const inner = base ? kids(base)[0] : null;
            const c = inner ? one(inner) : [];
            return g.getAttribute('orientation') === '-' ? c.slice().reverse() : c;
          }
          default: return [];
        }
      };
      // A property or member element holds the line; the line itself is handled the same way.
      const target = isGml(el) && !/Member$|Property$|^(exterior|interior|outerBoundaryIs|innerBoundaryIs|baseCurve)$/.test(el.localName) ? el : kids(el)[0];
      return target ? one(target) : [];
    }
    /** An arc or circle given by its centre, radius and angles; a radius in metres in a system of degrees is made degrees. */
    function byCentre(el, r) {
      const c = r.positions(el)[0];
      const rad = kid(el, 'radius');
      if (!c || !rad) return [];
      const radius = Number(text(rad));
      const info = (r.orders.get(r.srsOf(el)) || {}).info || srsInfo(r.srsOf(el));
      const degrees = info.code && geographic(info.code);
      const metres = /^(m|metre|meter|urn:ogc:def:uom:EPSG::9001)$/i.test(rad.getAttribute('uom') || '');
      const kx = degrees && metres ? 1 / (111320 * Math.cos((c[1] * Math.PI) / 180)) : 1;
      const ky = degrees && metres ? 1 / 110540 : 1;
      const whole = el.localName === 'CircleByCenterPoint';
      const a0 = whole ? 0 : Number(text(kid(el, 'startAngle')) || 0); const a1 = whole ? 360 : Number(text(kid(el, 'endAngle')) || 360);
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 4));
      const out = [];
      for (let i = 0; i <= n; i++) { const t = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; out.push([c[0] + radius * kx * Math.cos(t), c[1] + radius * ky * Math.sin(t)]); }
      return out;
    }
    /** The rings of a polygon (GML 3 exterior and interior, GML 2 outerBoundaryIs and innerBoundaryIs), each closed. */
    function polygonRings(el, r) {
      const close = (ring) => { if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0].slice()); return ring; };
      const ringOf = (b) => close(line(b, r));
      const ext = kids(el).filter((c) => c.localName === 'exterior' || c.localName === 'outerBoundaryIs').map(ringOf);
      const int = kids(el).filter((c) => c.localName === 'interior' || c.localName === 'innerBoundaryIs').map(ringOf);
      return ext.concat(int).filter((x) => x.length >= 4);
    }
    /** The polygons of a surface: its patches, its members, an orientable surface's base, or a polygon as one. */
    function surfacePolygons(el, r) {
      const target = isGml(el) && !/Member$|Property$|^(baseSurface|exterior|interior)$/.test(el.localName) ? el : kids(el)[0];
      if (!target) return [];
      switch (target.localName) {
        case 'Polygon': case 'PolygonPatch': case 'Rectangle': case 'Triangle': { const rings = polygonRings(target, r); return rings.length ? [rings] : []; }
        case 'Surface': case 'PolyhedralSurface': case 'TriangulatedSurface': case 'Tin': {
          const patches = kid(target, 'patches') || kid(target, 'polygonPatches') || kid(target, 'trianglePatches');
          return patches ? kids(patches).flatMap((p) => surfacePolygons(p, r)) : [];
        }
        case 'CompositeSurface': case 'Shell': return kids(target).filter((m) => /^surfaceMembers?$/.test(m.localName)).flatMap((m) => (m.localName === 'surfaceMembers' ? kids(m) : kids(m).slice(0, 1))).flatMap((s) => surfacePolygons(s, r));
        case 'OrientableSurface': { const base = kid(target, 'baseSurface'); return base ? surfacePolygons(base, r) : []; }
        case 'Solid': { const ext = kid(target, 'exterior'); return ext ? surfacePolygons(ext, r) : []; }
        case 'MultiSurface': case 'MultiPolygon': { const g = geometry(target, r); return g ? (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) : []; }
        default: return [];
      }
    }
    const GEOMETRIES = new Set(['Point', 'LineString', 'LinearRing', 'Curve', 'CompositeCurve', 'OrientableCurve', 'Ring', 'Polygon', 'Surface', 'PolyhedralSurface',
      'TriangulatedSurface', 'Tin', 'CompositeSurface', 'OrientableSurface', 'MultiPoint', 'MultiLineString', 'MultiCurve', 'MultiPolygon', 'MultiSurface', 'MultiGeometry',
      'Solid', 'CompositeSolid', 'MultiSolid', 'Envelope', 'Box']);
    const isGeometry = (el) => isGml(el) && GEOMETRIES.has(el.localName);

    // ---- features ----
    /** The features of a document: members of a collection (also collections inside members), else the root itself. */
    function featureElements(root) {
      const out = [];
      const take = (f) => {
        if (/FeatureCollection$/.test(f.localName)) visit(f);
        else if (!isGml(f) && !(WFS.test(f.namespaceURI || '') && f.localName !== 'FeatureCollection')) out.push(f);
      };
      function visit(el) {
        for (const c of kids(el)) {
          const name = c.localName;
          const member = (isGml(c) || WFS.test(c.namespaceURI || '')) && (name === 'member' || name === 'featureMember' || name === 'featureMembers');
          if (member) kids(c).forEach(take);
        }
      }
      visit(root);
      if (out.length || /FeatureCollection$/.test(root.localName)) return out;
      // A file of its own form: the children that hold a geometry, or the root when it is a feature.
      const own = kids(root).filter((c) => !isGml(c) && Array.from(c.getElementsByTagName('*')).some(isGeometry));
      return own.length ? own : (Array.from(root.getElementsByTagName('*')).some(isGeometry) ? [root] : []);
    }
    const idOf = (f) => { for (const a of Array.from(f.attributes)) if ((a.localName === 'id' && GML.test(a.namespaceURI || '')) || a.name === 'fid') return a.value; return null; };
    const XLINK = 'http://www.w3.org/1999/xlink';
    const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
    /** Properties of the GML namespace that are not data. */
    const GML_SKIP = new Set(['boundedBy', 'location', 'metaDataProperty']);

    /**
     * One feature as {props, geometry, srs}: properties by name (nested ones dotted, repeats joined), the first geometry as
     * GeoJSON (more geometries as GeoJSON text under their property's name).
     */
    function featureOf(f, r) {
      const props = {}; let main = null; let mainSrs = '';
      const fid = idOf(f);
      const set = (key, value) => {
        if (value === null || value === undefined) { if (!(key in props)) props[key] = null; return; }
        if (props[key] === undefined || props[key] === null) props[key] = value;
        else if (String(props[key]).split('; ').indexOf(String(value)) < 0) props[key] = props[key] + '; ' + value;
      };
      const geometryAt = (key, el) => {
        const g = geometry(el, r);
        if (!main && g) { main = g; mainSrs = r.srsOf(el); return; }
        set(key, g ? JSON.stringify(g) : null);
      };
      function flatten(el, key) {
        const children = kids(el);
        if (el.getAttributeNS(XSI, 'nil') === 'true') { set(key, null); return; }
        if (!children.length) {
          const v = text(el);
          set(key, v !== '' ? v : (el.getAttributeNS(XLINK, 'href') || null));
          return;
        }
        for (const c of children) {
          if (isGeometry(c)) { geometryAt(key, c); continue; }
          // A property holding one object: the object's own element is left out of the name.
          const object = children.length === 1 && /^[A-Z]/.test(c.localName) && kids(c).length > 0;
          flatten(c, object ? key : key + '.' + c.localName);
        }
      }
      for (const p of kids(f)) {
        const name = p.localName;
        if (isGml(p) && GML_SKIP.has(name)) continue;
        if (isGeometry(p)) { geometryAt('geometri', p); continue; }
        const inner = kids(p);
        if (inner.length === 1 && isGeometry(inner[0])) { geometryAt(name, inner[0]); continue; }
        flatten(p, name);
      }
      return { id: fid, type: f.localName, props, geometry: main, srs: mainSrs };
    }

    /**
     * Read a GML text: the features by feature type, the coordinate system and WFS's numberMatched and numberReturned.
     * @param {string} xmlText @param {{srsName?: string}} [options] srsName: the system asked for, when the text names none
     * @returns {Promise<{features: Array<{id: string|null, type: string, props: Record<string, any>, geometry: any, srs: string}>, types: string[], crs: string, numberMatched: number|null, numberReturned: number|null}>}
     */
    async function read(xmlText, options = {}) {
      const doc = new DOMParser().parseFromString(String(xmlText || '').replace(/^﻿/, ''), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error(D.t('import.err.gml'));
      const root = doc.documentElement;
      const bounded = kid(root, 'boundedBy');
      const env = bounded ? kids(bounded)[0] : null;
      const r = reading((env && env.getAttribute('srsName')) || options.srsName || '');
      const elements = featureElements(root);
      const features = [];
      let since = performance.now();
      for (const f of elements) {
        features.push(featureOf(f, r));
        if (performance.now() - since > SLICE_MS) { await breathe(); since = performance.now(); }
      }
      const count = (name) => { const v = Number(root.getAttribute(name)); return root.hasAttribute(name) && Number.isFinite(v) ? v : null; };
      const first = features.find((x) => x.geometry);
      const srs = first ? first.srs : (env && env.getAttribute('srsName')) || options.srsName || '';
      return { features, types: Array.from(new Set(features.map((x) => x.type))), crs: srs ? crsName(srsInfo(srs)) : '', numberMatched: count('numberMatched'), numberReturned: count('numberReturned') };
    }

    /**
     * The features as records for a table: the id (gml:id, or gml_id when a property is called id), the properties, and the
     * geometry's type and GeoJSON text under `names` (geometri_typ, geometri as the geodata sources write them). With `wgs84`
     * each geometry is converted from its system to WGS 84; one the app cannot convert gives no geometry rather than a wrong place.
     * @param {any[]} features @param {{wgs84?: boolean, names?: [string, string]}} [options]
     */
    function records(features, options = {}) {
      const [typeCol, geomCol] = options.names || ['geometri_typ', 'geometri'];
      return features.map((f) => {
        const rec = {};
        if (f.id !== null) rec[Object.prototype.hasOwnProperty.call(f.props, 'id') ? 'gml_id' : 'id'] = f.id;
        Object.assign(rec, f.props);
        let g = f.geometry;
        if (g && options.wgs84) g = geo.toWgs84(g, crsName(srsInfo(f.srs)));
        rec[typeCol] = g ? g.type : null;
        rec[geomCol] = g ? JSON.stringify(g) : null;
        return rec;
      });
    }

    /** Rows of records as a table: the union of the keys in order of appearance, the geometry last. */
    function tabulate(objects, last) {
      const columns = []; const seen = new Set();
      for (const o of objects) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
      for (const k of last) if (seen.has(k)) { columns.splice(columns.indexOf(k), 1); columns.push(k); }
      return { columns, rows: objects.map((o) => columns.map((c) => (o[c] === undefined ? null : o[c]))) };
    }

    // ---- the importer ----
    /** @param {File} file */
    function detect(file) { return EXT.test(file.name); }
    /** The file read once: its feature types as layers. */
    function layersOf(file) {
      let p = cache.get(file);
      if (!p) {
        p = (async () => {
          const { text: content } = await encoding.readText(file);
          const got = await read(content);
          if (!got.features.length) throw new Error(D.t('import.err.gml.empty'));
          const layers = got.types.map((type) => ({ label: type, features: got.features.filter((f) => f.type === type) }));
          return { layers, crs: got.crs };
        })();
        cache.set(file, p);
      }
      return p;
    }
    const NAMES = /** @type {[string, string]} */ (['geometry_type', 'geometry']);
    const pick = (layers, label) => layers.find((l) => l.label === label) || layers[0];
    /** @param {File} file @param {{layer?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const got = await layersOf(file);
      const layer = pick(got.layers, options.layer);
      const { columns, rows } = tabulate(records(layer.features, { names: NAMES }), NAMES);
      return { kind: 'gml', layers: got.layers.map((l) => l.label), layer: layer.label, header: true, columns, dataRows: rows.slice(0, options.previewRows || 100), totalRows: rows.length, crs: got.crs };
    }
    /** @param {File} file @param {{layer?: string}} [options] */
    async function parse(file, options = {}) {
      const got = await layersOf(file);
      const layer = pick(got.layers, options.layer);
      const { columns, rows } = tabulate(records(layer.features, { names: NAMES }), NAMES);
      return { columns, rows, meta: Object.assign({ format: 'gml', layer: layer.label, layers: got.layers.map((l) => l.label) }, got.crs ? { crs: got.crs } : {}) };
    }

    return { id: 'gml', detect, sniff, preview, parse, read, records, tabulate, srsInfo };
  });
})();
