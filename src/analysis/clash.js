// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Kollisionskontroll: set A against set B, within one IFC model or across two from the same project, on the triangles web-ifc
 * makes of the file (the same as the 3D view's), in the IFC worker with analysis/clash-core. The result is a list of pairs with
 * both elements, the kind, the depth or the distance and a point in the model's own coordinates (Z up, metres). From it come a
 * table, a mark in the model view, and BCF topics, one per pair with a viewpoint on the point, as a file or on the server.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/clash', ['data/datasets', 'data/model', 'engines/ifc', 'data/bcf-xml'], (datasets, model, ifc, bcfXml) => {
    const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
    const KINDS = ['intersection', 'contained', 'clearance'];
    const MODES = ['intersection', 'clearance'];
    /** Elements without a body of their own, which never clash. */
    const LEFT_OUT = ['IfcOpeningElement', 'IfcOpeningStandardCase', 'IfcVirtualElement', 'IfcAnnotation'];
    const COLUMNS = [
      { name: 'a_id', type: 'integer' }, { name: 'a_guid', type: 'text' }, { name: 'a_typ', type: 'text' }, { name: 'a_namn', type: 'text' },
      { name: 'b_id', type: 'integer' }, { name: 'b_guid', type: 'text' }, { name: 'b_typ', type: 'text' }, { name: 'b_namn', type: 'text' },
      { name: 'slag', type: 'text' }, { name: 'djup_mm', type: 'number' }, { name: 'avstand_mm', type: 'number' },
      { name: 'x', type: 'number' }, { name: 'y', type: 'number' }, { name: 'z', type: 'number' },
    ];

    /**
     * The element ids of a set: a model's building parts, of some types or all.
     * @param {string} datasetId @param {string[]|null} [types] @returns {Promise<number[]>}
     */
    async function idsOf(datasetId, types) {
      const engine = (await datasets.ensureOpen(datasetId)).engine;
      const where = ["kategori = 'byggdel'", `typ not in (${LEFT_OUT.map(q).join(', ')})`];
      if (types && types.length) where.push(`typ in (${types.map(q).join(', ')})`);
      const res = await engine.exec(`select id from data where ${where.join(' and ')}`);
      return res[0] ? res[0].values.map((r) => Number(r[0])) : [];
    }
    /** GlobalId, type, name and storey of some elements. @returns {Promise<Map<number, any>>} */
    async function infoOf(datasetId, ids) {
      const out = new Map();
      if (!ids.length) return out;
      const engine = (await datasets.ensureOpen(datasetId)).engine;
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500).map(Number).filter(Number.isFinite);
        const res = await engine.exec(`select id, guid, typ, namn, vaning from data where id in (${chunk.join(', ')})`);
        for (const r of (res[0] ? res[0].values : [])) out.set(Number(r[0]), { id: Number(r[0]), guid: r[1] || '', typ: r[2] || '', namn: r[3] || '', vaning: r[4] || '' });
      }
      return out;
    }

    /**
     * Run a clash check.
     * @param {{a: {datasetId: string, types?: string[]|null}, b: {datasetId: string, types?: string[]|null}, mode?: string, tolerance?: number, clearance?: number}} spec
     *   tolerance and clearance in metres
     * @param {{onProgress?: (p: {phase: string, done: number, total?: number}) => void}} [hooks]
     * @returns {Promise<any>} {spec, seconds, pairs, setA, setB, clashes: [{a, b, kind, depth, distance, point, extent}]}
     */
    async function run(spec, hooks = {}) {
      const mode = MODES.includes(spec.mode) ? spec.mode : 'intersection';
      const files = []; const fileOf = new Map();
      for (const side of ['a', 'b']) {
        const id = spec[side].datasetId;
        if (fileOf.has(id)) continue;
        const original = await model.original(id);
        const ds = await datasets.get(id);
        if (!original) throw new Error(D.t('clash.err.nofile', { name: ds ? ds.name : id }));
        fileOf.set(id, files.length);
        files.push({ datasetId: id, bytes: original.bytes instanceof Uint8Array ? original.bytes : new Uint8Array(original.bytes), a: undefined, b: undefined });
      }
      files[fileOf.get(spec.a.datasetId)].a = await idsOf(spec.a.datasetId, spec.a.types || null);
      files[fileOf.get(spec.b.datasetId)].b = await idsOf(spec.b.datasetId, spec.b.types || null);
      const options = { mode, tolerance: Math.max(0, Number(spec.tolerance === undefined ? 0.002 : spec.tolerance)), clearance: Math.max(0, Number(spec.clearance === undefined ? 0.05 : spec.clearance)) };
      const t0 = performance.now();
      let res;
      try { res = await ifc.clash(files.map((f) => ({ bytes: f.bytes, a: f.a, b: f.b })), options, { onProgress: hooks.onProgress }); } finally { ifc.release(); }
      const infos = [];
      for (let f = 0; f < files.length; f++) {
        const ids = new Set();
        for (const c of res.clashes) { if (c.am === f) ids.add(c.a); if (c.bm === f) ids.add(c.b); }
        infos.push(await infoOf(files[f].datasetId, Array.from(ids)));
      }
      const side = (f, id) => Object.assign({ id, guid: '', typ: '', namn: '', vaning: '' }, infos[f].get(id) || {}, { datasetId: files[f].datasetId });
      const clashes = res.clashes.map((c) => ({ a: side(c.am, c.a), b: side(c.bm, c.b), kind: c.kind, depth: c.depth === undefined ? null : c.depth, distance: c.distance === undefined ? null : c.distance, point: c.point, extent: c.extent || 0 }));
      clashes.sort((x, y) => (y.depth || 0) - (x.depth || 0) || (x.distance || 0) - (y.distance || 0));
      // Elements web-ifc draws no geometry for (the 3D view shows them neither) take no part; the result says how many.
      const asked = new Set();
      for (let f = 0; f < files.length; f++) for (const id of (files[f].a || []).concat(files[f].b || [])) asked.add(f + ':' + id);
      const drawn = new Set(res.drawn || []);
      let missing = 0;
      for (const key of asked) if (!drawn.has(key)) missing++;
      return { spec: Object.assign({}, spec, options), seconds: Math.round((performance.now() - t0) / 100) / 10, pairs: res.pairs, setA: res.a, setB: res.b, missing, clashes };
    }

    const mm = (m) => (m === null || m === undefined ? null : Math.round(m * 10000) / 10);
    const metre = (v) => Math.round(v * 1000) / 1000;
    /**
     * The result as a table: one row per pair, both elements, the kind, depth and distance in millimetres, and the point.
     * @param {any} result @returns {{columns: Array<{name: string, type: string}>, rows: any[][]}}
     */
    function tableOf(result) {
      return {
        columns: COLUMNS.map((c) => Object.assign({}, c)),
        rows: (result.clashes || []).map((c) => [c.a.id, c.a.guid, c.a.typ, c.a.namn, c.b.id, c.b.guid, c.b.typ, c.b.namn, c.kind, mm(c.depth), mm(c.distance), metre(c.point[0]), metre(c.point[1]), metre(c.point[2])]),
      };
    }
    /** The ids of the elements of one model that clash, as a condition on its table. @returns {string|null} */
    function whereOf(result, datasetId) {
      const ids = new Set();
      for (const c of result.clashes || []) { if (c.a.datasetId === datasetId) ids.add(c.a.id); if (c.b.datasetId === datasetId) ids.add(c.b.id); }
      return ids.size ? `id in (${Array.from(ids).map(Number).join(', ')})` : null;
    }
    /**
     * A BCF viewpoint on one clash: the camera looks down at the point from the south-east, far enough to show where the two
     * meet, and both elements are selected and, when colours are given, coloured (the caller takes them from the theme). In the
     * model's coordinates, as BCF wants them, so that every client puts the camera in the same place.
     * @param {any} c a clash @param {{a?: string, b?: string}} [colors] hex without #
     */
    function viewpointOf(c, colors = {}) {
      const p = c.point;
      const dist = Math.min(40, Math.max(2.5, (c.extent || 0) * 1.5 + 2));
      const dir = [-1, 1, -1].map((v) => v / Math.sqrt(3));
      const eye = [p[0] - dir[0] * dist, p[1] - dir[1] * dist, p[2] - dir[2] * dist];
      const camera = bcfXml.cameraFromView({ position: eye, target: p, fov: 60, aspect: 1.6 }, { worldUp: [0, 0, 1] });
      const comp = (s) => ({ ifc_guid: s.guid, originating_system: 'Dataspatium' });
      const coloring = [];
      if (colors.a && c.a.guid) coloring.push({ color: colors.a, components: [comp(c.a)] });
      if (colors.b && c.b.guid) coloring.push({ color: colors.b, components: [comp(c.b)] });
      return {
        perspective_camera: camera,
        components: { selection: [c.a, c.b].filter((s) => s.guid).map(comp), coloring, visibility: { default_visibility: true } },
      };
    }
    /** The words of one clash: a title with both elements and a description with the kind and the measure. */
    function topicText(c, t) {
      const who = (s) => [s.typ, s.namn].filter(Boolean).join(' ') || `#${s.id}`;
      const measure = c.kind === 'clearance' ? t('clash.topic.distance', { mm: String(mm(c.distance)) }) : t('clash.topic.depth', { mm: String(mm(c.depth)) });
      return {
        title: t('clash.topic.title', { a: who(c.a), b: who(c.b) }).slice(0, 255),
        description: [t('clash.kind.' + c.kind), measure, `${c.a.guid || '#' + c.a.id} · ${c.b.guid || '#' + c.b.id}`, t('clash.topic.point', { x: String(metre(c.point[0])), y: String(metre(c.point[1])), z: String(metre(c.point[2])) })].join('\n'),
      };
    }
    /**
     * The clashes as a BCF-XML 3.0 file, one topic per pair with its viewpoint.
     * @param {any} result @param {{t: Function, projectName?: string, author?: string, colors?: {a?: string, b?: string}, header?: any[]}} options
     * @returns {Promise<Blob>}
     */
    async function bcfFile(result, options) {
      const t = options.t;
      const items = (result.clashes || []).map((c) => {
        const text = topicText(c, t);
        return {
          topic: { guid: bcfXml.newGuid(), title: text.title, description: text.description, topic_type: 'Clash', topic_status: 'Open', labels: [t('clash.label')], creation_author: options.author || '', creation_date: new Date().toISOString() },
          comments: [], viewpoints: [{ viewpoint: Object.assign({ guid: bcfXml.newGuid() }, viewpointOf(c, options.colors)) }], header: options.header || [],
        };
      });
      return bcfXml.write(items, { projectName: options.projectName });
    }
    /**
     * A short account of a result for the card Validera modellen.
     * @param {any} result @returns {{mode: string, count: number, pairs: number, setA: number, setB: number, seconds: number, tolerance: number, clearance: number}}
     */
    function summaryOf(result) {
      return { mode: result.spec.mode, server: !!result.server, count: (result.clashes || []).length, pairs: result.pairs, setA: result.setA, setB: result.setB, missing: result.missing || 0, seconds: result.seconds, tolerance: result.spec.tolerance, clearance: result.spec.clearance };
    }
    /**
     * The server's clash report (Dataregium's ifc_clash) in the form of a check run here, so that the same table, marking, BCF
     * file and topics work: each element goes to the dataset of its document version, and `index` keeps its place in the report.
     * @param {any} report @param {Array<{datasetId: string, documentId: string, versionIndex: number}>} models
     */
    function fromServer(report, models) {
      const which = (e) => (models.find((m) => m.documentId === e.document_id && Number(m.versionIndex) === Number(e.version_index)) || models[0]).datasetId;
      const side = (e) => ({ id: Number(e.id), guid: e.guid || '', typ: e.type || '', namn: e.name || '', vaning: e.storey || '', datasetId: which(e) });
      const req = report.request || {};
      const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      return {
        spec: { a: { datasetId: models[0].datasetId, types: (req.a && req.a.types) || null }, b: { datasetId: (models[1] || models[0]).datasetId, types: (req.b && req.b.types) || null }, mode: req.mode || 'intersection', tolerance: req.tolerance, clearance: req.clearance },
        seconds: n(report.seconds), pairs: null, setA: n(report.set_a), setB: n(report.set_b), missing: n(report.missing), truncated: !!report.truncated,
        server: { id: report.id },
        clashes: (report.clashes || []).map((c, index) => ({ a: side(c.a), b: side(c.b), kind: c.kind, depth: c.depth === undefined ? null : c.depth, distance: c.distance === undefined ? null : c.distance, point: c.point, extent: c.extent === undefined ? null : c.extent, index })),
      };
    }

    return { KINDS, MODES, LEFT_OUT, COLUMNS, idsOf, infoOf, run, tableOf, whereOf, viewpointOf, topicText, bcfFile, summaryOf, fromServer };
  });
})();
