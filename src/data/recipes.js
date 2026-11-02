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

    /** Human-readable step description (Swedish). */
    function describe(opId, params, result) {
      const cols = (params.columns || (params.column ? [params.column] : [])).join(', ');
      const n = result && typeof result.rows === 'number' ? ` (${result.rows} rader)` : '';
      switch (opId) {
        case 'rename_column': return `Byt namn på ${params.column} till ${params.name}`;
        case 'set_label': return `Etikett för ${params.column}: ${params.label}`;
        case 'drop_columns': return `Ta bort kolumner ${cols}`;
        case 'reorder_columns': return 'Ändra kolumnordning';
        case 'set_type': return `Ändra typ för ${params.column} till ${params.type}${n}`;
        case 'replace_text': return `Ersätt "${params.find}" med "${params.replace || ''}" i ${cols}${n}`;
        case 'trim': return `Trimma ${cols}${n}`;
        case 'change_case': return `Ändra skiftläge (${params.mode}) i ${cols}${n}`;
        case 'fix_encoding': return `Reparera teckenkodning i ${cols}${n}`;
        case 'replace_value': return `Ersätt värde i ${params.column}${n}`;
        case 'fill_missing': return `Fyll saknade värden i ${params.column}${n}`;
        case 'edit_cell': return `Redigera cell i ${params.column} (rad ${params.rowid})`;
        case 'delete_rows': return `${params.keep ? 'Behåll' : 'Ta bort'} rader där ${params.where}${n}`;
        case 'remove_duplicates': return `Ta bort dubbletter${cols ? ' på ' + cols : ''}${n}`;
        case 'add_column': return `Ny kolumn ${params.name} = ${params.expression}`;
        case 'combine_columns': return `Kombinera ${cols} till ${params.name}`;
        case 'split_column': return `Dela ${params.column} på "${params.delimiter}"`;
        case 'pivot_longer': return `Pivotera ${cols} till långt format`;
        case 'pivot_wider': return `Pivotera ${params.names}/${params.values} till brett format`;
        case 'sql': return `SQL: ${String(params.statement).slice(0, 80)}`;
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
      let undoEntry = null;
      if (!options.noUndo) {
        const label = describe(opId, params);
        undoEntry = op.inverse ? { inverse: await op.inverse(ctx, params), label } : { bytes: await handle.engine.export(), label };
        pushUndo(id, undoEntry);
      }
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
      await datasets.appendLog(handle, options.logAction || 'op', { op: opId, params, result: result || {}, description });
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
      if (!stack || !stack.length) throw new Error('Inget att ångra.');
      const entry = stack.pop();
      if (entry.inverse) await apply(id, entry.inverse.op, entry.inverse.params, { noUndo: true, logAction: 'undo', description: 'Ångra: ' + entry.label });
      else await datasets.replaceBytes(id, entry.bytes, { action: 'undo', description: 'Ångra: ' + entry.label });
      return entry.label;
    }

    /** Recipe steps (operations) recorded in the dataset's log. */
    async function steps(id) {
      const log = await datasets.log(id);
      return log.filter((e) => e.action === 'op' && e.details && e.details.op).map((e) => ({ ts: e.ts, op: e.details.op, params: e.details.params, description: e.details.description || describe(e.details.op, e.details.params, e.details.result) }));
    }

    /** Replay recipe steps on another dataset. Stops at the first failing step. */
    async function replay(targetId, recipeSteps) {
      const done = [];
      for (const step of recipeSteps) {
        try { await apply(targetId, step.op, step.params); done.push({ step, ok: true }); }
        catch (err) { done.push({ step, ok: false, error: (err && err.message) || String(err) }); break; }
      }
      return done;
    }

    async function toSQL(id) {
      const handle = await datasets.ensureOpen(id);
      const ctx = ops.makeContext(handle.engine, handle.columns);
      const lines = ['-- Dataspatium-recept, SQL mot tabellen data', ''];
      for (const s of await steps(id)) { lines.push('-- ' + s.description); for (const l of ops.get(s.op).toSQL(s.params, ctx)) lines.push(l); lines.push(''); }
      return lines.join('\n');
    }

    async function toR(id) {
      const meta = await datasets.get(id);
      const handle = await datasets.ensureOpen(id);
      const ctx = ops.makeContext(handle.engine, handle.columns);
      const lines = ['# Dataspatium-recept som R-kod', `df <- dm_read(${JSON.stringify(meta ? meta.name : id)})`, ''];
      for (const s of await steps(id)) { lines.push('# ' + s.description); lines.push(ops.get(s.op).toR(s.params, ctx)); lines.push(''); }
      lines.push(`dm_write(df, ${JSON.stringify((meta ? meta.name : 'Datamängd') + ' (bearbetad)')})`);
      return lines.join('\n');
    }

    function exportJson(recipeSteps, name) {
      return JSON.stringify({ app: 'Dataspatium', kind: 'recipe', version: D.version, name: name || 'Recept', created: new Date().toISOString(), steps: recipeSteps.map((s) => ({ op: s.op, params: s.params, description: s.description })) }, null, 2);
    }

    return { apply, preview, undo, canUndo, undoLabel, steps, replay, toSQL, toR, exportJson, describe };
  });
})();
