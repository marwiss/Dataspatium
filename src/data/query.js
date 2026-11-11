// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * SQL across datasets. Every dataset has a short name (datasets.shortNameFrom); a statement run against the
 * selected dataset may mention other datasets by their short names. Those datasets are mounted in the selected
 * dataset's engine (their SQLite bytes become extra databases in the worker's file system) and ATTACHed, with
 * a view per short name, so that `select * from befolkning b join kommuner k on ...` just works. The selected
 * dataset is reachable both as `data` and as its own short name. Modifying statements still target the
 * selected dataset only; the views on other datasets are read-only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/query', ['data/datasets'], (datasets) => {
    const LIMIT = 5000;
    const MAX_OTHERS = 9; // SQLite allows ten attached databases by default

    /** Identifier-like tokens of a statement, lower case, with comments and string literals removed. */
    function identifiers(sql) {
      const stripped = String(sql || '').replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/'(?:[^']|'')*'/g, ' ');
      const out = new Set();
      const re = /"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
      let m;
      while ((m = re.exec(stripped))) out.add((m[1] || m[2] || m[3] || m[4]).toLowerCase());
      return out;
    }

    /**
     * Datasets a statement refers to by short name, apart from the primary one, and whether the primary
     * dataset's own short name is used.
     */
    async function referenced(primaryId, sql) {
      const list = await datasets.list();
      const primary = list.find((d) => d.id === primaryId) || null;
      const ids = identifiers(sql);
      const others = list.filter((d) => d.shortName && d.id !== primaryId && ids.has(d.shortName));
      return { primary, others, self: primary && primary.shortName && ids.has(primary.shortName) ? primary.shortName : null };
    }

    /**
     * Mount the datasets a statement mentions in the primary dataset's engine and attach them in its current
     * connection. Mounted copies are refreshed when the other dataset has been saved since.
     * @returns {Promise<{handle: any, names: string[], self: string|null, others: any[]}>}
     */
    async function attach(primaryId, sql) {
      const handle = await datasets.ensureOpen(primaryId);
      const { others, self } = await referenced(primaryId, sql);
      if (others.length > MAX_OTHERS) throw new Error(D.t('query.err.toomany', { n: MAX_OTHERS }));
      const mounted = others.length ? await handle.engine.mounted() : {};
      for (const d of others) {
        const ver = await datasets.version(d.id);
        if (mounted[d.shortName] === ver) continue;
        const bytes = await datasets.bytesOf(d.id);
        await handle.engine.mount(d.shortName, bytes, ver);
      }
      const names = others.map((d) => d.shortName);
      await handle.engine.attach(names, self);
      return { handle, names, self, others };
    }

    /**
     * Run a read-only statement with short names resolved. Rows are capped at `limit`; `truncated` tells
     * whether more existed. PRAGMA and EXPLAIN cannot be wrapped and run as they are. `readOnly` lets the worker run only one
     * statement that reads, with the database locked against writes (for statements no person wrote, such as an AI's).
     * @returns {Promise<{columns: string[], values: any[][], truncated: boolean, others: string[]}>}
     */
    async function select(primaryId, sql, options = {}) {
      const limit = options.limit || LIMIT;
      const { handle, names, self } = await attach(primaryId, sql);
      let res;
      const readOnly = !!options.readOnly;
      try { res = await handle.engine.query(`select * from (${sql}) limit ${limit + 1}`, undefined, names, self, readOnly); }
      catch (_wrapErr) { res = await handle.engine.query(sql, undefined, names, self, readOnly); }
      const r = res[0] || { columns: [], values: [] };
      return { columns: r.columns, values: r.values.slice(0, limit), truncated: r.values.length > limit, others: names };
    }

    /** The result of a statement as a new dataset, with short names resolved first. */
    async function createDataset(primaryId, sql, options) {
      await attach(primaryId, sql);
      return datasets.createFromQuery(primaryId, sql, options);
    }

    return { identifiers, referenced, attach, select, createDataset, LIMIT, MAX_OTHERS };
  });
})();
