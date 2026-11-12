// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Orthophotos as background maps (decision B-64): the open services in `presets/geodata/orthophotos.json`, each with its
 * provider, licence, attribution, the grids it can be drawn in (Web Mercator and, for some, the country's own grid) and,
 * where the provider asks for one, a free key. The key lives in api/secrets under `basemap:<id>` and goes only into the
 * image addresses of its own service (viz/leaflet), never into a saved map view, the log or published HTML. Nothing here
 * contacts the net: viz/leaflet asks the consent for background maps before the first tile.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/orthophotos', ['api/secrets', 'platform/text'], (secrets, text) => {
    const ASSET = 'presets/geodata/orthophotos.json';
    const FORMAT = 'dataspatium-basemaps/1';
    const PREFIX = 'ortho-';
    /** @type {Promise<any[]>|null} */ let loading = null;
    /** @type {any[]} */ let loaded = [];

    /**
     * The presets of a file's text, checked: every one has an id with the prefix, a name, a publisher, a service (wms or
     * xyz), a source in Web Mercator, an open licence with its address and an attribution. Throws on a malformed file.
     * @param {string} text @returns {any[]}
     */
    function parse(text) {
      const doc = JSON.parse(text);
      if (!doc || doc.format !== FORMAT || !Array.isArray(doc.basemaps)) throw new Error('orthophotos: unknown format');
      return doc.basemaps.map((b) => {
        const ok = b && typeof b.id === 'string' && b.id.startsWith(PREFIX) && b.name && b.publisher && (b.service === 'wms' || b.service === 'xyz')
          && b.sources && b.sources['3857'] && /^https:\/\//.test(b.sources['3857'].url || '')
          && b.license && b.license.name && /^https:\/\//.test(b.license.url || '') && b.attribution;
        if (!ok) throw new Error('orthophotos: incomplete preset ' + (b && b.id));
        if (b.service === 'wms' && Object.values(b.sources).some((s) => !s.layers)) throw new Error('orthophotos: a WMS source without layers in ' + b.id);
        if (b.key && !(b.key.param && /^https:\/\//.test(b.key.signupUrl || ''))) throw new Error('orthophotos: a key without its parameter or sign-up page in ' + b.id);
        return Object.freeze(Object.assign({}, b));
      });
    }
    /** The presets, read once from the bundled file. @returns {Promise<any[]>} */
    function list() {
      if (!loading) loading = D.assets.loadText(ASSET).then((text) => { loaded = parse(text); return loaded; }).catch((err) => { loading = null; throw err; });
      return loading;
    }
    /** The presets already read, or an empty list (for code that cannot wait). */
    function cached() { return loaded; }
    /** True for a background map id that names an orthophoto preset. @param {string} id */
    function isPreset(id) { return typeof id === 'string' && id.startsWith(PREFIX); }
    /** One preset by id, or null. @param {string} id */
    async function get(id) { return isPreset(id) ? ((await list()).find((b) => b.id === id) || null) : null; }
    /**
     * The source of a preset in a grid (an EPSG code; 0 or missing for Web Mercator), or null when the service does not
     * offer that grid. @param {any} preset @param {number} [code]
     * @returns {{service: string, url: string, layers?: string, format?: string, maxNativeZoom?: number}|null}
     */
    function sourceFor(preset, code) {
      const s = preset && preset.sources ? preset.sources[String(code || 3857)] : null;
      return s ? Object.assign({ service: preset.service }, s) : null;
    }
    /** The EPSG codes a preset can be drawn in. @param {any} preset @returns {number[]} */
    function grids(preset) { return Object.keys((preset && preset.sources) || {}).map(Number); }
    /** Presets whose area meets a box {minX, minY, maxX, maxY} in degrees (all of them without a box). */
    function covering(presets, box) {
      if (!box) return presets.slice();
      return presets.filter((b) => !Array.isArray(b.bounds) || (box.maxX >= b.bounds[0] && box.minX <= b.bounds[2] && box.maxY >= b.bounds[1] && box.minY <= b.bounds[3]));
    }
    /** The secret's id of a preset's key. @param {any} preset */
    const secretId = (preset) => 'basemap:' + preset.id;
    /** The key of a preset in this session, or '' (also for a preset without a key). @param {any} preset */
    function keyOf(preset) {
      if (!preset || !preset.key) return '';
      const values = secrets.get(secretId(preset));
      return values && values.apiKey ? String(values.apiKey) : '';
    }
    /** True when a preset can be drawn now: it needs no key, or its key is in the session. @param {any} preset */
    function ready(preset) { return !!preset && (!preset.key || !!keyOf(preset)); }
    /**
     * The preset as a connector for the credentials panel (ui/api/auth-panel): one API key, the provider's sign-up page.
     * @param {any} preset @param {string} [help]
     */
    function connector(preset, help) {
      return { id: secretId(preset), name: preset.name, auth: { type: 'apiKey', in: 'query', name: preset.key ? preset.key.param : '', help: help || '', signupUrl: preset.key ? preset.key.signupUrl : '' } };
    }
    /** The attribution as text: the provider's line and the licence. @param {any} preset */
    function attributionText(preset) { return `${preset.attribution} (${preset.license.name})`; }
    /** The attribution as HTML for Leaflet's attribution control: escaped text and a link to the licence. @param {any} preset */
    function attributionHtml(preset) {
      const esc = text.escapeHtml;
      return `${esc(preset.attribution)} (<a href="${esc(preset.license.url)}" target="_blank" rel="noopener noreferrer">${esc(preset.license.name)}</a>)`;
    }

    return { ASSET, FORMAT, PREFIX, parse, list, cached, isPreset, get, sourceFor, grids, covering, secretId, keyOf, ready, connector, attributionText, attributionHtml };
  });
})();
