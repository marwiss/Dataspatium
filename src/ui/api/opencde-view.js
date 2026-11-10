// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The workspace view for an OpenCDE source (Dataregium) in Inhämta, the 1 series: sign in and out (OAuth2 with PKCE in a popup,
 * or by pasting the callback address under file://), what the server offers, documents chosen on the server's own page fetched as
 * datasets, and a dataset or a file sent to the server as a new document or version through its upload page. `openAdd` is the
 * dialog that adds a server as a source.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/opencde-view', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'api/families/opencde', 'api/secrets', 'api/connectors', 'data/datasets', 'io/export', 'platform/files'],
    (base, basic, overlays, icons, opencde, secrets, connectors, datasets, exporter, files) => {
      const { h, t, replace } = base;
      const SEND_FORMATS = ['csv', 'xlsx', 'json'];

      /**
       * @param {any} ctx shell context @param {any} connector an OpenCDE connector
       * @param {{onDataset?: Function, onRemoved?: Function}} [hooks]
       */
      function create(ctx, connector, hooks = {}) {
        const { shell, store } = ctx;
        const s = { busy: '', error: '', note: '', user: null, caps: null, manual: null, callback: '', fetched: [], sent: '', what: 'dataset', datasetId: '', format: 'csv', progress: null };
        const el = h('div', { class: 'dm-stack dm-api-view' });
        const unsubscribe = secrets.subscribe(() => render());
        const log = (msg, kind) => { if (shell && shell.log) shell.log(msg, kind || 'ok'); };
        const fail = (err) => { s.error = String((err && err.message) || err); log(`${connector.name}: ${s.error}`, 'error'); };
        const isCancelled = (err) => String((err && err.message) || '') === t('opencde.err.cancelled');
        const isPopupFailure = (err) => [t('opencde.err.popup'), t('opencde.err.timeout'), t('opencde.err.closed')].includes(String((err && err.message) || ''));
        const signed = () => opencde.signedIn(connector);

        async function afterSignIn() {
          try { s.user = await opencde.currentUser(connector); } catch (err) { s.user = null; D.log('opencde', 'current user', err); }
          log(t('opencde.log.signedin', { host: opencde.hostOf(connector.baseUrl) }), 'ok');
        }
        async function signIn() {
          if (s.busy) return;
          s.busy = 'login'; s.error = ''; s.note = ''; render();
          try {
            if (opencde.redirectUri()) { await opencde.login(connector); await afterSignIn(); }
            else { s.manual = await opencde.manualStart(connector, 'http://127.0.0.1/dataspatium-callback'); window.open(s.manual.url, '_blank', 'noopener'); }
          } catch (err) {
            // A popup that could not answer (blocked, closed, or cut off by the server's opener policy): the same sign-in in a new
            // tab, whose callback address the user pastes here. A wait the user stopped is no error.
            if (isCancelled(err)) { /* the user pressed Avbryt */ } else if (opencde.redirectUri() && isPopupFailure(err)) {
              try { s.manual = await opencde.manualStart(connector, opencde.redirectUri()); window.open(s.manual.url, '_blank', 'noopener'); s.note = t('opencde.manual.fallback'); } catch (err2) { fail(err2); }
            } else fail(err);
          }
          s.busy = ''; render();
        }
        async function finishManual() {
          if (!s.manual || !s.callback.trim()) return;
          s.busy = 'login'; s.error = ''; render();
          try { await opencde.manualFinish(connector, s.manual, s.callback.trim()); s.manual = null; s.callback = ''; s.note = ''; await afterSignIn(); } catch (err) { fail(err); }
          s.busy = ''; render();
        }
        async function signOut() {
          s.busy = 'logout'; render();
          try { await opencde.logout(connector); } catch (err) { fail(err); }
          s.user = null; s.fetched = []; s.sent = ''; s.busy = ''; render();
        }
        /** The user picks documents on the server's page; each chosen version becomes a dataset. */
        async function fetchDocuments() {
          if (s.busy) return;
          s.busy = 'documents'; s.error = ''; s.note = ''; render();
          try {
            const chosen = await opencde.selectDocuments(connector);
            if (!chosen) s.note = t('opencde.documents.cancelled');
            else {
              const versions = (chosen && chosen.documents) || [];
              if (!versions.length) s.note = t('opencde.documents.none');
              for (const version of versions) {
                const ds = await opencde.importVersion(connector, version);
                s.fetched.push(ds);
                log(t('opencde.documents.fetched', { name: ds.name }), 'ok');
                if (hooks.onDataset) hooks.onDataset(ds);
              }
            }
          } catch (err) { if (isCancelled(err)) s.note = t('opencde.documents.cancelled'); else fail(err); }
          s.busy = ''; render();
        }
        /** The file to send: the chosen dataset exported, or a file from the computer. */
        async function fileToSend() {
          if (s.what === 'file') { const [file] = await files.pick({}); return file || null; }
          if (!s.datasetId) throw new Error(t('opencde.send.choose'));
          const out = await exporter.exportDataset(s.datasetId, s.format);
          return new File([out.blob], out.filename, { type: out.blob.type || 'application/octet-stream' });
        }
        async function send() {
          if (s.busy) return;
          s.busy = 'send'; s.error = ''; s.note = ''; s.sent = ''; s.progress = null; render();
          try {
            const file = await fileToSend();
            if (!file) { s.busy = ''; render(); return; }
            const version = await opencde.uploadDocument(connector, file, { onProgress: (p) => { s.progress = p; renderProgress(); } });
            if (!version) s.sent = t('opencde.send.cancelled');
            else { s.sent = t('opencde.send.done', { name: version.title || file.name, version: String(version.version_number || version.version_index || '') }); log(s.sent, 'ok'); }
          } catch (err) { if (isCancelled(err)) s.sent = t('opencde.send.cancelled'); else fail(err); }
          s.busy = ''; s.progress = null; render();
        }
        async function remove() {
          if (!(await overlays.dialog.confirm(t('opencde.remove.confirm', { name: connector.name }), { danger: true, okLabel: t('opencde.remove') }))) return;
          try { await opencde.logout(connector); } catch (_e) { /* the tokens go anyway */ }
          secrets.forget(connector.id);
          await connectors.remove(connector.id);
          log(t('opencde.removed', { name: connector.name }), 'ok');
          if (hooks.onRemoved) hooks.onRemoved();
        }
        /** Shown while a popup waits for the user, who may otherwise sit for five minutes if the window was closed unseen. */
        const cancelButton = () => basic.button({ label: t('common.cancel'), size: 'sm', title: t('opencde.cancel.hint'), 'data-opencde-cancel': '', onClick: () => opencde.cancelPopup() });
        function capsText(caps) {
          const server = caps.server ? `${caps.server.name || 'Dataregium'}${caps.server.version ? ' ' + caps.server.version : ''}` : 'Dataregium';
          const on = Object.keys(caps.extensions || {}).filter((k) => caps.extensions[k] && caps.extensions[k].enabled);
          return t('opencde.caps', { server, apis: Object.entries(caps.apis || {}).map(([k, v]) => `${k} ${v}`).join(', ') || '–', extensions: on.join(', ') || '–' });
        }
        function manualBox() {
          const input = /** @type {any} */ (h('dm-input', { label: t('opencde.manual.callback'), placeholder: 'http://127.0.0.1/dataspatium-callback?code=…&state=…', value: s.callback }));
          input.addEventListener('input', () => { s.callback = input.value; });
          return h('div', { class: 'dm-card dm-stack-sm', 'data-opencde-manual': '' },
            h('strong', { text: t('opencde.manual.title') }),
            h('p', { class: 'dm-help dm-small', text: t('opencde.manual.hint') }),
            basic.button({ label: t('opencde.manual.open'), icon: 'link', size: 'sm', onClick: () => window.open(s.manual.url, '_blank', 'noopener') }),
            input,
            h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('opencde.manual.finish'), icon: 'chevron-right', variant: 'primary', size: 'sm', loading: s.busy === 'login', onClick: finishManual })));
        }
        let progressEl = null;
        function renderProgress() {
          if (!progressEl || !s.progress) return;
          const p = s.progress;
          replace(progressEl, h('dm-progress', { value: String(p.total ? Math.round((p.done / p.total) * 100) : 0), label: t('opencde.send.uploading') }));
        }
        function sendCard() {
          const list = (store && store.get && store.get().datasets) || [];
          if (!s.datasetId && list[0]) s.datasetId = list[0].id;
          const what = /** @type {any} */ (h('dm-select', { label: t('opencde.send.what') }));
          what.options = [{ value: 'dataset', label: t('opencde.send.what.dataset') }, { value: 'file', label: t('opencde.send.what.file') }];
          what.value = s.what;
          what.addEventListener('change', () => { s.what = what.value; render(); });
          const sel = /** @type {any} */ (h('dm-select', { label: t('opencde.send.dataset') }));
          sel.options = list.map((d) => ({ value: d.id, label: d.name }));
          sel.value = s.datasetId;
          sel.addEventListener('change', () => { s.datasetId = sel.value; });
          const fmt = /** @type {any} */ (h('dm-select', { label: t('opencde.send.format') }));
          fmt.options = SEND_FORMATS.map((id) => { const f = exporter.FORMATS.find((x) => x.id === id); return { value: id, label: f && f.key ? t(f.key) : id }; });
          fmt.value = s.format;
          fmt.addEventListener('change', () => { s.format = fmt.value; });
          progressEl = h('div', { 'data-opencde-progress': '' });
          return h('div', { class: 'dm-card dm-stack-sm', 'data-opencde-send': '' },
            h('strong', { text: t('opencde.send.title') }),
            h('p', { class: 'dm-help dm-small', text: t('opencde.send.hint') }),
            what,
            s.what === 'dataset' ? h('div', { class: 'dm-row-wrap' }, list.length ? sel : h('p', { class: 'dm-help', text: t('opencde.send.nodata') }), list.length ? fmt : null) : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('opencde.send.button'), icon: 'upload', variant: 'primary', size: 'sm', loading: s.busy === 'send', 'data-opencde-upload': '', onClick: send }),
              s.busy === 'send' ? cancelButton() : null),
            progressEl,
            s.sent ? h('p', { class: 'dm-help', 'data-opencde-sent': '', text: s.sent }) : null);
        }
        function render() {
          const isSigned = signed();
          replace(el,
            h('div', { class: 'dm-page-head' },
              h('h1', null, icons.icon('globe', 20), connector.name),
              h('div', { class: 'dm-row' }, basic.button({ label: t('opencde.remove'), icon: 'trash-2', variant: 'ghost', size: 'sm', onClick: remove }))),
            h('p', { class: 'dm-help', text: t('opencde.hint', { host: opencde.hostOf(connector.baseUrl) }) }),
            h('div', { class: 'dm-card dm-stack-sm' },
              h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('opencde.title') }), h('dm-badge', { kind: isSigned ? 'ok' : 'warn', text: isSigned ? t('opencde.status.in', { name: s.user ? (s.user.name || s.user.id) : '' }) : t('opencde.status.out') })),
              s.caps && s.caps.present ? h('p', { class: 'dm-help dm-xs', 'data-opencde-capabilities': '', text: capsText(s.caps) }) : null,
              h('div', { class: 'dm-row-wrap' },
                isSigned ? basic.button({ label: t('opencde.signout'), icon: 'lock', size: 'sm', loading: s.busy === 'logout', onClick: signOut })
                  : basic.button({ label: t('opencde.signin'), icon: 'chevron-right', variant: 'primary', loading: s.busy === 'login', 'data-opencde-signin': '', onClick: signIn }),
                !isSigned && s.busy === 'login' && !s.manual && opencde.redirectUri() ? cancelButton() : null),
              s.manual ? manualBox() : null,
              s.error ? h('p', { class: 'dm-error', 'data-opencde-error': '', text: s.error }) : null,
              s.note ? h('p', { class: 'dm-help', text: s.note }) : null),
            isSigned ? h('div', { class: 'dm-card dm-stack-sm', 'data-opencde-documents-card': '' },
              h('strong', { text: t('opencde.documents.title') }),
              h('p', { class: 'dm-help dm-small', text: t('opencde.documents.hint') }),
              h('div', { class: 'dm-row-wrap' },
                basic.button({ label: t('opencde.documents.fetch'), icon: 'download', variant: 'primary', size: 'sm', loading: s.busy === 'documents', 'data-opencde-documents': '', onClick: fetchDocuments }),
                s.busy === 'documents' ? cancelButton() : null),
              s.fetched.length ? h('ul', { class: 'dm-list dm-small', 'data-opencde-fetched': '' }, s.fetched.map((d) => h('li', { text: d.name }))) : null) : null,
            isSigned ? sendCard() : null);
          renderProgress();
        }
        function start() {
          render();
          opencde.capabilities(connector).then((caps) => { s.caps = caps; render(); }).catch((err) => D.log('opencde', 'capabilities', err));
          if (signed() && !s.user) opencde.currentUser(connector).then((u) => { s.user = u; render(); }).catch(() => {});
        }
        function destroy() { unsubscribe(); }
        return { el, start, destroy, state: s, signIn, finishManual, signOut, fetchDocuments, send };
      }

      /**
       * The dialog that adds a server as a source: address, and a client id only when the server does not let the app register
       * itself. Resolves with the saved connector, or null when the user cancelled.
       * @param {any} _ctx @param {{values?: {baseUrl?: string, clientId?: string}}} [options]
       */
      async function openAdd(_ctx, options = {}) {
        const values = Object.assign({ baseUrl: '', clientId: '', clientSecret: '' }, options.values || {});
        let error = '';
        for (;;) {
          const baseUrl = /** @type {any} */ (h('dm-input', { label: t('opencde.add.baseUrl'), placeholder: 'https://cde.example.org', value: values.baseUrl, required: '' }));
          const clientId = /** @type {any} */ (h('dm-input', { label: t('opencde.add.clientId'), help: t('opencde.add.clientId.hint'), value: values.clientId }));
          const clientSecret = /** @type {any} */ (h('dm-input', { label: t('opencde.add.clientSecret'), type: 'password', help: t('opencde.add.clientSecret.hint'), value: values.clientSecret }));
          const body = h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help', text: t('opencde.add.hint') }), baseUrl, clientId, clientSecret, error ? h('p', { class: 'dm-error', text: error }) : null);
          const ok = await overlays.dialog.open({ title: t('opencde.add.title'), body, actions: [{ label: t('common.cancel'), value: false }, { label: t('opencde.add.save'), variant: 'primary', value: true, primary: true }] });
          Object.assign(values, { baseUrl: baseUrl.value, clientId: clientId.value, clientSecret: clientSecret.value });
          if (ok !== true) return null;
          try { return await opencde.createConnector(values, { redirectUri: opencde.redirectUri() }); } catch (err) { error = String((err && err.message) || err); }
        }
      }
      return { create, openAdd };
    });
})();
