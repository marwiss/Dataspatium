// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for graph datasets (kind "graph"): the exchange formats both ways (GraphML, GEXF, node-link JSON, Cypher
 * scripts), the graph dataset with its edges, neighbourhoods, subgraphs and layout, the import through io/import and
 * the export formats, the Cypher subset translated to SQL, the measures worker, graphs built from two tables, and
 * the graph view and tabs in the app. Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const graph = D.require('data/graph');
  const cypher = D.require('analysis/cypher');
  const measures = D.require('analysis/graph');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const exporter = D.require('io/export');
  const t = D.require('ui/i18n').t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
  }
  /** A small social graph: three people, one city, four edges of two types. */
  const SAMPLE = () => ({ directed: true, nodes: [
    { id: 'p1', label: 'Person', name: 'Anna', properties: { name: 'Anna', age: 34, city: 'Stockholm' } },
    { id: 'p2', label: 'Person', name: 'Bo', properties: { name: 'Bo', age: 41 } },
    { id: 'p3', label: 'Person', name: 'Cecilia', properties: { name: 'Cecilia', age: 29, tags: ['a', 'b'] } },
    { id: 'c1', label: 'City', name: 'Stockholm', properties: { name: 'Stockholm', population: 984748 } },
    { id: 'x9', label: '', name: 'x9', properties: {} },
  ], edges: [
    { id: 'e1', source: 'p1', target: 'p2', type: 'KNOWS', properties: { since: 2001 } },
    { id: 'e2', source: 'p2', target: 'p3', type: 'KNOWS', properties: { since: 2010 } },
    { id: 'e3', source: 'p1', target: 'c1', type: 'LIVES_IN', properties: {} },
    { id: 'e4', source: 'p3', target: 'c1', type: 'LIVES_IN', properties: { since: 2020 } },
  ] });
  const ids = [];
  async function sampleDataset(name) { const meta = await graph.createGraphDataset({ name: name || 'Testgraf', graph: SAMPLE(), source: { kind: 'test' } }); ids.push(meta.id); return meta; }

  test('graph: GraphML, GEXF, node-link JSON and Cypher scripts round-trip through the parsers and writers', (assert) => {
    const g = graph.normalise(SAMPLE());
    assert.equal(g.nodes.length, 5); assert.equal(g.edges.length, 4);
    for (const format of ['graphml', 'gexf', 'nodelink', 'cypher']) {
      const text = graph.write(format, g);
      assert.equal(graph.detectText(text.slice(0, 4000)), format, 'detected ' + format);
      const back = graph.parse(format, text);
      assert.equal(back.nodes.length, 5, format + ' nodes'); assert.equal(back.edges.length, 4, format + ' edges ' + JSON.stringify(back.edges.map((e) => e.source + '>' + e.target)));
      const anna = back.nodes.find((n) => n.id === 'p1');
      assert.ok(anna && anna.label === 'Person' && anna.name === 'Anna' && Number(anna.properties.age) === 34, format + ' Anna: ' + JSON.stringify(anna));
      const e1 = back.edges.find((e) => e.source === 'p1' && e.target === 'p2');
      assert.ok(e1 && e1.type === 'KNOWS' && Number(e1.properties.since) === 2001, format + ' edge: ' + JSON.stringify(e1));
      assert.ok(back.directed, format + ' directed');
    }
    // Cypher as APOC writes it: labels, UNIQUE IMPORT ID, MATCH … CREATE relationships; plain CREATE scripts too.
    const apoc = graph.parseCypherScript('CREATE (:Person:`UNIQUE IMPORT LABEL` {name:"Åsa", `UNIQUE IMPORT ID`:7});\nCREATE (:Person:`UNIQUE IMPORT LABEL` {name:"Örjan", `UNIQUE IMPORT ID`:8});\nMATCH (n1:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`:7}), (n2:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`:8}) CREATE (n1)-[:KNOWS {since:1999}]->(n2);');
    assert.deepEqual(apoc.nodes.map((n) => [n.id, n.label, n.name]), [['7', 'Person', 'Åsa'], ['8', 'Person', 'Örjan']]);
    assert.deepEqual(apoc.edges.map((e) => [e.source, e.target, e.type, e.properties.since]), [['7', '8', 'KNOWS', 1999]]);
    const plain = graph.parseCypherScript("CREATE (a:Person {name: 'A'}), (b:Person {name: 'B'}), (a)-[:KNOWS]->(b), (b)-[:KNOWS {w: 2}]->(a)");
    assert.equal(plain.nodes.length, 2); assert.equal(plain.edges.length, 2); assert.equal(plain.edges[1].properties.w, 2);
    // D3 style links with object references and Cytoscape elements.
    const d3 = graph.parseNodeLink({ nodes: [{ id: 'a', group: 'G' }, { id: 'b', group: 'H' }], links: [{ source: { id: 'a' }, target: { id: 'b' }, value: 3 }] });
    assert.equal(d3.nodes[0].label, 'G'); assert.equal(d3.edges[0].properties.value, 3);
    const cyto = graph.parseNodeLink({ elements: { nodes: [{ data: { id: 'n1', label: 'Nod 1' } }, { data: { id: 'n2' } }], edges: [{ data: { id: 'e', source: 'n1', target: 'n2' } }] } });
    assert.equal(cyto.nodes.length, 2); assert.equal(cyto.edges.length, 1);
    // Dangling edges are dropped; the summary counts labels and types.
    const dangling = graph.normalise({ nodes: [{ id: 'a' }], edges: [{ source: 'a', target: 'zzz' }] });
    assert.equal(dangling.edges.length, 0);
    const sum = graph.summarise(g);
    assert.deepEqual(sum.labels.map((l) => [l.name, l.count]), [['Person', 3], ['', 1], ['City', 1]]);
    assert.deepEqual(sum.types.map((l) => [l.name, l.count]), [['KNOWS', 2], ['LIVES_IN', 2]]);
    return 'ok';
  });

  test('graph: a graph dataset keeps nodes, edges and layout; a GraphML file imports through io/import and exports in four formats', async (assert) => {
    const meta = await sampleDataset('Testgraf');
    assert.equal(meta.kind, 'graph'); assert.equal(meta.rowCount, 5); assert.equal(meta.graph.edges, 4); assert.equal(meta.graph.labels[0].name, 'Person');
    const nodes = await graph.nodes(meta.id, { label: 'Person' });
    assert.deepEqual(nodes.map((n) => n.name), ['Anna', 'Bo', 'Cecilia']);
    assert.equal((await graph.nodes(meta.id, { search: 'ceci' }))[0].id, 'p3');
    const edges = await graph.edges(meta.id, { type: 'KNOWS' });
    assert.equal(edges.length, 2); assert.equal(edges[0].properties.since, 2001);
    assert.deepEqual((await graph.edges(meta.id, { ids: ['c1'] })).map((e) => e.id).sort(), ['e3', 'e4']);
    const hood = await graph.neighborhood(meta.id, ['p1'], 1);
    assert.deepEqual(hood.sort(), ['c1', 'p1', 'p2']);
    assert.deepEqual((await graph.neighborhood(meta.id, ['p1'], 2)).sort(), ['c1', 'p1', 'p2', 'p3']);
    const sub = await graph.subgraph(meta.id, ['p1', 'p2', 'c1']);
    assert.equal(sub.nodes.length, 3); assert.deepEqual(sub.edges.map((e) => e.id).sort(), ['e1', 'e3']);
    await graph.layoutSet(meta.id, [['p1', 10, 20], ['p2', 30, 40]]);
    const layout = await graph.layoutGet(meta.id);
    assert.deepEqual(layout.get('p2'), [30, 40]);
    const whole = await graph.whole(meta.id);
    assert.equal(whole.nodes.length, 5); assert.equal(whole.edges.length, 4); assert.ok(whole.directed);
    // Import: .graphml by extension, node-link JSON sniffed from the head; both become graph datasets with the original kept.
    const file = new File([graph.toGraphML(graph.normalise(SAMPLE()))], 'social.graphml', { type: 'application/xml' });
    const p = await importer.preview(file, {});
    assert.equal(p.importer, 'graph'); assert.equal(p.kind, 'graph'); assert.equal(p.graphFormat, 'graphml'); assert.equal(p.totalRows, 5); assert.equal(p.graph.edges, 4);
    const m2 = await importer.run(file, {}, null, null); ids.push(m2.id);
    assert.equal(m2.kind, 'graph'); assert.equal(m2.name, 'social'); assert.equal(m2.rowCount, 5); assert.equal(m2.graph.edges, 4);
    assert.ok((await D.require('data/dataset-files').list(m2.id)).some((f) => f.name === 'social.graphml'), 'original kept');
    const jsonFile = new File([graph.toNodeLink(graph.normalise(SAMPLE()))], 'social.json', { type: 'application/json' });
    const p2 = await importer.preview(jsonFile, {});
    assert.equal(p2.importer, 'graph', 'node-link JSON sniffed'); assert.equal(p2.graphFormat, 'nodelink');
    // Export formats: graph formats only for graphs; every one writes the whole graph.
    assert.deepEqual(exporter.formatsFor(meta).filter((f) => f.kind).map((f) => f.id), ['graphml', 'gexf', 'graph-json', 'cypher', 'graph-csv']);
    assert.ok(!exporter.formatsFor({ kind: 'table' }).some((f) => f.kind), 'tables get no graph formats');
    for (const f of ['graphml', 'gexf', 'graph-json', 'cypher']) {
      const out = await exporter.exportDataset(meta.id, f);
      const text = await out.blob.text();
      assert.ok(text.length > 100 && /Cecilia/.test(text), f + ' exported ' + out.filename);
      assert.equal(graph.parse(f === 'graph-json' ? 'nodelink' : f, text).edges.length, 4, f + ' re-read');
    }
    const table = graph.toTable(whole.edges, 'edges');
    assert.deepEqual(table.columns, ['id', 'kalla', 'mal', 'typ', 'since']); assert.equal(table.rows[0][4], 2001);
    return 'ok';
  });

  test('graph: the Cypher subset translates to SQL and answers on the dataset', async (assert) => {
    const meta = await sampleDataset('Cyphergraf');
    const run = (q) => cypher.run(meta.id, q);
    let r = await run('MATCH (n:Person) RETURN count(*) AS antal');
    assert.deepEqual(r.columns, ['antal']); assert.deepEqual(r.rows, [[3]]); assert.ok(/from data as n1/.test(r.sql) && /n1\.etikett = 'Person'/.test(r.sql), r.sql);
    r = await run('MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.namn AS fran, b.namn AS till, r.since ORDER BY r.since');
    assert.deepEqual(r.rows, [['Anna', 'Bo', 2001], ['Bo', 'Cecilia', 2010]]);
    r = await run("MATCH (a:Person) WHERE a.age > 30 AND a.name STARTS WITH 'A' RETURN a.name, a.city");
    assert.deepEqual(r.rows, [['Anna', 'Stockholm']]);
    r = await run('MATCH (p:Person)-[:LIVES_IN]->(c:City {name: "Stockholm"}) RETURN p.name ORDER BY p.name DESC');
    assert.deepEqual(r.rows, [['Cecilia'], ['Anna']]);
    r = await run('MATCH (a)-[r]->(b) RETURN labels(a) AS fran, type(r) AS rel, labels(b) AS till, count(*) AS n ORDER BY n DESC, rel');
    assert.deepEqual(r.rows, [['Person', 'KNOWS', 'Person', 2], ['Person', 'LIVES_IN', 'City', 2]]);
    r = await run('MATCH (n:Person) OPTIONAL MATCH (n)-[k:KNOWS]->(m) RETURN n.name, count(k) AS ut ORDER BY n.name');
    assert.deepEqual(r.rows, [['Anna', 1], ['Bo', 1], ['Cecilia', 0]], JSON.stringify(r.rows) + '\n' + r.sql);
    r = await run("MATCH (a:Person {name: 'Anna'})-[*1..2]->(b) RETURN DISTINCT b.name ORDER BY b.name");
    assert.deepEqual(r.rows, [['Bo'], ['Cecilia'], ['Stockholm']], JSON.stringify(r.rows) + '\n' + r.sql);
    assert.ok(/with recursive walk1/.test(r.sql), 'variable length uses a recursive CTE');
    r = await run("MATCH (a:Person)-[*1..3]-(b:Person) WHERE a.name = 'Cecilia' RETURN DISTINCT b.name ORDER BY b.name");
    assert.deepEqual(r.rows, [['Anna'], ['Bo']], 'undirected walk without revisits: ' + JSON.stringify(r.rows));
    r = await run('MATCH (n) RETURN n LIMIT 2');
    assert.deepEqual(r.columns, ['n_id', 'n_etikett', 'n_namn', 'n_egenskaper']); assert.equal(r.rows.length, 2);
    r = await run("MATCH (p:Person) WHERE p.name IN ['Bo', 'Anna'] RETURN collect(p.name) AS namn, avg(p.age) AS alder, max(p.age) AS aldst");
    assert.equal(JSON.parse(r.rows[0][0]).sort().join(','), 'Anna,Bo'); assert.equal(r.rows[0][1], 37.5); assert.equal(r.rows[0][2], 41);
    r = await run('MATCH (n:Person) RETURN n.name, exists(n.city) AS harstad, toUpper(n.name) AS stort, id(n) AS id ORDER BY n.name SKIP 1 LIMIT 1');
    assert.deepEqual(r.rows, [['Bo', 0, 'BO', 'p2']]);
    r = await run('MATCH (a:Person) WHERE NOT (a)-[:KNOWS]->() RETURN a.name').catch((e) => e);
    assert.ok(r instanceof Error, 'pattern predicates are outside the subset');
    for (const [q, re] of [['CREATE (n:Person {name: "Ny"}) RETURN n', /CREATE/], ['MATCH (n) RETURN m.name', /m/], ['MATCH (n) WHERE n.name =~ "A.*" RETURN n.name', /=~/], ['MATCH (n)', /RETURN/]]) {
      const err = await run(q).catch((e) => e);
      assert.ok(err instanceof Error && re.test(err.message), q + ' → ' + (err && err.message));
    }
    const ex = cypher.examples(meta.graph);
    assert.ok(ex.length >= 4 && /MATCH \(n:Person\)/.test(ex[0]), ex[0]);
    for (const q of ex) { const out = await run(q); assert.ok(Array.isArray(out.rows), 'example runs: ' + q); }
    return 'ok';
  });

  test('graph: the measures worker gives degrees, components, shortest paths and a summary', async (assert) => {
    const meta = await sampleDataset('Måttgraf');
    const deg = await measures.degrees(meta.id);
    const by = Object.fromEntries(deg.map((r) => [r[0], r]));
    assert.deepEqual(by.p1.slice(1), [2, 0, 2]); assert.deepEqual(by.c1.slice(1), [0, 2, 2]); assert.deepEqual(by.x9.slice(1), [0, 0, 0]);
    const comp = await measures.components(meta.id);
    assert.equal(comp.count, 2); assert.deepEqual(comp.sizes, [4, 1]);
    const members = Object.fromEntries(comp.members);
    assert.equal(members.p1, 1); assert.equal(members.c1, 1); assert.equal(members.x9, 2);
    const path = await measures.shortestPath(meta.id, 'p1', 'c1');
    assert.ok(path.found && path.length === 1 && path.path.join('>') === 'p1>c1', JSON.stringify(path));
    const path2 = await measures.shortestPath(meta.id, 'p1', 'p3');
    assert.deepEqual(path2.path, ['p1', 'p2', 'p3']);
    const none = await measures.shortestPath(meta.id, 'p3', 'p1');
    assert.ok(!none.found && none.reason === 'none', 'directed: no way back');
    const und = await measures.shortestPath(meta.id, 'p3', 'p1', true);
    assert.ok(und.found && und.length === 2, 'undirected finds it: ' + JSON.stringify(und));
    const sum = await measures.summary(meta.id);
    assert.equal(sum.nodes, 5); assert.equal(sum.edges, 4); assert.equal(sum.isolated, 1); assert.equal(sum.components, 2); assert.equal(sum.largestComponent, 4); assert.equal(sum.maxDegree, 2);
    assert.ok(Math.abs(sum.density - 4 / 20) < 1e-9, 'density ' + sum.density);
    assert.equal(sum.top[0][1], 2);
    return 'ok';
  });

  test('graph: two tables become a graph; nodes and edges come back as tables', async (assert) => {
    const nodesDs = await datasets.create({ name: 'Städer', columns: [{ name: 'kod', type: 'text' }, { name: 'namn', type: 'text' }, { name: 'folkmangd', type: 'integer' }], rows: [['STO', 'Stockholm', 984748], ['GBG', 'Göteborg', 596841], ['MMA', 'Malmö', 362133]] });
    const edgesDs = await datasets.create({ name: 'Tågsträckor', columns: [{ name: 'fran', type: 'text' }, { name: 'till', type: 'text' }, { name: 'minuter', type: 'integer' }], rows: [['STO', 'GBG', 180], ['STO', 'MMA', 270], ['GBG', 'MMA', 150], ['MMA', 'KPH', 35]] });
    ids.push(nodesDs.id, edgesDs.id);
    const g = await graph.fromTables({ nodesId: nodesDs.id, nodeId: 'kod', nodeName: 'namn', edgesId: edgesDs.id, edgeSource: 'fran', edgeTarget: 'till', defaultLabel: 'Stad', defaultType: 'TÅG', directed: false, createMissing: true });
    assert.equal(g.nodes.length, 4, 'KPH created from the edges'); assert.equal(g.edges.length, 4); assert.ok(!g.directed);
    const sto = g.nodes.find((n) => n.id === 'STO');
    assert.equal(sto.name, 'Stockholm'); assert.equal(sto.label, 'Stad'); assert.equal(sto.properties.folkmangd, 984748);
    assert.equal(g.edges[0].properties.minuter, 180); assert.equal(g.edges[0].type, 'TÅG');
    const meta = await graph.createGraphDataset({ name: 'Tågnät', graph: g }); ids.push(meta.id);
    assert.equal(meta.graph.directed, false);
    const r = await cypher.run(meta.id, "MATCH (a:Stad {name: 'Stockholm'})-[t:TÅG]-(b) RETURN b.namn AS stad, t.minuter AS min ORDER BY min");
    assert.deepEqual(r.rows, [['Göteborg', 180], ['Malmö', 270]], 'undirected edges match both ways: ' + JSON.stringify(r.rows));
    const sum = await measures.summary(meta.id);
    assert.ok(Math.abs(sum.density - (2 * 4) / (4 * 3)) < 1e-9, 'undirected density ' + sum.density);
    const nt = graph.toTable(await graph.nodes(meta.id), 'nodes');
    assert.deepEqual(nt.columns, ['id', 'etikett', 'namn', 'folkmangd']);
    assert.deepEqual(graph.typedColumns(nt).map((c) => c.type), ['text', 'text', 'text', 'integer']);
    return 'ok';
  });

  test('graph: the app opens a graph as a graph view in Bearbeta, lists it in Hantera and gives the Cypher and Graf tabs in Analysera', async (assert) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null;
    const buttonByText = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const tabByText = (text) => /** @type {any} */ (Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).find((e) => e.textContent.trim() === text));
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      const file = new File([graph.toGraphML(graph.normalise(SAMPLE()))], 'ui-graf.graphml', { type: 'application/xml' });
      meta = await importer.run(file, {}, null, 'UI-graf');
      const ds = await waitFor(() => shell.store.get().datasets.find((d) => d.id === meta.id), 5000, 'dataset in store');
      assert.equal(ds.kind, 'graph'); assert.equal(ds.graph.edges, 4);
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      await waitFor(() => root.querySelector('.dm-graph-view canvas'), 20000, 'cytoscape canvas');
      assert.ok(Array.from(root.querySelectorAll('.dm-graph-view canvas')).every((c) => c.getBoundingClientRect().width > 0), 'the graph canvases have their width on screen');
      assert.ok(globalThis.cytoscape && globalThis.cytoscapeFcose && globalThis.cytoscapeExpandCollapse, 'graph libraries loaded on demand');
      await waitFor(() => root.querySelectorAll('.dm-right .dm-graph-legend li').length >= 3, 5000, 'legend with labels');
      assert.ok(buttonByText(t('bearbeta.view.table')), 'table button');
      // Search finds Cecilia and focuses on her neighbourhood.
      const search = /** @type {any} */ (root.querySelector('.dm-right dm-input'));
      search.value = 'Cecilia'; search.dispatchEvent(new Event('input'));
      buttonByText(t('common.search')).click();
      await waitFor(() => root.querySelectorAll('.dm-right .dm-graph-hits .dm-list-item').length === 1, 5000, 'one hit');
      /** @type {HTMLElement} */ (root.querySelector('.dm-right .dm-graph-hits .dm-list-item')).click();
      await waitFor(() => root.querySelector('.dm-right .dm-graph-hits') === null || /Cecilia/.test(root.querySelector('.dm-right').textContent), 5000, 'focus');
      buttonByText(t('bearbeta.view.table')).click();
      await waitFor(() => root.querySelectorAll('dm-table .dm-tr').length === 5, 5000, 'five node rows');
      shell.activate('hantera');
      await waitFor(() => buttonByText(t('hantera.view.graph')), 5000, 'Visa graf button');
      assert.ok(/4 kanter|4 edges/.test(root.querySelector('.dm-center').textContent), 'edge badge');
      shell.activate('analysera');
      await waitFor(() => tabByText(t('analysera.tabs.cypher')) && tabByText(t('analysera.tabs.graph')), 5000, 'Cypher and Graf tabs');
      const tabIds = Array.from(root.querySelectorAll('.dm-center dm-tabs [role="tab"]')).map((e) => e.textContent.trim());
      assert.ok(tabIds.indexOf(t('analysera.tabs.cypher')) === tabIds.indexOf(t('analysera.tabs.sql')) + 1, 'Cypher directly after SQL: ' + tabIds.join(','));
      assert.ok(tabIds.indexOf(t('analysera.tabs.graph')) > tabIds.indexOf(t('analysera.tabs.regex')), 'Graf after Regex');
      tabByText(t('analysera.tabs.cypher')).click();
      await waitFor(() => root.querySelector('.dm-center dm-code'), 5000, 'Cypher editor');
      const editor = /** @type {any} */ (root.querySelector('.dm-center dm-code'));
      editor.value = 'MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, b.name';
      editor.dispatchEvent(new Event('input'));
      buttonByText(t('common.run')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length === 2, 10000, 'two result rows');
      assert.ok(root.querySelector('.dm-tool-result .dm-graph-sql'), 'SQL shown');
      tabByText(t('analysera.tabs.graph')).click();
      await waitFor(() => tabByText(t('graph.tool.summary')), 5000, 'tool tabs');
      buttonByText(t('common.run')).click();
      await waitFor(() => root.querySelectorAll('.dm-tool-result dm-table .dm-tr').length >= 10, 10000, 'summary rows');
      return 'ok';
    } finally {
      if (meta) await datasets.remove(meta.id).catch(() => {});
      root.remove();
    }
  }, 120000);

  test('graph: cleanup', async (assert) => {
    measures.terminate();
    for (const id of ids) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
