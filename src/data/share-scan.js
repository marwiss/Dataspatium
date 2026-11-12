// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What a dataset would bring along if it left the app, all of it: not only the columns of the main table but running text,
 * side tables (graph edges, model properties), original files, pictures with their positions, comments and authors in the
 * metadata. inspect() lists it with the choices that make sense, copy() applies the choices to a copy. The dataset itself
 * is never changed. In an IFC model the file is the model, so the review looks inside it (people, addresses, owner history,
 * the header, actors and free text) and IfcOpenShell in the app's Python cleans the copy's file, from which its tables are built
 * anew; without Python running the choice is to keep or to stop. A pseudonymised copy holds no change log, because the log can hold the original values, and it is
 * vacuumed, because SQLite otherwise keeps old values in free pages of the file.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/share-scan', ['data/datasets', 'data/rules', 'data/exif', 'data/kinds'], (datasets, rules, exif, kinds) => {
    const PHONE_NAME = /telefon|mobil(?!itet)|phone|puhelin|s[ií]mi|^tlf$|\btel\b|^gsm$|farsimi|handy/i;
    /** Columns that by their name hold who someone is: observers in species data, authors, first and last names. */
    const PERSON_NAME = /^(recordedby|reportedby|observer|observerade|observatoer|observator|rapportor|reporter|inventerare|insamlare|fotograf|photographer|author|forfattare|personnamn|firstname|lastname|fornamn|efternamn|fullname|etunimi|sukunimi|fornavn|etternavn|efternavn)$/;
    const FILES = '_files';
    /** Tables with their own part, or without free text. */
    const NOT_SCANNED = new Set(['data', '_columns', '_meta', '_log', FILES, '_layout', '_comments']);
    const POSITION_COLUMNS = ['lon', 'lat', 'altitud'];
    /** What the review finds inside an IFC model, in the order the dialog shows it (ifcParts). */
    const IFC_PARTS = ['persons', 'organizations', 'owner', 'header', 'actors', 'text'];
    /** The tables of an IFC model that are built from its file. */
    const IFC_TABLES = new Set(['_properties', '_quantities', '_entities']);
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
        else if (c.type === 'text' && PERSON_NAME.test(String(c.name).toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '')) && !seen(c.name)) out.push({ column: c.name, kind: 'person' });
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
      return { choices: ['keep', 'hash', 'drop'], start: finding.kind === 'identifier' || finding.kind === 'collector' || finding.kind === 'person' ? 'hash' : 'keep' };
    }

    /**
     * Everything that would follow the dataset out of the app.
     * @param {string} id
     * @returns {Promise<{columns: any[], parts: Array<{id: string, kind: string, count: number, column?: string, table?: string, names?: string[], choices: string[], start: string}>}>}
     */
    async function inspect(id) {
      const handle = await datasets.ensureOpen(id);
      const engine = handle.engine;
      // In an IFC model the tables show what the file holds: the file is what is reviewed, and cleaning it cleans them (ifcParts).
      const ifc = await ifcOriginal(handle);
      const derived = new Set(ifc ? D.require('data/model').IFC_COLUMNS.map((c) => c.name) : []);
      const columns = (await columnFindings(id)).filter((f) => !derived.has(f.column));
      const parts = [];
      const flagged = new Set(columns.map((f) => f.column));
      for (const c of handle.columns) {
        if (c.type !== 'text' || flagged.has(c.name) || derived.has(c.name)) continue;
        const n = number(await engine.exec(`select count(*) from data where dm_has_personal(${q(c.name)}) = 1`));
        if (n) parts.push({ id: 'text:' + c.name, kind: 'text', column: c.name, count: n, choices: ['keep', 'mask', 'drop'], start: 'mask' });
      }
      const tables = await tablesIn(engine);
      for (const table of tables) {
        if (NOT_SCANNED.has(table) || (ifc && IFC_TABLES.has(table))) continue;
        const cols = await textColumnsOf(engine, table);
        if (!cols.length) continue;
        const hit = cols.map((c) => `dm_has_personal(${q(c)}) = 1`).join(' or ');
        const n = number(await engine.exec(`select count(*) from ${q(table)} where ${hit}`));
        if (n) parts.push({ id: 'side:' + table, kind: 'side', table, count: n, choices: ['keep', 'mask', 'remove'], start: 'mask' });
      }
      if (kinds.of(handle.meta).files === 'pictures') {
        const names = handle.columns.map((c) => c.name);
        if (names.includes('lon')) {
          const n = number(await engine.exec('select count(*) from data where lon is not null'));
          if (n) parts.push({ id: 'positions', kind: 'positions', count: n, choices: ['keep', 'remove'], start: 'remove' });
        }
        const pictures = tables.includes(FILES) ? number(await engine.exec(`select count(distinct name) from ${FILES}`)) : 0;
        if (pictures) parts.push({ id: 'pictures', kind: 'pictures', count: pictures, choices: ['keep', 'remove'], start: 'keep' });
      } else if (tables.includes(FILES) && !ifc) {
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
      // The name of the file it came from, and the dataset's own name, follow in the package's list.
      const source = handle.meta.source || {};
      const labels = [handle.meta.name, source.fileName, source.name].filter((x) => typeof x === 'string' && x);
      const named = labels.length ? await engine.exec(`select ${labels.map(() => 'dm_has_personal(?)').join(' + ')}`, labels) : null;
      if (named && number(named)) parts.push({ id: 'filename', kind: 'filename', count: 1, names: labels.slice(0, 2), choices: ['mask', 'keep'], start: 'mask' });
      if (ifc) parts.push(...(await ifcParts(handle, ifc)));
      return { columns, parts };
    }

    /** Whether the app's Python runs now, so that IfcOpenShell can clean a model's copy (it starts only on the person's action). */
    function pythonRuns() {
      try { const state = D.require('data/python-bridge').bridge.state; return state === 'ready' || state === 'busy'; } catch (_err) { return false; }
    }
    /** The original file of an IFC model (not a DXF drawing, not a model drawn from its server): {name, size}, or null. */
    async function ifcOriginal(handle) {
      const meta = handle.meta || {};
      if (meta.kind !== 'model' || (meta.model && meta.model.format === 'dxf')) return null;
      if (!(await tablesIn(handle.engine)).includes(FILES)) return null;
      const r = await handle.engine.exec(`select name, size from ${FILES} where kind = 'original' order by name limit 1`);
      const row = r[0] && r[0].values[0];
      return row ? { name: String(row[0]), size: Number(row[1]) || 0 } : null;
    }
    async function originalBytes(engine) {
      const r = await engine.exec(`select bytes from ${FILES} where kind = 'original' order by name limit 1`);
      return r[0] && r[0].values[0] ? r[0].values[0][0] : null;
    }
    /**
     * What an IFC file holds that can be personal data (data/ifc-step `personal`), with the free texts confirmed by the app's own
     * detectors on the given engine (dm_has_personal), and the pieces they recognise (dm_personal_matches) for IfcOpenShell.
     * @param {any} engine @param {Uint8Array} bytes @returns {Promise<{raw: any, texts: string[], matches: string[]}>}
     */
    async function ifcScan(engine, bytes) {
      const raw = await D.require('data/ifc-step').personal(bytes);
      const texts = []; const matches = [];
      if (raw.texts.length) {
        const r = await engine.exec('select value, dm_personal_matches(value) from json_each(?) where dm_has_personal(value) = 1', [JSON.stringify(raw.texts)]);
        for (const row of r[0] ? r[0].values : []) {
          texts.push(String(row[0]));
          for (const m of JSON.parse(String(row[1] || '[]'))) if (!matches.includes(m)) matches.push(m);
        }
      }
      return { raw, texts, matches };
    }
    /** The last scans, by dataset and version: a review opens often, and the file only changes with a new version. */
    const ifcScans = new Map();
    /**
     * The parts of an IFC model's review. With Python running each can be kept, pseudonymised (codes; the same value gives the same
     * code) or removed in the copy; without it only kept, and `needsPython` says why (the dialog can start Python).
     * @param {any} handle @param {{name: string, size: number}} file
     */
    async function ifcParts(handle, file) {
      const key = `${handle.meta.id}|${handle.meta.updatedAt || ''}|${file.size}`;
      let found = ifcScans.get(key);
      if (!found) {
        const bytes = await originalBytes(handle.engine);
        if (!bytes) return [];
        found = await ifcScan(handle.engine, bytes);
        if (ifcScans.size > 8) ifcScans.clear();
        ifcScans.set(key, found);
      }
      const { raw, texts, matches } = found;
      const python = pythonRuns();
      const all = ['keep', 'hash', 'remove'];
      const part = (name, count, names, start, extra) => (count ? Object.assign({ id: 'ifc:' + name, kind: 'ifc.' + name, count, names: names.filter(Boolean).slice(0, 5),
        choices: python ? all : ['keep'], start: python ? start : 'keep', withPython: { choices: all, start }, needsPython: !python }, extra || {}) : null);
      return [
        part('persons', raw.persons.length, raw.persons.map((p) => p.label), 'hash'),
        part('organizations', raw.organizations.reduce((n, o) => n + (o.addresses || 1), 0), raw.organizations.map((o) => o.label), 'remove'),
        part('owner', raw.owner.users.length, raw.owner.users.concat(raw.owner.applications), 'hash'),
        part('header', raw.header.length, raw.header, 'remove'),
        part('actors', raw.actors.length, raw.actors.map((a) => a.label), 'hash'),
        part('text', texts.length, [], 'remove', { matches }),
      ].filter(Boolean);
    }
    /** The IFC parts to change in the copy ({persons: 'hash', ...}), or null when everything is kept. */
    function ifcScrubs(choices) {
      if (!choices) return null;
      const out = {};
      for (const k of IFC_PARTS) if (choices[k] === 'hash' || choices[k] === 'remove') out[k] = choices[k];
      return Object.keys(out).length ? out : null;
    }
    /**
     * An IFC model's file cleaned in the copy by IfcOpenShell (data/python-bridge `runIfcScrub`), before the columns are hashed or
     * dropped: the tables are built anew from the cleaned file (data/model.replaceOriginal), GlobalIds and the model's parts stay,
     * and rows chosen by rowid follow their elements. The pieces of free text come from the review, or are found again here.
     */
    async function scrubModel(engine, work, scrub) {
      if (!(await tablesIn(engine)).includes(FILES)) return;
      const r = await engine.exec(`select name, bytes from ${FILES} where kind = 'original' order by name limit 1`);
      const row = r[0] && r[0].values[0];
      if (!row || !row[1]) return;
      let matches = work.ifc && Array.isArray(work.ifc.matches) ? work.ifc.matches : null;
      if (scrub.text && !matches) matches = (await ifcScan(engine, row[1])).matches;
      const valuesOf = async (sql) => { const res = await engine.exec(sql); return res[0] ? res[0].values.map((x) => x[0]) : []; };
      const ids = work.only && work.only.length ? await valuesOf(`select id from data where rowid in (${work.only.map(Number).join(',')})`) : null;
      const res = await D.require('data/python-bridge').bridge.runIfcScrub(await engine.export(), Object.assign({}, scrub, { matches: matches || [], salt: work.salt || '' }));
      await D.require('data/model').replaceOriginal({ engine }, res.bytes, String(row[0]));
      if (ids) work.only = await valuesOf(`select rowid from data where id in (${ids.map(Number).join(',') || 'null'})`);
    }
    const randomSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

    /** Whether a set of choices changes anything in the copy. */
    function changes(tr) {
      if (!tr) return false;
      return !!(ifcScrubs(tr.ifc) || tr.filename || (tr.only || []).length || (tr.drop || []).length || (tr.hash || []).length || (tr.mask || []).length || Object.keys(tr.side || {}).length || tr.originals || tr.pictures || tr.positions || tr.comments || tr.authors);
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

    /** Only the given rows, and what belongs to them: a graph's edges between them, the files they name. */
    async function keepOnly(engine, tables, rowids) {
      await engine.run(`delete from data where rowid not in (${rowids.map(Number).join(',')})`);
      const r = await engine.exec('pragma table_info(data)');
      const names = (r[0] ? r[0].values : []).map((row) => String(row[1]));
      if (tables.includes('_edges') && names.includes('id')) await engine.run('delete from _edges where kalla not in (select id from data) or mal not in (select id from data)');
      const fileColumn = names.includes('fil') ? 'fil' : names.includes('dokument') ? 'dokument' : null;
      if (tables.includes(FILES) && fileColumn) await engine.run(`delete from ${FILES} where name not in (select ${q(fileColumn)} from data)`);
    }

    /** The choices outside the columns of the main table, on the engine of the copy. */
    async function applyParts(engine, tr) {
      const tables = await tablesIn(engine);
      if (tr.only && tr.only.length) await keepOnly(engine, tables, tr.only);
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
      if (tr.filename) {
        const source = await metaValue(engine, 'source');
        if (source && typeof source === 'object') {
          const out = Object.assign({}, source);
          for (const k of ['fileName', 'name', 'url']) if (typeof out[k] === 'string') out[k] = await maskText(out[k], engine);
          await setMeta(engine, 'source', out);
        }
      }
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

    /** A scratch database with the same functions for personal data as the datasets, for text that lives outside them. */
    let scratch = null;
    function scratchEngine() {
      if (!scratch) {
        scratch = (async () => { const e = new (D.require('engines/sqlite').SqliteEngine)(); await e.start(); await e.open(null); return e; })();
        scratch.catch(() => { scratch = null; });
      }
      return scratch;
    }
    /** Personal data in a text masked as [***], on a given engine or the scratch one. */
    async function maskText(text, engine) {
      const e = engine || await scratchEngine();
      const r = await e.exec('select dm_mask_personal(?)', [String(text)]);
      return r[0] && r[0].values[0] ? String(r[0].values[0][0]) : String(text);
    }
    /** Every string in a JSON value, in the order a walk meets them. */
    function stringsOf(value, out = []) {
      if (typeof value === 'string') out.push(value);
      else if (Array.isArray(value)) for (const v of value) stringsOf(v, out);
      else if (value && typeof value === 'object') for (const v of Object.values(value)) stringsOf(v, out);
      return out;
    }
    /** The same value with each string replaced by the next from `next()`. */
    function replaceStrings(value, next) {
      if (typeof value === 'string') return next();
      if (Array.isArray(value)) return value.map((v) => replaceStrings(v, next));
      if (value && typeof value === 'object') { const out = {}; for (const [k, v] of Object.entries(value)) out[k] = replaceStrings(v, next); return out; }
      return value;
    }
    /** How many strings of a JSON text hold personal data. */
    async function personalCount(text) {
      let data;
      try { data = JSON.parse(String(text)); } catch (_err) { return 0; }
      const list = stringsOf(data);
      if (!list.length) return 0;
      const e = await scratchEngine();
      const r = await e.exec('select coalesce(sum(dm_has_personal(value)), 0) from json_each(?)', [JSON.stringify(list)]);
      return number(r);
    }
    /**
     * A JSON text with the review's choice applied: `mask` puts [***] where personal data was, `strip` also empties a notebook's
     * saved outputs. Returns the new text.
     * @param {string} text @param {string} choice
     */
    async function cleanJson(text, choice) {
      let data = JSON.parse(String(text));
      if (choice === 'strip' && Array.isArray(data.cells)) data = Object.assign({}, data, { cells: data.cells.map((c) => Object.assign({}, c, { outputs: [] })) });
      const list = stringsOf(data);
      if (!list.length) return JSON.stringify(data, null, 2) + '\n';
      const e = await scratchEngine();
      const r = await e.exec('select dm_mask_personal(value) from json_each(?)', [JSON.stringify(list)]);
      const masked = (r[0] ? r[0].values : []).map((row) => (row[0] === null ? '' : String(row[0])));
      let i = 0;
      return JSON.stringify(replaceStrings(data, () => (i < masked.length ? masked[i++] : '')), null, 2) + '\n';
    }
    /**
     * What a bundle of these datasets carries besides them (charts, dashboards, notebooks, templates, scripts) and holds personal
     * data: one entry per file with the choices for it. Notebooks can also leave their saved outputs behind.
     * @param {string[]} ids @param {any} [include] @returns {Promise<Array<{path: string, kind: string, name: string, count: number, choices: string[], start: string}>>}
     */
    async function extras(ids, include) {
      const out = [];
      for (const item of await D.require('data/workspace').bundleExtras(ids, include)) {
        const count = await personalCount(item.text);
        if (!count) continue;
        const choices = item.kind === 'notebook' ? ['mask', 'strip', 'omit', 'keep'] : ['mask', 'omit', 'keep'];
        out.push({ path: item.path, kind: item.kind, name: item.name, count, choices, start: 'mask' });
      }
      return out;
    }

    /**
     * The bytes that leave the app. Without choices this is the dataset as it is, vacuumed, so that rows deleted earlier
     * do not follow in the free pages of the file.
     * @param {string} id @param {any} [tr] from the review @returns {Promise<Uint8Array>}
     */
    async function copy(id, tr = {}) {
      // The model's file is cleaned first, with the salt the hashed columns use, so that a name gives the same code in both.
      const scrub = ifcScrubs(tr.ifc);
      const work = scrub ? Object.assign({}, tr, { salt: tr.salt || randomSalt() }) : tr;
      return datasets.exportBytesTransformed(id, Object.assign({}, work, { before: scrub ? (engine) => scrubModel(engine, work, scrub) : null, after: changes(work) ? (engine) => applyParts(engine, work) : null }));
    }

    /**
     * A dataset in a file format, written from a copy with the given changes. The copy exists only for that moment and never
     * shows in the list.
     * @param {any} ds @param {string} format @param {any} tr @param {any} [options] @returns {Promise<{blob: Blob, filename: string}>}
     */
    async function exportCopy(ds, format, tr, options = {}) {
      const exporter = D.require('io/export');
      const fmt = exporter.FORMATS.find((f) => f.id === format) || {};
      const temp = await datasets.importBytes(await copy(ds.id, tr), { name: ds.name }, { quiet: true });
      try { return await exporter.exportDataset(temp.id, format, Object.assign({ filename: D.require('platform/files').safeName(ds.name, fmt.ext) }, options)); }
      finally { await datasets.remove(temp.id, { quiet: true }); }
    }

    /** Whether a dataset is an IFC model with its file, whose review looks inside the file. @param {string} id */
    async function isIfc(id) { return !!(await ifcOriginal(await datasets.ensureOpen(id))); }

    return { PHONE_NAME, IFC_PARTS, columnFindings, columnChoices, inspect, changes, copy, exportCopy, extras, cleanJson, personalCount, maskText, pythonRuns, isIfc };
  });
})();
