// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Flows: a saved chain of steps that runs with one click or when the app starts. Every step already exists elsewhere in
 * the app (fetching again with the recipe replayed, recipes, R and Python scripts, saved lists, charts, dashboards,
 * documents, export); a flow only binds them together and keeps a log. The files a flow produces stay in memory until
 * the user fetches them: a flow never sends anything out of the app, since everything that leaves goes through the
 * review in Dela. A flow that runs at start skips itself rather than ask for anything: it needs its consents already
 * given. Flows are stored as settings (`flow:<id>`) and travel in backups, not in bundles.
 * A step can also be one of the app's commands (data/commands), and plans can choose (decision F31 a, F33 b): a step with an id keeps
 * its answer for later steps; `if` runs `steps` or `otherwise` after a condition (data/conditions, read and never run as code);
 * `each` runs its steps for every value of a list and `repeat` until a condition holds, both within `max_rounds` and `max_seconds`
 * and answering `rounds` and `reason`; `stop` ends the flow; `ask` asks the person through the asker the shell gives (F34 a), and a
 * flow that asks never runs at start. Cancelling is checked before every step and after every round, and a
 * pause ends at once.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/flows', ['platform/storage/idb', 'platform/consent', 'platform/storage/zip', 'platform/files', 'data/datasets', 'data/recipes', 'data/lists', 'api/runner', 'viz/charts', 'viz/render', 'viz/batch', 'viz/dashboards', 'docgen/documents', 'docgen/generate', 'io/export', 'data/r-bridge', 'data/python-bridge', 'data/conditions'],
    (idb, consent, zip, files, datasets, recipes, lists, runner, charts, render, batch, dashboards, documents, generate, exporter, rBridge, pyBridge, conditions) => {
      const PREFIX = 'flow:';
      const FORMAT = 'dataspatium-flow/1';
      const HISTORY = 20;
      const MAX_DEPTH = 8;
      const DEFAULT_ROUNDS = 100;
      const MAX_ROUNDS = 1000;
      const MAX_SECONDS = 86400;
      const MAX_LOG = 500;
      const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
      const listeners = new Set();
      const notify = (type, payload) => { for (const fn of Array.from(listeners)) { try { fn(type, payload); } catch (err) { console.error('[flows] listener failed', err); } } };
      /** @param {(type: 'saved'|'deleted'|'start'|'step'|'end', payload: any) => void} fn */
      function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
      const uid = () => 'flow_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      /** @type {{flow: any, index: number, controller: AbortController}|null} */ let running = null;
      /** @type {Map<string, Array<{name: string, blob: Blob}>>} */ const outputs = new Map();
      const t = (key, params) => D.t(key, params);
      const need = (value, message) => { if (!value) throw new Error(message); return value; };
      async function datasetOf(id) { return need(id && (await datasets.get(id)), t('flows.err.dataset')); }

      /** The steps a flow can have. `fields` tells the editor what to ask for. */
      const STEPS = {
        refresh: {
          icon: 'refresh-cw',
          fields: [{ name: 'datasetId', type: 'refreshable', optional: true }],
          /** Which consents the step needs when it runs without anyone at the keyboard. */
          async blockers(p) {
            const list = p.datasetId ? [await datasets.get(p.datasetId)] : (await datasets.list()).filter((d) => d.source && (d.source.kind === 'api'));
            if (list.some((d) => d && d.source && d.source.kind === 'api') && (await consent.state('api')) !== 'granted') return [t('flows.block.consent', { purpose: t('consent.purpose.api') })];
            if (list.some((d) => d && d.source && d.source.kind === 'bridge')) return [t('flows.block.bridge')];
            return [];
          },
          async run(p, ctx) {
            if (p.datasetId) {
              const ds = await datasetOf(p.datasetId);
              const res = await runner.refreshDataset(ds.id, { signal: ctx.signal, fetch: ctx.fetch });
              return { message: t('flows.done.refresh', { name: ds.name, rows: D.require('ui/i18n').formatNumber(res.rows) }) };
            }
            const results = await runner.refreshAll({ signal: ctx.signal, fetch: ctx.fetch });
            const failed = results.filter((r) => !r.ok);
            if (failed.length) throw new Error(failed.map((f) => `${f.name}: ${f.error}`).join('; '));
            return { message: t('flows.done.refresh.all', { n: results.length }) };
          },
        },
        recipe: {
          icon: 'list-checks',
          fields: [{ name: 'from', type: 'dataset' }, { name: 'to', type: 'dataset' }],
          async run(p) {
            const from = await datasetOf(p.from); const to = await datasetOf(p.to);
            const steps = await recipes.steps(from.id);
            await recipes.replay(to.id, steps);
            return { message: t('flows.done.recipe', { n: steps.length, name: to.name }) };
          },
        },
        code: {
          icon: 'code',
          fields: [{ name: 'scriptId', type: 'script' }],
          async blockers(p) {
            const script = p.scriptId ? await idb.getScript(p.scriptId) : null;
            if (script && script.language === 'python' && !(await D.require('engines/python/catalog').cachedRuntime())) return [t('flows.block.python')];
            return [];
          },
          async run(p) {
            const script = need(p.scriptId && (await idb.getScript(p.scriptId)), t('flows.err.script'));
            if (script.language !== 'r' && script.language !== 'python') throw new Error(t('flows.err.script'));
            const bridge = script.language === 'python' ? pyBridge.bridge : rBridge.bridge;
            const res = await bridge.run(script.code);
            const failed = res.entries.find((e) => e.kind === 'error');
            if (failed) throw new Error(failed.text);
            const made = res.entries.filter((e) => e.kind === 'dataset').map((e) => e.meta.name);
            return { message: made.length ? t('flows.done.code.datasets', { name: script.name, datasets: made.join(', ') }) : t('flows.done.code', { name: script.name }) };
          },
        },
        list: {
          icon: 'search',
          fields: [{ name: 'listId', type: 'list' }, { name: 'name', type: 'text' }],
          /** The hits become a dataset; the next run updates the same dataset, so charts on it keep working. */
          async run(p, ctx) {
            const rec = need(p.listId && (await lists.get(p.listId)), t('flows.err.list'));
            const name = String(p.name || '').trim() || rec.name;
            const made = await lists.toDataset(rec, name);
            const old = ctx.step.targetId ? await datasets.get(ctx.step.targetId) : null;
            if (!old) { ctx.step.targetId = made.id; return { message: t('flows.done.list', { name, rows: D.require('ui/i18n').formatNumber(made.rowCount || 0) }) }; }
            const handle = await datasets.ensureOpen(made.id);
            const columns = handle.columns.map((c) => ({ name: c.name, type: c.type, label: c.label }));
            const res = await handle.engine.exec(`select ${columns.map((c) => '"' + c.name.replace(/"/g, '""') + '"').join(', ')} from data`);
            await datasets.rebuild(old.id, { columns, rows: res[0] ? res[0].values : [], source: old.source });
            await datasets.save(old.id);
            await datasets.remove(made.id);
            return { message: t('flows.done.list', { name: old.name, rows: D.require('ui/i18n').formatNumber((res[0] ? res[0].values : []).length) }) };
          },
        },
        chart: {
          icon: 'chart-column',
          fields: [{ name: 'chartId', type: 'chart' }, { name: 'format', type: 'select', options: ['png', 'svg', 'pdf'] }, { name: 'groupColumn', type: 'text', optional: true }],
          async run(p) {
            const chart = need(p.chartId && (await charts.get(p.chartId)), t('flows.err.chart'));
            const format = p.format || 'png';
            if (p.groupColumn) {
              const out = await batch.run(chart, { groupColumn: p.groupColumn, formats: [format], pattern: '{diagram}-{grupp}' });
              return { message: t('flows.done.chart.batch', { name: chart.name, n: out.count }), files: [{ name: files.safeName(chart.name, 'zip'), blob: out.blob }] };
            }
            const blob = await render.toBlob(chart, format, { width: 1000, scale: 2, title: chart.name });
            return { message: t('flows.done.file', { name: chart.name }), files: [{ name: files.safeName(chart.name, format), blob }] };
          },
        },
        dashboard: {
          icon: 'layout-grid',
          fields: [{ name: 'dashboardId', type: 'dashboard' }],
          async run(p) {
            const dash = need(p.dashboardId && (await dashboards.get(p.dashboardId)), t('flows.err.dashboard'));
            const html = await dashboards.toHtml(dash);
            return { message: t('flows.done.file', { name: dash.name }), files: [{ name: files.safeName(dash.name, 'html'), blob: new Blob([html], { type: 'text/html;charset=utf-8' }) }] };
          },
        },
        document: {
          icon: 'file-text',
          fields: [{ name: 'documentId', type: 'document' }, { name: 'datasetId', type: 'dataset' }, { name: 'format', type: 'select', options: ['docx', 'pdf', 'html', 'md', 'tex'] }, { name: 'groupColumn', type: 'text', optional: true }],
          async run(p) {
            const doc = need(p.documentId && (await documents.get(p.documentId)), t('flows.err.document'));
            const ds = await datasetOf(p.datasetId);
            const format = p.format || 'docx';
            if (p.groupColumn) {
              const out = await generate.batch(doc, ds.id, { groupColumn: p.groupColumn, format });
              return { message: t('flows.done.chart.batch', { name: doc.name, n: out.count }), files: [{ name: files.safeName(doc.name, 'zip'), blob: out.blob }] };
            }
            const out = await generate.generate(doc, ds.id, format);
            return { message: t('flows.done.file', { name: out.filename }), files: [{ name: out.filename, blob: out.blob }] };
          },
        },
        export: {
          icon: 'download',
          fields: [{ name: 'datasetId', type: 'dataset' }, { name: 'format', type: 'select', options: ['csv', 'xlsx', 'ods', 'json', 'geojson', 'xml', 'sqlite'] }],
          async run(p) {
            const ds = await datasetOf(p.datasetId);
            const out = await exporter.exportDataset(ds.id, p.format || 'csv');
            return { message: t('flows.done.file', { name: out.filename }), files: [{ name: out.filename, blob: out.blob }] };
          },
        },
        command: {
          icon: 'terminal',
          fields: [{ name: 'command', type: 'command' }, { name: 'args', type: 'json', optional: true }],
          async blockers(p) {
            if (p.command === 'run_python' && !(await D.require('engines/python/catalog').cachedRuntime())) return [t('flows.block.python')];
            if (p.command === 'refresh_dataset' && (await consent.state('api')) !== 'granted') return [t('flows.block.consent', { purpose: t('consent.purpose.api') })];
            return [];
          },
          /** The person's own flow runs its commands as their own; the answers of earlier steps go into the arguments. */
          async run(p, ctx) {
            const commands = D.require('data/commands');
            const args = conditions.fill(argsOf(p.args), ctx.scope || {});
            const out = await commands.run(String(p.command || ''), args, { trusted: true, signal: ctx.signal });
            if (!out.ok) throw new Error(out.error);
            const made = ((out.result && out.result.files) || []).map((name) => commands.take(name)).filter(Boolean);
            return { message: t('flows.done.command', { name: String(p.command) }), value: out.result, files: made };
          },
        },
        if: { icon: 'git-branch', branches: ['steps', 'otherwise'], fields: [{ name: 'condition', type: 'condition' }] },
        each: { icon: 'list-ordered', branches: ['steps'], fields: [{ name: 'items', type: 'condition' }, { name: 'as', type: 'text', optional: true }, { name: 'max_rounds', type: 'number', optional: true }, { name: 'max_seconds', type: 'number', optional: true }] },
        repeat: { icon: 'repeat', branches: ['steps'], fields: [{ name: 'until', type: 'condition' }, { name: 'wait_seconds', type: 'number', optional: true }, { name: 'max_rounds', type: 'number', optional: true }, { name: 'max_seconds', type: 'number', optional: true }] },
        stop: { icon: 'octagon-x', fields: [{ name: 'message', type: 'text', optional: true }] },
        ask: {
          icon: 'circle-help',
          fields: [{ name: 'question', type: 'text' }, { name: 'options', type: 'lines' }, { name: 'free', type: 'switch', optional: true }],
          /** Start never asks, so a flow with a question waits for someone to run it. */
          async blockers() { return [t('flows.block.ask')]; },
          async run(p, ctx) {
            if (!asker) throw new Error(t('flows.err.ask'));
            const scope = ctx.scope || {};
            const question = String(conditions.fill(String(p.question || ''), scope)).trim();
            // One answer per line, as "label" or "label | what it means".
            const options = String(conditions.fill(String(p.options || ''), scope)).split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 6)
              .map((line) => { const k = line.indexOf('|'); return k < 0 ? { label: line } : { label: line.slice(0, k).trim(), description: line.slice(k + 1).trim() }; });
            if (!question || (!options.length && !p.free)) throw new Error(t('flows.err.ask.empty'));
            const answer = await asker({ question, options, free: !!p.free, signal: ctx.signal });
            if (!answer) throw { halt: 'aborted' };
            return { message: t('flows.done.ask', { answer: answer.answer }), value: answer };
          },
        },
      };
      /** @type {((q: {question: string, options: any[], free: boolean, signal?: AbortSignal}) => Promise<any>)|null} */ let asker = null;
      /** Who answers the step ask: the shell's dialog, a test's stand-in, or nobody (the step then fails). */
      function setAsker(fn) { asker = typeof fn === 'function' ? fn : null; }
      /** A command step's arguments: an object, or JSON text from the editor. */
      function argsOf(a) {
        if (a && typeof a === 'object') return a;
        const s = String(a || '').trim();
        if (!s) return {};
        try { const v = JSON.parse(s); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch (_e) { /* below */ }
        throw new Error(t('flows.err.args'));
      }
      const STEP_TYPES = Object.keys(STEPS);

      async function list() {
        const rows = await idb.listSettings(PREFIX);
        return rows.map((r) => r.value).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      }
      async function get(id) { return idb.getSetting(PREFIX + id, null); }
      function blank(name) { return { id: null, name: name || '', description: '', onStart: false, continueOnError: false, steps: [], lastRun: null, history: [] }; }
      function cleanStep(s, depth = 0) {
        const type = STEP_TYPES.includes(s.type) ? s.type : 'export';
        const out = { type, params: Object.assign({}, s.params || {}), targetId: s.targetId || undefined };
        if (s.id && NAME.test(String(s.id))) out.id = String(s.id);
        for (const b of STEPS[type].branches || []) out[b] = depth < MAX_DEPTH && Array.isArray(s[b]) ? s[b].map((x) => cleanStep(x || {}, depth + 1)) : [];
        return out;
      }
      /** @param {any} input @returns {Promise<any>} the stored flow */
      async function save(input) {
        const now = new Date().toISOString();
        const rec = {
          id: input.id || uid(), name: String(input.name || '').trim() || t('flows.untitled'), description: String(input.description || ''),
          onStart: !!input.onStart, continueOnError: !!input.continueOnError, steps: (input.steps || []).map(cleanStep),
          lastRun: input.lastRun || null, history: input.history || [], createdAt: input.createdAt || now, updatedAt: now,
        };
        await idb.setSetting(PREFIX + rec.id, rec);
        notify('saved', rec);
        return rec;
      }
      async function remove(id) { await idb.deleteSetting(PREFIX + id); outputs.delete(id); notify('deleted', { id }); }
      /** A flow as a file: references to datasets and scripts stay ids, and no run history or secrets travel. */
      function exportJson(flow) {
        return JSON.stringify({ format: FORMAT, id: flow.id, name: flow.name, description: flow.description, onStart: false, continueOnError: !!flow.continueOnError, steps: flow.steps.map(cleanStep) }, null, 2) + '\n';
      }
      /** A flow from a file. It never starts by itself until the user says so here. */
      async function importJson(text) {
        const obj = JSON.parse(text);
        if (!obj || obj.format !== FORMAT || !Array.isArray(obj.steps)) throw new Error(t('flows.err.file'));
        return save({ id: obj.id, name: obj.name, description: obj.description, onStart: false, continueOnError: obj.continueOnError, steps: obj.steps });
      }

      /** What is wrong with a list of steps (a type the app lacks, a command it lacks, too deep), or null when it can run. */
      function check(steps, depth = 0) {
        if (!Array.isArray(steps)) return t('flows.err.steps');
        if (depth > MAX_DEPTH) return t('flows.err.deep');
        for (const s of steps) {
          if (!s || typeof s !== 'object' || !STEP_TYPES.includes(s.type)) return t('flows.err.step.type', { type: String(s && s.type) });
          if (s.type === 'command' && !D.require('data/commands').get(s.params && s.params.command)) return t('flows.err.step.command', { name: String((s.params && s.params.command) || '') });
          for (const b of STEPS[s.type].branches || []) { const problem = check(s[b] || [], depth + 1); if (problem) return problem; }
        }
        return null;
      }
      /** The flow running now, or null. */
      function current() { return running ? { id: running.flow.id, name: running.flow.name, index: running.index, total: running.flow.steps.length } : null; }
      /** Stops the running flow before its next step. */
      function cancel() { if (running) running.controller.abort(); }

      /**
       * Runs a flow's steps in order. It stops at the first error unless the flow says to go on.
       * @param {any} flow a stored flow
       * @param {{fetch?: Function}} [options] fetch is injectable for tests
       * @returns {Promise<{flowId: string, name: string, ok: boolean, aborted: boolean, startedAt: string, endedAt: string, steps: any[], files: string[]}>}
       */
      async function run(flow, options = {}) {
        if (running) throw new Error(t('flows.err.busy', { name: running.flow.name }));
        const controller = new AbortController();
        const working = JSON.parse(JSON.stringify(flow));
        running = { flow: working, index: 0, controller };
        const result = { flowId: working.id, name: working.name, ok: true, aborted: false, startedAt: new Date().toISOString(), endedAt: '', steps: [], files: [] };
        const frame = { scope: {}, signal: controller.signal, fetch: options.fetch, result, made: [], continueOnError: !!working.continueOnError };
        notify('start', current());
        try {
          await runSteps(working.steps, frame, '');
        } catch (halt) {
          if (halt && halt.halt === 'aborted') { result.aborted = true; result.ok = false; }
          else if (halt && halt.halt === 'stop') result.stopped = halt.message;
          else if (!(halt && halt.halt === 'error')) { result.ok = false; logLine(frame, { type: 'flow', path: '', ok: false, ms: 0, message: String((halt && halt.message) || halt) }); }
        } finally {
          result.endedAt = new Date().toISOString();
          running = null;
        }
        const made = frame.made;
        if (made.length) outputs.set(working.id, made); else outputs.delete(working.id);
        // The newest copy on disk may have been edited meanwhile: only the log and the targets of the steps are written back.
        const stored = await get(working.id);
        if (stored) {
          stored.lastRun = result;
          stored.history = [result].concat(stored.history || []).slice(0, HISTORY);
          stored.steps = withTargets(stored.steps, working.steps);
          await idb.setSetting(PREFIX + stored.id, stored);
        }
        notify('end', result);
        return result;
      }
      /** The targets the steps found (a list's dataset) written into the stored steps, branch by branch. */
      function withTargets(storedSteps, workSteps) {
        return (storedSteps || []).map((s, i) => {
          const w = (workSteps || [])[i];
          if (!w || w.type !== s.type) return s;
          const out = w.targetId ? Object.assign({}, s, { targetId: w.targetId }) : Object.assign({}, s);
          for (const b of (STEPS[s.type] && STEPS[s.type].branches) || []) out[b] = withTargets(s[b], w[b]);
          return out;
        });
      }
      /** One line in the run's log; a long run keeps the first MAX_LOG lines and counts the rest. */
      function logLine(frame, line) { if (frame.result.steps.length < MAX_LOG) frame.result.steps.push(line); else frame.result.cut = (frame.result.cut || 0) + 1; }
      const sleep = (ms, signal) => new Promise((resolve) => {
        if (signal.aborted || ms <= 0) { resolve(); return; }
        const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, ms);
        signal.addEventListener('abort', done, { once: true });
      });
      /** Runs a list of steps; a halt (cancelled, stopped by the plan, an error that ends the flow) is thrown upwards. */
      async function runSteps(list, frame, path) {
        for (let i = 0; i < list.length; i++) {
          if (frame.signal.aborted) throw { halt: 'aborted' };
          const step = list[i];
          const at = path ? path + '.' + (i + 1) : String(i + 1);
          const def = STEPS[step.type];
          const p = step.params || {};
          if (!path && running) running.index = i;
          notify('step', Object.assign(current() || {}, { type: step.type, label: t('flows.step.' + step.type), path: at }));
          const t0 = performance.now();
          const ms = () => Math.round(performance.now() - t0);
          try {
            if (step.type === 'if') {
              const yes = conditions.test(String(p.condition || ''), frame.scope);
              logLine(frame, { type: 'if', path: at, ok: true, ms: 0, message: t(yes ? 'flows.done.if.then' : 'flows.done.if.else', { condition: String(p.condition || '') }) });
              await runSteps((yes ? step.steps : step.otherwise) || [], frame, at);
              continue;
            }
            if (step.type === 'each' || step.type === 'repeat') {
              const answer = await loop(step, frame, at);
              if (step.id) frame.scope[step.id] = answer;
              continue;
            }
            if (step.type === 'stop') {
              const message = String(conditions.fill(String(p.message || ''), frame.scope) || '') || t('flows.stopped.plan');
              logLine(frame, { type: 'stop', path: at, ok: true, ms: 0, message });
              throw { halt: 'stop', message };
            }
            const out = await def.run(p, { signal: frame.signal, fetch: frame.fetch, step, scope: frame.scope });
            for (const f of out.files || []) { frame.made.push(f); frame.result.files.push(f.name); }
            if (step.id) frame.scope[step.id] = out.value !== undefined ? out.value : { message: out.message || '', files: (out.files || []).map((f) => f.name) };
            logLine(frame, { type: step.type, path: at, ok: true, ms: ms(), message: out.message || '' });
          } catch (err) {
            if (err && err.halt) throw err;
            logLine(frame, { type: step.type, path: at, ok: false, ms: ms(), message: String((err && err.message) || err) });
            frame.result.ok = false;
            if (!frame.continueOnError) throw { halt: 'error' };
          }
        }
      }
      /**
       * `each` and `repeat`: rounds within the limits, the first limit reached ending the loop; cancelling is checked after
       * every round, and a pause ends at once. @returns {Promise<{rounds: number, reason: 'done'|'until'|'rounds'|'time'}>}
       */
      async function loop(step, frame, at) {
        const p = step.params || {};
        const t0 = performance.now();
        const maxRounds = Math.max(1, Math.min(MAX_ROUNDS, Math.floor(Number(p.max_rounds)) || DEFAULT_ROUNDS));
        const maxMs = Number(p.max_seconds) > 0 ? Math.min(MAX_SECONDS, Number(p.max_seconds)) * 1000 : Infinity;
        const left = () => maxMs - (performance.now() - t0);
        let items = null;
        if (step.type === 'each') {
          const v = conditions.value(String(p.items || ''), frame.scope);
          // A number n gives the rounds 1 … n, as for i in range.
          items = Array.isArray(v) ? v : typeof v === 'number' ? Array.from({ length: Math.max(0, Math.min(MAX_ROUNDS, Math.floor(v))) }, (_x, i) => i + 1) : v === null ? [] : [v];
        }
        const as = NAME.test(String(p.as || '')) ? String(p.as) : 'item';
        const total = items ? Math.min(items.length, maxRounds) : maxRounds;
        const halted = (rounds) => { logLine(frame, { type: step.type, path: at, ok: false, ms: Math.round(performance.now() - t0), message: t('flows.stopped.round', { n: rounds, total }) }); return { halt: 'aborted' }; };
        let rounds = 0; let reason = 'done';
        for (;;) {
          if (items && rounds >= items.length) { reason = 'done'; break; }
          if (rounds >= maxRounds) { reason = 'rounds'; break; }
          if (left() <= 0) { reason = 'time'; break; }
          if (frame.signal.aborted) throw halted(rounds);
          if (items) { frame.scope[as] = items[rounds]; frame.scope.index = rounds; } else frame.scope.round = rounds + 1;
          rounds++;
          try { await runSteps(step.steps || [], frame, `${at}#${rounds}`); } catch (err) { if (err && err.halt === 'aborted') throw halted(rounds); throw err; }
          if (frame.signal.aborted) throw halted(rounds);
          if (step.type === 'repeat') {
            if (conditions.test(String(p.until || ''), frame.scope)) { reason = 'until'; break; }
            const wait = Math.max(0, Math.min(MAX_SECONDS, Number(p.wait_seconds) || 0)) * 1000;
            if (wait && rounds < maxRounds) await sleep(Math.min(wait, left()), frame.signal);
          }
        }
        logLine(frame, { type: step.type, path: at, ok: true, ms: Math.round(performance.now() - t0), message: t('flows.done.loop.' + reason, { n: rounds }) });
        return { rounds, reason };
      }
      /** What the last run produced: one file as it is, several in a ZIP; null when there is nothing. */
      async function output(flowId) {
        const made = outputs.get(flowId);
        if (!made || !made.length) return null;
        if (made.length === 1) return made[0];
        const entries = {};
        for (const f of made) {
          let name = f.name; let n = 2;
          while (entries[name]) { name = f.name.replace(/(\.[^.]+)?$/, ` ${n}$1`); n++; }
          entries[name] = new Uint8Array(await f.blob.arrayBuffer());
        }
        const flow = await get(flowId);
        return { name: files.safeName(flow ? flow.name : 'flode', 'zip'), blob: await zip.createZip(entries, { level: 6 }) };
      }
      function hasOutput(flowId) { return !!(outputs.get(flowId) || []).length; }

      /** Why a flow cannot run without anyone at the keyboard; empty when it can. */
      async function blockers(flow) {
        const out = [];
        const walk = async (list, depth) => {
          for (const step of list || []) {
            const def = STEPS[step.type];
            if (def && def.blockers) out.push(...await def.blockers(step.params || {}));
            if (def && depth < MAX_DEPTH) for (const b of def.branches || []) await walk(step[b], depth + 1);
          }
        };
        await walk(flow.steps, 0);
        return Array.from(new Set(out));
      }
      let startDone = false;
      /**
       * Runs the flows marked to run at start, once per page, one at a time. A flow that would have to ask for anything is
       * skipped and reported instead.
       * @param {{force?: boolean, fetch?: Function, onSkip?: (flow: any, reasons: string[]) => void}} [options]
       */
      async function runOnStart(options = {}) {
        if (startDone && !options.force) return [];
        startDone = true;
        const results = [];
        for (const flow of (await list()).filter((f) => f.onStart)) {
          const reasons = await blockers(flow);
          if (reasons.length) { if (options.onSkip) options.onSkip(flow, reasons); continue; }
          results.push(await run(flow, options));
        }
        return results;
      }

      return { STEPS, STEP_TYPES, DEFAULT_ROUNDS, MAX_ROUNDS, MAX_SECONDS, setAsker, check, list, get, blank, save, remove, exportJson, importJson, current, cancel, run, output, hasOutput, blockers, runOnStart, subscribe };
    });
})();
