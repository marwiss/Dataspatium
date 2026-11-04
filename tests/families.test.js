// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the HTTP database families (api/families/databases): the new parsers (GraphQL, SPARQL, InfluxDB CSV,
 * lifted records, dotted keys), connectors built from an address with discovery and paging against mocked
 * services (virtual dataspatium-asset:// providers, no network), and the dialog in Inhämta.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const families = D.require('api/families/databases');
  const parsers = D.require('api/parsers');
  const runner = D.require('api/runner');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const t = D.require('ui/i18n').t;
  const BASE = 'dataspatium-asset://tests/db';

  const served = [];
  const names = [];
  function serve(name, fn) {
    names.push(name);
    D.net.virtual(name, (url) => { served.push(url); return Promise.resolve().then(() => fn(new URL(url))).then((out) => ({ kind: 'text', data: typeof out === 'string' ? out : JSON.stringify(out) })); });
  }
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

  test('families: parsers for GraphQL, SPARQL, InfluxDB CSV, lifted records and keys with dots', async (assert) => {
    const gq = await parsers.parse(JSON.stringify({ data: { kommuner: [{ kod: '0180', namn: 'Stockholm' }, { kod: '1280', namn: 'Malmö' }] } }), { format: 'graphql' });
    assert.deepEqual(gq.columns, ['kod', 'namn']);
    assert.equal(gq.rows.length, 2);
    const gq2 = await parsers.parse(JSON.stringify({ data: { search: { edges: [{ node: { id: 1 } }, { node: { id: 2 } }] } } }), { format: 'graphql', lift: 'node' });
    assert.deepEqual(gq2.columns, ['id']);
    assert.deepEqual(gq2.rows, [[1], [2]]);
    let err = null;
    try { await parsers.parse(JSON.stringify({ errors: [{ message: 'Syntax Error' }] }), { format: 'graphql' }); } catch (e) { err = e; }
    assert.ok(err && err.message.includes('Syntax Error'), 'GraphQL errors are reported');
    const sp = await parsers.parse(JSON.stringify({ head: { vars: ['item', 'itemLabel'] }, results: { bindings: [{ item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' }, itemLabel: { type: 'literal', value: 'Universum' } }, { item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q2' } }] } }), { format: 'sparql' });
    assert.deepEqual(sp.columns, ['item', 'itemLabel']);
    assert.deepEqual(sp.rows[1], ['http://www.wikidata.org/entity/Q2', null]);
    const influx = '#group,false,false,true,true,false,false,true,true\n#datatype,string,long,dateTime:RFC3339,dateTime:RFC3339,dateTime:RFC3339,double,string,string\n#default,_result,,,,,,,\n,result,table,_start,_stop,_time,_value,_field,_measurement\n,,0,2024-01-01T00:00:00Z,2024-01-02T00:00:00Z,2024-01-01T01:00:00Z,21.5,temp,inne\n,,0,2024-01-01T00:00:00Z,2024-01-02T00:00:00Z,2024-01-01T02:00:00Z,"22,1",temp,inne\n\n#group,false,false,true,true,false,false,true,true\n#datatype,string,long,dateTime:RFC3339,dateTime:RFC3339,dateTime:RFC3339,double,string,string\n#default,_result,,,,,,,\n,result,table,_start,_stop,_time,_value,_field,_measurement\n,,1,2024-01-01T00:00:00Z,2024-01-02T00:00:00Z,2024-01-01T01:00:00Z,3.2,temp,ute\n';
    const inf = await parsers.parse(influx, { format: 'influx-csv' });
    assert.deepEqual(inf.columns, ['result', 'table', '_start', '_stop', '_time', '_value', '_field', '_measurement']);
    assert.equal(inf.rows.length, 3);
    assert.equal(inf.rows[1][5], '22,1', 'quoted cells');
    assert.equal(inf.rows[2][7], 'ute', 'second table stacked');
    const lifted = await parsers.parse(JSON.stringify({ rows: [{ id: 'a', key: 'a', value: { rev: '1' }, doc: { _id: 'a', _rev: '1', namn: 'Umeå', antal: 3 } }] }), { format: 'json', path: 'rows', lift: 'doc', drop: ['key', 'value.rev', '_rev'] });
    assert.deepEqual(lifted.columns, ['id', '_id', 'namn', 'antal']);
    assert.equal(parsers.resolvePath({ '@odata.nextLink': 'x', value: [] }, '@odata.nextLink'), 'x', 'a key with dots is found whole');
    assert.equal(parsers.resolvePath({ a: { b: 2 } }, 'a.b'), 2, 'paths still split');
    assert.equal(families.sheetsCsvUrl('https://docs.google.com/spreadsheets/d/ABC123/edit#gid=42'), 'https://docs.google.com/spreadsheets/d/ABC123/gviz/tq?tqx=out:csv&gid=42');
    assert.equal(families.sheetsCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pubhtml'), 'https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pub?output=csv');
    return 'ok';
  });

  test('families: connectors from an address with discovery and paging for PostgREST, OData, CouchDB, Elasticsearch, ClickHouse, Airtable, SPARQL, GraphQL and InfluxDB', async (assert) => {
    const ids = [];
    try {
      // PostgREST: the OpenAPI root lists the tables; rows come in pages of limit/offset; the key stays out of the connector.
      const pg = [{ kod: '0180', namn: 'Stockholm' }, { kod: '1280', namn: 'Malmö' }, { kod: '2580', namn: 'Luleå' }];
      serve('tests/db/pg/', () => ({ paths: { '/': {}, '/kommuner': {}, '/rpc/fn': {} } }));
      serve('tests/db/pg/kommuner', (u) => { const o = Number(u.searchParams.get('offset') || 0); const l = Number(u.searchParams.get('limit') || 1000); return pg.slice(o, o + l); });
      const r1 = await families.createConnector('postgrest', { baseUrl: BASE + '/pg', apiKey: 'anon-key' });
      ids.push(r1.connector.id);
      assert.equal(r1.discoveryError, null, 'discovery ok: ' + r1.discoveryError);
      assert.deepEqual(r1.entities.map((e) => e.id), ['kommuner']);
      assert.deepEqual(r1.connector.endpoints.map((e) => e.id), ['table-kommuner', 'table']);
      assert.equal(r1.connector.auth.type, 'apiKey');
      assert.equal(secrets.get(r1.connector.id).apiKey, 'anon-key');
      assert.ok(!JSON.stringify(r1.connector).includes('anon-key'), 'the key is not in the connector');
      assert.ok((await connectors.list()).some((c) => c.id === r1.connector.id), 'saved among the connectors');
      const ep = r1.connector.endpoints[0];
      const t1 = await runner.fetchTable(r1.connector, Object.assign({}, ep, { pagination: Object.assign({}, ep.pagination, { size: 2 }) }), {});
      assert.deepEqual(t1.columns, ['kod', 'namn']);
      assert.equal(t1.rows.length, 3);
      assert.equal(t1.meta.pages, 2, 'two pages of two');
      // OData: the service document lists entity sets; pages follow @odata.nextLink.
      serve('tests/db/odata/', () => ({ value: [{ name: 'Kommuner', kind: 'EntitySet', url: 'Kommuner' }, { name: 'Me', kind: 'Singleton', url: 'Me' }] }));
      serve('tests/db/odata/Kommuner', (u) => (u.searchParams.get('page') === '2' ? { value: [{ Kod: '2580' }] } : { value: [{ Kod: '0180' }, { Kod: '1280' }], '@odata.nextLink': BASE + '/odata/Kommuner?page=2' }));
      const r2 = await families.createConnector('odata', { baseUrl: BASE + '/odata' });
      ids.push(r2.connector.id);
      assert.deepEqual(r2.entities.map((e) => e.id), ['Kommuner']);
      const t2 = await runner.fetchTable(r2.connector, r2.connector.endpoints[0], {});
      assert.equal(t2.rows.length, 3);
      assert.equal(t2.meta.pages, 2);
      // CouchDB: databases from _all_dbs (system databases skipped); documents lifted out of the rows.
      serve('tests/db/couch/_all_dbs', () => ['_users', 'kommuner']);
      serve('tests/db/couch/kommuner/_all_docs', (u) => (Number(u.searchParams.get('skip') || 0) > 0 ? { rows: [] } : { total_rows: 2, rows: [{ id: 'a', key: 'a', value: { rev: '1' }, doc: { _id: 'a', _rev: '1', namn: 'Umeå' } }, { id: 'b', key: 'b', value: { rev: '1' }, doc: { _id: 'b', _rev: '1', namn: 'Luleå' } }] }));
      const r3 = await families.createConnector('couchdb', { baseUrl: BASE + '/couch', username: 'admin', password: 'pw' });
      ids.push(r3.connector.id);
      assert.deepEqual(r3.entities.map((e) => e.id), ['kommuner']);
      assert.equal(r3.connector.auth.type, 'basic');
      const t3 = await runner.fetchTable(r3.connector, r3.connector.endpoints[0], {});
      assert.deepEqual(t3.columns, ['id', '_id', 'namn']);
      assert.equal(t3.rows.length, 2);
      // Elasticsearch: indices from _cat (hidden ones skipped); _source lifted.
      serve('tests/db/es/_cat/indices', () => [{ index: '.kibana' }, { index: 'kommuner' }]);
      serve('tests/db/es/kommuner/_search', () => ({ hits: { total: { value: 1 }, hits: [{ _index: 'kommuner', _id: '1', _score: 1, _source: { namn: 'Umeå', antal: 3 } }] } }));
      const r4 = await families.createConnector('elasticsearch', { baseUrl: BASE + '/es', apiKey: 'k' });
      ids.push(r4.connector.id);
      assert.deepEqual(r4.entities.map((e) => e.id), ['kommuner']);
      assert.equal(r4.connector.auth.prefix, 'ApiKey ');
      const t4 = await runner.fetchTable(r4.connector, r4.connector.endpoints[0], {});
      assert.deepEqual(t4.columns, ['_index', '_id', 'namn', 'antal']);
      // ClickHouse: SHOW TABLES for discovery, SQL per table, the CORS setting on every call.
      serve('tests/db/ch/', (u) => (/SHOW TABLES/i.test(u.searchParams.get('query') || '') ? { data: [{ name: 'kommuner' }] } : { meta: [], data: [{ kod: '0180', antal: 5 }], rows: 1 }));
      const r5 = await families.createConnector('clickhouse', { baseUrl: BASE + '/ch' });
      ids.push(r5.connector.id);
      assert.deepEqual(r5.entities.map((e) => e.id), ['kommuner']);
      const t5 = await runner.fetchTable(r5.connector, r5.connector.endpoints[0], {});
      assert.deepEqual(t5.columns, ['kod', 'antal']);
      assert.ok(served.filter((u) => u.includes('/tests/db/ch/')).every((u) => /add_http_cors_header=1/.test(u)), 'CORS setting sent');
      // Airtable: a fixed address, bearer token, cursor paging on `offset`, fields lifted.
      const r6 = await families.createConnector('airtable', { baseId: 'app1', table: 'Kommuner', token: 'pat' }, { discover: false });
      ids.push(r6.connector.id);
      assert.equal(r6.connector.baseUrl, 'https://api.airtable.com');
      assert.equal(r6.connector.endpoints[0].path, '/v0/app1/Kommuner');
      assert.equal(r6.connector.endpoints[0].pagination.type, 'cursor');
      serve('tests/db/at/v0/app1/Kommuner', (u) => (u.searchParams.get('offset') ? { records: [{ id: 'rec2', fields: { Namn: 'Luleå' } }] } : { records: [{ id: 'rec1', fields: { Namn: 'Umeå', Antal: 3 } }], offset: 'itrA/rec1' }));
      const t6 = await runner.fetchTable(Object.assign({}, r6.connector, { baseUrl: BASE + '/at' }), r6.connector.endpoints[0], {});
      assert.equal(t6.rows.length, 2);
      assert.equal(t6.meta.pages, 2);
      assert.deepEqual(t6.columns, ['id', 'Namn', 'Antal']);
      // SPARQL: the query goes as a parameter, the variables come back as columns.
      serve('tests/db/sparql', (u) => (u.searchParams.get('query') ? { head: { vars: ['item'] }, results: { bindings: [{ item: { type: 'uri', value: 'Q1' } }] } } : {}));
      const r7 = await families.createConnector('sparql', { baseUrl: BASE + '/sparql' });
      ids.push(r7.connector.id);
      const t7 = await runner.fetchTable(r7.connector, r7.connector.endpoints[0], { query: 'SELECT ?item WHERE {}' });
      assert.deepEqual(t7.rows, [['Q1']]);
      // GraphQL: POST with the query in the body; the first list under data is the table.
      serve('tests/db/gql', () => ({ data: { kommuner: [{ kod: '0180' }] } }));
      const r8 = await families.createConnector('graphql', { baseUrl: BASE + '/gql', token: 'tok' });
      ids.push(r8.connector.id);
      assert.equal(r8.connector.auth.type, 'bearer');
      const t8 = await runner.fetchTable(r8.connector, r8.connector.endpoints[0], { query: '{ kommuner { kod } }' });
      assert.deepEqual(t8.columns, ['kod']);
      // InfluxDB: buckets discovered, Flux posted as text, annotated CSV parsed.
      serve('tests/db/influx/api/v2/buckets', () => ({ buckets: [{ name: 'sensor' }, { name: '_monitoring' }] }));
      serve('tests/db/influx/api/v2/query', () => '#group,false,false,false\n#datatype,string,long,double\n#default,_result,,\n,result,table,_value\n,,0,1.5\n');
      const r9 = await families.createConnector('influxdb', { baseUrl: BASE + '/influx', org: 'org1', token: 'tk' });
      ids.push(r9.connector.id);
      assert.deepEqual(r9.entities.map((e) => e.id), ['sensor']);
      const t9 = await runner.fetchTable(r9.connector, r9.connector.endpoints[0], { flux: 'from(bucket: "sensor")' });
      assert.deepEqual(t9.columns, ['result', 'table', '_value']);
      assert.equal(t9.rows[0][2], '1.5');
      // Google Sheets: the link becomes a CSV address; no discovery.
      const r10 = await families.createConnector('sheets', { sheetUrl: 'https://docs.google.com/spreadsheets/d/ABC/edit#gid=5' });
      ids.push(r10.connector.id);
      assert.equal(r10.connector.endpoints[0].path, 'https://docs.google.com/spreadsheets/d/ABC/gviz/tq?tqx=out:csv&gid=5');
      assert.equal(r10.connector.id, 'sheets-abc');
      // Validation and a failed discovery.
      let e = null;
      try { await families.createConnector('postgrest', { baseUrl: 'ftp://x' }); } catch (x) { e = x; }
      assert.equal(e && e.message, t('families.err.url', { field: t('families.field.baseUrl') }));
      e = null;
      try { await families.createConnector('airtable', { baseId: 'app1' }); } catch (x) { e = x; }
      assert.equal(e && e.message, t('families.err.required', { field: t('families.field.table') }));
      serve('tests/db/bad/', () => { throw new Error('nope'); });
      const r11 = await families.createConnector('postgrest', { baseUrl: BASE + '/bad' });
      ids.push(r11.connector.id);
      assert.ok(r11.discoveryError, 'discovery error reported');
      assert.deepEqual(r11.connector.endpoints.map((x) => x.id), ['table'], 'generic endpoint remains');
      return 'ok';
    } finally {
      for (const id of ids) { await connectors.remove(id).catch(() => {}); await secrets.forget(id).catch(() => {}); }
      for (const n of names) D.net.unvirtual(n);
    }
  }, 30000);

  test('families: the dialog in Inhämta adds a source and opens it', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    history.replaceState(null, '', location.pathname + location.search);
    const shell = await D.require('app').start(root);
    const dialog = D.require('ui/api/family-dialog');
    let id = null;
    try {
      shell.activate('inhamta');
      const btn = await waitFor(() => Array.from(root.querySelectorAll('.dm-pane-body dm-button')).find((b) => b.getAttribute('label') === t('families.add.source')), 5000, 'add button');
      assert.ok(btn, 'button in the source list');
      const p = dialog.open(shell.ctx, { family: 'sparql', values: { baseUrl: BASE + '/sparql-ui' } });
      const dlg = await waitFor(() => document.querySelector('dialog[open]'), 3000, 'dialog');
      assert.ok(dlg.textContent.includes(t('families.sparql.cors')), 'CORS note shown');
      const add = Array.from(dlg.querySelectorAll('dm-button')).find((b) => b.getAttribute('label') === t('families.add'));
      /** @type {HTMLElement} */ (add.querySelector('button')).click();
      const connector = await p;
      assert.ok(connector && connector.id === 'sparql-tests', 'connector created: ' + (connector && connector.id));
      id = connector.id;
      assert.ok((await connectors.list()).some((c) => c.id === id));
      return 'ok';
    } finally {
      if (id) await connectors.remove(id).catch(() => {});
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      shell.activate('hantera');
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }, 30000);
})();
