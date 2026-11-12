// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for BCF files that follow the standard (data/bcf-xml): every file the app writes is checked against buildingSMART's XSD for
 * BCF 3.0 with the checker of our own (tests/bcf-schema-check, decision F47 a), and the hand-written examples of tests/fixtures/bcf
 * against 3.0 and 2.1. A 3.0 file and a 2.1 file "from another program" keep their comments, viewpoints, snapshots, components and
 * documents, are written back as BCF 3.0 and read the same; the app's earlier exports still read; required values are always filled;
 * snapshots are at most 1500 px; the header ties a topic to its model file; Swedish review statuses are recognised; and the BCF API
 * calls for a topic's model file and documents go out as the specification has them, against a virtual server (no network).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const bcfXml = D.require('data/bcf-xml');
  const zip = D.require('platform/storage/zip');
  const fx = D.require('tests/fixtures/bcf');
  const checker = D.require('tests/bcf-schema-check');
  /** The schemas, or null when the folder is not there (the release ZIP leaves it out). */
  const schemasOf = () => checker.schemas();
  const NO_SCHEMAS = 'the schemas are not in this copy (tests/fixtures/bcf-schemas); the XSD checks were left out';
  /** Every XML file of an archive valid against a version's schemas; notes when the schemas are missing. */
  async function valid(assert, entries, version, label) {
    const sc = await schemasOf();
    if (!sc) return false;
    const errors = checker.checkArchive(sc, entries, version);
    assert.deepEqual(errors, [], `${label}: ${errors.slice(0, 5).join(' | ')}`);
    return true;
  }
  const blobOf = (files) => zip.createZip(fx.bytesOf(files));
  const entriesOf = async (blob) => zip.readZip(new Uint8Array(await blob.arrayBuffer()));
  const readFiles = async (files) => bcfXml.read(await (await blobOf(files)).arrayBuffer());
  const text = (bytes) => new TextDecoder().decode(bytes);
  /** What was read, as the items the writer takes. */
  function itemsOf(read) {
    return read.topics.map((tp) => ({
      topic: tp,
      comments: read.comments.filter((c) => c.topic_guid === tp.guid),
      viewpoints: read.viewpoints.filter((v) => v.topic_guid === tp.guid).map((v) => { const s = read.snapshots.find((x) => x.viewpoint_guid === v.guid); return { viewpoint: v, snapshot: s ? { bytes: s.bytes, type: s.type } : null }; }),
      header: tp.header_files,
      documents: read.documents.filter((d) => d.bytes && (tp.document_references || []).some((r) => r.document_guid === d.guid)),
    }));
  }
  /** The parts of a read file that a round trip keeps, comparable with deepEqual. */
  function essence(read) {
    const vps = read.viewpoints.map((v) => ({ guid: v.guid, topic: v.topic_guid, pc: v.perspective_camera || null, oc: v.orthogonal_camera || null, planes: v.clipping_planes || [], lines: v.lines || [], components: v.components }));
    return {
      topics: read.topics.map((tp) => ({ guid: tp.guid, sid: tp.server_assigned_id, type: tp.topic_type, status: tp.topic_status, title: tp.title, priority: tp.priority, labels: tp.labels, created: tp.creation_date, author: tp.creation_author, due: tp.due_date, assigned: tp.assigned_to, stage: tp.stage, description: tp.description, links: tp.reference_links, related: tp.related_topics, files: tp.header_files.map((f) => [f.filename, f.ifc_project, f.reference]) })),
      comments: read.comments.map((c) => [c.guid, c.topic_guid, c.author, c.comment, c.viewpoint_guid]),
      viewpoints: vps,
      snapshots: read.snapshots.map((s) => [s.topic_guid, s.viewpoint_guid, s.type, s.bytes.length]),
      components: read.components.map((c) => [c.topic_guid, c.viewpoint_guid, c.role, c.ifc_guid, c.color]),
      documents: read.documents.filter((d) => d.bytes).map((d) => [d.filename, d.bytes.length]),
    };
  }
  const markupOf = (entries, guid) => text(entries[`${guid}/markup.bcf`]);
  function pngOf(width, height, type = 'image/png') {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = canvas.getContext('2d'); g.fillStyle = '#009e73'; g.fillRect(0, 0, width, height); g.fillStyle = '#d55e00'; g.fillRect(0, 0, width / 2, height / 2);
    return new Promise((resolve) => canvas.toBlob(async (blob) => resolve({ bytes: new Uint8Array(await blob.arrayBuffer()), url: canvas.toDataURL(type) }), type, 0.9));
  }

  test('bcf: the schema checker finds what the schemas forbid, and the hand-written examples follow them', async (assert) => {
    const sc = await schemasOf();
    if (!sc) return NO_SCHEMAS;
    assert.ok(await valid(assert, fx.bytesOf(fx.v30), '3.0', 'the 3.0 example'));
    assert.ok(await valid(assert, fx.bytesOf(fx.v21), '2.1', 'the 2.1 example'));
    const c3 = checker.create(sc['3.0']);
    const markup = fx.v30[`${fx.G.topicA}/markup.bcf`];
    const fails = (xml, word, label) => { const e = c3.check(xml, label); assert.ok(e.length && e.some((x) => x.includes(word)), `${label}: ${e.join(' | ') || 'no error'}`); };
    fails(markup.replace(/<Labels>.*<\/Labels>/, '').replace('</CreationAuthor>', '</CreationAuthor><Labels><Label>Late</Label></Labels>'), 'Labels', 'labels after the author');
    fails(markup.replace(' TopicStatus="In progress"', ''), 'TopicStatus', 'no status');
    fails(markup.replace('<CreationAuthor>reviewer@example.org</CreationAuthor>', '<CreationAuthor> </CreationAuthor>'), 'CreationAuthor', 'a blank author');
    fails(markup.replace('<Title>', '<Unknown/><Title>'), 'Unknown', 'an element the schema lacks');
    fails(markup.replace(`Guid="${fx.G.topicA}"`, 'Guid="A1B2C3D4-1111-4AAA-8BBB-000000000001"'), 'match', 'an upper case guid');
    fails(fx.v30[`${fx.G.topicA}/view-1.bcfv`].replace('FFFF0000', 'red'), 'red', 'a colour that is no hex');
    fails(fx.v30[`${fx.G.topicA}/view-1.bcfv`].replace(/<PerspectiveCamera>[\s\S]*<\/PerspectiveCamera>/, ''), 'children', 'a viewpoint without a camera');
    fails('<?xml version="1.0"?>\n<Version VersionId="3.0">\n</Version>', 'text', 'the documented bcf.version with its line break');
    // The app's earlier form is no BCF 3.0.
    fails(fx.older[`${fx.G.oldTopic}/markup.bcf`], 'Comments', 'the earlier export');
    // And 2.1's colours are no 3.0 colours.
    const c21 = checker.create(sc['2.1']);
    assert.deepEqual(c21.check(fx.v21[`${fx.G.topic21.toLowerCase()}/viewpoint.bcfv`], '2.1 view'), []);
    assert.ok(c3.check(fx.v21[`${fx.G.topic21.toLowerCase()}/viewpoint.bcfv`], '2.1 view as 3.0').length > 0, 'a 2.1 viewpoint is no 3.0 viewpoint');
    return 'ok';
  }, 30000);

  test('bcf: a 3.0 file from another program keeps its comments, viewpoints, snapshots, components and documents', async (assert) => {
    const read = await readFiles(fx.v30);
    const G = fx.G; const IFC = fx.IFC;
    assert.equal(read.version, '3.0');
    assert.deepEqual(read.project, { name: 'House A', id: G.project });
    assert.deepEqual(read.extensions.topic_status, ['Open', 'In progress', 'Closed']);
    assert.deepEqual(read.extensions.stage, ['Design']);
    assert.equal(read.topics.length, 2);
    const a = read.topics.find((x) => x.guid === G.topicA);
    assert.ok(a.server_assigned_id === 'GR-17' && a.topic_type === 'Issue' && a.topic_status === 'In progress' && a.title === 'The door is too narrow', JSON.stringify(a).slice(0, 200));
    assert.deepEqual(a.labels, ['Architecture', 'Accessibility']);
    assert.deepEqual(a.reference_links, ['https://cde.example.org/issues/GR-17']);
    assert.ok(a.due_date === '2026-11-20T00:00:00Z' && a.assigned_to === 'designer@example.org' && a.stage === 'Design' && a.modified_author === 'designer@example.org');
    assert.ok(a.description.includes('760 mm & less'), a.description);
    assert.deepEqual(a.document_references.map((r) => [r.guid, r.document_guid, r.url]), [[G.ref1, G.doc, null], [G.ref2, null, 'https://example.org/requirements.pdf']]);
    assert.deepEqual(a.related_topics, [{ related_topic_guid: G.topicB }]);
    assert.deepEqual(a.header_files.map((f) => [f.filename, f.ifc_project, f.date, f.is_external]), [['house-a-architecture.ifc', IFC.project, '2026-10-30T14:02:11+01:00', true]]);
    const cs = read.comments.filter((c) => c.topic_guid === G.topicA);
    assert.deepEqual(cs.map((c) => [c.guid, c.author, c.viewpoint_guid]), [[G.c1, 'reviewer@example.org', G.vp1], [G.c2, 'designer@example.org', null]]);
    const [v1, v2] = read.viewpoints.filter((v) => v.topic_guid === G.topicA);
    assert.ok(v1.guid === G.vp1 && v1.perspective_camera.field_of_view === 55 && Math.abs(v1.perspective_camera.aspect_ratio - 1.7778) < 0.001, JSON.stringify(v1.perspective_camera));
    assert.deepEqual(v1.perspective_camera.camera_view_point, { x: 12.5, y: -4, z: 3.2 });
    assert.ok(v1.lines.length === 1 && v1.clipping_planes.length === 1 && v1.index === 0);
    assert.deepEqual(v1.components.selection.map((c) => [c.ifc_guid, c.originating_system, c.authoring_tool_id]), [[IFC.door, 'OtherTool 7', '4711'], [IFC.wall, null, null]]);
    assert.ok(v1.components.visibility.default_visibility === true && v1.components.visibility.exceptions[0].ifc_guid === IFC.slab && v1.components.visibility.view_setup_hints.openings_visible === true);
    assert.deepEqual(v1.components.coloring.map((g) => [g.color, g.components.map((c) => c.ifc_guid)]), [['FFFF0000', [IFC.door]]]);
    assert.ok(v2.orthogonal_camera && v2.orthogonal_camera.view_to_world_scale === 14.5 && v2.orthogonal_camera.aspect_ratio === 1.5);
    assert.equal(v2.components.visibility.default_visibility, false, 'BCF 3.0: a Visibility without DefaultVisibility shows only its exceptions');
    assert.deepEqual(v2.components.visibility.exceptions.map((c) => c.ifc_guid), [IFC.door, IFC.wall]);
    assert.deepEqual(read.snapshots.map((s) => [s.viewpoint_guid, s.type]), [[G.vp1, 'image/png'], [G.vp2, 'image/jpeg']]);
    assert.deepEqual(read.components.filter((c) => c.topic_guid === G.topicA).map((c) => [c.role, c.ifc_guid]), [['selection', IFC.door], ['selection', IFC.wall], ['coloring', IFC.door]]);
    assert.ok(read.documents.length === 1 && read.documents[0].filename === 'measurements.pdf' && text(read.documents[0].bytes).startsWith('%PDF'), JSON.stringify(read.documents.map((d) => d.filename)));
    return 'ok';
  }, 30000);

  test('bcf: round trip 3.0: a file from another program is written back as valid BCF 3.0 and reads the same', async (assert) => {
    const first = await readFiles(fx.v30);
    const blob = await bcfXml.write(itemsOf(first), { projectName: first.project.name, projectId: first.project.id, extensions: first.extensions });
    const entries = await entriesOf(blob);
    const checked = await valid(assert, entries, '3.0', 'written back');
    for (const g of [fx.G.topicA, fx.G.topicB]) assert.ok(entries[`${g}/`] && entries[`${g}/`].length === 0, 'a folder entry per topic: ' + g);
    assert.ok(entries['extensions.xml'] && entries['documents.xml'] && entries[`Documents/${fx.G.doc}`], 'extensions, documents and the document');
    assert.ok(!/<Index>/.test(markupOf(entries, fx.G.topicA).replace(/<ViewPoint[\s\S]*?<\/ViewPoint>/g, '')), 'no deprecated Topic Index');
    const again = await bcfXml.read(await blob.arrayBuffer());
    assert.deepEqual(essence(again), essence(first), 'the same after the round trip');
    assert.deepEqual(again.extensions.topic_status, first.extensions.topic_status);
    return checked ? 'ok' : NO_SCHEMAS;
  }, 30000);

  test('bcf: a 2.1 file is read with its comments, viewpoints and document, and written as valid BCF 3.0', async (assert) => {
    const read = await readFiles(fx.v21);
    const IFC = fx.IFC; const guid = fx.G.topic21.toLowerCase();
    assert.equal(read.version, '2.1');
    assert.deepEqual(read.project, { name: 'House B', id: fx.G.project });
    const tp = read.topics[0];
    assert.ok(tp.guid === guid && tp.topic_type === 'Clash' && tp.topic_status === 'Active' && tp.index === 3, JSON.stringify(tp).slice(0, 200));
    assert.deepEqual(tp.labels, ['Structural', 'Services'], 'repeated Labels');
    assert.deepEqual(tp.reference_links, ['https://cde.example.org/issues/77', 'https://cde.example.org/issues/78']);
    assert.deepEqual(tp.header_files.map((f) => [f.filename, f.ifc_project, f.is_external]), [['house-b-services.ifc', IFC.project, true]], 'Header/File without Files');
    const [inside, outside] = tp.document_references;
    const doc = read.documents.find((d) => d.guid === inside.document_guid);
    assert.ok(doc && doc.filename === 'section.pdf' && text(doc.bytes).startsWith('%PDF') && inside.description === 'Section', 'a document by path in the file becomes a document');
    assert.equal(outside.url, 'https://example.org/standard.html');
    assert.deepEqual(read.comments.map((c) => [c.guid, c.viewpoint_guid]), [[fx.G.c21a, fx.G.vp21a], [fx.G.c21b, null]], 'comments beside the topic');
    const [v1, v2] = read.viewpoints;
    assert.ok(v1.guid === fx.G.vp21a && v1.perspective_camera.field_of_view === 60 && v1.perspective_camera.aspect_ratio === 1, 'no aspect ratio before 3.0: 1');
    assert.ok(v1.components.visibility.view_setup_hints && v1.components.visibility.default_visibility === true && v1.clipping_planes.length === 1);
    assert.deepEqual(v1.components.coloring.map((g) => [g.color, g.components.map((c) => c.ifc_guid)]), [['FF00FF00', [IFC.pipe, IFC.wall]]], '2.1 colours with their components straight under Color');
    assert.ok(v2.guid === fx.G.vp21b && v2.index === 1 && v2.orthogonal_camera.view_to_world_scale === 40 && v2.orthogonal_camera.aspect_ratio === 1);
    assert.equal(read.snapshots.length, 2);
    const blob = await bcfXml.write(itemsOf(read), { projectName: read.project.name, projectId: read.project.id });
    const entries = await entriesOf(blob);
    const checked = await valid(assert, entries, '3.0', 'the 2.1 file written as 3.0');
    const markup = markupOf(entries, guid);
    assert.ok(markup.includes('<Labels><Label>Structural</Label><Label>Services</Label></Labels>') && markup.includes('<ReferenceLinks>') && markup.includes('<DocumentReferences>'), 'the containers of 3.0');
    const vp = text(entries[`${guid}/viewpoint.bcfv`]);
    assert.ok(vp.includes('<Color Color="FF00FF00"><Components>') && vp.includes('<AspectRatio>1</AspectRatio>'), 'colours and the camera as 3.0 has them');
    const again = await bcfXml.read(await blob.arrayBuffer());
    assert.equal(again.version, '3.0');
    const e1 = essence(read); const e2 = essence(again);
    assert.deepEqual(e2.comments, e1.comments); assert.deepEqual(e2.components, e1.components); assert.deepEqual(e2.snapshots, e1.snapshots); assert.deepEqual(e2.documents, e1.documents);
    assert.deepEqual(e2.viewpoints.map((v) => [v.guid, !!v.pc, !!v.oc, v.planes.length]), e1.viewpoints.map((v) => [v.guid, !!v.pc, !!v.oc, v.planes.length]));
    return checked ? 'ok' : NO_SCHEMAS;
  }, 30000);

  test("bcf: the app's earlier exports and BCF 2.0's single viewpoint still read, and are written as valid 3.0", async (assert) => {
    const read = await readFiles(fx.older);
    const IFC = fx.IFC; const G = fx.G;
    const tp = read.topics.find((x) => x.guid === G.oldTopic);
    assert.deepEqual(tp.labels, ['Facade', 'Damage']);
    assert.deepEqual(tp.reference_links, ['https://example.org/a']);
    assert.equal(tp.document_references[0].url, 'https://example.org/photo.jpg', 'a reference without its container');
    const c = read.comments.find((x) => x.topic_guid === G.oldTopic);
    assert.ok(c && c.comment === 'Photographed.' && c.author === null && c.viewpoint_guid === G.oldVp, 'the comment in a list beside the topic');
    const v = read.viewpoints.find((x) => x.topic_guid === G.oldTopic);
    assert.ok(v && v.guid === G.oldVp && v.perspective_camera, 'the viewpoint in a list beside the topic');
    assert.deepEqual(v.components.coloring.map((g) => [g.color, g.components.map((x) => x.ifc_guid)]), [['C0392B', [IFC.wall]]]);
    assert.equal(read.snapshots.find((s) => s.topic_guid === G.oldTopic).type, 'image/jpeg');
    const one = read.viewpoints.find((x) => x.topic_guid === G.oneTopic);
    assert.ok(one && one.guid === G.oneVp && one.perspective_camera, 'the fixed viewpoint.bcfv of a topic without a list');
    assert.deepEqual(one.components.selection.map((x) => x.ifc_guid), [IFC.door], 'Selected="true"');
    assert.deepEqual(one.components.visibility.exceptions.map((x) => x.ifc_guid), [IFC.slab], 'Visible="false"');
    assert.deepEqual(one.components.coloring.map((g) => [g.color, g.components.map((x) => x.ifc_guid)]), [['FF0000', [IFC.door]]]);
    assert.ok(read.snapshots.some((s) => s.viewpoint_guid === G.oneVp), 'its snapshot.png');
    const entries = await entriesOf(await bcfXml.write(itemsOf(read), { author: 'Granskaren' }));
    const checked = await valid(assert, entries, '3.0', 'the earlier export written again');
    const markup = markupOf(entries, G.oldTopic);
    assert.ok(markup.includes('<CreationAuthor>Granskaren</CreationAuthor>') && markup.includes('<Author>Granskaren</Author>'), 'a missing author is the one given');
    assert.ok(/TopicType="Issue" TopicStatus="Open"/.test(markupOf(entries, G.oneTopic)), 'a topic without type and status gets Issue and Open');
    return checked ? 'ok' : NO_SCHEMAS;
  }, 30000);

  test('bcf: required values are always filled, and extensions.xml lists what the file uses', async (assert) => {
    assert.equal(bcfXml.authorOf('srv-user', 'Typed'), 'srv-user', 'the server identity first');
    assert.equal(bcfXml.authorOf(null, 'Typed'), 'Typed', 'then the name entered for comments');
    assert.equal(bcfXml.authorOf('', '  '), bcfXml.TOOL_AUTHOR, 'then the tool, never a guessed person');
    assert.equal(bcfXml.TOOL_AUTHOR, 'Dataspatium');
    const items = [
      { topic: { guid: 'not-a-guid', title: '  ', creation_author: '' }, comments: [{ comment: 'Seen', author: '' }, { comment: '' }], viewpoints: [{ viewpoint: { guid: 'x', perspective_camera: bcfXml.cameraOfBox({ min: [0, 0, 0], max: [1, 1, 1] }), components: { selection: [{ ifc_guid: 'short' }, { ifc_guid: fx.IFC.door }], coloring: [{ color: '#c0392b', components: [{ ifc_guid: fx.IFC.door }] }, { color: 'red-ish', components: [{ ifc_guid: fx.IFC.wall }] }] } } }] },
      { topic: { guid: 'C1D2E3F4-0000-4000-8000-0000000000B2', title: 'B', topic_type: 'Clash', topic_status: 'Active', labels: ['A', 'A', ' '], priority: 'High', stage: 'Design', assigned_to: 'x@example.org', index: 5, due_date: '2026-12-01' }, comments: [], viewpoints: [] },
    ];
    const entries = await entriesOf(await bcfXml.write(items, {}));
    const checked = await valid(assert, entries, '3.0', 'minimal topics');
    const folders = Object.keys(entries).filter((n) => /\/markup\.bcf$/.test(n)).map((n) => n.split('/')[0]);
    assert.ok(folders.every((f) => /^[0-9a-f-]{36}$/.test(f)) && folders.includes('c1d2e3f4-0000-4000-8000-0000000000b2'), 'lower case guids as folder names: ' + folders.join(', '));
    const read = await bcfXml.read(await (await zip.createZip(entries)).arrayBuffer());
    const first = read.topics.find((x) => x.guid !== 'c1d2e3f4-0000-4000-8000-0000000000b2');
    assert.ok(first.topic_type === 'Issue' && first.topic_status === 'Open' && first.title === t('bcf.untitled') && first.creation_author === 'Dataspatium', JSON.stringify(first).slice(0, 200));
    assert.deepEqual(read.comments.map((c) => [c.comment, c.author]), [['Seen', 'Dataspatium']], 'an empty comment is left out, a missing author filled');
    assert.deepEqual(read.components.map((c) => [c.role, c.ifc_guid, c.color]), [['selection', fx.IFC.door, null], ['coloring', fx.IFC.door, 'C0392B']], 'no IfcGuid that is none, colours as hex');
    const second = read.topics.find((x) => x.guid === 'c1d2e3f4-0000-4000-8000-0000000000b2');
    assert.ok(second.index === null && second.due_date === '2026-12-01T00:00:00Z' && second.labels.length === 1, JSON.stringify(second).slice(0, 300));
    assert.deepEqual(read.extensions, { topic_type: ['Issue', 'Clash'], topic_status: ['Open', 'Active'], priority: ['High'], topic_label: ['A'], users: ['x@example.org'], snippet_type: [], stage: ['Design'] });
    return checked ? 'ok' : NO_SCHEMAS;
  }, 30000);

  test('bcf: snapshots are at most 1500 px on the longest side, in their own format', async (assert) => {
    const wide = await pngOf(1800, 600);
    const tall = await pngOf(1000, 2400, 'image/jpeg');
    const small = await pngOf(40, 30);
    assert.deepEqual(bcfXml.imageSize(wide.bytes), { width: 1800, height: 600 });
    const tallBytes = Uint8Array.from(atob(tall.url.split(',')[1]), (c) => c.charCodeAt(0));
    assert.deepEqual(bcfXml.imageSize(tallBytes), { width: 1000, height: 2400 }, 'a JPEG header is read too');
    const camera = bcfXml.cameraOfBox({ min: [0, 0, 0], max: [2, 2, 2] });
    const vp = (n) => ({ viewpoint: { guid: bcfXml.newGuid(), perspective_camera: camera }, snapshot: n });
    const entries = await entriesOf(await bcfXml.write([{ topic: { title: 'Big pictures' }, viewpoints: [vp({ bytes: wide.bytes, type: 'image/png' }), vp({ bytes: tallBytes, type: 'image/jpeg' }), vp({ bytes: small.bytes, type: 'image/png' })] }]));
    const shots = Object.keys(entries).filter((n) => /snapshot/.test(n)).sort();
    assert.deepEqual(shots.map((n) => n.split('/')[1]), ['snapshot-2.jpg', 'snapshot-3.png', 'snapshot.png']);
    const size = (n) => bcfXml.imageSize(entries[shots.find((x) => x.endsWith(n))]);
    assert.deepEqual(size('/snapshot.png'), { width: 1500, height: 500 }, 'the wide one');
    assert.deepEqual(size('/snapshot-2.jpg'), { width: 625, height: 1500 }, 'the tall one, still a JPEG');
    assert.deepEqual(Array.from(entries[shots.find((x) => x.endsWith('/snapshot-3.png'))]), Array.from(small.bytes), 'a small one as it was');
    const fitted = await bcfXml.fitDataUrl(wide.url);
    assert.ok(fitted && fitted.snapshotType === 'png' && Math.max(bcfXml.imageSize(Uint8Array.from(atob(fitted.base64), (c) => c.charCodeAt(0))).width, 0) === 1500, 'a canvas picture for the BCF API');
    assert.equal(bcfXml.MAX_SNAPSHOT, 1500);
    await valid(assert, entries, '3.0', 'with snapshots');
    return 'ok';
  }, 30000);

  test("bcf: the header ties a topic to its model file: the file's name, its time stamp and the IfcProject", async (assert) => {
    const meta = { model: { file: 'hus-v3.ifc', headerName: 'Hus.ifc', timestamp: '2026-11-01T10:15', projectGuid: fx.IFC.project }, source: { cde: { reference: 'https://cde.example.org/documents/1.0/documents/d1/versions/3/download' } } };
    assert.deepEqual(bcfXml.headerOf(meta), [{ filename: 'Hus.ifc', date: '2026-11-01T10:15:00', ifc_project: fx.IFC.project, reference: 'https://cde.example.org/documents/1.0/documents/d1/versions/3/download' }]);
    assert.deepEqual(bcfXml.headerOf({ model: { file: 'a.ifc', projectGuid: 'not-one' } }), [{ filename: 'a.ifc', date: null, ifc_project: null }], 'no IfcProject that is none');
    assert.deepEqual(bcfXml.headerOf({ name: 'a table' }), [], 'no model, no header');
    // An imported IFC file gives the facts: the step reader keeps FILE_NAME's name and time stamp and the IfcProject's GlobalId.
    const model = await D.require('io/import').run(D.require('tests/fixtures/ifc').ifcFile({ walls: 1 }), { format: 'model' }, null, 'Huvudet');
    try {
      const m = (await D.require('data/datasets').get(model.id)).model;
      assert.ok(bcfXml.isIfcGuid(m.projectGuid) && m.headerName === 'testhus.ifc' && m.timestamp === '2026-11-04T12:00:00', JSON.stringify({ g: m.projectGuid, n: m.headerName, ts: m.timestamp }));
      const entries = await entriesOf(await bcfXml.write([{ topic: { title: 'Om modellen' }, header: bcfXml.headerOf(await D.require('data/datasets').get(model.id)) }]));
      const markup = Object.entries(entries).find(([n]) => /markup\.bcf$/.test(n))[1];
      assert.ok(text(markup).includes(`<File IfcProject="${m.projectGuid}" IsExternal="true"><Filename>testhus.ifc</Filename><Date>2026-11-04T12:00:00</Date></File>`), text(markup).slice(0, 300));
      await valid(assert, entries, '3.0', 'the header');
    } finally { await D.require('data/datasets').remove(model.id).catch(() => {}); }
    return 'ok';
  }, 60000);

  test("issues: Swedish review practice's six statuses mean open, in progress and done", async (assert) => {
    const issues = D.require('data/issues');
    const badge = D.require('ui/bearbeta/model-issues').badgeKind;
    assert.equal(issues.REVIEW_STATUSES.length, 6);
    const want = { 'Ny kommentar': 0, 'Ska åtgärdas': 1, 'Ny granskning': 1, 'Har åtgärdats': 2, Avvisad: 2, Godkänd: 2 };
    for (const r of issues.REVIEW_STATUSES) {
      assert.equal(issues.rank(r.status), want[r.status], r.status);
      assert.equal(issues.rank(r.status.toUpperCase()), want[r.status], 'in any case: ' + r.status);
      assert.equal(issues.rank(r.like), r.rank, `${r.status} is like ${r.like}`);
    }
    assert.ok(['Open', 'In progress', 'Resolved', 'Closed'].every((s) => issues.REVIEW_STATUSES.some((r) => r.like === s)), "Dataregium's defaults are the counterparts");
    const tk = D.require('viz/theme').tokens();
    const colors = issues.statusColors(issues.REVIEW_STATUSES.map((r) => r.status));
    assert.equal(colors.get('Ny kommentar'), tk.error); assert.equal(colors.get('Ska åtgärdas'), tk.warn); assert.equal(colors.get('Godkänd'), tk.ok); assert.equal(colors.get('Har åtgärdats'), tk.ok);
    assert.deepEqual(['Ny kommentar', 'Ska åtgärdas', 'Har åtgärdats', 'Open', 'Something else'].map(badge), ['warn', 'accent', 'ok', 'warn', undefined]);
    return 'ok';
  });

  // ---------------------------------------------------------------------------------------- the BCF API, against a virtual server
  const BASE = 'dataspatium-asset://tests/bcf-api';
  const http = D.require('api/http');
  const opencde = D.require('api/families/opencde');
  const sent = [];
  const json = (data, status = 200) => ({ kind: 'text', data: JSON.stringify(data), status });
  D.net.virtual('tests/bcf-api/', (url) => {
    const path = String(url).slice(BASE.length).split('?')[0];
    const req = sent[sent.length - 1] || {};
    if (path === '/foundation/versions') return Promise.resolve(json({ versions: [{ api_id: 'foundation', version_id: '1.0' }, { api_id: 'bcf', version_id: '3.0' }, { api_id: 'bcf', version_id: '2.1' }] }));
    if (path === '/foundation/1.0/auth') return Promise.resolve(json({ oauth2_auth_url: BASE + '/foundation/oauth2/auth', oauth2_token_url: BASE + '/foundation/oauth2/token' }));
    if (path === '/foundation/oauth2/token') return Promise.resolve(json({ access_token: 'tok', refresh_token: 'r', expires_in: 3600 }));
    if (path === '/foundation/1.0/current-user') return Promise.resolve(json({ id: 'reviewer@example.org', name: 'Reviewer' }));
    if (path === '/bcf/3.0/projects/p/files_information') return Promise.resolve(json([{ display_information: [], file: { ifc_project: null, file_name: 'served.ifc', reference: BASE + '/documents/1.0/documents/d1/versions/2/download' } }]));
    if (/^\/bcf\/(3\.0|2\.1)\/projects\/p\/topics\/t1\/files$/.test(path)) return Promise.resolve(json(req.method === 'PUT' ? JSON.parse(req.body) : []));
    if (path === '/bcf/3.0/projects/p/documents') return Promise.resolve(json({ guid: 'doc-1', filename: 'photo.jpg' }, 201));
    if (path === '/bcf/3.0/projects/p/topics/t1/document_references') return Promise.resolve(json(Object.assign({ guid: 'ref-1' }, JSON.parse(req.body)), 201));
    return Promise.resolve(json({ message: 'Not Found' }, 404));
  });
  const calls = (re) => sent.filter((r) => re.test(r.url.slice(BASE.length)));

  test('bcf API: a topic is tied to its model file with PUT files only when the server offers updateFiles, in the field names of 3.0 and 2.1', async (assert) => {
    const real = http.request;
    http.request = (req) => { if (String(req.url).startsWith(BASE)) sent.push({ url: String(req.url), method: String(req.method || 'GET'), body: req.body, headers: req.headers || {} }); return real(req); };
    const connectors = D.require('api/connectors');
    const connector = (await D.require('api/families/databases').createConnector('opencde', { baseUrl: BASE, clientId: 'dataspatium', clientSecret: '' })).connector;
    try {
      await opencde.login(connector, { popup: (u) => Promise.resolve(`${new URL(u).searchParams.get('redirect_uri')}?code=c&state=${new URL(u).searchParams.get('state')}`), redirectUri: 'http://127.0.0.1:8080/oauth-callback.html' });
      assert.equal(await opencde.identity(connector), 'reviewer@example.org', "the server's identity for the author");
      const cde = { connectorId: connector.id, projectId: 'p', documentId: 'd1', versionIndex: 2 };
      const fallback = { filename: 'local.ifc', ifc_project: fx.IFC.project, date: '2026-11-04T12:00:00' };
      const file = await opencde.modelFile(connector, 'p', cde, fallback);
      assert.deepEqual(opencde.filesBody(connector, [file]), [{ ifc_project: fx.IFC.project, reference: BASE + '/documents/1.0/documents/d1/versions/2/download', filename: 'served.ifc' }], "the project's own entry, with the IfcProject added");
      assert.deepEqual(await opencde.modelFile(connector, 'p', null, fallback), fallback, 'a model from elsewhere: its own header');
      const noRight = await opencde.linkTopic(connector, 'p', { guid: 't1' }, { topic_actions: ['update'] }, file);
      assert.ok(noRight === null && !calls(/\/files$/).some((r) => r.method === 'PUT'), 'nothing without updateFiles');
      assert.equal(await opencde.linkTopic(connector, 'p', { guid: 't1', authorization: { topic_actions: ['updateFiles'] } }, { topic_actions: [] }, file).then((x) => x.length), 1, "the topic's own authorization counts");
      const kept = await opencde.linkTopic(connector, 'p', { guid: 't1' }, { topic_actions: ['updateFiles'] }, file);
      const put = calls(/\/bcf\/3\.0\/projects\/p\/topics\/t1\/files$/).filter((r) => r.method === 'PUT').pop();
      assert.ok(put && JSON.parse(put.body)[0].filename === 'served.ifc' && kept[0].filename === 'served.ifc', 'PUT /topics/{guid}/files');
      // A connector of 2.1 names the file file_name and does not look in files_information.
      connector.family.bcfVersion = '2.1';
      assert.deepEqual(opencde.filesBody(connector, [fallback]), [{ ifc_project: fx.IFC.project, date: '2026-11-04T12:00:00', file_name: 'local.ifc' }]);
      sent.length = 0;
      assert.deepEqual(await opencde.modelFile(connector, 'p', cde, fallback), fallback);
      assert.ok(!calls(/files_information/).length, 'no files information in 2.1');
      await opencde.linkTopic(connector, 'p', { guid: 't1' }, { topic_actions: ['updateFiles'] }, fallback);
      assert.equal(JSON.parse(calls(/\/bcf\/2\.1\/projects\/p\/topics\/t1\/files$/).pop().body)[0].file_name, 'local.ifc');
      assert.equal(await opencde.attachDocument(connector, 'p', 't1', new File([new Uint8Array([1])], 'a.jpg'), 'x', { project_actions: ['createDocument'], topic_actions: ['updateDocumentReferences'] }), null, '2.1 has no document upload');
      connector.family.bcfVersion = '3.0';
      // A photo as a project document and a reference to it, with both rights; otherwise nothing is sent.
      sent.length = 0;
      assert.equal(await opencde.attachDocument(connector, 'p', 't1', new File([new Uint8Array([1])], 'a.jpg'), 'x', { project_actions: ['createTopic'], topic_actions: ['updateDocumentReferences'] }), null);
      assert.equal(sent.length, 0, 'without createDocument nothing is sent');
      const photo = new File([Uint8Array.from(atob(fx.JPEG), (c) => c.charCodeAt(0))], 'facade.jpg', { type: 'image/jpeg' });
      const attached = await opencde.attachDocument(connector, 'p', 't1', photo, 'Site photo: facade.jpg', { project_actions: ['createDocument'], topic_actions: ['updateDocumentReferences'] });
      const upload = calls(/\/bcf\/3\.0\/projects\/p\/documents$/).pop();
      assert.ok(upload && upload.method === 'POST' && /filename="facade\.jpg"/.test(upload.headers['Content-Disposition']) && upload.headers['Content-Type'] === 'image/jpeg', 'POST /documents with the file');
      const ref = calls(/document_references$/).pop();
      assert.deepEqual(JSON.parse(ref.body), { document_guid: 'doc-1', description: 'Site photo: facade.jpg' }, 'POST /document_references to it');
      assert.ok(attached && attached.document.guid === 'doc-1' && attached.reference.guid === 'ref-1');
    } finally {
      http.request = real;
      await opencde.logout(connector).catch(() => {}); await connectors.remove(connector.id).catch(() => {});
      D.net.unvirtual('tests/bcf-api/');
    }
    return 'ok';
  }, 30000);
})();
