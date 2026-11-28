// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Whole Swedish detailed plans from a geodata source (F133 a): a municipal WFS that publishes the NGP layers (one layer
 * NGP_Detaljplan_yta with a row per plan and NGP_*bestammelse* layers with the provisions, all with the flattened NGP fields
 * `detaljplan.*` and `planbestammelse.*`; Sundsvall's RIGES) or Lantmäteriet's NGP API (OGC API Features with /search). A plan is
 * found by its name or designation and fetched whole: from every provision layer with a filter on its identity, or from the API as
 * the national specification's file (the `detaljplan` asset) or else its reference objects. The requests go the geodata family's
 * way (api/runner for the layers' endpoints, api/families/common for the API), so authentication, consent and the abort signal are
 * the source's own. The rows are kept as one plan dataset by io/importers/detaljplan, which recognises the format.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/ngp-plans', ['api/runner', 'api/families/common', 'api/families/geodata', 'data/geo', 'data/plan', 'io/importers/detaljplan'], (runner, common, geodata, geo, plan, detaljplanImp) => {
    const t = (k, p) => D.t(k, p);
    /** Plans in a search answer at most. */
    const LIST = 25;
    const ID = 'detaljplan.objektidentitet';
    const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
    const PLAN_LAYER = /(^|:)NGP_Detaljplan_yta$/i;
    const PROVISION_LAYER = /(^|:)NGP_\w*bestammelse\w*$/i;
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const dateOf = (v) => str(v).slice(0, 10);
    const hostOf = (u) => { try { return new URL(u).host; } catch (_e) { return ''; } };
    const aborted = (err) => !!err && err.kind === 'aborted';

    // ---- which sources offer whole plans ------------------------------------------------------------------------
    /** The layer name a WFS layer endpoint asks for (its fixed typeNames). */
    function typeNameOf(ep) { const p = (ep.params || []).find((x) => x.name === 'typeNames'); return p && p.default ? String(p.default) : ''; }
    const prefixOf = (name) => (name.includes(':') ? name.slice(0, name.indexOf(':') + 1) : '');
    /**
     * The NGP layers of a WFS source, recognised by name with any workspace prefix: the plan layer and the provision layers of
     * the same workspace, or null when the service has no such pair.
     * @param {any} connector @returns {{plan: any, provisions: any[]}|null}
     */
    function wfsLayers(connector) {
      if (!(connector && connector.family && connector.family.kind === 'wfs')) return null;
      const eps = geodata.layerEndpoints(connector);
      const planEp = eps.find((e) => PLAN_LAYER.test(typeNameOf(e)));
      if (!planEp) return null;
      const pre = prefixOf(typeNameOf(planEp));
      const provisions = eps.filter((e) => PROVISION_LAYER.test(typeNameOf(e)) && prefixOf(typeNameOf(e)) === pre);
      return provisions.length ? { plan: planEp, provisions } : null;
    }
    /** True for Lantmäteriet's NGP API for detailed plans (the preset's `family.plans`, or a copy at the same address). */
    function isApi(connector) {
      return !!(connector && connector.family && connector.family.kind === 'ogcapi' && (connector.family.plans === 'ngp' || /\/geodatakatalog\/sokning\/v1\/detaljplan\//i.test(str(connector.baseUrl))));
    }
    /** 'wfs', 'api' or '' for a source: whether, and how, it offers whole detailed plans. @param {any} connector */
    function kindOf(connector) { return isApi(connector) ? 'api' : wfsLayers(connector) ? 'wfs' : ''; }
    /** The municipalities of the NGP API: its collections (one per municipality) as {id, name}. @param {any} connector */
    function municipalities(connector) {
      return geodata.layerEndpoints(connector).map((e) => { const m = /^\/collections\/([^/]+)\/items$/.exec(str(e.path)); return m ? { id: decodeURIComponent(m[1]), name: e.name } : null; }).filter(Boolean);
    }

    // ---- WFS filters ----------------------------------------------------------------------------------------------
    /** The filter languages to try, the likelier first: CQL on GeoServer, FES 2.0 elsewhere. @param {any} connector */
    const filterModes = (connector) => (/\/geoserver\//i.test(str(connector.baseUrl)) ? ['cql', 'fes'] : ['fes', 'cql']);
    const xmlEscape = (s) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    /**
     * A search term as a LIKE pattern: the service's own wildcards in it match one character, and so does every letter outside
     * ASCII, since a GeoServer ILIKE missed plans by å, ä and ö (Sundsvall, 2026-11-28: '%prästbordet%' found none, '%pr_stbordet%' four).
     */
    function likeTerm(text, single, escape) {
      return Array.from(str(text).trim()).map((ch) => (/[^\x20-\x7e]/.test(ch) ? single : escape(ch))).join('');
    }
    /** The filter values for a search by name or designation, in a filter language, or {} for every plan. */
    function searchValues(mode, text) {
      if (!str(text).trim()) return {};
      if (mode === 'cql') {
        const term = likeTerm(text, '_', (ch) => (ch === '%' || ch === '_' ? '_' : ch === "'" ? "''" : ch));
        return { CQL_FILTER: `"detaljplan.namn" ILIKE '%${term}%' OR "detaljplan.beteckning" ILIKE '%${term}%'` };
      }
      const term = xmlEscape(likeTerm(text, '_', (ch) => (ch === '*' || ch === '_' || ch === '!' ? '!' + ch : ch)));
      const like = (field) => `<fes:PropertyIsLike wildCard="*" singleChar="_" escapeChar="!" matchCase="false"><fes:ValueReference>${field}</fes:ValueReference><fes:Literal>*${term}*</fes:Literal></fes:PropertyIsLike>`;
      return { FILTER: `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:Or>${like('detaljplan.namn')}${like('detaljplan.beteckning')}</fes:Or></fes:Filter>` };
    }
    /** The filter values for one plan's identity. */
    function idValues(mode, id) {
      if (mode === 'cql') return { CQL_FILTER: `"${ID}"='${str(id).replace(/'/g, "''")}'` };
      return { FILTER: `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>${ID}</fes:ValueReference><fes:Literal>${xmlEscape(id)}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>` };
    }
    /** A layer endpoint that also takes an FES filter, with a page size of `size` when given (the stored source is not changed). */
    function withFilter(ep, size) {
      const params = (ep.params || []).filter((p) => p.name !== 'FILTER').concat([{ name: 'FILTER', in: 'query', type: 'string', hidden: true }]);
      return Object.assign({}, ep, { params }, size ? { pagination: Object.assign({}, ep.pagination || {}, { size }) } : {});
    }
    /** A refusal of the filter (or of a field the layer lacks): 400 or an OGC exception report, as opposed to a failure of the service. */
    const refused = (err) => !!err && !aborted(err) && (err.status === 400 || err.kind === 'service');
    /** The rows of a table as objects by column. */
    function records(table) { return table.rows.map((r) => { const o = {}; table.columns.forEach((c, i) => { o[c] = r[i]; }); return o; }); }
    /** A search hit from the flattened plan row. */
    const hitOf = (o) => ({ id: str(o[ID]), beteckning: str(o['detaljplan.beteckning']), namn: str(o['detaljplan.namn']), status: str(o['detaljplan.status']), datum: dateOf(o['detaljplan.datumLagakraft'] || o['detaljplan.datumPaborjat'] || o['detaljplan.datumStatusforandring']) });
    /** Whether a hit matches the term as the filter would (wildcards and letters outside ASCII any character): a service that ignored the filter does not. */
    function matches(hit, text) {
      const pattern = Array.from(str(text).trim().toLowerCase()).map((ch) => (/[^\x20-\x7e]/.test(ch) || ch === '%' || ch === '_' || ch === '*' ? '.' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
      return new RegExp(pattern, 'i').test(`${hit.namn} ${hit.beteckning}`);
    }

    // ---- WFS: search and fetch -------------------------------------------------------------------------------------
    /**
     * Plans whose name or designation holds `text` (every plan, the first ones, without it), from the plan layer of a WFS. The filter
     * language that the service takes is tried first; a refused or ignored filter tries the other.
     * @param {any} connector @param {string} text @param {{signal?: AbortSignal}} [options]
     * @returns {Promise<{plans: Array<{id: string, beteckning: string, namn: string, status: string, datum: string}>, total: number, mode: string}>}
     */
    async function searchWfs(connector, text, options = {}) {
      const layers = wfsLayers(connector);
      if (!layers) throw new Error(t('plan.whole.err.layers'));
      const ep = withFilter(layers.plan, LIST);
      for (const mode of filterModes(connector)) {
        let table;
        try { table = await runner.fetchTable(connector, ep, searchValues(mode, text), { firstPageOnly: true, signal: options.signal }); }
        catch (err) { if (refused(err) && str(text).trim()) continue; throw err; }
        const seen = new Set();
        const plans = records(table).map(hitOf).filter((p) => p.id && !seen.has(p.id) && seen.add(p.id));
        if (str(text).trim() && plans.some((p) => !matches(p, text))) continue;
        const first = table.meta && table.meta.firstData;
        const total = first && Number(first.numberMatched) >= plans.length ? Number(first.numberMatched) : plans.length;
        return { plans, total, mode };
      }
      throw new Error(t('plan.whole.err.filter'));
    }
    /** Two tables as one, with the columns of both. */
    function union(acc, table) {
      const index = new Map(acc.columns.map((c, i) => [c, i]));
      for (const c of table.columns) if (!index.has(c)) { index.set(c, acc.columns.length); acc.columns.push(c); }
      for (const r of acc.rows) while (r.length < acc.columns.length) r.push(null);
      for (const r of table.rows) { const out = new Array(acc.columns.length).fill(null); table.columns.forEach((c, j) => { out[index.get(c)] = r[j]; }); acc.rows.push(out); }
      return acc;
    }
    /**
     * One plan from every NGP layer of a WFS, filtered on its identity: the plan layer first (where the filter language is settled),
     * then each provision layer. A layer that refuses the filter (its schema lacks the field) is skipped and named.
     * @param {any} connector @param {string} id the plan's objektidentitet
     * @param {{mode?: string, signal?: AbortSignal, onProgress?: (p: {layer: string, index: number, total: number}) => void}} [options]
     * @returns {Promise<{columns: string[], rows: any[][], skipped: string[], layers: string[]}>}
     */
    async function fetchWfs(connector, id, options = {}) {
      const layers = wfsLayers(connector);
      if (!layers) throw new Error(t('plan.whole.err.layers'));
      const all = [layers.plan].concat(layers.provisions);
      const own = (table) => { const at = table.columns.indexOf(ID); return at < 0 ? [] : table.rows.filter((r) => str(r[at]).trim().toLowerCase() === str(id).trim().toLowerCase()); };
      const progress = (ep, index) => { if (options.onProgress) options.onProgress({ layer: ep.name || typeNameOf(ep), index, total: all.length }); };
      const acc = { columns: [], rows: [] }; const skipped = []; const used = [];
      progress(layers.plan, 0);
      const modes = options.mode ? [options.mode].concat(filterModes(connector).filter((m) => m !== options.mode)) : filterModes(connector);
      let mode = '';
      for (const m of modes) {
        let table;
        // One page: the plan layer has a row per plan, and a service that ignores the filter is found out without reading it all.
        try { table = await runner.fetchTable(connector, withFilter(layers.plan, LIST), idValues(m, id), { firstPageOnly: true, signal: options.signal }); }
        catch (err) { if (refused(err)) continue; throw err; }
        // Rows of other plans: the service ignored the filter.
        if (own(table).length < table.rows.length) continue;
        mode = m; union(acc, table); used.push(typeNameOf(layers.plan));
        break;
      }
      if (!mode) throw new Error(t('plan.whole.err.filter'));
      for (let i = 0; i < layers.provisions.length; i++) {
        const ep = layers.provisions[i];
        progress(ep, i + 1);
        try {
          const table = await runner.fetchTable(connector, withFilter(ep), idValues(mode, id), { signal: options.signal });
          union(acc, { columns: table.columns, rows: own(table) });
          used.push(typeNameOf(ep));
        } catch (err) { if (refused(err)) { skipped.push(ep.name || typeNameOf(ep)); continue; } throw err; }
      }
      if (!acc.rows.length) throw new Error(t('plan.fetch.none'));
      return { columns: acc.columns, rows: acc.rows, skipped, layers: used };
    }

    // ---- the NGP API -----------------------------------------------------------------------------------------------
    const base = (connector) => str(connector.baseUrl).replace(/\/+$/, '');
    const searchUrl = (connector) => `${base(connector)}/search?crs=${encodeURIComponent(CRS84)}`;
    /** The national specification's file of a plan among an item's assets (role detaljplan), or ''. */
    function assetOf(item) {
      const assets = item && item.assets && typeof item.assets === 'object' ? Object.values(item.assets) : [];
      const a = assets.find((x) => x && x.href && ((Array.isArray(x.roles) && x.roles.includes('detaljplan')) || /vnd\.lm\.detaljplan/i.test(str(x.type))));
      return a ? str(a.href) : '';
    }
    /** A search hit from an NGP plan item. */
    function apiHit(item) {
      const dp = (item.properties && item.properties.detaljplan) || {};
      return { id: str(dp.objektidentitet || item.id), beteckning: str(dp.beteckning), namn: str(dp.namn), status: str(dp.status), datum: dateOf(dp.datumLagakraft || dp.datumPaborjat || dp.datumStatusforandring), collection: str(item.collection), asset: assetOf(item) };
    }
    /**
     * Plans of the NGP API whose name or designation holds `text` (the query extension's case-insensitive `contains`, one search
     * per field), in one municipality or all; with no text, the first plans of the municipality.
     * @param {any} connector @param {string} text @param {{collection?: string, signal?: AbortSignal}} [options]
     */
    async function searchApi(connector, text, options = {}) {
      const term = str(text).trim();
      if (!term && !options.collection) throw new Error(t('plan.whole.need'));
      const body = (field) => Object.assign({ limit: LIST, query: Object.assign({ 'feature.typ': { eq: 'detaljplan' } }, field ? { [field]: { contains: term } } : {}) }, options.collection ? { collections: [options.collection] } : {});
      const answers = await Promise.all((term ? ['detaljplan.namn', 'detaljplan.beteckning'] : ['']).map((f) => common.postJson(connector, searchUrl(connector), body(f), { signal: options.signal })));
      const seen = new Set(); const plans = []; let more = false;
      for (const a of answers) {
        const feats = a && Array.isArray(a.features) ? a.features : [];
        if (feats.length >= LIST || (Array.isArray(a && a.links) && a.links.some((l) => l && l.rel === 'next'))) more = true;
        for (const f of feats) { const hit = apiHit(f); if (hit.id && !seen.has(hit.id)) { seen.add(hit.id); plans.push(hit); } }
      }
      return { plans, total: plans.length, more };
    }
    /** The coordinates of a feature collection are projected (SWEREF 99 TM, the API's own system) rather than degrees. */
    const projected = (features) => features.some((f) => { const c = f && f.geometry ? geo.firstCoordinate(f.geometry.coordinates || []) : null; return !!c && (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90); });
    /**
     * One plan from the NGP API as a file the plan importer reads: the national specification's file (the plan's `detaljplan` asset,
     * fetched with the key only from the API's own host) when there is one, and otherwise, or when it cannot be read, the plan's
     * reference objects through /search, page by page.
     * @param {any} connector @param {{id: string, collection?: string, asset?: string, beteckning?: string, namn?: string}} hit
     * @param {{signal?: AbortSignal, onProgress?: (p: {step: 'asset'|'objects', page?: number}) => void}} [options]
     * @returns {Promise<{file: File, via: 'asset'|'objects', fallback: string}>} fallback: why the asset was not used, or ''
     */
    async function fetchApi(connector, hit, options = {}) {
      const progress = (p) => { if (options.onProgress) options.onProgress(p); };
      const label = str(hit.beteckning || hit.namn || hit.id).replace(/[\\/:*?"<>|]+/g, '-');
      let fallback = '';
      if (hit.asset && hostOf(hit.asset) === hostOf(base(connector))) {
        progress({ step: 'asset' });
        try {
          const data = await common.getJson(connector, hit.asset, { signal: options.signal, accept: 'application/vnd.lm.detaljplan.v4+json, application/geo+json;q=0.9, application/json;q=0.8' });
          if (!plan.detect(data)) throw new Error(t('plan.err.format'));
          return { file: new File([JSON.stringify(data)], label + '.json', { type: 'application/json' }), via: 'asset', fallback };
        } catch (err) {
          if (aborted(err)) throw err;
          fallback = (err && err.message) || String(err);
        }
      }
      const features = [];
      let url = searchUrl(connector); let method = 'POST';
      let body = Object.assign({ limit: 1000, query: { [ID]: { eq: hit.id } } }, hit.collection ? { collections: [hit.collection] } : {});
      for (let page = 1; url && page <= 50; page++) {
        progress({ step: 'objects', page });
        const data = method === 'GET' ? await common.getJson(connector, url, { signal: options.signal }) : await common.postJson(connector, url, body, { signal: options.signal });
        const feats = data && Array.isArray(data.features) ? data.features : [];
        features.push(...feats.filter((f) => f && f.properties && f.properties.detaljplan && str(f.properties.detaljplan.objektidentitet) === hit.id));
        // The next page (STAC: a link with its method and body), on the API's own host only, so that the key goes nowhere else.
        const next = (Array.isArray(data && data.links) ? data.links : []).find((l) => l && l.rel === 'next' && l.href && hostOf(l.href) === hostOf(base(connector)));
        if (!next || !feats.length) break;
        url = String(next.href);
        method = str(next.method).toUpperCase() === 'GET' ? 'GET' : 'POST';
        if (next.body && typeof next.body === 'object') body = next.merge ? Object.assign({}, body, next.body) : next.body;
      }
      if (!features.length) throw new Error(t('plan.fetch.none'));
      const collection = Object.assign({ type: 'FeatureCollection' }, projected(features) ? { crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::3006' } } } : {}, { features });
      return { file: new File([JSON.stringify(collection)], label + '.json', { type: 'application/geo+json' }), via: 'objects', fallback };
    }

    // ---- keeping the plan ----------------------------------------------------------------------------------------
    /**
     * Fetch one plan and keep it as a plan dataset: from the layers of a WFS (the flattened rows through importTable) or from the API
     * (the file through importFile, which keeps it as the original). @param {any} connector @param {any} hit a search hit
     * @param {{mode?: string, signal?: AbortSignal, onProgress?: Function}} [options]
     * @returns {Promise<{meta: any, skipped: string[], fallback: string}>}
     */
    async function fetchPlan(connector, hit, options = {}) {
      const source = { kind: 'api', connector: connector.id, connectorName: connector.name, planId: hit.id, fetchedAt: new Date().toISOString() };
      if (isApi(connector)) {
        const got = await fetchApi(connector, hit, /** @type {any} */ (options));
        const meta = await detaljplanImp.importFile(got.file, { source: Object.assign(source, { via: got.via }) }, null);
        return { meta, skipped: [], fallback: got.fallback };
      }
      const got = await fetchWfs(connector, hit.id, /** @type {any} */ (options));
      const meta = await detaljplanImp.importTable(got.columns, got.rows, hit.namn || hit.beteckning || null, Object.assign(source, { layers: got.layers }));
      return { meta, skipped: got.skipped, fallback: '' };
    }
    /** Search a source for plans: the WFS's plan layer or the API. @param {any} connector @param {string} text @param {{collection?: string, signal?: AbortSignal}} [options] */
    function search(connector, text, options = {}) { return isApi(connector) ? searchApi(connector, text, options) : searchWfs(connector, text, options); }

    return { LIST, CRS84, kindOf, wfsLayers, isApi, municipalities, filterModes, searchValues, idValues, search, searchWfs, searchApi, fetchWfs, fetchApi, fetchPlan, assetOf };
  });
})();
