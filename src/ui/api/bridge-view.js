// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * "Databas via bryggan" in Inhämta: connect to the local database bridge (address and token from its window),
 * describe a source (Access or Excel file, SQL Server, ODBC DSN or connection string, SQLite file), list its
 * tables, preview one and import it with types, or run own SQL and import the result. Writes through the bridge
 * are shown and approved statement by statement when the bridge was started with write access.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/bridge-view', ['ui/base', 'ui/basic', 'ui/icons', 'ui/overlays', 'api/bridge', 'api/secrets'], (base, basic, icons, overlays, bridge, secrets) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW = 100;
    /** Fields per source kind: [name, label key, placeholder]. */
    const FIELDS = {
      access: [['path', 'bridge.field.path', 'C:\\Data\\register.accdb'], ['password', 'bridge.field.password', '']],
      excel: [['path', 'bridge.field.path', 'C:\\Data\\tabell.xlsx']],
      sqlite: [['path', 'bridge.field.path', '/Users/namn/data.sqlite']],
      sqlserver: [['server', 'bridge.field.server', 'localhost\\SQLEXPRESS'], ['database', 'bridge.field.database', ''], ['user', 'bridge.field.user', ''], ['password', 'bridge.field.password', '']],
      dsn: [['dsn', 'bridge.field.dsn', ''], ['user', 'bridge.field.user', ''], ['password', 'bridge.field.password', '']],
      odbc: [['connectionString', 'bridge.field.connection', 'Driver={...};Server=...;Database=...;Uid=...;Pwd=...;']],
      oledb: [['connectionString', 'bridge.field.connection', 'Provider=...;Data Source=...;']],
    };
    const SECRET = new Set(['password', 'connectionString']);

    /**
     * @param {any} ctx the mode context
     * @returns {{el: HTMLElement, state: any, start: () => Promise<void>, destroy: () => void, render: () => void, connect: (url: string, token: string) => Promise<void>, loadTables: () => Promise<void>, selectTable: (name: string) => Promise<void>, importSelected: (name?: string) => Promise<any>, runSql: (sql: string) => Promise<void>, importSql: (name?: string) => Promise<any>}}
     */
    function create(ctx, options = {}) {
      const { shell, store } = ctx;
      const state = { url: '', info: null, error: '', busy: '', sources: null, source: { kind: 'access' }, tables: null, table: null, preview: null, sql: '', sqlResult: null, name: '', persisted: false };
      const el = h('div', { class: 'dm-stack dm-bridge' });
      let unsub = null; let destroyed = false;
      const fail = (err) => { state.error = (err && err.message) || String(err); state.busy = ''; shell.log(state.error, 'error'); render(); };
      const kinds = () => (state.info && Array.isArray(state.info.kinds) ? state.info.kinds : Object.keys(FIELDS)).filter((k) => FIELDS[k]);

      /** @type {Promise<void>|null} the start in flight, so that a database chosen from the left column waits for it */
      let ready = null;
      function start() { ready = startNow(); return ready; }
      async function startNow() {
        unsub = bridge.subscribe(() => { if (!destroyed) render(); });
        try { state.persisted = await secrets.isPersisted(bridge.ID); } catch (_e) { state.persisted = false; }
        state.url = await bridge.rememberedUrl();
        if (bridge.isConnected()) { try { state.info = await bridge.info(); } catch (err) { state.error = (err && err.message) || String(err); } }
        if (options.source) { state.source = Object.assign({}, options.source); if (bridge.isConnected()) { await loadTables(false); return; } }
        render();
      }
      /** A remembered database from Inhämta's list of added sources: shown, and its tables listed when the bridge is connected. */
      async function select(source) {
        if (ready) await ready;
        state.source = Object.assign({}, source);
        if (bridge.isConnected()) await loadTables(false); else render();
      }
      function destroy() { destroyed = true; if (unsub) unsub(); }

      async function connect(url, token) {
        state.busy = 'connect'; state.error = ''; render();
        try {
          state.info = await bridge.connect(url, token);
          state.busy = '';
          if (!kinds().includes(state.source.kind)) state.source = { kind: kinds()[0] || 'access' };
          shell.log(t('bridge.connected', { name: state.info.name || '', version: state.info.version || '' }), 'ok');
          render();
        } catch (err) { state.info = null; fail(err); }
      }
      async function unlock() {
        const pass = await overlays.dialog.prompt(t('api.key.passphrase'), { title: t('api.key.unlock') });
        if (!pass) return;
        try { await secrets.unlock(pass); if (bridge.isConnected()) { state.info = await bridge.info(true); } render(); } catch (err) { fail(err); }
      }
      async function persist() {
        const pass = await overlays.dialog.prompt(t('api.key.passphrase'), { title: t('api.key.save') });
        if (!pass) return;
        try { await bridge.persist(pass); state.persisted = true; overlays.toast.show(t('api.key.saved.toast'), { kind: 'ok' }); render(); } catch (err) { fail(err); }
      }
      async function disconnect() {
        await bridge.disconnect();
        state.info = null; state.tables = null; state.table = null; state.preview = null; state.sqlResult = null; state.sources = null;
        render();
      }
      async function loadSources() {
        state.busy = 'sources'; render();
        try { state.sources = await bridge.sources(); state.busy = ''; render(); } catch (err) { fail(err); }
      }
      async function loadTables(rememberIt = true) {
        state.busy = 'tables'; state.error = ''; state.tables = null; state.table = null; state.preview = null; render();
        try {
          state.tables = await bridge.tables(state.source);
          bridge.setCurrent(state.source);
          if (rememberIt) bridge.remember(state.source).catch((err) => D.log('bridge', 'could not remember the database', err));
          state.busy = '';
          render();
        } catch (err) { fail(err); }
      }
      async function selectTable(name) {
        state.table = name; state.name = name; state.preview = null; state.busy = 'preview'; state.error = ''; render();
        try { state.preview = await bridge.rows(state.source, name, PREVIEW); state.busy = ''; render(); } catch (err) { fail(err); }
      }
      function announce(meta) {
        const text = t('bridge.imported', { name: meta.name, rows: i18n.formatNumber(meta.rowCount || 0) });
        shell.log(text, 'ok');
        overlays.toast.show(text, { kind: 'ok', action: { label: t('analysera.open.bearbeta'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
      }
      async function importSelected(name) {
        if (!state.table) return null;
        state.busy = 'import'; render();
        try {
          const meta = await bridge.importTable(state.source, { table: state.table, name: (name || state.name || state.table).trim() });
          state.busy = ''; render(); announce(meta);
          return meta;
        } catch (err) { fail(err); return null; }
      }
      /** Own SQL against the source: SELECT shows the first rows; other statements are approved first. */
      async function runSql(sql) {
        state.sql = sql; state.sqlResult = null; state.error = ''; state.busy = 'sql'; render();
        try {
          state.sqlResult = await bridge.query(state.source, sql, { limit: PREVIEW });
        } catch (err) {
          if (!err || err.status !== 428) { fail(err); return; }
          state.busy = ''; render();
          const ok = await overlays.dialog.open({
            title: t('bridge.approve.title'),
            body: h('div', { class: 'dm-stack-sm' }, h('p', { text: t('bridge.approve.text', { name: bridge.sourceLabel(state.source) }) }), h('pre', { class: 'dm-help-code', text: sql })),
            actions: [{ label: t('common.cancel'), value: false }, { label: t('bridge.approve.ok'), variant: 'primary', value: true, primary: true }],
          });
          if (ok !== true) { state.sqlResult = { cancelled: true }; render(); return; }
          state.busy = 'sql'; render();
          try { state.sqlResult = await bridge.query(state.source, sql, { approved: true }); } catch (err2) { fail(err2); return; }
        }
        state.busy = '';
        if (state.sqlResult && state.sqlResult.affected !== undefined) shell.log(t('bridge.sql.affected', { n: i18n.formatNumber(state.sqlResult.affected) }), 'ok');
        render();
      }
      async function importSql(name) {
        if (!state.sql.trim()) return null;
        state.busy = 'import'; render();
        try {
          const meta = await bridge.importTable(state.source, { sql: state.sql, name: (name || t('bridge.fetched.name')).trim() });
          state.busy = ''; render(); announce(meta);
          return meta;
        } catch (err) { fail(err); return null; }
      }

      // ---- rendering ----
      function field(obj, name, labelKey, placeholder) {
        const inp = /** @type {any} */ (h('dm-input', { label: t(labelKey), type: SECRET.has(name) ? 'password' : 'text', placeholder }));
        inp.value = obj[name] || '';
        inp.addEventListener('input', () => { obj[name] = inp.value; });
        inp.addEventListener('change', () => { obj[name] = inp.value; });
        return inp;
      }
      function connectionCard() {
        const connected = bridge.isConnected() && state.info;
        if (connected) {
          const info = state.info;
          return h('div', { class: 'dm-card dm-stack-sm' },
            h('div', { class: 'dm-row-wrap' },
              icons.icon('database', 18),
              h('span', { text: t('bridge.status', { name: info.name || t('bridge.title'), version: info.version || '', platform: info.platform || '' }) }),
              h('dm-badge', { kind: info.allowWrite ? 'warn' : null, text: info.allowWrite ? t('bridge.writable') : t('bridge.readonly') }),
              h('code', { class: 'dm-list-code', text: bridge.connection().url })),
            h('div', { class: 'dm-row-wrap' },
              state.persisted ? null : basic.button({ label: t('api.key.save'), icon: 'save', size: 'sm', onClick: persist }),
              basic.button({ label: t('bridge.disconnect'), icon: 'x', size: 'sm', variant: 'ghost', onClick: disconnect })));
        }
        const urlIn = /** @type {any} */ (h('dm-input', { label: t('bridge.url'), placeholder: 'http://127.0.0.1:PORT' }));
        urlIn.value = state.url || '';
        urlIn.addEventListener('input', () => { state.url = urlIn.value; });
        const tokenIn = /** @type {any} */ (h('dm-input', { label: t('bridge.token'), type: 'password' }));
        const go = () => connect(urlIn.value, tokenIn.value);
        tokenIn.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') go(); });
        return h('div', { class: 'dm-card dm-stack' },
          h('h2', { text: t('bridge.connect.title') }),
          h('p', { class: 'dm-help', text: t('bridge.start.hint') }),
          h('pre', { class: 'dm-help-code', text: t('bridge.start.windows') }),
          h('pre', { class: 'dm-help-code', text: t('bridge.start.python') }),
          h('div', { class: 'dm-form-grid' }, urlIn, tokenIn),
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('bridge.connect'), icon: 'database', variant: 'primary', loading: state.busy === 'connect', onClick: go }),
            state.persisted && !secrets.isUnlocked() ? basic.button({ label: t('api.key.unlock'), icon: 'lock', onClick: unlock }) : null));
      }
      function sourceCard() {
        const src = state.source;
        const kindSel = /** @type {any} */ (h('dm-select', { label: t('bridge.kind') }));
        kindSel.options = kinds().map((k) => ({ value: k, label: t('bridge.kind.' + k) }));
        kindSel.value = src.kind;
        kindSel.addEventListener('change', () => { state.source = { kind: kindSel.value }; state.tables = null; state.preview = null; render(); });
        const inputs = (FIELDS[src.kind] || []).map(([name, labelKey, placeholder]) => {
          if (name === 'dsn' && state.sources && state.sources.dsns && state.sources.dsns.length) {
            const sel = /** @type {any} */ (h('dm-select', { label: t(labelKey) }));
            sel.options = [{ value: '', label: '–' }].concat(state.sources.dsns.map((d) => ({ value: d.name, label: d.driver ? `${d.name} (${d.driver})` : d.name })));
            sel.value = src.dsn || '';
            sel.addEventListener('change', () => { src.dsn = sel.value; });
            return sel;
          }
          return field(src, name, labelKey, placeholder);
        });
        return h('div', { class: 'dm-card dm-stack' },
          h('h2', { text: t('bridge.source.title') }),
          h('div', { class: 'dm-form-grid' }, kindSel, inputs),
          src.kind === 'sqlserver' ? h('p', { class: 'dm-help', text: t('bridge.field.user.hint') }) : null,
          src.kind === 'dsn' && !state.sources ? h('div', null, basic.button({ label: t('bridge.load.sources'), icon: 'list', size: 'sm', loading: state.busy === 'sources', onClick: loadSources })) : null,
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('bridge.tables.load'), icon: 'table', variant: state.preview ? 'default' : 'primary', loading: state.busy === 'tables', onClick: loadTables })));
      }
      function tablesCard() {
        const list = state.tables || [];
        return h('div', { class: 'dm-card dm-stack-sm dm-bridge-tables' },
          h('h2', { text: t('bridge.tables.title', { n: list.length }) }),
          list.length
            ? h('div', { class: 'dm-list' }, list.map((tb) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': state.table === tb.name ? 'true' : null, onclick: () => selectTable(tb.name) },
              h('span', { class: 'dm-list-main', text: tb.name }), tb.type && tb.type !== 'TABLE' ? h('dm-badge', { text: tb.type }) : null)))
            : h('p', { class: 'dm-help', text: t('bridge.tables.empty') }));
      }
      function resultTable(result) {
        const table = /** @type {any} */ (h('dm-table'));
        const cols = result.columns || [];
        table.setData({
          columns: cols.map((c) => ({ key: c.name, label: c.name, type: bridge.TYPES[c.type] || 'text' })),
          rowCount: (result.rows || []).length,
          rowProvider: async (start, count) => (result.rows || []).slice(start, start + count),
        });
        return h('div', { class: 'dm-table-wrap dm-bridge-result' }, table);
      }
      function previewCard() {
        const p = state.preview;
        const nameIn = /** @type {any} */ (h('dm-input', { label: t('bridge.import.name'), inline: true }));
        nameIn.value = state.name || state.table || '';
        nameIn.addEventListener('input', () => { state.name = nameIn.value; });
        return h('div', { class: 'dm-card dm-stack-sm dm-bridge-preview' },
          h('div', { class: 'dm-row-wrap' }, h('h2', { text: state.table }), h('dm-badge', { text: t('common.columns', { n: (p.columns || []).length }) }), h('span', { class: 'dm-help', text: t('bridge.preview.rows', { n: i18n.formatNumber((p.rows || []).length) }) })),
          resultTable(p),
          h('div', { class: 'dm-row-wrap' }, nameIn, basic.button({ label: t('bridge.import'), icon: 'download', variant: 'primary', loading: state.busy === 'import', onClick: () => importSelected(nameIn.value) })));
      }
      function sqlCard() {
        const editor = /** @type {any} */ (h('dm-code', { language: 'sql', placeholder: 'SELECT * FROM ...' }));
        editor.value = state.sql;
        editor.addEventListener('dm-change', () => { state.sql = editor.value; });
        editor.addEventListener('dm-run', () => runSql(editor.value));
        const r = state.sqlResult;
        let out = null;
        if (r && r.cancelled) out = h('p', { class: 'dm-help', text: t('bridge.approve.cancelled') });
        else if (r && r.affected !== undefined) out = h('p', { class: 'dm-help', text: t('bridge.sql.affected', { n: i18n.formatNumber(r.affected) }) });
        else if (r) {
          const nameIn = /** @type {any} */ (h('dm-input', { label: t('bridge.import.name'), inline: true }));
          nameIn.value = t('bridge.fetched.name');
          out = h('div', { class: 'dm-stack-sm' }, resultTable(r), h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help', text: t('bridge.preview.rows', { n: i18n.formatNumber((r.rows || []).length) }) }), nameIn, basic.button({ label: t('bridge.sql.import'), icon: 'download', loading: state.busy === 'import', onClick: () => importSql(nameIn.value) })));
        }
        return h('div', { class: 'dm-card dm-stack-sm dm-bridge-sql' },
          h('h2', { text: t('bridge.sql.title') }),
          h('p', { class: 'dm-help', text: t('bridge.sql.hint') }),
          h('div', { class: 'dm-editor-wrap' }, editor),
          h('div', null, basic.button({ label: t('bridge.sql.run'), icon: 'play', loading: state.busy === 'sql', onClick: () => runSql(editor.value) })),
          out);
      }
      function render() {
        if (destroyed) return;
        const connected = bridge.isConnected() && state.info;
        replace(el,
          h('div', { class: 'dm-page-head' }, h('h1', null, icons.icon('database', 20), t('bridge.title'))),
          h('p', { class: 'dm-help', text: t('bridge.intro') }),
          connectionCard(),
          state.error ? h('p', { class: 'dm-error', text: state.error }) : null,
          connected ? sourceCard() : null,
          connected && state.tables ? tablesCard() : null,
          connected && state.preview ? previewCard() : null,
          connected ? sqlCard() : null);
      }

      return { el, state, start, select, destroy, render, connect, loadTables, selectTable, importSelected, runSql, importSql };
    }
    return { create, FIELDS };
  });
})();
