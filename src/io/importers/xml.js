// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * XML importer: one row per repeated element (detected automatically or chosen with `recordTag`),
 * attributes as `@name` columns, child elements as columns, nested elements with dotted names.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/xml', ['data/encoding'], (encoding) => {
    const EXT = /\.xml$/i;
    function detect(file) { return EXT.test(file.name) || /xml/.test(file.type || ''); }

    function parseDoc(text) {
      const doc = new DOMParser().parseFromString(text.replace(/^﻿/, ''), 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('Filen är inte giltig XML.');
      return doc;
    }
    /** Candidate record tags: element names that repeat under one parent, most frequent first. */
    function candidates(doc) {
      const counts = new Map(); const rich = new Set();
      const walk = (el, depth) => {
        const byName = new Map();
        for (const child of Array.from(el.children)) {
          byName.set(child.localName, (byName.get(child.localName) || 0) + 1);
          if (child.children.length) rich.add(child.localName);
        }
        for (const [name, n] of byName) if (n >= 2) counts.set(name, Math.max(counts.get(name) || 0, n));
        if (depth < 4) for (const child of Array.from(el.children)) walk(child, depth + 1);
      };
      walk(doc.documentElement, 0);
      // Record-like elements (with child elements) first, then by how often they repeat.
      const list = Array.from(counts.entries()).sort((a, b) => ((rich.has(b[0]) ? 1 : 0) - (rich.has(a[0]) ? 1 : 0)) || b[1] - a[1]).map(([name]) => name);
      if (!list.length && doc.documentElement.children.length) list.push(doc.documentElement.children[0].localName);
      return list;
    }
    /** Attributes become columns named like elements; a clash with a child element gets a numeric suffix. */
    function put(out, key, value) {
      let k = key; let n = 2;
      while (k in out) k = key + '_' + n++;
      out[k] = value;
    }
    function flatten(el, prefix, out) {
      for (const a of Array.from(el.attributes || [])) put(out, (prefix ? prefix + '.' : '') + a.name, a.value);
      const kids = Array.from(el.children);
      if (!kids.length) { put(out, prefix || el.localName, el.textContent); return out; }
      const seen = new Map();
      for (const k of kids) {
        const n = (seen.get(k.localName) || 0) + 1; seen.set(k.localName, n);
        flatten(k, (prefix ? prefix + '.' : '') + k.localName + (n > 1 ? '_' + n : ''), out);
      }
      return out;
    }
    function tabulate(doc, tag) {
      const nodes = Array.from(doc.getElementsByTagNameNS('*', tag));
      const records = nodes.map((n) => flatten(n, '', {}));
      const columns = []; const seen = new Set();
      for (const r of records) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
      return { columns, rows: records.map((r) => columns.map((c) => (r[c] === undefined ? null : r[c]))) };
    }

    /** @param {File} file @param {{encoding?: string, recordTag?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const read = await encoding.readText(file, { encoding: options.encoding });
      const doc = parseDoc(read.text);
      const tags = candidates(doc);
      const tag = options.recordTag && tags.includes(options.recordTag) ? options.recordTag : (options.recordTag || tags[0] || doc.documentElement.localName);
      const { columns, rows } = tabulate(doc, tag);
      return { kind: 'xml', columns, dataRows: rows.slice(0, options.previewRows || 100), totalRows: rows.length, header: true, encoding: read.encoding, pathSuggestions: tags, recordTag: tag };
    }
    /** @param {File} file @param {{encoding?: string, recordTag?: string}} options */
    async function parse(file, options = {}) {
      const read = await encoding.readText(file, { encoding: options.encoding });
      const doc = parseDoc(read.text);
      const tag = options.recordTag || candidates(doc)[0] || doc.documentElement.localName;
      const { columns, rows } = tabulate(doc, tag);
      return { columns, rows, meta: { format: 'xml', recordTag: tag, encoding: read.encoding } };
    }
    return { id: 'xml', detect, preview, parse, candidates, flatten };
  });
})();
