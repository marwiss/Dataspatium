// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The layers of a plan for its map and its list (ui/viz/layer-list): a comprehensive plan delivered as GeoPackages has one layer
 * per source layer, grouped per file (the rows' `lager` and `fil`); an older plan without them has one per theme, and a detailed
 * plan one per object type, in one group named after the dataset. Boverket's colours go first wherever it gives one (F108, by
 * data/plan.boverketColor): a layer whose rows all have one is drawn row by row with a legend entry per category and colour (land
 * use with its area per use), a layer where only some rows have one draws those in their colour and the rest as the layer, and a
 * layer without any keeps its own symbol. The plan boundary and the areas are outlines, a detailed plan's object types are drawn
 * as on the plan map (dpSymbol), and every other layer gets its own colour from the palette there.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-layers', ['ui/base', 'data/plan', 'data/geo', 'ui/viz/layer-list', 'viz/theme'], (base, plan, geo, layerList, theme) => {
    const { t, i18n } = base;
    /** Between a file's name and its layer's name in a layer's key. */
    const SEP = '::';
    const USE = 'markochvattenanvandning';
    /** The plan map's outlines of a detailed plan's object types other than use (as drawn before the layer list). */
    const OUTLINE_STYLES = {
      planomrade: { color: '#111111', weight: 3, dashArray: null, fillOpacity: 0 },
      egenskap: { color: '#1f6fb2', weight: 1.5, dashArray: '6 4', fillOpacity: 0 },
      administrativ: { color: '#8a3ffc', weight: 1.5, dashArray: '2 4', fillOpacity: 0 },
      overgang: { color: '#777c84', weight: 1.2, dashArray: '1 4', fillOpacity: 0 },
      annan: { color: '#4a4f57', weight: 1, dashArray: '4 4', fillOpacity: 0 },
    };

    /**
     * The key of a row's layer: the file and the source layer for a comprehensive plan that names them, else its theme, or the
     * object type of a detailed plan. @param {any} row @param {string} slag @returns {string}
     */
    function keyOf(row, slag) {
      if (slag === 'oversiktsplan' && row && row.lager) return `${row.fil || ''}${SEP}${row.lager}`;
      return slag === 'oversiktsplan' ? String((row && row.tema) || 'omrade') : String((row && row.objekttyp) || 'annan');
    }
    /** A theme's name in the language shown, or its key. @param {string} tema */
    const themeLabel = (tema) => (i18n.has('plan.theme.' + tema) ? t('plan.theme.' + tema) : String(tema || ''));
    /** The theme of a layer: its rows', or the one its table's name gives (innehall_op_<tema>_<geometry>). */
    function themeOf(rows, lager) {
      const tema = rows.find((r) => r.tema) ? rows.find((r) => r.tema).tema : '';
      if (tema) return String(tema);
      const m = /^innehall_op_(.+?)(?:_(?:polygon|line|point|linje|punkt))?$/i.exec(String(lager || ''));
      return m ? plan.themeKey(m[1]) : '';
    }
    const geometryOf = (row) => geo.parseGeometry(row.geometri);
    const fileName = (fil) => String(fil || '').split(/[\\/]/).pop() || String(fil || '');

    /**
     * The symbols a comprehensive plan's layers bring: Boverket's colours per row for land use, the plan boundary and the areas
     * as outlines in the text's colours; null for a layer that takes its colour from the palette.
     * @param {string} tema
     */
    function opSymbol(tema) {
      const tk = theme.tokens();
      if (tema === USE) return { mark: 'polygon', color: tk.muted, weight: 1, fill: null, fillOpacity: 0.6, byRow: (r) => plan.opFillOf(r) };
      if (tema === 'plangeometri') return { mark: 'polygon', color: tk.text, weight: 2.5, fill: null, fillOpacity: 0, edgeOnly: true };
      if (tema === 'omrade') return { mark: 'polygon', color: tk.muted, weight: 1, dash: '6 4', fill: null, fillOpacity: 0 };
      return null;
    }
    /**
     * A detailed plan's object type drawn as on the plan map: uses filled with Boverket's colours, the rest as outlines, strokes
     * at full opacity and points in their stroke's colour (`planMap`), as the plan map was drawn before the layer list.
     * @param {string} key the object type
     */
    function dpSymbol(key) {
      if (key === 'anvandning') return { mark: 'polygon', color: '#4a4f57', weight: 1, fill: null, fillOpacity: 0.6, planMap: true, byRow: (row) => plan.fillOf(row) || '#dadde1' };
      const o = OUTLINE_STYLES[key] || OUTLINE_STYLES.annan;
      return { color: o.color, weight: o.weight, dash: o.dashArray, fill: null, fillOpacity: o.fillOpacity, planMap: true };
    }
    const RANK = { polygon: 0, line: 1, point: 2 };

    /** The name a row's colour stands for in a legend: its type or designation and what it says, else the colour's name. */
    function categoryOf(row, slag) {
      const words = slag === 'oversiktsplan' ? row.innehallstyp || row.namn : [row.beteckning, row.formulering].filter(Boolean).join(' ');
      return String(words || row.farg || '–');
    }
    /**
     * Boverket's colours in a layer (F108): none leaves its symbol as it is; when all its rows have one it is drawn row by row
     * (keeping a symbol it brings, or a quiet outline with fills for areas, colours for lines and points); when only some have one
     * those rows are drawn in it and the rest as the layer (its outline, or its colour from the palette, which layer-list adds).
     * A layer with any gets a legend entry per category and colour (land use keeps its area per use), and its swatch shows the
     * first colours.
     * @param {any} layer @param {string} slag
     */
    function boverket(layer, slag) {
      const colored = [];
      for (const r of layer.rows) { const c = plan.boverketColor(r); if (c) colored.push([r, c]); }
      if (!colored.length) return;
      const all = colored.length === layer.rows.length;
      const colors = [];
      for (const [, c] of colored) { if (!colors.includes(c)) colors.push(c); if (colors.length >= 3) break; }
      const own = layer.symbol;
      const byRow = (own && own.byRow) || ((r) => plan.boverketColor(r));
      if (own) {
        // A symbol that fills shows the colours in its swatch; an outline stays an outline, its stroke coloured per row.
        layer.symbol = Object.assign({}, own, { byRow }, own.fillOpacity > 0 && layer.mark === 'polygon' ? { colors, fill: all ? colors[0] : own.fill } : {});
      } else if (all) {
        const tk = theme.tokens();
        const mark = layer.mark;
        layer.symbol = { mark, color: mark === 'line' ? colors[0] : tk.muted, weight: mark === 'line' ? 2.5 : 1, fill: mark === 'line' ? null : colors[0], fillOpacity: mark === 'polygon' ? 0.35 : 0.9, byRow, colors };
      } else {
        layer.symbol = { byRow, colors };
      }
      if (layer.categories) return;
      const seen = new Map();
      for (const [r, c] of colored) { const label = categoryOf(r, slag); const k = label + '\u0000' + c; if (!seen.has(k)) seen.set(k, { label, color: c }); }
      layer.categories = Array.from(seen.values());
    }

    /**
     * The plan's layers in drawing and list order, each with its rows (which carry `_i`, their place in `rows`), its count, its
     * mark and its symbol, with Boverket's colours wherever the rows have them.
     * @param {any[]} rows the plan's rows
     * @param {{slag: string, name: string}} options
     * @returns {any[]} the layers (ui/viz/layer-list's LayerInfo)
     */
    function of(rows, options) {
      const slag = options.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan';
      const byKey = new Map();
      for (const r of rows || []) {
        const key = keyOf(r, slag);
        let l = byKey.get(key);
        if (!l) { l = { key, rows: [], fil: slag === 'oversiktsplan' && r.lager ? String(r.fil || '') : null, lager: slag === 'oversiktsplan' ? r.lager || '' : '' }; byKey.set(key, l); }
        l.rows.push(r);
      }
      /** @type {any[]} */
      let layers;
      if (slag === 'detaljplan') {
        const keys = plan.OBJECT_TYPES.filter((k) => byKey.has(k)).concat(Array.from(byKey.keys()).filter((k) => !plan.OBJECT_TYPES.includes(k)));
        layers = keys.map((k) => {
          const l = byKey.get(k);
          return { key: k, group: '', groupLabel: options.name, label: i18n.has('plan.type.' + k) ? t('plan.type.' + k) : k, count: l.rows.length, mark: layerList.markOfRows(l.rows, geometryOf), rows: l.rows, symbol: dpSymbol(k) };
        });
      } else {
        layers = Array.from(byKey.values()).map((l) => {
          const tema = l.fil !== null ? themeOf(l.rows, l.lager) : l.key;
          const mark = layerList.markOfRows(l.rows, geometryOf);
          const out = { key: l.key, group: l.fil !== null ? l.fil : '', groupLabel: l.fil !== null && l.fil ? fileName(l.fil) : options.name, label: (tema && themeLabel(tema)) || l.lager || l.key, title: l.lager || '', count: l.rows.length, mark, rows: l.rows, tema, symbol: opSymbol(tema) || undefined };
          if (tema === USE) out.categories = plan.areasByUse(l.rows, 'oversiktsplan').map((e) => ({ label: `${e.label} · ${i18n.formatNumber(Math.round(e.area / 10000))} ha`, color: e.color }));
          return out;
        });
        // Two layers of one file with the same theme (a theme's areas, lines and points) say which they are.
        const twice = layers.filter((l) => layers.some((x) => x !== l && x.group === l.group && x.label === l.label));
        for (const l of twice) l.label = `${l.label} (${t('layers.mark.' + l.mark)})`;
        // Files in the order they come; in each, land use first, then areas, lines and points, by name.
        const files = Array.from(new Set(layers.map((l) => l.group)));
        layers.sort((a, b) => files.indexOf(a.group) - files.indexOf(b.group) || (a.tema === USE ? -1 : 0) - (b.tema === USE ? -1 : 0) || RANK[a.mark] - RANK[b.mark] || a.label.localeCompare(b.label, 'sv'));
      }
      for (const l of layers) boverket(l, slag);
      return layers;
    }

    return { SEP, keyOf, themeLabel, dpSymbol, of };
  });
})();
