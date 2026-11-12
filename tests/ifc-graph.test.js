// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for a server's IFC graph in the app: what a node shows, the models and the views, hashes kept out, the answer read as a stream and
 * cut at a limit, the graph query's JSON, the workbench in Inhämta with a fake driver (the real Cytoscape draws), the card in an OpenCDE
 * source against a mocked server, the graph store it announces and the queries that work there, a box kept as a list (Grafeo), the way
 * from a model to its graph, and the local Cypher on a saved graph. The labels and the relationship
 * names are those of Dataregium's sample model, read from a real server. The real server is in opencde-live.test.js.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const http = D.require('api/http');
  const ifcGraph = D.require('data/ifc-graph');
  const graph = D.require('data/graph');
  const neo4j = D.require('api/families/neo4j');
  const graphSource = D.require('api/graph-source');
  const admin = D.require('api/families/opencde-admin');
  const opencde = D.require('api/families/opencde');
  const cypher = D.require('analysis/cypher');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const datasets = D.require('data/datasets');
  const overlays = D.require('ui/overlays');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 8000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }

  // ------------------------------------------------------------------------------------------------- a small IFC graph
  const MODEL = 'model-1';
  const WALL_LABELS = ['Entity', 'IfcRoot', 'IfcObject', 'IfcObjectDefinition', 'IfcProduct', 'IfcWall', 'IfcElement', 'IfcBuildingElement', 'IfcWallStandardCase'];
  const NODES = {
    project: { labels: ['Entity', 'IfcRoot', 'IfcObject', 'IfcObjectDefinition', 'IfcProject'], properties: { ifc_class: 'IfcProject', step_id: 91, model_id: MODEL, id: MODEL + ':91', Name: 'Prosjektnavn', GlobalId: '1CGyzxdzHaJybf9L4wHy3R' } },
    agg: { labels: ['Entity', 'IfcRelDecomposes', 'IfcRoot', 'IfcRelAggregates', 'IfcRelationship'], properties: { ifc_class: 'IfcRelAggregates', step_id: 116, model_id: MODEL, GlobalId: '2F2UAtyl4uWjrKORQfJcEW' } },
    storey: { labels: ['Entity', 'IfcRoot', 'IfcObject', 'IfcObjectDefinition', 'IfcProduct', 'IfcSpatialStructureElement', 'IfcBuildingStorey'], properties: { ifc_class: 'IfcBuildingStorey', step_id: 167, model_id: MODEL, Name: '1. etasje', GlobalId: '0St1hMhFUHZyrAECcby7I2' } },
    wall: { labels: WALL_LABELS, properties: { ifc_class: 'IfcWallStandardCase', step_id: 459, model_id: MODEL, id: MODEL + ':459', Name: 'YVT-A', GlobalId: '1Xezbq735AdBO_4DerG66G', Description: '' } },
    rel: { labels: ['Entity', 'IfcRelDefines', 'IfcRoot', 'IfcRelDefinesByProperties', 'IfcRelationship'], properties: { ifc_class: 'IfcRelDefinesByProperties', step_id: 470, model_id: MODEL } },
    pset: { labels: ['Entity', 'IfcRoot', 'IfcPropertyDefinition', 'IfcPropertySetDefinition', 'IfcPropertySet'], properties: { ifc_class: 'IfcPropertySet', step_id: 471, model_id: MODEL, Name: 'Reuse' } },
    gtin: { labels: ['Entity', 'IfcPropertySingleValue', 'IfcSimpleProperty', 'IfcProperty'], properties: { ifc_class: 'IfcPropertySingleValue', step_id: 480, model_id: MODEL, Name: 'GTIN', NominalValue: '7350000000017' } },
    topic: { labels: ['Topic'], properties: { guid: 't-1', title: 'Check the reuse marking', topic_status: 'Open' } },
    viewpoint: { labels: ['Viewpoint'], properties: { guid: 'v-1' } },
    component: { labels: ['Component'], properties: { id: 'c-1', ifc_guid: '1Xezbq735AdBO_4DerG66G' } },
    user: { labels: ['User'], properties: { username: 'admin', full_name: 'Admin', password_hash: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA', is_admin: true } },
  };
  const ids = Object.keys(NODES);
  const idOf = (key) => `4:db:${ids.indexOf(key)}`;
  const RELS = [
    ['r1', 'project', 'agg', 'IS_DECOMPOSED_BY'], ['r2', 'agg', 'storey', 'RELATED_OBJECTS'], ['r3', 'wall', 'rel', 'IS_DEFINED_BY'], ['r4', 'rel', 'wall', 'RELATED_OBJECTS'],
    ['r5', 'rel', 'pset', 'RELATING_PROPERTY_DEFINITION'], ['r6', 'pset', 'gtin', 'HAS_PROPERTIES'], ['r7', 'topic', 'viewpoint', 'HAS_VIEWPOINT'], ['r8', 'viewpoint', 'component', 'HAS_COMPONENT'],
  ];
  // The graph query's JSON (Dataregium's client guide §7).
  const jsonNode = (key) => ({ identity: idOf(key), labels: NODES[key].labels, properties: NODES[key].properties });
  const jsonRel = (r) => ({ identity: '5:db:' + r[0], type: r[3], start: idOf(r[1]), end: idOf(r[2]), properties: {} });
  const relBy = (id) => RELS.find((r) => r[0] === id);
  /** An answer per query, by what the query asks for, as the columns and rows of the graph query. */
  function answerFor(text) {
    if (/m:Model/.test(text)) {
      const columns = ['id', 'fil', 'tillstand', 'version', 'entiteter', 'relationer', 'schema', 'fel', 'dokument', 'projekt', 'klar', 'geometri', 'forlustfri', 'form', 'format'];
      return { columns, rows: [
        ['model-0', 'three_walls_gtin.ifc', 'done', 1, 140, 190, 'IFC2X3', null, 'doc-1', 'Building permit', '2026-11-05T10:00:00.000Z', null, true, null, null],
        [MODEL, 'three_walls_gtin.ifc', 'done', 2, 150, 206, 'IFC2X3', null, 'doc-1', 'Building permit', '2026-11-06T10:00:00.000Z', 'skeleton', true, 1, 'step'],
        ['model-2', 'other.ifc', 'running', 1, null, null, null, null, 'doc-2', 'Building permit', '2026-11-06T11:00:00.000Z', null, null, 1, 'ifcx'],
        ['model-3', 'broken.ifc', 'failed', 1, null, null, null, 'parse error', 'doc-3', 'Building permit', '2026-11-06T11:00:00.000Z', 'odd', false, null, null],
      ] };
    }
    if (/IS_DECOMPOSED_BY\|RELATED_OBJECTS/.test(text)) return { columns: ['x', 'r', 'y'], rows: [['project', 'r1', 'agg'], ['agg', 'r2', 'storey'], ['storey', null, null]].map(([x, r, y]) => [jsonNode(x), r ? jsonRel(relBy(r)) : null, y ? jsonNode(y) : null]) };
    if (/ifc_class AS klass/.test(text)) return { columns: ['klass', 'antal'], rows: [['IfcWallStandardCase', 3]] };
    if (/HAS_PROPERTIES/.test(text)) return { columns: ['n', 'a', 'r', 'b', 's', 'c', 'p'], rows: [[jsonNode('wall'), jsonRel(relBy('r3')), jsonNode('rel'), jsonRel(relBy('r5')), jsonNode('pset'), jsonRel(relBy('r6')), jsonNode('gtin')]] };
    // Since Dataregium's step one of IFC-LPG's F38 a there is no SAME_AS: the component and the entity are joined on the GUID.
    if (/ifc_guid/.test(text)) return { columns: ['t', 'a', 'v', 'b', 'c', 'n'], rows: [[jsonNode('topic'), jsonRel(relBy('r7')), jsonNode('viewpoint'), jsonRel(relBy('r8')), jsonNode('component'), jsonNode('wall')]] };
    if (/elementId\(n\)/.test(text) || /GlobalId/.test(text)) return { columns: ['n', 'r', 'm'], rows: [[jsonNode('wall'), jsonRel(relBy('r3')), jsonNode('rel')]] };
    if (/\(u:User\)/.test(text)) return { columns: ['u', 'hemlighet'], rows: [[jsonNode('user'), NODES.user.properties.password_hash]] };
    return { columns: ['n', 'r', 'm'], rows: RELS.map((r) => [jsonNode(r[1]), jsonRel(r), jsonNode(r[2])]) };
  }
  // The same answers as a driver gives them: integers as objects, nodes and relationships as instances.
  const int = (n) => ({ low: n, high: 0, toNumber: () => n, inSafeRange: () => true });
  const fakeHelpers = { isNode: (v) => !!(v && v.labels), isRelationship: (v) => !!(v && v.type && v.start !== undefined), isPath: (v) => !!(v && v.segments), isInt: (v) => !!(v && v.low !== undefined && typeof v.toNumber === 'function') };
  const toDriver = (v) => {
    if (v && v.labels) return { identity: int(1), elementId: v.identity, labels: v.labels, properties: Object.fromEntries(Object.entries(v.properties).map(([k, x]) => [k, typeof x === 'number' ? int(x) : x])) };
    if (v && v.type) return { identity: int(2), elementId: v.identity, type: v.type, start: int(0), end: int(0), startNodeElementId: v.start, endNodeElementId: v.end, properties: v.properties };
    return typeof v === 'number' ? int(v) : v;
  };
  /** A driver whose results read like the real one's: an async iterator that can be left early, keys and a summary. */
  function fakeLib(answer = answerFor) {
    const calls = [];
    const result = (text) => {
      const a = answer(text);
      const records = a.rows.map((row) => ({ keys: a.columns, get: (k) => toDriver(row[a.columns.indexOf(k)]) }));
      const call = calls[calls.length - 1];
      return {
        [Symbol.asyncIterator]() { let i = 0; return { next: async () => (i < records.length ? { value: records[i++], done: false } : { value: undefined, done: true }), return: async () => { call.cancelled = true; return { value: undefined, done: true }; } }; },
        keys: async () => a.columns,
        summary: async () => ({ counters: { updates: () => ({}) }, database: { name: 'neo4j' } }),
      };
    };
    const lib = Object.assign({ driver: () => ({ session: (o) => ({ run: (text, params, tx) => { calls.push({ text, params, tx, access: o.defaultAccessMode }); return result(text); }, close: async () => {} }), close: async () => {} }), auth: { basic: (u, p) => ({ u, p }) }, session: { READ: 'READ' } }, fakeHelpers);
    return { lib, calls };
  }
  /** Run something with a fake driver in place of the real one. */
  async function withDriver(fake, fn) {
    const prev = globalThis.neo4j;
    globalThis.neo4j = fake.lib;
    try { return await fn(); } finally { globalThis.neo4j = prev; }
  }
  const made = { connectors: [], datasets: [] };
  async function boltSource(address = 'bolt://127.0.0.1:7707') {
    const r = await families.createConnector('neo4j', { baseUrl: address, database: 'neo4j', username: 'neo4j', password: 'hemligt' }, { discover: false });
    made.connectors.push(r.connector.id);
    return r.connector;
  }
  /** The view on the page, since Cytoscape draws in a container with a size. */
  function onPage(view) {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:1100px;';
    host.appendChild(view.el);
    document.body.appendChild(host);
    return host;
  }

  test('ifc graph: a node shows its class and name whatever the order of its labels, and a family that colours it', async (assert) => {
    const wall = { label: 'IfcWallStandardCase', properties: Object.assign({ etiketter: WALL_LABELS }, NODES.wall.properties) };
    assert.equal(ifcGraph.classOf(WALL_LABELS, NODES.wall.properties), 'IfcWallStandardCase', 'the concrete class, though Entity comes first');
    assert.equal(ifcGraph.classOf(['Entity', 'Other'], {}), 'Other');
    assert.equal(ifcGraph.classOf(['Topic'], { title: 'x' }), 'Topic');
    assert.equal(ifcGraph.nameOf(NODES.wall.properties), 'YVT-A');
    assert.equal(ifcGraph.nameOf(NODES.rel.properties), 'IfcRelDefinesByProperties #470', 'an entity without a name');
    assert.equal(ifcGraph.nameOf(NODES.gtin.properties), 'GTIN: 7350000000017', 'a property shows its value');
    assert.equal(ifcGraph.nameOf({ ifc_class: 'IfcPropertySingleValue', Name: 'IsExternal', NominalValue: false }), 'IsExternal: false', 'also when the value is false');
    assert.equal(ifcGraph.nameOf(NODES.topic.properties), 'Check the reuse marking');
    assert.equal(ifcGraph.nameOf({ file_name: 'a.ifc', state: 'done' }), 'a.ifc');
    assert.equal(ifcGraph.nameOf({ weight: 3 }), '');
    assert.ok(ifcGraph.nameOf({ comment: 'x'.repeat(200) }).length <= 80, 'a long text is shortened');
    const family = (key) => ifcGraph.familyOf({ label: NODES[key].properties.ifc_class, properties: Object.assign({ etiketter: NODES[key].labels }, NODES[key].properties) });
    assert.equal(ifcGraph.familyOf(wall), 'element');
    assert.equal(family('project'), 'spatial'); assert.equal(family('storey'), 'spatial', 'a storey is a product too, but spatial first');
    assert.equal(family('agg'), 'relation'); assert.equal(family('pset'), 'property'); assert.equal(family('gtin'), 'property');
    assert.equal(ifcGraph.familyOf({ label: 'IfcMaterial', properties: { ifc_class: 'IfcMaterial' } }), 'material');
    assert.equal(ifcGraph.familyOf({ label: 'IfcWallType', properties: { ifc_class: 'IfcWallType', etiketter: ['Entity', 'IfcTypeObject', 'IfcWallType'] } }), 'type');
    assert.equal(ifcGraph.familyOf({ label: 'IfcSIUnit', properties: { ifc_class: 'IfcSIUnit' } }), 'other');
    assert.equal(ifcGraph.familyOf({ label: 'Topic', properties: { title: 'x' } }), null, 'not an IFC entity');
    assert.equal(ifcGraph.colorKey(wall), 'ifc:element'); assert.equal(ifcGraph.colorKey({ label: 'Topic', properties: {} }), 'Topic');
    for (const f of ['spatial', 'element', 'relation', 'type', 'property', 'material', 'other']) assert.ok(t('ifcgraph.family.' + f) !== 'ifcgraph.family.' + f, 'a name for the family ' + f);
    return 'ok';
  });

  test('ifc graph: models are read by version, every view has a name and a limit, and values cannot break out of a query', async (assert) => {
    const list = ifcGraph.modelsOf(answerFor('MATCH (m:Model)'));
    assert.deepEqual(list.models.map((m) => [m.id, m.latest]), [[MODEL, true], ['model-0', false]], 'finished models, the newest version first and marked');
    assert.equal(list.waiting, 1); assert.equal(list.failed, 1);
    assert.equal(ifcGraph.pickModel(list.models, null).id, MODEL);
    assert.equal(ifcGraph.pickModel(list.models, { documentId: 'doc-1', versionIndex: 1 }).id, 'model-0', 'the version the model came from');
    assert.equal(ifcGraph.pickModel(list.models, { documentId: 'doc-1', versionIndex: 9 }).id, MODEL, 'otherwise the newest of the document');
    assert.equal(ifcGraph.pickModel([], null), null);
    // Dataregium's own facts moved from Model to Conversion (its step two of IFC-LPG's F38 a): the queries read both forms.
    assert.ok(/OPTIONAL MATCH \(c:Conversion \{model_id: m\.id\}\)/.test(ifcGraph.MODELS) && /coalesce\(c\.state, m\.state/.test(ifcGraph.MODELS) && /HAS_CONVERSION/.test(ifcGraph.MODELS) && /HAS_MODEL/.test(ifcGraph.MODELS), 'MODELS reads Conversion when it exists and Model otherwise');
    const presets = D.require('api/families/neo4j').EXAMPLES;
    for (const id of ['models', 'latest', 'classes', 'issue_elements']) {
      const ex = presets.find((e) => e.id === id);
      assert.ok(ex && /Conversion \{model_id: m\.id\}/.test(ex.cypher) && !/Model \{state/.test(ex.cypher), 'the preset ' + id + ' reads both forms');
    }
    for (const v of ifcGraph.VIEWS) {
      assert.ok(t('ifcgraph.view.' + v.id) !== 'ifcgraph.view.' + v.id, 'a name for the view ' + v.id);
      const view = ifcGraph.viewOf(v.id, MODEL);
      assert.ok(view.cypher.includes(`'${MODEL}'`), v.id + ' keeps to the model');
      assert.ok(v.graph === false || ifcGraph.limitOf(view.cypher), v.id + ' has a limit');
    }
    assert.equal(ifcGraph.viewOf('nothing', MODEL), null);
    assert.deepEqual(list.models.map((m) => [m.form, m.format]), [[1, 'step'], [0, '']], 'the form version and the origin, empty for a model before 61a2d69');
    assert.deepEqual(list.models.map((m) => m.geometry), ['skeleton', 'blocks'], 'the form the geometry has, by Model.geometry, or blocks when an older lossless model lacks it');
    assert.ok(ifcGraph.viewOf('whole', MODEL).cypher.includes("WHERE none(l IN labels(a) WHERE l IN ['IfcRepresentationItem'"), 'the whole model leaves the geometry skeleton out');
    assert.ok(ifcGraph.viewOf('classes', MODEL).cypher.includes('WHERE none(l IN labels(e)'), 'so does the count per class');
    assert.ok(ifcGraph.viewOf('geometry', MODEL).cypher.includes('WHERE any(l IN labels(e)') && ifcGraph.viewOf('geometry', MODEL).graph === false, 'and the geometry view counts it, as a table');
    assert.ok(ifcGraph.isGeometry(['Entity', 'IfcGeometricRepresentationItem', 'IfcRepresentationItem', 'IfcExtrudedAreaSolid']) && ifcGraph.isGeometry(['StepBlock']) && !ifcGraph.isGeometry(WALL_LABELS), 'what counts as geometry');
    assert.equal(ifcGraph.quote("a'b\\c"), "'a\\'b\\\\c'");
    assert.ok(ifcGraph.stepFrom('neighbours', "x' OR 1=1").includes("'x\\' OR 1=1'"), 'an id is a literal');
    assert.ok(ifcGraph.element("g'1", MODEL).includes("GlobalId: 'g\\'1'"), 'a guid is a literal');
    for (const step of ['neighbours', 'properties', 'issues']) { const key = 'ifcgraph.act.' + step; assert.ok(t(key) !== key && t(key + '.hint') !== key + '.hint', key); }
    assert.equal(ifcGraph.limitOf('MATCH (n) RETURN n LIMIT 25;'), 25); assert.equal(ifcGraph.limitOf('MATCH (n) RETURN n'), null);
    return 'ok';
  });

  test('ifc graph: stored hashes never reach a table or a graph', async (assert) => {
    assert.deepEqual(ifcGraph.redact({ a: 1, password_hash: 'x', secret_hash: 'y', token_hash: 'z', code_hash: 'w', nested: { list: [{ token_hash: 'q', keep: true }] } }), { a: 1, nested: { list: [{ keep: true }] } });
    assert.equal(ifcGraph.redact('$argon2id$v=19$abc'), null, 'an Argon2 hash anywhere');
    assert.equal(ifcGraph.isProtected('u.password_hash'), true); assert.equal(ifcGraph.isProtected('token_hash'), true); assert.equal(ifcGraph.isProtected('u.name'), false); assert.equal(ifcGraph.isProtected('zipcode'), false);
    const out = neo4j.answerToTable(answerFor('MATCH (u:User) RETURN u'));
    const text = JSON.stringify(out);
    assert.ok(!text.includes('argon2') && !text.includes('password_hash'), 'nothing of the hash: ' + text.slice(0, 300));
    assert.equal(out.graph.nodes[0].properties.username, 'admin', 'the rest of the node stays');
    assert.ok(out.columns.includes('u.username') && !out.columns.includes('u.password_hash'), 'and no column for it');
    const cols = { columns: ['x.password_hash', 'map'], rows: [['abc', { token_hash: 'def', ok: 1 }]] };
    const scalar = neo4j.answerToTable(cols);
    assert.equal(scalar.rows[0][0], null, 'a column asked for by name');
    assert.equal(scalar.rows[0][1], '{"ok":1}', 'and a map');
    return 'ok';
  });

  test('ifc graph: the graph query\'s JSON and the driver\'s records give the same table and graph, paths included', async (assert) => {
    const answer = answerFor('MATCH (n)-[r]->(m) RETURN n, r, m');
    const viaJson = neo4j.answerToTable(answer);
    const fake = fakeLib();
    const source = await boltSource();
    const viaBolt = await withDriver(fake, () => neo4j.run(source, 'MATCH (n)-[r]->(m) RETURN n, r, m'));
    assert.deepEqual(viaJson.columns, viaBolt.columns);
    assert.deepEqual(viaJson.graph.nodes, viaBolt.graph.nodes, 'the same nodes either way');
    assert.deepEqual(viaJson.graph.edges, viaBolt.graph.edges, 'the same edges either way');
    assert.equal(fake.calls[0].access, 'READ', 'always a read session');
    assert.ok(fake.calls[0].tx.timeout > 0, 'with a time limit on the server');
    const wall = viaJson.graph.nodes.find((n) => n.id === idOf('wall'));
    assert.equal(wall.label, 'IfcWallStandardCase'); assert.equal(wall.name, 'YVT-A');
    assert.deepEqual(wall.properties.etiketter, WALL_LABELS, 'all the labels stay');
    assert.equal(wall.properties.Description, undefined, 'an empty attribute is left out');
    assert.equal(viaJson.graph.nodes.find((n) => n.id === idOf('topic')).properties.etiketter, undefined, 'a node with one label needs no list');
    assert.equal(viaJson.truncated, false); assert.equal(viaBolt.truncated, false);
    const paths = neo4j.answerToTable({ columns: ['p'], rows: [[{ nodes: [jsonNode('project'), jsonNode('agg')], relationships: [jsonRel(relBy('r1'))], length: 1 }]], truncated: true });
    assert.equal(paths.graph.nodes.length, 2); assert.equal(paths.graph.edges[0].type, 'IS_DECOMPOSED_BY'); assert.equal(paths.truncated, true);
    assert.equal(paths.rows[0][0], t('neo4j.path', { n: 1 }));
    const empty = neo4j.answerToTable({ columns: ['a', 'b'], rows: [] });
    assert.deepEqual(empty.columns, ['a', 'b'], 'an empty answer keeps its columns'); assert.equal(empty.graph, null);
    const none = await withDriver(fakeLib(() => ({ columns: ['a'], rows: [] })), () => neo4j.run(source, 'MATCH (n) RETURN n.a AS a'));
    assert.deepEqual(none.columns, ['a'], 'also over Bolt');
    const point = (x, y, z) => ({ srid: int(z === undefined ? 7203 : 9157), x, y, z });
    const points = await withDriver(fakeLib(() => ({ columns: ['c', 'p'], rows: [[[point(0, 0, 0), point(1, 0, 0.5)], point(2, 3)]] })), () => neo4j.run(source, 'MATCH (n) RETURN n.CoordList AS c, n.Location AS p'));
    assert.equal(points.rows[0][0], '["0 0 0","1 0 0.5"]', 'a point list reads as coordinates'); assert.equal(points.rows[0][1], '2 3', 'a 2D point as two');
    return 'ok';
  });

  test('ifc graph: a box kept as a list of numbers (Grafeo) reads as a point does, and every other list stays a list', async (assert) => {
    const wall = { identity: '4:db:70', labels: WALL_LABELS, properties: { ifc_class: 'IfcWall', GlobalId: 'G70', bbox_min: [0, 0, 0], bbox_max: [1.5, 0.2, 3], bbox_centre: [0.75, 0.1], CoordList: [1, 2, 3], bbox_note: [1, 'a', 2], bbox_many: [1, 2, 3, 4] } };
    const out = neo4j.answerToTable({ columns: ['w', 'd.bbox_centre', 'c'], rows: [[wall, [0.75, 0.1, 1.5], [1, 2, 3]]] });
    const p = out.graph.nodes[0].properties;
    assert.equal(p.bbox_min, '0 0 0'); assert.equal(p.bbox_max, '1.5 0.2 3', 'three numbers as x y z'); assert.equal(p.bbox_centre, '0.75 0.1', 'two as x y');
    assert.deepEqual(p.CoordList, [1, 2, 3], 'another property keeps its list');
    assert.deepEqual(p.bbox_note, [1, 'a', 2], 'a list that is not all numbers stays a list'); assert.deepEqual(p.bbox_many, [1, 2, 3, 4], 'and so do four numbers');
    const at = (c) => out.rows[0][out.columns.indexOf(c)];
    assert.equal(at('w.bbox_max'), '1.5 0.2 3', 'the column of a node\'s box'); assert.equal(at('w.CoordList'), '[1,2,3]');
    assert.equal(at('d.bbox_centre'), '0.75 0.1 1.5', 'a box asked for by name'); assert.equal(at('c'), '[1,2,3]', 'a list under another name');
    const fromDriver = neo4j.recordsToTable([{ keys: ['w'], get: () => ({ identity: int(1), elementId: '4:db:71', labels: ['Entity', 'IfcWall'], properties: { bbox_min: [int(0), int(1), int(2)], Tags: [int(1), int(2)] } }) }], fakeHelpers);
    assert.equal(fromDriver.graph.nodes[0].properties.bbox_min, '0 1 2', 'integers from a driver as well');
    assert.deepEqual(fromDriver.graph.nodes[0].properties.Tags, [1, 2]);
    return 'ok';
  });

  test('ifc graph: the ready-made queries are those that work in the graph store, and those with spatial points only in Neo4j and Memgraph', async (assert) => {
    const ids = (list) => list.map((q) => q.id);
    const all = ids(neo4j.EXAMPLES);
    assert.ok(all.includes('nearby'));
    assert.deepEqual(ids(neo4j.queriesFor('')), all, 'nothing announced: every query, as before');
    assert.deepEqual(ids(neo4j.queriesFor('neo4j')), all, 'Neo4j has spatial points');
    assert.deepEqual(ids(neo4j.queriesFor('memgraph')), all, 'and so has Memgraph');
    assert.deepEqual(ids(neo4j.queriesFor('grafeo')), all.filter((id) => id !== 'nearby'), 'Grafeo keeps a box as a list: no distance between points');
    assert.deepEqual(ids(neo4j.queriesFor('postgresql')), ids(neo4j.queriesFor('grafeo')), 'nor another store');
    assert.ok(neo4j.EXAMPLES.every((q) => !!q.spatial === /point\./.test(q.cypher)), 'exactly the queries with point functions are marked');
    assert.deepEqual(ids(neo4j.queriesFor('grafeo', ifcGraph.VIEWS)), ids(ifcGraph.VIEWS), 'the views of a model need no points');
    const wb = D.require('ui/api/graph-workbench');
    const offered = (store) => {
      const view = wb.create({ connector: { id: 'g', name: 'g', baseUrl: 'bolt://h:1' }, hint: '', store, run: async () => ({ columns: [], rows: [], graph: null }) });
      view.start();
      const list = /** @type {any} */ (view.el.querySelector('[data-neo4j-example]')).options.map((o) => o.value).filter(Boolean);
      view.destroy();
      return list;
    };
    assert.deepEqual(offered(undefined), all, 'the workbench offers every query when nothing is announced');
    assert.deepEqual(offered('grafeo'), all.filter((id) => id !== 'nearby'), 'and leaves the spatial one out over Grafeo');
    return 'ok';
  });

  test('ifc graph: what only writes the file back stays out of what is shown and saved, and can still be asked for by name', async (assert) => {
    assert.deepEqual(ifcGraph.readable(['Entity', 'IfcWall'], { Name: 'A', NominalValue: '3', NominalValue__type: 'IFCLABEL', Representation__step: 1234, text: 'stays on an entity' }), { Name: 'A', NominalValue: '3', text: 'stays on an entity' });
    assert.deepEqual(ifcGraph.readable(['StepBlock'], { id: 'm:1', first_step: 1, instances: 40, text: 'x'.repeat(1000) }), { id: 'm:1', first_step: 1, instances: 40 });
    const wall = { identity: '4:db:1', labels: WALL_LABELS, properties: { ifc_class: 'IfcWallStandardCase', Name: 'YVT-A', GlobalId: 'G', Representation__step: 1234, ObjectPlacement__step: 77 } };
    const prop = { identity: '4:db:2', labels: NODES.gtin.labels, properties: { ifc_class: 'IfcPropertySingleValue', Name: 'GTIN', NominalValue: '7350', NominalValue__type: 'IFCLABEL' } };
    const block = { identity: '4:db:3', labels: ['StepBlock'], properties: { id: 'm:1', first_step: 1, instances: 40, text: 'x'.repeat(100000) } };
    const rel = { identity: '5:db:9', type: 'HAS_PROPERTIES', start: '4:db:1', end: '4:db:2', properties: { position: 0 } };
    const out = neo4j.answerToTable({ columns: ['w', 'r', 'p', 'b', 'namngiven'], rows: [[wall, rel, prop, block, 'IFCLABEL']] });
    assert.ok(!JSON.stringify(out.graph).includes('__step') && !JSON.stringify(out.graph).includes('__type'), 'not in a saved graph');
    assert.ok(!out.columns.some((c) => /__(type|step)$/.test(c)), 'nor among the columns: ' + out.columns.join(','));
    assert.ok(JSON.stringify(out).length < 5000, 'and the block\'s text does not come along: ' + JSON.stringify(out).length);
    assert.equal(out.graph.nodes.find((n) => n.label === 'StepBlock').properties.instances, 40, 'the block itself can still be seen');
    assert.equal(out.graph.edges[0].properties.position, 0, 'the order of a list is worth seeing');
    assert.equal(out.graph.nodes.find((n) => n.id === '4:db:2').name, 'GTIN: 7350', 'a typed value still shows its value');
    assert.equal(out.rows[0][out.columns.indexOf('namngiven')], 'IFCLABEL', 'what a query names by itself it gets');
    const named = neo4j.answerToTable({ columns: ['p.NominalValue__type', 'b.text'], rows: [['IFCLABEL', 'STEP']] });
    assert.deepEqual(named.rows[0], ['IFCLABEL', 'STEP'], 'also by those very names');
    assert.ok(ifcGraph.stepFrom('neighbours', 'x').includes('NOT m:StepBlock'), 'a step from a model does not walk into its blocks');
    return 'ok';
  });

  test('ifc graph: a query without a limit is cut in the browser and the rest of the stream is cancelled', async (assert) => {
    const many = { columns: ['n'], rows: Array.from({ length: 50 }, (_, i) => [i]) };
    const fake = fakeLib(() => many);
    const source = await boltSource();
    const out = await withDriver(fake, () => neo4j.run(source, 'MATCH (n) RETURN n', { maxRows: 10 }));
    assert.equal(out.rows.length, 10); assert.equal(out.truncated, true);
    assert.equal(fake.calls[0].cancelled, true, 'the stream was left, not read to the end');
    const all = await withDriver(fakeLib(() => many), () => neo4j.run(source, 'MATCH (n) RETURN n', { maxRows: 50 }));
    assert.equal(all.rows.length, 50); assert.equal(all.truncated, false, 'exactly the limit is not cut');
    return 'ok';
  });

  test('ifc graph: errors the user can act on are told in the user\'s words', async (assert) => {
    const source = await boltSource();
    const failing = (code) => ({ lib: Object.assign({}, fakeLib().lib, { driver: () => ({ session: () => ({ run: () => ({ [Symbol.asyncIterator]() { return { next: async () => { throw Object.assign(new Error('raw driver text'), { code }); } }; } }), close: async () => {} }), close: async () => {} }) }) });
    const down = await withDriver(failing('ServiceUnavailable'), () => neo4j.run(source, 'MATCH (n) RETURN n').catch((e) => e));
    assert.equal(down.message, t('neo4j.err.unavailable', { host: '127.0.0.1:7707' }));
    const denied = await withDriver(failing('Neo.ClientError.Security.Unauthorized'), () => neo4j.run(source, 'MATCH (n) RETURN n').catch((e) => e));
    assert.equal(denied.message, t('neo4j.err.unauthorized', { host: '127.0.0.1:7707' }));
    const syntax = await withDriver(failing('Neo.ClientError.Statement.SyntaxError'), () => neo4j.run(source, 'MATCH').catch((e) => e));
    assert.equal(syntax.message, 'raw driver text', 'the database explains its own syntax errors');
    return 'ok';
  });

  test('ifc graph: the workbench lists the models, draws a view with Cytoscape, grows from a node and saves what it shows', async (assert) => {
    const fake = fakeLib();
    const source = await boltSource();
    const view = D.require('ui/api/neo4j-view').create({ connector: source, log() {}, onDataset: (m) => made.datasets.push(m.id) });
    const host = onPage(view);
    try {
      await withDriver(fake, async () => {
        view.start();
        assert.equal(fake.calls.length, 0, 'nothing is sent until the user asks');
        /** @type {any} */ (view.el.querySelector('[data-ifcgraph-models] button')).click();
        await waitFor(() => view.state.models, 5000, 'the models');
        assert.equal(view.state.modelId, MODEL, 'the newest version is chosen');
        const modelSel = /** @type {any} */ (view.el.querySelector('[data-ifcgraph-model]'));
        assert.equal(modelSel.options.length, 2);
        assert.ok(view.el.textContent.includes(t('ifcgraph.models.waiting', { n: '1' })) && view.el.textContent.includes(t('ifcgraph.models.failed', { n: '1' })), 'it says what is not ready');
        // A view runs when it is chosen, and the drawing shows the families.
        const viewSel = /** @type {any} */ (view.el.querySelector('[data-ifcgraph-view]'));
        viewSel.value = 'spatial'; viewSel.dispatchEvent(new Event('change', { bubbles: true }));
        const drawing = await waitFor(() => view.drawing(), 30000, 'the drawing');
        assert.equal(drawing.cy.nodes().length, 3); assert.equal(drawing.cy.edges().length, 2);
        assert.equal(drawing.layout, 'dagre', 'a hierarchy is drawn as one');
        const canvas = /** @type {any} */ (view.el.querySelector('[data-graph-canvas]'));
        assert.ok(canvas.clientHeight >= 320 && canvas.querySelector('canvas').width > 0, 'it has a size on the page');
        const places = drawing.cy.nodes().map((n) => n.position());
        assert.ok(new Set(places.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size === 3, 'the nodes do not lie on top of each other');
        assert.deepEqual(drawing.legend().map((l) => l.key).sort(), ['ifc:relation', 'ifc:spatial']);
        assert.ok(view.el.querySelector('[data-graph-legend]').textContent.includes(t('ifcgraph.family.spatial')), 'the legend in words');
        assert.ok(view.el.querySelector('dm-table'), 'and the table under it');
        assert.equal(view.state.result.name, `three_walls_gtin.ifc: ${t('ifcgraph.view.spatial')}`);
        // Selecting a node shows it in the inspector.
        drawing.cy.getElementById(idOf('storey')).emit('tap');
        assert.equal(view.state.selected.id, idOf('storey'));
        const panel = view.inspector(); host.appendChild(panel); // dm-kv draws its rows on the page
        assert.equal(panel.getAttribute('data-graph-selected'), idOf('storey'));
        assert.ok(panel.textContent.includes('1. etasje') && panel.textContent.includes('IfcBuildingStorey'), 'name and class');
        assert.ok(panel.querySelector('[data-ifcgraph-act="properties"]'), 'a product can show its properties');
        drawing.cy.getElementById(idOf('agg')).emit('tap');
        assert.ok(!view.inspector().querySelector('[data-ifcgraph-act="properties"]'), 'a relationship has only neighbours');
        // Growing: what is new is added to the drawing and to what is saved.
        view.state.selected = { kind: 'node', id: idOf('wall'), data: { id: idOf('wall'), namn: 'YVT-A', etikett: 'IfcWallStandardCase', egenskaper: Object.assign({ etiketter: WALL_LABELS }, NODES.wall.properties) } };
        assert.ok(await view.act('neighbours') > 0, 'neighbours added');
        assert.ok(drawing.cy.getElementById(idOf('wall')).nonempty() && drawing.cy.getElementById(idOf('rel')).nonempty());
        assert.ok(fake.calls[fake.calls.length - 1].text.includes(`elementId(n) = '${idOf('wall')}'`), 'asked for that node');
        const before = view.state.result.graph.nodes.length;
        await view.act('properties');
        assert.ok(view.state.result.graph.nodes.some((n) => n.id === idOf('gtin')), 'the properties came');
        assert.equal(drawing.cy.nodes().length, view.state.result.graph.nodes.length, 'the drawing and the graph agree');
        assert.ok(view.state.result.graph.nodes.length > before);
        assert.equal(await view.act('properties'), 0, 'asked twice, nothing new');
        await view.act('issues');
        assert.ok(view.state.result.graph.edges.some((e) => e.type === 'IFC_GUID' && e.target === idOf('wall')), 'the issue reaches the wall through the line the app draws');
        assert.ok(view.el.querySelector('[data-graph-count]').textContent.includes(String(view.state.result.graph.nodes.length)), 'the count follows');
        // A double-click does the same.
        const calls = fake.calls.length;
        drawing.cy.getElementById(idOf('topic')).emit('dbltap');
        await waitFor(() => fake.calls.length > calls, 5000, 'the double-click');
        await waitFor(() => !view.state.acting, 5000, 'the step to end');
        // The layout can be changed, and the labels turned off, without asking the server.
        const askedBefore = fake.calls.length;
        const layoutSel = /** @type {any} */ (view.el.querySelector('[data-graph-layout]'));
        layoutSel.value = 'circle'; layoutSel.dispatchEvent(new Event('change', { bubbles: true }));
        assert.equal(drawing.layout, 'circle'); assert.equal(fake.calls.length, askedBefore);
        // A table-only view has no drawing and leaves none behind.
        await view.saveGraph('IFC-graf prov');
        const saved = (await datasets.list()).find((d) => d.name === 'IFC-graf prov');
        assert.ok(saved && saved.kind === 'graph' && saved.source.cypher && saved.source.connector === source.id, 'saved as a graph with its source');
        made.datasets.push(saved.id);
        assert.equal(saved.graph.nodes, view.state.result.graph.nodes.length, 'with everything that was drawn');
        assert.ok(saved.graph.labels.some((l) => l.name === 'IfcWallStandardCase'), 'and classes as its labels');
        assert.ok(!saved.graph.labels.some((l) => l.name === 'Entity'), 'not Entity for everything');
        await view.showView('classes');
        assert.equal(view.drawing(), null, 'counts are a table');
        assert.ok(!view.el.querySelector('[data-graph-canvas]'), 'without a canvas');
        assert.equal(view.state.result.rows[0][0], 'IfcWallStandardCase');
        // An answer at its limit says so.
        const limited = await withDriver(fakeLib(() => ({ columns: ['n'], rows: [[1], [2]] })), async () => { view.state.query = ''; const e = view.el.querySelector('dm-code'); /** @type {any} */ (e).value = 'MATCH (n) RETURN n.a LIMIT 2'; await view.run(); return view.el.querySelector('[data-graph-limit]'); });
        assert.ok(limited && limited.textContent === t('ifcgraph.limit', { n: '2' }), 'the limit is told');
      });
    } finally { view.destroy(); host.remove(); }
    return 'ok';
  }, 90000);

  test('ifc graph: an answer that names only nodes shows how they hang together, as in Neo4j Browser', async (assert) => {
    const seen = [];
    const answer = (text) => (/IN \$ids/.test(text) ? answerFor('all') : { columns: ['c', 'w'], rows: [[jsonNode('component'), jsonNode('wall')]] });
    const wb = D.require('ui/api/graph-workbench');
    const view = wb.create({ connector: { id: 'x', name: 'x', baseUrl: 'bolt://h:1' }, hint: '', run: async (text, options) => { seen.push({ text, options }); return neo4j.answerToTable(answer(text)); } });
    const host = onPage(view);
    try {
      view.start();
      await view.run();
      const g = view.state.result.graph;
      assert.equal(g.nodes.length, 2, 'the same two nodes, none added');
      assert.deepEqual(g.edges.map((e) => e.type), ['IFC_GUID'], 'and the line the app draws between them, since the server has none');
      assert.deepEqual(seen[1].options.params.ids.sort(), [idOf('component'), idOf('wall')].sort(), 'asked about exactly those');
      assert.equal(view.drawing().cy.edges().length, 1, 'drawn');
    } finally { view.destroy(); host.remove(); }
    // A failing second question costs only the lines; an answer with its own relationships asks nothing more.
    let asked = 0;
    const view2 = wb.create({ connector: { id: 'y', name: 'y', baseUrl: 'bolt://h:1' }, hint: '', run: async (text) => { asked++; if (/IN \$ids/.test(text)) throw new Error('nope'); return neo4j.answerToTable({ columns: ['c', 'w'], rows: [[jsonNode('component'), jsonNode('wall')]] }); } });
    view2.start();
    await view2.run();
    assert.equal(view2.state.error, ''); assert.equal(asked, 2); assert.equal(view2.state.result.graph.nodes.length, 2);
    let asked3 = 0;
    const view3 = wb.create({ connector: { id: 'z', name: 'z', baseUrl: 'bolt://h:1' }, hint: '', run: async () => { asked3++; return neo4j.answerToTable(answerFor('all')); } });
    view3.start();
    await view3.run();
    assert.equal(asked3, 1, 'nothing more to ask');
    return 'ok';
  }, 60000);

  test('ifc graph: a graph too large to draw is still a table and can be saved, and growth stops at the same size', async (assert) => {
    const wb = D.require('ui/api/graph-workbench');
    const big = { nodes: Array.from({ length: wb.MAX_DRAWN + 1 }, (_, i) => ({ id: 'n' + i, label: 'X', name: 'n' + i, properties: {} })), edges: [], directed: true };
    const view = wb.create({ connector: { id: 'x', name: 'x', baseUrl: 'bolt://h:1' }, hint: '', run: async () => ({ columns: ['n'], rows: [['n0']], graph: big, truncated: false }) });
    const host = onPage(view);
    try {
      view.start();
      await view.run();
      assert.equal(view.drawing(), null, 'not drawn');
      assert.ok(!view.el.querySelector('[data-graph-canvas]'), 'no canvas');
      assert.ok(view.el.textContent.includes(t('ifcgraph.toobig', { n: D.require('ui/i18n').formatNumber(wb.MAX_DRAWN + 1) })), 'it says why');
      assert.ok(view.el.querySelector('[data-graph-save]'), 'and it can be saved');
    } finally { view.destroy(); host.remove(); }
    return 'ok';
  }, 30000);

  // ------------------------------------------------------------------------------------------- an OpenCDE source's card
  const BASE = 'dataspatium-asset://tests/ifcgraph';
  const REDIRECT = 'http://127.0.0.1:8080/oauth-callback.html';
  const json = (data, status) => ({ kind: 'text', data: JSON.stringify(data), status });
  const world = { caps: null, queries: [], scope: '' };
  const spied = [];
  const realRequest = http.request;
  http.request = (req) => { if (String(req.url).startsWith(BASE)) spied.push(req); return realRequest(req); };
  D.net.virtual('tests/ifcgraph/', (url) => {
    const path = url.slice(BASE.length).split('?')[0].split('#')[0] || '/';
    const init = spied[spied.length - 1] || {};
    const r = (x) => Promise.resolve(x);
    if (path === '/.well-known/dataregium') return r(world.caps ? json(world.caps) : json({ message: 'Not Found' }, 404));
    if (path === '/foundation/versions') return r(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'documents', version_id: '1.0' }] }));
    if (path === '/foundation/1.0/auth') return r(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token', oauth2_revocation_url: BASE + '/foundation/oauth2/revoke' }));
    if (path === '/foundation/oauth2/token') return r(json({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, scope: world.scope }));
    if (path === '/foundation/oauth2/revoke') return r({ kind: 'text', data: '' });
    if (path === '/foundation/1.0/current-user') return r(json({ id: 'u1', name: 'Admin' }));
    if (path === '/bcf/3.0/projects') return r(json([{ project_id: 'p1', name: 'Bygglovet' }]));
    if (/^\/bcf\/3\.0\/projects\/p1/.test(path)) return r(json({ project_id: 'p1', name: 'Bygglovet', authorization: { project_actions: [] } }));
    if (path === '/admin/api/graph/query') { const body = JSON.parse(init.body); world.queries.push(body.cypher); return r(json(Object.assign({ truncated: false }, answerFor(body.cypher)))); }
    if (path === '/admin/api/overview') return r(json({ version: '2.6.0', graph_ok: true, users: 1, projects: 1, clients: 1, sessions: 1, topics: 0, documents: 0, models: 1, request_log: { enabled: false, rows: 0 } }));
    return r(json({ message: 'Not Found', code: 'not_found' }, 404));
  });
  const fakePopup = (url) => { const u = new URL(url); world.scope = u.searchParams.get('scope') || ''; return Promise.resolve(`${u.searchParams.get('redirect_uri')}?code=abc&state=${u.searchParams.get('state')}`); };
  const capsWith = (extensions) => ({ server: { name: 'Dataregium', version: '2.6.0' }, apis: { bcf: '3.0' }, scopes: ['profile', 'bcf', 'documents', 'admin'], extensions, limits: {}, links: {} });
  let cdeSource = null;
  async function cardView(caps) {
    world.caps = caps;
    if (!cdeSource) { cdeSource = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector; made.connectors.push(cdeSource.id); }
    await opencde.capabilities(cdeSource, { force: true });
    const view = D.require('ui/api/opencde-view').create({ connector: cdeSource, ctx: {}, log() {}, onDataset: (m) => made.datasets.push(m.id), onConnector() {} });
    const host = onPage(view);
    view.start();
    return { view, host, card: () => view.el.querySelector('[data-ifcgraph-card]') };
  }
  const settle = (view) => waitFor(() => view.state.caps, 5000, 'the capabilities');

  test('ifc graph: the card in an OpenCDE source follows what the server says it has', async (assert) => {
    // A server without a graph has no card.
    let v = await cardView(capsWith({}));
    await settle(v.view);
    assert.equal(v.card().hidden, true, 'no graph, no card');
    v.view.destroy(); v.host.remove();
    // A graph behind neither door: it says who can open one.
    v = await cardView(capsWith({ ifcgraph: { enabled: true, bolt: null } }));
    await settle(v.view);
    assert.equal(v.card().hidden, false);
    assert.ok(v.card().textContent.includes(t('ifcgraph.card.closed')), 'closed from here');
    assert.ok(!v.card().querySelector('[data-ifcgraph-signin]'), 'no administrator can help');
    assert.ok(v.card().querySelector('[data-ifcgraph-bolt]'), 'but a Neo4j source can');
    v.view.destroy(); v.host.remove();
    // Bolt announced: the address is told, and offered to the dialog.
    v = await cardView(capsWith({ ifcgraph: { enabled: true, bolt: 'bolt+s://dataregium.example.org:7687' } }));
    await settle(v.view);
    assert.ok(v.card().textContent.includes(t('ifcgraph.card.bolt', { url: 'bolt+s://dataregium.example.org:7687' })), 'the announced address');
    v.view.destroy(); v.host.remove();
    return 'ok';
  }, 30000);

  test('ifc graph: with the graph query the card signs in as an administrator and draws through the server, nothing over Bolt', async (assert) => {
    const caps = capsWith({ ifcgraph: { enabled: true, bolt: null }, graph_query: { enabled: true, url: '/admin/api/graph/query', max_rows: 1000, timeout_seconds: 10 }, admin_api: { enabled: true, url: '/admin/api' } });
    const v = await cardView(caps);
    try {
      await settle(v.view);
      assert.ok(v.card().textContent.includes(t('ifcgraph.card.signin')), 'it asks for an administrator');
      assert.ok(v.card().querySelector('[data-ifcgraph-signin]'), 'with the button');
      assert.ok(!v.card().querySelector('[data-graph-workbench]'), 'and no workbench before that');
      await opencde.login(cdeSource, { popup: fakePopup, redirectUri: REDIRECT });
      await admin.signInAsAdmin(cdeSource, { popup: fakePopup, redirectUri: REDIRECT });
      assert.ok(admin.hasAdminScope(cdeSource));
      const bench = await waitFor(() => (v.card().querySelector('[data-graph-workbench]') ? v.view.graph() : null), 5000, 'the workbench after the sign-in');
      const before = world.queries.length;
      await bench.loadModels();
      assert.equal(world.queries.length, before + 1, 'the models were asked through the server');
      assert.equal(bench.state.modelId, MODEL);
      await bench.showView('spatial');
      const drawing = await waitFor(() => bench.drawing(), 30000, 'the drawing');
      assert.equal(drawing.cy.nodes().length, 3, 'drawn from the JSON answer');
      assert.equal(v.view.inspector(), null, 'nothing selected');
      drawing.cy.getElementById(idOf('storey')).emit('tap');
      assert.ok(v.view.inspector(), 'the source passes the selection on to the inspector');
      await bench.saveGraph('Graf via servern');
      const saved = (await datasets.list()).find((d) => d.name === 'Graf via servern');
      made.datasets.push(saved.id);
      assert.equal(saved.source.via, 'admin', 'it remembers the way');
      const way = await graphSource.forDataset(saved);
      assert.ok(way && way.host, 'and finds it again');
      const asked = world.queries.length;
      const out = await way.run('MATCH (n)-[r]->(m) RETURN n, r, m');
      assert.equal(world.queries.length, asked + 1); assert.ok(out.graph.nodes.length > 3);
    } finally { v.view.destroy(); v.host.remove(); }
    return 'ok';
  }, 90000);

  test('ifc graph: the capabilities name the graph store, and the card offers only the queries that work there', async (assert) => {
    const query = { graph_query: { enabled: true, url: '/admin/api/graph/query', max_rows: 1000, timeout_seconds: 10 }, admin_api: { enabled: true, url: '/admin/api' } };
    const storeIn = async (extensions) => { world.caps = capsWith(extensions); await opencde.capabilities(cdeSource, { force: true }); return opencde.graphStore(cdeSource); };
    if (!cdeSource) { cdeSource = (await families.createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector; made.connectors.push(cdeSource.id); }
    assert.equal(await storeIn({ ifcgraph: { enabled: true, graph_store: 'neo4j' } }), 'neo4j');
    assert.equal(await storeIn({ ifcgraph: { enabled: true, graph_store: 'Memgraph' } }), 'memgraph', 'in lower case');
    assert.equal(await storeIn({ ifcgraph: { enabled: true } }), '', 'a server that does not say');
    assert.equal(await storeIn({}), '', 'nor without a graph');
    assert.equal(opencde.graphStoreOf(null), '');
    if (!admin.hasAdminScope(cdeSource)) { await opencde.login(cdeSource, { popup: fakePopup, redirectUri: REDIRECT }); await admin.signInAsAdmin(cdeSource, { popup: fakePopup, redirectUri: REDIRECT }); }
    const offered = async (ifcgraph) => {
      const v = await cardView(capsWith(Object.assign({ ifcgraph }, query)));
      try {
        await settle(v.view);
        const sel = await waitFor(() => v.card().querySelector('[data-neo4j-example]'), 5000, 'the workbench');
        return /** @type {any} */ (sel).options.map((o) => o.value).filter(Boolean);
      } finally { v.view.destroy(); v.host.remove(); }
    };
    const grafeo = await offered({ enabled: true, bolt: null, graph_store: 'grafeo' });
    assert.ok(grafeo.length && !grafeo.includes('nearby'), 'over Grafeo no query needs spatial points: ' + grafeo.join(','));
    assert.ok((await offered({ enabled: true, bolt: null, graph_store: 'memgraph' })).includes('nearby'), 'over Memgraph it is there');
    assert.ok((await offered({ enabled: true, bolt: null })).includes('nearby'), 'and when nothing is announced');
    return 'ok';
  }, 60000);

  test('ifc graph: a model from a CDE opens its graph, on a Neo4j source of the same machine if there is one', async (assert) => {
    assert.equal(graphSource.machineOf('127.0.0.1:8010'), 'localhost'); assert.equal(graphSource.machineOf('LOCALHOST:7707'), 'localhost'); assert.equal(graphSource.machineOf('[::1]:7707'), 'localhost'); assert.equal(graphSource.machineOf('dataregium.example.org:443'), 'dataregium.example.org');
    const cde = { connectorId: cdeSource.id, host: 'dataregium.example.org', documentId: 'doc-1', versionIndex: 1 };
    assert.equal((await graphSource.connectorFor(cde)).id, cdeSource.id, 'no Neo4j source there: the CDE source itself');
    const bolt = await boltSource('bolt://dataregium.example.org:7687');
    assert.equal((await graphSource.connectorFor(cde)).id, bolt.id, 'a Neo4j source on the same machine goes first');
    assert.equal(await graphSource.connectorFor({ connectorId: 'gone', host: 'nowhere.example.org' }), null);
    // The request goes through the store, and is taken once by the source it names.
    let state = {};
    const activated = [];
    const ctx = { store: { get: () => state, set: (p) => { state = Object.assign({}, state, p); } }, shell: { activate: (m) => activated.push(m), log() {} }, ui: { button: D.require('ui/basic').button, toast: overlays.toast } };
    const ds = { id: 'm1', kind: 'model', name: 'a.ifc', model: { format: 'ifc' }, source: { cde } };
    assert.equal(await graphSource.open(ctx, ds, { guid: 'G1' }), true);
    assert.deepEqual(activated, ['inhamta']);
    assert.equal(state.pendingSource.family, 'neo4j'); assert.equal(state.pendingSource.baseUrl, bolt.baseUrl);
    assert.equal(graphSource.takeLink(ctx, { id: 'someone-else' }), null, 'not for another source');
    const link = graphSource.takeLink(ctx, bolt);
    assert.equal(link.guid, 'G1'); assert.equal(link.documentId, 'doc-1');
    assert.equal(graphSource.takeLink(ctx, bolt), null, 'taken once');
    // The view follows it: that document's model, that element.
    const fake = fakeLib();
    state.pendingGraph = { connectorId: bolt.id, documentId: 'doc-1', versionIndex: 1, guid: '1Xezbq735AdBO_4DerG66G' };
    const view = D.require('ui/api/neo4j-view').create({ connector: bolt, ctx, log() {} });
    const host = onPage(view);
    try {
      await withDriver(fake, async () => {
        view.start();
        const drawing = await waitFor(() => view.drawing(), 30000, 'the element drawn');
        assert.equal(view.state.modelId, 'model-0', 'the version the file came from');
        assert.ok(fake.calls[fake.calls.length - 1].text.includes("GlobalId: '1Xezbq735AdBO_4DerG66G', model_id: 'model-0'"), 'that element in that model');
        assert.ok(drawing.cy.getElementById(idOf('wall')).nonempty());
      });
    } finally { view.destroy(); host.remove(); }
    // The card in Hantera has the button for an IFC model, not for a DXF drawing.
    const insight = D.require('ui/kinds/insight-cards');
    assert.ok(insight.cdeCard(ctx, ds).querySelector('[data-cde-graph]'), 'an IFC model has it');
    assert.ok(!insight.cdeCard(ctx, Object.assign({}, ds, { model: { format: 'dxf' } })).querySelector('[data-cde-graph]'), 'a DXF drawing has no graph');
    return 'ok';
  }, 60000);

  // ------------------------------------------------------------------------------------------------- the saved copy
  test('ifc graph: on a saved graph the local Cypher finds a wall by any of its classes, and Analysera can ask the server instead', async (assert) => {
    const answer = neo4j.answerToTable(answerFor('MATCH (n)-[r]->(m) RETURN n, r, m'));
    const source = await boltSource();
    const meta = await graph.createGraphDataset({ name: 'IFC-kopia', graph: answer.graph, source: graphSource.sourceOf(source, 'MATCH (n)-[r]->(m) RETURN n, r, m') });
    made.datasets.push(meta.id);
    const byClass = await cypher.run(meta.id, 'MATCH (w:IfcWall) RETURN w.Name AS namn, w.GlobalId AS guid');
    assert.deepEqual(byClass.rows, [['YVT-A', '1Xezbq735AdBO_4DerG66G']], 'an IfcWallStandardCase is an IfcWall');
    assert.equal((await cypher.run(meta.id, 'MATCH (w:IfcWallStandardCase) RETURN w.Name')).rows.length, 1, 'and its own class');
    assert.equal((await cypher.run(meta.id, 'MATCH (w:IfcSlab) RETURN w.Name')).rows.length, 0, 'but not another');
    const report = await cypher.run(meta.id, "MATCH (w:IfcWall)-[:IS_DEFINED_BY]->(:IfcRelDefinesByProperties)-[:RELATING_PROPERTY_DEFINITION]->(:IfcPropertySet {Name: 'Reuse'})-[:HAS_PROPERTIES]->(p:IfcPropertySingleValue {Name: 'GTIN'}) RETURN w.GlobalId, w.Name, p.NominalValue");
    assert.deepEqual(report.rows, [['1Xezbq735AdBO_4DerG66G', 'YVT-A', '7350000000017']], 'the query from Dataregium\'s documentation, on the copy');
    const optional = await cypher.run(meta.id, 'MATCH (t:Topic) OPTIONAL MATCH (t)-[:HAS_VIEWPOINT]->(v:Viewpoint) RETURN t.title, v.guid');
    assert.deepEqual(optional.rows, [['Check the reuse marking', 'v-1']], 'labels inside OPTIONAL MATCH too');
    const plain = cypher.translate('MATCH (a:Person) RETURN a.name');
    assert.ok(plain.sql.includes("etikett = 'Person'") && !plain.sql.includes('json_each'), 'other graphs keep the short SQL');
    // The tab Cypher offers the server when the dataset knows the way.
    const fake = fakeLib();
    const list = await datasets.list();
    const ctx = { store: { get: () => ({ datasets: list, selectedId: meta.id }), set() {} }, ui: { button: D.require('ui/basic').button, icon: D.require('ui/icons').icon, toast: overlays.toast }, shell: { log() {} } };
    const panel = D.require('ui/analysis/graph-panel').create(ctx, { mode: 'cypher' });
    const parts = panel.center();
    const host = document.createElement('div');
    host.append(parts.head, ...parts.body);
    document.body.appendChild(host);
    try {
      const sw = await waitFor(() => host.querySelector('[data-cypher-server]'), 5000, 'the switch');
      assert.ok(sw.getAttribute('label') || sw.textContent, 'it has a label');
      /** @type {any} */ (host.querySelector('dm-code')).value = 'MATCH (m:Model) WITH m RETURN m.id AS id, m.file_name AS fil, m.state AS tillstand, m.version_index AS version, m.entities AS entiteter, m.relationships AS relationer, m.schema AS schema, m.error AS fel, m.document_id AS dokument, m.project_id AS projekt, m.done_at AS klar';
      await withDriver(fake, async () => {
        panel.state.onServer = true;
        await panel.runCypher();
      });
      assert.equal(fake.calls.length, 1, 'WITH is not in the subset, so this could only run on the server');
      assert.equal(panel.state.result.rows.length, 4); assert.equal(panel.state.error, '');
      assert.ok(panel.state.result.note.includes('127.0.0.1:7707'), 'and it says from where');
      /** @type {any} */ (host.querySelector('dm-code')).value = 'MATCH (w:IfcWall) RETURN w.Name';
      panel.state.onServer = false;
      await panel.runCypher();
      assert.equal(fake.calls.length, 1, 'turned off, the copy answers');
      assert.deepEqual(panel.state.result.rows, [['YVT-A']]);
      assert.ok(panel.state.result.sql.includes('select'), 'with its SQL shown');
      panel.destroy();
    } finally { host.remove(); }
    // A table, or a graph with no way back, has no switch.
    assert.equal(await graphSource.forDataset({ source: null }), null);
    assert.equal(await graphSource.forDataset({ source: { cypher: 'x', connector: 'gone' } }), null);
    assert.equal(await graphSource.forDataset({ source: { cypher: 'x', connector: source.id, via: 'admin' } }), null, 'the way through the server needs the scope');
    return 'ok';
  }, 60000);

  test('ifc graph: cleanup', async () => {
    for (const id of made.datasets) { try { await datasets.remove(id, { quiet: true }); } catch (_e) { /* removed earlier */ } }
    for (const id of made.connectors) { try { await connectors.remove(id); } catch (_e) { /* removed earlier */ } }
    return 'ok';
  });
})();
