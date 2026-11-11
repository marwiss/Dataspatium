// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the database bridge client (api/bridge) and its view in Inhämta, against a fake bridge: connect and
 * token, tables, typed import, refresh through api/runner without storing passwords, read-only and approved
 * writes, and the SQL console running against the bridge.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const i18n = D.require('ui/i18n');
  const t = i18n.t;
  const bridge = D.require('api/bridge');
  const runner = D.require('api/runner');
  const datasets = D.require('data/datasets');

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label);
      await wait(50);
    }
  }

  /** An in-memory bridge with one Access-like source and the protocol of tools/db-bridge.ps1. */
  function fakeBridge(options = {}) {
    const srv = { allowWrite: !!options.allowWrite, token: 'hemlig-token', calls: [] };
    srv.rows = [['0180', 'Stockholm', 984748, 0.094, '2024-12-31T00:00:00', true], ['1280', 'Malmö', 362133, 0.035, '2024-12-31T00:00:00', true], ['2580', 'Luleå', 79000, 0.008, '2024-12-31T00:00:00', false]];
    const columns = [{ name: 'Kod', type: 'String' }, { name: 'Namn', type: 'String' }, { name: 'Folkmangd', type: 'Int32' }, { name: 'Andel', type: 'Double' }, { name: 'Datum', type: 'DateTime' }, { name: 'Aktiv', type: 'Boolean' }];
    const json = (status, obj) => ({ ok: status >= 200 && status < 300, status, json: async () => obj });
    srv.transport = async (url, init) => {
      const u = new URL(url);
      const body = init.body ? JSON.parse(init.body) : {};
      srv.calls.push({ path: u.pathname, body });
      if ((init.headers || {}).Authorization !== 'Bearer ' + srv.token) return json(401, { error: 'Fel eller saknad token' });
      switch (u.pathname) {
        case '/': return json(200, { name: 'Dataspatium-databasbrygga', version: '2.3.0', platform: 'windows', allowWrite: srv.allowWrite, kinds: ['access', 'excel', 'sqlserver', 'dsn', 'odbc', 'oledb'], maxRows: 100000 });
        case '/sources': return json(200, { dsns: [{ name: 'Test-DSN', driver: 'SQLite3 ODBC Driver' }], drivers: ['SQLite3 ODBC Driver'], providers: [] });
        case '/tables':
          if (!body.source || !body.source.path) return json(500, { error: 'Ange sökvägen till Access-filen.' });
          return json(200, { tables: [{ name: 'Kommuner', type: 'TABLE' }, { name: 'Län', type: 'VIEW' }], count: 2 });
        case '/columns': return json(200, { columns: columns.map((c) => Object.assign({ nullable: true }, c)) });
        case '/rows': return json(200, { columns, rows: srv.rows.slice(0, body.limit || 100000), truncated: false });
        case '/query': {
          const sql = String(body.sql || '');
          const write = !/^\s*(select|with|values)\b/i.test(sql);
          if (write && !srv.allowWrite) return json(403, { error: 'Bryggan är skrivskyddad; starta med -AllowWrite för att tillåta ändringar' });
          if (write && !body.approved) return json(428, { error: 'Skrivning kräver användarens godkännande (approved: true)', sql });
          if (write) return json(200, { affected: srv.rows.length });
          return json(200, { columns: columns.slice(0, 2), rows: srv.rows.map((r) => r.slice(0, 2)), truncated: false });
        }
        default: return json(404, { error: 'Okänd sökväg ' + u.pathname });
      }
    };
    return srv;
  }

  test('bridge: connect with a token, import a table with types, refresh without storing the password, writes need approval', async (assert) => {
    const srv = fakeBridge();
    bridge.setTransport(srv.transport);
    const created = [];
    try {
      await bridge.disconnect();
      let err = null;
      try { await bridge.connect('127.0.0.1:8731', 'fel'); } catch (e) { err = e; }
      assert.ok(err && err.status === 401 && err.message === t('bridge.err.token'), 'wrong token: ' + (err && err.message));
      assert.ok(!bridge.isConnected(), 'a failed connect leaves nothing behind');
      const info = await bridge.connect('127.0.0.1:8731', 'hemlig-token');
      assert.equal(info.version, '2.3.0');
      assert.equal(bridge.connection().url, 'http://127.0.0.1:8731');
      assert.equal(await bridge.rememberedUrl(), 'http://127.0.0.1:8731', 'address remembered (not the token)');
      const source = { kind: 'access', path: 'C:\\Data\\test.accdb', password: 'pw' };
      const tables = await bridge.tables(source);
      assert.deepEqual(tables.map((x) => x.name), ['Kommuner', 'Län']);
      const preview = await bridge.rows(source, 'Kommuner', 2);
      assert.equal(preview.rows.length, 2);
      assert.equal(srv.calls[srv.calls.length - 1].body.source.password, 'pw', 'the password travels to the bridge');
      const meta = await bridge.importTable(source, { table: 'Kommuner', name: 'Kommuner via brygga' });
      created.push(meta.id);
      assert.equal(meta.rowCount, 3);
      const cols = await datasets.columns(meta.id);
      assert.deepEqual(cols.map((c) => c.name + ':' + c.type), ['Kod:text', 'Namn:text', 'Folkmangd:integer', 'Andel:number', 'Datum:datetime', 'Aktiv:boolean'], cols.map((c) => c.name + ':' + c.type).join(','));
      const rows = await datasets.query(meta.id, { limit: 1 });
      assert.equal(rows[0][0], '0180', 'codes stay text');
      assert.equal(meta.source.kind, 'bridge');
      assert.equal(meta.source.table, 'Kommuner');
      assert.ok(meta.source.source.hasSecrets, 'notes that a password is needed');
      assert.ok(!JSON.stringify(meta.source).includes('pw'), 'no secret in the dataset: ' + JSON.stringify(meta.source));
      assert.equal(bridge.sourceLabel(source), 'test.accdb');
      // Refresh through the runner: the bridge is asked again (the password from this session is reused), rows replaced.
      srv.rows.push(['0580', 'Linköping', 166000, 0.016, '2024-12-31T00:00:00', true]);
      const res = await runner.refreshDataset(meta.id);
      assert.equal(res.rows, 4);
      assert.equal((await datasets.get(meta.id)).rowCount, 4);
      const all = await runner.refreshAll();
      assert.ok(all.some((r) => r.id === meta.id && r.ok), 'refreshAll includes bridge datasets');
      // Writes: refused by a read-only bridge, approved statement by statement otherwise.
      let e2 = null;
      try { await bridge.query(source, "UPDATE Kommuner SET Namn = 'x'"); } catch (e) { e2 = e; }
      assert.ok(e2 && e2.status === 403 && e2.message === t('bridge.err.readonly'), 'read-only: ' + (e2 && e2.message));
      srv.allowWrite = true;
      let e3 = null;
      try { await bridge.query(source, "UPDATE Kommuner SET Namn = 'x'"); } catch (e) { e3 = e; }
      assert.ok(e3 && e3.status === 428, 'approval needed');
      const w = await bridge.query(source, "UPDATE Kommuner SET Namn = 'x'", { approved: true });
      assert.equal(w.affected, 4);
      const q = await bridge.query(source, 'SELECT Kod, Namn FROM Kommuner', { limit: 10 });
      assert.equal(q.rows.length, 4);
      // A connection string keeps everything but the password.
      const odbc = bridge.sanitize({ kind: 'odbc', connectionString: 'Driver={X};Server=s;Uid=u;Pwd=secret;' });
      assert.equal(odbc.connectionString, 'Driver={X};Server=s;Uid=u;Pwd=***;');
      assert.ok(odbc.hasSecrets);
      // A new session has no password: refresh explains instead of sending an empty one.
      await bridge.disconnect();
      assert.ok(!bridge.isConnected());
      let e4 = null;
      try { await bridge.tables({ kind: 'access', path: 'C:\\Data\\annan.accdb' }); } catch (e) { e4 = e; }
      assert.equal(e4 && e4.message, t('bridge.err.notconnected'));
      await bridge.connect('127.0.0.1:8731', 'hemlig-token');
      let e5 = null;
      try { await runner.refreshDataset(meta.id); } catch (e) { e5 = e; }
      assert.equal(e5 && e5.message, t('bridge.err.password', { name: meta.source.label }));
      return 'ok';
    } finally {
      bridge.setTransport(null);
      await bridge.disconnect();
      for (const id of created) await datasets.remove(id);
    }
  }, 30000);

  test('bridge: with the switch on, a service that refuses the browser is fetched through the bridge, and only then', async (assert) => {
    const http = D.require('api/http');
    const srv = fakeBridge();
    const inner = srv.transport;
    const relayed = [];
    const answer = (status, obj) => ({ ok: status >= 200 && status < 300, status, json: async () => obj });
    srv.transport = async (url, init) => {
      const path = new URL(url).pathname;
      if (path === '/') { const res = await inner(url, init); const info = await res.json(); return answer(res.status, Object.assign({}, info, { fetch: true, allowHosts: ['nocors.example'] })); }
      if (path !== '/fetch') return inner(url, init);
      if ((init.headers || {}).Authorization !== 'Bearer ' + srv.token) return answer(401, { error: 'Fel eller saknad token' });
      const b = JSON.parse(init.body);
      relayed.push(b);
      if (new URL(b.url).host !== 'nocors.example') return answer(403, { error: 'Värden ' + new URL(b.url).host + ' är inte tillåten. Starta bryggan med --allow-host ' + new URL(b.url).host + ' om du vill hämta från den.' });
      return answer(200, { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json', link: '<https://nocors.example/data.json?page=2>; rel="next"' }, body: btoa('{"rader":[{"a":1}]}') });
    };
    // A service without CORS: the browser's fetch fails as it does for a missing CORS header, without any network.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => (/^https:\/\/(nocors|refused)\.example\//.test(String(input)) ? Promise.reject(new TypeError('Failed to fetch')) : realFetch(input, init));
    bridge.setTransport(srv.transport);
    try {
      await bridge.connect('127.0.0.1:8731', 'hemlig-token');
      await bridge.setRelay(false);
      await assert.throws(() => http.request({ url: 'https://nocors.example/data.json', retries: 0 }), /nocors\.example/);
      assert.equal(relayed.length, 0, 'off by default: nothing goes through the bridge');
      await bridge.setRelay(true);
      assert.ok(await bridge.canRelay(), 'on, with a bridge that can fetch');
      const res = await http.request({ url: 'https://nocors.example/data.json', method: 'POST', headers: { Authorization: 'Bearer nyckel', 'Content-Type': 'text/xml' }, body: '<FRAGA/>', retries: 0 });
      assert.ok(res.ok && res.status === 200, 'answered through the bridge');
      assert.equal(res.text, '{"rader":[{"a":1}]}');
      assert.ok(String(res.headers.get('Link')).includes('page=2'), 'the headers the app needs come along');
      assert.equal(relayed[0].url, 'https://nocors.example/data.json');
      assert.equal(relayed[0].method, 'POST');
      assert.equal(relayed[0].headers.Authorization, 'Bearer nyckel', 'the key goes to the bridge on this computer');
      assert.equal(atob(relayed[0].body), '<FRAGA/>', 'the body as base64');
      await assert.throws(() => http.request({ url: 'https://refused.example/x', retries: 0 }), /refused\.example.*--allow-host/);
      // The switch in Internetåtkomst shows the choice.
      const card = await D.require('ui/settings/network').networkCard({ ui: { icon: D.require('ui/icons').icon, button: D.require('ui/basic').button, toast: { show() {} } }, shell: { log() {} } }, () => {});
      const sw = /** @type {any} */ (card.querySelector('[data-bridge-relay]'));
      assert.ok(sw && sw.checked === true, 'the switch is on');
      return relayed.length + ' relayed';
    } finally {
      await bridge.setRelay(false);
      await bridge.disconnect();
      globalThis.fetch = realFetch;
      bridge.setTransport(null);
    }
  });

  test('bridge: Riksbanken and the World Bank need the bridge, and their tables come through it', async (assert) => {
    const connectors = D.require('api/connectors');
    const reach = D.require('api/reach');
    const schema = D.require('api/schema');
    const rb = await connectors.get('riksbanken-swea');
    const wb = await connectors.get('worldbank');
    assert.ok(rb && wb, 'both presets');
    assert.equal(schema.validate(rb).length + schema.validate(wb).length, 0, 'both validate');
    assert.equal(reach.blocked(rb, 'file'), 'bridge'); assert.equal(reach.blocked(wb, 'web'), 'bridge');
    const srv = fakeBridge();
    const inner = srv.transport;
    const relayed = [];
    const answer = (status, obj) => ({ ok: status >= 200 && status < 300, status, json: async () => obj });
    srv.transport = async (url, init) => {
      const path = new URL(url).pathname;
      if (path === '/') { const res = await inner(url, init); return answer(res.status, Object.assign({}, await res.json(), { fetch: true })); }
      if (path !== '/fetch') return inner(url, init);
      const b = JSON.parse(init.body);
      relayed.push(b.url);
      const u = new URL(b.url);
      const page = Number(u.searchParams.get('page') || '1');
      const data = u.host === 'api.riksbank.se' ? [{ date: '2026-11-02', value: 1.75 }, { date: '2026-11-03', value: 1.75 }]
        : [{ page, pages: 2 }, [{ country: { id: page === 1 ? 'SE' : 'NO' }, date: '2024', value: page === 1 ? 10587710 : 5572279 }]];
      return answer(200, { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: btoa(JSON.stringify(data)) });
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => (/^https:\/\/api\.(riksbank\.se|worldbank\.org)\//.test(String(input)) ? Promise.reject(new TypeError('Failed to fetch')) : realFetch(input, init));
    bridge.setTransport(srv.transport);
    try {
      await bridge.connect('127.0.0.1:8731', 'hemlig-token');
      await bridge.setRelay(true);
      const t1 = await runner.fetchTable(rb, rb.endpoints.find((e) => e.id === 'observationer'), { seriesId: 'SECBREPOEFF', from: '2026-11-01' });
      assert.equal(t1.rows.length, 2, 'the observations');
      assert.ok(/^https:\/\/api\.riksbank\.se\/swea\/v1\/Observations\/SECBREPOEFF\/2026-11-01\/?$/.test(relayed[0]), relayed[0]);
      const t2 = await runner.fetchTable(wb, wb.endpoints.find((e) => e.id === 'indikator'), { country: 'SE;NO', indicator: 'SP.POP.TOTL' });
      assert.equal(t2.rows.length, 2, 'both pages');
      assert.ok(relayed.some((u) => /\/country\/SE;NO\/indicator\/SP\.POP\.TOTL\?.*page=2/.test(u)), relayed.join(' '));
      return relayed.length + ' relayed';
    } finally {
      await bridge.setRelay(false);
      await bridge.disconnect();
      globalThis.fetch = realFetch;
      bridge.setTransport(null);
    }
  });

  test('bridge: the Inhämta view connects, lists tables, previews and imports; the SQL console runs against the bridge', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const srv = fakeBridge();
    bridge.setTransport(srv.transport);
    const created = [];
    try {
      await bridge.disconnect();
      shell.activate('inhamta');
      const item = await waitFor(() => Array.from(root.querySelectorAll('.dm-pane-body button')).find((b) => b.textContent.includes(t('bridge.title'))), 5000, 'bridge source in the list');
      /** @type {HTMLElement} */ (item).click();
      const view = await waitFor(() => shell.modes.get('inhamta').bridgeView, 5000, 'bridge view');
      await waitFor(() => root.querySelector('.dm-center .dm-bridge') && root.textContent.includes(t('bridge.start.windows')), 3000, 'connection card with the start command');
      await view.connect('http://127.0.0.1:8731', 'hemlig-token');
      assert.ok(view.state.info && root.textContent.includes(t('bridge.readonly')), 'connected and marked read-only');
      view.state.source = { kind: 'access', path: 'C:\\Data\\test.accdb' };
      await view.loadTables();
      assert.equal(root.querySelectorAll('.dm-center .dm-bridge-tables .dm-list-item').length, 2, 'two tables listed');
      assert.deepEqual(bridge.getCurrent(), { kind: 'access', path: 'C:\\Data\\test.accdb' }, 'the source is current for the SQL console');
      await view.selectTable('Kommuner');
      await waitFor(() => root.querySelectorAll('.dm-center .dm-bridge-preview dm-table .dm-tr').length === 3, 5000, 'preview rows');
      const meta = await view.importSelected('Via vyn');
      created.push(meta.id);
      assert.equal(meta.name, 'Via vyn');
      assert.equal(meta.rowCount, 3);
      await waitFor(() => shell.store.get().datasets.some((d) => d.id === meta.id), 3000, 'dataset in the store');
      // Own SQL in the view, and an UPDATE that is refused while the bridge is read-only.
      await view.runSql('SELECT Kod, Namn FROM Kommuner');
      assert.equal(view.state.sqlResult.rows.length, 3);
      await view.runSql("UPDATE Kommuner SET Namn = 'x'");
      assert.equal(view.state.error, t('bridge.err.readonly'));
      // The SQL console in Analysera offers the bridge as a target and shows its rows without a selected dataset.
      shell.store.set({ selectedId: null });
      const mode = shell.modes.get('analysera');
      mode.setSqlTarget('bridge');
      shell.activate('analysera');
      shell.store.set({ pendingCode: { lang: 'sql', code: 'SELECT Kod, Namn FROM Kommuner', run: true } });
      await waitFor(() => { const r = shell.store.get().lastRun; return r && r.lang === 'sql' && r.ok; }, 10000, 'SQL run against the bridge');
      const sel = await waitFor(() => root.querySelector(`.dm-center dm-select[aria-label="${t('sql.target')}"]`), 3000, 'target select');
      assert.equal(/** @type {any} */ (sel).value, 'bridge');
      await waitFor(() => root.querySelectorAll('.dm-center .dm-sql-result dm-table .dm-tr').length === 3, 5000, 'three rows in the console');
      assert.equal(mode.sqlTarget, 'bridge');
      mode.setSqlTarget('local');
      return 'ok';
    } finally {
      bridge.setTransport(null);
      await bridge.disconnect();
      shell.activate('hantera');
      for (const id of created) await datasets.remove(id);
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 40000);
})();
