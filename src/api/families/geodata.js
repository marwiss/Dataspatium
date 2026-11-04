// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Open geodata families: WFS (OGC Web Feature Service 2.0 with GeoJSON output), OGC API Features and ArcGIS REST
 * (FeatureServer and MapServer query). Like the database families, each knows its fields, how to discover the layers
 * of a service and how to write the endpoints of an ordinary connector, so that "Lägg till geodatakälla" in Inhämta
 * turns a service address into a connector with one endpoint per layer plus a generic one. Every endpoint answers
 * GeoJSON in WGS 84, so the datasets get a geometry column and open as maps. Keys (for example Lantmäteriet's
 * national geodata platform) are Bearer tokens kept in api/secrets.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/geodata', ['api/http', 'api/auth', 'api/connectors', 'api/secrets', 'api/schema', 'api/families/databases'], (http, auth, connectors, secrets, schema, databases) => {
    const t = (k, p) => D.t(k, p);
    const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    /** Query parameter with a label. */
    const P = (name, extra) => Object.assign({ name, in: 'query', type: 'string' }, extra || {});
    const bboxParam = () => P('bbox', { label: t('geodata.param.bbox'), help: t('geodata.param.bbox.help'), example: '17.5,59.2,18.5,59.5' });
    const PAGE = 1000;

    /** GET text with the connector's authentication (XML capabilities). */
    async function getText(connector, url) {
      const req = await auth.apply(connector, { url, method: 'GET', headers: { Accept: 'application/xml, text/xml, application/json;q=0.8, */*;q=0.5' } });
      const res = await http.request(Object.assign({}, req, { retries: 0, rateKey: connector.id }));
      if (!res.ok) throw http.httpError(res, connector.name);
      return res.text;
    }
    const xml = (text) => { const doc = new DOMParser().parseFromString(String(text), 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error(t('import.err.notxml')); return doc; };
    const byLocal = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
    const kidText = (el, name) => { const k = Array.from(el.children).find((c) => c.localName === name); return k ? String(k.textContent || '').trim() : ''; };

    /** The service address without its query string (GetCapabilities links are often pasted whole). */
    function serviceUrl(input) {
      const s = String(input || '').trim();
      try { const u = new URL(s); u.search = ''; u.hash = ''; return trimUrl(u.toString()); } catch (_e) { return trimUrl(s.split('?')[0]); }
    }
    /**
     * Host and path of a service address as an id part and a label. One host often serves several services (GeoServer
     * workspaces, Geonorge's wfs.* paths), so the path tells them apart; a bare /geoserver/wfs or /ows adds nothing.
     */
    function serviceLabel(url) {
      let u = null;
      try { u = new URL(String(url)); } catch (_e) { return { id: String(url), label: String(url) }; }
      const path = u.pathname.replace(/\/+$/, '');
      const plain = path === '' || /^(\/geoserver)?\/(wfs|ows|wms)$/i.test(path) || /^\/arcgis\/rest\/services$/i.test(path);
      return { id: `${u.host}-${path}`, label: plain ? u.host : u.host + path };
    }
    /** A pasted ArcGIS URL: the FeatureServer/MapServer root, also when a layer or /query was pasted. */
    function arcgisRoot(input) {
      const s = serviceUrl(input);
      const m = /^(.*\/(?:FeatureServer|MapServer))(?:\/\d+)?(?:\/query)?$/i.exec(s);
      return m ? m[1] : s;
    }

    /** @type {Array<any>} */
    const FAMILIES = [
      {
        id: 'wfs', name: 'WFS (OGC Web Feature Service)', docs: 'https://www.ogc.org/standards/wfs',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://geodata.scb.se/geoserver/wfs' }, { name: 'token', type: 'secret' }],
        auth: (v) => (v.token ? { type: 'bearer' } : { type: 'none' }),
        secrets: (v) => (v.token ? { token: v.token } : null),
        normalize: (v) => Object.assign({}, v, { baseUrl: serviceUrl(v.baseUrl) }),
        async discover(v, connector) {
          const doc = xml(await getText(connector, serviceUrl(v.baseUrl) + '?service=WFS&request=GetCapabilities'));
          const list = byLocal(doc, 'FeatureType').map((ft) => ({ id: kidText(ft, 'Name'), name: kidText(ft, 'Title') || kidText(ft, 'Name'), abstract: kidText(ft, 'Abstract') }));
          if (!list.length) throw new Error(t('geodata.err.nolayers'));
          return list.filter((e) => e.id);
        },
        endpoints(v, entities) {
          const fixed = [P('service', { default: 'WFS', hidden: true }), P('version', { default: '2.0.0', hidden: true }), P('request', { default: 'GetFeature', hidden: true }), P('outputFormat', { default: 'application/json', hidden: true }), P('srsName', { default: 'EPSG:4326', hidden: true })];
          const common = () => [bboxParam(), P('CQL_FILTER', { label: t('geodata.param.cql'), help: t('geodata.param.cql.help'), example: "kommunkod = '0180'" }), P('propertyName', { label: t('geodata.param.properties'), help: t('geodata.param.properties.help') })];
          const pagination = { type: 'offset', param: 'startIndex', sizeParam: 'count', size: PAGE, totalPath: 'numberMatched', maxPages: 200 };
          const list = entities.map((e) => ({ id: 'layer-' + slug(e.id), name: e.name, description: e.abstract || '', method: 'GET', path: '', params: fixed.concat([P('typeNames', { default: e.id, hidden: true })], common()), pagination, response: { format: 'geojson' }, dataset: { name: e.name } }));
          list.push({ id: 'layer', name: t('geodata.generic.layer'), method: 'GET', path: '', params: fixed.concat([P('typeNames', { required: true, label: t('geodata.param.layer') })], common()), pagination, response: { format: 'geojson' }, dataset: { name: '{typeNames}' } });
          return list;
        },
      },
      {
        id: 'ogcapi', name: 'OGC API Features', docs: 'https://ogcapi.ogc.org/features/',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://api.lantmateriet.se/distribution/geodatakatalog/sokning/v1/detaljplan/v2' }, { name: 'token', type: 'secret' }],
        auth: (v) => (v.token ? { type: 'bearer' } : { type: 'none' }),
        secrets: (v) => (v.token ? { token: v.token } : null),
        normalize: (v) => Object.assign({}, v, { baseUrl: trimUrl(String(v.baseUrl || '').replace(/\/collections(\/.*)?$/i, '')) }),
        async discover(v, connector, get) {
          const data = await get(trimUrl(v.baseUrl) + '/collections?f=json');
          const list = (data && Array.isArray(data.collections) ? data.collections : []).map((c) => ({ id: c.id, name: c.title || c.id, abstract: c.description || '' }));
          if (!list.length) throw new Error(t('geodata.err.nolayers'));
          return list;
        },
        endpoints(v, entities) {
          const common = () => [P('f', { default: 'json', hidden: true }), P('limit', { type: 'number', default: PAGE, hidden: true }), bboxParam(), P('datetime', { label: t('geodata.param.datetime'), help: t('geodata.param.datetime.help'), example: '2024-01-01T00:00:00Z/..' }), P('filter', { label: t('geodata.param.filter'), help: t('geodata.param.filter.help') })];
          const pagination = { type: 'link-rel', path: 'links', rel: 'next', maxPages: 200 };
          const list = entities.map((e) => ({ id: 'collection-' + slug(e.id), name: e.name, description: e.abstract || '', method: 'GET', path: '/collections/' + encodeURIComponent(e.id) + '/items', params: common(), pagination, response: { format: 'geojson' }, dataset: { name: e.name } }));
          list.push({ id: 'collection', name: t('geodata.generic.collection'), method: 'GET', path: '/collections/{collection}/items', params: [{ name: 'collection', in: 'path', type: 'string', required: true, label: t('geodata.param.collection') }].concat(common()), pagination, response: { format: 'geojson' }, dataset: { name: '{collection}' } });
          return list;
        },
      },
      {
        id: 'arcgis', name: 'ArcGIS REST (FeatureServer, MapServer)', docs: 'https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/',
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://server.exempel.se/arcgis/rest/services/Mapp/Tjanst/FeatureServer' }, { name: 'token', type: 'secret' }],
        auth: (v) => (v.token ? { type: 'apiKey', in: 'query', name: 'token' } : { type: 'none' }),
        secrets: (v) => (v.token ? { apiKey: v.token } : null),
        normalize: (v) => Object.assign({}, v, { baseUrl: arcgisRoot(v.baseUrl) }),
        async discover(v, connector, get) {
          const root = arcgisRoot(v.baseUrl);
          const data = await get(root + '?f=pjson');
          if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
          const layers = (data && Array.isArray(data.layers) ? data.layers : []).concat(data && Array.isArray(data.tables) ? data.tables : []);
          if (layers.length) return layers.map((l) => ({ id: String(l.id), name: l.name || String(l.id), abstract: l.geometryType ? String(l.geometryType).replace(/^esriGeometry/, '') : '' }));
          // A services directory: every feature or map service becomes an entity with its first layer.
          const services = (data && Array.isArray(data.services) ? data.services : []).filter((s) => /^(FeatureServer|MapServer)$/.test(s.type));
          if (services.length) return services.map((s) => ({ id: `${String(s.name).split('/').pop()}/${s.type}/0`, name: String(s.name).split('/').pop(), abstract: s.type, service: true }));
          throw new Error(t('geodata.err.nolayers'));
        },
        endpoints(v, entities) {
          const common = () => [P('where', { label: t('geodata.param.where'), default: '1=1', help: t('geodata.param.where.help') }), P('outFields', { default: '*', hidden: true }), P('outSR', { default: '4326', hidden: true }), P('f', { default: 'geojson', hidden: true }), P('returnGeometry', { default: 'true', hidden: true }), P('resultRecordCount', { type: 'number', default: PAGE, hidden: true }),
            P('geometry', { label: t('geodata.param.bbox'), help: t('geodata.param.bbox.help'), example: '17.5,59.2,18.5,59.5' }), P('geometryType', { default: 'esriGeometryEnvelope', hidden: true }), P('inSR', { default: '4326', hidden: true })];
          const pagination = { type: 'offset', param: 'resultOffset', sizeParam: 'resultRecordCount', size: PAGE, maxPages: 200 };
          const list = entities.map((e) => ({ id: 'layer-' + slug(e.id), name: e.name, description: e.abstract || '', method: 'GET', path: '/' + e.id + '/query', params: common(), pagination, response: { format: 'geojson' }, dataset: { name: e.name } }));
          list.push({ id: 'layer', name: t('geodata.generic.layer'), method: 'GET', path: '/{layer}/query', params: [{ name: 'layer', in: 'path', type: 'string', required: true, label: t('geodata.param.layerid'), default: '0' }].concat(common()), pagination, response: { format: 'geojson' }, dataset: { name: t('geodata.generic.layer') + ' {layer}' } });
          return list;
        },
      },
    ];
    const byId = (id) => FAMILIES.find((f) => f.id === id) || null;

    /** Family id from a catalogue link's protocol or URL, or null when the service is not a data service. */
    function familyForLink(protocol, url) {
      const p = String(protocol || '').toUpperCase(); const u = String(url || '');
      if (/API-FEATURES|OGC:API|OAPIF/.test(p) || /\/collections(\/|$)/i.test(u)) return 'ogcapi';
      if (/WFS/.test(p) || /service=WFS/i.test(u)) return 'wfs';
      if (/ESRI|ARCGIS/.test(p) || /\/(FeatureServer|MapServer)(\/|$|\?)/i.test(u)) return 'arcgis';
      if (/WMS|WMTS/.test(p) || /service=WMS/i.test(u)) return 'wms';
      return null;
    }

    /**
     * Build, discover and save a geodata connector (same contract as api/families/databases.createConnector).
     * @param {string} familyId @param {Record<string, string>} values @param {{discover?: boolean}} [options]
     */
    async function createConnector(familyId, values, options = {}) {
      const fam = byId(familyId);
      if (!fam) throw new Error('unknown family ' + familyId);
      let v = {};
      for (const [k, val] of Object.entries(values || {})) v[k] = typeof val === 'string' ? val.trim() : val;
      for (const f of fam.fields) {
        if (f.required && !v[f.name]) throw new Error(t('families.err.required', { field: t('families.field.' + f.name) }));
        if (v[f.name] && f.type === 'url' && !/^(https?|dataspatium-asset):\/\//i.test(v[f.name])) throw new Error(t('families.err.url', { field: t('families.field.' + f.name) }));
      }
      if (fam.normalize) v = fam.normalize(v);
      const connector = databases.build(fam, v);
      // Id and name from host and path (the same service added twice replaces itself); the family marks the connector
      // for the layer browser in Inhämta and for refresh().
      const where = serviceLabel(v.baseUrl);
      connector.id = slug(`${fam.id}-${where.id}`);
      if (!String(v.name || '').trim()) connector.name = `${where.label} (${t('geodata.badge.' + fam.id)})`;
      connector.family = { type: 'geodata', kind: fam.id };
      const creds = fam.secrets ? fam.secrets(v) : null;
      if (creds) secrets.set(connector.id, creds);
      let entities = []; let discoveryError = null;
      if (fam.discover && options.discover !== false) {
        try { entities = (await fam.discover(v, connector, (url, headers) => databases.getJson(connector, url, headers))) || []; }
        catch (err) { discoveryError = (err && err.message) || String(err); }
      }
      connector.endpoints = fam.endpoints(v, entities);
      const errors = schema.validate(connector);
      if (errors.length) throw new Error(errors.join('; '));
      const saved = await connectors.save(connector);
      return { connector: saved, entities, discoveryError };
    }

    /** The layer endpoints of a geodata connector (the generic one excluded). */
    const layerEndpoints = (connector) => (connector.endpoints || []).filter((e) => /^(layer|collection)-/.test(String(e.id)));
    /** The generic endpoint (any layer or collection by name), or null. */
    const genericEndpoint = (connector) => (connector.endpoints || []).find((e) => e.id === 'layer' || e.id === 'collection') || null;

    /**
     * Read the layers of a saved geodata connector again (presets ship without layers) and rewrite its endpoints; the
     * connector is saved as the user's copy. Returns the entities found; throws when the service cannot be read.
     * @param {any} connector a connector with `family: {type: 'geodata', kind}`
     */
    async function refresh(connector) {
      const kind = connector.family && connector.family.kind;
      const fam = byId(kind);
      if (!fam) throw new Error('not a geodata connector: ' + connector.id);
      const v = fam.normalize ? fam.normalize({ baseUrl: connector.baseUrl }) : { baseUrl: connector.baseUrl };
      const entities = (await fam.discover(v, connector, (url, headers) => databases.getJson(connector, url, headers))) || [];
      connector.endpoints = fam.endpoints(v, entities);
      const errors = schema.validate(connector);
      if (errors.length) throw new Error(errors.join('; '));
      const saved = await connectors.save(connector);
      return { connector: saved, entities };
    }

    return { FAMILIES, byId, createConnector, refresh, layerEndpoints, genericEndpoint, familyForLink, serviceUrl, arcgisRoot, getText };
  });
})();
