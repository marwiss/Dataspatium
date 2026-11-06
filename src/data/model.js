// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Datasets of kind "model": an IFC building model or a DXF drawing. Rows of `data` are the elements (IFC) or the
 * entities (DXF). An IFC dataset also has the long tables `_properties`, `_quantities` and `_entities`, and the facts
 * in `_meta.model`. The original file is kept in `_files`, so a model travels whole in bundles and through devices;
 * the 3D geometry is computed from it when the model is opened (engines/ifc) and the drawing of a DXF is kept as SVG.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/model', ['data/datasets', 'data/dataset-files', 'data/ifc-step', 'data/dxf'], (datasets, files, step, dxf) => {
    const IFC_COLUMNS = [{ name: 'id', type: 'integer' }, { name: 'guid', type: 'text' }, { name: 'typ', type: 'text' }, { name: 'kategori', type: 'text' }, { name: 'namn', type: 'text' }, { name: 'beskrivning', type: 'text' }, { name: 'objekttyp', type: 'text' }, { name: 'tagg', type: 'text' }, { name: 'vaning', type: 'text' }, { name: 'typnamn', type: 'text' }, { name: 'material', type: 'text' }, { name: 'klassificering', type: 'text' }, { name: 'egenskaper', type: 'text' }, { name: 'mangder', type: 'text' }];
    const DXF_COLUMNS = [{ name: 'id', type: 'integer' }, { name: 'typ', type: 'text' }, { name: 'lager', type: 'text' }, { name: 'farg', type: 'text' }, { name: 'langd', type: 'number' }, { name: 'area', type: 'number' }, { name: 'text', type: 'text' }, { name: 'x', type: 'number' }, { name: 'y', type: 'number' }];
    const PROPERTY_FIELDS = ['id', 'uppsattning', 'namn', 'varde', 'tal', 'enhet', 'kalla'];
    const QUANTITY_FIELDS = ['id', 'uppsattning', 'namn', 'varde', 'slag', 'enhet'];
    const ENTITY_FIELDS = ['id', 'typ', 'attribut'];
    const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

    const isModel = (meta) => !!meta && meta.kind === 'model';
    const isDxf = (meta) => isModel(meta) && !!meta.model && meta.model.format === 'dxf';

    async function saveFacts(handle, info) {
      handle.meta.model = info;
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['model', JSON.stringify(info)]);
    }

    /**
     * An IFC file as a model dataset.
     * @param {{name: string, fileName: string, bytes: Uint8Array, source?: any, description?: string, onProgress?: (share: number) => void}} input
     */
    async function createIfcDataset(input) {
      const handle = await datasets.createEmpty({ name: input.name, columns: IFC_COLUMNS, kind: 'model', source: input.source || null, description: input.description || '' });
      try {
        const e = handle.engine;
        await e.run('create table _properties (id integer, uppsattning text, namn text, varde text, tal real, enhet text, kalla text)');
        await e.run('create table _quantities (id integer, uppsattning text, namn text, varde real, slag text, enhet text)');
        await e.run('create table _entities (id integer primary key, typ text, attribut text)');
        const summary = await step.tables(input.bytes, {
          onProgress: input.onProgress,
          onRows: async (table, rows) => {
            if (table === 'elements') await datasets.appendImportRows(handle, rows);
            else if (table === 'properties') await e.insertRows('_properties', PROPERTY_FIELDS, rows);
            else if (table === 'quantities') await e.insertRows('_quantities', QUANTITY_FIELDS, rows);
            else await e.insertRows('_entities', ENTITY_FIELDS, rows);
          },
        });
        if (!summary.rows) throw new Error(D.t('model.err.noelements'));
        await e.run('create index _properties_id on _properties (id)');
        await e.run('create index _quantities_id on _quantities (id)');
        await files.put(handle, [{ name: input.fileName, kind: 'original', type: 'application/x-step', bytes: input.bytes }]);
        summary.file = input.fileName;
        await saveFacts(handle, summary);
        return await datasets.finishImport(handle, {});
      } catch (err) { datasets.abortImport(handle); throw err; }
    }

    /**
     * A DXF file as a model dataset.
     * @param {{name: string, fileName: string, bytes: Uint8Array, source?: any, description?: string}} input
     */
    async function createDxfDataset(input) {
      const text = new TextDecoder('utf-8').decode(input.bytes);
      const parsed = await dxf.read(text);
      const handle = await datasets.createEmpty({ name: input.name, columns: DXF_COLUMNS, kind: 'model', source: input.source || null, description: input.description || '' });
      try {
        for (let i = 0; i < parsed.rows.length; i += 5000) await datasets.appendImportRows(handle, parsed.rows.slice(i, i + 5000));
        await files.put(handle, [
          { name: input.fileName, kind: 'original', type: 'image/vnd.dxf', bytes: input.bytes },
          { name: 'ritning.svg', kind: 'preview', type: 'image/svg+xml', bytes: new TextEncoder().encode(parsed.svg) },
        ]);
        parsed.summary.file = input.fileName;
        await saveFacts(handle, parsed.summary);
        return await datasets.finishImport(handle, {});
      } catch (err) { datasets.abortImport(handle); throw err; }
    }

    /**
     * A changed IFC file becomes the dataset's content, inside an operation's savepoint (data/ifc-ops): the element, property,
     * quantity and entity tables are rebuilt from it, the original in `_files` is replaced and the facts in `_meta.model`
     * renewed. The element ids follow the file, so a selection in memory is dropped by the content change as usual.
     * @param {{engine: any, datasetId?: string}} ctx @param {Uint8Array} bytes @param {string} fileName
     * @returns {Promise<any>} the new facts
     */
    async function replaceOriginal(ctx, bytes, fileName) {
      const e = ctx.engine;
      for (const table of ['data', '_properties', '_quantities', '_entities']) await e.run(`delete from ${table}`);
      const names = IFC_COLUMNS.map((c) => c.name);
      const summary = await step.tables(bytes, {
        onRows: async (table, rows) => {
          if (table === 'elements') await e.insertRows('data', names, rows);
          else if (table === 'properties') await e.insertRows('_properties', PROPERTY_FIELDS, rows);
          else if (table === 'quantities') await e.insertRows('_quantities', QUANTITY_FIELDS, rows);
          else await e.insertRows('_entities', ENTITY_FIELDS, rows);
        },
      });
      if (!summary.rows) throw new Error(D.t('model.err.noelements'));
      await files.ensureTable(e);
      await e.run(`delete from ${files.TABLE} where kind = 'original'`);
      await e.insertRows(files.TABLE, ['name', 'kind', 'type', 'size', 'bytes'], [[fileName, 'original', 'application/x-step', bytes.byteLength, bytes]], 1);
      summary.file = fileName;
      await e.run('insert or replace into _meta (key, value) values (?, ?)', ['model', JSON.stringify(summary)]);
      if (ctx.datasetId) {
        files.clearUrls(ctx.datasetId);
        // The open handle's record is what gets saved and listed: keep its facts current too.
        try { (await datasets.ensureOpen(ctx.datasetId)).meta.model = summary; } catch (_err) { /* not open */ }
      }
      return summary;
    }

    /** The original file of a model. @returns {Promise<{name: string, bytes: Uint8Array}|null>} */
    async function original(id) {
      const list = await files.list(id, 'original');
      if (!list.length) return null;
      const f = await files.read(id, list[0].name, 'original');
      return f ? { name: list[0].name, bytes: f.bytes } : null;
    }
    /** The SVG drawing of a DXF dataset. */
    async function drawing(id) {
      const f = await files.read(id, 'ritning.svg', 'preview');
      return f ? new TextDecoder().decode(f.bytes) : null;
    }
    async function rowsOf(id, sql) {
      const handle = await datasets.ensureOpen(id);
      const r = await handle.engine.exec(sql);
      if (!r[0]) return [];
      return r[0].values.map((row) => Object.fromEntries(r[0].columns.map((c, i) => [c, row[i]])));
    }
    /** One element or entity. */
    async function element(id, elementId) { return (await rowsOf(id, `select * from data where id = ${Number(elementId)}`))[0] || null; }
    /** An element's properties, grouped in order by set. */
    function properties(id, elementId) { return rowsOf(id, `select uppsattning, namn, varde, tal, enhet, kalla from _properties where id = ${Number(elementId)} order by kalla, uppsattning, namn`); }
    /** An element's quantities in SI units. */
    function quantities(id, elementId) { return rowsOf(id, `select uppsattning, namn, varde, slag, enhet from _quantities where id = ${Number(elementId)} order by uppsattning, namn`); }

    /**
     * WHERE clause of the view's filter (text search and, for IFC, type and storey; for DXF, layer and type).
     * @param {{search?: string, typ?: string, vaning?: string, lager?: string}} filter @param {boolean} dxfDrawing
     */
    function whereOf(filter, dxfDrawing) {
      const parts = [];
      if (filter.typ) parts.push(`typ = ${q(filter.typ)}`);
      if (filter.vaning) parts.push(`vaning = ${q(filter.vaning)}`);
      if (filter.lager) parts.push(`lager = ${q(filter.lager)}`);
      const text = String(filter.search || '').trim().replace(/[%_]/g, ' ');
      if (text) {
        const like = q('%' + text + '%');
        const cols = dxfDrawing ? ['typ', 'lager', 'text'] : ['typ', 'namn', 'tagg', 'guid', 'objekttyp', 'typnamn', 'material', 'klassificering', 'egenskaper'];
        parts.push('(' + cols.map((c) => `${c} like ${like}`).join(' or ') + ')');
      }
      return parts.length ? ' where ' + parts.join(' and ') : '';
    }

    return { IFC_COLUMNS, DXF_COLUMNS, PROPERTY_FIELDS, QUANTITY_FIELDS, ENTITY_FIELDS, isModel, isDxf, createIfcDataset, createDxfDataset, replaceOriginal, original, drawing, element, properties, quantities, whereOf, rowsOf };
  });
})();
