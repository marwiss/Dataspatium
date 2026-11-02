// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the API module: schema, request building, parsers, JSON-stat, pagination against a mocked
 * service (virtual dataspatium-asset:// providers, no network), rate limiting, secrets, auth, the PxWeb
 * and Socialstyrelsen families, dataset creation and appending, the Inhämta UI, and an optional live
 * smoke test (only with ?live=1 in the URL).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const fx = D.require('tests/fixtures/api');
  const schema = D.require('api/schema');
  const request = D.require('api/request');
  const parsers = D.require('api/parsers');
  const jsonstat = D.require('api/jsonstat');
  const pagination = D.require('api/pagination');
  const http = D.require('api/http');
  const secrets = D.require('api/secrets');
  const auth = D.require('api/auth');
  const connectors = D.require('api/connectors');
  const runner = D.require('api/runner');
  const pxweb = D.require('api/families/pxweb');
  const sos = D.require('api/families/socialstyrelsen');
  const datasets = D.require('data/datasets');
  const t = D.require('ui/i18n').t;
  const BASE = 'dataspatium-asset://tests/api';
  const created = [];

  /** Serve JSON (or text) for a virtual asset name; the provider sees the full URL. */
  const served = [];
  function serve(name, fn) {
    D.net.virtual(name, (url) => { served.push(url); return Promise.resolve().then(() => fn(new URL(url))).then((out) => ({ kind: 'text', data: typeof out === 'string' ? out : JSON.stringify(out) })); });
  }
  function connector(extra) {
    return Object.assign({ format: schema.FORMAT_ID, id: 'test-api', name: 'Testtjänst', baseUrl: BASE, auth: { type: 'none' }, endpoints: [] }, extra || {});
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  test('api: schema validates every preset and rejects broken configurations', async (assert) => {
    const presets = await connectors.loadPresets();
    assert.ok(presets.length >= 12, 'presets loaded: ' + presets.length);
    for (const p of presets) assert.deepEqual(schema.validate(p), [], p.id);
    const ids = presets.map((p) => p.id);
    for (const id of ['scb-pxweb', 'scb-pxweb-v2', 'kolada', 'eurostat', 'socialstyrelsen', 'smhi-metobs', 'fhm-folkhalsodata', 'naturvardsregistret', 'luftkvalitet', 'lantmateriet-geodata', 'lantmateriet-direkt', 'boverket-energideklarationer', 'dataportal']) assert.ok(ids.includes(id), 'preset ' + id);
    const bad = schema.validate({ format: 'dataspatium-api/1', id: 'Bad Id', name: '', baseUrl: 'ftp://x', endpoints: [] });
    assert.ok(bad.some((e) => e.startsWith('id')) && bad.some((e) => e.startsWith('baseUrl')) && bad.some((e) => e.startsWith('name')), bad.join(' | '));
    const semantic = schema.validate({ format: 'dataspatium-api/1', id: 'ok-id', name: 'X', baseUrl: 'https://x', auth: { type: 'apiKey' }, endpoints: [{ id: 'a', name: 'A', pagination: { type: 'page' } }, { id: 'a', name: 'B' }] });
    assert.ok(semantic.some((e) => e.includes('auth.name')) && semantic.some((e) => e.includes('pagination.param')) && semantic.some((e) => e.includes('flera gånger')), semantic.join(' | '));
    const level2 = presets.filter((p) => p.level === 2).map((p) => p.id).sort();
    assert.deepEqual(level2, ['boverket-energideklarationer', 'lantmateriet-direkt']);
    return presets.length + ' presets';
  });

  test('api: request builder handles path, query, repeat, querylines, templates and JSON bodies', (assert) => {
    const ep = {
      id: 'x', name: 'X', method: 'GET', path: '/data/{kpi}/year/{year}',
      params: [
        { name: 'kpi', in: 'path', type: 'string', required: true, raw: true },
        { name: 'year', in: 'path', type: 'multi' },
        { name: 'geo', in: 'query', type: 'multi', style: 'repeat' },
        { name: 'extra', in: 'query', type: 'querylines' },
        { name: 'q', in: 'template', type: 'string' },
        { name: 'query', in: 'query', type: 'string', hidden: true, template: 'title:"{q}"' },
        { name: 'size', in: 'query', type: 'number', default: 50, hidden: true },
        { name: 'flag', in: 'option', type: 'boolean', default: true },
      ],
    };
    const c = connector({ headers: { Accept: 'application/json' } });
    const values = request.normalizeParams(ep, { kpi: 'N01951,N01952', year: '2022, 2023', geo: ['SE', 'FI'], extra: 'sex=T\nage = TOTAL\nbroken', q: 'befolkning' });
    assert.deepEqual(values.year, ['2022', '2023']);
    assert.equal(values.size, 50);
    assert.equal(values.query, 'title:"befolkning"');
    const req = request.build(c, ep, values);
    const u = new URL(req.url);
    assert.equal(u.pathname, '/api/data/N01951,N01952/year/2022,2023');
    assert.deepEqual(u.searchParams.getAll('geo'), ['SE', 'FI']);
    assert.equal(u.searchParams.get('sex'), 'T'); assert.equal(u.searchParams.get('age'), 'TOTAL');
    assert.equal(u.searchParams.get('query'), 'title:"befolkning"');
    assert.equal(u.searchParams.get('size'), '50');
    assert.ok(!u.searchParams.has('q') && !u.searchParams.has('flag'), 'template and option params are not sent');
    assert.equal(req.options.flag, true);
    await0(() => request.normalizeParams(ep, {}), assert, 'Fyll i');
    const post = request.build(c, { id: 'p', name: 'P', method: 'POST', path: '/q', body: { query: [{ code: 'Region', selection: { values: '{regions}' } }], format: 'json-stat2' }, params: [{ name: 'regions', in: 'body', type: 'multi' }] }, { regions: ['0180', '1480'] });
    assert.deepEqual(JSON.parse(post.body).query[0].selection.values, ['0180', '1480']);
    assert.equal(post.headers['Content-Type'], 'application/json');
    const optional = request.build(c, { id: 'f', name: 'F', method: 'GET', path: '/{path}/', params: [{ name: 'path', in: 'path', type: 'string', raw: true }] }, {});
    assert.equal(optional.url, BASE + '/');
    assert.equal(request.datasetName(c, { id: 'x', name: 'X', dataset: { name: 'Kolada {kpi} {year}' } }, { kpi: 'N1' }, 'f'), 'Kolada N1');
  });
  function await0(fn, assert, pattern) { let msg = ''; try { fn(); } catch (err) { msg = err.message; } assert.ok(msg.includes(pattern), 'expected error containing ' + pattern + ', got: ' + msg); }

  test('api: JSON parser with path, explode, rename, convert and constants (Kolada, SMHI)', async (assert) => {
    const kolada = await parsers.parse(JSON.stringify(fx.koladaData), { format: 'json', path: 'values', explode: 'values', rename: { municipality: 'kommun_id', period: 'ar', gender: 'kon', value: 'varde' }, drop: ['isdeleted'] });
    assert.equal(kolada.rows.length, 9, 'three municipalities x three genders');
    assert.ok(kolada.columns.includes('kommun_id') && kolada.columns.includes('kon') && !kolada.columns.includes('isdeleted'), kolada.columns.join(','));
    const row = kolada.rows[0];
    assert.equal(row[kolada.columns.indexOf('kommun_id')], '0000');
    assert.equal(row[kolada.columns.indexOf('varde')], 10551707);
    const smhi = await parsers.parse(JSON.stringify(fx.smhiData), { format: 'json', path: 'value', constants: { station: 'station.name', station_id: 'station.key', enhet: 'parameter.unit' }, convert: { date: 'epoch-ms' }, rename: { date: 'tid', value: 'varde', quality: 'kvalitet' } });
    assert.deepEqual(smhi.columns.slice(0, 3), ['station', 'station_id', 'enhet']);
    assert.equal(smhi.rows[0][0], 'Stockholm-Observatoriekullen A');
    assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(smhi.rows[0][smhi.columns.indexOf('tid')])), 'epoch converted: ' + smhi.rows[0][smhi.columns.indexOf('tid')]);
    const auto = await parsers.parse(JSON.stringify(fx.scb1Root), { format: 'json' });
    assert.deepEqual(auto.columns, ['id', 'type', 'text']);
    assert.equal(auto.rows[2][0], 'BE');
  });

  test('api: JSON-stat 2 to table (SCB array values, Eurostat object values, dimensions)', (assert) => {
    const scb = jsonstat.toTable(fx.scb1Data);
    assert.deepEqual(scb.columns, ['region_kod', 'region', 'år', 'Folkmängd']);
    assert.equal(scb.rows.length, 4);
    assert.deepEqual(scb.rows[0], ['0180', 'Stockholm', '2023', 988943]);
    assert.deepEqual(scb.rows[3], ['1480', 'Göteborg', '2024', 608993]);
    assert.equal(scb.types.region_kod, 'text'); assert.equal(scb.types['Folkmängd'], 'number');
    const narrow = jsonstat.toTable(fx.scb1Data, { metricWide: false, codes: 'label' });
    assert.deepEqual(narrow.columns, ['region', 'tabellinnehåll', 'år', 'varde']);
    const es = jsonstat.toTable(fx.eurostat);
    assert.ok(es.columns.includes('Time') && es.columns.includes('varde'), es.columns.join(','));
    assert.equal(es.rows.length, 4);
    assert.equal(es.rows[2][es.columns.indexOf('varde')], 10551707);
    assert.equal(es.rows[0][es.columns.indexOf('Geopolitical entity (reporting)')], 'Sweden');
    const dims = jsonstat.dimensions(fx.scb2Meta);
    assert.equal(dims.length, 6);
    assert.ok(dims[0].code === 'Region' && dims[0].values.length === 3 && dims[0].values[0].text === 'Riket');
    assert.ok(dims.find((d) => d.code === 'Tid').time && dims.find((d) => d.code === 'ContentsCode').metric);
  });

  test('api: geojson, entryscape, xml and csv parsers', async (assert) => {
    const geo = await parsers.parse(JSON.stringify(fx.nvGeojson), { format: 'geojson' }, { options: { geometry: false } });
    assert.equal(geo.rows.length, 2);
    assert.ok(geo.columns.includes('NAMN') && geo.columns.includes('SKYDDSTYP') && !geo.columns.includes('geometri'), geo.columns.join(','));
    const points = await parsers.parse(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 'p1', geometry: { type: 'Point', coordinates: [17.38, 58.8] }, properties: { label: 'Aspvreten' } }] }), { format: 'geojson' }, { options: { geometry: false } });
    assert.deepEqual(points.columns, ['id', 'label', 'longitud', 'latitud']);
    assert.deepEqual(points.rows[0], ['p1', 'Aspvreten', 17.38, 58.8]);
    const geo2 = await parsers.parse(JSON.stringify(fx.nvGeojson), { format: 'geojson' }, { options: { geometry: true } });
    assert.ok(geo2.columns.includes('geometri') && String(geo2.rows[0][geo2.columns.indexOf('geometri')]).startsWith('{"type"'));
    const items = await parsers.parse(JSON.stringify(fx.lmItems), { format: 'geojson', options: { geometry: false }, drop: ['links'] });
    assert.ok(items.columns.includes('asset_data') && String(items.rows[0][items.columns.indexOf('asset_data')]).startsWith('https://'), items.columns.join(','));
    const dp = await parsers.parse(JSON.stringify(fx.dataportal), { format: 'entryscape' });
    assert.equal(dp.rows.length, 1);
    const r = Object.fromEntries(dp.columns.map((c, i) => [c, dp.rows[0][i]]));
    assert.ok(typeof r.titel === 'string' && /befolkning/i.test(r.titel), 'title: ' + r.titel);
    assert.ok(String(r.sida).startsWith('https://www.dataportal.se/datasets/'), r.sida);
    assert.ok(r.utgivare && r.distributioner >= 1, JSON.stringify(r));
    const xml = await parsers.parse('<rows><row id="1"><name>Alfa</name><v>2</v></row><row id="2"><name>Beta</name><v>3</v></row></rows>', { format: 'xml', recordTag: 'row' });
    assert.deepEqual(xml.columns, ['@id', 'name', 'v']); assert.equal(xml.rows[1][1], 'Beta');
    const csv = await parsers.parse(fx.smhiArchiveCsv, { format: 'csv', options: { delimiter: ';', skipUntil: 'Datum;', decimal: 'point' } });
    assert.equal(csv.columns[0], 'Datum'); assert.equal(csv.rows.length, 3); assert.equal(csv.rows[0][2], '-3.2');
  });

  test('api: pagination strategies, rate limit and truncation against a mocked service', async (assert) => {
    const pages = { page: 3, offset: 25 };
    serve('tests/api/page', (u) => { const p = Number(u.searchParams.get('page') || 1); return { items: p <= pages.page ? [{ p, i: 1 }, { p, i: 2 }] : [], meta: { totalPages: pages.page } }; });
    serve('tests/api/offset', (u) => { const o = Number(u.searchParams.get('startIndex') || 0); const n = Math.min(10, pages.offset - o); return { type: 'FeatureCollection', numberMatched: pages.offset, features: Array.from({ length: Math.max(0, n) }, (_, i) => ({ type: 'Feature', properties: { n: o + i } })) }; });
    serve('tests/api/next', (u) => { const p = Number(u.searchParams.get('p') || 1); return { values: [{ p }], next_url: p < 3 ? BASE + '/next?p=' + (p + 1) : null }; });
    serve('tests/api/links', (u) => { const p = Number(u.searchParams.get('p') || 1); return { features: [{ type: 'Feature', properties: { p } }], links: p < 2 ? [{ rel: 'next', href: BASE + '/links?p=' + (p + 1) }] : [] }; });
    const c = connector({
      rateLimit: { requests: 2, perSeconds: 0.3 },
      endpoints: [
        { id: 'page', name: 'Page', method: 'GET', path: '/page', pagination: { type: 'page', param: 'page', start: 1, totalPagesPath: 'meta.totalPages' }, response: { format: 'json', path: 'items' } },
        { id: 'offset', name: 'Offset', method: 'GET', path: '/offset', pagination: { type: 'offset', param: 'startIndex', sizeParam: 'count', size: 10, totalPath: 'numberMatched' }, response: { format: 'geojson' } },
        { id: 'next', name: 'Next', method: 'GET', path: '/next', pagination: { type: 'next-url', path: 'next_url' }, response: { format: 'json', path: 'values' } },
        { id: 'links', name: 'Links', method: 'GET', path: '/links', pagination: { type: 'link-rel', path: 'links', rel: 'next' }, response: { format: 'geojson', options: { geometry: false } } },
      ],
    });
    const t0 = performance.now();
    const page = await runner.fetchTable(c, c.endpoints[0], {});
    assert.equal(page.rows.length, 6); assert.equal(page.meta.pages, 3);
    assert.ok(performance.now() - t0 >= 250, 'rate limit of 2 per 300 ms delayed the third page: ' + Math.round(performance.now() - t0) + ' ms');
    const offset = await runner.fetchTable(c, c.endpoints[1], {});
    assert.equal(offset.rows.length, 25); assert.equal(offset.meta.pages, 3);
    assert.equal(offset.rows[24][offset.columns.indexOf('n')], 24);
    const next = await runner.fetchTable(c, c.endpoints[2], {});
    assert.deepEqual(next.rows.map((r) => r[0]), [1, 2, 3]);
    const links = await runner.fetchTable(c, c.endpoints[3], {});
    assert.equal(links.rows.length, 2);
    const truncated = await runner.fetchTable(c, c.endpoints[2], {}, { maxPages: 2 });
    assert.equal(truncated.rows.length, 2); assert.ok(truncated.meta.truncated, 'truncated flag');
    const first = await runner.fetchTable(c, c.endpoints[2], {}, { firstPageOnly: true });
    assert.equal(first.meta.pages, 1);
    assert.equal(http.linkHeader('<https://x/a?page=2>; rel="next", <https://x/a?page=9>; rel="last"', 'next'), 'https://x/a?page=2');
    const progress = [];
    await runner.fetchTable(c, c.endpoints[2], {}, { onProgress: (p) => progress.push(p.pages) });
    assert.deepEqual(progress, [1, 2, 3]);
    return `${served.length} mocked requests`;
  });

  test('api: http errors are explained in Swedish; aborts are reported', async (assert) => {
    serve('tests/api/fail', () => { throw new Error('nope'); });
    const c = connector({ endpoints: [{ id: 'fail', name: 'Fail', method: 'GET', path: '/fail', response: { format: 'json' } }] });
    let message = '';
    try { await runner.fetchTable(c, c.endpoints[0], {}); } catch (err) { message = err.message; }
    assert.ok(message.includes('404') || message.includes('Hittades inte'), message);
    assert.ok(http.describeStatus(429).includes('För många anrop'));
    const ctrl = new AbortController();
    serve('tests/api/slow', () => ({ values: [1] }));
    ctrl.abort();
    let kind = '';
    try { await runner.fetchTable(c, { id: 's', name: 'S', method: 'GET', path: '/slow', response: { format: 'json' } }, {}, { signal: ctrl.signal }); } catch (err) { kind = err.kind; }
    assert.equal(kind, 'aborted');
  });

  test('api: secrets in session, encrypted persistence, lock and unlock', async (assert) => {
    const id = 'test-secret-connector';
    await secrets.clearPersisted();
    secrets.set(id, { apiKey: 'abc123456' });
    assert.deepEqual(secrets.get(id), { apiKey: 'abc123456' });
    assert.equal(secrets.mask('https://x/?key=abc123456&a=1', id), 'https://x/?key=•••&a=1');
    await secrets.persist(id, { apiKey: 'abc123456' }, 'hemlig lösenfras');
    assert.ok(await secrets.isPersisted(id));
    const stored = await D.require('platform/storage/idb').getSetting('api:secret:' + id, null);
    assert.ok(stored && stored.data && !JSON.stringify(stored).includes('abc123456'), 'stored encrypted');
    secrets.lock();
    assert.equal(secrets.get(id), null);
    let failed = '';
    try { await secrets.unlock('fel fras'); } catch (err) { failed = err.message; }
    assert.ok(failed.includes('Fel lösenfras'), failed);
    assert.equal(await secrets.unlock('hemlig lösenfras'), 1);
    assert.deepEqual(secrets.get(id), { apiKey: 'abc123456' });
    let other = '';
    try { await secrets.persist('x2', { apiKey: 'zzz' }, 'annan fras'); } catch (err) { other = err.message; }
    assert.ok(other.includes('samma lösenfras'), other);
    await secrets.forget(id);
    assert.ok(!(await secrets.isPersisted(id)));
    await secrets.clearPersisted();
  });

  test('api: auth applies API keys, basic, bearer and OAuth2 client credentials (cached token)', async (assert) => {
    let tokenCalls = 0;
    serve('tests/api/token', () => { tokenCalls++; return { access_token: 'tok-' + tokenCalls, expires_in: 3600, token_type: 'Bearer' }; });
    const req = { url: BASE + '/x?a=1', method: 'GET', headers: {} };
    const key = connector({ id: 'auth-key', auth: { type: 'apiKey', in: 'header', name: 'X-Key' } });
    let missing = '';
    try { await auth.apply(key, req); } catch (err) { missing = err.message; }
    assert.ok(missing.includes('Ange nyckel'), missing);
    secrets.set('auth-key', { apiKey: 'k1' });
    assert.equal((await auth.apply(key, req)).headers['X-Key'], 'k1');
    const keyQ = connector({ id: 'auth-q', auth: { type: 'apiKey', in: 'query', name: 'api_key', prefix: 'p-' } });
    secrets.set('auth-q', { apiKey: 'k2' });
    assert.ok((await auth.apply(keyQ, req)).url.endsWith('&api_key=p-k2'));
    const basic = connector({ id: 'auth-b', auth: { type: 'basic' } });
    secrets.set('auth-b', { username: 'anna', password: 'pw' });
    assert.equal((await auth.apply(basic, req)).headers.Authorization, 'Basic ' + btoa('anna:pw'));
    const bearer = connector({ id: 'auth-t', auth: { type: 'bearer' } });
    secrets.set('auth-t', { token: 'T' });
    assert.equal((await auth.apply(bearer, req)).headers.Authorization, 'Bearer T');
    const oauth = connector({ id: 'auth-o', auth: { type: 'oauth2_client_credentials', tokenUrl: BASE + '/token' } });
    secrets.set('auth-o', { clientId: 'cid', clientSecret: 'sec' });
    assert.equal((await auth.apply(oauth, req)).headers.Authorization, 'Bearer tok-1');
    assert.equal((await auth.apply(oauth, req)).headers.Authorization, 'Bearer tok-1');
    assert.equal(tokenCalls, 1, 'token cached');
    assert.ok(served.some((u) => u.endsWith('/token')), 'token endpoint called');
    assert.deepEqual(auth.requiredFields({ type: 'oauth2_client_credentials' }).map((f) => f.key), ['clientId', 'clientSecret']);
    for (const id of ['auth-key', 'auth-q', 'auth-b', 'auth-t', 'auth-o']) await secrets.forget(id);
  });

  test('api: PxWeb family builds v1 queries and v2 URLs, counts cells and splits large selections', async (assert) => {
    const meta = pxweb.normalizeV1(fx.scb1Table);
    assert.equal(meta.title.slice(0, 10), 'Folkmängde');
    const region = meta.variables.find((v) => v.code === 'Region');
    assert.ok(region && region.values.length === 4 && region.values[0].code === '00', JSON.stringify(region && region.values[0]));
    const tid = meta.variables.find((v) => v.time);
    assert.ok(tid, 'time variable');
    const sel = { Region: { filter: 'item', values: ['0180', '1480'] }, ContentsCode: { filter: 'item', values: ['BE0101N1'] }, [tid.code]: { filter: 'top', n: 2 } };
    const q = pxweb.buildQuery(meta.variables, sel);
    assert.equal(q.response.format, 'json-stat2');
    const byCode = Object.fromEntries(q.query.map((x) => [x.code, x.selection]));
    assert.deepEqual(byCode.Region, { filter: 'item', values: ['0180', '1480'] });
    assert.deepEqual(byCode[tid.code], { filter: 'top', values: ['2'] });
    for (const v of meta.variables) if (!v.elimination && !sel[v.code]) assert.deepEqual(byCode[v.code], { filter: 'all', values: ['*'] }, 'mandatory ' + v.code + ' selects all');
    const metaV2 = pxweb.normalizeV2(fx.scb2Meta);
    assert.equal(metaV2.variables.length, 6);
    const c2 = connector({ id: 'scb2', baseUrl: 'https://api.scb.se/OV0104/v2beta/api/v2', family: { type: 'pxweb', version: 2, lang: 'sv', maxCells: 150000 } });
    const built = pxweb.buildV2(c2, 'TAB638', metaV2.variables, { Region: { filter: 'item', values: ['0180'] }, Tid: { filter: 'top', n: 3 }, ContentsCode: { filter: 'all' }, Civilstand: { filter: 'none' }, Alder: { filter: 'none' }, Kon: { filter: 'none' } });
    const u = new URL(built.url);
    assert.equal(u.searchParams.get('valueCodes[Region]'), '0180');
    assert.equal(u.searchParams.get('valueCodes[Tid]'), 'TOP(3)');
    assert.equal(u.searchParams.get('valueCodes[ContentsCode]'), '*');
    assert.equal(u.searchParams.get('outputFormat'), 'json-stat2');
    assert.ok(built.body.selection.some((s) => s.variableCode === 'Region'));
    const vars = [{ code: 'A', text: 'A', values: Array.from({ length: 300 }, (_, i) => ({ code: String(i), text: String(i) })), elimination: false }, { code: 'B', text: 'B', values: Array.from({ length: 1000 }, (_, i) => ({ code: String(i), text: String(i) })), elimination: false }];
    assert.equal(pxweb.cellCount(vars, { A: { filter: 'all' }, B: { filter: 'all' } }), 300000);
    const chunks = pxweb.chunk(vars, { A: { filter: 'all' }, B: { filter: 'all' } }, 150000);
    assert.equal(chunks.length, 2);
    assert.ok(chunks.every((ch) => pxweb.cellCount(vars, ch) <= 150000), 'each chunk within the limit');
    assert.equal(chunks.reduce((s, ch) => s + ch.B.values.length, 0), 1000, 'chunks cover every value');
    // v1 end to end against the mocked service
    serve('tests/api/px/BE/BE0101/BE0101A/BefolkningNy', () => fx.scb1Data);
    serve('tests/api/px/BE/BE0101/BE0101A', () => fx.scb1Folder);
    const c1 = connector({ id: 'px1', baseUrl: BASE + '/px', family: { type: 'pxweb', version: 1 } });
    const folder = await pxweb.listFolder(c1, ['BE', 'BE0101', 'BE0101A']);
    assert.equal(folder.length, 3); assert.equal(folder[0].type, 'table');
    const table = await pxweb.fetchData(c1, { path: ['BE', 'BE0101', 'BE0101A', 'BefolkningNy'], title: 'Test' }, meta.variables, sel);
    assert.equal(table.rows.length, 4); assert.equal(table.meta.pages, 1);
    assert.ok(served.some((url) => url.endsWith('/px/BE/BE0101/BE0101A/BefolkningNy')));
  });

  test('api: Socialstyrelsen family builds result paths and joins value texts over pages', async (assert) => {
    const base = 'tests/api/sos';
    serve(base, () => fx.sosRoot);
    serve(base + '/dodsorsaker', () => fx.sosVars);
    serve(base + '/dodsorsaker/region', () => fx.sosRegion);
    serve(base + '/dodsorsaker/alder', () => [{ id: 1, text: '0-4' }, { id: 2, text: '5-9' }]);
    serve(base + '/dodsorsaker/kon', () => [{ id: 1, text: 'Män' }, { id: 2, text: 'Kvinnor' }]);
    serve(base + '/dodsorsaker/matt', () => fx.sosMatt);
    serve(base + '/dodsorsaker/diagnos', () => [{ id: '01', text: 'Vissa infektionssjukdomar' }]);
    serve(base + '/dodsorsaker/ar', () => fx.sosAr);
    serve(base + '/dodsorsaker/resultat/region/0/matt/1/ar/2023', (u) => Object.assign({}, fx.sosRes, { sida: Number(u.searchParams.get('sida') || 1), sidor: 2 }));
    const c = connector({ id: 'sos-test', baseUrl: BASE + '/sos', family: { type: 'socialstyrelsen' } });
    const subjects = await sos.subjects(c);
    assert.ok(subjects.some((s) => s.id === 'dodsorsaker'));
    const vars = await sos.variables(c, 'dodsorsaker');
    assert.ok(vars.length >= 5 && vars.find((v) => v.code === 'ar').time && vars.find((v) => v.code === 'region').values[0].kod === '00', JSON.stringify(vars.map((v) => v.code)));
    const selection = { matt: { filter: 'item', values: ['1'] }, region: { filter: 'item', values: ['0'] }, ar: { filter: 'item', values: ['2023'] } };
    assert.equal(sos.buildPath('dodsorsaker', vars, selection), '/dodsorsaker/resultat/region/0/matt/1/ar/2023', 'variables in the order the service lists them');
    const table = await sos.fetchData(c, 'dodsorsaker', vars, selection);
    assert.equal(table.rows.length, 12, 'two pages of six rows');
    assert.equal(table.meta.pages, 2);
    const r = Object.fromEntries(table.columns.map((col, i) => [col, table.rows[0][i]]));
    assert.equal(r['Region'], 'Riket'); assert.equal(r['Region_kod'], '00'); assert.equal(r['Mått'], 'Antal döda'); assert.equal(r.varde, 6); assert.equal(r.ar, 2023);
  });

  test('api: tables become datasets; rows can be appended, replaced and deduplicated; refetch works', async (assert) => {
    serve('tests/api/kolada', () => fx.koladaData);
    const c = connector({ id: 'kolada-test', endpoints: [{ id: 'd', name: 'D', method: 'GET', path: '/kolada', response: { format: 'json', path: 'values', explode: 'values', rename: { municipality: 'kommun_id', period: 'ar', gender: 'kon', value: 'varde' }, drop: ['isdeleted'] }, dataset: { name: 'Kolada test', keys: ['kommun_id', 'ar', 'kon'] } }] });
    await connectors.importJson(JSON.stringify(c));
    try {
      const table = await runner.fetchTable(c, c.endpoints[0], {});
      const source = runner.describeSource(c, c.endpoints[0], {}, table);
      const meta = await runner.toDataset(table, { name: 'API-test', source });
      created.push(meta.id);
      assert.equal(meta.rowCount, 9);
      const cols = await datasets.columns(meta.id);
      assert.equal(cols.find((x) => x.name === 'kommun_id').type, 'text', 'municipality codes keep leading zeros');
      assert.ok(['number', 'integer'].includes(cols.find((x) => x.name === 'varde').type), 'varde is numeric');
      assert.equal(cols.find((x) => x.name === 'ar').type, 'integer');
      const again = await runner.refetch(meta.source);
      assert.equal(again.rows.length, 9, 'refetch from stored source');
      const appended = await runner.intoDataset(meta.id, again, { mode: 'append', dedupeKeys: ['kommun_id', 'ar', 'kon'] });
      assert.equal(appended.rows, 0); assert.equal(appended.skipped, 9);
      const plain = await runner.intoDataset(meta.id, again, { mode: 'append' });
      assert.equal(plain.rows, 9);
      assert.equal(await datasets.count(meta.id), 18);
      const replaced = await runner.intoDataset(meta.id, { columns: ['kommun_id', 'varde', 'okand'], rows: [['0180', '1 234', 'x']] }, { mode: 'replace', decimal: 'comma' });
      assert.equal(replaced.rows, 1); assert.deepEqual(replaced.ignored, ['okand']);
      assert.equal(await datasets.count(meta.id), 1);
      const replacedRow = (await datasets.query(meta.id))[0];
      assert.equal(replacedRow[cols.findIndex((x) => x.name === 'varde')], 1234, 'text parsed to the column type');
      assert.equal(replacedRow[cols.findIndex((x) => x.name === 'kommun_id')], '0180');
      assert.equal(replacedRow[cols.findIndex((x) => x.name === 'ar')], null, 'missing columns become NULL');
      const log = await datasets.log(meta.id);
      assert.ok(log.some((e) => e.action === 'append') && log.some((e) => e.action === 'replace'));
    } finally { await connectors.remove('kolada-test'); }
  });

  test('app: Inhämta lists API sources, runs an endpoint form and saves the result as a dataset', async (assert) => {
    serve('tests/api/ui', (u) => ({ values: [{ namn: 'Alfa', tal: 1, sok: u.searchParams.get('q') }, { namn: 'Beta', tal: 2, sok: u.searchParams.get('q') }] }));
    const c = connector({ id: 'ui-test', name: 'UI-testtjänst', publisher: 'Test', endpoints: [{ id: 'list', name: 'Lista', method: 'GET', path: '/ui', params: [{ name: 'q', in: 'query', label: 'Sökord', type: 'string', required: true }], response: { format: 'json', path: 'values' }, dataset: { name: 'UI {q}' } }] });
    await connectors.importJson(JSON.stringify(c));
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const wait2 = async (fn, ms, label) => { const t0 = performance.now(); for (;;) { if (fn()) return; if (performance.now() - t0 > ms) throw new Error('timeout: ' + label); await wait(50); } };
    try {
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      await wait2(() => Array.from(root.querySelectorAll('.dm-left .dm-list-item')).some((b) => b.textContent.includes('UI-testtjänst')), 5000, 'connector in source list');
      assert.ok(Array.from(root.querySelectorAll('.dm-left .dm-list-item')).some((b) => b.textContent.includes('SCB Statistikdatabasen')), 'presets listed');
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-left .dm-list-item')).find((b) => b.textContent.includes('UI-testtjänst'))).click();
      await wait2(() => root.querySelector('.dm-api-view dm-input'), 3000, 'endpoint form');
      const input = /** @type {any} */ (root.querySelector('.dm-api-view .dm-api-fields dm-input'));
      input.value = 'befolkning';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-api-view dm-button')).find((b) => b.getAttribute('label') === t('api.fetch')).querySelector('button')).click();
      await wait2(() => root.querySelector('.dm-api-view dm-table .dm-tr'), 5000, 'result rows');
      assert.equal(root.querySelectorAll('.dm-api-view dm-table .dm-tr').length, 2);
      assert.ok(root.querySelector('.dm-right .dm-api-requests li'), 'request logged in inspector');
      /** @type {HTMLElement} */ (Array.from(root.querySelectorAll('.dm-api-view dm-button')).find((b) => b.getAttribute('label') === t('api.save')).querySelector('button')).click();
      await wait2(() => shell.store.get().datasets.some((d) => d.name === 'UI befolkning'), 5000, 'dataset saved');
      const meta = shell.store.get().datasets.find((d) => d.name === 'UI befolkning');
      created.push(meta.id);
      assert.equal(meta.rowCount, 2);
      assert.equal(meta.source.kind, 'api'); assert.equal(meta.source.connectorId, 'ui-test');
      return 'ok';
    } finally {
      await connectors.remove('ui-test');
      root.remove();
    }
  }, 30000);

  test('api: live smoke against SCB, Kolada, SMHI and Eurostat (only with ?live=1)', async (assert) => {
    if (!/[?&]live=1/.test(location.search)) return 'skipped (add ?live=1 to run)';
    const list = await connectors.list();
    const scb = list.find((c) => c.id === 'scb-pxweb');
    const meta = await pxweb.tableMetaV1(scb, ['BE', 'BE0101', 'BE0101A', 'BefolkningNy']);
    const tid = meta.variables.find((v) => v.time).code;
    const table = await pxweb.fetchData(scb, { path: ['BE', 'BE0101', 'BE0101A', 'BefolkningNy'], title: meta.title }, meta.variables, { Region: { filter: 'item', values: ['0180', '1480'] }, ContentsCode: { filter: 'item', values: ['BE0101N1'] }, [tid]: { filter: 'top', n: 2 } });
    assert.equal(table.rows.length, 4, 'SCB v1 rows');
    const scb2 = list.find((c) => c.id === 'scb-pxweb-v2');
    const found = await pxweb.searchTables(scb2, 'folkmängd', 1, 5);
    assert.ok(found.tables.length === 5 && found.page.totalPages > 1, 'SCB v2 search');
    const kolada = list.find((c) => c.id === 'kolada');
    const kd = await runner.fetchTable(kolada, kolada.endpoints.find((e) => e.id === 'data-year'), { kpi_id: 'N01951', year: '2023' }, { firstPageOnly: true });
    assert.ok(kd.rows.length > 100 && kd.columns.includes('kommun_id'), 'Kolada rows ' + kd.rows.length);
    const smhi = list.find((c) => c.id === 'smhi-metobs');
    const sd = await runner.fetchTable(smhi, smhi.endpoints.find((e) => e.id === 'data'), { parameter: '1', station: '98230', period: 'latest-day' });
    assert.ok(sd.rows.length >= 20 && sd.columns.includes('tid'), 'SMHI rows ' + sd.rows.length);
    const es = list.find((c) => c.id === 'eurostat');
    const ed = await runner.fetchTable(es, es.endpoints[0], { dataset: 'demo_pjan', geo: ['SE'], lastTimePeriod: 2, filters: 'sex=T\nage=TOTAL' });
    assert.equal(ed.rows.length, 2, 'Eurostat rows');
    const dp = list.find((c) => c.id === 'dataportal');
    const dd = await runner.fetchTable(dp, dp.endpoints[0], { q: 'befolkning' }, { firstPageOnly: true });
    assert.ok(dd.rows.length > 5 && dd.columns.includes('titel'), 'dataportal rows ' + dd.rows.length);
    const soc = list.find((c) => c.id === 'socialstyrelsen');
    const subjects = await sos.subjects(soc);
    assert.ok(subjects.length > 5, 'Socialstyrelsen subjects');
    return `SCB ${table.rows.length}, Kolada ${kd.rows.length}, SMHI ${sd.rows.length}, Eurostat ${ed.rows.length}, dataportal ${dd.rows.length}`;
  }, 120000);

  test('api: cleanup', async () => {
    for (const id of created) { try { await datasets.remove(id); } catch (_e) { /* ignore */ } }
    return created.length + ' removed';
  });
})();
