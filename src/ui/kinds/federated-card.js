// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The card Dubbletter mellan modeller in Kontrollera: the chosen IFC model tried against other IFC models of the same building in
 * the workspace (analysis/federated), on the button, as the clash check is: the same GlobalId in more than one model, the same
 * element in two models and storeys of one name at different elevations. The findings show as a table with the model of each
 * element; a chosen finding goes to the inspector, with a button that opens each element in Bearbeta's model view. The findings
 * mark the elements of one model in the model view, and become BCF topics in a file or, for a model from a CDE, on the server.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/federated-card', ['ui/base', 'data/kinds', 'data/datasets', 'data/selection', 'analysis/federated', 'platform/tier'], (base, kinds, datasets, selection, federated, tier) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_ROWS = 2000;
    const fmt = (n) => i18n.formatNumber(Number(n) || 0);

    /**
     * @param {any} ctx shell context @param {any} ds the chosen model dataset
     * @param {{inspect?: (el: HTMLElement|null) => void}} [options] shows a chosen finding in the inspector (null: none chosen)
     * @returns {{el: HTMLElement, state: any, run: () => Promise<void>, refresh: () => void}}
     */
    function create(ctx, ds, options = {}) {
      const { ui, store, shell } = ctx;
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'federated' });
      const s = { with: new Set(), threshold: Math.round(federated.THRESHOLD * 100), busy: false, progress: '', error: '', result: /** @type {any} */ (null) };
      let shown = '';
      const others = () => store.get().datasets.filter((d) => d.id !== ds.id && kinds.of(d) === kinds.PROFILES.model && !kinds.isDxf(d));
      const inspect = (x) => { if (options.inspect) options.inspect(x); };

      async function run() {
        if (s.busy) return;
        const chosen = others().filter((d) => s.with.has(d.id)).map((d) => d.id);
        if (!chosen.length) { s.error = t('kontrollera.federated.pick'); draw(); return; }
        s.busy = true; s.error = ''; s.result = null; s.progress = t('kontrollera.federated.progress.start');
        inspect(null); draw();
        try {
          s.result = await federated.run({ datasetIds: [ds.id].concat(chosen), threshold: s.threshold / 100 }, { onProgress: (p) => {
            s.progress = p.phase === 'geometry' ? t('clash.progress.geometry', { n: fmt(p.done) })
              : p.total ? t('kontrollera.federated.progress.pairs', { done: fmt(p.done), total: fmt(p.total) }) : t('kontrollera.federated.progress.start');
            const bar = el.querySelector('[data-federated-progress]');
            if (bar) bar.setAttribute('label', s.progress);
          } });
          shell.log(t('kontrollera.federated.done', { n: fmt(s.result.findings.length), models: fmt(s.result.models.length), s: fmt(s.result.seconds) }), 'ok');
        } catch (err) {
          s.error = String((err && err.message) || err);
          shell.log(s.error, 'error');
        }
        s.busy = false; draw();
      }

      function draw() {
        const list = others();
        shown = list.map((d) => d.id).join('|');
        for (const id of Array.from(s.with)) if (!list.some((d) => d.id === id)) s.with.delete(id);
        const switches = list.map((d) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: d.name, 'data-federated-with': d.id }));
          sw.checked = s.with.has(d.id);
          sw.addEventListener('change', () => { if (sw.checked) s.with.add(d.id); else s.with.delete(d.id); });
          return sw;
        });
        const amount = /** @type {any} */ (h('dm-input', { type: 'number', min: '50', max: '100', step: '1', label: t('kontrollera.federated.threshold'), help: t('kontrollera.federated.threshold.help'), 'data-federated-threshold': '' }));
        amount.value = String(s.threshold);
        amount.addEventListener('change', () => { const v = Number(amount.value); if (Number.isFinite(v) && amount.value !== '') s.threshold = Math.min(100, Math.max(50, Math.round(v))); amount.value = String(s.threshold); });
        replace(el,
          h('h3', { text: t('kontrollera.federated') }),
          h('p', { class: 'dm-help', text: t('kontrollera.federated.help') }),
          list.length ? h('div', { class: 'dm-stack-xs' }, h('strong', { class: 'dm-small', text: t('kontrollera.federated.with') }), switches)
            : h('p', { class: 'dm-help dm-small', 'data-federated-none': '', text: t('kontrollera.federated.none') }),
          list.length ? h('div', { class: 'dm-row-wrap' }, amount, ui.button({ label: t('kontrollera.federated.run'), icon: 'copy', size: 'sm', loading: s.busy, title: t('kontrollera.federated.run.hint'), 'data-federated-run': '', onClick: run })) : null,
          s.busy ? h('dm-progress', { indeterminate: true, label: s.progress, 'data-federated-progress': '' }) : null,
          s.error ? h('p', { class: 'dm-error dm-small', 'data-federated-error': '', text: s.error }) : null,
          s.result && !s.busy ? resultView(s.result) : null);
      }
      /** The models in the workspace changed: the list of models to try against follows, unless a check is running. */
      function refresh() { if (!s.busy && others().map((d) => d.id).join('|') !== shown) draw(); }

      /** The counts per check, the buttons and the table of findings. */
      function resultView(r) {
        const check = (key) => {
          const n = r.counts[key] || 0;
          return h('div', { class: 'dm-stack-xs', 'data-federated-check': key, 'data-federated-count': String(n) },
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('kontrollera.federated.check.' + key) }), h('dm-badge', { text: n ? fmt(n) : t('kontrollera.findings.none'), kind: n ? 'warn' : 'ok' })),
            h('p', { class: 'dm-help dm-xs', text: t('kontrollera.federated.check.' + key + '.help', { pct: fmt(Math.round(r.spec.threshold * 100)) }) }));
        };
        const none = !r.findings.length;
        const cde = ds.source && ds.source.cde;
        const elements = r.models.reduce((sum, m) => sum + (m.elements || 0), 0);
        const marks = r.models.filter((m) => federated.whereOf(r, m.datasetId)).map((m) => ui.button({ label: t('kontrollera.federated.mark', { name: m.name }), icon: 'scan-line', size: 'sm', title: t('kontrollera.federated.mark.hint'), 'data-federated-mark': m.datasetId, onClick: () => mark(r, m.datasetId) }));
        return h('div', { class: 'dm-stack-sm', 'data-federated-summary': '', 'data-federated-guids': String(r.counts.guid), 'data-federated-elements': String(r.counts.element), 'data-federated-storeys': String(r.counts.storey), 'data-federated-shared': String(r.shared) },
          h('p', { class: 'dm-help dm-small', text: t('kontrollera.federated.note', { n: fmt(elements), models: fmt(r.models.length), pairs: fmt(r.pairs), s: fmt(r.seconds) }) + (r.missing ? ' ' + t('kontrollera.federated.missing', { n: fmt(r.missing) }) : '') }),
          federated.KINDS.map(check),
          r.shared ? h('p', { class: 'dm-help dm-xs', 'data-federated-shared-note': '', text: t('kontrollera.federated.shared', { n: fmt(r.shared) }) }) : null,
          none ? null : h('div', { class: 'dm-row-wrap', 'data-federated-result': '' }, marks,
            ui.button({ label: t('clash.bcf'), icon: 'download', size: 'sm', title: t('kontrollera.federated.bcf.hint'), 'data-federated-bcf': '', onClick: () => saveBcf(r) }),
            cde && cde.connectorId && cde.projectId && tier.shows('cde.bcf', { server: cde.connectorId }) ? ui.button({ label: t('clash.send'), icon: 'upload', size: 'sm', title: t('kontrollera.federated.send.hint'), 'data-federated-send': '', onClick: () => sendTopics(r) }) : null,
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', title: t('text.create.dataset.hint'), 'data-federated-dataset': '', onClick: () => createDataset(r) })),
          none ? null : tableView(r));
      }
      function rowsOf(r) {
        const out = federated.tableOf(r);
        return { columns: out.columns.map((c) => Object.assign(c, { label: t('federated.col.' + c.name) })), rows: out.rows.map((row) => { const copy = row.slice(); copy[0] = t('federated.kind.' + row[0]); return copy; }) };
      }
      function tableView(r) {
        const out = rowsOf(r);
        const table = /** @type {any} */ (h('dm-table', { 'data-federated-table': '', 'aria-label': t('kontrollera.federated.table') }));
        table.setData({ columns: out.columns.map((c) => ({ key: c.name, label: c.label, type: c.type })), rowCount: Math.min(out.rows.length, PREVIEW_ROWS), rowProvider: async (start, count) => out.rows.slice(start, start + count) });
        table.addEventListener('dm-row', (e) => { const f = r.findings[/** @type {any} */ (e).detail.index]; inspect(f ? findingView(f, r) : null); });
        return h('div', { class: 'dm-table-wrap' }, table);
      }
      /** One finding in the inspector: every value it has, the rule, and a button per side that opens the element in Bearbeta. */
      function findingView(f, r) {
        const row = federated.tableOf({ findings: [f] }).rows[0];
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = federated.COLUMNS.map((c, i) => [c, row[i]]).filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([c, v]) => ({ label: t('federated.col.' + c.name), value: c.name === 'slag' ? t('federated.kind.' + v) : c.type === 'number' ? i18n.formatNumber(v) : String(v) }));
        const open = (key) => {
          const sd = f[key];
          if (sd.id === null || !store.get().datasets.some((d) => d.id === sd.datasetId)) return null;
          return ui.button({ label: t('kontrollera.federated.show', { name: sd.model }), icon: 'box', size: 'sm', title: t('kontrollera.federated.show.hint'), 'data-federated-show': key, onClick: () => {
            store.set({ selectedId: sd.datasetId, openElement: { datasetId: sd.datasetId, id: sd.id } });
            shell.activate('bearbeta');
          } });
        };
        return h('div', { class: 'dm-stack-sm', 'data-federated-finding': f.kind },
          h('h4', { text: t('federated.kind.' + f.kind) }),
          h('div', null, h('dm-badge', { text: t('kontrollera.federated.check.' + f.kind), kind: 'warn' })),
          kv,
          h('p', { class: 'dm-help dm-small', text: t('kontrollera.federated.check.' + f.kind + '.help', { pct: fmt(Math.round(r.spec.threshold * 100)) }) }),
          h('div', { class: 'dm-row-wrap' }, open('a'), open('b')));
      }
      async function mark(r, datasetId) {
        const where = federated.whereOf(r, datasetId);
        const made = where ? await selection.setFromWhere(datasetId, where, [], t('kontrollera.federated')) : null;
        if (!made) { ui.toast.show(t('selection.none'), { kind: 'info' }); return; }
        ui.toast.show(t('selection.made', { n: fmt(made.rowids.length) }), { kind: 'ok' });
        store.set({ selectedId: datasetId });
        shell.activate('bearbeta');
      }
      function colors() {
        const tk = D.require('viz/theme').tokens();
        const hex = (v) => String(v || '').replace(/^#/, '').toUpperCase();
        return { a: hex(tk.error), b: hex(tk.warn) };
      }
      async function saveBcf(r) {
        try {
          // The person's name as the author (the server's identity when signed in), as the clash check's file has it.
          const bcfXml = D.require('data/bcf-xml');
          const cde = ds.source && ds.source.cde;
          const connector = cde && cde.connectorId ? await D.require('api/connectors').get(cde.connectorId).catch(() => null) : null;
          // The OpenCDE family loads with the group 'families' (src/boot.js), only for a model from a CDE.
          const opencde = connector ? await D.ensure(['families'], () => D.require('api/families/opencde')) : null;
          const author = bcfXml.authorOf(opencde && opencde.isOpenCde(connector) ? await opencde.identity(connector) : null, await D.require('data/comments').author());
          const blob = await federated.bcfFile(r, { t, projectName: ds.name, colors: colors(), author });
          const name = `${ds.name.replace(/[\\/:*?"<>|]+/g, '_')} ${t('kontrollera.federated').toLowerCase()}.bcfzip`;
          D.require('platform/files').download(blob, name);
          shell.log(t('kontrollera.federated.bcf.saved', { n: fmt(r.findings.length), name }), 'ok');
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      /** One topic per finding in the model's project on the server, with a viewpoint where the finding has a place. */
      async function sendTopics(r) {
        const cde = ds.source.cde;
        try {
          const opencde = await D.ensure(['families'], () => D.require('api/families/opencde'));
          const connector = await D.require('api/connectors').get(cde.connectorId);
          if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
          const ok = await ui.dialog.confirm(t('clash.send.confirm', { n: fmt(r.findings.length), project: cde.projectName || cde.projectId, host: cde.host }), { okLabel: t('clash.send') });
          if (!ok) return;
          if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
          const ext = (await opencde.extensions(connector, cde.projectId).catch(() => null)) || {};
          const pick = (list, ...wanted) => { const l = Array.isArray(list) ? list : []; for (const w of wanted) { const x = l.find((v) => w.test(String(v))); if (x) return x; } return l[0] || null; };
          const type = pick(ext.topic_type, /dubblett|duplicate/i, /clash|kollision/i); const status = pick(ext.topic_status, /open|öppen/i);
          const paint = colors();
          // Each topic tied to the model's file when the server allows it (BCF 3.3.3).
          const file = await opencde.modelFile(connector, cde.projectId, cde, D.require('data/bcf-xml').headerOf(ds)[0]).catch(() => null);
          let sent = 0;
          for (const f of r.findings) {
            const text = federated.topicText(f, t);
            const body = { title: text.title, description: text.description };
            if (type) body.topic_type = type;
            if (status) body.topic_status = status;
            const topic = await opencde.createTopic(connector, cde.projectId, body);
            const vp = federated.viewpointOf(f, paint);
            if (vp) await opencde.createViewpoint(connector, cde.projectId, topic.guid, vp);
            if (file) await opencde.linkTopic(connector, cde.projectId, topic, ext, file).catch((err) => shell.log(t('issues.files.failed', { message: String((err && err.message) || err) }), 'warn'));
            sent++;
            if (sent % 5 === 0) shell.log(t('clash.send.progress', { done: fmt(sent), total: fmt(r.findings.length) }), 'info');
          }
          const done = t('clash.send.done', { n: fmt(sent), project: cde.projectName || cde.projectId });
          shell.log(done, 'ok'); ui.toast.show(done, { kind: 'ok' });
        } catch (err) {
          const msg = String((err && err.message) || err);
          shell.log(msg, 'error'); ui.toast.show(msg, { kind: 'error' });
        }
      }
      async function createDataset(r) {
        const out = rowsOf(r);
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: `${ds.name}: ${t('kontrollera.federated')}` });
        if (!name) return;
        try {
          const meta = await datasets.create({ name, columns: out.columns.map((c) => ({ name: c.name, type: c.type, label: c.label })), rows: out.rows, description: t('kontrollera.federated.help'), source: { kind: 'derived' } });
          const msg = t('text.dataset.created', { name: meta.name, rows: fmt(meta.rowCount) });
          shell.log(msg, 'ok');
          ui.toast.show(msg, { kind: 'ok', action: { label: t('import.open.bearbeta'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      draw();
      return { el, state: s, run, refresh };
    }
    return { create };
  });
})();
