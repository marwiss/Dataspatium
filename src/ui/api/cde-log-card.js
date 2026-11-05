// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The card "Logg" in an OpenCDE source's view: what the app has sent to this server in this session, newest first, with the API and
 * the operation of the specification, status and time; a click opens one request with headers, bodies (when kept), a curl line to
 * copy and a short explanation of the operation. Bodies are kept only when the switch is on; the log can be saved as JSON or as a
 * dataset. Nothing here reaches the network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/cde-log-card', ['ui/base', 'ui/basic', 'ui/overlays', 'api/cde-log', 'api/runner', 'platform/files', 'api/connectors'], (base, basic, overlays, cdeLog, runner, files, connectors) => {
    const { h, t, i18n, replace } = base;
    const SHOWN = 50;
    /** Specification pages per API, for the learning note. */
    const SPECS = {
      foundation: 'https://github.com/buildingSMART/foundation-API/blob/release_1_0/README.md',
      bcf: 'https://github.com/buildingSMART/BCF-API/blob/release_3_0/README.md',
      documents: 'https://github.com/buildingSMART/documents-API/blob/release_1_0/README.md',
    };

    /**
     * @param {any} connector
     * @param {{log?: (msg: string, kind?: string) => void, onDataset?: (meta: any) => void}} [hooks]
     * @returns {{el: HTMLElement, render: () => void, destroy: () => void, state: any}}
     */
    function create(connector, hooks = {}) {
      const s = { open: false, selected: null, saving: false };
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-cde-log': '' });
      const unsubscribe = cdeLog.subscribe(() => { if (s.open) render(); else renderHead(); });
      let headEl = null; let bodyEl = null;

      /** The operation's explanation: one text per operation when there is one, otherwise the API's. */
      const explain = (e) => {
        const key = `cdelog.op.${e.api}.${e.operation}`;
        const text = t(key);
        return text === key ? t(`cdelog.api.${e.api}`) : text;
      };
      const statusKind = (e) => (e.error || e.ok === false ? 'error' : e.ok === null ? undefined : 'ok');

      async function saveDataset() {
        if (s.saving) return;
        s.saving = true; render();
        try {
          const meta = await runner.toDataset(cdeLog.toTable(connector.id), { name: t('cdelog.dataset.name', { name: connector.name }), description: t('cdelog.dataset.description', { host: hostOf() }), source: { kind: 'file', fileName: '' } });
          if (hooks.log) hooks.log(t('cdelog.saved', { name: meta.name }), 'ok');
          if (hooks.onDataset) hooks.onDataset(meta);
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        s.saving = false; render();
      }
      const hostOf = () => { try { return new URL(connector.baseUrl).host; } catch (_e) { return connector.baseUrl; } };
      function saveJson() {
        files.download(new Blob([cdeLog.toJson(connector.id)], { type: 'application/json' }), files.safeName(`cde-logg-${hostOf()}`, 'json'));
      }
      async function copyCurl(entry) {
        const text = cdeLog.toCurl(entry);
        try { await navigator.clipboard.writeText(text); overlays.toast.show(t('cdelog.curl.copied'), { kind: 'ok' }); } catch (_e) { overlays.toast.show(text.slice(0, 200), { timeout: 8000 }); }
        return text;
      }

      function renderHead() {
        if (!headEl) return;
        const sum = cdeLog.summary(connector.id);
        replace(headEl,
          h('div', { class: 'dm-row' },
            h('strong', { class: 'dm-grow', text: t('cdelog.title') }),
            h('span', { class: 'dm-help dm-xs', 'data-cde-log-summary': '', text: sum.total ? t('cdelog.summary', { n: i18n.formatNumber(sum.total), failed: i18n.formatNumber(sum.failed), ms: i18n.formatNumber(Math.round(sum.ms / Math.max(1, sum.total))) }) : t('cdelog.empty') }),
            basic.button({ label: s.open ? t('cdelog.hide') : t('cdelog.show'), size: 'sm', 'data-cde-log-toggle': '', onClick: () => { s.open = !s.open; render(); } })));
      }
      function render() {
        headEl = h('div'); bodyEl = h('div', { class: 'dm-stack-sm' });
        replace(el, headEl, bodyEl);
        renderHead();
        if (!s.open) { replace(bodyEl); return; }
        const sw = /** @type {any} */ (h('dm-switch', { label: t('cdelog.bodies'), title: t('cdelog.bodies.hint'), 'data-cde-log-bodies': '' }));
        sw.checked = cdeLog.bodies();
        sw.addEventListener('change', () => cdeLog.setBodies(sw.checked));
        // The request id travels only when the server allows the header (CORS); off until the user says so.
        const rid = /** @type {any} */ (h('dm-switch', { label: t('cdelog.requestid'), title: t('cdelog.requestid.hint'), 'data-cde-log-requestid': '' }));
        rid.checked = connector.requestId !== false;
        rid.addEventListener('change', async () => { connector.requestId = rid.checked; try { await connectors.save(connector); } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); } });
        const entries = cdeLog.list(connector.id).slice(-SHOWN).reverse();
        const rows = entries.map((e) => h('tr', { 'data-cde-log-row': e.id, class: s.selected === e.id ? 'dm-selected' : '', onclick: () => { s.selected = s.selected === e.id ? null : e.id; render(); } },
          h('td', { text: e.at.slice(11, 19) }),
          h('td', { text: e.method }),
          h('td', { text: `${t('cdelog.api.short.' + e.api)} · ${e.operation}` }),
          h('td', null, h('dm-badge', Object.assign({ text: e.error ? t('cdelog.failed') : e.status === null ? '…' : String(e.status) }, statusKind(e) ? { kind: statusKind(e) } : {}))),
          h('td', { class: 'dm-num', text: e.ms === null ? '' : i18n.formatNumber(e.ms) })));
        const table = h('table', { class: 'dm-columns-table dm-cde-log-table' },
          h('thead', null, h('tr', null, ['cdelog.col.time', 'cdelog.col.method', 'cdelog.col.operation', 'cdelog.col.status', 'cdelog.col.ms'].map((k) => h('th', { text: t(k) })))),
          h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: '5', class: 'dm-help', text: t('cdelog.empty') }))));
        const chosen = entries.find((e) => e.id === s.selected);
        replace(bodyEl,
          h('p', { class: 'dm-help dm-small', text: t('cdelog.help') }),
          h('div', { class: 'dm-row-wrap' }, sw, rid,
            basic.button({ label: t('cdelog.save.json'), icon: 'download', size: 'sm', title: t('cdelog.save.json.hint'), 'data-cde-log-json': '', onClick: saveJson }),
            basic.button({ label: t('cdelog.save.dataset'), icon: 'table', size: 'sm', loading: s.saving, title: t('cdelog.save.dataset.hint'), 'data-cde-log-dataset': '', onClick: saveDataset }),
            basic.button({ label: t('cdelog.clear'), icon: 'trash-2', size: 'sm', 'data-cde-log-clear': '', onClick: () => { cdeLog.clear(connector.id); s.selected = null; render(); } })),
          h('div', { class: 'dm-table-wrap' }, table),
          chosen ? detail(chosen) : null);
      }
      function detail(e) {
        const pre = (text) => h('pre', { class: 'dm-small dm-cde-log-pre', text });
        const headers = (obj) => Object.entries(obj || {}).map(([k, v]) => `${k}: ${v}`).join('\n') || '–';
        return h('div', { class: 'dm-card dm-stack-xs', 'data-cde-log-detail': '' },
          h('strong', { text: `${e.method} ${e.path}` }),
          h('p', { class: 'dm-help dm-small', text: `${e.url}${e.requestId ? ' · X-Request-Id ' + e.requestId : ''}` }),
          h('p', { class: 'dm-small', 'data-cde-log-explain': '', text: explain(e) }),
          SPECS[e.api] ? h('a', { class: 'dm-small', href: SPECS[e.api], target: '_blank', rel: 'noopener', text: t('cdelog.spec', { api: t('cdelog.api.short.' + e.api) }) }) : null,
          h('div', { class: 'dm-row-wrap' },
            h('div', { class: 'dm-grow' }, h('h5', { text: t('cdelog.request') }), pre(headers(e.requestHeaders)), e.requestBody ? pre(e.requestBody) : h('p', { class: 'dm-help dm-xs', text: t('cdelog.bytes', { n: i18n.formatBytes(e.requestBytes || 0) }) })),
            h('div', { class: 'dm-grow' }, h('h5', { text: t('cdelog.response', { status: e.status === null ? '' : String(e.status), ms: i18n.formatNumber(e.ms || 0) }) }), pre(headers(e.responseHeaders)), e.responseBody ? pre(e.responseBody) : h('p', { class: 'dm-help dm-xs', text: t('cdelog.bytes', { n: i18n.formatBytes(e.responseBytes || 0) }) }))),
          e.error ? h('p', { class: 'dm-error dm-small', text: e.error }) : null,
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('cdelog.curl'), icon: 'copy', size: 'sm', title: t('cdelog.curl.hint'), 'data-cde-log-curl': '', onClick: () => copyCurl(e) })));
      }
      render();
      return { el, render, destroy: () => { unsubscribe(); }, state: s, copyCurl };
    }

    return { create };
  });
})();
