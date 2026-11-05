// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for an OpenCDE source in Inhämta: sign in with the server's OAuth2 flow (popup, or paste the callback
 * address under file://), choose a project, and fetch its topics, comments, viewpoint components, events or files
 * as tables with "Spara som datamängd". "Hämta dokument" opens the server's own selection page (Documents API);
 * the chosen files are downloaded and imported like files dropped on the app (IFC models become model datasets).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/opencde-view', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/opencde', 'api/secrets', 'api/runner', 'io/import'], (base, basic, overlays, opencde, secrets, runner, importer) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_ROWS = 500;
    const KINDS = [
      { id: 'topics', fetch: (c, p) => opencde.fetchTopics(c, p) },
      { id: 'comments', fetch: (c, p) => opencde.fetchComments(c, p) },
      { id: 'components', fetch: (c, p) => opencde.fetchComponents(c, p) },
      { id: 'events', fetch: (c, p) => opencde.fetchEvents(c, p) },
      { id: 'files', fetch: (c, p) => opencde.fetchFiles(c, p) },
    ];

    /** @param {{connector: any, log?: Function, onDataset?: Function}} api */
    function create(api) {
      const { connector } = api;
      const s = { busy: '', error: '', user: null, projects: null, projectId: '', result: null, saving: false, saved: '', manual: null, callback: '' };
      const el = h('div', { class: 'dm-stack' });
      const unsubscribe = secrets.subscribe(() => render());
      const project = () => (s.projects || []).find((p) => p.project_id === s.projectId) || null;
      const log = (msg, kind) => { if (api.log) api.log(msg, kind || 'ok'); };
      const fail = (err) => { s.error = String((err && err.message) || err); log(`${connector.name}: ${s.error}`, 'error'); };

      async function signIn() {
        if (s.busy) return;
        s.busy = 'login'; s.error = ''; render();
        try {
          if (opencde.redirectUri()) await opencde.login(connector);
          else { s.manual = await opencde.manualStart(connector, 'http://127.0.0.1/dataspatium-callback'); window.open(s.manual.url, '_blank', 'noopener'); s.busy = ''; render(); return; }
          await afterSignIn();
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      async function finishManual() {
        if (!s.manual || !s.callback.trim()) return;
        s.busy = 'login'; s.error = ''; render();
        try { await opencde.manualFinish(connector, s.manual, s.callback.trim()); s.manual = null; s.callback = ''; await afterSignIn(); } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      async function afterSignIn() {
        s.user = await opencde.currentUser(connector);
        log(t('opencde.signed.in', { name: s.user.name || s.user.id, host: opencde.hostOf(connector.baseUrl) }));
        await loadProjects();
      }
      async function loadProjects() {
        s.projects = await opencde.projects(connector);
        if (!s.projectId || !project()) s.projectId = s.projects[0] ? s.projects[0].project_id : '';
      }
      async function signOut() {
        s.busy = 'logout'; render();
        try { await opencde.logout(connector); } catch (err) { fail(err); }
        s.user = null; s.projects = null; s.result = null; s.busy = ''; render();
      }
      async function fetchKind(kind) {
        if (s.busy || !s.projectId) return;
        s.busy = kind.id; s.error = ''; s.saved = ''; render();
        try {
          const out = await kind.fetch(connector, s.projectId);
          s.result = Object.assign(out, { kind: kind.id, name: `${(project() || {}).name || connector.name}: ${t('opencde.kind.' + kind.id)}` });
          log(t('opencde.fetched', { what: t('opencde.kind.' + kind.id), n: i18n.formatNumber(out.rows.length) }));
        } catch (err) { s.result = null; fail(err); }
        s.busy = ''; render();
      }
      async function saveTable(name) {
        const r = s.result; if (!r || s.saving) return;
        s.saving = true; render();
        try {
          const meta = await runner.toDataset({ columns: r.columns, rows: r.rows, meta: {} }, { name: name || r.name, description: opencde.describe(connector, t('opencde.kind.' + r.kind), (project() || {}).name), source: { kind: 'api', connectorId: connector.id, connectorName: connector.name, family: 'opencde', opencde: { kind: r.kind, projectId: s.projectId }, fetchedAt: new Date().toISOString() } });
          s.saved = t('api.saved', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          log(s.saved);
          if (api.onDataset) api.onDataset(meta);
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        s.saving = false; render();
      }
      /** Documents API: the user selects on the server's page; every chosen file is downloaded and imported. */
      async function fetchDocuments() {
        if (s.busy) return;
        if (!opencde.redirectUri()) { s.error = t('opencde.err.file.documents'); render(); return; }
        s.busy = 'documents'; s.error = ''; render();
        try {
          const selected = await opencde.selectDocuments(connector);
          if (!selected) { log(t('opencde.documents.cancelled'), 'warn'); }
          else {
            let n = 0;
            for (const version of selected.documents || []) {
              const file = await opencde.downloadVersion(connector, version);
              const meta = await importer.run(file, {}, null, version.title || undefined);
              n++;
              if (api.onDataset && meta) api.onDataset(meta);
            }
            log(t('opencde.documents.imported', { n: i18n.formatNumber(n) }));
            overlays.toast.show(t('opencde.documents.imported', { n: i18n.formatNumber(n) }), { kind: 'ok' });
          }
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }

      function render() {
        const signed = opencde.signedIn(connector);
        const head = h('div', { class: 'dm-card dm-stack-sm' },
          h('div', { class: 'dm-row' }, h('strong', { text: t('opencde.title') }), h('dm-badge', { kind: signed ? 'ok' : 'warn', text: signed ? t('opencde.status.in', { name: s.user ? (s.user.name || s.user.id) : '' }) : t('opencde.status.out') })),
          h('p', { class: 'dm-help dm-small', text: t('opencde.hint', { host: opencde.hostOf(connector.baseUrl) }) }),
          h('div', { class: 'dm-row-wrap' },
            signed ? basic.button({ label: t('opencde.signout'), icon: 'lock', size: 'sm', loading: s.busy === 'logout', onClick: signOut }) : basic.button({ label: t('opencde.signin'), icon: 'arrow-right', variant: 'primary', loading: s.busy === 'login', onClick: signIn }),
            signed && !s.projects ? basic.button({ label: t('opencde.projects.load'), size: 'sm', onClick: async () => { s.busy = 'projects'; render(); try { s.user = s.user || (await opencde.currentUser(connector)); await loadProjects(); } catch (err) { fail(err); } s.busy = ''; render(); } }) : null),
          s.manual ? manualBox() : null,
          s.error ? h('p', { class: 'dm-error', text: s.error }) : null);
        const nodes = [head];
        if (signed && s.projects) {
          const sel = /** @type {any} */ (h('dm-select', { label: t('opencde.project') }));
          sel.options = s.projects.map((p) => ({ value: p.project_id, label: p.name }));
          sel.value = s.projectId;
          sel.addEventListener('change', () => { s.projectId = sel.value; s.result = null; render(); });
          nodes.push(h('div', { class: 'dm-card dm-stack-sm' },
            s.projects.length ? sel : h('p', { class: 'dm-help', text: t('opencde.projects.none') }),
            h('div', { class: 'dm-row-wrap' },
              KINDS.map((k) => basic.button({ label: t('opencde.kind.' + k.id), icon: k.id === 'topics' ? 'list' : k.id === 'components' ? 'box' : k.id === 'events' ? 'history' : k.id === 'files' ? 'file' : 'message-square', size: 'sm', loading: s.busy === k.id, variant: k.id === 'topics' ? 'primary' : undefined, onClick: () => fetchKind(k) })),
              basic.button({ label: t('opencde.documents.fetch'), icon: 'download', size: 'sm', loading: s.busy === 'documents', title: t('opencde.documents.hint'), onClick: fetchDocuments })),
            h('p', { class: 'dm-help dm-xs', text: t('opencde.components.hint') })));
        }
        const resultEl = h('div');
        nodes.push(resultEl);
        replace(el, nodes);
        renderResult(resultEl);
      }
      function manualBox() {
        const input = /** @type {any} */ (h('dm-input', { label: t('opencde.manual.paste'), placeholder: 'http://127.0.0.1/dataspatium-callback?code=…&state=…' }));
        input.value = s.callback;
        input.addEventListener('input', () => { s.callback = input.value; });
        return h('div', { class: 'dm-stack-sm' },
          h('p', { class: 'dm-help dm-small', text: t('opencde.manual.hint') }),
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('opencde.manual.open'), icon: 'external-link', size: 'sm', onClick: () => window.open(s.manual.url, '_blank', 'noopener') })),
          input,
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('opencde.manual.finish'), icon: 'check', variant: 'primary', size: 'sm', loading: s.busy === 'login', onClick: finishManual }), basic.button({ label: t('common.cancel'), variant: 'ghost', size: 'sm', onClick: () => { s.manual = null; s.callback = ''; render(); } })));
      }
      function renderResult(resultEl) {
        const r = s.result; if (!r) { replace(resultEl); return; }
        const table = /** @type {any} */ (h('dm-table', { class: 'dm-table-tall' }));
        const rows = r.rows.slice(0, PREVIEW_ROWS);
        const nameInput = /** @type {any} */ (h('dm-input', { label: t('api.name') })); nameInput.value = r.name;
        replace(resultEl, h('div', { class: 'dm-card dm-stack' },
          h('div', { class: 'dm-row-wrap' }, h('strong', { text: t('api.result', { rows: i18n.formatNumber(r.rows.length), cols: r.columns.length }) })),
          h('div', { class: 'dm-table-wrap' }, table),
          s.saved ? h('p', { class: 'dm-success', text: s.saved }) : h('div', { class: 'dm-row-wrap dm-api-save' }, nameInput, basic.button({ label: t('api.save'), icon: 'save', variant: 'primary', loading: s.saving, onClick: () => saveTable(nameInput.value.trim()) }))));
        requestAnimationFrame(() => table.setData({ columns: r.columns.map((c) => ({ key: c, label: c, type: 'text' })), rowCount: rows.length, rowProvider: async (start, count) => rows.slice(start, start + count) }));
      }
      function start() {
        render();
        if (opencde.signedIn(connector) && !s.projects) {
          s.busy = 'projects'; render();
          Promise.resolve().then(async () => { try { s.user = await opencde.currentUser(connector); await loadProjects(); } catch (err) { fail(err); } s.busy = ''; render(); });
        }
      }
      return { el, start, state: s, signIn, signOut, fetchKind, saveTable, fetchDocuments, destroy: unsubscribe, KINDS };
    }
    return { create, KINDS };
  });
})();
