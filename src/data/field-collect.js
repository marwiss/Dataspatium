// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Field collection on the computer: a dataset's columns and rules become a form for the phone (kept in `_meta.field`), and
 * the rows that come back are added as a new version. Photos become an image collection with the rows' positions, so they
 * can be drawn on a map beside the table's own position columns. A package can arrive twice; rows are recognised by their
 * id. Only what the user has seen in the editor leaves the computer: columns, labels, choices and rules, never rows.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/field-collect', ['data/datasets', 'data/rules', 'data/field-form', 'data/operations', 'data/dataset-files', 'data/types', 'io/importers/images', 'viz/leaflet'],
    (datasets, rules, fieldForm, ops, dsFiles, types, images, leaflet) => {
      const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      const SYSTEM = new Set([fieldForm.ID_COLUMN, 'noggrannhet_m', 'foto', 'insamlad', 'insamlad_av']);
      const LONG_TEXT = /anteckn|kommentar|beskriv|notering|note|comment|descr/i;
      const KNOWN_TYPES = ['text', 'integer', 'number', 'date', 'datetime', 'boolean'];
      /** Rules about the whole table cannot say anything about one row; a reference rule needs another dataset. */
      const ON_COMPUTER = new Set(['completeness', 'reference']);

      const splitValues = (text) => String(text || '').split(/[\n;,]/).map((s) => s.trim()).filter(Boolean);
      const labelOf = (option) => (option.label === undefined || option.label === null || option.label === '' ? String(option.value) : String(option.label));

      /** The field a column gives by default; value labels become the choices. */
      function fieldFromColumn(column) {
        const labels = column.valueLabels && Array.isArray(column.valueLabels.labels) ? column.valueLabels.labels : [];
        return {
          name: column.name, label: column.label || column.name, description: column.description || '',
          type: KNOWN_TYPES.includes(column.type) ? column.type : 'text',
          include: true, required: false, sticky: false, long: column.type === 'text' && LONG_TEXT.test(column.name),
          options: labels.map((pair) => ({ value: pair[0], label: pair[1] })),
        };
      }
      function collectable(columns) {
        const geometry = leaflet.geometryColumn(columns);
        const coordinates = leaflet.coordinateColumns(columns);
        const position = coordinates ? [coordinates.lat, coordinates.lon] : [];
        return columns.filter((c) => !SYSTEM.has(c.name) && c.name !== geometry && !position.includes(c.name));
      }
      /** @param {any} handle @returns {any} the form a dataset starts from */
      function defaultForm(handle) {
        const coordinates = leaflet.coordinateColumns(handle.columns);
        return {
          id: fieldForm.newId('form'), datasetId: handle.meta.id, datasetName: handle.meta.name, title: handle.meta.name, instructions: '',
          position: 'optional', photo: 'optional', maxPhotos: 5, photoMaxSide: 2048,
          positionColumns: coordinates ? { lat: coordinates.lat, lon: coordinates.lon } : { lat: 'lat', lon: 'lon' },
          fields: collectable(handle.columns).map(fieldFromColumn),
        };
      }
      /**
       * The dataset's form, kept in step with its columns: a new column joins the form switched off, a removed one leaves.
       * @param {string} id @returns {Promise<any>}
       */
      async function formFor(id) {
        const handle = await datasets.ensureOpen(id);
        const stored = handle.meta.field && handle.meta.field.form;
        if (!stored) return defaultForm(handle);
        const columns = collectable(handle.columns);
        const known = new Map(stored.fields.map((f) => [f.name, f]));
        const fields = columns.map((c) => Object.assign({}, known.get(c.name) || Object.assign(fieldFromColumn(c), { include: false }), { type: KNOWN_TYPES.includes(c.type) ? c.type : 'text' }));
        return Object.assign({}, stored, { datasetId: id, datasetName: handle.meta.name, fields });
      }
      async function persist(handle) {
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['field', JSON.stringify(handle.meta.field || {})]);
        await datasets.save(handle.meta.id);
      }
      /** @param {string} id @param {any} form */
      async function save(id, form) {
        const handle = await datasets.ensureOpen(id);
        handle.meta.field = Object.assign({}, handle.meta.field, { form: Object.assign({}, form, { datasetId: id, datasetName: handle.meta.name }) });
        await persist(handle);
        return handle.meta.field.form;
      }
      const ruleColumns = (rule) => Array.from(new Set([rule.column, rule.column2].concat(rule.columns || []).filter(Boolean)));

      /**
       * What the phone gets: the chosen fields and the rules it can check itself. The rest is listed in `leftToComputer`.
       * @param {string} id @param {any} form @returns {Promise<any>}
       */
      async function compile(id, form) {
        const handle = await datasets.ensureOpen(id);
        const fields = form.fields.filter((f) => f.include !== false).map((f) => {
          const copy = Object.assign({}, f);
          delete copy.include;
          copy.options = (f.options || []).map((o) => ({ value: o.value, label: labelOf(o) }));
          return copy;
        });
        const base = Object.assign({}, form, { datasetId: id, datasetName: handle.meta.name, fields, compiledAt: new Date().toISOString() });
        const names = new Set(fields.map((f) => f.name).concat(fieldForm.systemColumns(base).map((c) => c.name)));
        const compiled = []; const left = [];
        for (const rule of await rules.list(id)) {
          const text = rules.describe(rule);
          const columns = ruleColumns(rule);
          if (ON_COMPUTER.has(rule.type) || columns.some((c) => !names.has(c))) { left.push(text); continue; }
          const field = fields.find((f) => f.name === rule.column);
          if (rule.type === 'notnull') { if (field) field.required = true; continue; }
          if (rule.type === 'inset' && field && !field.options.length) field.options = splitValues(rule.values).map((v) => ({ value: v, label: v }));
          const v = rules.violation(rule, handle.columns, await rules.prepare(rule, handle));
          compiled.push({ id: rule.id, text, columns, sql: v.sql, params: v.params });
        }
        return Object.assign(base, { rules: compiled, leftToComputer: left });
      }
      /** @param {string} id @param {any} form @returns {Promise<{blob: Blob, name: string, form: any}>} */
      async function packageForm(id, form) {
        await save(id, form);
        const compiled = await compile(id, form);
        return Object.assign(await fieldForm.packForm(compiled), { form: compiled });
      }

      /**
       * An empty dataset to collect into, from one column per line: "name" or "name: type". Type names are the UI's or the
       * internal ones, so "antal: heltal" and "antal: integer" mean the same.
       * @param {string} name @param {string} text @returns {Promise<any>}
       */
      async function createEmpty(name, text) {
        const names = new Map(KNOWN_TYPES.flatMap((type) => [[type, type], [D.t('type.' + type).toLowerCase(), type]]));
        const columns = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
          const at = line.lastIndexOf(':');
          const typeName = at > 0 ? line.slice(at + 1).trim().toLowerCase() : '';
          const known = at > 0 && names.has(typeName);
          return { name: known ? line.slice(0, at).trim() : line, type: known ? names.get(typeName) : 'text' };
        });
        if (!columns.length) throw new Error(D.t('field.err.nocolumns'));
        const cleaned = types.cleanColumnNames(columns.map((c) => c.name));
        return datasets.create({ name, columns: columns.map((c, i) => ({ name: cleaned[i], type: c.type })), rows: [] });
      }

      /**
       * What a package of rows would do: which dataset it belongs to, which rows are new, what they bring.
       * @param {{manifest: any, entries: Record<string, Uint8Array>}} pack @returns {Promise<any>}
       */
      async function plan(pack) {
        const m = pack.manifest;
        let target = await datasets.get(m.datasetId);
        if (!target) target = (await datasets.list()).find((d) => d.name === m.datasetName) || null;
        const seen = new Set();
        let missing = [];
        if (target) {
          const handle = await datasets.ensureOpen(target.id);
          if (handle.columns.some((c) => c.name === fieldForm.ID_COLUMN)) {
            const res = await handle.engine.exec(`select ${q(fieldForm.ID_COLUMN)} from data where ${q(fieldForm.ID_COLUMN)} is not null`);
            for (const row of (res[0] ? res[0].values : [])) seen.add(String(row[0]));
          }
          missing = m.form.fields.filter((f) => !handle.columns.some((c) => c.name === f.name)).map((f) => f.name);
        }
        const rows = (m.rows || []).filter((r) => !seen.has(String(r.id)));
        const photos = rows.flatMap((r) => (r.photos || []).filter((p) => pack.entries[fieldForm.PHOTO_DIR + p.name]));
        return {
          pack, manifest: m, target, rows, missing, photos, duplicates: (m.rows || []).length - rows.length,
          positions: rows.filter((r) => r.position).length, flagged: rows.filter((r) => r.warnings && r.warnings.length).length,
        };
      }

      /** The columns a package needs that the dataset does not have yet. */
      async function ensureColumns(handle, form) {
        const wanted = form.fields.map((f) => ({ name: f.name, type: f.type, label: f.label })).concat(fieldForm.systemColumns(form).map((c) => ({ name: c.name, type: c.type, label: c.name })));
        const ctx = ops.makeContext(handle.engine, handle.columns);
        for (const col of wanted) {
          if (ctx.column(col.name)) continue;
          await handle.engine.run(`alter table data add column ${q(col.name)} ${types.sqlType(col.type)}`);
          ctx.addColumn(col);
        }
        if (ctx.columnsChanged) await datasets.writeColumns(handle, ctx.columns);
      }

      /** One row per photo in the format of an image collection, with the position and time of the row it belongs to. */
      async function photoEntry(row, photo, bytes, device) {
        const file = new File([bytes], photo.name, { type: photo.type || 'image/jpeg' });
        const img = await images.readImage(file);
        const at = (name) => images.COLUMNS.findIndex((c) => c.name === name);
        const out = img.row.slice();
        if (out[at('datum')] === null || out[at('datum')] === undefined) out[at('datum')] = row.createdAt || null;
        if (!out[at('kamera')] && device) out[at('kamera')] = device;
        if (row.position && (out[at('lon')] === null || out[at('lon')] === undefined)) { out[at('lon')] = row.position.lon; out[at('lat')] = row.position.lat; }
        return {
          row: out,
          files: [{ name: photo.name, kind: 'preview', type: img.preview.type, bytes: img.preview.bytes }, { name: photo.name, kind: 'thumb', type: img.thumb.type, bytes: img.thumb.bytes }],
        };
      }
      /** The rows' photos as a new image collection, or added to the one earlier deliveries made. */
      async function addPhotos(result, handle, onProgress) {
        const { pack, manifest, rows } = result;
        const device = manifest.device || '';
        const collected = []; const skipped = [];
        let index = 0; const total = result.photos.length;
        for (const row of rows) {
          for (const photo of row.photos || []) {
            const bytes = pack.entries[fieldForm.PHOTO_DIR + photo.name];
            if (!bytes) continue;
            if (onProgress) onProgress({ index: index++, total });
            try { collected.push(await photoEntry(row, photo, bytes, device)); }
            catch (err) { D.log('field', 'photo not read', photo.name, err); skipped.push(photo.name); }
          }
        }
        if (!collected.length) return { id: (handle.meta.field && handle.meta.field.imagesId) || null, count: 0, skipped };
        const names = images.COLUMNS.map((c) => c.name);
        const existing = handle.meta.field && handle.meta.field.imagesId ? await datasets.get(handle.meta.field.imagesId) : null;
        if (existing) {
          const album = await datasets.ensureOpen(existing.id);
          await dsFiles.put(album, collected.flatMap((c) => c.files));
          await album.engine.insertRows('data', names, collected.map((c) => c.row));
          album.meta.images = Object.assign({}, album.meta.images, { count: ((album.meta.images && album.meta.images.count) || 0) + collected.length });
          await album.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['images', JSON.stringify(album.meta.images)]);
          await datasets.refreshCounts(album);
          await datasets.save(existing.id);
          return { id: existing.id, count: collected.length, skipped };
        }
        const created = await dsFiles.createDataset({
          name: D.t('field.images.name', { name: handle.meta.name }), kind: 'images', columns: images.COLUMNS, rows: collected.map((c) => c.row),
          files: collected.flatMap((c) => c.files), source: { kind: 'field', format: 'images', formId: manifest.formId, device },
          meta: { images: { count: collected.length, preview: images.PREVIEW, thumb: images.THUMB, skipped } },
          importOptions: { format: 'images' },
        });
        return { id: created.id, count: collected.length, skipped };
      }

      /**
       * Add the new rows of a package: a version of the table as it was, the rows, the photos, and the rules run on the result.
       * @param {any} result from plan() @param {{name?: string, onProgress?: Function}} [options]
       * @returns {Promise<{datasetId: string, rows: number, skipped: number, photos: number, photosSkipped: string[], imagesId: string|null, broken: number}>}
       */
      async function apply(result, options = {}) {
        const m = result.manifest;
        let id = result.target ? result.target.id : null;
        if (!id) {
          const columns = m.form.fields.map((f) => ({ name: f.name, type: f.type, label: f.label })).concat(fieldForm.systemColumns(m.form));
          const created = await datasets.create({ name: options.name || m.datasetName || m.name, columns, rows: [] });
          id = created.id;
        }
        const handle = await datasets.ensureOpen(id);
        if (handle.meta.rowCount > 0) await datasets.snapshot(id, D.t('field.version.before', { device: m.device || '', date: D.require('ui/i18n').formatDateTime(new Date().toISOString()) }));
        await ensureColumns(handle, m.form);
        const added = await datasets.appendRows(id, fieldForm.toTable(m, result.rows), { mode: 'append', dedupeKeys: [fieldForm.ID_COLUMN], decimal: 'point' });
        const album = await addPhotos(result, handle, options.onProgress);
        const previous = handle.meta.field || {};
        handle.meta.field = Object.assign({}, previous, {
          imagesId: album.id || previous.imagesId || null,
          imports: (previous.imports || []).concat([{ at: new Date().toISOString(), device: m.device || '', rows: added.rows, skipped: added.skipped + result.duplicates, photos: album.count }]).slice(-50),
        });
        await persist(handle);
        await datasets.appendLog(handle, 'field', { device: m.device || '', rows: added.rows, photos: album.count, flagged: result.flagged });
        const list = await rules.list(id);
        const check = list.length ? await rules.run(id, list) : null;
        await datasets.save(id);
        return { datasetId: id, rows: added.rows, skipped: added.skipped + result.duplicates, photos: album.count, photosSkipped: album.skipped, imagesId: album.id, broken: check ? check.summary.failed : 0 };
      }

      return { defaultForm, formFor, save, compile, packageForm, createEmpty, plan, apply, fieldFromColumn };
    });
})();
