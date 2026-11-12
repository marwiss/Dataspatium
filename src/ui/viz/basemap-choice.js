// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The orthophotos in the maps' choice of background map (decision B-64), shared by the map in Bearbeta, the map views in
 * Visualisera, the plan map and the place of a new building: the choices for a grid and an area, and the key that a provider
 * asks for, entered in the credentials panel (ui/api/auth-panel) and kept in api/secrets. Choosing an orthophoto contacts
 * nothing; the map asks the consent for background maps before its first tile.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/basemap-choice', ['ui/base', 'ui/overlays', 'ui/api/auth-panel', 'viz/orthophotos'], (base, overlays, authPanel, orthophotos) => {
    const { h, t } = base;

    /**
     * The orthophoto choices {value, label} for a map: those that can be drawn in its grid (an EPSG code, 0 or missing for
     * Web Mercator) and, when a box {minX, minY, maxX, maxY} in degrees is given, those that cover it.
     * @param {{grid?: number, box?: any}} [where] @returns {Promise<Array<{value: string, label: string}>>}
     */
    async function options(where = {}) {
      let list = [];
      try { list = await orthophotos.list(); } catch (err) { D.log('basemaps', err); return []; }
      const code = where.grid || 3857;
      return orthophotos.covering(list, where.box || null).filter((b) => orthophotos.sourceFor(b, code)).map((b) => ({ value: b.id, label: t('map.basemap.' + b.id) }));
    }

    /**
     * Make a chosen background map ready: an orthophoto that needs a key asks for it once per session (or unlocks a saved
     * one). Resolves true when the map can be drawn with it, false when the person cancelled.
     * @param {string} id the background map's id
     */
    async function ensure(id) {
      if (!orthophotos.isPreset(id)) return true;
      const preset = await orthophotos.get(id);
      if (!preset) return false;
      if (orthophotos.ready(preset)) return true;
      const help = t('map.basemap.key.help', { name: preset.name, publisher: preset.publisher, host: hostOf(preset) });
      let panel = null;
      const done = await overlays.dialog.open({
        title: t('map.basemap.key', { name: t('map.basemap.' + preset.id) }),
        help: 'kartor#ortofoton',
        body: (finish) => {
          panel = authPanel.create(orthophotos.connector(preset, help), { onChange: () => { if (orthophotos.ready(preset)) finish(true); } });
          return h('div', { class: 'dm-stack-sm', 'data-basemap-key': preset.id }, panel.el,
            h('p', { class: 'dm-help dm-xs', text: t('map.basemap.licence', { attribution: orthophotos.attributionText(preset) }) }));
        },
        actions: [{ label: t('common.cancel'), value: false }],
      });
      if (panel) panel.destroy();
      return done === true && orthophotos.ready(preset);
    }
    function hostOf(preset) { try { return new URL(orthophotos.sourceFor(preset, 3857).url).host; } catch (_e) { return ''; } }

    /** A sentence for a map that drew without its orthophoto because the key is missing (`info.basemapKey`), or ''. */
    function keyNotice(info) {
      return info && info.basemapKey ? t('map.basemap.key.missing', { name: t('map.basemap.' + info.basemapKey) }) : '';
    }

    /**
     * Tell the person that a map drew without its orthophoto for want of a key, with a button that asks for the key and then
     * calls `redraw`. Does nothing when the key was not missing.
     * @param {any} info the map's info @param {() => any} redraw
     */
    function notifyKey(info, redraw) {
      const id = info && info.basemapKey;
      if (!id) return;
      overlays.toast.show(keyNotice(info), { kind: 'warn', timeout: 12000, action: { label: t('map.basemap.key.enter'), onClick: () => { ensure(id).then((ok) => { if (ok) redraw(); }).catch((err) => D.log('basemaps', err)); } } });
    }

    return { options, ensure, keyNotice, notifyKey };
  });
})();
