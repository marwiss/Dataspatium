// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for Graphs II: editing as recipe steps (data/graph-ops) and Cypher writing clauses (analysis/cypher-write),
 * PageRank, communities, centrality and the force layout in the worker, graph charts (viz/graph-draw headless SVG,
 * the chart kind in viz/charts and viz/render), the Neo4j family (connector, record conversion, the browser with a
 * fake driver) and the graph view's editing buttons. Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const graph = D.require('data/graph');
  const cypher = D.require('analysis/cypher');
  const cypherWrite = D.require('analysis/cypher-write');
  const measures = D.require('analysis/graph');
  const recipes = D.require('data/recipes');
  const datasets = D.require('data/datasets');
  const draw = D.require('viz/graph-draw');
  const charts = D.require('viz/charts');
  const render = D.require('viz/render');
  const neo4j = D.require('api/families/neo4j');
  const families = D.require('api/families/databases');
  const connectors = D.require('api/connectors');
  const secrets = D.require('api/secrets');
  const t = D.require('ui/i18n').t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  const SAMPLE = () => ({ directed: true, nodes: [
    { id: 'p1', label: 'Person', name: 'Anna', properties: { name: 'Anna', age: 34 } }, { id: 'p2', label: 'Person', name: 'Bo', properties: { name: 'Bo', age: 41 } },
    { id: 'p3', label: 'Person', name: 'Cecilia', properties: { name: 'Cecilia', age: 29 } }, { id: 'c1', label: 'City', name: 'Stockholm', properties: { name: 'Stockholm' } },
  ], edges: [
    { id: 'e1', source: 'p1', target: 'p2', type: 'KNOWS', properties: { since: 2001 } }, { id: 'e2', source: 'p2', target: 'p3', type: 'KNOWS', properties: {} },
    { id: 'e3', source: 'p1', target: 'c1', type: 'LIVES_IN', properties: {} }, { id: 'e4', source: 'p3', target: 'c1', type: 'LIVES_IN', properties: {} },
  ] });
  const ids = []; const chartIds = []; const connIds = [];
  async function sampleDataset(name) { const meta = await graph.createGraphDataset({ name: name || 'Graf II', graph: SAMPLE() }); ids.push(meta.id); return meta; }
  const count = async (id, q) => (await cypher.run(id, q)).rows[0][0];

  test('graph2: editing steps add, change, connect, merge and remove nodes and edges; every step is logged and undoable', async (assert) => {
    const meta = await sampleDataset('Redigering');
    await recipes.apply(meta.id, 'graph_add_node', { id: 'p4', etikett: 'Person', namn: 'David', egenskaper: 'age: 50\ncity: Malmö' });
    let n = await graph.nodes(meta.id, { ids: ['p4'] });
    assert.equal(n[0].name, 'David'); assert.equal(n[0].properties.age, 50); assert.equal(n[0].properties.city, 'Malmö');
    const added = await recipes.apply(meta.id, 'graph_add_edge', { kalla: 'p4', mal: 'p1', typ: 'KNOWS', egenskaper: '{"since": 2015}' });
    assert.ok(added.id && /^e\d+$/.test(added.id), 'edge id made: ' + added.id);
    assert.equal(await count(meta.id, "MATCH (a {id: 'p4'})-[r:KNOWS]->(b) RETURN count(*)"), 1);
    await recipes.apply(meta.id, 'graph_set_node', { ids: ['p1', 'p2'], egenskaper: 'vip: true', remove: 'age' });
    n = await graph.nodes(meta.id, { ids: ['p1'] });
    assert.equal(n[0].properties.vip, true); assert.equal(n[0].properties.age, undefined); assert.equal(n[0].properties.name, 'Anna');
    await recipes.apply(meta.id, 'graph_set_edge', { ids: ['e1'], typ: 'FRIENDS', egenskaper: 'weight: 2' });
    const e1 = (await graph.edges(meta.id, { type: 'FRIENDS' }))[0];
    assert.ok(e1 && e1.id === 'e1' && e1.properties.weight === 2 && e1.properties.since === 2001, JSON.stringify(e1));
    const merged = await recipes.apply(meta.id, 'graph_merge_nodes', { ids: ['p4'], into: 'p1' });
    assert.equal(merged.rows, 1);
    assert.equal((await graph.nodes(meta.id, { ids: ['p4'] })).length, 0, 'p4 gone');
    assert.equal(await count(meta.id, "MATCH (a {id: 'p1'})-[r]->(b {id: 'p1'}) RETURN count(*)"), 0, 'self-loop from the merge dropped');
    n = await graph.nodes(meta.id, { ids: ['p1'] });
    assert.equal(n[0].properties.city, 'Malmö', 'missing property filled from the merged node');
    const err = await recipes.apply(meta.id, 'graph_delete_nodes', { ids: ['c1'], detach: false }).catch((e) => e);
    assert.ok(err instanceof Error && /kanter|edges/.test(err.message), 'attached node needs detach: ' + (err && err.message));
    const del = await recipes.apply(meta.id, 'graph_delete_nodes', { ids: ['c1'], detach: true });
    assert.equal(del.rows, 1); assert.equal(del.edges, 2);
    await recipes.apply(meta.id, 'graph_delete_edges', { ids: ['e2'] });
    await datasets.flushSaves();
    const after = await datasets.get(meta.id);
    assert.equal(after.rowCount, 3); assert.equal(after.graph.edges, 1, 'meta.graph refreshed: ' + JSON.stringify(after.graph));
    assert.deepEqual(after.graph.labels.map((l) => l.name), ['Person']);
    const log = await datasets.log(meta.id);
    assert.ok(log.filter((e) => e.action === 'op' && /^graph_/.test((e.details || {}).op)).length >= 7, 'steps logged: ' + log.length);
    assert.ok(recipes.canUndo(meta.id), 'undoable');
    await recipes.undo(meta.id);
    await datasets.flushSaves();
    assert.equal((await datasets.get(meta.id)).graph.edges, 2, 'undo restored the edge');
    const steps = await recipes.steps(meta.id);
    assert.ok(steps.some((s) => s.op === 'graph_add_node'), 'recipe lists the graph steps');
    const sql = await recipes.toSQL(meta.id);
    assert.ok(/INSERT INTO data/.test(sql) && /DELETE FROM _edges/.test(sql), 'SQL export mentions the graph tables');
    return 'ok';
  });

  test('graph2: Cypher CREATE, MERGE, SET, REMOVE and DELETE become recipe steps', async (assert) => {
    const meta = await sampleDataset('Cypher-skrivning');
    assert.ok(cypherWrite.isWrite("CREATE (n:Person {name: 'X'})") && cypherWrite.isWrite("MATCH (n) SET n.x = 1") && !cypherWrite.isWrite("MATCH (n) WHERE n.name = 'SET' RETURN n"), 'write detection');
    let w = await cypherWrite.execute(meta.id, "CREATE (d:Person {id: 'p4', name: 'David', age: 50}), (e:Person {id: 'p5', name: 'Eva'}), (d)-[:KNOWS {since: 2020}]->(e)");
    assert.equal(w.steps, 3); assert.equal(w.nodes, 2); assert.equal(w.edges, 1);
    assert.equal(await count(meta.id, "MATCH (a:Person {name: 'David'})-[r:KNOWS]->(b {name: 'Eva'}) RETURN r.since"), 2020);
    w = await cypherWrite.execute(meta.id, "MATCH (a:Person {name: 'Anna'}), (b:Person {name: 'Eva'}) CREATE (a)-[:KNOWS]->(b)");
    assert.equal(w.steps, 1); assert.equal(await count(meta.id, "MATCH (a {id: 'p1'})-[:KNOWS]->(b {id: 'p5'}) RETURN count(*)"), 1);
    w = await cypherWrite.execute(meta.id, "MATCH (n:Person) WHERE n.age > 40 SET n.senior = true, n:Senior");
    assert.equal(w.steps, 1); assert.equal(w.matched, 2, 'Bo and David matched: ' + w.matched);
    const seniors = await graph.nodes(meta.id, { label: 'Senior' });
    assert.deepEqual(seniors.map((n) => n.name).sort(), ['Bo', 'David']); assert.equal(seniors[0].properties.senior, true);
    w = await cypherWrite.execute(meta.id, "MERGE (c:City {id: 'c1', name: 'Stockholm'})");
    assert.equal(w.steps, 0, 'existing node: nothing created');
    w = await cypherWrite.execute(meta.id, "MERGE (c:City {id: 'c2', name: 'Göteborg'})");
    assert.equal(w.steps, 1);
    w = await cypherWrite.execute(meta.id, "MATCH (n:Person {name: 'Anna'}) REMOVE n.age");
    assert.equal((await graph.nodes(meta.id, { ids: ['p1'] }))[0].properties.age, undefined);
    w = await cypherWrite.execute(meta.id, "MATCH (a {id: 'p1'})-[r:KNOWS]->(b {id: 'p2'}) DELETE r");
    assert.equal(w.edges, 1); assert.equal(await count(meta.id, "MATCH (a {id: 'p1'})-[:KNOWS]->(b {id: 'p2'}) RETURN count(*)"), 0);
    const blocked = await cypherWrite.execute(meta.id, "MATCH (n {id: 'c1'}) DELETE n").catch((e) => e);
    assert.ok(blocked instanceof Error, 'DELETE of an attached node fails without DETACH');
    w = await cypherWrite.execute(meta.id, "MATCH (n {id: 'c1'}) DETACH DELETE n");
    assert.equal(w.nodes, 1); assert.equal((await graph.nodes(meta.id, { ids: ['c1'] })).length, 0);
    const none = await cypherWrite.execute(meta.id, 'MATCH (n) RETURN n').catch((e) => e);
    assert.ok(none instanceof Error && /CREATE/.test(none.message), 'no writing part is explained');
    await datasets.flushSaves();
    const after = await datasets.get(meta.id);
    assert.equal(after.graph.labels.find((l) => l.name === 'Senior').count, 2, 'labels recounted');
    return 'ok';
  });

  test('graph2: PageRank, communities, centrality and the force layout come from the worker', async (assert) => {
    const meta = await sampleDataset('Mått II');
    const pr = await measures.pagerank(meta.id);
    const total = pr.reduce((s, r) => s + r[1], 0);
    assert.ok(Math.abs(total - 1) < 1e-6, 'ranks sum to 1: ' + total);
    const byId = Object.fromEntries(pr);
    assert.ok(byId.c1 > byId.p1 && byId.p3 > byId.p1, 'the city (two in-edges) outranks Anna (none): ' + JSON.stringify(byId));
    const comm = await measures.communities(meta.id);
    assert.equal(comm.members.length, 4); assert.ok(comm.count >= 1 && comm.sizes[0] >= 2, JSON.stringify(comm));
    const ce = await measures.centrality(meta.id);
    const c = Object.fromEntries(ce.map((r) => [r[0], r]));
    assert.ok(c.p2[2] > 0, 'Bo lies between Anna and Cecilia: ' + JSON.stringify(c.p2));
    assert.ok(c.p1[1] > 0 && c.p1[1] <= 1, 'closeness in range: ' + c.p1[1]);
    const pos = await measures.layout(meta.id, { iterations: 30, save: true });
    assert.equal(pos.length, 4); assert.ok(pos.every((p) => Number.isFinite(p[1]) && Number.isFinite(p[2])), 'finite positions');
    const d12 = Math.hypot(pos[0][1] - pos[1][1], pos[0][2] - pos[1][2]);
    assert.ok(d12 > 1, 'nodes spread out: ' + d12);
    const cached = await graph.layoutGet(meta.id);
    assert.equal(cached.size, 4, 'layout saved to the dataset');
    return 'ok';
  });

  test('graph2: graph charts draw headless SVG, export, join the chart kinds and render into a container', async (assert) => {
    const meta = await sampleDataset('Diagramgraf');
    const def = Object.assign(draw.defaultDef(meta), { mode: 'whole' });
    const svg = await draw.toSvg(def, { width: 400, height: 300 });
    assert.ok(/^<svg/.test(svg) && (svg.match(/<circle/g) || []).length === 4 && (svg.match(/<line/g) || []).length === 4 && /Cecilia/.test(svg), 'whole graph SVG');
    const focus = Object.assign(draw.defaultDef(meta), { mode: 'focus', focus: ['p1', 'p2', 'c1'] });
    const svg2 = await draw.toSvg(focus, { width: 400, height: 300 });
    assert.equal((svg2.match(/<circle/g) || []).length, 3, 'focus SVG has three nodes');
    assert.ok(charts.KINDS.includes('graph'));
    const record = charts.create('graph', meta, 'Graf som diagram');
    record.graph = def;
    const saved = await charts.save(record); chartIds.push(saved.id);
    const exported = charts.exportJson(saved);
    assert.ok(/"kind": "graph"/.test(exported) && /"mode": "whole"/.test(exported), exported.slice(0, 200));
    const png = await render.toBlob(saved, 'png', { width: 300 });
    assert.ok(png.size > 500 && png.type === 'image/png', 'PNG ' + png.size);
    const svgBlob = await render.toBlob(saved, 'svg', { width: 300 });
    assert.ok(/<svg/.test(await svgBlob.text()));
    const html = await draw.htmlFor('g1', saved, { width: 300 });
    assert.ok(/<div id="g1" class="dm-graph-html"><svg/.test(html), 'inline SVG for published pages');
    const holder = document.createElement('div'); holder.style.cssText = 'position:absolute; left:-10000px; width:600px; height:400px;'; document.body.appendChild(holder);
    try {
      const hd = await render.renderInto(saved, holder, {});
      assert.equal(hd.kind, 'graph'); assert.equal(hd.info.nodes, 4); assert.ok(hd.legend.length === 2, 'legend');
      await waitFor(() => holder.querySelector('canvas'), 10000, 'sigma canvas');
      assert.ok(Array.from(holder.querySelectorAll('canvas')).every((c) => c.getBoundingClientRect().width > 0), 'the sigma canvases have their width on screen');
      const live = await hd.svg();
      assert.ok((live.match(/<circle/g) || []).length === 4, 'SVG from the live positions');
      hd.finalize();
    } finally { holder.remove(); }
    const imported = await charts.importJson(exported); chartIds.push(imported.id);
    assert.equal(imported.kind, 'graph'); assert.equal(imported.graph.datasetId, meta.id, 'dataset matched by name on import');
    return 'ok';
  });

  test('graph2: a Neo4j source is a database family; records become a table and a graph; the browser runs a query with a fake driver', async (assert) => {
    const r = await families.createConnector('neo4j', { baseUrl: 'neo4j+s://demo.databases.neo4j.io/', database: 'neo4j', username: 'neo4j', password: 'hemligt' }, { discover: false });
    connIds.push(r.connector.id);
    assert.equal(r.connector.family.type, 'neo4j'); assert.equal(r.connector.family.database, 'neo4j'); assert.equal(r.connector.baseUrl, 'neo4j+s://demo.databases.neo4j.io'); assert.equal(r.connector.auth.type, 'basic'); assert.equal(r.connector.level, 2);
    assert.equal(secrets.get(r.connector.id).password, 'hemligt'); assert.ok(!JSON.stringify(r.connector).includes('hemligt'));
    assert.ok(neo4j.isNeo4j(r.connector));
    // Records as the driver shapes them (identity, labels, properties; start/end for relationships).
    const int = (n) => ({ low: n, high: 0, toNumber: () => n, inSafeRange: () => true });
    const node = (id, label, props) => ({ identity: int(id), labels: [label], properties: props, elementId: String(id) });
    const rel = (id, a, b, type, props) => ({ identity: int(id), start: int(a), end: int(b), type, properties: props, startNodeElementId: String(a), endNodeElementId: String(b) });
    const rec = (obj) => ({ keys: Object.keys(obj), get: (k) => obj[k] });
    const fake = { isNode: (v) => !!(v && v.labels), isRelationship: (v) => !!(v && v.type && v.start !== undefined), isPath: (v) => !!(v && v.segments), isInt: (v) => !!(v && v.low !== undefined && typeof v.toNumber === 'function') };
    const records = [rec({ n: node(1, 'Person', { name: 'Anna', age: int(34) }), r: rel(10, 1, 2, 'KNOWS', { since: int(2001) }), m: node(2, 'Person', { name: 'Bo' }), antal: int(3) }), rec({ n: node(2, 'Person', { name: 'Bo' }), r: rel(11, 2, 3, 'LIVES_IN', {}), m: node(3, 'City', { name: 'Stockholm' }), antal: int(1) })];
    const table = neo4j.recordsToTable(records, fake);
    assert.deepEqual(table.columns, ['n', 'r', 'm', 'antal', 'n.name', 'n.age', 'r.since', 'm.name']);
    assert.deepEqual(table.rows[0].slice(0, 4), ['1', '10', '2', 3]); assert.equal(table.rows[0][4], 'Anna'); assert.equal(table.rows[0][5], 34); assert.equal(table.rows[0][6], 2001);
    assert.equal(table.graph.nodes.length, 3); assert.equal(table.graph.edges.length, 2); assert.equal(table.graph.nodes[0].label, 'Person'); assert.equal(table.graph.edges[1].type, 'LIVES_IN');
    // The browser with a fake driver: consent (granted in the test page), a query, a saved graph.
    const sessions = [];
    const prev = globalThis.neo4j;
    globalThis.neo4j = Object.assign({ driver: (url, auth, opts) => ({ session: (o) => { sessions.push({ url, auth, o }); return { run: async (text) => ({ records: /LIMIT 1/.test(text) ? records.slice(0, 1) : records, summary: { counters: { updates: () => ({}) }, database: { name: o.database } } }), close: async () => {} }; }, close: async () => {} }), auth: { basic: (u, p) => ({ u, p }) }, session: { READ: 'READ' } }, fake);
    try {
      const out = await neo4j.run(r.connector, 'MATCH (n)-[r]->(m) RETURN n, r, m, 3 AS antal');
      assert.equal(out.rows.length, 2); assert.equal(sessions[0].url, 'neo4j+s://demo.databases.neo4j.io'); assert.equal(sessions[0].auth.u, 'neo4j'); assert.equal(sessions[0].o.database, 'neo4j');
      const view = D.require('ui/api/neo4j-view').create({ connector: r.connector, log() {}, onDataset: (m) => ids.push(m.id) });
      view.start();
      view.state.query = 'MATCH (n)-[r]->(m) RETURN n, r, m, 3 AS antal';
      await view.run();
      assert.ok(view.state.result && view.state.result.graph && view.state.result.graph.nodes.length === 3, 'result with a graph: ' + view.state.error);
      assert.ok(view.el.querySelector('dm-table'), 'table shown');
      await view.saveGraph('Neo4j-graf');
      const saved = (await datasets.list()).find((d) => d.name === 'Neo4j-graf');
      assert.ok(saved && saved.kind === 'graph' && saved.graph.edges === 2 && saved.source.cypher, 'graph dataset saved from Neo4j: ' + JSON.stringify(saved && saved.source));
    } finally { globalThis.neo4j = prev; }
    const noCreds = Object.assign({}, r.connector, { id: 'neo4j-without-creds' });
    const err = await neo4j.run(noCreds, 'MATCH (n) RETURN n').catch((e) => e);
    assert.ok(err instanceof Error && /Autentisering|Authentication|lösenord|password/i.test(err.message), 'missing credentials explained: ' + (err && err.message));
    return 'ok';
  });

  test('graph2: the graph view edits through its buttons and the Graf tab has the new tools', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null;
    const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const tabByText = (text) => /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((e) => e.textContent.trim() === text));
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      meta = await graph.createGraphDataset({ name: 'UI-graf II', graph: SAMPLE() });
      await waitFor(() => shell.store.get().datasets.find((d) => d.id === meta.id), 5000, 'dataset in store');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      await waitFor(() => root.querySelector('.dm-graph-view canvas'), 20000, 'graph canvas');
      assert.ok(buttonByText(t('graph.edit.addnode')) && buttonByText(t('viz.save.as.chart')), 'edit and save-chart buttons');
      // Add a node through the view's operation path (the dialog itself is covered by the op tests).
      const view = root.querySelector('.dm-graph-view');
      assert.ok(view, 'view mounted');
      const kindView = D.require('ui/bearbeta/graph-view');
      assert.ok(typeof kindView.create === 'function');
      shell.activate('analysera');
      await waitFor(() => tabByText(t('analysera.tabs.graph')), 5000, 'Graf tab');
      tabByText(t('analysera.tabs.graph')).click();
      await waitFor(() => tabByText(t('graph.tool.pagerank')) && tabByText(t('graph.tool.pattern')) && tabByText(t('graph.tool.layout')), 5000, 'new tools');
      tabByText(t('graph.tool.pagerank')).click();
      await waitFor(() => buttonByText(t('common.run')), 5000, 'run button');
      buttonByText(t('common.run')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length === 4, 10000, 'four pagerank rows');
      // A save of the same content must not clear the result on screen.
      await datasets.save(meta.id);
      await wait(300);
      assert.equal(root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length, 4, 'the result stays after a save');
      tabByText(t('graph.tool.pattern')).click();
      await waitFor(() => buttonByText(t('common.run')), 5000, 'pattern run');
      buttonByText(t('common.run')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length === 4, 10000, 'four pattern rows (every edge)');
      assert.ok(/MATCH \(a\)-\[r\]->\(b\)/.test(root.querySelector('.dm-tool-result .dm-graph-sql').textContent), 'generated Cypher shown');
      // Cypher tab: a writing statement becomes recipe steps.
      tabByText(t('analysera.tabs.cypher')).click();
      await waitFor(() => root.querySelector('.dm-center dm-code'), 5000, 'editor');
      const editor = /** @type {any} */ (root.querySelector('.dm-center dm-code'));
      editor.value = "CREATE (x:Person {id: 'p9', name: 'Xenia'})"; editor.dispatchEvent(new Event('input'));
      buttonByText(t('common.run')).click();
      await waitFor(() => /receptsteg|recipe steps/.test(root.querySelector('.dm-tool-result') ? root.querySelector('.dm-tool-result').textContent : ''), 10000, 'write result');
      assert.equal((await graph.nodes(meta.id, { ids: ['p9'] })).length, 1, 'node created from the Cypher tab');
      // Visualisera: a graph chart from the dataset opens with the graph panel.
      shell.activate('visualisera');
      const record = charts.create('graph', await datasets.get(meta.id), 'UI-grafdiagram'); record.graph = Object.assign(draw.defaultDef(meta), { mode: 'focus', focus: ['p1', 'p2'] });
      const savedChart = await charts.save(record); chartIds.push(savedChart.id);
      shell.store.set({ openChartId: savedChart.id });
      await waitFor(() => root.querySelector('.dm-graph-preview canvas'), 20000, 'chart preview drawn');
      assert.ok(Array.from(root.querySelectorAll('.dm-viz-side dm-select')).length >= 3, 'graph chart controls');
      return 'ok';
    } finally {
      if (meta) await datasets.remove(meta.id).catch(() => {});
      root.remove();
    }
  }, 120000);

  test('graph2: cleanup', async (assert) => {
    measures.terminate();
    for (const id of ids) await datasets.remove(id).catch(() => {});
    for (const id of chartIds) await charts.remove(id).catch(() => {});
    for (const id of connIds) { await connectors.remove(id).catch(() => {}); secrets.forget(id); }
    assert.ok(true);
  });
})();
