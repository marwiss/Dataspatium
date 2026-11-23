// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The background map each map view last had for each dataset: chosen on Bearbeta's map, on the plan map or at the place of a
 * new building, it is there again when the person comes back to the dataset, later in the session and after a reload. A choice
 * made in this session comes back as it was. One kept from an earlier session comes back only when nothing would be asked for
 * it: no background map, a raster of the workspace, or a background map from the net when the consent for background maps is
 * kept for good (an orthophoto with a key only when its key is already in the session). Otherwise the view starts without a
 * background map, so that a link opened at start asks nothing and fetches nothing.
 * The setting `basemaps.remembered` holds one object by dataset id, {<id>: {at, <view>: choice}}, for the MAX datasets chosen
 * last that still exist. A choice holds the background map's id and what the person entered with it (a WMS, OGC API – Tiles,
 * the plan map's grid), never a key: an orthophoto's key stays in api/secrets.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/basemap-memory', ['platform/storage/idb', 'platform/consent', 'viz/orthophotos', 'data/datasets', 'ui/viz/basemap-choice'], (idb, consent, orthophotos, datasets, basemapChoice) => {
    const SETTING = 'basemaps.remembered';
    /** The datasets whose choices the setting keeps, the latest first. */
    const MAX = 200;
    /** What the person chose in this session: view and dataset id → choice. @type {Map<string, any>} */
    const session = new Map();
    /** The setting, read once a session. @type {Promise<Record<string, any>>|null} */
    let stored = null;
    /** The writes in order, so that two choices close together both arrive. */
    let writing = Promise.resolve();
    const keyOf = (view, id) => view + '\n' + id;
    const copy = (v) => JSON.parse(JSON.stringify(v));
    const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    /** A choice that keeps nothing: no background map and nothing else set. */
    const empty = (choice) => Object.values(choice).every((v) => v === null || v === undefined || v === 'none');

    function read() {
      if (!stored) stored = idb.getSetting(SETTING, null).then((v) => (isObject(v) ? v : {})).catch((err) => { D.log('basemaps', err); return {}; });
      return stored;
    }

    /**
     * The setting's entries for the datasets that exist (all of them when `ids` is null), the latest first and at most `max`.
     * @param {Record<string, any>} all @param {Set<string>|null} ids @param {number} [max]
     * @returns {Record<string, any>}
     */
    function trim(all, ids, max = MAX) {
      const entries = Object.entries(isObject(all) ? all : {}).filter(([id, e]) => isObject(e) && (!ids || ids.has(id)));
      entries.sort((a, b) => (Number(b[1].at) || 0) - (Number(a[1].at) || 0));
      return Object.fromEntries(entries.slice(0, max));
    }
    async function persist(view, id, choice) {
      const all = Object.assign({}, await read());
      const entry = Object.assign({}, all[id]);
      if (empty(choice)) delete entry[view]; else entry[view] = choice;
      delete all[id];
      if (Object.keys(entry).some((k) => k !== 'at')) all[id] = Object.assign(entry, { at: Date.now() });
      let ids = null;
      try { ids = new Set((await datasets.list()).map((d) => d.id)); } catch (err) { D.log('basemaps', err); }
      const next = trim(all, ids);
      stored = Promise.resolve(next);
      await idb.setSetting(SETTING, next);
    }

    /**
     * Remember the person's choice of background map for a dataset in a view ('map', 'plan', 'site'): at once for this session,
     * then in the setting. Resolves when it is written; a failed write is logged, and the session keeps the choice.
     * @param {string} view @param {string} datasetId @param {{basemap: string, [key: string]: any}} choice
     * @returns {Promise<void>}
     */
    function remember(view, datasetId, choice) {
      if (!view || !datasetId || !choice || typeof choice.basemap !== 'string') return Promise.resolve();
      const kept = copy(choice);
      session.set(keyOf(view, datasetId), kept);
      writing = writing.then(() => persist(view, datasetId, kept)).catch((err) => D.log('basemaps', err));
      return writing;
    }

    /** True when a background map kept from an earlier session can be drawn without asking anything. @param {string} id */
    async function quiet(id) {
      if (id === 'none' || id.startsWith(basemapChoice.RASTER)) return true;
      if ((await consent.state('basemaps')) !== 'granted') return false;
      if (!orthophotos.isPreset(id)) return true;
      const preset = await orthophotos.get(id).catch(() => null);
      return !!preset && orthophotos.ready(preset);
    }
    /**
     * The choice to restore for a dataset in a view, or null when none is remembered. One made in this session comes as it was;
     * one from the setting keeps its background map only when nothing would be asked for it (see the top), else its background
     * map is 'none' and the rest of it (the plan map's grid, a WMS entered) comes as it was. Never asks and never fetches.
     * @param {string} view @param {string} datasetId @returns {Promise<any|null>}
     */
    async function recall(view, datasetId) {
      if (!view || !datasetId) return null;
      const own = session.get(keyOf(view, datasetId));
      if (own) return copy(own);
      const entry = (await read())[datasetId];
      const kept = isObject(entry) && isObject(entry[view]) && typeof entry[view].basemap === 'string' ? copy(entry[view]) : null;
      if (!kept) return null;
      if (!(await quiet(kept.basemap).catch(() => false))) kept.basemap = 'none';
      return kept;
    }

    /**
     * The background map when a view offers it now (`choices` as its select's options), else 'none': a remembered one that is
     * gone or does not cover the dataset is not drawn. @param {string} id @param {Array<{value: string}>} choices
     */
    function within(id, choices) { return id === 'none' || choices.some((c) => c.value === id) ? id : 'none'; }

    /** Forget this session's choices and read the setting again on the next recall, as after a reload (for the tests). */
    function reset() { session.clear(); stored = null; }

    return { SETTING, MAX, remember, recall, within, trim, reset };
  });
})();
