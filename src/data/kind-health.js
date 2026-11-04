// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Is this dataset in good condition, in its own terms: pages without text, pictures without a position, edges pointing at
 * nothing, elements without quantities, places that cannot be drawn. The rules in Bearbeta say what the user demands; this
 * says what the kind of data itself needs. Every check is a count in SQL, so it runs in the engine's worker.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/kind-health', ['data/datasets', 'data/kinds', 'data/geo', 'viz/leaflet'], (datasets, kinds, geo, leaflet) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const SAMPLE = 2000;

    async function count(engine, sql, params) {
      const r = await engine.exec(sql, params);
      return r[0] && r[0].values[0] ? Number(r[0].values[0][0]) || 0 : 0;
    }
    async function hasTable(engine, name) {
      return (await count(engine, 'select count(*) from sqlite_master where type = ? and name = ?', ['table', name])) > 0;
    }
    const issue = (level, key, n, action) => ({ level, key, n, action: action || null });

    async function documents(handle) {
      const out = [];
      const listed = Array.isArray(handle.meta.documents) ? handle.meta.documents : [];
      const pages = listed.reduce((s, d) => s + (Number(d.pages) || 0), 0);
      const withText = await count(handle.engine, "select count(*) from (select distinct dokument, sida from data where text is not null and text != '')");
      if (pages > withText) out.push(issue('warn', 'health.document.pages', pages - withText));
      return out;
    }
    async function pictures(handle) {
      const out = [];
      const noPlace = await count(handle.engine, 'select count(*) from data where lon is null');
      if (noPlace) out.push(issue('info', 'health.images.position', noPlace));
      const noDate = await count(handle.engine, 'select count(*) from data where datum is null');
      if (noDate) out.push(issue('info', 'health.images.date', noDate));
      return out;
    }
    async function graph(handle) {
      const out = [];
      const engine = handle.engine;
      if (!(await hasTable(engine, '_edges'))) return [issue('info', 'health.graph.noedges', 1)];
      const dangling = await count(engine, 'select count(*) from _edges where kalla not in (select id from data) or mal not in (select id from data)');
      if (dangling) out.push(issue('warn', 'health.graph.dangling', dangling));
      const lonely = await count(engine, 'select count(*) from data where id not in (select kalla from _edges) and id not in (select mal from _edges)');
      if (lonely) out.push(issue('info', 'health.graph.isolated', lonely));
      const loops = await count(engine, 'select count(*) from _edges where kalla = mal');
      if (loops) out.push(issue('info', 'health.graph.loops', loops));
      return out;
    }
    async function model(handle) {
      if (kinds.isDxf(handle.meta)) {
        const noLayer = await count(handle.engine, "select count(*) from data where lager is null or lager = ''");
        return noLayer ? [issue('info', 'health.model.layer', noLayer)] : [];
      }
      const out = [];
      const names = handle.columns.map((c) => c.name);
      if (names.includes('vaning')) {
        const noStorey = await count(handle.engine, "select count(*) from data where vaning is null or vaning = ''");
        if (noStorey) out.push(issue('info', 'health.model.storey', noStorey));
      }
      if (await hasTable(handle.engine, '_quantities')) {
        const noAmount = await count(handle.engine, 'select count(*) from data where id not in (select distinct id from _quantities)');
        if (noAmount) out.push(issue('info', 'health.model.quantities', noAmount));
      }
      return out;
    }
    async function plan(handle) {
      const missing = await count(handle.engine, "select count(*) from data where geometri is null or geometri = ''");
      return missing ? [issue('warn', 'health.plan.geometry', missing)] : [];
    }
    /** Places in a table: rows without one, and values that cannot be drawn. */
    async function places(handle) {
      const engine = handle.engine;
      const geometry = leaflet.geometryColumn(handle.columns);
      if (geometry) {
        const c = q(geometry);
        const out = [];
        const empty = await count(engine, `select count(*) from data where ${c} is null or ${c} = ''`);
        if (empty) out.push(issue('warn', 'health.spatial.empty', empty));
        const r = await engine.exec(`select ${c} from data where ${c} is not null and ${c} != '' limit ${SAMPLE}`);
        const bad = (r[0] ? r[0].values : []).filter((row) => { try { return !geo.parseGeometry(row[0]); } catch (_err) { return true; } }).length;
        if (bad) out.push(issue('warn', 'health.spatial.invalid', bad));
        return out;
      }
      const coords = leaflet.coordinateColumns(handle.columns);
      if (!coords) return [];
      const empty = await count(engine, `select count(*) from data where ${q(coords.lon)} is null or ${q(coords.lat)} is null`);
      return empty ? [issue('warn', 'health.spatial.empty', empty)] : [];
    }

    /**
     * The findings for a dataset; an empty list means nothing to report.
     * @param {string} id @returns {Promise<Array<{level: 'warn'|'info', key: string, n: number, action: string|null}>>}
     */
    async function check(id) {
      const handle = await datasets.ensureOpen(id);
      switch (handle.meta.kind) {
        case 'document': return documents(handle);
        case 'images': return pictures(handle);
        case 'graph': return graph(handle);
        case 'model': return model(handle);
        case 'plan': return plan(handle);
        default: break;
      }
      return (await D.require('data/facets').has(id, 'spatial')) ? places(handle) : [];
    }

    return { check };
  });
})();
