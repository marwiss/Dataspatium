// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Flows: a saved chain of steps that runs with one click or when the app starts. Every step already exists elsewhere in
 * the app (fetching again with the recipe replayed, recipes, R and Python scripts, saved lists, charts, dashboards,
 * documents, export); a flow only binds them together and keeps a log. The files a flow produces stay in memory until
 * the user fetches them: a flow never sends anything out of the app, since everything that leaves goes through the
 * review in Dela. A flow that runs at start skips itself rather than ask for anything: it needs its consents already
 * given. Flows are stored as settings (`flow:<id>`) and travel in backups, not in bundles.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/flows', ['platform/storage/idb', 'platform/consent', 'platform/storage/zip', 'platform/files', 'data/datasets', 'data/recipes', 'data/lists', 'api/runner', 'viz/charts', 'viz/render', 'viz/batch', 'viz/dashboards', 'docgen/documents', 'docgen/generate', 'io/export', 'data/r-bridge', 'data/python-bridge'],
    (idb, consent, zip, files, datasets, recipes, lists, runner, charts, render, batch, dashboards, documents, generate, exporter, rBridge, pyBridge) => {
      const PREFIX = 'flow:';
      const FORMAT = 'dataspatium-flow/1';
      const HISTORY = 20;
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
      };
      const STEP_TYPES = Object.keys(STEPS);

      async function list() {
        const rows = await idb.listSettings(PREFIX);
        return rows.map((r) => r.value).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      }
      async function get(id) { return idb.getSetting(PREFIX + id, null); }
      function blank(name) { return { id: null, name: name || '', description: '', onStart: false, continueOnError: false, steps: [], lastRun: null, history: [] }; }
      function cleanStep(s) { return { type: STEP_TYPES.includes(s.type) ? s.type : 'export', params: Object.assign({}, s.params || {}), targetId: s.targetId || undefined }; }
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
        /** @type {Array<{name: string, blob: Blob}>} */ const made = [];
        notify('start', current());
        try {
          for (let i = 0; i < working.steps.length; i++) {
            if (controller.signal.aborted) { result.aborted = true; result.ok = false; break; }
            const step = working.steps[i];
            running.index = i;
            const def = STEPS[step.type];
            notify('step', Object.assign(current(), { type: step.type, label: t('flows.step.' + step.type) }));
            const t0 = performance.now();
            try {
              const out = await def.run(step.params || {}, { signal: controller.signal, fetch: options.fetch, step });
              for (const f of out.files || []) { made.push(f); result.files.push(f.name); }
              result.steps.push({ type: step.type, ok: true, ms: Math.round(performance.now() - t0), message: out.message || '' });
            } catch (err) {
              result.steps.push({ type: step.type, ok: false, ms: Math.round(performance.now() - t0), message: String((err && err.message) || err) });
              result.ok = false;
              if (!working.continueOnError) break;
            }
          }
        } finally {
          result.endedAt = new Date().toISOString();
          running = null;
        }
        if (made.length) outputs.set(working.id, made); else outputs.delete(working.id);
        // The newest copy on disk may have been edited meanwhile: only the log and the targets of the steps are written back.
        const stored = await get(working.id);
        if (stored) {
          stored.lastRun = result;
          stored.history = [result].concat(stored.history || []).slice(0, HISTORY);
          stored.steps = stored.steps.map((s, i) => (working.steps[i] && working.steps[i].type === s.type && working.steps[i].targetId ? Object.assign({}, s, { targetId: working.steps[i].targetId }) : s));
          await idb.setSetting(PREFIX + stored.id, stored);
        }
        notify('end', result);
        return result;
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
        for (const step of flow.steps || []) {
          const def = STEPS[step.type];
          if (def && def.blockers) out.push(...await def.blockers(step.params || {}));
        }
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

      return { STEPS, STEP_TYPES, list, get, blank, save, remove, exportJson, importJson, current, cancel, run, output, hasOutput, blockers, runOnStart, subscribe };
    });
})();
