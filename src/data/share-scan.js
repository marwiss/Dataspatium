// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What a dataset would bring along if it left the app, all of it: not only the columns of the main table but running text,
 * side tables (graph edges, model properties), original files, pictures with their positions, comments and authors in the
 * metadata. inspect() lists it with the choices that make sense, copy() applies the choices to a copy. The dataset itself
 * is never changed. A pseudonymised copy holds no change log, because the log can hold the original values, and it is
 * vacuumed, because SQLite otherwise keeps old values in free pages of the file.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/share-scan', ['data/datasets', 'data/rules', 'data/exif'], (datasets, rules, exif) => {
    const PHONE_NAME = /telefon|mobil(?!itet)|phone|puhelin|s[ií]mi|^tlf$|\btel\b|^gsm$|farsimi|handy/i;
    const FILES = '_files';
    /** Tables with their own part, or without free text. */
    const NOT_SCANNED = new Set(['data', '_columns', '_meta', '_log', FILES, '_layout', '_comments']);
    const POSITION_COLUMNS = ['lon', 'lat', 'altitud'];
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const number = (res) => (res[0] && res[0].values[0] ? Number(res[0].values[0][0]) || 0 : 0);

    async function tablesIn(engine) {
      const r = await engine.exec("select name from sqlite_master where type = 'table'");
      return r[0] ? r[0].values.map((row) => String(row[0])) : [];
    }
    async function textColumnsOf(engine, table) {
      const r = await engine.exec(`pragma table_info(${q(table)})`);
      return (r[0] ? r[0].values : []).filter((row) => /text|char|clob|^$/i.test(String(row[2] || ''))).map((row) => String(row[1]));
    }

    /**
     * Columns that look like personal data as a whole. Collected rows also say who collected them and where.
     * @param {string} id @returns {Promise<Array<{column: string, kind: string, detail?: string}>>}
     */
    async function columnFindings(id) {
      const out = [];
      const columns = await datasets.columns(id);
      const seen = (name) => out.some((f) => f.column === name);
      for (const r of await rules.suggest(id)) {
        if (r.type === 'identifier' && !seen(r.column)) out.push({ column: r.column, kind: 'identifier', detail: r.kind });
        else if (r.type === 'format' && r.format === 'email' && !seen(r.column)) out.push({ column: r.column, kind: 'email' });
      }
      for (const c of columns) {
        if (c.type === 'text' && PHONE_NAME.test(c.name) && !seen(c.name)) out.push({ column: c.name, kind: 'phone' });
      }
      const handle = await datasets.ensureOpen(id);
      if (handle.meta.field) {
        const positions = handle.meta.field.form && handle.meta.field.form.positionColumns ? Object.values(handle.meta.field.form.positionColumns) : ['lat', 'lon'];
        for (const c of columns) {
          if (c.name === 'insamlad_av' && !seen(c.name)) out.push({ column: c.name, kind: 'collector' });
          else if (positions.includes(c.name) && !seen(c.name)) out.push({ column: c.name, kind: 'position' });
        }
      }
      return out;
    }

    /** The choices a column finding offers, and the one to start from. */
    function columnChoices(finding) {
      if (finding.kind === 'position') return { choices: ['keep', 'drop'], start: 'keep' };
      return { choices: ['keep', 'hash', 'drop'], start: finding.kind === 'identifier' || finding.kind === 'collector' ? 'hash' : 'keep' };
    }

    /**
     * Everything that would follow the dataset out of the app.
     * @param {string} id
     * @returns {Promise<{columns: any[], parts: Array<{id: string, kind: string, count: number, column?: string, table?: string, names?: string[], choices: string[], start: string}>}>}
     */
    async function inspect(id) {
      const handle = await datasets.ensureOpen(id);
      const engine = handle.engine;
      const columns = await columnFindings(id);
      const parts = [];
      const flagged = new Set(columns.map((f) => f.column));
      for (const c of handle.columns) {
        if (c.type !== 'text' || flagged.has(c.name)) continue;
        const n = number(await engine.exec(`select count(*) from data where dm_has_personal(${q(c.name)}) = 1`));
        if (n) parts.push({ id: 'text:' + c.name, kind: 'text', column: c.name, count: n, choices: ['keep', 'mask', 'drop'], start: 'mask' });
      }
      const tables = await tablesIn(engine);
      for (const table of tables) {
        if (NOT_SCANNED.has(table)) continue;
        const cols = await textColumnsOf(engine, table);
        if (!cols.length) continue;
        const hit = cols.map((c) => `dm_has_personal(${q(c)}) = 1`).join(' or ');
        const n = number(await engine.exec(`select count(*) from ${q(table)} where ${hit}`));
        if (n) parts.push({ id: 'side:' + table, kind: 'side', table, count: n, choices: ['keep', 'mask', 'remove'], start: 'mask' });
      }
      if (handle.meta.kind === 'images') {
        const names = handle.columns.map((c) => c.name);
        if (names.includes('lon')) {
          const n = number(await engine.exec('select count(*) from data where lon is not null'));
          if (n) parts.push({ id: 'positions', kind: 'positions', count: n, choices: ['keep', 'remove'], start: 'remove' });
        }
        const pictures = tables.includes(FILES) ? number(await engine.exec(`select count(distinct name) from ${FILES}`)) : 0;
        if (pictures) parts.push({ id: 'pictures', kind: 'pictures', count: pictures, choices: ['keep', 'remove'], start: 'keep' });
      } else if (tables.includes(FILES)) {
        const r = await engine.exec(`select distinct name from ${FILES} where kind = 'original'`);
        const names = r[0] ? r[0].values.map((row) => String(row[0])) : [];
        // A cleaned table beside the untouched original would be no protection at all.
        if (names.length) parts.push({ id: 'originals', kind: 'originals', count: names.length, names: names.slice(0, 5), choices: ['keep', 'remove'], start: columns.length || parts.length ? 'remove' : 'keep' });
      }
      if (tables.includes('_comments')) {
        const r = await engine.exec('select count(*), group_concat(distinct author), sum(dm_has_personal(text)) from _comments');
        const row = r[0] ? r[0].values[0] : [0, '', 0];
        if (Number(row[0])) parts.push({ id: 'comments', kind: 'comments', count: Number(row[0]), names: String(row[1] || '').split(',').filter(Boolean).slice(0, 5), choices: ['keep', 'remove'], start: Number(row[2]) ? 'remove' : 'keep' });
      }
      const authors = Array.from(new Set((handle.meta.documents || []).map((d) => d.author).filter(Boolean)));
      if (authors.length) parts.push({ id: 'authors', kind: 'authors', count: authors.length, names: authors.slice(0, 5), choices: ['keep', 'remove'], start: 'remove' });
      return { columns, parts };
    }

    /** Whether a set of choices changes anything in the copy. */
    function changes(tr) {
      if (!tr) return false;
      return !!((tr.drop || []).length || (tr.hash || []).length || (tr.mask || []).length || Object.keys(tr.side || {}).length || tr.originals || tr.pictures || tr.positions || tr.comments || tr.authors);
    }

    async function metaValue(engine, key) {
      const r = await engine.exec('select value from _meta where key = ?', [key]);
      if (!r[0] || !r[0].values.length) return null;
      try { return JSON.parse(String(r[0].values[0][0])); } catch (_err) { return null; }
    }
    async function setMeta(engine, key, value) {
      await engine.run('insert or replace into _meta (key, value) values (?, ?)', [key, JSON.stringify(value)]);
    }

    /** Metadata removed from the pictures that keep their bytes (scaled copies were drawn anew and hold none). */
    async function stripPictures(engine) {
      const ids = await engine.exec(`select rowid from ${FILES} where kind = 'preview'`);
      for (const row of (ids[0] ? ids[0].values : [])) {
        const r = await engine.exec(`select bytes from ${FILES} where rowid = ?`, [row[0]]);
        const bytes = r[0] ? r[0].values[0][0] : null;
        if (!bytes) continue;
        const clean = exif.strip(bytes);
        if (clean.byteLength !== bytes.byteLength) await engine.run(`update ${FILES} set bytes = ?, size = ? where rowid = ?`, [clean, clean.byteLength, row[0]]);
      }
    }

    /** The choices outside the columns of the main table, on the engine of the copy. */
    async function applyParts(engine, tr) {
      const tables = await tablesIn(engine);
      for (const name of tr.mask || []) await engine.run(`update data set ${q(name)} = dm_mask_personal(${q(name)}) where dm_has_personal(${q(name)}) = 1`);
      for (const [table, choice] of Object.entries(tr.side || {})) {
        if (!tables.includes(table)) continue;
        if (choice === 'remove') { await engine.run(`delete from ${q(table)}`); continue; }
        for (const c of await textColumnsOf(engine, table)) await engine.run(`update ${q(table)} set ${q(c)} = dm_mask_personal(${q(c)}) where dm_has_personal(${q(c)}) = 1`);
      }
      if (tables.includes(FILES) && (tr.originals || tr.pictures)) await engine.run(`delete from ${FILES}`);
      if (tr.positions) {
        const r = await engine.exec('pragma table_info(data)');
        const present = (r[0] ? r[0].values : []).map((row) => String(row[1]));
        const clear = POSITION_COLUMNS.filter((c) => present.includes(c));
        if (clear.length) await engine.run(`update data set ${clear.map((c) => `${q(c)} = null`).join(', ')}`);
        if (tables.includes(FILES) && !tr.pictures) await stripPictures(engine);
      }
      if (tr.comments && tables.includes('_comments')) await engine.run('delete from _comments');
      if (tr.authors) {
        const documents = await metaValue(engine, 'documents');
        if (Array.isArray(documents)) await setMeta(engine, 'documents', documents.map((d) => Object.assign({}, d, { author: null })));
      }
      // The log and the rules can hold the values that were just removed; who delivered what is not for others either.
      const changed = (tr.drop || []).concat(tr.hash || [], tr.mask || []);
      await engine.run('delete from _log');
      const list = await metaValue(engine, 'rules');
      if (Array.isArray(list)) await setMeta(engine, 'rules', list.filter((rule) => ![rule.column, rule.column2].concat(rule.columns || []).some((c) => changed.includes(c))));
      const field = await metaValue(engine, 'field');
      if (field && field.imports) await setMeta(engine, 'field', Object.assign({}, field, { imports: [] }));
    }

    /**
     * The bytes that leave the app. Without choices this is the dataset as it is, vacuumed, so that rows deleted earlier
     * do not follow in the free pages of the file.
     * @param {string} id @param {any} [tr] from the review @returns {Promise<Uint8Array>}
     */
    async function copy(id, tr = {}) {
      return datasets.exportBytesTransformed(id, Object.assign({}, tr, { after: changes(tr) ? (engine) => applyParts(engine, tr) : null }));
    }

    return { PHONE_NAME, columnFindings, columnChoices, inspect, changes, copy };
  });
})();
