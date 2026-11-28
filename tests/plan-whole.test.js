// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for whole detailed plans from geodata sources (api/ngp-plans, ui/api/whole-plans, F133 a): a municipal WFS with the NGP
 * layers (simulated after Sundsvall's RIGES, with GeoServer's CQL and with FES 2.0), Lantmäteriet's NGP API (simulated from the
 * examples of its specification 2.2: POST /search, the national specification's file as an asset, reference objects page by page),
 * OAuth2 client credentials in the form body, the presets, and an NGP file of several plans read as a map. Nothing touches the net;
 * the real Sundsvall service only with ?live=plans.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const ngp = D.require('api/ngp-plans');
  const geodata = D.require('api/families/geodata');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const auth = D.require('api/auth');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const t = D.require('ui/i18n').t;
  const BASE = 'dataspatium-asset://tests/geo';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Requests as the virtual services saw them, with the body of each (a POST's JSON, a token request's form).
  const served = [];
  /** The body of the request being made: set by the fetch wrapper just before the virtual provider is called. */
  let pendingBody = null;
  let pendingHeaders = null;
  function serve(name, fn) {
    D.net.virtual(name, (url) => {
      const seen = { url, body: pendingBody, headers: pendingHeaders };
      served.push(seen);
      return Promise.resolve().then(() => fn(new URL(url), seen)).then((out) => (out && out.status ? { kind: 'text', data: String(out.body), status: out.status } : { kind: 'text', data: typeof out === 'string' ? out : JSON.stringify(out) }));
    });
  }
  /** Run `fn` with a fetch that hands each request's body and headers to the virtual provider it reaches. */
  async function withBodies(fn) {
    const real = globalThis.fetch;
    globalThis.fetch = /** @type {any} */ ((input, init) => { pendingBody = init && init.body !== undefined ? init.body : null; pendingHeaders = (init && init.headers) || {}; return real(input, init); });
    try { return await fn(); } finally { globalThis.fetch = real; pendingBody = null; pendingHeaders = null; }
  }
  const OWS_400 = (text) => ({ status: 400, body: `<?xml version="1.0" encoding="UTF-8"?><ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0"><ows:Exception exceptionCode="InvalidParameterValue" locator="GetFeature"><ows:ExceptionText>${text}</ows:ExceptionText></ows:Exception></ows:ExceptionReport>` });
  const sq = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
  const B_UUID = 'f9e056a6-cda8-4b92-a15d-dc70d61dfa36';

  // ---- a WFS with the NGP layers, after Sundsvall's RIGES ------------------------------------------------------------
  const P1 = { id: 'b925a631-e775-49f8-9270-ce0337b1ac56', beteckning: '22-HAV-1125', namn: 'Prästbordet 1:1 och 1:4', status: 'laga kraft', lagakraft: '1968-11-28', kommun: 'Ånge kommun', kod: '2260' };
  const P2 = { id: '27a08cb1-4884-4f6f-9da2-b1db2717ae3a', beteckning: '2262-P15/7', namn: 'Detaljplan Östrands Massafabrik', status: 'laga kraft', lagakraft: '2015-11-21', kommun: 'Sundsvalls kommun', kod: '2281' };
  const P3 = { id: '32c8b1ba-6b69-4695-aad9-ecde9e35cb2f', beteckning: "O'Hara 1", namn: 'Kvarteret Prästgården', status: 'antagen', lagakraft: '', kommun: 'Sundsvalls kommun', kod: '2281' };
  /** A feature with the flattened NGP fields as the municipal layers have them. */
  function flat(ngpId, plan, typ, geometry, pb) {
    return { type: 'Feature', id: 'layer.' + ngpId, geometry, properties: {
      ngp_id: ngpId, datetime: '2025-03-04T09:33:47+01:00', 'providers.name': `(1:${plan.kommun})`, 'providers.kod': `(1:${plan.kod})`, title: pb ? pb.text : plan.beteckning, 'feature.typ': typ, 'feature.etikett': pb ? pb.text : plan.beteckning,
      'detaljplan.objektidentitet': plan.id, 'detaljplan.beteckning': plan.beteckning, 'detaljplan.namn': plan.namn, 'detaljplan.status': plan.status, 'detaljplan.typ': 'detaljplan', 'detaljplan.datumLagakraft': plan.lagakraft || null,
      'planbestammelse.planbestammelsekatalogreferens': pb ? pb.ref : null, 'planbestammelse.bestammelseformulering': pb ? pb.text : null, 'planbestammelse.anvandningsform': pb ? pb.form : null, 'planbestammelse.kategori': pb ? pb.kategori : null,
      'planbestammelse.bestammelsevarde.variabelvarde': pb && pb.varde !== undefined ? pb.varde : null } };
  }
  const LAYERS = () => ({
    'RIGES:NGP_Detaljplan_yta': [flat(P1.id, P1, 'detaljplan', sq(15.1, 62.37, 0.01)), flat(P2.id, P2, 'detaljplan', sq(17.4, 62.43, 0.02)), flat(P3.id, P3, 'detaljplan', sq(17.3, 62.39, 0.01))],
    'RIGES:NGP_Anvandningsbestammelse_yta': [
      flat('u1', P1, 'användningsbestämmelse', sq(15.1, 62.37, 0.005), { ref: B_UUID, text: 'Bostäder', form: 'Kvartersmark', kategori: 'Bostäder' }),
      flat('u2', P1, 'användningsbestämmelse', sq(15.105, 62.37, 0.005), { ref: '00000000-0000-4000-8000-000000000001', text: 'Gata', form: 'Allmän plats', kategori: 'Gata' }),
      flat('u3', P2, 'användningsbestämmelse', sq(17.4, 62.43, 0.02), { ref: '00000000-0000-4000-8000-000000000002', text: 'Industri', form: 'Kvartersmark', kategori: 'Industri' })],
    'RIGES:NGP_Egenskapsbestammelse_yta': [flat('e1', P1, 'egenskapsbestämmelse', sq(15.101, 62.371, 0.002), { ref: '00000000-0000-4000-8000-000000000003', text: 'Marken får inte förses med byggnad.', form: 'Kvartersmark', kategori: 'Begränsning av markens utnyttjande' })],
    'RIGES:NGP_Egenskapsbestammelse_linje': [flat('e2', P1, 'egenskapsbestämmelse', { type: 'LineString', coordinates: [[15.1, 62.37], [15.11, 62.37]] }, { ref: '00000000-0000-4000-8000-000000000004', text: 'Utfart får inte finnas.', form: 'Kvartersmark', kategori: 'Utfart' })],
    'RIGES:NGP_Egenskapsbestammelse_punkt': 'no id field',
    'RIGES:NGP_Administrativbestammelse_yta': [],
    'RIGES:NGP_Anvandningsbeteckning_punkt': 'no id field',
    'RIGES:Byggnader_yta': [],
    'OTHER:NGP_Egenskapsbestammelse_yta': [flat('x1', P1, 'egenskapsbestämmelse', sq(15.1, 62.37, 0.001), { ref: '', text: 'Annan arbetsyta', form: '', kategori: '' })],
  });
  const caps = (names) => '<?xml version="1.0"?><wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" version="2.0.0"><wfs:FeatureTypeList>' + names.map((n) => `<wfs:FeatureType><wfs:Name>${n}</wfs:Name><wfs:Title>${n.split(':')[1]}</wfs:Title></wfs:FeatureType>`).join('') + '</wfs:FeatureTypeList></wfs:WFS_Capabilities>';
  /** A LIKE pattern (wildcard, single character, escape) as a regular expression. */
  function likeRegex(pattern, wild, single, esc) {
    let out = ''; const s = Array.from(pattern);
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc && c === esc) { out += s[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
      out += c === wild ? '.*' : c === single ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + out + '$', 'i');
  }
  /**
   * A WFS GetFeature answer: CQL_FILTER (GeoServer) and FILTER (FES 2.0) as `accepts` says, a filter the service ignores when
   * `ignores`, 400 for a layer whose schema lacks the plan's identity, paging with count and startIndex.
   */
  function wfs(u, layers, accepts = { cql: true, fes: true }, ignores = false) {
    if (u.searchParams.get('request') === 'GetCapabilities') return caps(Object.keys(layers));
    const type = u.searchParams.get('typeNames') || '';
    const all = layers[type];
    if (all === undefined) return OWS_400('Unknown feature type ' + type);
    const cql = u.searchParams.get('CQL_FILTER'); const fes = u.searchParams.get('FILTER');
    if ((cql && !accepts.cql) || (fes && !accepts.fes)) return OWS_400('Filter not supported');
    let keep = () => true;
    if (cql && !ignores) {
      const eq = /"detaljplan\.objektidentitet"='((?:[^']|'')*)'/.exec(cql);
      const like = /"detaljplan\.namn" ILIKE '((?:[^']|'')*)' OR "detaljplan\.beteckning" ILIKE '((?:[^']|'')*)'/.exec(cql);
      if (eq) keep = (f) => f.properties['detaljplan.objektidentitet'] === eq[1].replace(/''/g, "'");
      else if (like) { const re = likeRegex(like[1].replace(/''/g, "'"), '%', '_', ''); keep = (f) => re.test(f.properties['detaljplan.namn']) || re.test(f.properties['detaljplan.beteckning']); }
    }
    if (fes && !ignores) {
      const doc = new DOMParser().parseFromString(fes, 'application/xml');
      const literal = (el) => String((el.getElementsByTagNameNS('*', 'Literal')[0] || {}).textContent || '');
      const eq = doc.getElementsByTagNameNS('*', 'PropertyIsEqualTo')[0];
      const likes = Array.from(doc.getElementsByTagNameNS('*', 'PropertyIsLike'));
      if (eq) keep = (f) => f.properties['detaljplan.objektidentitet'] === literal(eq);
      else if (likes.length) { const res = likes.map((l) => likeRegex(literal(l), l.getAttribute('wildCard'), l.getAttribute('singleChar'), l.getAttribute('escapeChar'))); keep = (f) => res.some((re) => re.test(f.properties['detaljplan.namn']) || re.test(f.properties['detaljplan.beteckning'])); }
    }
    if ((cql || fes) && typeof all === 'string') return OWS_400('Illegal property name: detaljplan.objektidentitet for feature type ' + type);
    const rows = (typeof all === 'string' ? [] : all).filter(keep);
    const start = Number(u.searchParams.get('startIndex') || 0); const count = Number(u.searchParams.get('count') || 1000);
    return { type: 'FeatureCollection', numberMatched: rows.length, numberReturned: Math.min(count, Math.max(0, rows.length - start)), features: rows.slice(start, start + count) };
  }
  const getFeatures = (list, layer) => list.filter((s) => /request=GetFeature/.test(s.url) && (!layer || new URL(s.url).searchParams.get('typeNames') === layer));

  test('plan-whole: a WFS with the NGP layers offers whole plans; a plan found by name with CQL is fetched from every layer and kept as a detaljplan, a layer without the field is skipped', async (assert) => {
    const ids = []; const conns = [];
    const path = 'tests/geo/geoserver/RIGES/wfs';
    try {
      serve(path, (u) => wfs(u, LAYERS()));
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/geoserver/RIGES/wfs' });
      conns.push(r.connector.id);
      const connector = r.connector;
      assert.equal(ngp.kindOf(connector), 'wfs', 'recognised by the layers\' names');
      const layers = ngp.wfsLayers(connector);
      assert.equal(layers.plan.name, 'NGP_Detaljplan_yta');
      assert.deepEqual(layers.provisions.map((e) => e.name).sort(), ['NGP_Administrativbestammelse_yta', 'NGP_Anvandningsbestammelse_yta', 'NGP_Egenskapsbestammelse_linje', 'NGP_Egenskapsbestammelse_punkt', 'NGP_Egenskapsbestammelse_yta'], 'the provision layers of the plan layer\'s workspace');
      assert.equal(ngp.kindOf(Object.assign({}, connector, { endpoints: connector.endpoints.filter((e) => !/Detaljplan_yta/.test(e.name)) })), '', 'no plan layer, no entry');
      assert.deepEqual(ngp.filterModes(connector), ['cql', 'fes'], 'GeoServer: CQL first');
      // The entry at the top of the layer list opens the search card.
      const view = D.require('ui/api/geodata-view').create({ connector, runFetch() {}, log() {}, onDataset(m) { ids.push(m.id); } });
      view.start();
      const entry = view.el.querySelector('.dm-geo-layers').parentElement.querySelector('[data-plan-whole]');
      assert.ok(entry && view.el.querySelector('.dm-geo-layer') === entry, 'the entry is first in the list');
      assert.equal(entry.textContent.includes(t('plan.whole.title')), true);
      /** @type {any} */ (entry).click();
      const card = view.el.querySelector('[data-plan-whole-card="wfs"]');
      assert.ok(card, 'the card is shown');
      const whole = view.whole();
      // A search by name: å, ä and ö become the single-character wildcard (a GeoServer ILIKE misses them).
      served.length = 0;
      whole.state.query = 'prästbordet';
      await whole.search();
      assert.equal(whole.state.error, '', whole.state.error);
      assert.deepEqual(whole.state.plans.map((p) => [p.beteckning, p.namn, p.status, p.datum]), [['22-HAV-1125', 'Prästbordet 1:1 och 1:4', 'laga kraft', '1968-11-28']]);
      const asked = new URL(served[0].url).searchParams;
      assert.equal(asked.get('CQL_FILTER'), `"detaljplan.namn" ILIKE '%pr_stbordet%' OR "detaljplan.beteckning" ILIKE '%pr_stbordet%'`);
      assert.equal(asked.get('typeNames'), 'RIGES:NGP_Detaljplan_yta'); assert.equal(asked.get('count'), String(ngp.LIST));
      assert.equal(whole.state.mode, 'cql');
      assert.ok(card.querySelectorAll('[data-plan-whole-hit]').length === 1 && card.querySelector('.dm-geo-whole-list.dm-fill'), 'one hit in a list that fills the window');
      assert.ok(card.querySelector('[data-plan-whole-hit]').getAttribute('data-tip'), 'the hit has a tip');
      // A quote in a designation is doubled, and a designation is found too.
      assert.equal(ngp.searchValues('cql', "O'Hara").CQL_FILTER, `"detaljplan.namn" ILIKE '%O''Hara%' OR "detaljplan.beteckning" ILIKE '%O''Hara%'`);
      whole.state.query = "o'hara"; await whole.search();
      assert.deepEqual(whole.state.plans.map((p) => p.id), [P3.id]);
      // Every plan without a term: the first ones and how many there are.
      whole.state.query = ''; await whole.search();
      assert.equal(whole.state.plans.length, 3); assert.equal(whole.state.total, 3);
      // The plan whole: the plan layer, then each provision layer, filtered on the plan's identity.
      served.length = 0;
      await whole.fetchPlan({ id: P1.id, beteckning: P1.beteckning, namn: P1.namn });
      assert.equal(whole.state.error, '', whole.state.error);
      assert.equal(ids.length, 1, 'one plan saved');
      const asks = getFeatures(served);
      assert.equal(asks.length, 6, 'the plan layer and five provision layers: ' + asks.map((s) => new URL(s.url).searchParams.get('typeNames')).join(', '));
      assert.ok(asks.every((s) => new URL(s.url).searchParams.get('CQL_FILTER') === `"detaljplan.objektidentitet"='${P1.id}'`), 'each with the identity filter');
      assert.ok(!getFeatures(served, 'OTHER:NGP_Egenskapsbestammelse_yta').length && !getFeatures(served, 'RIGES:NGP_Anvandningsbeteckning_punkt').length, 'not the other workspace, not the designation points');
      assert.deepEqual(whole.state.skipped, ['NGP_Egenskapsbestammelse_punkt'], 'the layer without the field is skipped');
      assert.ok(card.querySelector('[data-plan-whole-skipped="NGP_Egenskapsbestammelse_punkt"]') && card.querySelector('[data-plan-whole-saved]'), 'the card says what was saved and skipped');
      const meta = await datasets.get(ids[0]);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 5, 'plan area, two uses, two properties');
      assert.equal(meta.name, P1.namn);
      assert.equal(meta.plan.beteckning, '22-HAV-1125'); assert.equal(meta.plan.kommun, 'Ånge kommun'); assert.equal(meta.plan.kommunkod, '2260', 'the municipality out of GeoServer\'s list form');
      assert.equal(meta.plan.format, 'ngp');
      const cols = (await datasets.columns(ids[0])).map((c) => c.name);
      const rows = await datasets.query(ids[0]);
      const at = (name) => cols.indexOf(name);
      assert.deepEqual(rows.map((x) => x[at('objektid')]).sort(), [P1.id, 'e1', 'e2', 'u1', 'u2'].sort(), 'the objects by their NGP identity');
      assert.deepEqual(rows.map((x) => x[at('objekttyp')]).sort(), ['anvandning', 'anvandning', 'egenskap', 'egenskap', 'planomrade']);
      assert.ok(rows.find((x) => x[at('katalogreferens')] === B_UUID && x[at('beteckning')] === 'B'), 'Boverket\'s designation from the catalogue');
      // Cancelled between layers: nothing saved, and the card says so.
      let release = null;
      serve(path, (u) => (new URL(u).searchParams.get('typeNames') === 'RIGES:NGP_Anvandningsbestammelse_yta' ? new Promise((res) => { release = () => res(wfs(u, LAYERS())); }) : wfs(u, LAYERS())));
      const running = whole.fetchPlan({ id: P1.id, beteckning: P1.beteckning, namn: P1.namn });
      for (let i = 0; i < 100 && !release; i++) await wait(20);
      assert.ok(release, 'the slow layer was asked for');
      assert.ok(whole.el.querySelector('[data-plan-whole-progress]'), 'progress while fetching');
      whole.cancel(); release();
      await running;
      assert.equal(whole.state.error, t('api.aborted')); assert.equal(ids.length, 1, 'nothing more saved');
      return 'ok';
    } finally {
      D.net.unvirtual(path);
      for (const id of ids) await datasets.remove(id).catch(() => {});
      for (const id of conns) await connectors.remove(id).catch(() => {});
    }
  }, 30000);

  test('plan-whole: a WFS that is no GeoServer is asked with FES 2.0; a refused filter tries the other language, and a service that takes neither says so', async (assert) => {
    const conns = [];
    try {
      serve('tests/geo/ows-ngp', (u) => wfs(u, LAYERS(), { cql: false, fes: true }));
      serve('tests/geo/ows-cql', (u) => wfs(u, LAYERS(), { cql: true, fes: false }));
      serve('tests/geo/ows-none', (u) => wfs(u, LAYERS(), { cql: false, fes: false }));
      serve('tests/geo/ows-ignore', (u) => wfs(u, LAYERS(), { cql: true, fes: true }, true));
      const make = async (p) => { const r = await geodata.createConnector('wfs', { baseUrl: BASE + p }); conns.push(r.connector.id); return r.connector; };
      const fes = await make('/ows-ngp');
      assert.deepEqual(ngp.filterModes(fes), ['fes', 'cql']);
      served.length = 0;
      const found = await ngp.searchWfs(fes, 'Östrand');
      assert.deepEqual(found.plans.map((p) => p.id), [P2.id]); assert.equal(found.mode, 'fes');
      const filter = new URL(served[0].url).searchParams.get('FILTER');
      assert.ok(filter.includes('<fes:PropertyIsLike wildCard="*" singleChar="_" escapeChar="!" matchCase="false">') && filter.includes('<fes:Literal>*_strand*</fes:Literal>'), filter);
      assert.ok(ngp.searchValues('fes', 'a*b<c').FILTER.includes('<fes:Literal>*a!*b&lt;c*</fes:Literal>'), 'wildcards escaped, XML escaped');
      const got = await ngp.fetchWfs(fes, P2.id, { mode: 'fes' });
      assert.equal(got.rows.length, 2, 'plan area and one use'); assert.deepEqual(got.skipped, ['NGP_Egenskapsbestammelse_punkt']);
      assert.ok(ngp.idValues('fes', 'x<y').FILTER.includes('<fes:Literal>x&lt;y</fes:Literal>'));
      // FES refused: CQL is tried next and settles the language.
      const cql = await make('/ows-cql');
      const viaCql = await ngp.searchWfs(cql, 'massafabrik');
      assert.deepEqual([viaCql.plans.length, viaCql.mode], [1, 'cql']);
      assert.equal((await ngp.fetchWfs(cql, P2.id)).rows.length, 2);
      // Neither language, or a filter that is ignored (every plan comes back): said, nothing kept.
      for (const p of ['/ows-none', '/ows-ignore']) {
        const c = await make(p);
        let message = '';
        try { await ngp.searchWfs(c, 'prästbordet'); } catch (err) { message = err.message; }
        assert.equal(message, t('plan.whole.err.filter'), p + ' search: ' + message);
        message = '';
        try { await ngp.fetchWfs(c, P1.id); } catch (err) { message = err.message; }
        assert.equal(message, t('plan.whole.err.filter'), p + ' fetch: ' + message);
      }
      return 'ok';
    } finally {
      for (const p of ['ows-ngp', 'ows-cql', 'ows-none', 'ows-ignore']) D.net.unvirtual('tests/geo/' + p);
      for (const id of conns) await connectors.remove(id).catch(() => {});
    }
  }, 30000);

  // ---- Lantmäteriet's NGP API, from the examples of the specification 2.2 ------------------------------------------------
  const API = BASE + '/ngp/sokning/v1/detaljplan/v2';
  const KOMMUN = '2882';
  const providers = [{ name: 'Österhamns kommun', roles: ['producer'], kod: KOMMUN }];
  const dp = (id, beteckning, namn) => ({ objektidentitet: id, beteckning, namn, status: 'laga kraft', datumStatusforandring: '1960-09-05', typ: 'stadsplan', datumPaborjat: '1960-02-17', datumLagakraft: '1960-09-05', kvalitet: { korrigeradeGranser: false, kontrolleratPlaneringsunderlag: false }, anvandbarhet: 'god' });
  const A_ID = '2ca2ef06-0a48-4d34-ae53-29730f29d498'; const B_ID = '7d3c1e7a-1111-4a2b-9c3d-000000000002';
  // In WGS 84 as asked (crs=CRS84), near the example's place.
  const planItem = (id, beteckning, namn, assets) => ({ stac_version: '0.9.0', id, type: 'Feature', geometry: sq(14.15, 57.4, 0.002), properties: { datetime: '2020-01-31T17:01:45.30282+01:00', providers, title: beteckning, feature: { typ: 'detaljplan', etikett: beteckning }, detaljplan: dp(id, beteckning, namn) }, links: [], assets, collection: KOMMUN });
  const provision = (id, planId, beteckning, namn, typ, pb) => ({ stac_version: '0.9.0', id, type: 'Feature', geometry: sq(14.15, 57.4, 0.001), properties: { datetime: '2020-01-31T17:01:45.30282+01:00', providers, title: pb.bestammelseformulering, feature: { typ, etikett: beteckning }, detaljplan: dp(planId, beteckning, namn), planbestammelse: pb }, links: [], assets: {}, collection: KOMMUN });
  const ASSET = BASE + '/ngp/nedladdning/v1/asset/' + A_ID;
  const PLANS = () => [
    planItem(A_ID, '09-KLI-539', 'Östergöta plan FF-35', { 'asset-1': { href: ASSET + '?r=1', type: 'application/vnd.lm.detaljplan.v4+json', title: 'Detaljplan', roles: ['detaljplan'] }, 'asset-2': { href: BASE + '/ngp/nedladdning/v1/asset/beslut', title: 'Beslutshandling', roles: ['beslutshandling'] } }),
    planItem(B_ID, '09-KLI-540', 'Östergöta plan FF-36', {}),
  ];
  const OBJECTS = () => [
    provision('269ceb95-52f0-4886-b1ee-e74060f0d72e', B_ID, '09-KLI-540', 'Östergöta plan FF-36', 'egenskapsbestämmelse', { planbestammelsekatalogreferens: '72bbe252-9884-4f1c-9778-cd137b88b824', bestammelseformulering: 'Största takvinkel är 10 grader.', bestammelsevarde: { variabelvarde: 10, vardetyp: 'max', enhet: 'grader' }, anvandningsform: 'Planområdet', kategori: 'Utformning', underkategori: 'Takvinkel' }),
    provision('a1', B_ID, '09-KLI-540', 'Östergöta plan FF-36', 'användningsbestämmelse', { planbestammelsekatalogreferens: B_UUID, bestammelseformulering: 'Bostäder', anvandningsform: 'Kvartersmark', kategori: 'Bostäder' }),
  ];
  /** The national specification's file of plan A (Detaljplan 4.1), in SWEREF 99 TM. */
  const SPEC = () => {
    const g = (x) => [{ geometri: { koordinatsystemPlan: 'EPSG:3006', type: 'Polygon', coordinates: sq(x, 6364731, 100).coordinates } }];
    return { type: 'FeatureCollection', 'feature:mediatyp': 'application/vnd.lm.detaljplan.v4+json', features: [
      { type: 'Feature', id: A_ID, geometry: null, properties: { 'feature:typ': 'detaljplan', objektidentitet: A_ID, kommun: KOMMUN, beteckning: '09-KLI-539', namn: 'Östergöta plan FF-35', status: 'laga kraft', typ: 'stadsplan', plangeometri: g(692230) } },
      { type: 'Feature', id: 'u1', geometry: null, properties: { 'feature:typ': 'anvandningsbestammelse', detaljplan: A_ID, planbestammelsekatalogreferens: B_UUID, bestammelseformulering: 'Bostäder', bestammelsegeometri: g(692230) } },
      { type: 'Feature', id: 'u2', geometry: null, properties: { 'feature:typ': 'anvandningsbestammelse', detaljplan: A_ID, planbestammelsekatalogreferens: '00000000-0000-4000-8000-000000000001', bestammelseformulering: 'Gata', bestammelsegeometri: g(692330) } },
    ] };
  };
  /** POST /search: the query extension's contains/eq on the plan's fields, collections, limit, and a next link for the second page. */
  function search(u, seen) {
    const body = JSON.parse(String(seen.body || '{}'));
    const q = body.query || {};
    let items = PLANS().concat(OBJECTS());
    if (q['feature.typ']) items = items.filter((f) => f.properties.feature.typ === q['feature.typ'].eq);
    for (const [field, op] of Object.entries(q)) {
      if (!field.startsWith('detaljplan.')) continue;
      const key = field.slice(11);
      items = items.filter((f) => { const v = String(f.properties.detaljplan[key] || '').toLowerCase(); return op.contains !== undefined ? v.includes(String(op.contains).toLowerCase()) : v === String(op.eq).toLowerCase(); });
    }
    if (Array.isArray(body.collections)) items = items.filter((f) => body.collections.includes(f.collection));
    // Pages of one object, so that the next link is followed (STAC: method POST, merge with the body).
    const after = u.searchParams.get('afterId');
    const start = after ? items.findIndex((f) => f.id === after) + 1 : 0;
    const size = q['detaljplan.objektidentitet'] ? 1 : Number(body.limit || 10);
    const page = items.slice(start, start + size);
    const next = start + size < items.length ? [{ rel: 'next', href: `${API}/search?crs=${encodeURIComponent(ngp.CRS84)}&afterId=${page[page.length - 1].id}`, method: 'POST', body: {}, merge: true }] : [];
    return { type: 'FeatureCollection', features: page, links: next };
  }

  test('plan-whole: the NGP API finds plans by name in a municipality with POST /search, keeps the national specification\'s file, and without it the reference objects page by page', async (assert) => {
    const ids = [];
    const preset = await connectors.get('lantmateriet-ngp-detaljplan');
    const connector = Object.assign({}, preset, { id: 'test-ngp-plans', baseUrl: API, auth: Object.assign({}, preset.auth, { tokenUrl: BASE + '/ngp/token' }),
      endpoints: [{ id: 'collection-2882', name: 'Österhamns kommun', method: 'GET', path: '/collections/2882/items', params: [], response: { format: 'geojson' } }, { id: 'collection', name: 'Samling', method: 'GET', path: '/collections/{collection}/items', params: [] }] });
    try {
      serve('tests/geo/ngp/token', () => ({ access_token: 'ngp-token', expires_in: 3600, token_type: 'Bearer' }));
      serve('tests/geo/ngp/sokning/v1/detaljplan/v2/search', search);
      serve('tests/geo/ngp/nedladdning/v1/asset/' + A_ID, () => SPEC());
      secrets.set(connector.id, { clientId: 'konsumentnyckel', clientSecret: 'konsumenthemlighet' });
      assert.equal(ngp.kindOf(connector), 'api'); assert.deepEqual(ngp.municipalities(connector), [{ id: '2882', name: 'Österhamns kommun' }]);
      let message = '';
      try { await ngp.searchApi(connector, '  '); } catch (err) { message = err.message; }
      assert.equal(message, t('plan.whole.need'), 'a term or a municipality');
      served.length = 0;
      const found = await withBodies(() => ngp.searchApi(connector, 'östergöta', { collection: KOMMUN }));
      assert.deepEqual(found.plans.map((p) => [p.beteckning, p.namn, p.datum, p.collection]), [['09-KLI-539', 'Östergöta plan FF-35', '1960-09-05', KOMMUN], ['09-KLI-540', 'Östergöta plan FF-36', '1960-09-05', KOMMUN]]);
      assert.equal(found.plans[0].asset, ASSET + '?r=1', 'the plan\'s file among its assets'); assert.equal(found.plans[1].asset, '');
      const posts = served.filter((s) => /\/search\?/.test(s.url));
      assert.equal(posts.length, 2, 'one search per field');
      assert.ok(posts.every((s) => new URL(s.url).searchParams.get('crs') === ngp.CRS84), 'the answer asked for in WGS 84');
      const bodies = posts.map((s) => JSON.parse(String(s.body)));
      assert.deepEqual(bodies.map((b) => Object.keys(b.query).sort()), [['detaljplan.namn', 'feature.typ'], ['detaljplan.beteckning', 'feature.typ']]);
      assert.deepEqual(bodies[0], { limit: ngp.LIST, query: { 'feature.typ': { eq: 'detaljplan' }, 'detaljplan.namn': { contains: 'östergöta' } }, collections: [KOMMUN] });
      assert.ok(posts.every((s) => s.headers.Authorization === 'Bearer ngp-token'), 'the token on the searches');
      // The token: client id and secret in the form body (client_secret_post), no Authorization header on that request.
      const tok = served.find((s) => /\/ngp\/token$/.test(s.url));
      assert.ok(tok && !tok.headers.Authorization, 'no Authorization header to the token URL');
      assert.equal(String(tok.body), 'grant_type=client_credentials&client_id=konsumentnyckel&client_secret=konsumenthemlighet');
      assert.equal(tok.headers['Content-Type'], 'application/x-www-form-urlencoded');
      // Plan A has the national specification's file: it is kept as the plan, with the file as its original.
      served.length = 0;
      const a = await withBodies(() => ngp.fetchPlan(connector, found.plans[0]));
      ids.push(a.meta.id);
      assert.equal(a.fallback, '');
      const metaA = await datasets.get(a.meta.id);
      assert.equal(metaA.kind, 'plan'); assert.equal(metaA.rowCount, 3); assert.equal(metaA.plan.beteckning, '09-KLI-539');
      assert.equal(metaA.source.planFormat, 'detaljplan'); assert.equal(metaA.source.via, 'asset'); assert.equal(metaA.source.kind, 'api'); assert.equal(metaA.source.planId, A_ID);
      const assetAsk = served.find((s) => s.url.startsWith(ASSET));
      assert.ok(assetAsk && assetAsk.headers.Authorization === 'Bearer ngp-token' && /vnd\.lm\.detaljplan\.v4\+json/.test(assetAsk.headers.Accept), 'the asset with the key, asked for in its own type');
      const files = await D.require('data/dataset-files').list(a.meta.id);
      assert.ok(files.some((f) => f.kind === 'original' && f.name === '09-KLI-539.json'), 'the file kept: ' + JSON.stringify(files));
      // Plan B has none: its reference objects, page by page through the next links, as one NGP plan.
      served.length = 0;
      const b = await withBodies(() => ngp.fetchPlan(connector, found.plans[1]));
      ids.push(b.meta.id);
      const metaB = await datasets.get(b.meta.id);
      assert.equal(metaB.rowCount, 3, 'the plan and two provisions'); assert.equal(metaB.source.planFormat, 'ngp'); assert.equal(metaB.source.via, 'objects');
      assert.equal(metaB.plan.kommun, 'Österhamns kommun'); assert.equal(metaB.plan.beteckning, '09-KLI-540');
      const pages = served.filter((s) => /\/search\?/.test(s.url));
      assert.equal(pages.length, 3, 'three pages of one object');
      assert.deepEqual(JSON.parse(String(pages[0].body)), { limit: 1000, query: { 'detaljplan.objektidentitet': { eq: B_ID } }, collections: [KOMMUN] });
      assert.ok(new URL(pages[2].url).searchParams.get('afterId'), 'the next link followed');
      const cols = (await datasets.columns(b.meta.id)).map((c) => c.name);
      const geom = JSON.parse((await datasets.query(b.meta.id))[0][cols.indexOf('geometri')]);
      assert.ok(Math.abs(geom.coordinates[0][0][0] - 14.15) < 1e-6, 'kept in WGS 84 as asked');
      // A file on another host than the API's never gets the key: the reference objects are used instead, and nothing goes there.
      served.length = 0;
      const elsewhere = Object.assign({}, found.plans[1], { asset: 'https://example.org/asset/' + B_ID });
      const c = await ngp.fetchApi(connector, elsewhere);
      assert.equal(c.via, 'objects'); assert.ok(!served.some((s) => /example\.org/.test(s.url)));
      // An asset that cannot be read falls back to the reference objects, and says why.
      serve('tests/geo/ngp/nedladdning/v1/asset/' + A_ID, () => ({ status: 404, body: 'saknas' }));
      const d = await ngp.fetchApi(connector, Object.assign({}, found.plans[0], { asset: ASSET }));
      assert.equal(d.via, 'objects'); assert.ok(d.fallback, 'the reason kept');
      return 'ok';
    } finally {
      for (const n of ['tests/geo/ngp/token', 'tests/geo/ngp/sokning/v1/detaljplan/v2/search', 'tests/geo/ngp/nedladdning/v1/asset/' + A_ID]) D.net.unvirtual(n);
      await secrets.forget(connector.id); auth.clearToken(connector.id);
      for (const id of ids) await datasets.remove(id).catch(() => {});
    }
  }, 30000);

  test('plan-whole: OAuth2 client credentials go in the form body when the source says so, and the secret never reaches a header, the address or the error', async (assert) => {
    const id = 'test-ngp-secret-post';
    const SECRET = 'h&mlig=hemlighet';
    const connector = { id, name: 'Prov', baseUrl: BASE, auth: { type: 'oauth2_client_credentials', tokenUrl: BASE + '/ngp/token-refused', clientAuth: 'body' }, endpoints: [] };
    try {
      serve('tests/geo/ngp/token-refused', () => ({ status: 401, body: '{"error_description":"Client credentials are invalid.","error":"invalid_client"}' }));
      secrets.set(id, { clientId: 'nyckel', clientSecret: SECRET });
      served.length = 0;
      let message = '';
      try { await withBodies(() => auth.apply(connector, { url: BASE + '/x', method: 'GET', headers: {} })); } catch (err) { message = String(err.message); }
      const tok = served[0];
      assert.ok(tok && !tok.headers.Authorization && !tok.url.includes('hemlighet'), 'neither a header nor the address');
      assert.equal(String(tok.body), 'grant_type=client_credentials&client_id=nyckel&client_secret=' + encodeURIComponent(SECRET), 'the secret encoded in the body');
      assert.ok(message && !message.includes('hemlighet') && message.includes(t('api.err.token')), 'the error names the token, not the secret: ' + message);
      // The default is still a Basic header (client_secret_basic), with nothing in the body.
      const basic = Object.assign({}, connector, { id: id + '-basic', auth: { type: 'oauth2_client_credentials', tokenUrl: BASE + '/ngp/token-refused' } });
      secrets.set(basic.id, { clientId: 'nyckel', clientSecret: SECRET });
      served.length = 0;
      try { await withBodies(() => auth.apply(basic, { url: BASE + '/x', method: 'GET', headers: {} })); } catch (_err) { /* refused as above */ }
      assert.equal(served[0].headers.Authorization, 'Basic ' + btoa('nyckel:' + SECRET)); assert.equal(String(served[0].body), 'grant_type=client_credentials');
      await secrets.forget(basic.id);
      // The schema takes the two ways and nothing else.
      const schema = D.require('api/schema');
      const base = { format: 'dataspatium-api/1', id: 'ok-id', name: 'X', baseUrl: 'https://x.se', endpoints: [{ id: 'a', name: 'A' }] };
      assert.deepEqual(schema.validate(Object.assign({}, base, { auth: { type: 'oauth2_client_credentials', tokenUrl: 'https://x.se/token', clientAuth: 'body' } })), []);
      assert.ok(schema.validate(Object.assign({}, base, { auth: { type: 'oauth2_client_credentials', tokenUrl: 'https://x.se/token', clientAuth: 'url' } })).length > 0, 'an unknown way is refused');
      return 'ok';
    } finally {
      D.net.unvirtual('tests/geo/ngp/token-refused');
      await secrets.forget(id); auth.clearToken(id);
    }
  });

  test('plan-whole: the NGP preset logs in with OAuth2 in the body and says anyone can become a consumer; Sundsvall\'s RIGES is a ready source without a key', async (assert) => {
    const preset = await connectors.get('lantmateriet-ngp-detaljplan');
    assert.deepEqual([preset.auth.type, preset.auth.tokenUrl, preset.auth.clientAuth], ['oauth2_client_credentials', 'https://api.lantmateriet.se/token', 'body']);
    assert.equal(preset.family.plans, 'ngp'); assert.equal(preset.level, 2);
    assert.ok(/konsument/.test(preset.auth.signupUrl) && /konsument/.test(preset.docs), 'the Bli konsument pages');
    const raw = JSON.parse(await D.assets.loadText('presets/api/lantmateriet-ngp-detaljplan.api.json'));
    for (const text of [raw.description, raw.auth.help, raw.i18n.en.description, raw.i18n.en.auth.help]) assert.ok(!/ansluten|connected organisation/i.test(text) && /Geotorget/.test(text), text);
    assert.ok(/utan kostnad/.test(raw.description) && /CC0/.test(raw.description) && /två arbetsdagar/.test(raw.description) && /Basic/.test(raw.auth.help), 'free, CC0, two working days, Basic explained');
    const riges = await connectors.get('sundsvall-riges');
    assert.ok(riges, 'the preset');
    assert.deepEqual([riges.family.kind, riges.baseUrl, riges.level, riges.auth.type], ['wfs', 'https://karta.sundsvall.se/geoserver/RIGES/wfs', 1, 'none']);
    const list = JSON.parse(await D.assets.loadText('presets/geodata/services.json')).services;
    const svc = list.find((s) => s.id === 'sundsvall-riges');
    assert.ok(svc && svc.preset === 'sundsvall-riges' && svc.url === riges.baseUrl && svc.kind === 'wfs', 'listed with the ready geodata sources');
    assert.ok(!list.some((s) => /^lantmateriet-ngp-/.test(s.id) && Object.values(s.about).some((x) => /ansluten|connected organisation|tilsluttet|tilknyttet|liittyneeltä|tengdri/.test(String(x)))), 'no platform entry says a connected organisation is needed');
    return 'ok';
  });

  test('plan-whole: OGC API collections stored in another system that offer CRS84 are asked for CRS84', async (assert) => {
    const conns = [];
    try {
      serve('tests/geo/oapif-crs/collections', () => ({ crs: [ngp.CRS84, 'http://www.opengis.net/def/crs/EPSG/0/3006'], collections: [
        { id: '2882', title: 'Österhamns kommun', crs: ['#/crs'], storageCrs: 'http://www.opengis.net/def/crs/EPSG/0/3006' },
        { id: 'wgs', title: 'Redan WGS 84', storageCrs: ngp.CRS84 },
        { id: 'plain', title: 'Utan uppgift' }] }));
      const r = await geodata.createConnector('ogcapi', { baseUrl: BASE + '/oapif-crs' });
      conns.push(r.connector.id);
      const param = (e, name) => (e.params || []).find((p) => p.name === name);
      const [ngpEp, wgsEp, plainEp] = geodata.layerEndpoints(r.connector);
      assert.equal(param(ngpEp, 'crs').default, ngp.CRS84); assert.equal(param(ngpEp, 'bbox-crs').default, ngp.CRS84); assert.ok(param(ngpEp, 'crs').hidden);
      assert.ok(!param(wgsEp, 'crs') && !param(plainEp, 'crs'), 'not for the others, which may refuse an unknown parameter');
      return 'ok';
    } finally {
      D.net.unvirtual('tests/geo/oapif-crs/collections');
      for (const id of conns) await connectors.remove(id).catch(() => {});
    }
  });

  test('plan-whole: an NGP file of several plans is read as a map of the plans with a note; a file of one plan stays a plan', async (assert) => {
    const ids = [];
    try {
      const many = { type: 'FeatureCollection', features: PLANS() };
      const file = new File([JSON.stringify(many)], 'planytor.geojson', { type: 'application/geo+json' });
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'json', 'read as GeoJSON'); assert.equal(p.planMany, 2, 'the note counts the plans');
      const meta = await importer.run(file, { format: p.importer }, null, null);
      ids.push(meta.id);
      assert.ok(meta.kind !== 'plan', 'not a plan: ' + meta.kind); assert.equal(meta.rowCount, 2);
      assert.ok(D.require('viz/leaflet').mapDefault(await datasets.columns(meta.id)), 'it opens as a map');
      // Forced as a plan, it is refused rather than made one plan of the first plan's facts.
      let message = '';
      try { await importer.preview(file, { format: 'detaljplan' }); } catch (err) { message = err.message; }
      assert.equal(message, t('plan.err.many', { n: 2 }));
      const one = new File([JSON.stringify({ type: 'FeatureCollection', features: [PLANS()[1]].concat(OBJECTS()) })], 'en-plan.geojson', { type: 'application/geo+json' });
      const q = await importer.preview(one, {});
      assert.equal(q.importer, 'detaljplan'); assert.ok(!q.planMany);
      return 'ok';
    } finally { for (const id of ids) await datasets.remove(id).catch(() => {}); }
  });

  // ---- the real Sundsvall service (only with ?live=plans) --------------------------------------------------------------
  test('plan-whole: live, a whole plan from Sundsvall\'s RIGES (only with ?live=plans)', async (assert) => {
    if (!/[?&]live=plans\b/.test(location.search)) return 'skipped (add ?live=plans to run)';
    const preset = await connectors.get('sundsvall-riges');
    const fam = geodata.byId('wfs');
    const v = fam.normalize({ baseUrl: preset.baseUrl });
    const entities = await fam.discover(v, preset, (url, headers) => D.require('api/families/databases').getJson(preset, url, headers));
    const connector = Object.assign({}, preset, { endpoints: fam.endpoints(v, entities) });
    assert.equal(ngp.kindOf(connector), 'wfs');
    const found = await ngp.searchWfs(connector, 'Prästbordet');
    const hit = found.plans.find((x) => x.beteckning === '22-HAV-1125');
    assert.ok(hit, 'the plan found: ' + found.plans.map((x) => x.beteckning).join(', '));
    const got = await ngp.fetchWfs(connector, hit.id, { mode: found.mode });
    assert.ok(got.rows.length >= 34, 'plan area, 21 uses and 12 properties: ' + got.rows.length);
    const res = await ngp.fetchPlan(connector, hit, { mode: found.mode });
    try {
      assert.equal(res.meta.kind, 'plan');
      return `${entities.length} layers, ${found.plans.length} hits (${found.mode}), ${got.rows.length} objects from ${got.layers.length} layers, skipped ${got.skipped.join(', ') || 'none'}`;
    } finally { await datasets.remove(res.meta.id).catch(() => {}); }
  }, 120000);
})();
