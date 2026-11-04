// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * HTTP database families: PostgREST/Supabase, OData v4, GraphQL, CouchDB, ClickHouse, Elasticsearch/OpenSearch,
 * SPARQL endpoints, InfluxDB v2, Google Sheets and Airtable. Each family knows its fields (address, key, ...),
 * its authentication, how to discover tables or collections, and how to write the endpoints of an ordinary
 * connector (dataspatium-api/1) for them, so that "Lägg till databaskälla" in Inhämta turns an address into a
 * connector with one endpoint per table plus a generic one. Keys go to api/secrets, never into the connector.
 * The service must allow CORS; the note per family lives in the UI texts and in docs/kallor.md.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/databases', ['api/http', 'api/auth', 'api/connectors', 'api/secrets', 'api/schema'], (http, auth, connectors, secrets, schema) => {
    const t = (k, p) => D.t(k, p);
    const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    /** Query parameter with a label. */
    const P = (name, extra) => Object.assign({ name, in: 'query', type: 'string' }, extra || {});

    /** The CSV address of a Google Sheet: a published link (pub?output=csv) or a normal sheet link via gviz. */
    function sheetsCsvUrl(input) {
      const s = String(input || '').trim();
      let m = /docs\.google\.com\/spreadsheets\/d\/e\/([^/?#]+)/.exec(s);
      if (m) return `https://docs.google.com/spreadsheets/d/e/${m[1]}/pub?output=csv`;
      m = /docs\.google\.com\/spreadsheets\/d\/([^/?#]+)/.exec(s);
      if (m) {
        const gid = (/[#&?]gid=(\d+)/.exec(s) || [])[1];
        return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${gid ? '&gid=' + gid : ''}`;
      }
      return s;
    }

    /** @type {Array<any>} */
    const FAMILIES = [
      {
        id: 'postgrest', name: 'PostgREST / Supabase', docs: 'https://docs.postgrest.org/en/stable/references/api/tables_views.html',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://xyz.supabase.co/rest/v1' }, { name: 'apiKey', type: 'secret' }],
        auth: (v) => (v.apiKey ? { type: 'apiKey', in: 'header', name: 'apikey' } : { type: 'none' }),
        secrets: (v) => (v.apiKey ? { apiKey: v.apiKey } : null),
        async discover(v, connector, get) {
          const data = await get(trimUrl(v.baseUrl) + '/');
          const paths = data && data.paths ? Object.keys(data.paths) : [];
          return paths.filter((p) => p !== '/' && !p.startsWith('/rpc/')).map((p) => p.replace(/^\//, '')).filter(Boolean).map((name) => ({ id: name, name }));
        },
        endpoints(v, entities) {
          const common = () => [P('select', { label: t('families.param.select'), default: '*' }), P('order', { label: t('families.param.order'), example: 'id.asc' }), P('filter', { type: 'querylines', label: t('families.param.filter'), help: t('families.postgrest.filter.help') })];
          const pagination = { type: 'offset', param: 'offset', sizeParam: 'limit', size: 1000, maxPages: 100 };
          const list = entities.map((e) => ({ id: 'table-' + slug(e.id), name: e.name, method: 'GET', path: '/' + e.id, params: common(), pagination, response: { format: 'json' }, dataset: { name: e.name } }));
          list.push({ id: 'table', name: t('families.generic.table'), method: 'GET', path: '/{table}', params: [{ name: 'table', in: 'path', type: 'string', required: true, label: t('families.param.table') }].concat(common()), pagination, response: { format: 'json' }, dataset: { name: '{table}' } });
          return list;
        },
      },
      {
        id: 'odata', name: 'OData v4', docs: 'https://www.odata.org/getting-started/basic-tutorial/',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://services.odata.org/V4/Northwind/Northwind.svc' }, { name: 'username', type: 'text' }, { name: 'password', type: 'secret' }],
        auth: (v) => (v.username ? { type: 'basic' } : { type: 'none' }),
        secrets: (v) => (v.username ? { username: v.username, password: v.password || '' } : null),
        async discover(v, connector, get) {
          const data = await get(trimUrl(v.baseUrl) + '/');
          const sets = data && Array.isArray(data.value) ? data.value : [];
          return sets.filter((e) => e && e.name && (!e.kind || e.kind === 'EntitySet')).map((e) => ({ id: e.url || e.name, name: e.name }));
        },
        endpoints(v, entities) {
          const common = () => [P('$select', { label: t('families.param.select') }), P('$filter', { label: t('families.param.filter.odata'), example: "Country eq 'Sweden'" }), P('$orderby', { label: t('families.param.order') }), P('$top', { type: 'number', label: t('families.param.top'), default: 1000 })];
          const pagination = { type: 'next-url', path: '@odata.nextLink', maxPages: 100 };
          const list = entities.map((e) => ({ id: 'set-' + slug(e.id), name: e.name, method: 'GET', path: '/' + e.id, params: common(), pagination, response: { format: 'json', path: 'value' }, dataset: { name: e.name } }));
          list.push({ id: 'set', name: t('families.generic.entity'), method: 'GET', path: '/{entity}', params: [{ name: 'entity', in: 'path', type: 'string', required: true, label: t('families.param.entity') }].concat(common()), pagination, response: { format: 'json', path: 'value' }, dataset: { name: '{entity}' } });
          return list;
        },
      },
      {
        id: 'graphql', name: 'GraphQL', docs: 'https://graphql.org/learn/serving-over-http/',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://example.org/graphql' }, { name: 'token', type: 'secret' }],
        auth: (v) => (v.token ? { type: 'bearer' } : { type: 'none' }),
        secrets: (v) => (v.token ? { token: v.token } : null),
        endpoints() {
          return [{ id: 'query', name: t('families.graphql.query'), method: 'POST', path: '', bodyType: 'json', body: { query: '{query}', variables: {} }, params: [{ name: 'query', in: 'option', type: 'text', required: true, label: t('families.param.query'), example: '{ items { id name } }' }], response: { format: 'graphql' }, dataset: { name: 'GraphQL' } }];
        },
      },
      {
        id: 'couchdb', name: 'CouchDB', docs: 'https://docs.couchdb.org/en/stable/api/database/bulk-api.html',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'http://localhost:5984' }, { name: 'username', type: 'text' }, { name: 'password', type: 'secret' }],
        auth: (v) => (v.username ? { type: 'basic' } : { type: 'none' }),
        secrets: (v) => (v.username ? { username: v.username, password: v.password || '' } : null),
        async discover(v, connector, get) {
          const data = await get(trimUrl(v.baseUrl) + '/_all_dbs');
          return (Array.isArray(data) ? data : []).filter((n) => typeof n === 'string' && !n.startsWith('_')).map((n) => ({ id: n, name: n }));
        },
        endpoints(v, entities) {
          const pagination = { type: 'offset', param: 'skip', sizeParam: 'limit', size: 1000, maxPages: 100 };
          const response = { format: 'json', path: 'rows', lift: 'doc', drop: ['key', 'value.rev', '_rev'] };
          const list = entities.map((e) => ({ id: 'db-' + slug(e.id), name: e.name, method: 'GET', path: '/' + e.id + '/_all_docs', params: [P('include_docs', { type: 'boolean', default: true, hidden: true })], pagination, response, dataset: { name: e.name } }));
          list.push({ id: 'db', name: t('families.generic.database'), method: 'GET', path: '/{db}/_all_docs', params: [{ name: 'db', in: 'path', type: 'string', required: true, label: t('families.param.database') }, P('include_docs', { type: 'boolean', default: true, hidden: true })], pagination, response, dataset: { name: '{db}' } });
          return list;
        },
      },
      {
        id: 'clickhouse', name: 'ClickHouse', docs: 'https://clickhouse.com/docs/interfaces/http',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'http://localhost:8123' }, { name: 'username', type: 'text' }, { name: 'password', type: 'secret' }],
        auth: (v) => (v.username ? { type: 'basic' } : { type: 'none' }),
        secrets: (v) => (v.username ? { username: v.username, password: v.password || '' } : null),
        async discover(v, connector, get) {
          const data = await get(trimUrl(v.baseUrl) + '/?query=' + encodeURIComponent('SHOW TABLES FORMAT JSON') + '&add_http_cors_header=1');
          return (data && Array.isArray(data.data) ? data.data : []).map((r) => r.name).filter(Boolean).map((name) => ({ id: name, name }));
        },
        endpoints(v, entities) {
          const hidden = [P('add_http_cors_header', { type: 'number', default: 1, hidden: true }), P('default_format', { default: 'JSON', hidden: true })];
          const ep = (id, name, sql) => ({ id, name, method: 'GET', path: '/', params: [P('query', { type: 'text', required: true, label: t('families.param.sql'), default: sql })].concat(hidden), response: { format: 'json', path: 'data' }, dataset: { name } });
          const list = entities.map((e) => ep('table-' + slug(e.id), e.name, `SELECT * FROM "${e.id}" LIMIT 100000 FORMAT JSON`));
          list.push(ep('sql', t('families.generic.sql'), 'SELECT 1 FORMAT JSON'));
          return list;
        },
      },
      {
        id: 'elasticsearch', name: 'Elasticsearch / OpenSearch', docs: 'https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-search',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://localhost:9200' }, { name: 'apiKey', type: 'secret' }],
        auth: (v) => (v.apiKey ? { type: 'apiKey', in: 'header', name: 'Authorization', prefix: 'ApiKey ' } : { type: 'none' }),
        secrets: (v) => (v.apiKey ? { apiKey: v.apiKey } : null),
        async discover(v, connector, get) {
          const data = await get(trimUrl(v.baseUrl) + '/_cat/indices?format=json&h=index');
          return (Array.isArray(data) ? data : []).map((r) => r.index).filter((n) => n && !String(n).startsWith('.')).sort().map((name) => ({ id: name, name }));
        },
        endpoints(v, entities) {
          const params = () => [P('q', { label: t('families.param.q'), example: 'kommun:Umeå' }), P('size', { type: 'number', default: 1000, hidden: true })];
          const pagination = { type: 'offset', param: 'from', sizeParam: 'size', size: 1000, maxPages: 10 };
          const response = { format: 'json', path: 'hits.hits', lift: '_source', drop: ['_score', '_ignored'] };
          const list = entities.map((e) => ({ id: 'index-' + slug(e.id), name: e.name, method: 'GET', path: '/' + e.id + '/_search', params: params(), pagination, response, dataset: { name: e.name } }));
          list.push({ id: 'index', name: t('families.generic.index'), method: 'GET', path: '/{index}/_search', params: [{ name: 'index', in: 'path', type: 'string', required: true, label: t('families.param.index') }].concat(params()), pagination, response, dataset: { name: '{index}' } });
          return list;
        },
      },
      {
        id: 'sparql', name: 'SPARQL', docs: 'https://www.w3.org/TR/sparql11-protocol/',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://query.wikidata.org/sparql' }],
        auth: () => ({ type: 'none' }),
        endpoints() {
          return [{ id: 'query', name: t('families.sparql.query'), method: 'GET', path: '', headers: { Accept: 'application/sparql-results+json' }, params: [P('query', { type: 'text', required: true, label: t('families.param.sparql'), example: 'SELECT ?item ?itemLabel WHERE { ?item wdt:P31 wd:Q127448 . SERVICE wikibase:label { bd:serviceParam wikibase:language "sv,en". } } LIMIT 100' })], response: { format: 'sparql' }, dataset: { name: 'SPARQL' } }];
        },
      },
      {
        id: 'influxdb', name: 'InfluxDB v2', docs: 'https://docs.influxdata.com/influxdb/v2/api/#operation/PostQuery',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'http://localhost:8086' }, { name: 'org', type: 'text', required: true }, { name: 'token', type: 'secret', required: true }],
        auth: () => ({ type: 'apiKey', in: 'header', name: 'Authorization', prefix: 'Token ' }),
        secrets: (v) => ({ apiKey: v.token }),
        async discover(v, connector, get) {
          const data = await get(trimUrl(v.baseUrl) + '/api/v2/buckets?org=' + encodeURIComponent(v.org || ''));
          return (data && Array.isArray(data.buckets) ? data.buckets : []).map((b) => b.name).filter((n) => n && !String(n).startsWith('_')).map((name) => ({ id: name, name }));
        },
        endpoints(v, entities) {
          const example = `from(bucket: "${entities[0] ? entities[0].id : 'bucket'}") |> range(start: -1h) |> limit(n: 1000)`;
          return [{ id: 'flux', name: t('families.influx.query'), description: entities.length ? t('families.influx.buckets', { list: entities.map((e) => e.name).join(', ') }) : '', method: 'POST', path: '/api/v2/query', bodyType: 'text', body: '{flux}', headers: { 'Content-Type': 'application/vnd.flux', Accept: 'application/csv' }, params: [P('org', { default: v.org, hidden: true }), { name: 'flux', in: 'option', type: 'text', required: true, label: t('families.param.flux'), example }], response: { format: 'influx-csv' }, dataset: { name: 'InfluxDB' } }];
        },
      },
      {
        id: 'sheets', name: 'Google Sheets', docs: 'https://support.google.com/docs/answer/183965', fixedBase: 'https://docs.google.com',
        fields: [{ name: 'sheetUrl', type: 'url', required: true, placeholder: 'https://docs.google.com/spreadsheets/d/.../edit#gid=0' }],
        auth: () => ({ type: 'none' }),
        idHint: (v) => ((/\/d\/(?:e\/)?([^/?#]+)/.exec(String(v.sheetUrl || '')) || [])[1] || 'sheet').slice(0, 24),
        endpoints(v) {
          return [{ id: 'sheet', name: t('families.sheets.sheet'), method: 'GET', path: sheetsCsvUrl(v.sheetUrl), params: [P('sheet', { label: t('families.param.sheet') })], response: { format: 'csv' }, dataset: { name: 'Google Sheets' } }];
        },
      },
      {
        id: 'airtable', name: 'Airtable', docs: 'https://airtable.com/developers/web/api/list-records', fixedBase: 'https://api.airtable.com',
        fields: [{ name: 'baseId', type: 'text', required: true, placeholder: 'appXXXXXXXXXXXXXX' }, { name: 'table', type: 'text', required: true }, { name: 'token', type: 'secret', required: true }],
        auth: () => ({ type: 'bearer' }),
        secrets: (v) => ({ token: v.token }),
        idHint: (v) => v.baseId,
        async discover(v, connector, get) {
          const data = await get('https://api.airtable.com/v0/meta/bases/' + encodeURIComponent(v.baseId) + '/tables');
          return (data && Array.isArray(data.tables) ? data.tables : []).map((tb) => ({ id: tb.name, name: tb.name }));
        },
        endpoints(v, entities) {
          const names = entities.map((e) => e.id);
          if (v.table && !names.includes(v.table)) names.unshift(v.table);
          const pagination = { type: 'cursor', param: 'offset', path: 'offset', maxPages: 200 };
          return names.map((name) => ({ id: 'table-' + slug(name), name, method: 'GET', path: '/v0/' + encodeURIComponent(v.baseId) + '/' + encodeURIComponent(name), params: [P('pageSize', { type: 'number', default: 100, hidden: true }), P('view', { label: t('families.param.view') }), P('filterByFormula', { label: t('families.param.formula'), example: '{Status} = "Klar"' })], pagination, response: { format: 'json', path: 'records', lift: 'fields' }, dataset: { name } }));
        },
      },
    ];
    const byId = (id) => FAMILIES.find((f) => f.id === id) || null;

    /** Connector skeleton for a family: id from family and host, name, address, authentication. */
    function build(fam, values) {
      const base = trimUrl(fam.fixedBase || values.baseUrl || '');
      const host = hostOf(fam.fixedBase ? (values.baseUrl || fam.fixedBase) : base) || fam.id;
      const hint = fam.idHint ? fam.idHint(values) : host;
      const authSpec = fam.auth(values);
      return {
        format: schema.FORMAT_ID, id: slug(fam.id + '-' + hint), name: String(values.name || '').trim() || `${fam.name} (${fam.idHint ? hint : host})`,
        publisher: host, description: t('families.' + fam.id + '.desc'), docs: fam.docs, level: authSpec.type === 'none' ? 1 : 2,
        baseUrl: base, auth: authSpec, endpoints: [],
      };
    }

    /** GET JSON with the connector's authentication (discovery). */
    async function getJson(connector, url, headers) {
      const req = await auth.apply(connector, { url, method: 'GET', headers: Object.assign({ Accept: 'application/json' }, headers || {}) });
      const res = await http.request(Object.assign({}, req, { retries: 0, rateKey: connector.id }));
      if (!res.ok) throw http.httpError(res, connector.name);
      try { return JSON.parse(res.text); } catch (_e) { throw new Error(t('api.err.json', { text: String(res.text || '').slice(0, 120) })); }
    }

    /**
     * Build, discover and save a connector for a family. Keys are kept in the session (api/secrets) under the
     * connector id. A failed discovery does not stop the creation: the generic endpoints remain.
     * @param {string} familyId @param {Record<string, string>} values @param {{discover?: boolean}} [options]
     * @returns {Promise<{connector: any, entities: Array<{id: string, name: string}>, discoveryError: string|null}>}
     */
    async function createConnector(familyId, values, options = {}) {
      const fam = byId(familyId);
      if (!fam) throw new Error('unknown family ' + familyId);
      const v = {};
      for (const [k, val] of Object.entries(values || {})) v[k] = typeof val === 'string' ? val.trim() : val;
      for (const f of fam.fields) {
        if (f.required && !v[f.name]) throw new Error(t('families.err.required', { field: t('families.field.' + f.name) }));
        if (v[f.name] && f.type === 'url' && !/^(https?|dataspatium-asset):\/\//i.test(v[f.name])) throw new Error(t('families.err.url', { field: t('families.field.' + f.name) }));
      }
      const connector = build(fam, v);
      const creds = fam.secrets ? fam.secrets(v) : null;
      if (creds) secrets.set(connector.id, creds);
      let entities = []; let discoveryError = null;
      if (fam.discover && options.discover !== false) {
        try { entities = (await fam.discover(v, connector, (url, headers) => getJson(connector, url, headers))) || []; }
        catch (err) { discoveryError = (err && err.message) || String(err); }
      }
      connector.endpoints = fam.endpoints(v, entities);
      const errors = schema.validate(connector);
      if (errors.length) throw new Error(errors.join('; '));
      const saved = await connectors.save(connector);
      return { connector: saved, entities, discoveryError };
    }

    return { FAMILIES, byId, build, createConnector, sheetsCsvUrl, getJson };
  });
})();
