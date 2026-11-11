// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The read tools the AI may call about an IFC model: the model's overview, its storeys, elements by class, storey, name and property
 * (also elements that lack a property), one element with its properties and quantities, what the user has marked in the 3D view,
 * and the building's topology (rooms, neighbours, external walls with the façade they face) when the app's Python runs.
 * Few verbs with rich filters, answered from the model dataset's tables (`data`, `_properties`, `_quantities`) in the SQLite worker.
 * The schemas are flat objects with every field required (null for "not given"), which the strict modes of the providers accept.
 * Every answer is data for the model, never an instruction, and says when it was cut (`truncated`). The same contract is what the
 * modelling wheel (python/) will offer on the server.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/model-tools', ['data/datasets', 'data/selection', 'api/connectors', 'api/families/opencde'], (datasets, selection, connectors, opencde) => {
    const LIMIT = 200;
    const MAX_LIMIT = 500;
    const str = (nullable = true) => ({ type: nullable ? ['string', 'null'] : 'string' });
    const int = () => ({ type: ['integer', 'null'] });
    const bool = () => ({ type: ['boolean', 'null'] });
    /** The tools as the providers see them. */
    const TOOLS = [
      { name: 'get_model_overview', description: 'The model: file, schema, number of elements, the storeys, the element classes with counts, and the property sets in use.', parameters: { type: 'object', properties: {} } },
      { name: 'list_storeys', description: 'The building storeys in order, with the number of elements on each.', parameters: { type: 'object', properties: {} } },
      { name: 'query_elements', description: 'Elements that match every given filter. ifc_class is an IFC class such as IfcDoor or IfcWall (exact, case-insensitive); storey is a storey name; name_contains matches the element name; property_set and property_name name a property (values are compared as text, property_value matches part of the value, case-insensitive); missing_property true returns the elements that LACK the named property instead. Returns id (STEP id), guid, ifc_class, name, storey, and the property value when a property was named. limit at most 500 (default 200).',
        parameters: { type: 'object', properties: { ifc_class: str(), storey: str(), name_contains: str(), property_set: str(), property_name: str(), property_value: str(), missing_property: bool(), limit: int() } } },
      { name: 'get_element', description: 'One element by id (STEP id) or guid (GlobalId): its attributes, every property grouped by set, and its quantities.', parameters: { type: 'object', properties: { id: int(), guid: str() } } },
      { name: 'get_view_context', description: 'What the user has marked in the model right now: the marked elements (id, ifc_class, name, storey), or none.', parameters: { type: 'object', properties: {} } },
      { name: 'search_bsdd', description: 'Search the buildingSMART Data Dictionary (bSDD) for classes by text: answers uri, name, code, dictionary and description for each, for set_classification. The person consents to the call to api.bsdd.buildingsmart.org once.',
        parameters: { type: 'object', properties: { text: { type: 'string' }, limit: int() } } },
      { name: 'get_topology', description: 'The building\'s topology per storey, from the walls\' centrelines: the rooms they enclose (area, perimeter, walls by id), which rooms border which, and the external walls with the façade they face (N, NE, E, SE, S, SW, W, NW), so that a photo labelled south façade can be matched to its walls; also the open wall ends and whether the storey is closed. storey null gives every storey. Works only when the app\'s Python is already running.',
        parameters: { type: 'object', properties: { storey: str() } } },
      { name: 'server_query', description: 'Ask the server (Dataregium) the model came from one of its named graph queries, when the model was fetched from a server the user is signed in to. name: element-classes (counts per class), elements (class required; each element with the spatial structure that holds it), storeys (elevation, elements and spaces per storey), spaces (storey, net and gross floor area), areas (net floor area per storey), materials (class optional; the materials of each element), property (pset, property, class optional; the value of one property on every object that has it), entity (global_id required; one rooted entity with all its literal attributes, references and referenced_by per IFC attribute, STEP id and class), changed-since (since required, a version index; what the versions after it changed: version_index, change_set_id, author, approved_by, whole_file, guid, step_id, path, attribute, op; a row with whole_file true for a version uploaded as a whole file). name null lists the queries the server offers. Answers columns and rows (each row a list in the order of the columns) and truncated.',
        parameters: { type: 'object', properties: { name: str(), class: str(), pset: str(), property: str(), global_id: str(), since: str() } } },
    ];
    const names = () => TOOLS.map((tool) => tool.name);
    const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
    const like = (s) => "'%" + String(s).replace(/'/g, "''").replace(/[%_]/g, (c) => '\\' + c) + "%'";

    async function engineOf(datasetId) { return (await datasets.ensureOpen(datasetId)).engine; }
    const rowsOf = (res) => (res && res[0] ? res[0].values : []);
    const objects = (res) => { const cols = res && res[0] ? res[0].columns : []; return rowsOf(res).map((r) => { const o = {}; cols.forEach((c, i) => { o[c] = r[i]; }); return o; }); };

    async function overview(datasetId) {
      const meta = await datasets.get(datasetId);
      const e = await engineOf(datasetId);
      const classes = objects(await e.exec("select typ as ifc_class, count(*) as n from data where kategori = 'byggdel' group by typ order by n desc limit 40"));
      const storeys = objects(await e.exec("select vaning as storey, count(*) as n from data where kategori = 'byggdel' and vaning is not null and vaning != '' group by vaning order by n desc"));
      const psets = objects(await e.exec('select uppsattning as property_set, count(distinct namn) as properties, count(distinct id) as elements from _properties group by uppsattning order by elements desc limit 30'));
      const total = rowsOf(await e.exec("select count(*) from data where kategori = 'byggdel'"))[0][0];
      const facts = (meta && meta.model) || {};
      return { name: meta ? meta.name : '', file: facts.file || '', schema: facts.schema || '', elements: Number(total) || 0, storeys, classes, property_sets: psets };
    }
    async function storeys(datasetId) {
      const e = await engineOf(datasetId);
      const facts = ((await datasets.get(datasetId)) || {}).model || {};
      const counts = objects(await e.exec("select vaning as storey, count(*) as n from data where kategori = 'byggdel' group by vaning"));
      // The facts keep the storeys in building order, as objects with name and elevation (older datasets: names).
      const order = Array.isArray(facts.storeys) && facts.storeys.length ? facts.storeys.map((s) => (typeof s === 'string' ? s : s.name)) : counts.map((c) => c.storey);
      return { storeys: order.map((s) => ({ storey: s, elements: (counts.find((c) => c.storey === s) || { n: 0 }).n })) };
    }
    async function query(datasetId, args) {
      const e = await engineOf(datasetId);
      const limit = Math.max(1, Math.min(MAX_LIMIT, Number(args.limit) || LIMIT));
      const where = ["d.kategori = 'byggdel'"];
      if (args.ifc_class) where.push(`lower(d.typ) = lower(${q(args.ifc_class)})`);
      if (args.storey) where.push(`d.vaning = ${q(args.storey)}`);
      if (args.name_contains) where.push(`lower(d.namn) like lower(${like(args.name_contains)}) escape '\\'`);
      const prop = args.property_name ? `select id from _properties p where lower(p.namn) = lower(${q(args.property_name)})${args.property_set ? ` and lower(p.uppsattning) = lower(${q(args.property_set)})` : ''}` : null;
      let valueSelect = '';
      if (prop) {
        if (args.missing_property) where.push(`d.id not in (${prop})`);
        else {
          where.push(`d.id in (${prop}${args.property_value ? ` and lower(p.varde) like lower(${like(args.property_value)}) escape '\\'` : ''})`);
          valueSelect = `, (select group_concat(p.varde, ' | ') from _properties p where p.id = d.id and lower(p.namn) = lower(${q(args.property_name)})${args.property_set ? ` and lower(p.uppsattning) = lower(${q(args.property_set)})` : ''}) as property_value`;
        }
      }
      const sql = `select d.id as id, d.guid as guid, d.typ as ifc_class, d.namn as name, d.vaning as storey${valueSelect} from data d where ${where.join(' and ')} order by d.vaning, d.typ, d.namn limit ${limit + 1}`;
      const rows = objects(await e.exec(sql));
      const truncated = rows.length > limit;
      const total = truncated ? Number(rowsOf(await e.exec(`select count(*) from data d where ${where.join(' and ')}`))[0][0]) : rows.length;
      return { count: total, truncated, elements: rows.slice(0, limit) };
    }
    async function element(datasetId, args) {
      const e = await engineOf(datasetId);
      const cond = args.id !== null && args.id !== undefined ? `id = ${Number(args.id)}` : (args.guid ? `guid = ${q(args.guid)}` : null);
      if (!cond) return { error: 'give id or guid' };
      const row = objects(await e.exec(`select * from data where ${cond} limit 1`))[0];
      if (!row) return { error: 'no such element' };
      const props = objects(await e.exec(`select uppsattning as property_set, namn as name, varde as value, enhet as unit from _properties where id = ${Number(row.id)} order by uppsattning, namn`));
      const quantities = objects(await e.exec(`select uppsattning as set_name, namn as name, varde as value, slag as kind, enhet as unit from _quantities where id = ${Number(row.id)} order by uppsattning, namn`));
      const sets = {};
      for (const p of props) { (sets[p.property_set] = sets[p.property_set] || []).push({ name: p.name, value: p.value, unit: p.unit }); }
      return { id: row.id, guid: row.guid, ifc_class: row.typ, name: row.namn, description: row.beskrivning, object_type: row.objekttyp, tag: row.tagg, storey: row.vaning, properties: sets, quantities };
    }
    async function viewContext(datasetId) {
      const sel = selection.get();
      if (!sel || sel.datasetId !== datasetId || !sel.rowids.length) return { marked: 0, elements: [] };
      const e = await engineOf(datasetId);
      const ids = sel.rowids.slice(0, LIMIT).map(Number).filter(Number.isFinite);
      const rows = objects(await e.exec(`select id, typ as ifc_class, namn as name, vaning as storey from data where rowid in (${ids.join(', ')})`));
      return { marked: sel.rowids.length, truncated: sel.rowids.length > LIMIT, label: sel.label || '', elements: rows };
    }
    /** The building's topology through the app's Python, which this tool never starts (python/dataspatium.py `_ifc_topology`). */
    async function topology(datasetId, args) {
      const { bridge } = D.require('data/python-bridge');
      if (!bridge || (bridge.state !== 'ready' && bridge.state !== 'busy')) return { error: 'the topology needs the app\'s Python, which is not running; ask the person to press Preview once' };
      const all = await D.require('data/ifc-ops').topologyOf(datasetId);
      if (!args.storey) return { storeys: all };
      const storeys = all.filter((s) => String(s.storey || '').toLowerCase() === String(args.storey).toLowerCase());
      return storeys.length ? { storeys } : { error: `no storey named ${args.storey}; the storeys are ${all.map((s) => s.storey).join(', ')}` };
    }
    /** A named query on the server the model came from (Dataregium's ifc-queries); errors are answers, so the model can go on. */
    async function serverQuery(datasetId, args) {
      const meta = await datasets.get(datasetId);
      const cde = meta && meta.source && meta.source.cde;
      if (!cde || !cde.documentId || !cde.connectorId) return { error: 'the model was not fetched from a server; only the local tools apply' };
      const connector = await connectors.get(cde.connectorId);
      if (!connector || !opencde.isOpenCde(connector)) return { error: 'the source of the model is no longer among the sources' };
      if (!opencde.signedIn(connector)) return { error: `the user must sign in to ${connector.name} first` };
      const base = `/documents/1.0/documents/${encodeURIComponent(cde.documentId)}/versions/${encodeURIComponent(String(cde.versionIndex))}/ifc-queries`;
      if (!args.name) { const list = await opencde.api(connector, base); return { queries: list && list.queries ? list.queries : list, model_state: list && list.model_state }; }
      const params = new URLSearchParams();
      for (const key of ['class', 'pset', 'property', 'global_id', 'since']) if (args[key] !== null && args[key] !== undefined && args[key] !== '') params.set(key, String(args[key]));
      const qs = params.toString();
      const out = await opencde.api(connector, `${base}/${encodeURIComponent(String(args.name))}${qs ? '?' + qs : ''}`);
      const rows = (out && out.rows) || [];
      return { name: out && out.name, columns: (out && out.columns) || [], rows: rows.slice(0, MAX_LIMIT), count: rows.length, truncated: !!(out && out.truncated) || rows.length > MAX_LIMIT };
    }
    /**
     * Run one tool. Unknown names and bad arguments give an error object, never an exception, so the model can go on.
     * @param {string} datasetId @param {string} name @param {any} args
     */
    async function call(datasetId, name, args) {
      const a = args && typeof args === 'object' ? args : {};
      try {
        switch (name) {
          case 'get_model_overview': return await overview(datasetId);
          case 'list_storeys': return await storeys(datasetId);
          case 'query_elements': return await query(datasetId, a);
          case 'get_element': return await element(datasetId, a);
          case 'get_view_context': return await viewContext(datasetId);
          case 'get_topology': return await topology(datasetId, a);
          case 'server_query': return await serverQuery(datasetId, a);
          case 'search_bsdd': { const limit = Math.max(1, Math.min(50, Number(a.limit) || 10)); const classes = await D.require('api/bsdd').search(String(a.text || ''), { limit }); return { classes, truncated: classes.length >= limit }; }
          default: return { error: 'unknown tool ' + name };
        }
      } catch (err) { return { error: String((err && err.message) || err).slice(0, 300) }; }
    }
    /** The element ids (STEP ids) a tool's answer named, for marking in the model. */
    function idsOf(result) {
      const out = [];
      if (result && Array.isArray(result.elements)) for (const r of result.elements) if (r && Number.isFinite(Number(r.id))) out.push(Number(r.id));
      if (result && Number.isFinite(Number(result.id)) && !Array.isArray(result.elements)) out.push(Number(result.id));
      return out;
    }
    return { TOOLS, names, call, idsOf, LIMIT, MAX_LIMIT };
  });
})();
