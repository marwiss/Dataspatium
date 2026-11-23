// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The layers of a plan for its map and its list (ui/viz/layer-list): a comprehensive plan delivered as GeoPackages has one layer
 * per source layer, grouped per file (the rows' `lager` and `fil`); an older plan without them has one per theme, and a detailed
 * plan one per object type, in one group named after the dataset. Land use keeps Boverket's colours row by row (with its area
 * per use in the legend), the plan boundary and the areas are outlines, and every other layer gets its own colour from the
 * palette there.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-layers', ['ui/base', 'data/plan', 'data/geo', 'ui/viz/layer-list', 'viz/theme'], (base, plan, geo, layerList, theme) => {
    const { t, i18n } = base;
    /** Between a file's name and its layer's name in a layer's key. */
    const SEP = '::';
    const USE = 'markochvattenanvandning';

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
    const RANK = { polygon: 0, line: 1, point: 2 };

    /**
     * The plan's layers in drawing and list order, each with its rows (which carry `_i`, their place in `rows`), its count, its
     * mark and the symbol it brings (`symbolFor(key)` for a detailed plan's object types).
     * @param {any[]} rows the plan's rows
     * @param {{slag: string, name: string, symbolFor?: (key: string) => any}} options
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
          return { key: k, group: '', groupLabel: options.name, label: i18n.has('plan.type.' + k) ? t('plan.type.' + k) : k, count: l.rows.length, mark: layerList.markOfRows(l.rows, geometryOf), rows: l.rows, symbol: options.symbolFor ? options.symbolFor(k) : undefined };
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
      // A layer coloured row by row shows its first colours in its swatch.
      for (const l of layers) {
        if (!l.symbol || !l.symbol.byRow || l.symbol.colors) continue;
        const colors = [];
        for (const r of l.rows) { const c = l.symbol.byRow(r); if (c && !colors.includes(c)) colors.push(c); if (colors.length >= 3) break; }
        l.symbol = Object.assign({}, l.symbol, { colors, fill: colors[0] || null });
      }
      return layers;
    }

    return { SEP, keyOf, themeLabel, of };
  });
})();
