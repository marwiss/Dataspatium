// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Recipe steps on building models with IfcOpenShell (dataset kind "model", IFC): `ifc_python` runs `def step(model): ...`
 * on the model, `ifc_apply_table` writes a table's values (attributes and "Set.Property" columns, matched on GlobalId)
 * into it. Python does the work in `prepare`, before the operation's savepoint (data/python-bridge, with IfcOpenShell
 * fetched as a component after consent); `apply` makes the written IFC the dataset's content (data/model.replaceOriginal),
 * so the step is logged, undoable and replayable like any other, and the original file in `_files` is always the
 * current version of the model. The dataset is never changed by Python directly. `ifc_changeset` is the approved change set of
 * Ändra med AI (ai/write-tools), applied by the wheel's _ifc_changeset with the schema check; `previewChangeset` runs it on a copy.
 * `topologyOf` reads the building's topology (rooms, neighbours, external walls with their facing, open wall ends) from the model;
 * `classSearch` finds the IFC class for a thing and `classReportOf` reports the model's class faults (decision B-57.2).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/ifc-ops', ['data/operations', 'data/datasets', 'data/model'], (ops, datasets, model) => {
    const bridge = () => D.require('data/python-bridge').bridge;
    const lines = (prefix, text) => String(text).split('\n').map((l) => prefix + l);

    /** The model dataset of the operation (IFC, not DXF). */
    async function modelOf(ctx) {
      const meta = ctx.datasetId ? await datasets.get(ctx.datasetId) : null;
      if (!meta || !model.isModel(meta) || model.isDxf(meta)) throw new Error(D.t('op.err.ifc.notmodel'));
      return meta;
    }
    const fileNameOf = (meta, info) => String((info && info.file) || (meta.model && meta.model.file) || (meta.name + '.ifc'));

    /** Make the IFC written by Python the dataset's content. */
    async function take(ctx) {
      const job = ctx._ifc;
      ctx._ifc = null;
      if (!job) throw new Error(D.t('op.err.step.noresult'));
      const facts = await model.replaceOriginal(ctx, job.bytes, job.fileName);
      return { rows: Number(facts.elements || facts.rows) || 0, entities: Number(facts.entities) || 0, changed: Number(job.info && job.info.changed) || 0 };
    }

    /** `def step(model): ...` with IfcOpenShell on the whole model; the changed model becomes a new version of the dataset. */
    const python = ops.define({
      id: 'ifc_python', group: 'model', manualPreview: true,
      params: [{ name: 'code', type: 'code', language: 'python', required: true }],
      async prepare(ctx, p) {
        const meta = await modelOf(ctx);
        const res = await bridge().runIfcStep(String(p.code), await ctx.engine.export(), { name: meta.name });
        ctx._ifc = { bytes: res.bytes, info: res.info, fileName: fileNameOf(meta, res.info) };
      },
      apply: (ctx) => take(ctx),
      /** Runs the code on the model and tells what came out, without touching the dataset. */
      async preview(ctx, p) {
        const meta = await modelOf(ctx);
        const res = await bridge().runIfcStep(String(p.code), await ctx.engine.export(), { name: meta.name });
        const info = res.info || {};
        return { rows: Number(info.elements) || 0, log: res.log, note: D.t('op.ifc_python.preview', { elements: Number(info.elements) || 0, entities: Number(info.entities) || 0, kb: Math.round(res.bytes.byteLength / 1024) }) };
      },
      toSQL: (p) => ['-- ' + D.t('op.ifc.code.note')].concat(lines('-- ', p.code)),
      toR: (p) => ['# ' + D.t('op.ifc.code.note')].concat(lines('# ', p.code)).join('\n'),
    });

    /** A table's values into the model: attributes and "Set.Property" columns, rows matched on the key column (GlobalId). */
    const applyTable = ops.define({
      id: 'ifc_apply_table', group: 'model', manualPreview: true,
      params: [{ name: 'table', type: 'dataset', kinds: ['table'], required: true }, { name: 'key', type: 'text', default: 'guid' }],
      async prepare(ctx, p) {
        const meta = await modelOf(ctx);
        if (!(await datasets.get(p.table))) throw new Error(D.t('op.err.ifc.notable'));
        const res = await bridge().runIfcApply(await ctx.engine.export(), await datasets.exportBytes(p.table), String(p.key || 'guid'));
        ctx._ifc = { bytes: res.bytes, info: res.info, fileName: fileNameOf(meta, res.info) };
      },
      apply: (ctx) => take(ctx),
      async preview(ctx, p) {
        await modelOf(ctx);
        if (!(await datasets.get(p.table))) throw new Error(D.t('op.err.ifc.notable'));
        const res = await bridge().runIfcApply(await ctx.engine.export(), await datasets.exportBytes(p.table), String(p.key || 'guid'));
        const info = res.info || {};
        return { rows: Number(info.changed) || 0, log: res.log, note: D.t('op.ifc_apply_table.preview', { changed: Number(info.changed) || 0, rows: Number(info.rows) || 0 }) };
      },
      toSQL: (p) => ['-- ' + D.t('op.ifc_apply_table.code', { table: p.table, key: p.key || 'guid' })],
      toR: (p) => '# ' + D.t('op.ifc_apply_table.code', { table: p.table, key: p.key || 'guid' }),
    });

    const parseChanges = (text) => { const ops = typeof text === 'string' ? JSON.parse(text) : text; if (!Array.isArray(ops)) throw new Error(D.t('op.err.step.noresult')); return ops; };
    /** The approved change set of Ändra med AI: the wheel applies it, the written IFC becomes the model's new version (undoable). */
    const changeset = ops.define({
      id: 'ifc_changeset', group: 'model', manualPreview: true,
      params: [{ name: 'changes', type: 'text', required: true }, { name: 'provenance', type: 'text' }],
      async prepare(ctx, p) {
        const meta = await modelOf(ctx);
        const res = await bridge().runIfcChangeset(parseChanges(p.changes), await ctx.engine.export(), { name: meta.name });
        ctx._ifc = { bytes: res.bytes, info: res.info, fileName: fileNameOf(meta, res.info) };
      },
      async apply(ctx) { const info = (ctx._ifc && ctx._ifc.info) || {}; const out = await take(ctx); return Object.assign(out, { report: info, created: (info.created || []).length, deleted: (info.deleted || []).length }); },
      toSQL: (p) => ['-- ' + D.t('op.ifc_changeset.note')].concat(lines('-- ', p.changes)),
      toR: (p) => ['# ' + D.t('op.ifc_changeset.note')].concat(lines('# ', p.changes)).join('\n'),
    });
    /**
     * A change set applied to a copy of the model, for the preview: the candidate IFC and the wheel's report (created, changed,
     * deleted, findings, errors). The dataset is untouched.
     * @param {string} datasetId @param {any[]} changes @returns {Promise<{bytes: Uint8Array, report: any, log: any[]}>}
     */
    async function previewChangeset(datasetId, changes) {
      const meta = await datasets.get(datasetId);
      if (!meta || !model.isModel(meta) || model.isDxf(meta)) throw new Error(D.t('op.err.ifc.notmodel'));
      const handle = await datasets.ensureOpen(datasetId);
      const res = await bridge().runIfcChangeset(parseChanges(changes), await handle.engine.export(), { name: meta.name });
      return { bytes: res.bytes, report: res.info || {}, log: res.log || [] };
    }
    /**
     * The building's topology (decision F46 a) for the read tool get_topology and the card Topologi in Kontrollera: per storey the
     * rooms, which rooms border which, the external walls with the façade they face and the open wall ends. Like the preview it
     * starts Python when it is not running, so only the person's action may call it while Python is idle. The dataset is untouched.
     * @param {string} datasetId @returns {Promise<any[]>} one entry per storey (python/dataspatium.py `_ifc_topology`)
     */
    async function topologyOf(datasetId) {
      const meta = await datasets.get(datasetId);
      if (!meta || !model.isModel(meta) || model.isDxf(meta)) throw new Error(D.t('op.err.ifc.notmodel'));
      const handle = await datasets.ensureOpen(datasetId);
      const out = await bridge().runIfcTopology(await handle.engine.export());
      return Array.isArray(out) ? out : [];
    }
    /** The model dataset an IFC tool reads (IFC, not DXF), or the error the person can act on. @param {string} datasetId */
    async function modelMeta(datasetId) {
      const meta = await datasets.get(datasetId);
      if (!meta || !model.isModel(meta) || model.isDxf(meta)) throw new Error(D.t('op.err.ifc.notmodel'));
      return meta;
    }
    /**
     * The IFC classes for a thing named in English IFC words, in the model's schema (decision B-57.2; python/ `_ifc_class_search`):
     * per hit the class, its matching PredefinedTypes with their docs, a description, spec_url and the type class. Like the preview it
     * starts Python when it is not running, so only the person's action may call it while Python is idle.
     * @param {string} datasetId @param {string} query @param {number} [limit] @returns {Promise<any[]>}
     */
    async function classSearch(datasetId, query, limit) {
      const meta = await modelMeta(datasetId);
      const out = await bridge().runIfcClassSearch(String((meta.model && meta.model.schema) || 'IFC4'), String(query || ''), limit);
      return Array.isArray(out) ? out : [];
    }
    /**
     * The model's class report (decision B-57.2; python/ `_ifc_class_report`): counts and examples of proxies, USERDEFINED without a
     * name, untyped elements, type and occurrence conflicts (OJT001) and elements outside the spatial structure (SPS007). Python
     * starts as for classSearch. @param {string} datasetId @returns {Promise<any>}
     */
    async function classReportOf(datasetId) {
      await modelMeta(datasetId);
      const handle = await datasets.ensureOpen(datasetId);
      return (await bridge().runIfcClassReport(await handle.engine.export())) || {};
    }
    return { python, applyTable, changeset, previewChangeset, topologyOf, classSearch, classReportOf, IDS: ['ifc_apply_table', 'ifc_python'] };
  });
})();
