// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What differs between a version and now, in the kind's own units: which pictures, documents, nodes, edges or elements came
 * and went. `data/kinds` says what to compare for each kind, so a new kind only adds a line there.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/version-diff', ['data/kinds'], (kinds) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const MAX_NAMES = 20;

    async function valuesIn(engine, table, column) {
      const has = await engine.exec("select count(*) from sqlite_master where type = 'table' and name = ?", [table]);
      if (!has[0] || !Number(has[0].values[0][0])) return [];
      const r = await engine.exec(`select distinct ${q(column)} from ${q(table)} where ${q(column)} is not null`);
      return r[0] ? r[0].values.map((row) => String(row[0])) : [];
    }
    /**
     * The kind's own comparison, one entry per thing it counts.
     * @param {any} meta the dataset now @param {any} now its engine @param {any} then the version's engine
     * @returns {Promise<Array<{label: string, then: number, now: number, added: string[], removed: string[], moreAdded: number, moreRemoved: number}>>}
     */
    async function compare(meta, now, then) {
      const out = [];
      for (const item of kinds.of(meta).versionDiff || []) {
        const a = await valuesIn(then, item.table, item.column);
        const b = await valuesIn(now, item.table, item.column);
        const before = new Set(a); const after = new Set(b);
        const added = b.filter((v) => !before.has(v));
        const removed = a.filter((v) => !after.has(v));
        out.push({ label: item.label, then: a.length, now: b.length, added: added.slice(0, MAX_NAMES), removed: removed.slice(0, MAX_NAMES), moreAdded: Math.max(0, added.length - MAX_NAMES), moreRemoved: Math.max(0, removed.length - MAX_NAMES) });
      }
      return out;
    }

    return { compare };
  });
})();
