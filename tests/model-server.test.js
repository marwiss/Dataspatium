// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for large models from the server (OB-20.1, step 4): a binary glTF built here is read in the worker into the meshes the
 * 3D view draws, a model dataset is made from it and the named queries through injected server calls, and viz/model-draw finds
 * the server's geometry when the dataset has no IFC file. Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const gltf = D.require('engines/gltf');
  const modelServer = D.require('data/model-server');
  const datasets = D.require('data/datasets');
  const t = D.require('ui/i18n').t;
  const created = [];

  /** A GLB with a unit cube used by two elements under a storey node, under a root that turns Z up into Y up. */
  function glb() {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]);
    const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3]);
    const bin = new Uint8Array(positions.byteLength + indices.byteLength);
    bin.set(new Uint8Array(positions.buffer), 0); bin.set(new Uint8Array(indices.buffer), positions.byteLength);
    const json = {
      asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [
        { name: 'root', matrix: [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1], children: [1] },
        { name: '2PlanGuid000000000000', extras: { class: 'IfcBuildingStorey', step: 7 }, children: [2, 3] },
        { name: '1WallGuid00000000000A', mesh: 0, extras: { class: 'IfcWall', step: 101, storey: '2PlanGuid000000000000' } },
        { name: '1SlabGuid00000000000B', mesh: 1, translation: [10, 0, 0], extras: { class: 'IfcSlab', step: 102, storey: '2PlanGuid000000000000' } },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }, { primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 1 }] }],
      materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.9, 0.2, 0.2, 1] } }, { pbrMetallicRoughness: { baseColorFactor: [0.2, 0.2, 0.9, 0.5] } }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1] }, { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength }],
      buffers: [{ byteLength: bin.byteLength }],
    };
    const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    const pad = (n) => (4 - (n % 4)) % 4;
    const jsonLen = jsonBytes.length + pad(jsonBytes.length); const binLen = bin.length + pad(bin.length);
    const out = new Uint8Array(12 + 8 + jsonLen + 8 + binLen);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
    dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4E4F534A, true); out.set(jsonBytes, 20); out.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen);
    dv.setUint32(20 + jsonLen, binLen, true); dv.setUint32(24 + jsonLen, 0x004E4942, true); out.set(bin, 28 + jsonLen);
    return out;
  }

  test('model server: a binary glTF becomes the meshes the view draws, one element per node with its id, class, storey, box and colour', async (assert) => {
    const m = await gltf.meshes(glb());
    assert.equal(m.elements, 2, 'the storey node has no mesh and is no element');
    assert.deepEqual(m.nodes.map((n) => [n.id, n.guid, n.cls, n.storey]), [[101, '1WallGuid00000000000A', 'IfcWall', '2PlanGuid000000000000'], [102, '1SlabGuid00000000000B', 'IfcSlab', '2PlanGuid000000000000']]);
    assert.equal(m.batches.length, 2, 'one batch per colour');
    assert.deepEqual(Array.from(m.ranges), [101, 0, 0, 36, 102, 1, 0, 36], 'id, batch, first index, count');
    const wall = m.stats.find((s) => s[0] === 101); const slab = m.stats.find((s) => s[0] === 102);
    assert.ok(Math.abs(wall[1] - 6) < 1e-6 && Math.abs(wall[2] - 1) < 1e-6, 'area 6 and volume 1 of a unit cube: ' + wall[1] + ', ' + wall[2]);
    // Z up became Y up: the cube's z extent 0..1 lies on y, and its y extent 0..1 on -z.
    assert.deepEqual(wall[3].map((v) => Math.round(v * 1000) / 1000), [0, 0, -1]); assert.deepEqual(wall[4].map((v) => Math.round(v * 1000) / 1000), [1, 1, 0]);
    assert.deepEqual(slab[3].map((v) => Math.round(v * 1000) / 1000), [10, 0, -1], 'the translation came along');
    const b = m.batches[0];
    assert.ok(b.positions.length === 24 && b.normals.length === 24 && b.ids.length === 24 && b.index.length === 36, 'arrays of the cube');
    assert.deepEqual(Array.from(b.ids.slice(0, 3)), [0, 0, 101], 'the element id as three bytes, high first');
    assert.ok(Math.abs(Math.hypot(b.normals[0], b.normals[1], b.normals[2]) - 1) < 1e-6, 'flat normals made and normalised');
    assert.deepEqual(b.color, [0.9, 0.2, 0.2, 1]);
    assert.equal(m.coordination, null);
    return 'ok';
  });

  test('model server: a large model from the server becomes a dataset with the elements as rows, the geometry kept, and the view draws it without the file', async (assert) => {
    const calls = [];
    const io = {
      geometry: async (_c, documentId, versionIndex, o) => { calls.push(['geometry', documentId, versionIndex, o.lod]); return glb().buffer; },
      query: async (_c, documentId, versionIndex, name, params) => {
        calls.push(['query', name, params.class || '']);
        if (name === 'storeys') return { name, columns: ['global_id', 'name', 'elevation', 'elements', 'spaces'], rows: [['2PlanGuid000000000000', 'Plan 1', 0, 2, 0]], truncated: false };
        if (name === 'elements' && params.class === 'IfcWall') return { name, columns: ['global_id', 'class', 'name', 'container'], rows: [['1WallGuid00000000000A', 'IfcWall', 'Vägg A', 'Plan 1']], truncated: false };
        if (name === 'elements') return { name, columns: ['global_id', 'class', 'name', 'container'], rows: [], truncated: false };
        throw new Error('unknown query ' + name);
      },
    };
    const connector = { id: 'cde-test', name: 'Testserver', baseUrl: 'https://cde.example.test/' };
    const t0 = performance.now();
    const mark = (what) => console.log('DATASPATIUM-LOG: [model server test] ' + what + ' at ' + Math.round(performance.now() - t0) + ' ms');
    mark('start');
    const meta = await modelServer.fetchLarge(connector, { project_id: 'p1', name: 'Projektet' }, { documentId: 'doc-1', versionIndex: 2, filename: 'hus.ifc', reference: 'r1' }, { lod: 'box', io, onProgress: () => mark('parsed') });
    mark('fetched');
    created.push(meta.id);
    assert.equal(meta.kind, 'model');
    assert.equal(meta.name, 'hus');
    assert.ok(calls.some((c) => c[0] === 'geometry' && c[3] === 'box') && calls.some((c) => c[1] === 'storeys') && calls.filter((c) => c[1] === 'elements').length === 2, JSON.stringify(calls));
    const cols = (await datasets.columns(meta.id)).map((c) => c.name);
    const rows = await datasets.query(meta.id);
    const pick = (r, n) => r[cols.indexOf(n)];
    assert.deepEqual(rows.map((r) => [pick(r, 'id'), pick(r, 'guid'), pick(r, 'typ'), pick(r, 'kategori'), pick(r, 'namn'), pick(r, 'vaning')]),
      [[101, '1WallGuid00000000000A', 'IfcWall', 'byggdel', 'Vägg A', 'Plan 1'], [102, '1SlabGuid00000000000B', 'IfcSlab', 'byggdel', '', 'Plan 1']], 'a row per element, named by the query');
    assert.ok(modelServer.isServer(meta) && meta.model.lod === 'box' && meta.model.elements === 2 && meta.model.storeys[0].name === 'Plan 1', JSON.stringify(meta.model));
    assert.ok(meta.source && meta.source.cde && meta.source.cde.documentId === 'doc-1' && meta.source.cde.versionIndex === 2 && meta.source.large.lod === 'box', 'the CDE source as a fetched model has it');
    mark('rows read');
    const kept = await modelServer.geometry(meta.id);
    assert.ok(kept && kept.bytes.length === glb().length, 'the glTF kept with the dataset');
    mark('geometry read');
    assert.equal(await D.require('data/model').original(meta.id), null, 'no IFC file');
    mark('original checked');
    const drawn = await D.require('viz/model-draw').meshesOf(meta.id);
    mark('meshes drawn');
    assert.ok(drawn.elements === 2 && drawn.byElement.has(101) && drawn.byElement.has(102) && drawn.stats.get(102).max[0] === 11, 'the view reads the server geometry');
    return 'ok';
  });

  test('model server: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    D.require('viz/model-draw').clearCache();
    gltf.terminate();
    assert.ok(true);
  });
})();
