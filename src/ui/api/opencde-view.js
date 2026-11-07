// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for an OpenCDE source in Inhämta: sign in with the server's OAuth2 flow (popup, or paste the callback
 * address under file://), choose a project, and fetch its topics, comments, viewpoint components, events or files
 * as tables with "Spara som datamängd". "Hämta dokument" opens the server's own selection page (Documents API);
 * the chosen files are downloaded and imported like files dropped on the app (IFC models become model datasets). The card IFC-graf shows
 * the server's graph through its read-only graph query (ui/api/graph-workbench), or says how to reach it when that is off.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/opencde-view', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/opencde', 'api/families/opencde-admin', 'api/graph-source', 'api/secrets', 'api/runner', 'io/import', 'ui/api/cde-log-card', 'ui/api/admin-panel', 'ui/api/graph-workbench'], (base, basic, overlays, opencde, admin, graphSource, secrets, runner, importer, cdeLogCard, adminPanel, workbench) => {
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
      const s = { busy: '', error: '', user: null, projects: null, projectId: '', result: null, saving: false, saved: '', manual: null, callback: '', files: null, rights: null, fetching: '', note: '' };
      const el = h('div', { class: 'dm-stack' });
      const unsubscribe = secrets.subscribe(() => render());
      const project = () => (s.projects || []).find((p) => p.project_id === s.projectId) || null;
      const log = (msg, kind) => { if (api.log) api.log(msg, kind || 'ok'); };
      /** What the app has sent to this server, in a card of its own at the bottom. */
      const logCard = cdeLogCard.create(connector, { log, onDataset: (m) => { if (api.onDataset) api.onDataset(m); } });
      /** The server's administration (Kontroll's extension), a card of its own that stays hidden for servers without the API. */
      const adminUi = adminPanel.create({ connector, ctx: api.ctx, log, onDataset: (m) => { if (api.onDataset) api.onDataset(m); } });
      const fail = (err) => { s.error = String((err && err.message) || err); log(`${connector.name}: ${s.error}`, 'error'); };
      /** A link that named a project and a document waits here while the user still has to sign in. */
      let pendingLink = null;
      /** The card IFC-graf, which appears when the server says it has a graph. */
      const graphEl = h('div', { class: 'dm-card dm-stack-sm', 'data-ifcgraph-card': '' });
      graphEl.hidden = true;
      /** The workbench, made once the session may use the graph query, and a model's request that waits for that sign-in. */
      let graphBench = null; let graphLink = null;
      function benchOnce() {
        if (!graphBench) {
          graphBench = workbench.create({
            connector, via: 'admin', ctx: api.ctx, log, onDataset: (m) => { if (api.onDataset) api.onDataset(m); }, onInspector: () => { if (api.refreshRight) api.refreshRight(); },
            run: graphSource.adminRunner(connector),
            hint: t('ifcgraph.card.hint', { host: opencde.hostOf(connector.baseUrl) }),
          });
          graphBench.start();
        }
        return graphBench;
      }
      /** A model's page asked for its graph and the session may now read it. */
      function followGraphLink() {
        if (!graphLink || !s.caps || !opencde.hasExtension(s.caps, 'graph_query') || !admin.hasAdminScope(connector)) return;
        const link = graphLink; graphLink = null;
        benchOnce().follow(link).catch((err) => D.log('opencde-view', err));
      }
      async function graphSignIn() {
        await adminUi.signIn();
        if (opencde.signedIn(connector) && !s.projects) { try { await afterSignIn(); } catch (err) { fail(err); } }
        render();
        followGraphLink();
      }
      /** The Neo4j source dialog, with the address the server announces. @param {string} [address] */
      async function addBoltSource(address) {
        const created = await D.require('ui/api/family-dialog').open(api.ctx, { family: 'neo4j', values: { baseUrl: address || '' } });
        if (created && api.onConnector) api.onConnector(created);
      }
      function renderGraphCard() {
        const caps = s.caps;
        graphEl.hidden = !caps || !opencde.hasExtension(caps, 'ifcgraph');
        if (graphEl.hidden) { replace(graphEl); return; }
        const viaQuery = opencde.hasExtension(caps, 'graph_query');
        const bolt = caps.extensions.ifcgraph.bolt || '';
        const head = h('strong', { text: t('ifcgraph.title') });
        if (viaQuery && admin.hasAdminScope(connector)) { replace(graphEl, head, benchOnce().el); return; }
        replace(graphEl, head,
          viaQuery ? h('p', { class: 'dm-help dm-small', text: t(graphLink ? 'ifcgraph.card.signin.link' : 'ifcgraph.card.signin') }) : null,
          bolt ? h('p', { class: 'dm-help dm-small', text: t('ifcgraph.card.bolt', { url: bolt }) }) : null,
          !viaQuery && !bolt ? h('p', { class: 'dm-help dm-small', text: t('ifcgraph.card.closed') }) : null,
          h('div', { class: 'dm-row-wrap' },
            viaQuery ? basic.button({ label: t('admin.signin'), icon: 'lock', size: 'sm', 'data-ifcgraph-signin': '', onClick: graphSignIn }) : null,
            basic.button({ label: t('ifcgraph.card.add'), icon: 'database', size: 'sm', title: t('ifcgraph.card.add.hint'), 'data-ifcgraph-bolt': '', onClick: () => addBoltSource(bolt) })));
      }

      async function signIn() {
        if (s.busy) return;
        s.busy = 'login'; s.error = ''; render();
        try {
          if (opencde.redirectUri()) await opencde.login(connector);
          else { s.manual = await opencde.manualStart(connector, 'http://127.0.0.1/dataspatium-callback'); window.open(s.manual.url, '_blank', 'noopener'); s.busy = ''; render(); return; }
          await afterSignIn();
        } catch (err) {
          // The popup could not answer (blocked, closed, or cut off by the server's opener policy): the same sign-in in a new tab,
          // whose callback address the user pastes here, exactly as the callback page says.
          if (opencde.redirectUri() && isPopupFailure(err)) {
            try { s.manual = await opencde.manualStart(connector, opencde.redirectUri()); window.open(s.manual.url, '_blank', 'noopener'); s.note = t('opencde.manual.fallback'); } catch (err2) { fail(err2); }
          } else fail(err);
        }
        s.busy = ''; render();
        await followLink();
      }
      const isPopupFailure = (err) => { const m = String((err && err.message) || ''); return [t('opencde.err.popup'), t('opencde.err.timeout'), t('opencde.err.closed')].includes(m); };
      async function finishManual() {
        if (!s.manual || !s.callback.trim()) return;
        s.busy = 'login'; s.error = ''; render();
        try { await opencde.manualFinish(connector, s.manual, s.callback.trim()); s.manual = null; s.callback = ''; s.note = ''; await afterSignIn(); } catch (err) { fail(err); }
        s.busy = ''; render();
        await followLink();
      }
      async function afterSignIn() {
        s.user = await opencde.currentUser(connector);
        log(t('opencde.signed.in', { name: s.user.name || s.user.id, host: opencde.hostOf(connector.baseUrl) }));
        await loadProjects();
      }
      async function loadProjects() {
        s.projects = await opencde.projects(connector);
        if (!s.projectId || !project()) s.projectId = s.projects[0] ? s.projects[0].project_id : '';
        await loadRights();
      }
      /** What the user may do in the chosen project, said in words so that nobody wonders why a button is missing later. */
      async function loadRights() {
        s.rights = null; s.files = null;
        if (!s.projectId) return;
        try { s.rights = await opencde.rights(connector, s.projectId); } catch (err) { D.log('opencde', 'rights', err); }
      }
      /** The project's files, as the server lists them. */
      async function loadFiles() {
        if (s.busy || !s.projectId) return;
        s.busy = 'files'; s.error = ''; render();
        try { s.files = await opencde.filesList(connector, s.projectId); log(t('opencde.files.loaded', { n: i18n.formatNumber(s.files.length) })); } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      /** The link's request waits in the store until this source's view starts; it is taken once. */
      function takeDeepLink() {
        const st = api.ctx && api.ctx.store;
        const p = st && typeof st.get === 'function' ? st.get().pendingCde : null;
        if (!p || p.connectorId !== connector.id) return null;
        st.set({ pendingCde: null });
        return p;
      }
      /** A link named a project and maybe a document (#/inhamta/opencde?…&project=…&document=…&version=…): choose and fetch them. */
      async function applyDeepLink(p) {
        if (!s.projects) await loadProjects();
        if (p.projectId) {
          if (!(s.projects || []).some((x) => x.project_id === p.projectId)) { s.error = t('opencde.deeplink.noproject'); render(); return; }
          if (s.projectId !== p.projectId) { s.projectId = p.projectId; s.result = null; await loadRights(); }
          log(t('opencde.deeplink.project', { project: (project() || {}).name || p.projectId }));
        }
        render();
        if (!p.documentId) return;
        await loadFiles();
        const entry = (s.files || []).find((f) => f.documentId === p.documentId && (p.versionIndex == null || Number(f.versionIndex) === Number(p.versionIndex)));
        if (!entry) { s.error = t('opencde.deeplink.nodocument'); render(); return; }
        await fetchFile(entry);
      }
      /** After a sign-in: the link that waited is followed. */
      async function followLink() {
        if (!pendingLink || !opencde.signedIn(connector)) return;
        const p = pendingLink; pendingLink = null; s.note = '';
        try { await applyDeepLink(p); } catch (err) { fail(err); }
        render();
      }
      const isBundle = (f) => /\.dataspatium\.zip$/i.test(String(f.filename || ''));
      /** One file becomes a dataset of its own kind: a model, a document, a table; a bundle is received as a whole. */
      async function fetchFile(entry) {
        if (s.fetching) return;
        s.fetching = entry.reference; s.error = ''; render();
        try {
          if (isBundle(entry)) {
            // A workspace bundle from a colleague: the same door as a bundle file dropped in Inhämta.
            const file = await opencde.downloadFile(connector, entry);
            const res = await D.require('ui/share/bundle').receiveFile(api.ctx, file);
            if (res) log(t('opencde.file.received', { name: entry.filename }));
            s.fetching = ''; render();
            return;
          }
          const meta = await opencde.importFile(connector, project() || { project_id: s.projectId, name: '' }, entry);
          log(t('opencde.file.imported', { name: meta.name }));
          overlays.toast.show(t('opencde.file.imported', { name: meta.name }), { kind: 'ok' });
          if (api.onDataset) api.onDataset(meta);
        } catch (err) { fail(err); }
        s.fetching = ''; render();
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
          s.caps && s.caps.present ? h('p', { class: 'dm-help dm-xs', 'data-opencde-capabilities': '', text: capsText(s.caps) }) : null,
          versionRow(),
          h('div', { class: 'dm-row-wrap' },
            signed ? basic.button({ label: t('opencde.signout'), icon: 'lock', size: 'sm', loading: s.busy === 'logout', onClick: signOut }) : basic.button({ label: t('opencde.signin'), icon: 'chevron-right', variant: 'primary', loading: s.busy === 'login', onClick: signIn }),
            signed && !s.projects ? basic.button({ label: t('opencde.projects.load'), size: 'sm', onClick: async () => { s.busy = 'projects'; render(); try { s.user = s.user || (await opencde.currentUser(connector)); await loadProjects(); } catch (err) { fail(err); } s.busy = ''; render(); } }) : null),
          s.manual ? manualBox() : null,
          s.error ? h('p', { class: 'dm-error', text: s.error }) : null,
          s.note ? h('p', { class: 'dm-help', text: s.note }) : null);
        const nodes = [head];
        if (signed && s.projects) {
          const sel = /** @type {any} */ (h('dm-select', { label: t('opencde.project') }));
          sel.options = s.projects.map((p) => ({ value: p.project_id, label: p.name }));
          sel.value = s.projectId;
          sel.addEventListener('change', () => { s.projectId = sel.value; s.result = null; loadRights().then(render); render(); });
          nodes.push(h('div', { class: 'dm-card dm-stack-sm' },
            s.projects.length ? sel : h('p', { class: 'dm-help', text: t('opencde.projects.none') }),
            h('div', { class: 'dm-row-wrap' },
              KINDS.map((k) => basic.button({ label: t('opencde.kind.' + k.id), icon: k.id === 'topics' ? 'list' : k.id === 'components' ? 'box' : k.id === 'events' ? 'history' : k.id === 'files' ? 'file' : 'message-square', size: 'sm', loading: s.busy === k.id, variant: k.id === 'topics' ? 'primary' : undefined, onClick: () => fetchKind(k) })),
              opencde.hasDocuments(connector) ? basic.button({ label: t('opencde.documents.fetch'), icon: 'download', size: 'sm', loading: s.busy === 'documents', title: t('opencde.documents.hint'), 'data-opencde-documents': '', onClick: fetchDocuments }) : null),
            h('p', { class: 'dm-help dm-xs', text: t('opencde.components.hint') }),
            s.rights ? h('p', { class: 'dm-help dm-xs', 'data-opencde-rights': '', text: rightsText(s.rights) }) : null));
          nodes.push(filesCard());
        }
        const resultEl = h('div');
        nodes.push(resultEl, graphEl, adminUi.el, logCard.el);
        renderGraphCard();
        replace(el, nodes);
        renderResult(resultEl);
      }
      function rightsText(r) {
        const can = [];
        if (r.project.includes('createTopic')) can.push(t('opencde.rights.topics'));
        if (r.project.includes('createDocument')) can.push(t('opencde.rights.documents'));
        return can.length ? t('opencde.rights.can', { what: can.join(', ') }) : t('opencde.rights.read');
      }
      /** The project's files with a button each; models are marked, since they become model datasets. */
      function filesCard() {
        const rows = (s.files || []).map((f) => h('div', { class: 'dm-row dm-opencde-file', 'data-opencde-file': f.filename },
          h('span', { class: 'dm-grow dm-truncate' }, h('span', { text: f.filename }), h('span', { class: 'dm-help dm-xs', text: ' ' + [f.model ? t('opencde.file.model') : '', f.source, f.versionIndex ? t('opencde.file.version', { n: f.versionIndex }) : '', f.date ? i18n.formatDateTime(f.date) : ''].filter(Boolean).join(' · ') })),
          basic.button({ label: t(isBundle(f) ? 'opencde.file.receive' : 'opencde.file.fetch'), icon: isBundle(f) ? 'package' : 'download', size: 'sm', loading: s.fetching === f.reference, title: t(isBundle(f) ? 'opencde.file.receive.hint' : 'opencde.file.fetch.hint'), onClick: () => fetchFile(f) })));
        return h('div', { class: 'dm-card dm-stack-sm', 'data-opencde-files': '' },
          h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('opencde.files.title') }), basic.button({ label: s.files ? t('opencde.files.again') : t('opencde.files.show'), icon: 'folder-open', size: 'sm', loading: s.busy === 'files', onClick: loadFiles })),
          h('p', { class: 'dm-help dm-xs', text: t('opencde.files.hint') }),
          opencde.bcfVersion(connector) === '2.1' ? h('p', { class: 'dm-help dm-xs', 'data-opencde-files-bcf21': '', text: t(opencde.hasDocuments(connector) ? 'opencde.files.bcf21.documents' : 'opencde.files.bcf21') }) : null,
          s.files && !s.files.length ? h('p', { class: 'dm-help', text: t('opencde.files.none') }) : null,
          rows.length ? h('div', { class: 'dm-stack-xs' }, rows) : null);
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
      /** Which version of the BCF API this source speaks, with a choice when the server offers more than one. */
      function versionRow() {
        const list = opencde.bcfVersionsOf(connector, s.caps);
        const current = opencde.bcfVersion(connector);
        if (list.length < 2) return h('p', { class: 'dm-help dm-xs', 'data-opencde-bcf': current, text: t('opencde.bcf.speaks', { version: current }) });
        const sel = /** @type {any} */ (h('dm-select', { label: t('families.field.bcfVersion'), inline: true, title: t('opencde.bcf.choose.hint'), 'data-opencde-bcf-select': '' }));
        sel.options = list.map((v) => ({ value: v, label: 'BCF API ' + v }));
        sel.value = current;
        sel.addEventListener('change', () => changeVersion(sel.value));
        return h('div', { class: 'dm-row-wrap', 'data-opencde-bcf': current }, sel);
      }
      /** The same server through another version: what was read through the old one goes, and the projects are read again. */
      async function changeVersion(version) {
        if (version === opencde.bcfVersion(connector)) return;
        s.busy = 'projects'; s.error = ''; s.result = null; s.files = null; s.rights = null; render();
        try {
          await opencde.setBcfVersion(connector, version);
          log(t('opencde.bcf.changed', { version }));
          if (opencde.signedIn(connector)) { s.user = await opencde.currentUser(connector); await loadProjects(); }
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      /** What the server offers beyond the specifications, for the line under the heading. */
      function capsText(caps) {
        const server = caps.server ? `${caps.server.name || 'Kontroll'}${caps.server.version ? ' ' + caps.server.version : ''}` : 'Kontroll';
        const list = Object.keys(caps.extensions).filter((k) => opencde.hasExtension(caps, k)).map((k) => { const key = 'opencde.ext.' + k; const x = t(key); return x === key ? k : x; });
        return t('opencde.caps', { server, list: list.length ? list.join(', ') : t('opencde.caps.none') });
      }
      function start() {
        s.caps = null;
        graphLink = graphSource.takeLink(api.ctx, connector);
        opencde.capabilities(connector).then((caps) => { s.caps = caps; render(); followGraphLink(); }).catch((err) => D.log('opencde', 'capabilities', err));
        adminUi.start().catch((err) => D.log('opencde', 'admin', err));
        const link = takeDeepLink();
        const signed = opencde.signedIn(connector);
        if (link && !signed) { pendingLink = link; s.note = t('opencde.deeplink.signin'); }
        render();
        if (signed && !s.projects) {
          s.busy = 'projects'; render();
          Promise.resolve().then(async () => {
            try { s.user = await opencde.currentUser(connector); await loadProjects(); } catch (err) { fail(err); }
            s.busy = ''; render();
            if (link) { try { await applyDeepLink(link); } catch (err) { fail(err); } render(); }
          });
        } else if (link && signed) {
          Promise.resolve().then(async () => { try { await applyDeepLink(link); } catch (err) { fail(err); } render(); });
        }
      }
      return { el, start, state: s, signIn, signOut, fetchKind, saveTable, fetchDocuments, loadFiles, fetchFile, changeVersion, graphSignIn, graph: () => graphBench, inspector: () => (graphBench ? graphBench.inspector() : null), destroy: () => { unsubscribe(); logCard.destroy(); adminUi.destroy(); if (graphBench) graphBench.destroy(); }, KINDS };
    }
    return { create, KINDS };
  });
})();
