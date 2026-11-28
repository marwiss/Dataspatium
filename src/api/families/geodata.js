// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Open geodata families: WFS (OGC Web Feature Service 2.0 with GeoJSON output), OGC API Features and ArcGIS REST
 * (FeatureServer and MapServer query). Like the database families, each knows its fields, how to discover the layers
 * of a service and how to write the endpoints of an ordinary connector, so that "Lägg till geodatakälla" in Inhämta
 * turns a service address into a connector with one endpoint per layer plus a generic one. Every endpoint answers
 * GeoJSON in WGS 84, so the datasets get a geometry column and open as maps: a WFS in the GeoJSON format its
 * capabilities name, or in GML when it offers none (F130 a: Kartverket and other INSPIRE and deegree services; read by
 * io/importers/gml, asked for in urn:ogc:def:crs:EPSG::4326 with the box in CRS84), pages no larger than the service sends.
 * Keys (for example Lantmäteriet's national geodata platform) are Bearer tokens kept in api/secrets.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/geodata', ['api/http', 'api/auth', 'api/connectors', 'api/secrets', 'api/schema', 'api/families/databases'], (http, auth, connectors, secrets, schema, databases) => {
    const t = (k, p) => D.t(k, p);
    const fullSlug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
    const slug = (s) => fullSlug(s).slice(0, 60) || 'x';
    /**
     * Endpoint ids for layers: the short slug as before, the whole name when two layers share its first 60 characters
     * (HaV, Helsingfors and Plandata.dk have such layers, and duplicate ids made the source fail), a number after that.
     */
    function endpointIds(prefix, entities) {
      const seen = new Set();
      return entities.map((e) => {
        let id = prefix + slug(e.id);
        if (seen.has(id)) id = prefix + fullSlug(e.id);
        for (let n = 2, base = id; seen.has(id); n++) id = base + '-' + n;
        seen.add(id);
        return id;
      });
    }
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    /** Query parameter with a label. */
    const P = (name, extra) => Object.assign({ name, in: 'query', type: 'string' }, extra || {});
    const bboxParam = () => P('bbox', { label: t('geodata.param.bbox'), help: t('geodata.param.bbox.help'), example: '17.5,59.2,18.5,59.5' });
    const PAGE = 1000;

    /** GET text with the connector's authentication (XML capabilities); an OGC exception report is the service's error. */
    async function getText(connector, url) {
      const req = await auth.apply(connector, { url, method: 'GET', headers: { Accept: 'application/xml, text/xml, application/json;q=0.8, */*;q=0.5' } });
      const res = await http.request(Object.assign({}, req, { retries: 0, rateKey: connector.id }));
      if (!res.ok) throw http.httpError(res, connector.name);
      const ows = http.owsError(res.text, connector.name);
      if (ows) throw ows;
      return res.text;
    }
    const xml = (text) => { const doc = new DOMParser().parseFromString(String(text), 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error(t('import.err.notxml')); return doc; };
    const byLocal = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
    const kidText = (el, name) => { const k = Array.from(el.children).find((c) => c.localName === name); return k ? String(k.textContent || '').trim() : ''; };

    /**
     * The output formats a WFS lists for GetFeature in its capabilities: the operation's own parameter, else the one for
     * all operations. Empty when the capabilities say nothing.
     */
    function wfsFormats(doc) {
      const params = (el) => Array.from(el.children).filter((c) => c.localName === 'Parameter' && /^outputformat$/i.test(c.getAttribute('name') || ''));
      const values = (p) => byLocal(p, 'Value').map((x) => String(x.textContent || '').trim()).filter(Boolean);
      const op = byLocal(doc, 'Operation').find((o) => o.getAttribute('name') === 'GetFeature');
      const own = op ? params(op).flatMap(values) : [];
      return own.length ? own : byLocal(doc, 'OperationsMetadata').flatMap(params).flatMap(values);
    }
    /** GeoJSON output names in order of preference; servers spell them differently (ArcGIS Server: GEOJSON). */
    const JSON_FORMATS = ['application/json', 'application/geo+json', 'json', 'geojson'];
    /** The GeoJSON format among a WFS's output formats, spelled as the server spells it, or null. */
    function jsonFormat(formats) {
      const lower = formats.map((f) => f.toLowerCase());
      for (const want of JSON_FORMATS) { const i = lower.indexOf(want); if (i >= 0) return formats[i]; }
      const i = lower.findIndex((f) => /^application\/(geo\+)?json\s*;/.test(f));
      return i >= 0 ? formats[i] : null;
    }
    /**
     * The GML format among a WFS's output formats, as the server spells it: GML 3.2 first (WFS 2.0's own), then 3.1.1, then
     * 2.1.2 ("text/xml; subtype=gml/3.2.1", "application/gml+xml; version=3.2", GML32, gml3, GML2), or null.
     */
    function gmlFormat(formats) {
      const gml = formats.filter((f) => /gml/i.test(f));
      for (const re of [/3\.?2/, /3\.?1|^gml3$/i, /2\.?1|^gml2$/i, /./]) { const f = gml.find((x) => re.test(x)); if (f) return f; }
      return null;
    }
    /** True for an output format that is GML (the endpoints then ask for and read GML). */
    const isGml = (format) => /gml/i.test(String(format || '')) && !/json/i.test(String(format || ''));
    /** The system a GML answer is asked for in: WGS 84 as a URN, whose axis order every server reads the same way. */
    const GML_SRS = 'urn:ogc:def:crs:EPSG::4326';
    /** The box's system in a GML request: CRS84 (longitude first), since a service's own system may be another (Kartverket). */
    const GML_BBOX_CRS = 'urn:ogc:def:crs:OGC:1.3:CRS84';
    /** The number of features a WFS sends at most per request (the constraint CountDefault), or 0 when not stated. */
    function wfsCountDefault(doc) {
      const c = byLocal(doc, 'Constraint').find((el) => el.getAttribute('name') === 'CountDefault');
      const n = c ? Number(kidText(c, 'DefaultValue')) : NaN;
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    /** A page no larger than the service sends (WFS CountDefault, ArcGIS maxRecordCount), so that paging does not stop early. */
    const pageSize = (max) => (Number(max) > 0 && Number(max) < PAGE ? Number(max) : PAGE);

    /** An ArcGIS error ({error: {code, message, details}}) as the service's message. */
    function arcgisError(data) {
      if (!(data && data.error)) return;
      const e = data.error;
      throw new Error(t('api.err.service', { message: [e.message].concat(Array.isArray(e.details) ? e.details : []).filter(Boolean).join(' ') || JSON.stringify(e) }));
    }
    /** The layers and tables of an ArcGIS service that answer a query: not group, raster or annotation layers. */
    const arcgisQueryable = (data) => (data && Array.isArray(data.layers) ? data.layers : []).concat(data && Array.isArray(data.tables) ? data.tables : [])
      .filter((l) => !(Array.isArray(l.subLayerIds) && l.subLayerIds.length) && (!l.type || /^(Feature Layer|Table)$/.test(l.type)));
    /** Run `fn` over `items`, `n` at a time, and keep the results in order. */
    async function pool(items, n, fn) {
      const out = new Array(items.length); let next = 0;
      const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
      await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
      return out;
    }
    const ARCGIS_SKIP = /(^|\/)(Utilities|System)$/i;
    const ARCGIS_SERVICES = 100;
    /**
     * The layers of an ArcGIS services directory. Many catalogues keep their services in folders and list only the folders
     * at the root (Riksantikvaren, SYKE), or an Esri sample beside them (Skogsstyrelsen): the folders are read one and two
     * levels down. Each feature or map service is then read for its queryable layers (layer 0 is often a group layer, or
     * missing), the feature service where both exist. Services beyond the first hundred keep their first layer.
     * @param {string} root the directory's address @param {any} data its description @param {(url: string) => Promise<any>} get
     */
    async function arcgisDirectory(root, data, get) {
      const top = root.replace(/(\/rest\/services)\/.*$/i, '$1');
      const prefix = root.length > top.length ? root.slice(top.length + 1) : '';
      const rel = (name) => (prefix && name.startsWith(prefix + '/') ? name.slice(prefix.length + 1) : name);
      const found = new Map();
      const add = (d) => {
        for (const s of (d && Array.isArray(d.services) ? d.services : [])) {
          if (!/^(FeatureServer|MapServer)$/.test(s.type) || /(^|\/)SampleWorldCities$/.test(s.name)) continue;
          if (!found.has(s.name) || s.type === 'FeatureServer') found.set(s.name, s);
        }
      };
      add(data);
      const under = (parent, f) => (String(f).includes('/') || !parent ? String(f) : parent + '/' + f);
      let folders = (data && Array.isArray(data.folders) ? data.folders : []).map((f) => under(prefix, f));
      for (let depth = 0; depth < 2 && folders.length; depth++) {
        const open = folders.filter((f) => !ARCGIS_SKIP.test(f));
        const read = await pool(open, 6, (f) => get(top + '/' + f + '?f=pjson').catch(() => null));
        read.forEach(add);
        folders = read.flatMap((d, i) => (d && Array.isArray(d.folders) ? d.folders.map((f) => under(open[i], f)) : []));
      }
      const services = Array.from(found.values());
      const described = await pool(services.slice(0, ARCGIS_SERVICES), 6, (s) => get(top + '/' + s.name + '/' + s.type + '?f=pjson').catch(() => null));
      const short = (s) => String(s.name).split('/').pop();
      const list = [];
      services.forEach((s, i) => {
        const d = described[i];
        if (i >= ARCGIS_SERVICES) { list.push({ id: `${rel(s.name)}/${s.type}/0`, name: short(s), abstract: s.type, service: true }); return; }
        if (!d || d.error) return;
        for (const l of arcgisQueryable(d)) list.push({ id: `${rel(s.name)}/${s.type}/${l.id}`, name: `${short(s)}: ${l.name || l.id}`, abstract: l.geometryType ? String(l.geometryType).replace(/^esriGeometry/, '') : '', pageSize: pageSize(d.maxRecordCount) });
      });
      return list;
    }

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
        fields: [{ name: 'baseUrl', type: 'url', required: true, placeholder: 'https://geodata.scb.se/geoserver/stat/wfs' }, { name: 'token', type: 'secret' }],
        auth: (v) => (v.token ? { type: 'bearer' } : { type: 'none' }),
        secrets: (v) => (v.token ? { token: v.token } : null),
        normalize: (v) => Object.assign({}, v, { baseUrl: serviceUrl(v.baseUrl) }),
        // The capabilities decide the output format (GeoJSON as the server names it) and the page size (CountDefault); both
        // are kept in `v` for the endpoints and so saved with the source.
        async discover(v, connector) {
          const doc = xml(await getText(connector, serviceUrl(v.baseUrl) + '?service=WFS&request=GetCapabilities'));
          const list = byLocal(doc, 'FeatureType').map((ft) => ({ id: kidText(ft, 'Name'), name: kidText(ft, 'Title') || kidText(ft, 'Name'), abstract: kidText(ft, 'Abstract') }));
          if (!list.length) throw new Error(t('geodata.err.nolayers'));
          const formats = wfsFormats(doc);
          const json = jsonFormat(formats);
          const gml = json ? null : gmlFormat(formats);
          if (formats.length && !json && !gml) throw new Error(t('geodata.err.nojson', { formats: formats.slice(0, 6).join(', ') }));
          v.outputFormat = json || gml || 'application/json';
          v.pageSize = pageSize(wfsCountDefault(doc));
          return list.filter((e) => e.id);
        },
        endpoints(v, entities) {
          // GML: asked for in WGS 84 as a URN and read in its axis order, the box typed in WGS 84 and sent with its system.
          const gml = isGml(v.outputFormat);
          const fixed = [P('service', { default: 'WFS', hidden: true }), P('version', { default: '2.0.0', hidden: true }), P('request', { default: 'GetFeature', hidden: true }), P('outputFormat', { default: v.outputFormat || 'application/json', hidden: true }), P('srsName', { default: gml ? GML_SRS : 'EPSG:4326', hidden: true })];
          const box = () => (gml ? Object.assign(bboxParam(), { type: 'bbox', bboxCrs: GML_BBOX_CRS }) : bboxParam());
          const common = () => [box(), P('CQL_FILTER', { label: t('geodata.param.cql'), help: t('geodata.param.cql.help'), example: "kommunkod = '0180'" }), P('propertyName', { label: t('geodata.param.properties'), help: t('geodata.param.properties.help') })];
          const pagination = { type: 'offset', param: 'startIndex', sizeParam: 'count', size: v.pageSize || PAGE, totalPath: 'numberMatched', maxPages: 200 };
          // A GML answer whose geometries name no system is in the one asked for.
          const response = gml ? { format: 'gml', options: { srsName: GML_SRS } } : { format: 'geojson' };
          const ids = endpointIds('layer-', entities);
          const list = entities.map((e, i) => ({ id: ids[i], name: e.name, description: e.abstract || '', method: 'GET', path: '', params: fixed.concat([P('typeNames', { default: e.id, hidden: true })], common()), pagination, response, dataset: { name: e.name } }));
          list.push({ id: 'layer', name: t('geodata.generic.layer'), method: 'GET', path: '', params: fixed.concat([P('typeNames', { required: true, label: t('geodata.param.layer') })], common()), pagination, response, dataset: { name: '{typeNames}' } });
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
          const ids = endpointIds('collection-', entities);
          const list = entities.map((e, i) => ({ id: ids[i], name: e.name, description: e.abstract || '', method: 'GET', path: '/collections/' + encodeURIComponent(e.id) + '/items', params: common(), pagination, response: { format: 'geojson' }, dataset: { name: e.name } }));
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
          arcgisError(data);
          if (/\/(FeatureServer|MapServer)$/i.test(root) || (data && Array.isArray(data.layers))) {
            const layers = arcgisQueryable(data);
            if (!layers.length) throw new Error(t('geodata.err.nolayers'));
            const size = pageSize(data && data.maxRecordCount);
            return layers.map((l) => ({ id: String(l.id), name: l.name || String(l.id), abstract: l.geometryType ? String(l.geometryType).replace(/^esriGeometry/, '') : '', pageSize: size }));
          }
          const list = await arcgisDirectory(root, data, get);
          if (!list.length) throw new Error(t('geodata.err.nolayers'));
          return list;
        },
        endpoints(v, entities) {
          const common = (size) => [P('where', { label: t('geodata.param.where'), default: '1=1', help: t('geodata.param.where.help') }), P('outFields', { default: '*', hidden: true }), P('outSR', { default: '4326', hidden: true }), P('f', { default: 'geojson', hidden: true }), P('returnGeometry', { default: 'true', hidden: true }), P('resultRecordCount', { type: 'number', default: size, hidden: true }),
            P('geometry', { label: t('geodata.param.bbox'), help: t('geodata.param.bbox.help'), example: '17.5,59.2,18.5,59.5' }), P('geometryType', { default: 'esriGeometryEnvelope', hidden: true }), P('inSR', { default: '4326', hidden: true })];
          // A page too heavy for the server (large polygons: 500 at a thousand features) is asked for again smaller.
          const pagination = (size) => ({ type: 'offset', param: 'resultOffset', sizeParam: 'resultRecordCount', size, maxPages: 200, shrink: true });
          // An answer that is an ArcGIS error ({error: {message, details}}) is reported, not read as an empty layer.
          const response = { format: 'geojson', errorPath: 'error' };
          const ids = endpointIds('layer-', entities);
          const list = entities.map((e, i) => ({ id: ids[i], name: e.name, description: e.abstract || '', method: 'GET', path: '/' + e.id + '/query', params: common(e.pageSize || PAGE), pagination: pagination(e.pageSize || PAGE), response, dataset: { name: e.name } }));
          // In a directory the layer is a path (Mapp/Tjanst/MapServer/3), so its slashes are kept.
          list.push({ id: 'layer', name: t('geodata.generic.layer'), method: 'GET', path: '/{layer}/query', params: [{ name: 'layer', in: 'path', type: 'string', required: true, raw: true, label: t('geodata.param.layerid'), default: '0' }].concat(common(PAGE)), pagination: pagination(PAGE), response, dataset: { name: t('geodata.generic.layer') + ' {layer}' } });
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

    return { FAMILIES, byId, createConnector, refresh, layerEndpoints, genericEndpoint, familyForLink, serviceUrl, arcgisRoot, getText, jsonFormat, gmlFormat };
  });
})();
