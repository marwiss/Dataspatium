// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Commands: what the app can do without its UI, as one registry (Martin's F30 a). A command has a name, a description for people
 * and for an AI, parameters as JSON Schema, whether it writes, and an answer that is data. It is built from what the app already
 * has: reading datasets, the operations of Bearbeta (through the recipes, with undo), the steps of flows and the code engines.
 * Every caller (flows, the AI in the app, later the bridge) runs the same commands under the same rules:
 * - a name that is not in the registry is refused, and the arguments are checked against the schema before anything runs;
 * - a writing command needs the person's approval, unless the person runs it themselves (`trusted`);
 * - the network goes through consent inside the steps, and the files a command makes stay in memory until the person fetches
 *   them: nothing leaves the app here;
 * - no caller's code is ever evaluated: SQL that reads runs with the database locked against writes, R and Python run in their
 *   engines' workers.
 * The schemas follow the providers' strict modes: every field is listed, the ones that may be left out take null, and nested
 * objects name all their fields. Free-form parameters (an operation's) travel as JSON text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/commands', ['data/datasets', 'data/operations', 'data/recipes', 'data/flows', 'data/kinds', 'data/query', 'platform/storage/idb', 'viz/charts', 'viz/dashboards', 'docgen/documents', 'data/lists'],
    (datasets, ops, recipes, flows, kinds, query, idb, charts, dashboards, documents, lists) => {
      const t = (k, p) => D.t(k, p);
      const MAX_ROWS = 200;
      const MAX_TEXT = 8000;
      const MAX_FILES = 50;
      /** @type {Map<string, any>} */ const registry = new Map();
      /** @type {Map<string, Blob>} */ const outputs = new Map();

      // ---------------------------------------------------------------------------- schemas
      const nullable = (type) => ({ type: [type, 'null'] });
      const S = {
        str: (description) => ({ type: 'string', description }),
        strOrNull: (description) => Object.assign(nullable('string'), { description }),
        intOrNull: (description) => Object.assign(nullable('integer'), { description }),
        boolOrNull: (description) => Object.assign(nullable('boolean'), { description }),
        oneOf: (values, description) => ({ type: 'string', enum: values, description }),
        obj: (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false }),
      };
      const FILTER = S.obj({
        column: S.str('column name'),
        op: S.oneOf(['=', '!=', '<', '<=', '>', '>=', 'contains', 'starts_with', 'is_null', 'not_null'], 'comparison'),
        value: { type: ['string', 'number', 'boolean', 'null'], description: 'value to compare with; null for is_null and not_null' },
      });

      /** The JSON type of a value as the schema names it. */
      function typeOf(v) {
        if (v === null) return 'null';
        if (Array.isArray(v)) return 'array';
        if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
        return typeof v;
      }
      const fits = (type, v) => { const got = typeOf(v); return got === type || (type === 'number' && got === 'integer'); };
      /**
       * Checks a value against the subset of JSON Schema the commands use (type, enum, properties, required,
       * additionalProperties false, items, minimum, maximum).
       * @param {any} schema @param {any} value @param {string} [path]
       * @returns {string[]} what is wrong, as "path: reason"; empty when the value fits
       */
      function check(schema, value, path = '') {
        const at = path || t('commands.arg.root');
        const types = schema.type ? [].concat(schema.type) : null;
        if (types && !types.some((type) => fits(type, value))) return [`${at}: ${t('commands.arg.type', { type: types.join(' | ') })}`];
        if (value === null) return [];
        if (schema.enum && !schema.enum.includes(value)) return [`${at}: ${t('commands.arg.enum', { values: schema.enum.join(', ') })}`];
        if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) {
          return [`${at}: ${t('commands.arg.range', { min: schema.minimum !== undefined ? schema.minimum : '', max: schema.maximum !== undefined ? schema.maximum : '' })}`];
        }
        const out = [];
        if (typeOf(value) === 'object' && schema.properties) {
          // A field that may be null may also be left out: the strict modes send it as null, a person writing a plan may not.
          const mayBeNull = (name) => [].concat((schema.properties[name] || {}).type || []).includes('null');
          for (const name of schema.required || []) if (!(name in value) && !mayBeNull(name)) out.push(`${path ? path + '.' : ''}${name}: ${t('commands.arg.missing')}`);
          for (const [name, v] of Object.entries(value)) {
            const sub = schema.properties[name];
            if (!sub) { if (schema.additionalProperties === false) out.push(`${path ? path + '.' : ''}${name}: ${t('commands.arg.unknown')}`); continue; }
            out.push(...check(sub, v, (path ? path + '.' : '') + name));
          }
        }
        if (Array.isArray(value) && schema.items) value.forEach((v, i) => out.push(...check(schema.items, v, `${path}[${i}]`)));
        return out;
      }
      /** Arguments without the fields left out (null), as the steps expect them. */
      function present(args) {
        const out = {};
        for (const [k, v] of Object.entries(args || {})) if (v !== null && v !== undefined) out[k] = v;
        return out;
      }

      // ---------------------------------------------------------------------------- references
      const sameName = (a, b) => String(a).trim().toLocaleLowerCase('sv') === String(b).trim().toLocaleLowerCase('sv');
      /** One record by id, else by its name (case-insensitive) when only one has it. */
      function pick(list, ref, what) {
        const byId = list.find((x) => x.id === ref);
        if (byId) return byId;
        const named = list.filter((x) => x.name !== undefined && sameName(x.name, ref));
        if (named.length === 1) return named[0];
        throw new Error(t(named.length ? 'commands.err.ambiguous' : 'commands.err.missing', { what: t('commands.what.' + what), ref: String(ref) }));
      }
      const dataset = async (ref) => pick(await datasets.list(), ref, 'dataset');
      const ITEMS = {
        flows: () => flows.list(),
        charts: () => charts.list(),
        dashboards: () => dashboards.list(),
        documents: () => documents.list(),
        scripts: async () => (await idb.listScripts()).filter((s) => s.language === 'r' || s.language === 'python'),
        lists: () => lists.list(),
      };
      const item = async (type, ref, what) => pick(await ITEMS[type](), ref, what);

      // ---------------------------------------------------------------------------- files
      /** Keeps what a command made, under a name not yet taken; the person fetches it later. */
      function keep(files) {
        const names = [];
        for (const f of files || []) {
          let name = f.name; let n = 2;
          while (outputs.has(name)) { name = String(f.name).replace(/(\.[^.]+)?$/, ` ${n}$1`); n++; }
          outputs.set(name, f.blob);
          names.push(name);
        }
        while (outputs.size > MAX_FILES) outputs.delete(outputs.keys().next().value);
        return names;
      }
      /** The files commands have made and not yet handed over. */
      function files() { return Array.from(outputs.entries()).map(([name, blob]) => ({ name, size: blob.size, type: blob.type })); }
      /** A file a command made, handed to the person once. @param {string} name @returns {{name: string, blob: Blob}|null} */
      function take(name) { const blob = outputs.get(name); if (!blob) return null; outputs.delete(name); return { name, blob }; }

      // ---------------------------------------------------------------------------- the registry
      /**
       * Adds a command.
       * @param {{name: string, writes: boolean, description: string, parameters: any, run: (args: any, ctx: any) => Promise<any>}} cmd
       */
      function define(cmd) {
        if (!/^[a-z][a-z0-9_]*$/.test(cmd.name)) throw new Error('A command name is snake_case: ' + cmd.name);
        registry.set(cmd.name, cmd);
        return cmd;
      }
      /** @param {string} name */
      function get(name) { return registry.get(String(name)) || null; }
      /** The commands, as data. @param {{writes?: boolean}} [filter] */
      function list(filter = {}) {
        return Array.from(registry.values()).filter((c) => filter.writes === undefined || c.writes === filter.writes)
          .map((c) => ({ name: c.name, writes: c.writes, description: c.description, parameters: c.parameters }));
      }
      /** The commands as an AI provider's tools. @param {{writes?: boolean}} [filter] */
      function tools(filter = {}) { return list(filter).map((c) => ({ name: c.name, description: c.description + (c.writes ? ' Changes the app: the person approves it first.' : ''), parameters: c.parameters })); }
      /** @param {string} name @param {any} args @returns {string[]} */
      function validate(name, args) {
        const cmd = get(name);
        if (!cmd) return [t('commands.err.unknown', { name: String(name) })];
        return check(cmd.parameters, args === undefined ? {} : args);
      }

      /**
       * Runs a command. Never throws: the answer says what went wrong, so that a caller (or an AI) can act on it.
       * @param {string} name
       * @param {any} args
       * @param {{trusted?: boolean, approve?: (cmd: {name: string, description: string}, args: any) => Promise<boolean>, signal?: AbortSignal}} [options]
       *   trusted: the person runs it themselves (a button, their own flow); approve: asked before a writing command otherwise
       * @returns {Promise<{ok: boolean, result?: any, error?: string, refused?: boolean}>}
       */
      async function run(name, args, options = {}) {
        const cmd = get(name);
        if (!cmd) return { ok: false, error: t('commands.err.unknown', { name: String(name) }) };
        const given = args === undefined ? {} : args;
        const wrong = check(cmd.parameters, given);
        if (wrong.length) return { ok: false, error: t('commands.err.args', { name: cmd.name, detail: wrong.slice(0, 8).join('; ') }) };
        if (cmd.writes && !options.trusted) {
          if (!options.approve) return { ok: false, refused: true, error: t('commands.err.approval', { name: cmd.name }) };
          let yes = false;
          try { yes = (await options.approve({ name: cmd.name, description: cmd.description }, given)) === true; } catch (_e) { yes = false; }
          if (!yes) return { ok: false, refused: true, error: t('commands.err.refused', { name: cmd.name }) };
        }
        if (options.signal && options.signal.aborted) return { ok: false, error: t('commands.err.cancelled') };
        try {
          const result = await cmd.run(present(given), { signal: options.signal });
          return { ok: true, result: result === undefined ? null : JSON.parse(JSON.stringify(result)) };
        } catch (err) {
          console.error('[commands] ' + cmd.name, err);
          return { ok: false, error: String((err && err.message) || err) };
        }
      }

      // ---------------------------------------------------------------------------- reading
      const DATASET = S.str('dataset id or exact name, from list_datasets');
      define({
        name: 'list_datasets', writes: false,
        description: 'The datasets in the workspace: id, name, kind (table, graph, document, images, model, plan …), rows and columns.',
        parameters: S.obj({}),
        async run() {
          return { datasets: (await datasets.list()).map((d) => ({ id: d.id, name: d.name, kind: d.kind || 'table', rows: d.rowCount || 0, columns: d.columnCount || 0 })) };
        },
      });
      define({
        name: 'describe_dataset', writes: false,
        description: 'One dataset: its kind and facts, the columns with their types and labels, the number of rows, and the recipe steps done so far.',
        parameters: S.obj({ dataset: DATASET }),
        async run(a) {
          const d = await dataset(a.dataset);
          const columns = (await datasets.columns(d.id)).map((c) => ({ name: c.name, type: c.type, label: c.label || null }));
          const facts = kinds.facts(d).filter(Boolean).map((f) => ({ label: f.label, value: String(f.value) }));
          const steps = (await recipes.steps(d.id)).map((s) => ({ operation: s.op, description: s.description }));
          return { id: d.id, name: d.name, kind: d.kind || 'table', rows: d.rowCount || 0, columns, facts, recipe: steps };
        },
      });
      const q = (ident) => '"' + String(ident).replace(/"/g, '""') + '"';
      /** A filter as SQL with its values as parameters; the column must exist, so nothing else reaches the statement. */
      function filterSql(f, names) {
        if (!names.includes(f.column)) throw new Error(t('commands.err.column', { name: f.column }));
        const c = q(f.column);
        switch (f.op) {
          case 'is_null': return { sql: `${c} is null`, params: [] };
          case 'not_null': return { sql: `${c} is not null`, params: [] };
          case 'contains': return { sql: `cast(${c} as text) like ? escape '\\'`, params: ['%' + String(f.value).replace(/[\\%_]/g, (x) => '\\' + x) + '%'] };
          case 'starts_with': return { sql: `cast(${c} as text) like ? escape '\\'`, params: [String(f.value).replace(/[\\%_]/g, (x) => '\\' + x) + '%'] };
          default: return { sql: `${c} ${f.op} ?`, params: [typeof f.value === 'boolean' ? (f.value ? 1 : 0) : f.value] };
        }
      }
      define({
        name: 'read_rows', writes: false,
        description: `Rows of a dataset that match every filter, in the order asked for. columns null gives all columns; limit at most ${MAX_ROWS} (default 50). Answers columns, rows (each a list in the order of the columns), total (rows that match) and truncated.`,
        parameters: S.obj({
          dataset: DATASET,
          columns: Object.assign(nullable('array'), { items: { type: 'string' }, description: 'column names, or null for all' }),
          filters: Object.assign(nullable('array'), { items: FILTER, description: 'conditions that must all hold, or null' }),
          order_by: S.strOrNull('column to sort by'),
          descending: S.boolOrNull('sort from the largest'),
          limit: S.intOrNull(`rows to return, 1–${MAX_ROWS}`),
          offset: S.intOrNull('rows to skip'),
        }),
        async run(a) {
          const d = await dataset(a.dataset);
          const all = await datasets.columns(d.id);
          const names = all.map((c) => c.name);
          const want = a.columns && a.columns.length ? a.columns : names;
          for (const n of want) if (!names.includes(n)) throw new Error(t('commands.err.column', { name: n }));
          const parts = (a.filters || []).map((f) => filterSql(f, names));
          const where = parts.length ? { sql: parts.map((p) => p.sql).join(' and '), params: parts.flatMap((p) => p.params) } : undefined;
          if (a.order_by && !names.includes(a.order_by)) throw new Error(t('commands.err.column', { name: a.order_by }));
          const limit = Math.max(1, Math.min(MAX_ROWS, Number(a.limit) || 50));
          const rows = await datasets.query(d.id, { where, orderBy: a.order_by, dir: a.descending ? 'desc' : 'asc', limit, offset: Math.max(0, Number(a.offset) || 0) });
          const total = await datasets.count(d.id, { where });
          const idx = want.map((n) => names.indexOf(n));
          return { columns: want, rows: rows.map((r) => idx.map((i) => r[i])), total, truncated: total > (Number(a.offset) || 0) + rows.length };
        },
      });
      define({
        name: 'column_stats', writes: false,
        description: 'Summary of one column: rows, values, missing, distinct values, min, max, mean, sum and the most common values.',
        parameters: S.obj({ dataset: DATASET, column: S.str('column name') }),
        async run(a) {
          const d = await dataset(a.dataset);
          const s = await datasets.columnStats(d.id, a.column);
          if (!s || !s.column) throw new Error(t('commands.err.column', { name: a.column }));
          return { column: a.column, type: s.column.type, rows: s.total, values: s.nonNull, missing: s.nulls, distinct: s.distinct, min: s.min, max: s.max, mean: s.mean, sum: s.sum, top: s.top };
        },
      });
      define({
        name: 'run_sql', writes: false,
        description: `One SQLite statement that only reads (SELECT, WITH … SELECT or VALUES) on a dataset's table "data"; other datasets can be named by their short names. Anything that would change data is refused. At most ${MAX_ROWS} rows come back.`,
        parameters: S.obj({ dataset: DATASET, sql: S.str('the statement') }),
        async run(a) {
          const d = await dataset(a.dataset);
          try {
            const r = await query.select(d.id, String(a.sql).trim().replace(/;\s*$/, ''), { limit: MAX_ROWS, readOnly: true });
            return { columns: r.columns, rows: r.values, truncated: r.truncated };
          } catch (err) {
            if (/DM_READ_ONLY|readonly|query_only/i.test(String(err && err.message))) throw new Error(t('commands.err.readonly'));
            throw err;
          }
        },
      });
      define({
        name: 'list_operations', writes: false,
        description: 'The operations of Bearbeta that apply_operation can run: id, group, what kind of dataset they are for, and their title. group null lists all.',
        parameters: S.obj({ group: S.strOrNull('only this group (column, values, rows, structure, calc, timeseries, regex, geo, graph, model, code)') }),
        async run(a) {
          return { operations: ops.list().filter((op) => !a.group || op.group === a.group).map((op) => ({ id: op.id, group: op.group || null, for: forKind(op), title: title(op.id) })) };
        },
      });
      define({
        name: 'describe_operation', writes: false,
        description: 'One operation: what it does and its parameters as JSON Schema, for the params of apply_operation.',
        parameters: S.obj({ operation: S.str('operation id from list_operations') }),
        async run(a) {
          const op = operation(a.operation);
          const help = t('op.' + op.id + '.help');
          return { id: op.id, group: op.group || null, for: forKind(op), title: title(op.id), help: help === 'op.' + op.id + '.help' ? null : help, parameters: operationSchema(op) };
        },
      });
      define({
        name: 'list_items', writes: false,
        description: 'Saved things by type: flows, charts, dashboards, documents (templates), scripts (R and Python) or lists (from Söka), with id and name.',
        parameters: S.obj({ type: S.oneOf(Object.keys(ITEMS), 'what to list') }),
        async run(a) {
          return { items: (await ITEMS[a.type]()).map((x) => Object.assign({ id: x.id, name: x.name }, x.language ? { language: x.language } : {}, x.datasetId ? { dataset: x.datasetId } : {})) };
        },
      });
      define({
        name: 'list_files', writes: false,
        description: 'The files the commands have made in this session (exports, charts, documents), which the person fetches from the app.',
        parameters: S.obj({}),
        async run() { return { files: files() }; },
      });

      // ---------------------------------------------------------------------------- operations
      function operation(id) { try { return ops.get(id); } catch (_e) { throw new Error(t('commands.err.operation', { name: String(id) })); } }
      function title(id) { const s = t('op.' + id); return s === 'op.' + id ? id : s; }
      const forKind = (op) => (op.group === 'graph' ? 'graph' : op.group === 'model' ? 'model' : 'table');
      const PARAM_TYPES = { column: { type: 'string', description: 'column name' }, columns: { type: 'array', items: { type: 'string' }, description: 'column names' }, number: { type: 'number' }, switch: { type: 'boolean' } };
      /** An operation's parameters as JSON Schema. */
      function operationSchema(op) {
        const properties = {}; const required = [];
        for (const p of op.params || []) {
          const base = p.type === 'select' ? { type: 'string', enum: (p.options || []).map((o) => (o && typeof o === 'object' ? o.value : o)) } : Object.assign({}, PARAM_TYPES[p.type] || { type: 'string' });
          const label = t('op.' + op.id + '.' + p.name);
          if (label !== 'op.' + op.id + '.' + p.name) base.description = label;
          if (p.default !== undefined) base.default = p.default;
          properties[p.name] = base;
          if (p.required) required.push(p.name);
        }
        return { type: 'object', properties, required, additionalProperties: false };
      }
      define({
        name: 'apply_operation', writes: true,
        description: 'Runs one operation of Bearbeta on a dataset, as a recipe step that can be undone. params is a JSON object as text, with the parameters describe_operation gives.',
        parameters: S.obj({ dataset: DATASET, operation: S.str('operation id'), params: S.str('the parameters as a JSON object, e.g. {"column": "a", "name": "b"}') }),
        async run(a) {
          const d = await dataset(a.dataset);
          const op = operation(a.operation);
          let params;
          try { params = JSON.parse(a.params || '{}'); } catch (_e) { throw new Error(t('commands.err.json')); }
          const wrong = check(operationSchema(op), params);
          if (wrong.length) throw new Error(t('commands.err.args', { name: op.id, detail: wrong.slice(0, 8).join('; ') }));
          for (const p of op.params || []) if (params[p.name] === undefined && p.default !== undefined) params[p.name] = p.default;
          const result = await recipes.apply(d.id, op.id, params);
          const after = await datasets.get(d.id);
          return { done: recipes.describe(op.id, params, result), rows: after ? after.rowCount || 0 : null, columns: after ? after.columnCount || 0 : null, changed: typeof result.rows === 'number' ? result.rows : null };
        },
      });
      define({
        name: 'undo', writes: true,
        description: 'Undoes the last recipe step on a dataset in this session.',
        parameters: S.obj({ dataset: DATASET }),
        async run(a) {
          const d = await dataset(a.dataset);
          if (!recipes.canUndo(d.id)) throw new Error(t('recipe.err.nothing.undo'));
          return { undone: await recipes.undo(d.id) };
        },
      });

      // ---------------------------------------------------------------------------- the steps of flows
      /** A command from a flow step: the same code, with references by id or name and the files kept here. */
      function fromStep(type, name, description, parameters, toParams) {
        define({
          name, writes: true, description, parameters,
          async run(a, ctx) {
            const out = await flows.STEPS[type].run(await toParams(a), { signal: ctx.signal, step: {} });
            const made = keep(out.files);
            return Object.assign({ done: out.message || '' }, made.length ? { files: made } : {});
          },
        });
      }
      fromStep('refresh', 'refresh_dataset', 'Fetches a dataset again from its source and replays its recipe, as the button Uppdatera; dataset null fetches every dataset from an API. Asks for consent to the network.',
        S.obj({ dataset: Object.assign(nullable('string'), { description: 'dataset id or name, or null for all' }) }),
        async (a) => ({ datasetId: a.dataset ? (await dataset(a.dataset)).id : '' }));
      fromStep('recipe', 'replay_recipe', 'Does the recipe of one dataset again on another.',
        S.obj({ from: S.str('dataset whose recipe is used'), to: S.str('dataset it is done on') }),
        async (a) => ({ from: (await dataset(a.from)).id, to: (await dataset(a.to)).id }));
      fromStep('code', 'run_script', 'Runs a saved R or Python script from Analysera; datasets it writes with dm_write() become datasets.',
        S.obj({ script: S.str('script id or name, from list_items scripts') }),
        async (a) => ({ scriptId: (await item('scripts', a.script, 'script')).id }));
      fromStep('list', 'list_to_dataset', 'Runs a saved list or question from Söka and keeps its hits as a dataset.',
        S.obj({ list: S.str('list id or name'), name: S.strOrNull('the new dataset\'s name, or null for the list\'s') }),
        async (a) => ({ listId: (await item('lists', a.list, 'list')).id, name: a.name || '' }));
      fromStep('chart', 'render_chart', 'Draws a saved chart with today\'s data as a file; with group_column one chart per value, in a ZIP.',
        S.obj({ chart: S.str('chart id or name'), format: S.oneOf(['png', 'svg', 'pdf'], 'file format'), group_column: S.strOrNull('column to make one chart per value of') }),
        async (a) => ({ chartId: (await item('charts', a.chart, 'chart')).id, format: a.format, groupColumn: a.group_column || '' }));
      fromStep('dashboard', 'dashboard_html', 'Writes a saved dashboard as a standalone HTML file.',
        S.obj({ dashboard: S.str('dashboard id or name') }),
        async (a) => ({ dashboardId: (await item('dashboards', a.dashboard, 'dashboard')).id }));
      fromStep('document', 'generate_document', 'Fills a document template with a dataset\'s data; with group_column one document per value, in a ZIP.',
        S.obj({ document: S.str('template id or name'), dataset: DATASET, format: S.oneOf(['docx', 'pdf', 'html', 'md', 'tex'], 'file format'), group_column: S.strOrNull('column to make one document per value of') }),
        async (a) => ({ documentId: (await item('documents', a.document, 'document')).id, datasetId: (await dataset(a.dataset)).id, format: a.format, groupColumn: a.group_column || '' }));
      fromStep('export', 'export_dataset', 'Writes a dataset as a file.',
        S.obj({ dataset: DATASET, format: S.oneOf(['csv', 'xlsx', 'ods', 'json', 'geojson', 'xml', 'sqlite'], 'file format') }),
        async (a) => ({ datasetId: (await dataset(a.dataset)).id, format: a.format }));
      define({
        name: 'run_flow', writes: true,
        description: 'Runs a saved flow from start to end; answers how each step went and the files it made.',
        parameters: S.obj({ flow: S.str('flow id or name') }),
        async run(a) {
          const flow = await item('flows', a.flow, 'flow');
          const r = await flows.run(await flows.get(flow.id));
          const out = await flows.output(flow.id);
          return { ok: r.ok, steps: r.steps.map((s) => ({ type: s.type, ok: s.ok, message: s.message })), files: out ? keep([out]) : [] };
        },
      });

      // ---------------------------------------------------------------------------- code
      /** What a run of R or Python gave, as data: text, the error, new datasets and the number of plots. */
      function codeAnswer(res) {
        const entries = (res && res.entries) || [];
        const error = entries.find((e) => e.kind === 'error');
        if (error) throw new Error(String(error.text || '').slice(0, MAX_TEXT));
        const text = entries.filter((e) => e.kind === 'stdout' || e.kind === 'stderr' || e.kind === 'text').map((e) => e.text).join('');
        return {
          output: text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text, cut: text.length > MAX_TEXT,
          datasets: entries.filter((e) => e.kind === 'dataset' && e.meta).map((e) => ({ id: e.meta.id, name: e.meta.name })),
          plots: entries.filter((e) => e.kind === 'plot' || e.kind === 'image').length,
        };
      }
      define({
        name: 'run_r', writes: true,
        description: 'Runs R code in the app\'s R (WebR) with the datasets under /data, as the R console in Analysera; tables written with dm_write() become datasets. Answers the printed output, new datasets and the number of plots.',
        parameters: S.obj({ code: S.str('R code') }),
        async run(a) { return codeAnswer(await D.require('data/r-bridge').bridge.run(String(a.code))); },
      });
      define({
        name: 'run_python', writes: true,
        description: 'Runs Python code in the app\'s Python (Pyodide) with the datasets under /data, as the Python console in Analysera; tables written with dm_write() become datasets. Python starts when the person approves. Answers the printed output, new datasets and the number of plots.',
        parameters: S.obj({ code: S.str('Python code') }),
        async run(a) { return codeAnswer(await D.require('data/python-bridge').bridge.run(String(a.code))); },
      });

      return { define, get, list, tools, validate, run, check, files, take, operationSchema, MAX_ROWS };
    });
})();
