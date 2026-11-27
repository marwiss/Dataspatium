// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Import at start: the same functions as the import pipeline (io/import-pipeline), which loads with the importers as the group
 * 'import' (src/boot.js, PLAN 4 step 6) the first time a file, a text or an example is read. Each reading function waits for the
 * group (ready()); the pure helpers (baseName, folderOf, materialize) work at once, without the importers. importerFor,
 * collectionFor and recognisedAs answer only once the group is loaded: code at start awaits ready() before it asks them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/import', ['data/types'], (types) => {
    /**
     * The importers loaded (the groups plan and import), then the pipeline.
     * @returns {Promise<any>}
     */
    function ready() { return D.ensure(['import'], () => D.require('io/import-pipeline')); }
    /** The pipeline when its group is loaded; an error that names ready() before that. @param {string} what */
    function loaded(what) {
      if (D.groups.loaded('import')) return D.require('io/import-pipeline');
      throw new Error(`io/import.${what}: await ready() first, the importers are not loaded yet`);
    }
    /** A function of the pipeline that waits for it. @param {string} name @returns {(...args: any[]) => Promise<any>} */
    const later = (name) => async (...args) => (await ready())[name](...args);
    let ahead = false;
    /**
     * The importers loaded ahead on idle time, once Inhämta or Hantera has been drawn, so that the first file seldom waits for
     * them. It asks nothing and fetches nothing but the app's own scripts.
     */
    function loadAhead() {
      if (ahead || D.groups.loaded('import')) return;
      ahead = true;
      const load = () => { ready().catch((err) => { ahead = false; D.log('import', 'load ahead', err); }); };
      const w = /** @type {any} */ (globalThis);
      if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(load, { timeout: 3000 });
      else setTimeout(load, 500);
    }

    /** A file's name without its extension and with spaces for _ and -, as a dataset's name. @param {string} [fileName] */
    function baseName(fileName) { return String(fileName || D.t('datasets.default.name')).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || D.t('datasets.default.name'); }

    /** The top folder of files picked or dropped as a folder. @param {any[]} files */
    function folderOf(files) {
      const path = files[0] && (files[0].webkitRelativePath || files[0].dmPath);
      return path && path.includes('/') ? path.split('/')[0] : '';
    }

    /**
     * Turn parsed table + column specs into typed rows.
     * @param {{columns: string[], rows: any[][]}} table
     * @param {Array<{name: string, type: string, include?: boolean, decimal?: string, label?: string}>} specs one per source column
     * @param {{decimal?: string, reproject?: {east: string, north: string, crs: string}}} [options]
     */
    function materialize(table, specs, options = {}) {
      const included = specs.map((s, i) => Object.assign({ index: i }, s)).filter((s) => s.include !== false);
      const rows = new Array(table.rows.length);
      for (let r = 0; r < table.rows.length; r++) {
        const src = table.rows[r];
        const out = new Array(included.length);
        for (let c = 0; c < included.length; c++) {
          const spec = included[c];
          out[c] = types.parseValue(src[spec.index], spec.type, { decimal: spec.decimal || options.decimal });
        }
        rows[r] = out;
      }
      const result = { columns: included.map((s) => ({ name: s.name, type: s.type, label: s.label || s.name, sourceName: table.columns[s.index] })), rows };
      return options.reproject ? withDegrees(result, options.reproject) : result;
    }
    /**
     * Coordinates in another system get columns in degrees. The originals stay, under names that no longer read as coordinates.
     * @param {{columns: any[], rows: any[][]}} result @param {{east: string, north: string, crs: string}} reproject in the source's names
     */
    function withDegrees(result, reproject) {
      const geo = D.require('data/geo');
      const east = result.columns.findIndex((c) => c.sourceName === reproject.east);
      const north = result.columns.findIndex((c) => c.sourceName === reproject.north);
      if (east < 0 || north < 0) return result;
      for (const c of [result.columns[east], result.columns[north]]) { c.name += '_original'; c.label = c.name; }
      const free = (name) => (result.columns.some((c) => c.name === name) ? `${name}_wgs84` : name);
      result.columns.push({ name: free('lon'), type: 'number', label: 'lon' }, { name: free('lat'), type: 'number', label: 'lat' });
      for (const row of result.rows) {
        const x = row[east]; const y = row[north];
        const point = typeof x === 'number' && typeof y === 'number' ? geo.toWgs84({ type: 'Point', coordinates: [x, y] }, reproject.crs).coordinates : [null, null];
        row.push(point[0], point[1]);
      }
      return result;
    }

    return {
      ready,
      loadAhead,
      recognise: later('recognise'),
      preview: later('preview'),
      parse: later('parse'),
      run: later('run'),
      runText: later('runText'),
      runFiles: later('runFiles'),
      runPreset: later('runPreset'),
      previewText: later('previewText'),
      sortFiles: later('sortFiles'),
      runSorted: later('runSorted'),
      /** @param {File} file @param {string} [forced] */
      importerFor: (file, forced) => loaded('importerFor').importerFor(file, forced),
      /** @param {File[]} files @param {string} [forced] */
      collectionFor: (files, forced) => loaded('collectionFor').collectionFor(files, forced),
      /** @param {File} file */
      recognisedAs: (file) => loaded('recognisedAs').recognisedAs(file),
      baseName, folderOf, materialize,
    };
  });
})();
