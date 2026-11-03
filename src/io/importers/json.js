// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * JSON importer: arrays of objects (nested objects flattened to dotted keys), arrays of arrays,
 * objects wrapping an array (optionally addressed with a dotted path), and NDJSON (one object per
 * line). GeoJSON FeatureCollections become one row per feature with properties flattened.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/json', ['data/encoding'], (encoding) => {
    const EXT = /\.(json|ndjson|jsonl|geojson)$/i;

    /** @param {File} file */
    function detect(file) { return EXT.test(file.name) || /json/.test(file.type || ''); }

    function parseJsonText(text) {
      const trimmed = text.replace(/^﻿/, '').trim();
      if (!trimmed) throw new Error(D.t('import.err.empty'));
      try { return JSON.parse(trimmed); } catch (err) {
        // NDJSON: one JSON value per line
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length > 1 && lines.every((l) => /^[\[{]/.test(l.trim()))) return lines.map((l) => JSON.parse(l));
        throw err;
      }
    }

    function resolvePath(data, path) {
      let node = data;
      for (const part of String(path || '').split('.').filter(Boolean)) node = node === null || node === undefined ? undefined : node[part];
      return node;
    }

    function toRecords(data, path) {
      let node = path ? resolvePath(data, path) : data;
      if (node && typeof node === 'object' && !Array.isArray(node) && node.type === 'FeatureCollection' && Array.isArray(node.features)) {
        return node.features.map((f) => Object.assign({}, f.properties || {}, { geometry_type: f.geometry ? f.geometry.type : null, geometry: f.geometry ? JSON.stringify(f.geometry) : null }));
      }
      if (Array.isArray(node)) return node;
      if (node && typeof node === 'object') {
        for (const value of Object.values(node)) if (Array.isArray(value)) return value;
        return [node];
      }
      return [];
    }

    function flatten(obj, prefix, out) {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? prefix + '.' + k : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
        else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
      }
      return out;
    }

    /** JSON-stat datasets (SCB, Eurostat downloads) become one row per cell via api/jsonstat. */
    function isJsonStat(data) {
      return !!data && typeof data === 'object' && !Array.isArray(data) && ((data.class === 'dataset' && data.dimension) || (data.class === 'collection' && data.link) || (data.version === '2.0' && data.dimension));
    }
    function jsonStatTable(data) {
      const t = D.require('api/jsonstat').toTable(data);
      return { columns: t.columns, rows: t.rows };
    }

    function tabulate(records) {
      if (!records.length) return { columns: [], rows: [] };
      if (records.every((r) => Array.isArray(r))) {
        const width = records.reduce((m, r) => Math.max(m, r.length), 0);
        const columns = Array.from({ length: width }, (_, i) => `kolumn_${i + 1}`);
        return { columns, rows: records.map((r) => columns.map((_, i) => (r[i] === undefined ? null : r[i]))) };
      }
      const flat = records.map((r) => (r && typeof r === 'object' && !Array.isArray(r) ? flatten(r, '', {}) : { value: Array.isArray(r) ? JSON.stringify(r) : r }));
      const columns = [];
      const seen = new Set();
      for (const r of flat) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
      const rows = flat.map((r) => columns.map((c) => (r[c] === undefined ? null : r[c])));
      return { columns, rows };
    }

    /** @param {File} file @param {{encoding?: string, path?: string, previewRows?: number}} [options] */
    async function preview(file, options = {}) {
      const read = await encoding.readText(file, { encoding: options.encoding });
      const data = parseJsonText(read.text);
      const stat = !options.path && isJsonStat(data);
      const { columns, rows } = stat ? jsonStatTable(data) : tabulate(toRecords(data, options.path));
      const suggestions = !Array.isArray(data) && data && typeof data === 'object' && !stat ? Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k]) => k) : [];
      return { kind: 'json', columns, dataRows: rows.slice(0, options.previewRows || 100), totalRows: rows.length, header: true, encoding: read.encoding, pathSuggestions: suggestions, jsonStat: stat };
    }

    /** @param {File} file @param {{encoding?: string, path?: string}} options */
    async function parse(file, options) {
      const read = await encoding.readText(file, { encoding: options.encoding });
      const data = parseJsonText(read.text);
      const stat = !options.path && isJsonStat(data);
      const { columns, rows } = stat ? jsonStatTable(data) : tabulate(toRecords(data, options.path));
      return { columns, rows, meta: { format: stat ? 'json-stat' : 'json', path: options.path || '', encoding: read.encoding } };
    }

    return { id: 'json', detect, preview, parse, tabulate, toRecords, parseJsonText, isJsonStat };
  });
})();
