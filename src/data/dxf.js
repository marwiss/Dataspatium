// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * DXF drawings: dxf-parser (MIT) reads the file to JSON in a shimmed worker, and the same worker turns it into a table
 * (one row per entity with layer, colour, length, area, text and position) and an SVG drawing grouped per layer and
 * per entity, so that the view can hide layers and mark what is selected. Curves are drawn as short line segments
 * after the block transforms, which also gives lengths and areas. Standalone worker function: no outer references.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  function dataspatiumDxfWorker() {
    'use strict';
    var UNITS = { 0: '', 1: 'in', 2: 'ft', 3: 'mi', 4: 'mm', 5: 'cm', 6: 'm', 7: 'km', 8: 'µin', 9: 'mil', 10: 'yd', 14: 'dm' };
    var CIRCLE_STEPS = 128;
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var num = function (v) { return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '0'; };
    var hex = function (c) { return '#' + (c & 0xffffff).toString(16).padStart(6, '0'); };

    var IDENTITY = [1, 0, 0, 1, 0, 0];
    function multiply(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
    function apply(m, p) { return [m[0] * p.x + m[2] * p.y + m[4], m[1] * p.x + m[3] * p.y + m[5]]; }
    function placement(x, y, sx, sy, rotation) { var c = Math.cos(rotation); var s = Math.sin(rotation); return [c * sx, s * sx, -s * sy, c * sy, x, y]; }

    function arcPoints(cx, cy, r, from, to) {
      var span = to - from;
      if (span <= 0) span += Math.PI * 2;
      var steps = Math.max(4, Math.ceil(CIRCLE_STEPS * span / (Math.PI * 2)));
      var out = [];
      for (var i = 0; i <= steps; i++) { var a = from + span * i / steps; out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
      return out;
    }
    /** A polyline's points with its bulges drawn as arcs. */
    function bulged(vertices, closed) {
      var out = [];
      var n = vertices.length;
      for (var i = 0; i < n; i++) {
        var a = vertices[i];
        out.push({ x: a.x, y: a.y });
        if (i === n - 1 && !closed) break;
        var b = vertices[(i + 1) % n];
        var bulge = a.bulge || 0;
        if (!bulge) continue;
        var angle = 4 * Math.atan(bulge);
        var dx = b.x - a.x; var dy = b.y - a.y;
        var chord = Math.sqrt(dx * dx + dy * dy);
        if (!chord) continue;
        var r = chord / (2 * Math.sin(Math.abs(angle) / 2));
        var mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        var h = Math.sqrt(Math.max(0, r * r - chord * chord / 4)) * (Math.abs(angle) > Math.PI ? -1 : 1) * (bulge > 0 ? 1 : -1);
        var cx = mid.x - dy / chord * h; var cy = mid.y + dx / chord * h;
        var from = Math.atan2(a.y - cy, a.x - cx);
        var steps = Math.max(4, Math.ceil(CIRCLE_STEPS * Math.abs(angle) / (Math.PI * 2)));
        for (var k = 1; k < steps; k++) { var t = from + angle * k / steps; out.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }); }
      }
      return out;
    }
    function ellipsePoints(e) {
      var mx = e.majorAxisEndPoint.x; var my = e.majorAxisEndPoint.y;
      var major = Math.sqrt(mx * mx + my * my);
      var minor = major * (e.axisRatio || 1);
      var rot = Math.atan2(my, mx);
      var from = e.startAngle || 0; var to = e.endAngle === undefined ? Math.PI * 2 : e.endAngle;
      var span = to - from;
      if (span <= 0) span += Math.PI * 2;
      var steps = Math.max(8, Math.ceil(CIRCLE_STEPS * span / (Math.PI * 2)));
      var out = [];
      var c = Math.cos(rot); var s = Math.sin(rot);
      for (var i = 0; i <= steps; i++) { var a = from + span * i / steps; var x = major * Math.cos(a); var y = minor * Math.sin(a); out.push({ x: e.center.x + x * c - y * s, y: e.center.y + x * s + y * c }); }
      return out;
    }
    function splinePoints(e) {
      var cp = e.controlPoints || [];
      var deg = e.degreeOfSplineCurve || 3;
      var knots = e.knotValues || [];
      if (cp.length <= deg || knots.length < cp.length + deg + 1) return (e.fitPoints && e.fitPoints.length ? e.fitPoints : cp).slice();
      var out = [];
      var lo = knots[deg]; var hi = knots[cp.length];
      var steps = Math.min(2000, (cp.length - deg) * 16);
      for (var s = 0; s <= steps; s++) {
        var u = lo + (hi - lo) * s / steps;
        var span = deg;
        while (span < cp.length - 1 && u >= knots[span + 1]) span++;
        var d = [];
        for (var j = 0; j <= deg; j++) d.push({ x: cp[span - deg + j].x, y: cp[span - deg + j].y });
        for (var r = 1; r <= deg; r++) {
          for (var q = deg; q >= r; q--) {
            var i = span - deg + q;
            var den = knots[i + deg - r + 1] - knots[i];
            var al = den ? (u - knots[i]) / den : 0;
            d[q] = { x: (1 - al) * d[q - 1].x + al * d[q].x, y: (1 - al) * d[q - 1].y + al * d[q].y };
          }
        }
        out.push(d[deg]);
      }
      return out;
    }
    function cleanMtext(text) {
      return String(text || '').replace(/\\[Pp]/g, '\n').replace(/\\[A-Za-z][^;\\]*;/g, '').replace(/\\[LlOoKk]/g, '').replace(/[{}]/g, '').replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±');
    }

    function convert(text) {
      var Lib = self.DxfParser && self.DxfParser.default ? self.DxfParser.default : self.DxfParser;
      var dxf = new Lib().parseSync(text);
      if (!dxf || !dxf.entities) throw new Error('notdxf');
      var layerTable = (dxf.tables && dxf.tables.layer && dxf.tables.layer.layers) || {};
      var blocks = dxf.blocks || {};
      var minX = Infinity; var minY = Infinity; var maxX = -Infinity; var maxY = -Infinity;
      var extend = function (x, y) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
      var colorOf = function (e, inherited) {
        if (e.color !== undefined && e.color !== null) return e.color;
        var l = layerTable[e.layer];
        if (l && l.color !== undefined && l.color !== null) return l.color;
        return inherited === undefined ? 0 : inherited;
      };

      /** Draws one entity: returns SVG text and adds to the measures. */
      function draw(e, m, measure, inheritedColor, depth) {
        if (e.visible === false) return '';
        var path = function (points, closed) {
          if (!points || points.length < 1) return '';
          var d = ''; var len = 0; var area = 0; var prev = null; var first = null;
          for (var i = 0; i < points.length; i++) {
            var p = apply(m, points[i]);
            extend(p[0], p[1]);
            d += (i ? 'L' : 'M') + num(p[0]) + ' ' + num(-p[1]);
            if (prev) { len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); area += prev[0] * p[1] - p[0] * prev[1]; } else first = p;
            prev = p;
          }
          if (closed && prev && first) { len += Math.hypot(first[0] - prev[0], first[1] - prev[1]); area += prev[0] * first[1] - first[0] * prev[1]; d += 'Z'; measure.area += Math.abs(area) / 2; }
          measure.length += len;
          return '<path d="' + d + '"/>';
        };
        var color = colorOf(e, inheritedColor);
        var body = '';
        switch (e.type) {
          case 'LINE': body = path(e.vertices, false); break;
          case 'LWPOLYLINE': case 'POLYLINE': { var closed = !!e.shape; body = path(bulged(e.vertices || [], closed), closed); break; }
          case 'CIRCLE': body = path(arcPoints(e.center.x, e.center.y, e.radius, 0, Math.PI * 2).slice(0, -1), true); break;
          case 'ARC': body = path(arcPoints(e.center.x, e.center.y, e.radius, e.startAngle || 0, e.endAngle || 0), false); break;
          case 'ELLIPSE': { var full = (e.endAngle === undefined || Math.abs((e.endAngle - (e.startAngle || 0)) - Math.PI * 2) < 1e-6); body = path(ellipsePoints(e), full); break; }
          case 'SPLINE': body = path(splinePoints(e), !!e.closed); break;
          case 'POINT': { var pt = apply(m, e.position); extend(pt[0], pt[1]); body = '<circle cx="' + num(pt[0]) + '" cy="' + num(-pt[1]) + '" r="0.5"/>'; break; }
          case 'SOLID': case '3DFACE': {
            var v = e.points || e.vertices || [];
            var ordered = e.type === 'SOLID' && v.length === 4 ? [v[0], v[1], v[3], v[2]] : v;
            body = path(ordered.map(function (q) { return { x: q.x, y: q.y }; }), true);
            break;
          }
          case 'TEXT': case 'MTEXT': case 'ATTRIB': {
            var pos = e.startPoint || e.position;
            if (!pos) break;
            var str = e.type === 'MTEXT' ? cleanMtext(e.text) : String(e.text === undefined ? '' : e.text);
            if (!str) break;
            var at = apply(m, pos);
            var scale = Math.hypot(m[0], m[1]);
            var size = (e.textHeight || e.height || 1) * scale;
            extend(at[0], at[1]); extend(at[0] + size * str.length * 0.5, at[1] + size);
            var rot = (e.rotation || 0) + Math.atan2(m[1], m[0]) * 180 / Math.PI;
            body = str.split('\n').map(function (line, i) {
              return '<text x="' + num(at[0]) + '" y="' + num(-at[1] + i * size * 1.2) + '" font-size="' + num(size) + '"' + (rot ? ' transform="rotate(' + num(-rot) + ' ' + num(at[0]) + ' ' + num(-at[1]) + ')"' : '') + '>' + esc(line) + '</text>';
            }).join('');
            break;
          }
          case 'INSERT': {
            var block = blocks[e.name];
            if (!block || !block.entities || depth > 16) break;
            var cols = Math.min(e.columnCount || 1, 1000); var rowsN = Math.min(e.rowCount || 1, 1000);
            var base = block.position ? placement(-block.position.x, -block.position.y, 1, 1, 0) : IDENTITY;
            var pos2 = e.position || { x: 0, y: 0 };
            for (var cx = 0; cx < cols; cx++) for (var cy = 0; cy < rowsN; cy++) {
              var place = placement(pos2.x, pos2.y, e.xScale === undefined ? 1 : e.xScale, e.yScale === undefined ? 1 : e.yScale, (e.rotation || 0) * Math.PI / 180);
              var offset = placement(cx * (e.columnSpacing || 0), cy * (e.rowSpacing || 0), 1, 1, 0);
              var inner = multiply(multiply(multiply(m, place), offset), base);
              for (var bi = 0; bi < block.entities.length; bi++) body += draw(block.entities[bi], inner, measure, color, depth + 1);
            }
            break;
          }
          case 'DIMENSION': {
            var dim = e.block ? blocks[e.block] : null;
            if (dim && dim.entities && depth <= 16) for (var di = 0; di < dim.entities.length; di++) body += draw(dim.entities[di], m, measure, color, depth + 1);
            break;
          }
          default: break;
        }
        if (!body) return '';
        var rgb = color === 0 || color === 16777215 ? null : hex(color);
        return rgb ? '<g stroke="' + rgb + '" fill="none" color="' + rgb + '">' + body + '</g>' : body;
      }

      var rows = []; var groups = new Map(); var layerStats = new Map(); var typeCounts = new Map();
      for (var i = 0; i < dxf.entities.length; i++) {
        var e = dxf.entities[i];
        var measure = { length: 0, area: 0 };
        var svg = draw(e, IDENTITY, measure, undefined, 0);
        var layer = e.layer === undefined || e.layer === null ? '0' : String(e.layer);
        var id = i + 1;
        if (svg) {
          if (!groups.has(layer)) groups.set(layer, []);
          groups.get(layer).push('<g data-id="' + id + '">' + svg + '</g>');
        }
        var anchor = e.position || e.startPoint || e.center || (e.vertices && e.vertices[0]) || null;
        var color = colorOf(e);
        var label = e.type === 'INSERT' ? e.name : (e.type === 'MTEXT' ? cleanMtext(e.text) : (e.text === undefined ? null : String(e.text)));
        var round = function (v) { return Math.round(v * 1e6) / 1e6; };
        rows.push([id, String(e.type || ''), layer, color === 0 || color === undefined ? null : hex(color), measure.length ? round(measure.length) : null, measure.area ? round(measure.area) : null, label, anchor ? round(anchor.x) : null, anchor ? round(anchor.y) : null]);
        typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
        var st = layerStats.get(layer) || { count: 0, length: 0, area: 0 };
        st.count++; st.length += measure.length; st.area += measure.area;
        layerStats.set(layer, st);
      }
      if (!rows.length) throw new Error('emptydxf');
      if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
      var w = Math.max(maxX - minX, 1e-6); var h = Math.max(maxY - minY, 1e-6); var pad = Math.max(w, h) * 0.02;
      var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + num(minX - pad) + ' ' + num(-maxY - pad) + ' ' + num(w + pad * 2) + ' ' + num(h + pad * 2) + '" stroke="currentColor" fill="none" stroke-width="1" font-family="sans-serif">',
        '<style>path,circle{vector-effect:non-scaling-stroke}text{fill:currentColor;stroke:none}</style>'];
      groups.forEach(function (list, name) {
        var info = layerTable[name];
        parts.push('<g data-layer="' + esc(name) + '"' + (info && info.visible === false ? ' display="none"' : '') + '>' + list.join('') + '</g>');
      });
      parts.push('</svg>');
      var layers = Array.from(layerStats.keys()).sort().map(function (name) {
        var info = layerTable[name]; var st = layerStats.get(name);
        return { name: name, color: info && info.color ? hex(info.color) : null, count: st.count, length: Math.round(st.length * 1e6) / 1e6, area: Math.round(st.area * 1e6) / 1e6, visible: !(info && info.visible === false) };
      });
      var header = dxf.header || {};
      return {
        summary: { format: 'dxf', version: header.$ACADVER ? String(header.$ACADVER) : '', units: UNITS[header.$INSUNITS] || '', entities: rows.length, layers: layers, blocks: Object.keys(blocks).filter(function (n) { return n.charAt(0) !== '*'; }).length, types: Array.from(typeCounts.entries()).map(function (x) { return { name: x[0], count: x[1] }; }).sort(function (a, b) { return b.count - a.count; }), bounds: [minX, minY, maxX, maxY] },
        rows: rows, svg: parts.join(''),
      };
    }

    self.onmessage = function (ev) {
      var msg = ev.data || {};
      try { self.postMessage({ id: msg.id, ok: true, result: convert(msg.text) }); } catch (err) { self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) }); }
    };
    self.__dataspatium.ready.then(function () {
      importScripts('dataspatium-asset://dxf-parser/dxf-parser.js');
      self.postMessage({ ready: true });
    });
  }

  D.define('data/dxf', [], () => {
    let worker = null; let ready = null; let seq = 0;
    const pending = new Map();
    function ensureWorker() {
      if (worker) return ready;
      D.workers.provider('dxf-parser', { initial: async () => ['dxf-parser/dxf-parser.js'] });
      worker = D.workers.create({ namespace: 'dxf-parser', source: D.workers.functionSource(dataspatiumDxfWorker), name: 'dxf' });
      ready = new Promise((resolve) => {
        worker.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.ready) { resolve(true); return; }
          const p = pending.get(msg.id);
          if (!p) return;
          pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.result);
          else p.reject(new Error(/notdxf|emptydxf/.test(msg.error) ? D.t('model.err.notdxf') : msg.error));
        };
        worker.onerror = (ev) => { for (const p of pending.values()) p.reject(new Error(String((ev && ev.message) || 'DXF worker'))); pending.clear(); stop(); };
      });
      return ready;
    }
    function stop() { if (worker) { worker.terminate(); worker = null; ready = null; } }

    /**
     * Reads a DXF drawing.
     * @param {string} text the file's text
     * @returns {Promise<{summary: any, rows: any[][], svg: string}>}
     */
    async function read(text) {
      await ensureWorker();
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, text });
      });
    }
    return { read, stop };
  });
})();
