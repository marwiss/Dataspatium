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
  D.define('api/families/neo4j', ['api/families/databases', 'api/secrets', 'platform/consent', 'data/graph', 'data/ifc-graph'], (databases, secrets, consent, graph, ifcGraph) => {
    const t = (k, p) => D.t(k, p);
    const VENDOR = 'vendor/neo4j-driver-lite/neo4j-lite-web.min.js';
    /** The most rows the browser keeps from one answer; the rest of the stream is cancelled. */
    const MAX_ROWS = 20000;
    /** How long the server may work on one statement, so that a runaway pattern does not keep the database busy. */
    const TX_TIMEOUT_MS = 60000;
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
     * Run a Cypher query against a connector's database, always in a read session: {columns, rows, graph: {nodes, edges}|null, truncated,
     * summary}. The answer is read as a stream and cancelled at `maxRows`, so that a query without a limit cannot fill the browser.
     * @param {any} connector @param {string} text
     * @param {{params?: any, maxRows?: number, timeoutMs?: number, txTimeoutMs?: number}} [options]
     */
    async function run(connector, text, options = {}) {
      const creds = secrets.get(connector.id);
      if (!creds || !creds.username) throw new Error(t('neo4j.err.credentials'));
      await consent.require('neo4j', { host: hostOf(connector.baseUrl) });
      const neo4j = await ensureDriver();
      const driver = neo4j.driver(connector.baseUrl, neo4j.auth.basic(creds.username, creds.password || ''), { connectionTimeout: options.timeoutMs || 20000 });
      const database = (connector.family && connector.family.database) || undefined;
      const session = driver.session(Object.assign({ defaultAccessMode: neo4j.session.READ }, database ? { database } : {}));
      const limit = options.maxRows || MAX_ROWS;
      try {
        const result = session.run(text, options.params || {}, { timeout: options.txTimeoutMs || TX_TIMEOUT_MS });
        const records = []; let truncated = false;
        for await (const record of result) {
          if (records.length >= limit) { truncated = true; break; } // leaving the loop cancels the rest of the stream
          records.push(record);
        }
        const out = recordsToTable(records, neo4j);
        if (!records.length) out.columns = await result.keys().catch(() => []);
        return Object.assign(out, { truncated, summary: summaryOf(await result.summary().catch(() => null)) });
      } catch (err) {
        throw explain(err, connector);
      } finally {
        await session.close().catch(() => {});
        await driver.close().catch(() => {});
      }
    }
    /** The driver's errors that the user can act on, in the user's words; the original goes to the console. */
    function explain(err, connector) {
      const code = String((err && err.code) || '');
      const key = code === 'ServiceUnavailable' || code === 'SessionExpired' ? 'neo4j.err.unavailable' : /Security\.(Unauthorized|AuthenticationRateLimit)/.test(code) ? 'neo4j.err.unauthorized' : '';
      if (!key) return err;
      D.log('neo4j', code, err);
      return new Error(t(key, { host: hostOf(connector.baseUrl) }));
    }
    function summaryOf(summary) {
      try { const c = summary && summary.counters ? summary.counters.updates() : {}; return { updates: c, database: summary && summary.database ? summary.database.name : '' }; } catch (_e) { return {}; }
    }
    const isNode = (v, neo4j) => !!(v && typeof v === 'object' && (neo4j && neo4j.isNode ? neo4j.isNode(v) : (v.labels !== undefined && v.properties !== undefined && v.identity !== undefined)));
    const isRel = (v, neo4j) => !!(v && typeof v === 'object' && (neo4j && neo4j.isRelationship ? neo4j.isRelationship(v) : (v.type !== undefined && v.start !== undefined && v.end !== undefined && v.properties !== undefined)));
    // A driver's path has segments; the JSON of Dataregium's graph query has {nodes, relationships, length}.
    const isPath = (v, neo4j) => !!(v && typeof v === 'object' && (neo4j && neo4j.isPath ? neo4j.isPath(v) : ((Array.isArray(v.segments) && v.start) || (Array.isArray(v.nodes) && Array.isArray(v.relationships)))));
    const idOf = (ent) => String(ent.elementId !== undefined ? ent.elementId : (ent.identity && typeof ent.identity.toNumber === 'function' ? ent.identity.toNumber() : ent.identity));
    /**
     * A box of IFC-DB's spatial layer (`bbox_min`, `bbox_max`, `bbox_centre`) that a store without spatial points (Grafeo) keeps as a
     * list of two or three numbers, as a point reads: `x y` or `x y z`. Null for every other list, which stays a list.
     * @param {string|undefined} name the property's name @param {any[]} list plain values @returns {string|null}
     */
    const boxPoint = (name, list) => (typeof name === 'string' && name.startsWith('bbox_') && (list.length === 2 || list.length === 3) && list.every((n) => typeof n === 'number' && Number.isFinite(n)) ? list.join(' ') : null);
    /** Driver values → plain JSON: integers to numbers, temporal values to strings. `key` is the property's name, for a box as a list. */
    function plain(v, neo4j, key) {
      if (v === null || v === undefined) return null;
      if (neo4j && neo4j.isInt && neo4j.isInt(v)) return v.inSafeRange() ? v.toNumber() : v.toString();
      if (typeof v === 'object' && typeof v.toNumber === 'function' && v.low !== undefined) return v.toNumber();
      if (Array.isArray(v)) { const list = v.map((x) => plain(x, neo4j)); const box = boxPoint(key, list); return box === null ? list : box; }
      if (typeof v === 'object') {
        if (isNode(v, neo4j) || isRel(v, neo4j)) return v;
        // A spatial point (IFC-DB's point lists in the nodes form) reads as its coordinates, `x y` or `x y z`.
        if (typeof v.x === 'number' && typeof v.y === 'number' && v.srid !== undefined) return [v.x, v.y, v.z].filter((n) => typeof n === 'number').join(' ');
        if (typeof v.toString === 'function' && v.constructor && /Date|Time|Duration|Point/.test(v.constructor.name)) return v.toString();
        const out = {}; for (const [k, x] of Object.entries(v)) out[k] = plain(x, neo4j, k); return out;
      }
      return v;
    }
    /**
     * Records → table {columns, rows} and a graph of every node and relationship found (also inside paths and lists).
     * Node and relationship columns become their id; their properties are flattened into `<column>.<key>` columns. A node shows its class
     * and name by data/ifc-graph and keeps all its labels in the property `etiketter` when it has several, so that the local Cypher finds
     * an IfcWallStandardCase as IfcWall too. Stored hashes of secrets are removed everywhere, and what only writes a file back stays out of a node returned whole.
     */
    function recordsToTable(records, neo4j) {
      const nodes = new Map(); const edges = new Map();
      const propsOf = (ent) => ifcGraph.readable(ent.labels, ifcGraph.redact(plain(ent.properties, neo4j) || {}));
      const addNode = (n) => {
        const id = idOf(n);
        if (!nodes.has(id)) {
          const labels = n.labels || []; const props = propsOf(n);
          nodes.set(id, { id, label: ifcGraph.classOf(labels, props), name: ifcGraph.nameOf(props), properties: labels.length > 1 ? Object.assign({}, props, { etiketter: labels.slice() }) : props });
        }
        return id;
      };
      const addRel = (r) => { const id = idOf(r); if (!edges.has(id)) edges.set(id, { id, source: String(r.startNodeElementId !== undefined ? r.startNodeElementId : plain(r.start, neo4j)), target: String(r.endNodeElementId !== undefined ? r.endNodeElementId : plain(r.end, neo4j)), type: r.type || '', properties: propsOf(r) }); return id; };
      // `column` names the property a column holds (`n.bbox_centre`), so that a box as a list reads as a point there too.
      const cell = (v, column) => {
        if (isPath(v, neo4j)) {
          if (Array.isArray(v.segments)) for (const seg of v.segments) { addNode(seg.start); addNode(seg.end); addRel(seg.relationship); }
          else { for (const n of v.nodes) addNode(n); for (const r of v.relationships) addRel(r); }
          return t('neo4j.path', { n: v.length !== undefined ? plain(v.length, neo4j) : v.segments.length });
        }
        if (isNode(v, neo4j)) return addNode(v);
        if (isRel(v, neo4j)) return addRel(v);
        if (Array.isArray(v)) { const out = v.map((x) => cell(x)); const box = boxPoint(column === undefined ? undefined : String(column).split('.').pop(), out); return box === null ? JSON.stringify(out) : box; }
        const p = ifcGraph.redact(plain(v, neo4j));
        return p !== null && typeof p === 'object' ? JSON.stringify(p) : p;
      };
      const keys = records.length ? records[0].keys : [];
      const extra = new Map(); // column → set of property keys for node/rel columns
      const rows = records.map((rec) => keys.map((k) => { const v = rec.get(k); if (ifcGraph.isProtected(k)) return null; if (isNode(v, neo4j) || isRel(v, neo4j)) { if (!extra.has(k)) extra.set(k, new Set()); for (const pk of Object.keys(propsOf(v))) extra.get(k).add(pk); } return cell(v, k); }));
      const columns = keys.slice();
      for (const [k, set] of extra) for (const pk of set) columns.push(`${k}.${pk}`);
      if (extra.size) {
        records.forEach((rec, i) => { for (const [k, set] of extra) { const v = rec.get(k); const props = (isNode(v, neo4j) || isRel(v, neo4j)) ? propsOf(v) : {}; for (const pk of set) { const val = props[pk]; rows[i].push(val !== null && typeof val === 'object' ? JSON.stringify(val) : (val === undefined ? null : val)); } } });
      }
      // The app's own lines between BCF components and the entities with their GUIDs come with every answer, drawn and saved alike.
      const list = Array.from(nodes.values());
      const rels = Array.from(edges.values()).filter((e) => nodes.has(e.source) && nodes.has(e.target));
      const g = nodes.size ? graph.normalise({ nodes: list, edges: rels.concat(ifcGraph.componentLines(list)), directed: true }) : null;
      return { columns, rows, graph: g };
    }
    /**
     * The JSON answer of Dataregium's graph query (/admin/api/graph/query: nodes as {identity, labels, properties}, relationships as
     * {identity, type, start, end, properties}, paths as {nodes, relationships, length}) in the same shape as `run`.
     * @param {{columns?: string[], rows?: any[], truncated?: boolean}} answer
     */
    function answerToTable(answer) {
      const columns = Array.isArray(answer && answer.columns) ? answer.columns.map(String) : [];
      const rows = Array.isArray(answer && answer.rows) ? answer.rows : [];
      const records = rows.map((row) => ({ keys: columns, get: (k) => (Array.isArray(row) ? row[columns.indexOf(k)] : (row ? row[k] : null)) }));
      const out = recordsToTable(records, null);
      if (!records.length) out.columns = columns;
      return Object.assign(out, { truncated: !!(answer && answer.truncated) });
    }
    /** A readable description of what a query touched (for the dataset's source). */
    /**
     * Starter queries for Dataregium's IFC graph (its docs/ifc-db.md and graph-schema.md): the models, the latest finished model per
     * document (Documents API versions share document_id; a BCF document is one of its own), the elements, the issues and what
     * joins them, and the products within 1.2 m of one, from the spatial layer's boxes. Entities hang on the model by model_id. Other
     * graphs have their own words; the user edits.
     */
    const EXAMPLES = [
      { id: 'models', cypher: 'MATCH (m:Model)\nOPTIONAL MATCH (c:Conversion {model_id: m.id})\nRETURN coalesce(c.file_name, m.file_name) AS fil, coalesce(c.state, m.state) AS tillstand, coalesce(c.version_index, m.version_index) AS version, m.entities AS entiteter, m.ifc_project_guid AS ifc_project, coalesce(c.done_at, m.done_at) AS klar\nORDER BY fil, version' },
      { id: 'latest', cypher: "MATCH (m:Model)\nOPTIONAL MATCH (c:Conversion {model_id: m.id})\nWITH m, c WHERE coalesce(c.state, m.state) = 'done'\nWITH coalesce(c.document_id, m.document_id, c.bcf_document_guid, m.bcf_document_guid) AS dokument, m, c\nORDER BY coalesce(c.version_index, m.version_index) DESC, coalesce(c.done_at, m.done_at) DESC\nWITH dokument, collect({m: m, c: c})[0] AS s\nWITH s.m AS senaste, s.c AS k\nRETURN coalesce(k.file_name, senaste.file_name) AS fil, coalesce(k.version_index, senaste.version_index) AS version, senaste.entities AS entiteter, coalesce(k.done_at, senaste.done_at) AS klar\nORDER BY fil" },
      { id: 'classes', cypher: "MATCH (m:Model)\nOPTIONAL MATCH (c:Conversion {model_id: m.id})\nWITH m, c WHERE coalesce(c.state, m.state) = 'done'\nWITH coalesce(c.document_id, m.document_id, c.bcf_document_guid, m.bcf_document_guid) AS dokument, m, c\nORDER BY coalesce(c.version_index, m.version_index) DESC, coalesce(c.done_at, m.done_at) DESC\nWITH dokument, collect({m: m, c: c})[0] AS s\nWITH s.m AS senaste, s.c AS k\nMATCH (e:IfcProduct {model_id: senaste.id})\nRETURN e.ifc_class AS klass, count(*) AS antal\nORDER BY antal DESC" },
      { id: 'walls_gtin', cypher: "MATCH (w:IfcWall)-[:IS_DEFINED_BY]->(:IfcRelDefinesByProperties)-[:RELATING_PROPERTY_DEFINITION]->(:IfcPropertySet {Name: 'Reuse'})-[:HAS_PROPERTIES]->(p:IfcPropertySingleValue {Name: 'GTIN'})\nRETURN DISTINCT w.GlobalId AS guid, w.Name AS namn, p.NominalValue AS gtin" },
      { id: 'topics', cypher: 'MATCH (t:Topic)\nRETURN t.topic_status AS status, count(*) AS antal\nORDER BY antal DESC' },
      { id: 'issue_elements', cypher: "MATCH (m:Model)\nOPTIONAL MATCH (c:Conversion {model_id: m.id})\nWITH m, c WHERE coalesce(c.state, m.state) = 'done'\nWITH coalesce(c.document_id, m.document_id, c.bcf_document_guid, m.bcf_document_guid) AS dokument, m, c\nORDER BY coalesce(c.version_index, m.version_index) DESC, coalesce(c.done_at, m.done_at) DESC\nWITH dokument, collect({m: m, c: c})[0] AS s\nWITH s.m AS senaste, s.c AS k\nMATCH (t:Topic)-[:HAS_VIEWPOINT]->(:Viewpoint)-[:HAS_COMPONENT]->(komp:Component)\nMATCH (e:IfcProduct {model_id: senaste.id, GlobalId: komp.ifc_guid})\nRETURN DISTINCT t.server_assigned_id AS arende, t.title AS titel, t.topic_status AS status, e.ifc_class AS klass, e.Name AS byggdel, e.GlobalId AS guid, coalesce(k.file_name, senaste.file_name) AS modell" },
      { id: 'element_issues', cypher: "MATCH (c:Component {ifc_guid: 'GUID'})<-[:HAS_COMPONENT]-(:Viewpoint)<-[:HAS_VIEWPOINT]-(t:Topic)\nRETURN DISTINCT t.server_assigned_id AS arende, t.title AS titel, t.topic_status AS status" },
      { id: 'graph', cypher: 'MATCH (t:Topic)-[r:HAS_VIEWPOINT]->(v:Viewpoint)\nOPTIONAL MATCH (v)-[h:HAS_COMPONENT]->(c:Component)\nRETURN t, r, v, h, c\nLIMIT 200' },
      // IFC-DB's spatial layer (d042134): a box per product in project coordinates, metres, only where the server has computed it.
      // `spatial`: it needs the boxes as spatial points (point.distance), which only Neo4j and Memgraph have.
      { id: 'nearby', spatial: true, cypher: "MATCH (n:Entity {GlobalId: 'GUID'})\nMATCH (d:IfcProduct {model_id: n.model_id})\nWHERE n.bbox_centre IS NOT NULL AND d.bbox_centre IS NOT NULL AND d <> n AND point.distance(n.bbox_centre, d.bbox_centre) < 1.2\nRETURN d.GlobalId AS guid, d.ifc_class AS klass, d.Name AS namn, round(point.distance(n.bbox_centre, d.bbox_centre) * 100) / 100 AS avstand\nORDER BY avstand\nLIMIT 100" },
    ];
    /** The graph stores that keep a box as a spatial point, so that point.distance works. */
    const POINT_STORES = ['neo4j', 'memgraph'];
    /**
     * The ready-made queries that work in the graph store a server announces (opencde.graphStore): all of them when none is announced
     * or the store has spatial points, otherwise those without `spatial` (Grafeo keeps a box as a list of numbers).
     * @param {string} store @param {Array<{id: string, spatial?: boolean}>} [list] EXAMPLES, or the views of data/ifc-graph
     * @returns {any[]}
     */
    function queriesFor(store, list = EXAMPLES) {
      const name = String(store || '').trim().toLowerCase();
      return !name || POINT_STORES.includes(name) ? list : list.filter((q) => !q.spatial);
    }
    function describe(connector, text) { return t('neo4j.source', { host: hostOf(connector.baseUrl), text: String(text).trim().slice(0, 120) }); }

    return { FAMILY, isNeo4j, ensureDriver, run, recordsToTable, answerToTable, plain, hostOf, describe, EXAMPLES, queriesFor, VENDOR, MAX_ROWS };
  });
})();
