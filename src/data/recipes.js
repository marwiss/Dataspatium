// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Recipes: applying operations to datasets with undo, logging every step in the dataset's _log so
 * that the sequence can be replayed on another dataset or exported as SQL or R.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/recipes', ['data/datasets', 'data/operations'], (datasets, ops) => {
    const UNDO_LIMIT = 10;
    const UNDO_MAX_BYTES = 80 * 1024 * 1024;
    /**
     * Undo entries hold either a full snapshot (`bytes`) or an inverse operation (`inverse`) for cheap,
     * frequent operations such as cell edits.
     * @type {Map<string, Array<{bytes?: ArrayBuffer, inverse?: {op: string, params: any}, label: string}>>}
     */
    const undoStacks = new Map();

    function pushUndo(id, entry) {
      let stack = undoStacks.get(id);
      if (!stack) { stack = []; undoStacks.set(id, stack); }
      stack.push(entry);
      const size = () => stack.reduce((s, e) => s + (e.bytes ? e.bytes.byteLength : 0), 0);
      while (stack.length > UNDO_LIMIT || (stack.length > 1 && size() > UNDO_MAX_BYTES)) stack.shift();
    }

    /** Human-readable step description in the UI language. */
    function describe(opId, params, result) {
      const cols = (params.columns || (params.column ? [params.column] : [])).join(', ');
      const n = result && typeof result.rows === 'number' ? D.t('recipe.rows', { n: result.rows }) : '';
      switch (opId) {
        case 'rename_column': return D.t('recipe.rename_column', { column: params.column, name: params.name });
        case 'set_label': return D.t('recipe.set_label', { column: params.column, label: params.label, extra: (params.description ? D.t('recipe.set_label.description', { description: params.description }) : '') + (params.unit ? D.t('recipe.set_label.unit', { unit: params.unit }) : '') });
        case 'drop_columns': return D.t('recipe.drop_columns', { cols });
        case 'reorder_columns': return D.t('recipe.reorder_columns');
        case 'set_type': return D.t('recipe.set_type', { column: params.column, type: params.type, n });
        case 'replace_text': return D.t('recipe.replace_text', { find: params.find, replace: params.replace || '', cols, n });
        case 'trim': return D.t('recipe.trim', { cols, n });
        case 'pseudonymize': return D.t('recipe.pseudonymize', { cols, method: D.t('recipe.pseudonymize.' + (params.method === 'mask' ? 'mask' : params.method === 'sequence' ? 'sequence' : 'hash')), n });
        case 'change_case': return D.t('recipe.change_case', { mode: params.mode, cols, n });
        case 'fix_encoding': return D.t('recipe.fix_encoding', { cols, n });
        case 'replace_value': return D.t('recipe.replace_value', { column: params.column, n });
        case 'fill_missing': return D.t('recipe.fill_missing', { column: params.column, n });
        case 'edit_cell': return D.t('recipe.edit_cell', { column: params.column, row: params.rowid });
        case 'delete_rows': return D.t(params.keep ? 'recipe.delete_rows.keep' : 'recipe.delete_rows.drop', { where: params.where, n });
        case 'remove_duplicates': return D.t('recipe.remove_duplicates', { on: cols ? D.t('recipe.remove_duplicates.on', { cols }) : '', n });
        case 'add_column': return D.t('recipe.add_column', { name: params.name, expression: params.expression });
        case 'combine_columns': return D.t('recipe.combine_columns', { cols, name: params.name });
        case 'split_column': return D.t('recipe.split_column', { column: params.column, delimiter: params.delimiter });
        case 'pivot_longer': return D.t('recipe.pivot_longer', { cols });
        case 'pivot_wider': return D.t('recipe.pivot_wider', { names: params.names, values: params.values });
        case 'sql': return `SQL: ${String(params.statement).slice(0, 80)}`;
        case 'geo_centroid': return D.t('recipe.geo_centroid', { column: params.column, lon: params.lonName || 'lon', lat: params.latName || 'lat', n });
        case 'geo_area': return D.t('recipe.geo_area', { column: params.column, name: params.name || 'area_km2', n });
        case 'geo_reproject': return D.t('recipe.geo_reproject', { x: params.xColumn, y: params.yColumn, crs: params.direction === 'to_sweref' ? 'SWEREF 99 TM' : 'WGS 84', n });
        case 'geo_region': return D.t(params.level === 'lan' ? 'recipe.geo_region.lan' : 'recipe.geo_region.kommun', { lon: params.lonColumn, lat: params.latColumn, n: result && typeof result.matched === 'number' ? D.t('recipe.geo_region.matched', { matched: result.matched, rows: result.rows }) : n });
        default: return opId;
      }
    }

    /**
     * Apply an operation to a dataset.
     * @param {string} id dataset id
     * @param {string} opId
     * @param {Record<string, any>} params
     */
    async function apply(id, opId, params, options = {}) {
      const op = ops.get(opId);
      const handle = await datasets.ensureOpen(id);
      const ctx = ops.makeContext(handle.engine, handle.columns);
      ctx.datasetId = id;
      // Sort indexes would block column rebuilds (ALTER TABLE DROP COLUMN); they are recreated on the next sort.
      await datasets.dropIndexes(handle);
      let undoEntry = null;
      if (!options.noUndo) {
        const label = describe(opId, params);
        undoEntry = op.inverse ? { inverse: await op.inverse(ctx, params), label } : { bytes: await handle.engine.export(), label };
        pushUndo(id, undoEntry);
      }
      // After the snapshot (export reopens the connection): operations that need other datasets attach them here.
      if (op.prepare) await op.prepare(ctx, params);
      let result;
      try {
        await handle.engine.run('savepoint dm_op');
        result = await op.apply(ctx, params);
        await handle.engine.run('release dm_op');
      } catch (err) {
        try { await handle.engine.run('rollback to dm_op'); await handle.engine.run('release dm_op'); } catch (_e) { /* ignore */ }
        const stack = undoStacks.get(id); if (stack && undoEntry && stack[stack.length - 1] === undoEntry) stack.pop();
        throw err;
      }
      if (ctx.columnsChanged) await datasets.writeColumns(handle, ctx.columns);
      const description = options.description || describe(opId, params, result);
      await datasets.appendLog(handle, options.logAction || 'op', { op: opId, params: redactSecrets(op, params), result: result || {}, description });
      await datasets.refreshCounts(handle);
      datasets.scheduleSave(id);
      return result || {};
    }

    /** Preview an operation's effect without applying it (if the operation supports it). */
    async function preview(id, opId, params) {
      const op = ops.get(opId);
      if (!op.preview) return null;
      const handle = await datasets.ensureOpen(id);
      return op.preview(ops.makeContext(handle.engine, handle.columns), params);
    }

    function canUndo(id) { const s = undoStacks.get(id); return !!(s && s.length); }
    function undoLabel(id) { const s = undoStacks.get(id); return s && s.length ? s[s.length - 1].label : ''; }

    /** Restore the state before the last operation. */
    async function undo(id) {
      const stack = undoStacks.get(id);
      if (!stack || !stack.length) throw new Error(D.t('recipe.err.nothing.undo'));
      const entry = stack.pop();
      if (entry.inverse) await apply(id, entry.inverse.op, entry.inverse.params, { noUndo: true, logAction: 'undo', description: D.t('recipe.undo.prefix', { label: entry.label }) });
      else await datasets.replaceBytes(id, entry.bytes, { action: 'undo', description: D.t('recipe.undo.prefix', { label: entry.label }) });
      return entry.label;
    }

    /** Recipe steps (operations) recorded in the dataset's log. */
    async function steps(id) {
      const log = await datasets.log(id);
      return log.filter((e) => e.action === 'op' && e.details && e.details.op).map((e) => ({ ts: e.ts, op: e.details.op, params: e.details.params, description: e.details.description || describe(e.details.op, e.details.params, e.details.result) }));
    }

    /** Replay recipe steps on another dataset. Stops at the first failing step. */
    /** Secret parameters (salts) are never written to the log or the recipe. */
    function redactSecrets(op, params) {
      const secret = ((op && op.params) || []).filter((p) => p.secret && params && params[p.name] !== undefined && params[p.name] !== '');
      if (!secret.length) return params;
      const out = Object.assign({}, params);
      for (const p of secret) out[p.name] = '***';
      return out;
    }

    async function replay(targetId, recipeSteps) {
      const done = [];
      for (const step of recipeSteps) {
        try {
          const op = ops.get(step.op);
          const missing = ((op && op.params) || []).filter((p) => p.secret && step.params && step.params[p.name] === '***');
          if (missing.length) throw new Error(D.t('recipe.err.secret', { op: step.op, params: missing.map((p) => p.name).join(', ') }));
          await apply(targetId, step.op, step.params); done.push({ step, ok: true });
        }
        catch (err) { done.push({ step, ok: false, error: (err && err.message) || String(err) }); break; }
      }
      return done;
    }

    async function toSQL(id) {
      const handle = await datasets.ensureOpen(id);
      const ctx = ops.makeContext(handle.engine, handle.columns);
      const lines = [D.t('recipe.sql.header'), ''];
      for (const s of await steps(id)) { lines.push('-- ' + s.description); for (const l of ops.get(s.op).toSQL(s.params, ctx)) lines.push(l); lines.push(''); }
      return lines.join('\n');
    }

    async function toR(id) {
      const meta = await datasets.get(id);
      const handle = await datasets.ensureOpen(id);
      const ctx = ops.makeContext(handle.engine, handle.columns);
      const lines = [D.t('recipe.r.header'), `df <- dm_read(${JSON.stringify(meta ? (meta.shortName || meta.name) : id)})`, ''];
      for (const s of await steps(id)) { lines.push('# ' + s.description); lines.push(ops.get(s.op).toR(s.params, ctx)); lines.push(''); }
      lines.push(`dm_write(df, ${JSON.stringify((meta ? meta.name : D.t('datasets.default.name')) + D.t('recipe.r.suffix'))})`);
      return lines.join('\n');
    }

    function exportJson(recipeSteps, name) {
      return JSON.stringify({ app: 'Dataspatium', kind: 'recipe', version: D.version, name: name || D.t('recipe.default.name'), created: new Date().toISOString(), steps: recipeSteps.map((s) => ({ op: s.op, params: s.params, description: s.description })) }, null, 2);
    }

    return { apply, preview, undo, canUndo, undoLabel, steps, replay, toSQL, toR, exportJson, describe };
  });
})();
