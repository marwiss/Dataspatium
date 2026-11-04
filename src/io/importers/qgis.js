// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * QGIS projects (.qgs XML, .qgz ZIP with the .qgs inside): the layer tree gives the order and visibility, every
 * vector layer its data source (file and layer name) and its renderer (single symbol, categorized, graduated or rules)
 * with the symbols' colours and widths. The result becomes a map chart (viz/leaflet) whose layers point at the
 * datasets that were imported from the same files; layers without a dataset are listed as missing.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/qgis', ['platform/storage/zip'], (zip) => {
    const EXT = /\.(qgs|qgz)$/i;
    /** Millimetres (QGIS symbol units) to CSS pixels at 96 dpi. */
    const MM = 96 / 25.4;

    function detect(file) { return EXT.test(file.name); }

    /** "R,G,B,A" or "R,G,B,A,rgb:…" to #rrggbb and alpha 0–1; null when unreadable. */
    function parseColor(value) {
      const parts = String(value || '').split(',').map((p) => Number(p.trim()));
      if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
      const hex = parts.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
      const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? Math.max(0, Math.min(1, parts[3] / 255)) : 1;
      return { hex: '#' + hex, alpha };
    }
    const kids = (el, name) => Array.from(el ? el.children : []).filter((c) => c.localName === name);
    const kid = (el, name) => kids(el, name)[0] || null;
    const text = (el) => (el ? String(el.textContent || '').trim() : '');
    /** Properties of a symbol layer: QGIS ≥ 3.16 writes <Option name="…" value="…"/>, older versions <prop k="…" v="…"/>. */
    function props(layerEl) {
      const out = {};
      for (const p of layerEl.getElementsByTagName('prop')) out[p.getAttribute('k')] = p.getAttribute('v');
      for (const o of layerEl.getElementsByTagName('Option')) { const name = o.getAttribute('name'); if (name && o.hasAttribute('value')) out[name] = o.getAttribute('value'); }
      return out;
    }
    /**
     * One <symbol> to a style: fill/stroke colour, stroke width (px), fill opacity, marker radius (px).
     * Only the first enabled simple layer is read; QGIS' effects and complex symbols are approximated.
     */
    function symbolStyle(symbolEl) {
      const tk = D.require('viz/theme').tokens();
      const style = { color: tk.palette[0], fillColor: tk.palette[0], weight: 1, opacity: 1, fillOpacity: 0.45, radius: 5, noFill: false, noStroke: false };
      if (!symbolEl) return style;
      const type = symbolEl.getAttribute('type') || 'fill';
      const alpha = Number(symbolEl.getAttribute('alpha'));
      const layers = kids(symbolEl, 'layer').filter((l) => l.getAttribute('enabled') !== '0');
      const layer = layers.find((l) => /^(SimpleFill|SimpleLine|SimpleMarker)$/.test(l.getAttribute('class') || '')) || layers[0];
      if (!layer) return style;
      const p = props(layer);
      const cls = layer.getAttribute('class') || '';
      if (cls === 'SimpleLine' || type === 'line') {
        const c = parseColor(p.line_color || p.color);
        if (c) { style.color = c.hex; style.opacity = c.alpha; }
        style.weight = Math.max(0.5, (Number(p.line_width) || 0.26) * MM);
        style.fillOpacity = 0; style.noFill = true;
      } else if (cls === 'SimpleMarker' || type === 'marker') {
        const c = parseColor(p.color); const oc = parseColor(p.outline_color);
        if (c) { style.fillColor = c.hex; style.fillOpacity = c.alpha; }
        style.color = oc ? oc.hex : (c ? c.hex : style.color);
        style.weight = Math.max(0.5, (Number(p.outline_width) || 0) * MM) || 1;
        style.radius = Math.max(2, ((Number(p.size) || 2) * MM) / 2);
      } else {
        const c = parseColor(p.color); const oc = parseColor(p.outline_color);
        if (c) { style.fillColor = c.hex; style.fillOpacity = c.alpha; }
        if (p.style === 'no') { style.fillOpacity = 0; style.noFill = true; }
        if (oc) { style.color = oc.hex; style.opacity = oc.alpha; } else style.color = style.fillColor;
        if (p.outline_style === 'no') { style.weight = 0; style.noStroke = true; } else style.weight = Math.max(0.3, (Number(p.outline_width) || 0.26) * MM);
      }
      if (Number.isFinite(alpha) && alpha >= 0 && alpha < 1) { style.fillOpacity *= alpha; style.opacity *= alpha; }
      style.fillOpacity = Math.round(style.fillOpacity * 100) / 100; style.opacity = Math.round(style.opacity * 100) / 100; style.weight = Math.round(style.weight * 10) / 10; style.radius = Math.round(style.radius * 10) / 10;
      return style;
    }
    /** The renderer of a map layer: type, attribute and the styles per category, range or rule. */
    function renderer(mapLayer) {
      const r = kid(mapLayer, 'renderer-v2');
      if (!r) return { type: 'none', attribute: null, symbol: symbolStyle(null), categories: [], ranges: [] };
      const symbols = new Map();
      for (const s of kids(kid(r, 'symbols'), 'symbol')) symbols.set(s.getAttribute('name'), symbolStyle(s));
      const type = r.getAttribute('type') || 'singleSymbol';
      const attribute = r.getAttribute('attr') || null;
      const first = symbols.get('0') || symbols.values().next().value || symbolStyle(null);
      const out = { type, attribute, symbol: first, categories: [], ranges: [], rules: [] };
      if (type === 'categorizedSymbol') {
        for (const c of kids(kid(r, 'categories'), 'category')) {
          if (c.getAttribute('render') === 'false') continue;
          out.categories.push({ value: c.getAttribute('value'), label: c.getAttribute('label') || c.getAttribute('value'), style: symbols.get(c.getAttribute('symbol')) || first });
        }
      } else if (type === 'graduatedSymbol') {
        for (const g of kids(kid(r, 'ranges'), 'range')) {
          if (g.getAttribute('render') === 'false') continue;
          out.ranges.push({ lower: Number(g.getAttribute('lower')), upper: Number(g.getAttribute('upper')), label: g.getAttribute('label') || '', style: symbols.get(g.getAttribute('symbol')) || first });
        }
      } else if (type === 'RuleRenderer') {
        const walk = (rulesEl) => { for (const rule of kids(rulesEl, 'rule')) { if (rule.getAttribute('symbol')) out.rules.push({ filter: rule.getAttribute('filter') || '', label: rule.getAttribute('label') || '', style: symbols.get(rule.getAttribute('symbol')) || first }); walk(rule); } };
        walk(kid(r, 'rules'));
        if (out.rules.length) out.symbol = out.rules[0].style;
      }
      return out;
    }
    /** "./data/kommuner.gpkg|layername=kommuner" or a delimitedtext URI → {path, file, layer, params}. */
    function parseSource(ds, provider) {
      const out = { raw: ds, path: '', file: '', layer: null, params: {} };
      if (!ds) return out;
      if (provider === 'delimitedtext' || /^file:/i.test(ds)) {
        const q = ds.indexOf('?');
        const url = q >= 0 ? ds.slice(0, q) : ds;
        out.path = decodeURIComponent(url.replace(/^file:\/\/\/?/i, ''));
        if (q >= 0) for (const part of ds.slice(q + 1).split('&')) { const [k, v] = part.split('='); out.params[decodeURIComponent(k)] = decodeURIComponent(v || ''); }
      } else {
        const parts = ds.split('|');
        out.path = parts[0];
        for (const part of parts.slice(1)) { const [k, v] = part.split('='); if (k === 'layername') out.layer = v; else out.params[k] = v || ''; }
      }
      out.file = out.path.split(/[\\/]/).pop() || '';
      return out;
    }
    /** Layer tree in drawing order from the top: [{id, name, visible, group}]. */
    function tree(root) {
      const out = [];
      const visit = (groupEl, path) => {
        for (const el of Array.from(groupEl.children)) {
          if (el.localName === 'layer-tree-layer') out.push({ id: el.getAttribute('id'), name: el.getAttribute('name') || '', visible: (el.getAttribute('checked') || 'Qt::Checked') !== 'Qt::Unchecked', group: path.join(' / ') });
          else if (el.localName === 'layer-tree-group') visit(el, el.getAttribute('name') ? path.concat([el.getAttribute('name')]) : path);
        }
      };
      visit(root, []);
      return out;
    }

    /**
     * Parse project XML text.
     * @returns {{title: string, version: string, crs: string|null, layers: any[], extent: any}} layers top to bottom
     */
    function parseXml(xmlText) {
      const doc = new DOMParser().parseFromString(String(xmlText), 'application/xml');
      const root = doc.documentElement;
      if (!root || root.localName !== 'qgis') throw new Error(D.t('import.err.qgis'));
      const byId = new Map();
      for (const ml of root.getElementsByTagName('maplayer')) byId.set(text(kid(ml, 'id')), ml);
      const order = tree(kid(root, 'layer-tree-group') || root);
      const layers = [];
      for (const node of order) {
        const ml = byId.get(node.id);
        if (!ml) continue;
        const type = ml.getAttribute('type') || 'vector';
        const provider = text(kid(ml, 'provider'));
        const source = parseSource(text(kid(ml, 'datasource')), provider);
        const srs = kid(ml, 'srs');
        layers.push({
          id: node.id, name: text(kid(ml, 'layername')) || node.name, treeName: node.name, group: node.group, visible: node.visible,
          type, provider, geometryType: ml.getAttribute('geometry') || null, source,
          crs: srs ? text(srs.getElementsByTagName('authid')[0]) || null : null,
          renderer: type === 'vector' ? renderer(ml) : null,
          minScale: Number(ml.getAttribute('minScale')) || null, maxScale: Number(ml.getAttribute('maxScale')) || null,
        });
      }
      const extentEl = root.getElementsByTagName('DefaultViewExtent')[0];
      const extent = extentEl ? { xmin: Number(extentEl.getAttribute('xmin')), ymin: Number(extentEl.getAttribute('ymin')), xmax: Number(extentEl.getAttribute('xmax')), ymax: Number(extentEl.getAttribute('ymax')) } : null;
      const crsEl = kid(root, 'projectCrs');
      return { title: text(kid(root, 'title')) || root.getAttribute('projectname') || '', version: root.getAttribute('version') || '', crs: crsEl ? text(crsEl.getElementsByTagName('authid')[0]) || null : null, layers, extent };
    }
    /** Parse a .qgs or .qgz file. */
    async function parseFile(file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.qgz$/i.test(file.name) || (bytes[0] === 0x50 && bytes[1] === 0x4B)) {
        const entries = await zip.readZip(bytes);
        const name = Object.keys(entries).find((n) => /\.qgs$/i.test(n));
        if (!name) throw new Error(D.t('import.err.qgz'));
        return parseXml(new TextDecoder('utf-8').decode(entries[name]));
      }
      return parseXml(new TextDecoder('utf-8').decode(bytes));
    }

    /**
     * Match the project's layers to datasets: by the data file's name (and layer name for GeoPackage), case-insensitively.
     * @param {any} project @param {Array<{id: string, name: string, shortName?: string, source?: any, importOptions?: any}>} datasets
     * @returns {Map<string, any>} layer id -> dataset meta
     */
    function matchDatasets(project, datasets) {
      const out = new Map();
      const lower = (s) => String(s || '').toLowerCase();
      for (const layer of project.layers) {
        if (layer.type !== 'vector') continue;
        const file = lower(layer.source.file);
        const candidates = datasets.filter((d) => d.source && d.source.fileName && lower(d.source.fileName) === file);
        let match = null;
        if (candidates.length > 1 && layer.source.layer) match = candidates.find((d) => d.importOptions && (lower(d.importOptions.table) === lower(layer.source.layer) || lower(d.importOptions.layer) === lower(layer.source.layer))) || null;
        if (!match) match = candidates[0] || null;
        if (!match) match = datasets.find((d) => lower(d.name) === lower(layer.name)) || null;
        if (match) out.set(layer.id, match);
      }
      return out;
    }
    /**
     * Map chart layers from a project and the matched datasets (bottom first, as Leaflet draws them).
     * @param {any} project @param {Map<string, any>} matches layer id -> dataset meta
     * @param {(id: string) => Promise<any[]>} columnsOf dataset id -> columns
     * @returns {Promise<{layers: any[], missing: any[]}>}
     */
    async function toMapLayers(project, matches, columnsOf) {
      const leaflet = D.require('viz/leaflet');
      const layers = []; const missing = [];
      for (const layer of project.layers) {
        if (layer.type !== 'vector') { missing.push({ layer, reason: 'raster' }); continue; }
        const ds = matches.get(layer.id);
        if (!ds) { missing.push({ layer, reason: 'dataset' }); continue; }
        const columns = await columnsOf(ds.id);
        const base = leaflet.layerFor(columns, ds, layers.length);
        if (!base) { missing.push({ layer, reason: 'geometry' }); continue; }
        base.name = layer.name;
        base.visible = layer.visible;
        const r = layer.renderer || { type: 'none', symbol: null, categories: [], ranges: [] };
        const sym = r.symbol || {};
        base.style = { color: sym.color || base.style.color, fillColor: sym.fillColor || sym.color || base.style.color, weight: sym.noStroke ? 0 : (sym.weight || base.style.weight), opacity: sym.opacity === undefined ? 0.9 : sym.opacity, fillOpacity: sym.noFill ? 0 : (sym.fillOpacity === undefined ? 0.45 : sym.fillOpacity), radius: sym.radius || 6 };
        const attr = r.attribute && columns.some((c) => c.name === r.attribute) ? r.attribute : null;
        if (r.type === 'categorizedSymbol' && attr && r.categories.length) {
          const values = {};
          for (const c of r.categories) values[c.value === null ? '' : String(c.value)] = c.style.fillColor || c.style.color;
          base.colorBy = { column: attr, mode: 'category', values, labels: Object.fromEntries(r.categories.map((c) => [String(c.value), c.label])) };
        } else if (r.type === 'graduatedSymbol' && attr && r.ranges.length) {
          base.colorBy = { column: attr, mode: 'graduated', ranges: r.ranges.map((g) => ({ lower: g.lower, upper: g.upper, color: g.style.fillColor || g.style.color, label: g.label })) };
        }
        layers.push(base);
      }
      return { layers: layers.reverse(), missing };
    }

    return { id: 'qgis', detect, parseXml, parseFile, parseColor, symbolStyle, parseSource, matchDatasets, toMapLayers };
  });
})();
