// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Neo4j as a source: Bolt over WebSocket with Neo4j's lite driver (vendored, Apache-2.0, loaded on first use) to
 * Neo4j Aura or an own server. The connector (family {type: 'neo4j'}) keeps the address and database name; the
 * user name and password live in api/secrets. A Cypher query runs after consent for the purpose "neo4j"; the records
 * come back as a table (nodes and relationships flattened to their properties) and, when the result holds nodes and
 * relationships, as a graph for a graph dataset. The family joins the "Lägg till databaskälla" dialog.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/neo4j', ['api/families/databases', 'api/secrets', 'platform/consent', 'data/graph'], (databases, secrets, consent, graph) => {
    const t = (k, p) => D.t(k, p);
    const VENDOR = 'vendor/neo4j-driver-lite/neo4j-lite-web.min.js';
    let loading = null;
    /** Load the driver (global `neo4j`). */
    function ensureDriver() {
      if (globalThis.neo4j && globalThis.neo4j.driver) return Promise.resolve(globalThis.neo4j);
      if (!loading) loading = D.assets.loadVendorScript(VENDOR).then(() => { if (!globalThis.neo4j || !globalThis.neo4j.driver) throw new Error(t('neo4j.err.load')); return globalThis.neo4j; }).catch((err) => { loading = null; throw err; });
      return loading;
    }
    const hostOf = (url) => { try { return new URL(String(url).replace(/^(neo4j|bolt)(\+s|\+ssc)?:\/\//, 'https://')).host; } catch (_e) { return String(url); } };

    /** The family entry for the dialog (fields, auth, secrets; no HTTP discovery). */
    const FAMILY = {
      id: 'neo4j', name: 'Neo4j (Bolt)', docs: 'https://neo4j.com/docs/javascript-manual/current/',
      fields: [{ name: 'baseUrl', type: 'text', required: true, placeholder: 'neo4j+s://xxxxxxxx.databases.neo4j.io' }, { name: 'database', type: 'text', placeholder: 'neo4j' }, { name: 'username', type: 'text', required: true }, { name: 'password', type: 'secret', required: true }],
      auth: () => ({ type: 'basic' }),
      secrets: (v) => ({ username: v.username, password: v.password || '' }),
      normalize: (v) => { const url = String(v.baseUrl || '').trim().replace(/\/+$/, ''); if (!/^(neo4j|bolt)(\+s|\+ssc)?:\/\/\S+$/i.test(url)) throw new Error(t('neo4j.err.url')); return Object.assign({}, v, { baseUrl: url }); },
      idHint: (v) => hostOf(v.baseUrl),
      endpoints: () => [],
      family: (v) => ({ type: 'neo4j', database: String(v.database || '').trim() }),
    };
    if (!databases.FAMILIES.some((f) => f.id === 'neo4j')) databases.FAMILIES.push(FAMILY);
    /** True when a connector is a Neo4j source. */
    const isNeo4j = (connector) => !!(connector && connector.family && connector.family.type === 'neo4j');

    /**
     * Run a Cypher query against a connector's database: {columns, rows, graph: {nodes, edges}|null, summary}.
     * @param {any} connector @param {string} text @param {{params?: any, limit?: number, timeoutMs?: number}} [options]
     */
    async function run(connector, text, options = {}) {
      const creds = secrets.get(connector.id);
      if (!creds || !creds.username) throw new Error(t('neo4j.err.credentials'));
      await consent.require('neo4j', { host: hostOf(connector.baseUrl) });
      const neo4j = await ensureDriver();
      const driver = neo4j.driver(connector.baseUrl, neo4j.auth.basic(creds.username, creds.password || ''), { connectionTimeout: options.timeoutMs || 20000 });
      const database = (connector.family && connector.family.database) || undefined;
      const session = driver.session(Object.assign({ defaultAccessMode: neo4j.session.READ }, database ? { database } : {}));
      try {
        const res = await session.run(text, options.params || {});
        return Object.assign(recordsToTable(res.records, neo4j), { summary: summaryOf(res.summary) });
      } finally {
        await session.close().catch(() => {});
        await driver.close().catch(() => {});
      }
    }
    function summaryOf(summary) {
      try { const c = summary && summary.counters ? summary.counters.updates() : {}; return { updates: c, database: summary && summary.database ? summary.database.name : '' }; } catch (_e) { return {}; }
    }
    const isNode = (v, neo4j) => !!(v && typeof v === 'object' && (neo4j && neo4j.isNode ? neo4j.isNode(v) : (v.labels !== undefined && v.properties !== undefined && v.identity !== undefined)));
    const isRel = (v, neo4j) => !!(v && typeof v === 'object' && (neo4j && neo4j.isRelationship ? neo4j.isRelationship(v) : (v.type !== undefined && v.start !== undefined && v.end !== undefined && v.properties !== undefined)));
    const isPath = (v, neo4j) => !!(v && typeof v === 'object' && (neo4j && neo4j.isPath ? neo4j.isPath(v) : (Array.isArray(v.segments) && v.start)));
    const idOf = (ent) => String(ent.elementId !== undefined ? ent.elementId : (ent.identity && typeof ent.identity.toNumber === 'function' ? ent.identity.toNumber() : ent.identity));
    /** Driver values → plain JSON: integers to numbers, temporal values to strings. */
    function plain(v, neo4j) {
      if (v === null || v === undefined) return null;
      if (neo4j && neo4j.isInt && neo4j.isInt(v)) return v.inSafeRange() ? v.toNumber() : v.toString();
      if (typeof v === 'object' && typeof v.toNumber === 'function' && v.low !== undefined) return v.toNumber();
      if (Array.isArray(v)) return v.map((x) => plain(x, neo4j));
      if (typeof v === 'object') {
        if (isNode(v, neo4j) || isRel(v, neo4j)) return v;
        if (typeof v.toString === 'function' && v.constructor && /Date|Time|Duration|Point/.test(v.constructor.name)) return v.toString();
        const out = {}; for (const [k, x] of Object.entries(v)) out[k] = plain(x, neo4j); return out;
      }
      return v;
    }
    /**
     * Records → table {columns, rows} and a graph of every node and relationship found (also inside paths and lists).
     * Node and relationship columns become their id; their properties are flattened into `<column>.<key>` columns.
     */
    function recordsToTable(records, neo4j) {
      const nodes = new Map(); const edges = new Map();
      const addNode = (n) => { const id = idOf(n); if (!nodes.has(id)) nodes.set(id, { id, label: (n.labels || [])[0] || '', properties: plain(n.properties, neo4j) || {} }); return id; };
      const addRel = (r) => { const id = idOf(r); if (!edges.has(id)) edges.set(id, { id, source: String(r.startNodeElementId !== undefined ? r.startNodeElementId : plain(r.start, neo4j)), target: String(r.endNodeElementId !== undefined ? r.endNodeElementId : plain(r.end, neo4j)), type: r.type || '', properties: plain(r.properties, neo4j) || {} }); return id; };
      const cell = (v) => {
        if (isPath(v, neo4j)) { for (const seg of v.segments) { addNode(seg.start); addNode(seg.end); addRel(seg.relationship); } return t('neo4j.path', { n: v.length !== undefined ? v.length : v.segments.length }); }
        if (isNode(v, neo4j)) return addNode(v);
        if (isRel(v, neo4j)) return addRel(v);
        if (Array.isArray(v)) { const out = v.map(cell); return JSON.stringify(out); }
        const p = plain(v, neo4j);
        return p !== null && typeof p === 'object' ? JSON.stringify(p) : p;
      };
      const keys = records.length ? records[0].keys : [];
      const extra = new Map(); // column → set of property keys for node/rel columns
      const rows = records.map((rec) => keys.map((k) => { const v = rec.get(k); if (isNode(v, neo4j) || isRel(v, neo4j)) { const props = plain(v.properties, neo4j) || {}; if (!extra.has(k)) extra.set(k, new Set()); for (const pk of Object.keys(props)) extra.get(k).add(pk); } return cell(v); }));
      const columns = keys.slice();
      for (const [k, set] of extra) for (const pk of set) columns.push(`${k}.${pk}`);
      if (extra.size) {
        records.forEach((rec, i) => { for (const [k, set] of extra) { const v = rec.get(k); const props = (isNode(v, neo4j) || isRel(v, neo4j)) ? plain(v.properties, neo4j) || {} : {}; for (const pk of set) { const val = props[pk]; rows[i].push(val !== null && typeof val === 'object' ? JSON.stringify(val) : (val === undefined ? null : val)); } } });
      }
      const g = nodes.size ? graph.normalise({ nodes: Array.from(nodes.values()), edges: Array.from(edges.values()).filter((e) => nodes.has(e.source) && nodes.has(e.target)), directed: true }) : null;
      return { columns, rows, graph: g };
    }
    /** A readable description of what a query touched (for the dataset's source). */
    /**
     * Starter queries for Kontroll's IFC graph (its docs/ifcgraph.md and graph-schema.md): the models, the latest finished model per
     * document (Documents API versions share document_id; a BCF document is one of its own), the elements, the issues and what
     * joins them. Entities hang on the model by model_id. Other graphs have their own words; the user edits.
     */
    const EXAMPLES = [
      { id: 'models', cypher: 'MATCH (m:IfcModel)\nRETURN m.file_name AS fil, m.state AS tillstand, m.version_index AS version, m.entities AS entiteter, m.ifc_project_guid AS ifc_project, m.done_at AS klar\nORDER BY fil, version' },
      { id: 'latest', cypher: "MATCH (m:IfcModel {state: 'done'})\nWITH coalesce(m.document_id, m.bcf_document_guid) AS dokument, m\nORDER BY m.version_index DESC, m.done_at DESC\nWITH dokument, collect(m)[0] AS senaste\nRETURN senaste.file_name AS fil, senaste.version_index AS version, senaste.entities AS entiteter, senaste.done_at AS klar\nORDER BY fil" },
      { id: 'classes', cypher: "MATCH (m:IfcModel {state: 'done'})\nWITH coalesce(m.document_id, m.bcf_document_guid) AS dokument, m\nORDER BY m.version_index DESC, m.done_at DESC\nWITH dokument, collect(m)[0] AS senaste\nMATCH (e:IfcProduct {model_id: senaste.id})\nRETURN e.ifc_class AS klass, count(*) AS antal\nORDER BY antal DESC" },
      { id: 'walls_gtin', cypher: "MATCH (w:IfcWall)-[:IsDefinedBy]->(:IfcRelDefinesByProperties)-[:RelatingPropertyDefinition]->(:IfcPropertySet {Name: 'Reuse'})-[:HasProperties]->(p:IfcPropertySingleValue {Name: 'GTIN'})\nRETURN DISTINCT w.GlobalId AS guid, w.Name AS namn, p.NominalValue AS gtin" },
      { id: 'topics', cypher: 'MATCH (t:Topic)\nRETURN t.topic_status AS status, count(*) AS antal\nORDER BY antal DESC' },
      { id: 'issue_elements', cypher: "MATCH (m:IfcModel {state: 'done'})\nWITH coalesce(m.document_id, m.bcf_document_guid) AS dokument, m\nORDER BY m.version_index DESC, m.done_at DESC\nWITH dokument, collect(m)[0] AS senaste\nMATCH (t:Topic)-[:HAS_VIEWPOINT]->(:Viewpoint)-[:HAS_COMPONENT]->(c:Component)-[:SAME_AS]->(e:IfcProduct {model_id: senaste.id})\nRETURN DISTINCT t.server_assigned_id AS arende, t.title AS titel, t.topic_status AS status, e.ifc_class AS klass, e.Name AS byggdel, e.GlobalId AS guid, senaste.file_name AS modell" },
      { id: 'element_issues', cypher: "MATCH (e:IfcEntity {GlobalId: 'GUID'})<-[:SAME_AS]-(:Component)<-[:HAS_COMPONENT]-(:Viewpoint)<-[:HAS_VIEWPOINT]-(t:Topic)\nRETURN DISTINCT t.server_assigned_id AS arende, t.title AS titel, t.topic_status AS status" },
      { id: 'graph', cypher: 'MATCH (t:Topic)-[r:HAS_VIEWPOINT]->(v:Viewpoint)\nOPTIONAL MATCH (v)-[h:HAS_COMPONENT]->(c:Component)\nRETURN t, r, v, h, c\nLIMIT 200' },
    ];
    function describe(connector, text) { return t('neo4j.source', { host: hostOf(connector.baseUrl), text: String(text).trim().slice(0, 120) }); }

    return { FAMILY, isNeo4j, ensureDriver, run, recordsToTable, plain, hostOf, describe, EXAMPLES, VENDOR };
  });
})();
