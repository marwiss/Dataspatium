// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The workspace view for one API connector in Inhämta: header, credentials, the family browser or
 * the generic endpoint form, progress, result preview and saving (new dataset or into an existing
 * one). `renderRight` fills the inspector with facts about the service and the latest requests.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/api-view', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'ui/api/auth-panel', 'ui/api/endpoint-form', 'ui/api/pxweb-view', 'ui/api/sos-view', 'ui/api/geodata-view', 'ui/api/geoportal-view', 'ui/api/neo4j-view', 'api/runner', 'api/connectors', 'api/auth', 'api/http', 'platform/files', 'data/datasets', 'viz/leaflet', 'data/plan', 'io/importers/detaljplan'],
    (base, basic, overlays, icons, authPanel, endpointForm, pxwebView, sosView, geodataView, geoportalView, neo4jView, runner, connectors, auth, http, files, datasets, leaflet, plan, detaljplanImp) => {
      const { h, t, i18n, replace } = base;
      const PREVIEW_ROWS = 2000;

      /**
       * @param {any} ctx shell context @param {any} connector
       * @param {{onDataset?: Function, onRemoved?: Function, onConnector?: Function}} [hooks] onConnector: a source created from
       *   this view (a catalogue hit added as a geodata source) that Inhämta should open
       */
      function create(ctx, connector, hooks = {}) {
        const { shell, store } = ctx;
        const state = { busy: false, progress: null, result: null, error: '', requests: [], saving: false, saved: null };
        let abort = null;
        let rightEl = null;
        const el = h('div', { class: 'dm-stack dm-api-view' });
        const resultEl = h('div', { class: 'dm-stack' });
        const progressEl = h('div');
        const api = { connector, runFetch, log: (m, k) => shell.log(m, k), onConnector: (c) => { if (hooks.onConnector) hooks.onConnector(c); }, onDataset: (m) => { if (hooks.onDataset) hooks.onDataset(m); } };
        const authUi = auth.needsCredentials(connector) ? authPanel.create(connector) : null;
        const family = connector.family && connector.family.type;
        const isGeodata = family === 'geodata';
        const isNeo4j = family === 'neo4j';
        // Statistics Denmark (statbank) and FHI browse like PxWeb v1: folders, tables, a variable picker.
        const browser = family === 'pxweb' ? pxwebView.create(api)
          : family === 'statbank' ? pxwebView.create(api, D.require('api/families/statbank'))
            : family === 'fhi' ? pxwebView.create(api, D.require('api/families/fhi'))
              : family === 'socialstyrelsen' ? sosView.create(api)
                : isGeodata ? geodataView.create(api)
                  : family === 'geoportal' ? geoportalView.create(api)
                    : family === 'neo4j' ? neo4jView.create(api) : null;
        // Geodata sources: the layer browser is the form (it holds the layers' endpoints); no second tab.
        const form = !isGeodata && !isNeo4j && connector.endpoints && connector.endpoints.length ? endpointForm.create(api) : null;
        let tab = browser ? 'browse' : 'endpoints';

        function render() {
          const tabs = browser && form ? /** @type {any} */ (h('dm-tabs')) : null;
          if (tabs) {
            tabs.tabs = [{ id: 'browse', label: t('api.tab.browse'), icon: 'folder-open' }, { id: 'endpoints', label: t('api.tab.endpoints'), icon: 'braces' }];
            tabs.active = tab;
            tabs.addEventListener('dm-change', (e) => { tab = /** @type {any} */ (e).detail.id; render(); });
          }
          replace(el,
            h('div', { class: 'dm-page-head' },
              h('h1', null, icons.icon(isGeodata || family === 'geoportal' ? 'map' : isNeo4j ? 'database' : 'globe', 20), connector.name, ' ', connector.level === 2 ? h('dm-badge', { kind: 'warn', text: t('api.level2') }) : null, isGeodata ? h('dm-badge', { text: t('geodata.badge.' + connector.family.kind) }) : null),
              h('div', { class: 'dm-row' },
                connector.docs ? basic.button({ label: t('api.docs'), icon: 'external-link', onClick: () => window.open(connector.docs, '_blank', 'noopener') }) : null,
                basic.button({ label: t('api.export'), icon: 'download', variant: 'ghost', onClick: () => files.download(new Blob([connectors.exportJson(connector)], { type: 'application/json' }), files.safeName(connector.id, 'api.json')) }))),
            connector.description ? h('p', { class: 'dm-help', text: connector.description }) : null,
            authUi ? authUi.el : null,
            tabs,
            h('div', { class: 'dm-card dm-stack' }, tab === 'browse' && browser ? browser.el : (form ? form.el : null)),
            progressEl,
            resultEl);
          renderProgress();
          renderResult();
        }

        function renderProgress() {
          if (!state.busy) { replace(progressEl); return; }
          const p = state.progress || { pages: 0, rows: 0 };
          replace(progressEl, h('div', { class: 'dm-card dm-stack-sm' },
            h('div', { class: 'dm-row' }, h('dm-progress', { indeterminate: true, label: t('api.fetch') }), basic.button({ label: t('api.cancel'), icon: 'x', size: 'sm', onClick: () => { if (abort) abort.abort(); } })),
            h('p', { class: 'dm-help', text: p.total ? t('api.progress.of', { pages: p.pages, total: p.total, rows: i18n.formatNumber(p.rows || 0) }) : t('api.progress', { pages: p.pages || 0, rows: i18n.formatNumber(p.rows || 0) }) })));
        }

        async function runFetch(job) {
          if (state.busy) return;
          state.busy = true; state.error = ''; state.progress = { pages: 0, rows: 0 }; state.saved = null; abort = new AbortController(); renderProgress(); replace(resultEl);
          try {
            const out = await job.run((p) => { state.progress = p; renderProgress(); }, abort.signal);
            state.result = out;
            state.requests = (out.table.meta && out.table.meta.requests) || [];
            shell.log(t('api.fetched', { name: connector.name, rows: i18n.formatNumber(out.table.rows.length) }), 'ok');
          } catch (err) {
            state.error = err && err.kind === 'aborted' ? t('api.aborted') : ((err && err.message) || String(err));
            if (!(err && err.kind === 'aborted')) shell.log(`${connector.name}: ${state.error}`, 'error');
          }
          state.busy = false; abort = null; renderProgress(); renderResult(); renderRight();
        }

        function renderResult() {
          if (state.error) { replace(resultEl, h('div', { class: 'dm-card' }, h('p', { class: 'dm-error', text: state.error }))); return; }
          const r = state.result;
          if (!r) { replace(resultEl); return; }
          const table = /** @type {any} */ (h('dm-table', { class: 'dm-table-tall' }));
          const rows = r.table.rows.slice(0, PREVIEW_ROWS);
          const nameInput = /** @type {any} */ (h('dm-input', { label: t('api.name') }));
          nameInput.value = r.name || connector.name;
          const existing = store.get().datasets;
          const target = /** @type {any} */ (h('dm-select', { label: t('api.into') }));
          target.options = [{ value: '', label: '–' }].concat(existing.map((d) => ({ value: d.id, label: d.name })));
          const mode = /** @type {any} */ (h('dm-select', { label: t('api.into.mode') }));
          mode.options = [{ value: 'append', label: t('api.into.mode.append') }, { value: 'replace', label: t('api.into.mode.replace') }];
          const saveBtn = basic.button({ label: t('api.save'), icon: 'save', variant: 'primary', loading: state.saving, onClick: () => save(nameInput.value.trim()) });
          // NGP reference objects (Lantmäteriet's detaljplan service) can be kept as a plan: drawn with Boverket's colours, provisions listed.
          const planBtn = plan.detectTable(r.table.columns) ? basic.button({ label: t('plan.save'), icon: 'layers', loading: state.saving, title: t('plan.save.hint'), onClick: () => saveAsPlan(nameInput.value.trim()) }) : null;
          const intoBtn = basic.button({ label: t('api.into.run'), icon: 'rows-3', loading: state.saving, onClick: () => { if (target.value) into(target.value, mode.value); else overlays.toast.show(t('api.into.pick'), { kind: 'warn' }); } });
          // Geodata answers are shown as a small map above the table (the saved dataset opens as a map).
          const mapSvg = leaflet.tableSvg(r.table, { width: 640, height: 300, limit: 5000 });
          const mapEl = mapSvg ? h('div', { class: 'dm-api-map' }, new DOMParser().parseFromString(mapSvg, 'image/svg+xml').documentElement) : null;
          replace(resultEl, h('div', { class: 'dm-card dm-stack' },
            h('div', { class: 'dm-row-wrap' },
              h('strong', { text: t('api.result', { rows: i18n.formatNumber(r.table.rows.length), cols: r.table.columns.length }) }),
              r.table.meta && r.table.meta.pages ? h('dm-badge', { text: t('api.result.pages', { n: r.table.meta.pages }) }) : null,
              r.preview ? h('dm-badge', { kind: 'accent', text: t('api.result.preview') }) : null,
              mapEl ? h('dm-badge', { kind: 'accent', text: t('api.result.map') }) : null,
              r.table.meta && r.table.meta.truncated ? h('span', { class: 'dm-warn dm-small', text: t('api.result.truncated', { n: r.table.meta.pages }) }) : null,
              r.table.meta && r.table.meta.label ? h('span', { class: 'dm-help', text: r.table.meta.label }) : null),
            mapEl,
            h('div', { class: 'dm-table-wrap' }, table),
            state.saved ? h('div', { class: 'dm-success' }, h('span', { text: state.saved.text }), h('div', { class: 'dm-row' }, basic.button({ label: t(mapEl ? 'geodata.open.map' : 'import.open.bearbeta'), icon: mapEl ? 'map' : 'pencil', variant: 'primary', onClick: () => { store.set({ selectedId: state.saved.id }); shell.activate('bearbeta'); } })))
              : h('div', { class: 'dm-stack-sm' },
                h('div', { class: 'dm-row-wrap dm-api-save' }, nameInput, saveBtn, planBtn),
                existing.length ? h('details', { class: 'dm-more' }, h('summary', { text: t('api.into') }), h('div', { class: 'dm-row-wrap dm-api-save' }, target, mode, intoBtn)) : null)));
          requestAnimationFrame(() => table.setData({
            columns: r.table.columns.map((c) => ({ key: c, label: c, type: (r.table.types && r.table.types[c]) || guessType(rows, r.table.columns.indexOf(c)) })),
            rowCount: rows.length, rowProvider: async (start, count) => rows.slice(start, start + count),
          }));
        }
        function guessType(rows, i) { let n = 0; let num = 0; for (let r = 0; r < rows.length && r < 100; r++) { const v = rows[r][i]; if (v === null || v === undefined || v === '') continue; n++; if (typeof v === 'number') num++; } return n && num === n ? 'number' : 'text'; }

        async function save(name) {
          if (!state.result || state.saving) return;
          state.saving = true; renderResult();
          try {
            const meta = await runner.toDataset(state.result.table, { name: name || state.result.name || connector.name, description: descriptionFor(state.result), source: state.result.source });
            state.saved = { id: meta.id, text: t('api.saved', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) }) };
            shell.log(state.saved.text, 'ok');
            if (hooks.onDataset) hooks.onDataset(meta);
          } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
          state.saving = false; renderResult();
        }
        /** The answer as a plan dataset (kind plan) instead of a table. */
        async function saveAsPlan(name) {
          if (!state.result || state.saving) return;
          state.saving = true; renderResult();
          try {
            const meta = await detaljplanImp.importTable(state.result.table.columns, state.result.table.rows, name || state.result.name || connector.name, Object.assign({ description: descriptionFor(state.result) }, state.result.source || {}));
            state.saved = { id: meta.id, text: t('plan.saved', { name: meta.name, n: i18n.formatNumber(meta.rowCount) }) };
            shell.log(state.saved.text, 'ok');
            if (hooks.onDataset) hooks.onDataset(meta);
          } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
          state.saving = false; renderResult();
        }
        async function into(id, mode) {
          if (!state.result || state.saving) return;
          state.saving = true; renderResult();
          try {
            const ds = await datasets.get(id);
            const res = await runner.intoDataset(id, state.result.table, { mode, source: state.result.source });
            const text = mode === 'replace' ? t('api.into.replaced', { name: ds ? ds.name : id, rows: i18n.formatNumber(res.rows) }) : t('api.into.appended', { name: ds ? ds.name : id, rows: i18n.formatNumber(res.rows) });
            state.saved = { id, text };
            shell.log(text, 'ok');
          } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
          state.saving = false; renderResult();
        }
        function descriptionFor(result) {
          const parts = [];
          if (connector.publisher) parts.push(connector.publisher);
          if (result.table.meta && result.table.meta.label) parts.push(result.table.meta.label);
          if (result.source && result.source.url) parts.push(result.source.url);
          if (connector.license && connector.license.name) parts.push(t('api.license') + ': ' + connector.license.name);
          return parts.join('. ');
        }

        /** Inspector content. */
        function renderRight(container) {
          if (container) rightEl = container;
          if (!rightEl) return;
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            connector.publisher ? { label: t('api.publisher'), value: connector.publisher } : null,
            { label: t('api.auth'), value: connectors.describeAuth(connector) },
            connector.license && connector.license.name ? { label: t('api.license'), value: connector.license.url ? h('a', { href: connector.license.url, target: '_blank', rel: 'noopener', text: connector.license.name }) : connector.license.name } : null,
            { label: t('api.baseurl'), value: h('code', { class: 'dm-break', text: family === 'pxweb' ? D.require('api/families/pxweb').base(connector) : connector.baseUrl }) },
            connector.rateLimit ? { label: t('api.ratelimit'), value: t('api.ratelimit.value', { n: connector.rateLimit.requests, s: connector.rateLimit.perSeconds }) } : null,
          ].filter(Boolean);
          const reqs = state.requests.length ? h('ul', { class: 'dm-api-requests' }, state.requests.slice(-8).map((r) => h('li', null, h('span', { class: 'dm-row' }, h('dm-badge', { kind: r.status >= 400 ? 'error' : 'ok', text: String(r.status) }), h('span', { class: 'dm-muted', text: `${t('common.rows', { n: i18n.formatNumber(r.rows || 0) })} · ${r.ms || 0} ms` })), h('code', { class: 'dm-break dm-xs', title: r.url, text: r.url })))) : h('p', { class: 'dm-help', text: t('api.requests.empty') });
          const proxyInput = /** @type {any} */ (h('dm-input', { label: t('api.proxy'), help: t('api.proxy.help'), placeholder: 'https://…/?url={url}' }));
          http.getProxy().then((p) => { proxyInput.value = p; });
          proxyInput.addEventListener('change', async () => { await http.setProxy(proxyInput.value); overlays.toast.show(t('api.proxy.saved'), { kind: 'ok' }); });
          replace(rightEl,
            h('h4', { text: t('api.info') }), kv,
            connector.notes ? h('p', { class: 'dm-help', text: connector.notes }) : null,
            h('h4', { text: t('api.requests') }), reqs,
            h('details', { class: 'dm-more' }, h('summary', { text: t('common.more') }), h('div', { class: 'dm-stack-sm' }, proxyInput,
              !connector.preset ? basic.button({ label: t('api.remove'), icon: 'trash-2', variant: 'danger', size: 'sm', onClick: async () => { if (await overlays.dialog.confirm(t('api.remove.confirm', { name: connector.name }), { danger: true, okLabel: t('common.delete') })) { await connectors.remove(connector.id); await D.require('api/secrets').forget(connector.id); if (hooks.onRemoved) hooks.onRemoved(connector); } } }) : null)));
        }

        function start() { render(); if (browser) browser.start(); }
        function destroy() { if (abort) abort.abort(); if (authUi) authUi.destroy(); }
        return { el, start, destroy, renderRight, state };
      }
      return { create };
    });
})();
