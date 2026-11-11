// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the commands of decision F42 b: charts, maps and documents made from scratch, and the CDE calls against a stubbed
 * OpenCDE family (a saved source, signed in or not; the server's answers replaced). Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const commands = D.require('data/commands');
  const datasets = D.require('data/datasets');
  const charts = D.require('viz/charts');
  const documents = D.require('docgen/documents');
  const connectors = D.require('api/connectors');
  const opencde = D.require('api/families/opencde');
  const t = D.require('ui/i18n').t;
  const created = []; const chartIds = []; const docIds = [];
  const trusted = { trusted: true };

  test('commands: a chart, a map with a second layer and a document template are made from scratch, and a document becomes a file', async (assert) => {
    const meta = await datasets.create({ name: 'Kommandoprov diagram', columns: [{ name: 'kommun', type: 'text' }, { name: 'antal', type: 'integer' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }], rows: [['Ale', 10, 12.1, 57.9], ['Borås', 20, 12.9, 57.7]] });
    created.push(meta.id);
    const bar = await commands.run('create_chart', { dataset: meta.id, name: 'Antal per kommun', type: 'bar', x: 'kommun', y: 'antal', color: null, aggregate: 'sum' }, trusted);
    assert.ok(bar.ok, bar.error);
    chartIds.push(bar.result.id);
    const saved = await charts.get(bar.result.id);
    assert.ok(saved && saved.kind === 'vega' && saved.vega.type === 'bar' && saved.vega.state.x.field === 'kommun' && saved.vega.state.y.field === 'antal' && saved.vega.state.y.aggregate === 'sum', JSON.stringify(saved && saved.vega));
    const counted = await commands.run('create_chart', { dataset: meta.id, name: 'Rader per kommun', type: 'histogram', x: 'antal', y: null, color: null, aggregate: null }, trusted);
    assert.ok(counted.ok && (await charts.get(counted.result.id)).vega.state.y.aggregate === 'count', 'y null counts');
    chartIds.push(counted.result.id);
    const wrong = await commands.run('create_chart', { dataset: meta.id, name: 'x', type: 'radar', x: 'kommun', y: null, color: null, aggregate: null }, trusted);
    assert.ok(!wrong.ok && /radar|bar/.test(wrong.error), 'an unknown type is refused: ' + wrong.error);
    const noCol = await commands.run('create_chart', { dataset: meta.id, name: 'x', type: 'bar', x: 'saknas', y: null, color: null, aggregate: null }, trusted);
    assert.ok(!noCol.ok && noCol.error === t('commands.err.column', { name: 'saknas' }));
    const map = await commands.run('create_map', { dataset: meta.id, name: 'Kommunerna', basemap: 'osm' }, trusted);
    assert.ok(map.ok, map.error);
    chartIds.push(map.result.id);
    const mapChart = await charts.get(map.result.id);
    assert.ok(mapChart.kind === 'map' && mapChart.map.layers.length === 1 && mapChart.map.layers[0].datasetId === meta.id && mapChart.map.basemap === 'osm', JSON.stringify(mapChart.map && mapChart.map.layers));
    const more = await commands.run('add_map_layer', { chart: 'Kommunerna', dataset: meta.id }, trusted);
    assert.ok(more.ok && more.result.layers === 2, JSON.stringify(more));
    const notMap = await commands.run('add_map_layer', { chart: bar.result.id, dataset: meta.id }, trusted);
    assert.ok(!notMap.ok && notMap.error === t('commands.err.map.chart', { name: 'Antal per kommun' }));
    const plain = await datasets.create({ name: 'Kommandoprov utan platser', columns: [{ name: 'a', type: 'text' }], rows: [['x']] });
    created.push(plain.id);
    const noPlaces = await commands.run('create_map', { dataset: plain.id, name: 'x', basemap: null }, trusted);
    assert.ok(!noPlaces.ok && noPlaces.error === t('commands.err.map.places', { name: plain.name }));
    const doc = await commands.run('create_document', { name: 'Kommandoprov mall', body: '# {{datamangd}}\n\nDatamängden har {{antal_rader}} rader och {{antal_kolumner}} kolumner.\n' }, trusted);
    assert.ok(doc.ok, doc.error);
    docIds.push(doc.result.id);
    assert.ok((await documents.list()).some((d) => d.id === doc.result.id && d.name === 'Kommandoprov mall'));
    const made = await commands.run('make_document', { document: 'Kommandoprov mall', dataset: meta.id, format: 'html' }, trusted);
    assert.ok(made.ok, made.error);
    const name = made.result.files[0];
    assert.ok(/\.html$/.test(name), name);
    const file = commands.take(name);
    const html = await file.blob.text();
    assert.ok(/Kommandoprov diagram/.test(html) && /2 rader/.test(html), 'the rendered document holds the dataset\'s facts: ' + html.slice(0, 300));
    return 'ok';
  });

  test('commands: the CDE calls list the sources, refuse one that is not signed in, and go to the server through the family when it is', async (assert) => {
    const before = (await commands.run('list_cde_sources', {})).result.sources.length;
    // A source as the registry would list it, beside the real ones; the family's calls are replaced on the module.
    const connector = { id: 'cde-cmd-test', name: 'Kommandoserver', baseUrl: 'https://cde.example.test/', family: { type: 'opencde' }, endpoints: [], auth: { type: 'none' } };
    const realList = connectors.list;
    connectors.list = async (...args) => (await realList.apply(connectors, args)).concat([connector]);
    const stubbed = {};
    const stub = (name, fn) => { stubbed[name] = opencde[name]; opencde[name] = fn; };
    try {
      const listed = await commands.run('list_cde_sources', {});
      assert.ok(listed.ok && listed.result.sources.length === before + 1 && listed.result.sources.some((s) => s.id === 'cde-cmd-test' && s.host === 'cde.example.test' && s.signed_in === false), JSON.stringify(listed.result));
      const out = await commands.run('cde_projects', { source: 'Kommandoserver' });
      assert.ok(!out.ok && out.error === t('commands.err.cde.signin', { name: 'Kommandoserver' }), 'not signed in: ' + out.error);
      stub('signedIn', (c) => c.id === 'cde-cmd-test');
      stub('projects', async () => [{ project_id: 'p1', name: 'Bygglov' }, { project_id: 'p2', name: 'Rivning' }]);
      const topics = [{ guid: 'g1', server_assigned_id: 'ISSUE-0001', title: 'Spricka i vägg', topic_type: 'Issue', topic_status: 'Open', priority: 'High', labels: ['a', 'b'] }];
      stub('allTopics', async (_c, projectId) => (projectId === 'p1' ? topics : []));
      // fetchTopics calls the family's own allTopics inside the module, so it is replaced as a whole.
      stub('fetchTopics', async (_c, projectId) => ({ columns: ['server_assigned_id', 'guid', 'title', 'topic_status', 'labels'], rows: (projectId === 'p1' ? topics : []).map((x) => [x.server_assigned_id, x.guid, x.title, x.topic_status, x.labels.join(', ')]) }));
      const calls = [];
      stub('createTopic', async (_c, projectId, body) => { calls.push(['topic', projectId, body]); return Object.assign({ guid: 'g2', server_assigned_id: 'ISSUE-0002' }, body); });
      stub('createComment', async (_c, projectId, guid, body) => { calls.push(['comment', projectId, guid, body]); return { guid: 'c1' }; });
      stub('filesList', async () => [{ filename: 'hus.ifc', documentId: 'd1', versionIndex: 2, date: '2026-11-11', model: true, reference: 'r1' }]);
      stub('importFile', async (_c, project, entry) => { calls.push(['import', project.project_id, entry.filename]); return { id: 'ds-x', name: 'hus', kind: 'model' }; });
      const projects = await commands.run('cde_projects', { source: 'cde-cmd-test' });
      assert.deepEqual(projects.result.projects, [{ id: 'p1', name: 'Bygglov' }, { id: 'p2', name: 'Rivning' }]);
      const table = await commands.run('cde_topics', { source: 'Kommandoserver', project: 'Bygglov' });
      assert.ok(table.ok && table.result.columns.includes('title') && table.result.rows.length === 1 && table.result.rows[0][table.result.columns.indexOf('labels')] === 'a, b', JSON.stringify(table.result));
      const made = await commands.run('cde_create_topic', { source: 'Kommandoserver', project: 'p1', title: 'Fukt i källaren', description: 'Mätt 80 %', status: 'Open', priority: null, type: null }, trusted);
      assert.ok(made.ok && made.result.guid === 'g2' && made.result.number === 'ISSUE-0002', JSON.stringify(made));
      assert.deepEqual(calls[0], ['topic', 'p1', { title: 'Fukt i källaren', description: 'Mätt 80 %', topic_status: 'Open' }]);
      const comment = await commands.run('cde_comment', { source: 'Kommandoserver', project: 'Bygglov', topic: 'Spricka i vägg', comment: 'Åtgärdat' }, trusted);
      assert.ok(comment.ok && comment.result.guid === 'c1' && calls[1][2] === 'g1' && calls[1][3].comment === 'Åtgärdat', JSON.stringify(comment));
      const needs = await commands.run('cde_create_topic', { source: 'Kommandoserver', project: 'p1', title: 'x', description: null, status: null, priority: null, type: null });
      assert.ok(!needs.ok && needs.refused, 'a writing command needs approval');
      const files = await commands.run('cde_files', { source: 'Kommandoserver', project: 'Rivning' });
      assert.ok(files.ok && files.result.files[0].name === 'hus.ifc' && files.result.files[0].model === true && files.result.files[0].version === 2);
      const fetched = await commands.run('cde_fetch_file', { source: 'Kommandoserver', project: 'Bygglov', file: 'hus.ifc' }, trusted);
      assert.ok(fetched.ok && fetched.result.id === 'ds-x' && calls[2][0] === 'import' && calls[2][1] === 'p1', JSON.stringify(fetched));
      const missing = await commands.run('cde_fetch_file', { source: 'Kommandoserver', project: 'Bygglov', file: 'finns-inte.ifc' }, trusted);
      assert.ok(!missing.ok && missing.error === t('commands.err.missing', { what: t('commands.what.file'), ref: 'finns-inte.ifc' }));
      const noProject = await commands.run('cde_topics', { source: 'Kommandoserver', project: 'Okänt' });
      assert.ok(!noProject.ok && /Okänt/.test(noProject.error));
    } finally {
      for (const [name, fn] of Object.entries(stubbed)) opencde[name] = fn;
      connectors.list = realList;
    }
    return 'ok';
  });

  test('commands2: cleanup', async (assert) => {
    for (const id of chartIds) await charts.remove(id).catch(() => {});
    for (const id of docIds) await documents.remove(id).catch(() => {});
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
