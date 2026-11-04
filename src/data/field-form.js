// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Field forms: what a phone needs to collect rows offline, and the packages that carry a form out and the rows back.
 * This module runs on both the computer and the phone (the mobile profile of src/boot.js), so it knows nothing of
 * datasets: the computer compiles a dataset's columns and rules into a form (data/field-collect), and the phone only
 * reads that. Rules arrive as the same SQL conditions the computer runs, and the phone evaluates them in its own
 * SQLite on a small table, so a value is judged the same way in both places.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/field-form', ['platform/storage/zip'], (zip) => {
    const FORM_KIND = 'field-form';
    const ROWS_KIND = 'field-rows';
    const MANIFEST = 'manifest.json';
    const PHOTO_DIR = 'foton/';
    const ID_COLUMN = 'falt_id';
    /** One package of rows and photos at most; a larger collection travels as several packages. */
    const MAX_PACKAGE_BYTES = 150 * 1024 * 1024;
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const isEmpty = (v) => v === null || v === undefined || v === '';

    /** An id that stays unique across phones, so that a row sent twice is recognised on the computer. */
    function newId(prefix) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      return prefix + '_' + Date.now().toString(36) + Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
    }
    const positionNames = (form) => form.positionColumns || { lat: 'lat', lon: 'lon' };
    const safeName = (name) => String(name || 'formular').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'formular';

    /**
     * The columns a collection adds beside the form's own fields.
     * @param {any} form @returns {Array<{name: string, type: string}>}
     */
    function systemColumns(form) {
      const out = [{ name: ID_COLUMN, type: 'text' }];
      if (form.position !== 'off') {
        const p = positionNames(form);
        out.push({ name: p.lat, type: 'number' }, { name: p.lon, type: 'number' }, { name: 'noggrannhet_m', type: 'number' });
      }
      if (form.photo !== 'off') out.push({ name: 'foto', type: 'text' });
      out.push({ name: 'insamlad', type: 'datetime' }, { name: 'insamlad_av', type: 'text' });
      return out;
    }

    /**
     * A raw value from an input as the column's type.
     * @param {any} field @param {any} raw @returns {{value: any, error?: string}}
     */
    function coerce(field, raw) {
      if (field.type === 'boolean') {
        if (raw === true || raw === 'true') return { value: true };
        if (raw === false || raw === 'false') return { value: false };
        return { value: null };
      }
      let text = typeof raw === 'string' ? raw.trim() : raw;
      if (isEmpty(text)) return { value: null };
      if (field.options && field.options.length) {
        const hit = field.options.find((o) => String(o.value) === String(text));
        if (!hit) return { value: text, error: D.t('field.err.option') };
        text = hit.value;
      }
      switch (field.type) {
        case 'integer':
        case 'number': {
          const n = typeof text === 'number' ? text : Number(String(text).replace(/[\s ]/g, '').replace(',', '.'));
          if (!Number.isFinite(n)) return { value: text, error: D.t('field.err.number') };
          if (field.type === 'integer' && !Number.isInteger(n)) return { value: text, error: D.t('field.err.integer') };
          return { value: n };
        }
        case 'date': {
          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text));
          const when = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
          if (!when || when.getUTCDate() !== Number(m[3])) return { value: text, error: D.t('field.err.date') };
          return { value: String(text) };
        }
        case 'datetime':
          if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(String(text)) || Number.isNaN(Date.parse(String(text)))) return { value: text, error: D.t('field.err.date') };
          return { value: String(text) };
        default:
          return { value: text };
      }
    }

    /**
     * Check a row against the form: types, required fields, position and photos. Rules are checked by createChecker.
     * @param {any} form @param {Record<string, any>} raw @param {{position?: any, photos?: number}} [extras]
     * @returns {{ok: boolean, values: Record<string, any>, errors: Record<string, string>}}
     */
    function validate(form, raw, extras = {}) {
      const values = {}; const errors = {};
      for (const f of form.fields) {
        const r = coerce(f, raw[f.name]);
        values[f.name] = r.value;
        if (r.error) errors[f.name] = r.error;
        else if (f.required && isEmpty(r.value)) errors[f.name] = D.t('field.err.required');
      }
      if (form.position === 'required' && !extras.position) errors.__position = D.t('field.err.position');
      if (form.photo === 'required' && !extras.photos) errors.__photo = D.t('field.err.photo');
      return { ok: !Object.keys(errors).length, values, errors };
    }

    /**
     * Rules checked in a SQLite of the device's own, so that a rule means the same as on the computer. The rows already
     * collected are in the table, which gives a uniqueness rule something to compare with. A rule that cannot run here
     * (free SQL that needs more than the form's columns) is left to the computer.
     * @param {any} engine a started and opened SQLite engine @param {any} form
     */
    async function createChecker(engine, form) {
      const names = Array.from(new Set(form.fields.map((f) => f.name).concat(systemColumns(form).map((c) => c.name))));
      await engine.run(`create table if not exists data (${names.map(q).join(', ')})`);
      const toCell = (v) => (v === true ? 1 : v === false ? 0 : v === undefined ? null : v);
      const rowOf = (values) => names.map((n) => toCell(values[n]));
      return {
        /**
         * @param {Record<string, any>} values the row being checked @param {Array<Record<string, any>>} [others] rows already collected
         * @returns {Promise<any[]>} the rules the row breaks
         */
        async check(values, others = []) {
          await engine.run('delete from data');
          if (others.length) await engine.insertRows('data', names, others.map(rowOf));
          await engine.insertRows('data', names, [rowOf(values)]);
          const last = (await engine.exec('select max(rowid) from data'))[0].values[0][0];
          const broken = [];
          for (const rule of form.rules || []) {
            try {
              const res = await engine.exec(`select 1 from data where rowid = ${Number(last)} and (${rule.sql})`, rule.params || []);
              if (res[0] && res[0].values.length) broken.push(rule);
            } catch (err) { D.log('field', 'rule left to the computer', rule.text, err); }
          }
          return broken;
        },
      };
    }

    /** @param {any} form @returns {Promise<{blob: Blob, name: string}>} */
    async function packForm(form) {
      const blob = await zip.createZip({ [MANIFEST]: JSON.stringify({ kind: FORM_KIND, version: 1, name: form.title, form }) }, { level: 6 });
      return { blob, name: `${safeName(form.title)}.formular.zip` };
    }

    /** What a package of rows says about its form; the rules stay behind, the computer has its own. */
    function formSummary(form) {
      return Object.assign({}, form, { rules: undefined, fields: form.fields.map((f) => ({ name: f.name, type: f.type, label: f.label })) });
    }

    /**
     * Rows divided so that no package exceeds the limit; the photos of a row stay with it.
     * @param {any[]} rows @param {number} [limit] @returns {any[][]}
     */
    function batches(rows, limit = MAX_PACKAGE_BYTES) {
      const out = []; let current = []; let size = 0;
      for (const row of rows) {
        const bytes = (row.photos || []).reduce((sum, p) => sum + (p.size || 0), 0) + 4096;
        if (current.length && size + bytes > limit) { out.push(current); current = []; size = 0; }
        current.push(row); size += bytes;
      }
      if (current.length) out.push(current);
      return out;
    }

    /**
     * One package of rows and their photos. Photos are already compressed, so nothing is gained by compressing again.
     * @param {any} form @param {any[]} rows @param {(name: string) => Promise<ArrayBuffer|Uint8Array|null>} readPhoto
     * @param {{device?: string, part?: number, parts?: number}} [options] @returns {Promise<{blob: Blob, name: string}>}
     */
    async function packRows(form, rows, readPhoto, options = {}) {
      /** @type {Record<string, any>} */
      const files = {};
      const kept = [];
      for (const row of rows) {
        const photos = [];
        for (const p of row.photos || []) {
          const bytes = await readPhoto(p.name);
          if (!bytes) continue;
          files[PHOTO_DIR + p.name] = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
          photos.push(p);
        }
        kept.push(Object.assign({}, row, { photos }));
      }
      const sentAt = new Date().toISOString();
      files[MANIFEST] = JSON.stringify({ kind: ROWS_KIND, version: 1, name: form.title, formId: form.id, datasetId: form.datasetId, datasetName: form.datasetName, device: options.device || '', sentAt, form: formSummary(form), rows: kept });
      const blob = await zip.createZip(files, { level: 0 });
      const stamp = sentAt.slice(0, 16).replace(/[:T]/g, '-');
      const part = options.parts > 1 ? `-${options.part}` : '';
      return { blob, name: `${safeName(form.title)}-${stamp}${part}.insamling.zip` };
    }

    /**
     * Read a package of either kind; anything else gives null.
     * @param {Blob|ArrayBuffer|Uint8Array} source
     * @returns {Promise<{kind: string, manifest: any, entries: Record<string, Uint8Array>}|null>}
     */
    async function readPackage(source) {
      const entries = await zip.readZip(source);
      return fromEntries(entries);
    }
    /** @param {Record<string, Uint8Array>} entries @param {any} [manifest] already read */
    function fromEntries(entries, manifest) {
      let m = manifest;
      if (!m) {
        if (!entries[MANIFEST]) return null;
        try { m = JSON.parse(zip.text(entries[MANIFEST])); } catch (_err) { return null; }
      }
      if (!m || (m.kind !== FORM_KIND && m.kind !== ROWS_KIND)) return null;
      return { kind: m.kind, manifest: m, entries };
    }

    /**
     * The rows of a package as a table for datasets.appendRows.
     * @param {any} manifest @param {any[]} [rows] @returns {{columns: string[], rows: any[][]}}
     */
    function toTable(manifest, rows = manifest.rows) {
      const form = manifest.form;
      const p = positionNames(form);
      const columns = Array.from(new Set(form.fields.map((f) => f.name).concat(systemColumns(form).map((c) => c.name))));
      const cell = (row, name) => {
        if (name === ID_COLUMN) return row.id;
        if (form.position !== 'off' && name === p.lat) return row.position ? row.position.lat : null;
        if (form.position !== 'off' && name === p.lon) return row.position ? row.position.lon : null;
        if (name === 'noggrannhet_m') return row.position && typeof row.position.accuracy === 'number' ? Math.round(row.position.accuracy) : null;
        if (name === 'foto') return (row.photos || []).map((x) => x.name).join('; ') || null;
        if (name === 'insamlad') return row.createdAt || null;
        if (name === 'insamlad_av') return manifest.device || null;
        const v = row.values ? row.values[name] : null;
        return v === undefined ? null : v;
      };
      return { columns, rows: rows.map((row) => columns.map((name) => cell(row, name))) };
    }

    return { FORM_KIND, ROWS_KIND, MANIFEST, PHOTO_DIR, ID_COLUMN, MAX_PACKAGE_BYTES, newId, positionNames, systemColumns, coerce, validate, createChecker, packForm, packRows, batches, readPackage, fromEntries, toTable };
  });
})();
