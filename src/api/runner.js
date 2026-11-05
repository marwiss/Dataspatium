// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Runs an endpoint: builds the request, applies credentials and rate limits, walks through the pages,
 * parses every response and merges the rows into one table. Also turns tables into datasets, appends
 * or replaces rows of existing datasets and re-fetches a dataset from the source stored in its metadata.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/runner', ['api/connectors', 'api/request', 'api/auth', 'api/http', 'api/parsers', 'api/pagination', 'api/secrets', 'api/families/pxweb', 'api/families/socialstyrelsen', 'api/families/statbank', 'api/families/fhi', 'api/families/opencde', 'data/types', 'data/datasets', 'io/import'],
    (connectors, request, auth, http, parsers, pagination, secrets, pxweb, socialstyrelsen, statbank, fhi, opencde, types, datasets, importer) => {
      const families = { pxweb, socialstyrelsen, statbank, fhi, opencde };

      /** Union of columns by name; rows padded with null. */
      function mergeTables(acc, table) {
        if (!acc.columns.length) { acc.columns = table.columns.slice(); acc.rows = table.rows.slice(); acc.types = Object.assign({}, table.types || {}); return acc; }
        const index = new Map(acc.columns.map((c, i) => [c, i]));
        for (const c of table.columns) if (!index.has(c)) { index.set(c, acc.columns.length); acc.columns.push(c); }
        const width = acc.columns.length;
        for (let i = 0; i < acc.rows.length; i++) if (acc.rows[i].length < width) acc.rows[i] = acc.rows[i].concat(new Array(width - acc.rows[i].length).fill(null));
        const map = table.columns.map((c) => index.get(c));
        for (const r of table.rows) { const out = new Array(width).fill(null); for (let j = 0; j < map.length; j++) out[map[j]] = r[j]; acc.rows.push(out); }
        Object.assign(acc.types, table.types || {});
        return acc;
      }

      /**
       * Fetch all pages of an endpoint into one table.
       * @param {any} connector @param {any} endpoint @param {Record<string, any>} params
       * @param {{maxPages?: number, firstPageOnly?: boolean, signal?: AbortSignal, onProgress?: (info: {pages: number, rows: number, url: string}) => void}} [options]
       */
      async function fetchTable(connector, endpoint, params = {}, options = {}) {
        const spec = endpoint.response || { format: 'json' };
        const pag = endpoint.pagination || { type: 'none' };
        const maxPages = options.firstPageOnly ? 1 : (options.maxPages || pag.maxPages || 100);
        const values = request.normalizeParams(endpoint, params);
        let req = request.build(connector, endpoint, values);
        const runtimeOptions = req.options;
        const state = pagination.start(pag, req);
        const acc = { columns: [], rows: [], types: {}, meta: {} };
        const requests = [];
        let pages = 0; let truncated = false; let firstData = null; let lastMeta = null;
        while (req) {
          const authed = await auth.apply(connector, req, { signal: options.signal });
          const res = await http.request(Object.assign({}, authed, { rateKey: connector.id, rateLimit: connector.rateLimit, signal: options.signal }));
          pages++;
          if (!res.ok) throw http.httpError(res, connector.name);
          const parsed = await parsers.parse(res.text, spec, { options: runtimeOptions });
          if (firstData === null) firstData = parsed.data;
          lastMeta = parsed.meta;
          mergeTables(acc, parsed);
          requests.push({ url: secrets.mask(req.url, connector.id), status: res.status, ms: Math.round(res.ms), rows: parsed.rows.length });
          if (options.onProgress) options.onProgress({ pages, rows: acc.rows.length, url: secrets.mask(req.url, connector.id) });
          const nextReq = pagination.next(pag, state, { request: req, response: res, data: parsed.data, table: parsed });
          if (nextReq && pages >= maxPages) { truncated = true; break; }
          req = nextReq;
        }
        return { columns: acc.columns, rows: acc.rows, types: acc.types, meta: Object.assign({}, lastMeta || {}, { pages, requests, truncated, firstData }), values };
      }

      /**
       * Create a dataset from a table. Column types are inferred (point decimals), with explicit type
       * hints from the parser (codes stay text) taking precedence.
       */
      async function toDataset(table, options = {}) {
        const decimal = options.decimal || 'point';
        const { columns, rows } = typedTable(table, decimal);
        return datasets.create({ name: options.name || D.t('api.fetched.name'), description: options.description || '', columns, rows, source: options.source || { kind: 'api' }, importOptions: { decimal } });
      }
      /** Columns with inferred types and typed rows of an API table; type hints from the parser win. */
      function typedTable(table, decimal = 'point') {
        const cleaned = types.cleanColumnNames(table.columns);
        const inferred = types.inferColumns(cleaned, table.rows, { decimal, sample: 2000 });
        const specs = inferred.map((c, i) => {
          const hint = table.types && table.types[table.columns[i]];
          return Object.assign({ include: true, label: table.columns[i] }, c, { name: cleaned[i], type: hint || c.type, decimal });
        });
        return importer.materialize({ columns: table.columns, rows: table.rows }, specs, { decimal });
      }

      /** @type {Set<(id: string, table: any) => any>} */
      const fetchedListeners = new Set();
      /** Tells a listener whenever a dataset has been updated from its source (with the table it was read from). */
      function onFetched(fn) { fetchedListeners.add(fn); return () => fetchedListeners.delete(fn); }

      /**
       * Update an API dataset with one click: fetch it again, rebuild its table from the new rows and replay
       * its recipe, so that cleaned, renamed and computed columns come back. Name, metadata, rules and log are
       * kept. Nothing changes when the fetch or a recipe step fails.
       * @param {string} id
       * @param {{fetch?: (source: any) => Promise<any>, signal?: AbortSignal}} [options] fetch is injectable for tests
       * @returns {Promise<{rows: number, steps: number}>}
       */
      async function refreshDataset(id, options = {}) {
        const meta = await datasets.get(id);
        const source = meta && meta.source;
        if (!source || (source.kind !== 'api' && source.kind !== 'bridge' && !(source.kind === 'file' && source.linked))) throw new Error(D.t('api.err.nosource'));
        const recipes = D.require('data/recipes');
        const ops = D.require('data/operations');
        const steps = await recipes.steps(id);
        // Steps with a secret (the salt of a pseudonymisation) cannot be replayed without it.
        const secret = steps.find((s) => ((ops.get(s.op) || {}).params || []).some((p) => p.secret && s.params && s.params[p.name] === '***'));
        if (secret) throw new Error(D.t('api.refresh.secret', { step: secret.description }));
        const table = await (options.fetch || refetch)(source, Object.assign({}, options, { datasetId: id }));
        const { columns, rows } = typedTable(table, (meta.importOptions && meta.importOptions.decimal) || 'point');
        const before = await datasets.rebuild(id, { columns, rows, source: Object.assign({}, source, { fetchedAt: new Date().toISOString(), rows: rows.length }, table.file ? { size: table.file.size, lastModified: table.file.lastModified ? new Date(table.file.lastModified).toISOString() : null } : {}) });
        let done = 0;
        try {
          for (const step of steps) { await recipes.apply(id, step.op, step.params, { noUndo: true, noLog: true }); done++; }
        } catch (err) {
          await datasets.replaceBytes(id, before, null);
          throw new Error(D.t('api.refresh.replay.failed', { step: steps[done].description, message: (err && err.message) || String(err) }));
        }
        const handle = await datasets.ensureOpen(id);
        await datasets.appendLog(handle, 'refresh', { source: { kind: source.kind, connectorName: source.connectorName || source.label || source.fileName, endpointName: source.endpointName }, rows: handle.meta.rowCount, steps: steps.length });
        await datasets.save(id);
        for (const fn of Array.from(fetchedListeners)) { try { await fn(id, table); } catch (err) { console.error('[runner] listener failed', err); } }
        return { rows: handle.meta.rowCount, steps: steps.length };
      }

      /** Append to or replace the rows of an existing dataset. */
      async function intoDataset(id, table, options = {}) {
        return datasets.appendRows(id, { columns: table.columns, rows: table.rows }, { mode: options.mode || 'append', dedupeKeys: options.dedupeKeys, source: options.source, decimal: options.decimal || 'point' });
      }

      /** Source descriptor stored in dataset metadata for later re-fetching. */
      function describeSource(connector, endpoint, values, result) {
        return {
          kind: 'api', connectorId: connector.id, connectorName: connector.name, publisher: connector.publisher || null,
          endpointId: endpoint.id, endpointName: endpoint.name, params: values,
          url: result && result.meta && result.meta.requests && result.meta.requests[0] ? result.meta.requests[0].url : null,
          pages: result && result.meta ? result.meta.pages : null, rows: result ? result.rows.length : null,
          truncated: !!(result && result.meta && result.meta.truncated), fetchedAt: new Date().toISOString(),
          license: connector.license ? connector.license.name : null,
        };
      }

      /** Re-run the fetch recorded in a dataset's source. Returns a table. */
      /**
       * Fetch every API-sourced dataset again, in turn, replacing its rows (a saved fetch job run by hand).
       * @param {{fetch?: (source: any) => Promise<any>, mode?: string, signal?: AbortSignal, onProgress?: Function}} [options] fetch is injectable for tests
       * @returns {Promise<Array<{id: string, name: string, ok: boolean, rows?: number, error?: string}>>}
       */
      async function refreshAll(options = {}) {
        const list = (await datasets.list()).filter((d) => d.source && (d.source.kind === 'api' || d.source.kind === 'bridge'));
        const results = [];
        for (const ds of list) {
          if (options.signal && options.signal.aborted) break;
          try {
            const res = await refreshDataset(ds.id, options);
            results.push({ id: ds.id, name: ds.name, ok: true, rows: res.rows, steps: res.steps });
          } catch (err) { results.push({ id: ds.id, name: ds.name, ok: false, error: (err && err.message) || String(err) }); }
          if (options.onProgress) options.onProgress({ done: results.length, total: list.length, name: ds.name });
        }
        return results;
      }

      async function refetch(source, options = {}) {
        // Datasets from the local database bridge are fetched again by api/bridge (same table or SQL, secrets from the session).
        if (source && source.kind === 'bridge') return D.require('api/bridge').refetch(source, options);
        // A linked file (File System Access) is parsed again by data/linked with the dataset's import options.
        if (source && source.kind === 'file' && source.linked) return D.require('data/linked').refetch(source, options);
        if (!source || source.kind !== 'api') throw new Error(D.t('api.err.nosource'));
        const connector = await connectors.get(source.connectorId);
        if (!connector) throw new Error(D.t('api.err.connector.gone', { name: source.connectorName || source.connectorId }));
        if (source.family) {
          const fam = families[source.family];
          if (!fam) throw new Error(D.t('api.err.family', { family: source.family }));
          return fam.refetch(connector, source, options);
        }
        const endpoint = (connector.endpoints || []).find((e) => e.id === source.endpointId);
        if (!endpoint) throw new Error(D.t('api.err.endpoint.gone', { endpoint: source.endpointId, name: connector.name }));
        return fetchTable(connector, endpoint, source.params || {}, options);
      }

      /**
       * Options for a parameter with `optionsFrom`: runs the referenced endpoint (all pages) and maps
       * value/label paths. Cached per connector, endpoint and dependent values.
       */
      const optionCache = new Map();
      async function optionsFor(connector, param, values = {}) {
        const spec = param.optionsFrom;
        const endpoint = (connector.endpoints || []).find((e) => e.id === spec.endpoint);
        if (!endpoint) return [];
        const dep = {};
        for (const [k, tpl] of Object.entries(spec.params || {})) dep[k] = request.substitute(tpl, values, null);
        const key = JSON.stringify([connector.id, spec.endpoint, dep]);
        if (optionCache.has(key)) return optionCache.get(key);
        const table = await fetchTable(connector, endpoint, dep, { maxPages: 20 });
        const vi = table.columns.indexOf(spec.value); const li = spec.label ? table.columns.indexOf(spec.label) : -1;
        const list = vi < 0 ? [] : table.rows.map((r) => ({ value: String(r[vi]), label: li >= 0 && r[li] !== null && r[li] !== undefined ? `${r[li]} (${r[vi]})` : String(r[vi]) }));
        optionCache.set(key, list);
        return list;
      }
      function clearOptionCache() { optionCache.clear(); }

      return { fetchTable, toDataset, typedTable, intoDataset, describeSource, refetch, refreshDataset, refreshAll, onFetched, optionsFor, clearOptionCache, mergeTables, families };
    });
})();
