// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the duplicate check across federated models (analysis/clash-core `duplicates`, analysis/federated, the card Dubbletter
 * mellan modeller in Kontrollera): the core on boxes with known overlaps, the whole way through web-ifc in the IFC worker on two
 * small models of one building (an architect's and a structural engineer's, written here), the BCF file read back, the finding in
 * the inspector and the mark in the model view. No network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const core = D.require('analysis/clash-core').create();
  const federated = D.require('analysis/federated');
  const datasets = D.require('data/datasets');
  const selection = D.require('data/selection');
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(30); }
  }
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root);
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      history.replaceState(null, '', location.pathname + location.search);
      root.remove();
    }
  }
  /** A box as a closed mesh: eight corners, twelve triangles. */
  function box(x0, y0, z0, x1, y1, z1) {
    const pos = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
    const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
    return core.part(new Float64Array(pos), new Uint32Array(idx));
  }
  const el = (model, id, group, guid, ...parts) => Object.assign(core.element(id, parts), { key: model + ':' + id, model, group, guid });
  const near = (v, want, eps) => Math.abs(v - want) <= eps;

  test('federated: the core finds the same element in two models by volume and box, and leaves the rest', async (assert) => {
    const ark = [
      el(0, 1, 'IfcWall', 'a1', box(0, 0, 0, 5, 0.2, 3)),
      el(0, 2, 'IfcWall', 'a2', box(10, 0, 0, 15, 0.2, 3)),
      el(0, 3, 'IfcSlab', 'a3', box(0, 0, -0.2, 6, 6, 0)),
      el(0, 4, 'IfcWall', 'same', box(20, 0, 0, 25, 0.2, 3)),
      el(0, 5, 'IfcWall', 'a5', box(30, 0, 0, 35, 0.2, 3)),
      el(0, 6, 'IfcWall', 'a6', box(0, 0, 0, 5, 0.2, 3)),
    ];
    const k = [
      el(1, 11, 'IfcWall', 'k1', box(0, 0, 0, 5, 0.2, 3)),
      el(1, 12, 'IfcWall', 'k2', box(12.5, 0, 0, 17.5, 0.2, 3)),
      el(1, 13, 'IfcBeam', 'k3', box(0, 0, -0.2, 6, 6, 0)),
      el(1, 14, 'IfcWall', 'same', box(20, 0, 0, 25, 0.2, 3)),
      el(1, 15, 'IfcWall', 'k5', box(30, -0.025, 0, 35, 0.225, 3)),
    ];
    const strict = core.duplicates([ark, k], { threshold: 0.9, pairs: [[0, 4, 1, 14]] });
    const pairs = (r) => r.duplicates.map((d) => `${d.am}:${d.a}-${d.bm}:${d.b}`).sort();
    // The wall in both models (twice in the first, which is no finding between models); not the one moved by half its length, not
    // the beam at the slab (another class), not the one with the same GlobalId (a finding of its own).
    assert.deepEqual(pairs(strict), ['0:1-1:11', '0:6-1:11'], JSON.stringify(strict.duplicates));
    const d = strict.duplicates[0];
    assert.ok(near(d.volume, 1, 1e-9) && near(d.box, 1, 1e-9) && near(d.share, 1, 1e-9), JSON.stringify(d));
    assert.ok(near(d.point[0], 2.5, 1e-9) && near(d.point[2], 1.5, 1e-9), 'the point is the middle of the common box: ' + d.point);
    assert.equal(strict.measured.length, 1, 'the pair with the same GlobalId is measured as asked');
    assert.ok(near(strict.measured[0].volume, 1, 1e-9), JSON.stringify(strict.measured[0]));
    // A wall of 0.2 m inside one of 0.25 m covers 80 % of it: a duplicate at 75 %, not at 90 %.
    const loose = core.duplicates([ark, k], { threshold: 0.75 });
    assert.ok(pairs(loose).includes('0:5-1:15'), pairs(loose).join(' '));
    assert.ok(near(loose.duplicates.find((x) => x.a === 5).volume, 0.8, 1e-6));
    // Two L shapes mirrored in one box share their box but two thirds of their volume: the volume decides.
    const l1 = el(0, 21, 'IfcWall', 'l1', box(0, 0, 0, 2, 1, 1), box(0, 1, 0, 1, 2, 1));
    const l2 = el(1, 22, 'IfcWall', 'l2', box(0, 0, 0, 2, 1, 1), box(1, 1, 0, 2, 2, 1));
    const ls = core.overlap(l1, l2);
    assert.ok(near(ls.box, 1, 1e-9) && near(ls.volume, 2 / 3, 0.02), JSON.stringify(ls));
    assert.equal(core.duplicates([[l1], [l2]], { threshold: 0.9 }).duplicates.length, 0, 'not the same element');
    // An open mesh (a box without its top): the rays disagree, the volume cannot be measured, and the box decides.
    const openBox = box(0, 0, 0, 5, 0.2, 3);
    const lidless = el(1, 31, 'IfcWall', 'o', core.part(openBox.pos, new Uint32Array(Array.from(openBox.idx).slice(0, 6).concat(Array.from(openBox.idx).slice(12)))));
    const open = core.overlap(ark[0], lidless);
    assert.ok(open.volume === null && near(open.box, 1, 1e-9), JSON.stringify(open));
    assert.equal(core.duplicates([[ark[0]], [lidless]], { threshold: 0.9 }).duplicates.length, 1, 'found by its box');
    // Classes that model the same thing share a group.
    assert.deepEqual(['IfcWallStandardCase', 'IfcRoof', 'IfcSlabElementedCase', 'IfcStairFlight', 'IfcBeam'].map(federated.groupOf), ['IfcWall', 'IfcSlab', 'IfcSlab', 'IfcStair', 'IfcBeam']);
    return `${strict.pairs} pairs`;
  });

  const num = (v) => (Number.isInteger(v) ? v + '.' : String(v));
  /**
   * A small IFC file in metres of one discipline's model: a project, a site and a building whose GlobalIds all models share, storeys,
   * and extruded boxes as elements (x and y the middle of the footprint, z its bottom).
   * @param {string} prefix the first six characters of the model's own GlobalIds
   * @param {{storeys: Array<{guid: string, name: string, z: number}>, elements: Array<{cls: string, guid: string, name: string, x: number, y: number, z: number, dx: number, dy: number, h: number}>}} spec
   */
  function fedFile(prefix, spec) {
    const lines = []; let next = 1;
    const add = (s) => { const id = next++; lines.push(`#${id}=${s};`); return id; };
    const own = (n) => (prefix + String(n).padStart(16, '0')).slice(0, 22);
    const origin = add('IFCCARTESIANPOINT((0.,0.,0.))'); const zDir = add('IFCDIRECTION((0.,0.,1.))'); const xDir = add('IFCDIRECTION((1.,0.,0.))');
    const world = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zDir},#${xDir})`);
    const ctx = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${world},$)`);
    const units = add(`IFCUNITASSIGNMENT((#${add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')}))`);
    const at = (x, y, z) => add(`IFCLOCALPLACEMENT($,#${add(`IFCAXIS2PLACEMENT3D(#${add(`IFCCARTESIANPOINT((${num(x)},${num(y)},${num(z)}))`)},#${zDir},#${xDir})`)})`);
    const project = add(`IFCPROJECT('${shared(1)}',$,'Samordning',$,$,$,$,(#${ctx}),#${units})`);
    const site = add(`IFCSITE('${shared(2)}',$,'Tomt',$,$,#${at(0, 0, 0)},$,$,.ELEMENT.,$,$,$,$,$)`);
    const building = add(`IFCBUILDING('${shared(3)}',$,'Hus',$,$,#${at(0, 0, 0)},$,$,.ELEMENT.,$,$,$)`);
    add(`IFCRELAGGREGATES('${own(5)}',$,$,$,#${project},(#${site}))`);
    add(`IFCRELAGGREGATES('${own(6)}',$,$,$,#${site},(#${building}))`);
    const storeys = spec.storeys.map((s) => add(`IFCBUILDINGSTOREY('${s.guid}',$,'${s.name}',$,$,#${at(0, 0, s.z)},$,$,.ELEMENT.,${num(s.z)})`));
    add(`IFCRELAGGREGATES('${own(7)}',$,$,$,#${building},(${storeys.map((x) => '#' + x).join(',')}))`);
    const elements = spec.elements.map((e) => {
      const place = at(e.x, e.y, e.z);
      const prof = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${add(`IFCAXIS2PLACEMENT2D(#${add('IFCCARTESIANPOINT((0.,0.))')},$)`)},${num(e.dx)},${num(e.dy)})`);
      const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${add(`IFCAXIS2PLACEMENT3D(#${origin},$,$)`)},#${zDir},${num(e.h)})`);
      const rep = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${add(`IFCSHAPEREPRESENTATION(#${ctx},'Body','SweptSolid',(#${ext}))`)}))`);
      return add(`${e.cls}('${e.guid}',$,'${e.name}',$,$,#${place},#${rep},$,$)`);
    });
    add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${own(8)}',$,$,$,(${elements.map((x) => '#' + x).join(',')}),#${storeys[0]})`);
    const head = ['ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');", `FILE_NAME('${prefix}.ifc','2026-11-12T12:00:00',(''),(''),'Prov','Prov','');`, "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;'];
    return head.concat(lines, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n');
  }
  const shared = (n) => ('0FedSh' + String(n).padStart(16, '0')).slice(0, 22);
  const G = { ark: (n) => ('0FedAr' + String(n).padStart(16, '0')).slice(0, 22), k: (n) => ('0FedKo' + String(n).padStart(16, '0')).slice(0, 22) };
  const wall = (guid, name, x) => ({ cls: 'IFCWALL', guid, name, x, y: 0, z: 0, dx: 5, dy: 0.2, h: 3 });
  /** The architect's model: two storeys, a wall, a wall whose GlobalId the other model has too, and a slab. */
  const arkText = () => fedFile('0FedAr', {
    storeys: [{ guid: shared(4), name: 'Plan 1', z: 0 }, { guid: G.ark(20), name: 'Plan 2', z: 3 }],
    elements: [wall(G.ark(10), 'Vagg A', 0), wall(shared(11), 'Vagg delad', 10), { cls: 'IFCSLAB', guid: G.ark(12), name: 'Platta A', x: 0, y: 0, z: -0.2, dx: 6, dy: 6, h: 0.2 }],
  });
  /** The structural engineer's model: the same storeys with the second 50 mm lower, the wall again, the shared wall, a slab moved half its width and a beam through the wall. */
  const kText = () => fedFile('0FedKo', {
    storeys: [{ guid: shared(4), name: 'Plan 1', z: 0 }, { guid: G.k(20), name: 'plan 2', z: 2.95 }],
    elements: [wall(G.k(10), 'Vagg K', 0), wall(shared(11), 'Vagg delad', 10), { cls: 'IFCSLAB', guid: G.k(12), name: 'Platta K', x: 3, y: 0, z: -0.2, dx: 6, dy: 6, h: 0.2 },
      { cls: 'IFCBEAM', guid: G.k(13), name: 'Balk K', x: 0, y: 0, z: 1, dx: 0.3, dy: 2, h: 0.4 }],
  });
  let ark = null; let kon = null;

  test('federated: through web-ifc in the worker, two models of one building, with the model of every element', async (assert) => {
    const importer = D.require('io/import');
    ark = await importer.run(new File([arkText()], 'fed-ark.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Fed ARK');
    created.push(ark.id);
    kon = await importer.run(new File([kText()], 'fed-k.ifc', { type: 'application/octet-stream' }), { format: 'model' }, null, 'Fed K');
    created.push(kon.id);
    let failed = '';
    try { await federated.run({ datasetIds: [ark.id] }); } catch (err) { failed = String(err.message || err); }
    assert.equal(failed, t('federated.err.two'), 'one model is not enough');
    const r = await federated.run({ datasetIds: [ark.id, kon.id], threshold: 0.9 });
    assert.deepEqual(r.counts, { guid: 1, element: 1, storey: 1 }, JSON.stringify(r.findings.map((f) => [f.kind, f.a.typ, f.a.namn, f.b.typ, f.b.namn])));
    assert.equal(r.shared, 4, 'the project, the site, the building and the first storey share their GlobalIds, which is no finding');
    assert.deepEqual(r.models.map((m) => [m.name, m.elements]), [['Fed ARK', 3], ['Fed K', 4]], 'every element drawn');
    assert.equal(r.missing, 0);
    const [guid, dup, storey] = r.findings;
    assert.ok(guid.kind === 'guid' && guid.a.guid === shared(11) && guid.b.guid === shared(11), JSON.stringify(guid));
    assert.ok(guid.a.model === 'Fed ARK' && guid.b.model === 'Fed K' && guid.a.datasetId === ark.id && guid.b.datasetId === kon.id, 'the model of each side');
    assert.ok(near(guid.volume, 1, 0.01) && guid.point && near(guid.point[0], 10, 0.01), 'the pair with the same GlobalId measured too: ' + JSON.stringify(guid));
    assert.ok(dup.kind === 'element' && dup.a.guid === G.ark(10) && dup.b.guid === G.k(10) && dup.a.typ === 'IfcWall', JSON.stringify(dup));
    assert.ok(near(dup.volume, 1, 0.01) && near(dup.box, 1, 0.01), 'the same wall twice: ' + dup.volume);
    assert.ok(near(dup.point[0], 0, 0.01) && near(dup.point[2], 1.5, 0.01), "in the models' coordinates, Z up: " + dup.point);
    assert.ok(storey.kind === 'storey' && storey.a.namn === 'Plan 2' && storey.b.namn === 'plan 2', 'the names compared without case: ' + JSON.stringify(storey));
    assert.ok(near(storey.elevations[0], 3, 1e-6) && near(storey.elevations[1], 2.95, 1e-6) && storey.a.guid === G.ark(20), JSON.stringify(storey));
    // A lower threshold still leaves the slab moved by half its width, which covers half of the other.
    const low = await federated.run({ datasetIds: [ark.id, kon.id], threshold: 0.6 });
    assert.equal(low.counts.element, 1, 'still only the wall: the slabs overlap by half');
    const table = federated.tableOf(r);
    assert.deepEqual(table.columns.map((c) => c.name), federated.COLUMNS.map((c) => c.name));
    assert.equal(table.rows.length, 3);
    assert.deepEqual(table.rows[1].slice(0, 2), ['element', 'Fed ARK']);
    assert.equal(table.rows[1][11], 100, 'the overlap by volume in per cent');
    assert.deepEqual([table.rows[2][13], table.rows[2][14]], [3, 2.95], 'the two elevations in metres');
    assert.ok(/^id in \(/.test(federated.whereOf(r, ark.id)), 'a condition on the first model');
    const vp = federated.viewpointOf(guid, { a: 'C0392B', b: '8F5A0B' });
    assert.equal(vp.components.selection.length, 1, 'one component when both sides have the same GlobalId');
    assert.equal(federated.viewpointOf(dup, {}).components.selection.length, 2);
    assert.equal(federated.viewpointOf(storey, {}), null, 'a storey has no place');
    const text = federated.topicText(storey, t);
    assert.ok(text.title.includes('Plan 2') && text.description.includes('50'), JSON.stringify(text));
    const blob = await federated.bcfFile(r, { t, projectName: 'Fed' });
    const read = await D.require('data/bcf-xml').read(await blob.arrayBuffer());
    assert.equal(read.topics.length, 3, 'one topic per finding');
    const invalid = await D.require('tests/bcf-schema-check').checkBlob(blob);
    if (invalid) assert.deepEqual(invalid, [], 'the file is valid BCF 3.0');
    const byTitle = (s) => read.topics.find((x) => x.title.includes(s));
    const dupTopic = byTitle(t('federated.topic.element', { a: '', b: '' }).split(':')[0]);
    assert.ok(dupTopic, read.topics.map((x) => x.title).join(' | '));
    const vps = read.viewpoints.filter((v) => v.topic_guid === dupTopic.guid);
    assert.deepEqual(((vps[0] && vps[0].components && vps[0].components.selection) || []).map((x) => x.ifc_guid).sort(), [G.ark(10), G.k(10)].sort());
    return `${r.pairs} pairs, ${r.seconds} s`;
  }, 120000);

  test('federated: the card in Kontrollera tries the model against another, shows the finding in the inspector, saves BCF and marks', async (assert) => {
    const files = D.require('platform/files');
    const saved = [];
    const original = files.download;
    files.download = (blob, name) => { saved.push({ blob, name }); };
    try {
      await withApp(async (shell, root) => {
        await waitFor(() => shell.store.get().datasets.some((d) => d.id === ark.id) && shell.store.get().datasets.some((d) => d.id === kon.id), 3000, 'datasets');
        shell.store.set({ selectedId: ark.id });
        shell.activate('kontrollera');
        const card = await waitFor(() => root.querySelector('.dm-center [data-card="federated"]'), 8000, 'the card');
        await waitFor(() => card.querySelector(`[data-federated-with="${kon.id}"] input`), 3000, 'the other model to choose');
        assert.ok(!card.querySelector(`[data-federated-with="${ark.id}"]`), 'not the chosen model itself');
        assert.ok(!card.querySelector('[data-federated-summary]'), 'nothing runs before the button');
        const press = (sel) => { const b = card.querySelector(sel); /** @type {any} */ (b.querySelector('button') || b).click(); };
        // Without a model to try against, the button says so.
        press('[data-federated-run]');
        await waitFor(() => card.querySelector('[data-federated-error]'), 3000, 'the hint to choose');
        /** @type {any} */ (card.querySelector(`[data-federated-with="${kon.id}"] input`)).click();
        press('[data-federated-run]');
        const summary = await waitFor(() => card.querySelector('[data-federated-summary]'), 60000, 'the result');
        assert.deepEqual(['guids', 'elements', 'storeys', 'shared'].map((k) => summary.getAttribute('data-federated-' + k)), ['1', '1', '1', '4']);
        assert.equal(card.querySelector('[data-federated-check="element"]').getAttribute('data-federated-count'), '1');
        const table = card.querySelector('dm-table[data-federated-table]');
        await waitFor(() => table.querySelectorAll('.dm-tr').length === 3, 5000, 'one row per finding');
        const cells = Array.from(table.querySelectorAll('.dm-tr')[1].querySelectorAll('[role="gridcell"]')).map((td) => td.textContent);
        assert.deepEqual(cells.slice(0, 2), [t('federated.kind.element'), 'Fed ARK'], JSON.stringify(cells));
        /** @type {HTMLElement} */ (table.querySelectorAll('.dm-tr')[1]).click();
        const finding = await waitFor(() => root.querySelector('.dm-right [data-federated-finding="element"]'), 3000, 'the finding in the inspector');
        assert.ok(finding.textContent.includes('Fed K') && finding.textContent.includes(G.k(10)), finding.textContent);
        assert.ok(finding.querySelector('[data-federated-show="a"]') && finding.querySelector('[data-federated-show="b"]'), 'a button per model');
        press('[data-federated-bcf]');
        const file = await waitFor(() => saved[0], 5000, 'the BCF file');
        assert.ok(/\.bcfzip$/.test(file.name), file.name);
        const read = await D.require('data/bcf-xml').read(await file.blob.arrayBuffer());
        assert.equal(read.topics.length, 3);
        // The mark: the first model's elements and storey in the findings, in Bearbeta's model view.
        press(`[data-federated-mark="${ark.id}"]`);
        await waitFor(() => shell.store.get().mode === 'bearbeta', 5000, 'Bearbeta');
        const chosen = selection.get();
        assert.ok(chosen && chosen.datasetId === ark.id && chosen.rowids.length === 3, JSON.stringify(chosen));
        selection.clear();
        // Back in Kontrollera, a finding opens the other model with its element chosen.
        shell.activate('kontrollera');
        const again = await waitFor(() => root.querySelector('.dm-center [data-card="federated"]'), 8000, 'the card again');
        /** @type {any} */ (await waitFor(() => again.querySelector(`[data-federated-with="${kon.id}"] input`), 3000, 'the switch')).click();
        /** @type {any} */ (again.querySelector('[data-federated-run]').querySelector('button') || again.querySelector('[data-federated-run]')).click();
        const t2 = await waitFor(() => again.querySelector('dm-table[data-federated-table]'), 60000, 'the table again');
        await waitFor(() => t2.querySelectorAll('.dm-tr').length === 3, 5000, 'its rows');
        /** @type {HTMLElement} */ (t2.querySelectorAll('.dm-tr')[1]).click();
        const show = await waitFor(() => root.querySelector('.dm-right [data-federated-show="b"]'), 3000, 'the button for the other model');
        /** @type {any} */ (show.querySelector('button') || show).click();
        await waitFor(() => shell.store.get().mode === 'bearbeta' && shell.store.get().selectedId === kon.id, 5000, 'the other model in Bearbeta');
      });
    } finally { files.download = original; }
    return 'ok';
  }, 180000);

  test('federated: cleanup', async () => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    return 'ok';
  });
})();
