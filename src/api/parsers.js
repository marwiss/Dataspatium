// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Response parsers: turn an API response body into {columns, rows}. Formats: json (records at a path,
 * optionally exploding a nested array), jsonstat, sdmx (SDMX-JSON 1.0 and 2.0), csv, geojson, xml (repeated element), entryscape
 * (Sveriges dataportal search) and text. Post-processing shared by all formats: constants from the
 * root document, rename, convert (epoch timestamps) and drop.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/parsers', ['io/importers/json', 'io/importers/csv', 'api/jsonstat', 'api/sdmx', 'data/types'], (jsonImp, csv, jsonstat, sdmx, types) => {
    function resolvePath(data, path) {
      if (!path) return data;
      // A key that itself contains dots (OData's "@odata.nextLink") is tried whole before the path is split.
      if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, path)) return data[path];
      let node = data;
      for (const part of String(path).split('.').filter(Boolean)) {
        if (node === null || node === undefined) return undefined;
        node = node[part];
      }
      return node;
    }

    function omit(obj, key) { const out = {}; for (const [k, v] of Object.entries(obj)) if (k !== key) out[k] = v; return out; }

    /** Records with a nested array exploded into one record per item. */
    function explode(records, key) {
      const out = [];
      for (const r of records) {
        const items = r && typeof r === 'object' ? r[key] : null;
        if (Array.isArray(items) && items.length) for (const it of items) out.push(Object.assign(omit(r, key), it && typeof it === 'object' && !Array.isArray(it) ? it : { [key]: it }));
        else out.push(omit(r || {}, key));
      }
      return out;
    }

    function jsonRecords(data, spec) {
      let records = spec.path ? resolvePath(data, spec.path) : jsonImp.toRecords(data, '');
      if (records && !Array.isArray(records) && typeof records === 'object') records = jsonImp.toRecords(records, '');
      if (!Array.isArray(records)) records = records === undefined || records === null ? [] : [records];
      if (spec.explode) records = explode(records, spec.explode);
      if (spec.lift) records = lift(records, spec.lift);
      return records;
    }

    function geojsonRecords(data, options = {}) {
      const features = data && Array.isArray(data.features) ? data.features : (Array.isArray(data) ? data : (data && data.type === 'Feature' ? [data] : []));
      const keepGeometry = options.geometry !== false && options.geometry !== 'false';
      return features.map((f) => {
        const rec = Object.assign({}, f.id !== undefined ? { id: f.id } : {}, f.properties || {});
        if (f.bbox) rec.bbox = JSON.stringify(f.bbox);
        if (f.assets) for (const [k, a] of Object.entries(f.assets)) rec['asset_' + k] = a && a.href ? a.href : JSON.stringify(a);
        if (keepGeometry) { rec.geometri_typ = f.geometry ? f.geometry.type : null; rec.geometri = f.geometry ? JSON.stringify(f.geometry) : null; }
        else if (f.geometry && f.geometry.type === 'Point' && Array.isArray(f.geometry.coordinates)) { rec.longitud = f.geometry.coordinates[0]; rec.latitud = f.geometry.coordinates[1]; }
        return rec;
      });
    }

    function xmlRecords(text, spec) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const error = doc.querySelector('parsererror');
      if (error) throw new Error(D.t('api.err.xml'));
      const tag = spec.recordTag || '';
      const nodes = tag ? Array.from(doc.getElementsByTagNameNS('*', tag)) : Array.from(doc.documentElement.children);
      const flattenEl = (el, prefix, out) => {
        for (const a of Array.from(el.attributes || [])) out[(prefix ? prefix + '.' : '') + '@' + a.name] = a.value;
        const kids = Array.from(el.children);
        if (!kids.length) { out[prefix || el.localName] = el.textContent; return out; }
        for (const k of kids) flattenEl(k, (prefix ? prefix + '.' : '') + k.localName, out);
        return out;
      };
      return nodes.map((n) => flattenEl(n, '', {}));
    }

    const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const DCAT = 'http://www.w3.org/ns/dcat#';
    const DCT = 'http://purl.org/dc/terms/';
    const FOAF = 'http://xmlns.com/foaf/0.1/';
    function literal(objs, lang) {
      if (!Array.isArray(objs) || !objs.length) return null;
      const byLang = lang ? objs.find((o) => o.lang === lang) : null;
      return (byLang || objs.find((o) => o.type === 'literal') || objs[0]).value;
    }
    /** Sveriges dataportal (EntryScape search): one row per dataset with title, publisher, formats, links. */
    function entryscapeRecords(data) {
      const children = (data && data.resource && data.resource.children) || [];
      return children.map((child) => {
        const graph = child.metadata || {};
        // The dataset node; a search without a type filter may return distributions, so fall back to any titled node.
        const [subject, preds] = Object.entries(graph).find(([, p]) => (p[RDF_TYPE] || []).some((o) => o.value === DCAT + 'Dataset'))
          || Object.entries(graph).find(([, p]) => p[DCT + 'title']) || [null, {}];
        const nameOf = (uri) => { const node = graph[uri]; return node ? literal(node[FOAF + 'name'], 'sv') : null; };
        const publisherUri = preds[DCT + 'publisher'] && preds[DCT + 'publisher'][0] ? preds[DCT + 'publisher'][0].value : null;
        const dists = (preds[DCAT + 'distribution'] || []).map((o) => graph[o.value] || {});
        const formats = Array.from(new Set(dists.map((d) => literal(d[DCT + 'format']) || literal(d[DCAT + 'mediaType'])).filter(Boolean)));
        const download = dists.map((d) => (d[DCAT + 'downloadURL'] && d[DCAT + 'downloadURL'][0]) || (d[DCAT + 'accessURL'] && d[DCAT + 'accessURL'][0])).filter(Boolean).map((o) => o.value)[0] || null;
        return {
          titel: literal(preds[DCT + 'title'], 'sv'),
          utgivare: publisherUri ? (nameOf(publisherUri) || publisherUri) : null,
          beskrivning: (literal(preds[DCT + 'description'], 'sv') || '').slice(0, 500) || null,
          nyckelord: (preds[DCAT + 'keyword'] || []).map((o) => o.value).join(', ') || null,
          format: formats.join(', ') || null,
          distributioner: dists.length,
          nedladdning: download,
          licens: preds[DCT + 'license'] && preds[DCT + 'license'][0] ? preds[DCT + 'license'][0].value : null,
          uppdaterad: literal(preds[DCT + 'modified']) || literal(preds[DCT + 'issued']) || null,
          sida: child.contextId && child.entryId ? `https://www.dataportal.se/datasets/${child.contextId}_${child.entryId}` : null,
          identifierare: subject,
        };
      });
    }

    function epochToIso(v, unit) {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return v;
      return types.parseDateTime(new Date(unit === 'epoch-s' ? n * 1000 : n));
    }

    /** Apply constants, rename, convert and drop to a table in place. */
    /** Records with the fields of a nested object merged into the record (CouchDB doc, Elasticsearch _source, Airtable fields). */
    function lift(records, key) {
      return records.map((r) => {
        const inner = r && typeof r === 'object' ? r[key] : null;
        return inner && typeof inner === 'object' && !Array.isArray(inner) ? Object.assign(omit(r, key), inner) : omit(r || {}, key);
      });
    }
    /** The first list under `data` in a GraphQL response (directly, or a connection's nodes/edges/items), as a path. */
    function graphqlPath(data) {
      const root = data && data.data;
      if (!root || typeof root !== 'object') return 'data';
      for (const [k, v] of Object.entries(root)) {
        if (Array.isArray(v)) return 'data.' + k;
        if (v && typeof v === 'object') for (const sub of ['nodes', 'edges', 'items']) if (Array.isArray(v[sub])) return 'data.' + k + '.' + sub;
      }
      return 'data';
    }
    /** SPARQL JSON results: one column per variable, the plain values (URIs and literals as text). */
    function sparqlTable(data) {
      const vars = data && data.head && Array.isArray(data.head.vars) ? data.head.vars : [];
      const bindings = data && data.results && Array.isArray(data.results.bindings) ? data.results.bindings : [];
      return { columns: vars.slice(), rows: bindings.map((b) => vars.map((v) => (b && b[v] && b[v].value !== undefined ? b[v].value : null))) };
    }
    /** One CSV line (RFC 4180 quoting, comma) to cells. */
    function csvLine(line) {
      const out = []; let cur = ''; let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += ch; }
        else if (ch === '"') quoted = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    }
    /** InfluxDB annotated CSV: annotation lines (#...) dropped, each table's header read, the leading annotation column removed, all tables stacked. */
    function influxTable(text) {
      const records = []; let header = null;
      for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
        if (!raw.trim()) { header = null; continue; }
        if (raw.startsWith('#')) continue;
        const cells = csvLine(raw);
        if (!header) { header = cells; continue; }
        const rec = {};
        header.forEach((name, i) => { if (name !== '') rec[name] = cells[i] === undefined || cells[i] === '' ? null : cells[i]; });
        records.push(rec);
      }
      return jsonImp.tabulate(records);
    }

    function postProcess(table, spec, root) {
      if (spec.constants) {
        const names = Object.keys(spec.constants);
        const values = names.map((n) => { const v = resolvePath(root, spec.constants[n]); return v && typeof v === 'object' ? JSON.stringify(v) : (v === undefined ? null : v); });
        table.columns = names.concat(table.columns);
        table.rows = table.rows.map((r) => values.concat(r));
      }
      if (spec.convert) {
        for (const [col, how] of Object.entries(spec.convert)) {
          const i = table.columns.indexOf(col);
          if (i < 0) continue;
          for (const r of table.rows) r[i] = how === 'epoch-ms' || how === 'epoch-s' ? epochToIso(r[i], how) : (how === 'number' ? types.parseNumber(String(r[i]), 'point') : r[i]);
        }
      }
      if (spec.rename) table.columns = table.columns.map((c) => (spec.rename[c] !== undefined ? spec.rename[c] : c));
      if (spec.drop && spec.drop.length) {
        const keep = table.columns.map((c, i) => (spec.drop.includes(c) ? -1 : i)).filter((i) => i >= 0);
        table.columns = keep.map((i) => table.columns[i]);
        table.rows = table.rows.map((r) => keep.map((i) => r[i]));
      }
      return table;
    }

    /**
     * Parse a response body.
     * @param {string} text
     * @param {{format?: string, path?: string, explode?: string, constants?: any, rename?: any, convert?: any, drop?: string[], recordTag?: string, options?: any}} [spec]
     * @param {{options?: Record<string, any>}} [ctx] runtime options (from params with in: "option")
     * @returns {Promise<{columns: string[], rows: any[][], data: any, types?: Record<string, string>, meta?: any}>}
     */
    async function parse(text, spec = {}, ctx = {}) {
      const format = spec.format || 'json';
      const options = Object.assign({}, spec.options || {}, ctx.options || {});
      let data = null;
      let table;
      const parseJson = () => { try { return jsonImp.parseJsonText(text); } catch (err) { throw new Error(D.t('api.err.json', { text: String(text || '').slice(0, 120) })); } };
      if (format === 'json') { data = parseJson(); table = jsonImp.tabulate(jsonRecords(data, spec)); }
      else if (format === 'jsonstat') { data = parseJson(); const t = jsonstat.toTable(data, options); table = { columns: t.columns, rows: t.rows, types: t.types, meta: t.meta }; }
      else if (format === 'sdmx') { data = parseJson(); const t = sdmx.toTable(data, options); table = { columns: t.columns, rows: t.rows, types: t.types, meta: t.meta }; }
      else if (format === 'geojson') { data = parseJson(); table = jsonImp.tabulate(geojsonRecords(spec.path ? resolvePath(data, spec.path) : data, options)); }
      else if (format === 'csv') {
        let body = text;
        if (options.skipUntil) { const i = body.indexOf(options.skipUntil); if (i > 0) body = body.slice(i); }
        const parsed = await csv.parseText(body, { delimiter: options.delimiter || 'auto', header: options.header === undefined ? true : options.header, decimal: options.decimal });
        table = { columns: parsed.columns, rows: parsed.rows };
      }
      else if (format === 'xml') { table = jsonImp.tabulate(xmlRecords(text, spec)); }
      else if (format === 'graphql') {
        data = parseJson();
        if (data && Array.isArray(data.errors) && data.errors.length) throw new Error(D.t('api.err.graphql', { message: data.errors.map((e) => e && e.message).filter(Boolean).join('; ') }));
        table = jsonImp.tabulate(jsonRecords(data, Object.assign({}, spec, { path: spec.path || graphqlPath(data) })));
      }
      else if (format === 'sparql') { data = parseJson(); table = sparqlTable(data); }
      else if (format === 'influx-csv') { table = influxTable(text); }
      else if (format === 'entryscape') { data = parseJson(); table = jsonImp.tabulate(entryscapeRecords(data)); table.meta = { total: data.results }; }
      else if (format === 'geonetwork') { data = parseJson(); table = jsonImp.tabulate(geonetworkRecords(data)); table.meta = { total: data && data.hits && data.hits.total ? (typeof data.hits.total === 'object' ? data.hits.total.value : data.hits.total) : undefined }; }
      else { table = { columns: ['text'], rows: [[text]] }; }
      postProcess(table, spec, data);
      return Object.assign({ data, types: {}, meta: {} }, table);
    }

    /**
     * GeoNetwork 4 catalogue search (Elasticsearch hits, as Geodataportalen answers): one row per metadata record with
     * title, abstract, organisation and the service links sorted by protocol (WFS, OGC API Features, ArcGIS, WMS).
     */
    function geonetworkRecords(data) {
      const hits = data && data.hits && Array.isArray(data.hits.hits) ? data.hits.hits : [];
      const text = (o) => (o && typeof o === 'object' ? (o.default || o.langswe || o.langeng || Object.values(o).find((v) => typeof v === 'string') || null) : (typeof o === 'string' ? o : null));
      const linkUrl = (l) => (l && (text(l.urlObject) || l.url || null));
      const pick = (links, re) => { const l = links.find((x) => re.test(String(x.protocol || '')) || re.test(String(linkUrl(x) || ''))); return l ? linkUrl(l) : null; };
      return hits.map((hit) => {
        const s = hit._source || {};
        const links = Array.isArray(s.link) ? s.link : [];
        const org = text(s.OrgForResourceObject) || (Array.isArray(s.OrgForResource) ? s.OrgForResource[0] : null) || (Array.isArray(s.contact) && s.contact[0] ? text(s.contact[0].organisationObject) || s.contact[0].organisation : null);
        return {
          id: hit._id || s.id || null,
          titel: text(s.resourceTitleObject),
          beskrivning: text(s.resourceAbstractObject),
          organisation: org || null,
          typ: Array.isArray(s.resourceType) ? s.resourceType.join(', ') : (s.resourceType || null),
          wfs: pick(links, /WFS|service=WFS/i),
          ogc_api: pick(links, /API-Features|OGC:API|\/collections(\/|$)/i),
          arcgis: pick(links, /ESRI|ARCGIS|\/(FeatureServer|MapServer)(\/|$|\?)/i),
          wms: pick(links, /WMS|service=WMS/i),
          nedladdning: pick(links, /DOWNLOAD|nedladdning|\.zip$|\.gpkg$|\.geojson$/i),
          lankar: links.length ? JSON.stringify(links.map((l) => ({ protocol: l.protocol || null, url: linkUrl(l), name: text(l.nameObject) || l.name || null }))) : null,
          metadata: hit._id ? 'https://www.geodata.se/geodataportalen/srv/swe/catalog.search#/metadata/' + hit._id : null,
        };
      });
    }

    return { parse, resolvePath, explode, lift, jsonRecords, geojsonRecords, xmlRecords, entryscapeRecords, geonetworkRecords, postProcess, epochToIso, graphqlPath, sparqlTable, influxTable };
  });
})();
