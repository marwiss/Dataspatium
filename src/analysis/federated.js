// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dubbletter mellan modeller: two or more IFC models of one building (the architect's and the structural engineer's, say, federated
 * into one coordination model) tried against each other. Three findings:
 * - guid: the same GlobalId in more than one model, on an element or a room. The spatial structure (project, site, building,
 *   storeys) is only counted, since models that start from one shared base keep its GlobalIds on purpose.
 * - element: two elements of different models of the same class, or of classes that model the same thing (a roof and a slab, a
 *   flight and its stair), whose geometry overlaps at or above a threshold: by volume where the meshes allow it, else by box. The
 *   geometry is the clash check's: web-ifc's triangles in the IFC worker with analysis/clash-core.
 * - storey: a storey name that two models give different elevations.
 * Each finding names the model each element came from. From the result come a table, a mark in the model view and BCF topics.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/federated', ['data/datasets', 'data/model', 'analysis/clash', 'engines/ifc', 'data/bcf-xml'], (datasets, model, clash, ifc, bcfXml) => {
    const KINDS = ['guid', 'element', 'storey'];
    /** Classes that model the same thing as another class: a roof as a slab, a flight as its stair or ramp. */
    const SAME = { IfcRoof: 'IfcSlab', IfcStairFlight: 'IfcStair', IfcRampFlight: 'IfcRamp' };
    /** The overlap that makes two elements one, as a share. */
    const THRESHOLD = 0.9;
    /** Storeys of one name whose elevations differ by more than this (metres) are a finding. */
    const STOREY_TOLERANCE = 0.001;
    const PAGE = 20000;
    const COLUMNS = [
      { name: 'slag', type: 'text' },
      { name: 'a_modell', type: 'text' }, { name: 'a_id', type: 'integer' }, { name: 'a_guid', type: 'text' }, { name: 'a_typ', type: 'text' }, { name: 'a_namn', type: 'text' },
      { name: 'b_modell', type: 'text' }, { name: 'b_id', type: 'integer' }, { name: 'b_guid', type: 'text' }, { name: 'b_typ', type: 'text' }, { name: 'b_namn', type: 'text' },
      { name: 'volym_proc', type: 'number' }, { name: 'lada_proc', type: 'number' }, { name: 'hojd_a', type: 'number' }, { name: 'hojd_b', type: 'number' },
      { name: 'x', type: 'number' }, { name: 'y', type: 'number' }, { name: 'z', type: 'number' },
    ];

    /** The group of an IFC class: the class without StandardCase or ElementedCase, or the class it models the same thing as. */
    function groupOf(typ) {
      const base = String(typ || '').replace(/(StandardCase|ElementedCase)$/, '');
      return SAME[base] || base;
    }
    const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

    /** Every row of a model's table that has a GlobalId, page by page, so that no step holds the main thread long. */
    async function rowsOf(datasetId) {
      const engine = (await datasets.ensureOpen(datasetId)).engine;
      const out = [];
      let last = 0;
      for (;;) {
        const res = await engine.exec(`select id, guid, typ, namn, vaning, kategori from data where guid is not null and guid <> '' and id > ${last} order by id limit ${PAGE}`);
        const rows = res[0] ? res[0].values : [];
        for (const r of rows) out.push({ id: Number(r[0]), guid: String(r[1]), typ: r[2] || '', namn: r[3] || '', vaning: r[4] || '', kategori: r[5] || '' });
        if (rows.length < PAGE) return out;
        last = Number(rows[rows.length - 1][0]);
      }
    }

    /**
     * Run the check over two or more IFC model datasets.
     * @param {{datasetIds: string[], threshold?: number}} spec threshold as a share, 0.5–1
     * @param {{onProgress?: (p: {phase: string, done: number, total?: number}) => void}} [hooks]
     * @returns {Promise<any>} {spec, models: [{datasetId, name, elements}], seconds, pairs, missing, shared, counts, findings:
     *   [{kind, a, b, volume, box, share, point, extent, elevations}]}, every side {datasetId, model, id, guid, typ, namn, vaning}
     */
    async function run(spec, hooks = {}) {
      const ids = Array.from(new Set(spec.datasetIds || []));
      if (ids.length < 2) throw new Error(D.t('federated.err.two'));
      const threshold = Math.min(1, Math.max(0.5, Number(spec.threshold === undefined ? THRESHOLD : spec.threshold) || THRESHOLD));
      const t0 = performance.now();
      const models = [];
      for (const id of ids) {
        const ds = await datasets.get(id);
        const original = ds ? await model.original(id) : null;
        if (!original) throw new Error(D.t('clash.err.nofile', { name: ds ? ds.name : id }));
        models.push({ datasetId: id, name: ds.name, meta: ds, bytes: original.bytes instanceof Uint8Array ? original.bytes : new Uint8Array(original.bytes), rows: await rowsOf(id) });
      }
      const side = (f, r) => ({ datasetId: models[f].datasetId, model: models[f].name, id: r.id, guid: r.guid || '', typ: r.typ || '', namn: r.namn || '', vaning: r.vaning || '' });
      const findings = [];

      // (a) The same GlobalId in more than one model; the project's comes from the file's summary, as it is no product.
      const byGuid = new Map();
      models.forEach((m, f) => {
        const own = m.rows.slice();
        const project = m.meta.model && m.meta.model.projectGuid;
        if (project) own.push({ id: null, guid: project, typ: 'IfcProject', namn: m.meta.model.project || '', vaning: '', kategori: 'struktur' });
        for (const r of own) { let list = byGuid.get(r.guid); if (!list) byGuid.set(r.guid, list = []); list.push([f, r]); }
      });
      let shared = 0;
      const measure = [];
      for (const list of byGuid.values()) {
        if (new Set(list.map((x) => x[0])).size < 2) continue;
        if (list.every((x) => x[1].kategori === 'struktur')) { shared++; continue; }
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          const [fa, ra] = list[i]; const [fb, rb] = list[j];
          if (fa === fb) continue;
          const finding = { kind: 'guid', a: side(fa, ra), b: side(fb, rb), volume: null, box: null, share: null, point: null, extent: 0, elevations: null };
          findings.push(finding);
          if (ra.kategori === 'byggdel' && rb.kategori === 'byggdel') measure.push({ finding, pair: [fa, ra.id, fb, rb.id] });
        }
      }

      // (b) The same element twice, measured in the IFC worker on the clash check's geometry.
      const files = models.map((m) => {
        const els = m.rows.filter((r) => r.kategori === 'byggdel' && !clash.LEFT_OUT.includes(r.typ));
        return { bytes: m.bytes, ids: els.map((r) => r.id), groups: els.map((r) => groupOf(r.typ)), guids: els.map((r) => r.guid) };
      });
      let res;
      try { res = await ifc.duplicates(files, { threshold, pairs: measure.map((x) => x.pair) }, { onProgress: hooks.onProgress }); } finally { ifc.release(); }
      const measured = new Map((res.measured || []).map((x) => [[x.am, x.a, x.bm, x.b].join(':'), x]));
      for (const x of measure) {
        const got = measured.get(x.pair.join(':'));
        if (got) Object.assign(x.finding, { volume: got.volume, box: got.box, share: got.share, point: got.point, extent: got.extent || 0 });
      }
      const rowOf = models.map((m) => new Map(m.rows.map((r) => [r.id, r])));
      const elements = [];
      for (const d of res.duplicates || []) {
        const ra = rowOf[d.am].get(d.a); const rb = rowOf[d.bm].get(d.b);
        if (ra && rb) elements.push({ kind: 'element', a: side(d.am, ra), b: side(d.bm, rb), volume: d.volume, box: d.box, share: d.share, point: d.point, extent: d.extent || 0, elevations: null });
      }
      elements.sort((x, y) => y.share - x.share);
      findings.push(...elements);

      // (c) Storeys of one name at different elevations.
      for (let i = 0; i < models.length; i++) for (let j = i + 1; j < models.length; j++) {
        for (const sa of (models[i].meta.model && models[i].meta.model.storeys) || []) {
          for (const sb of (models[j].meta.model && models[j].meta.model.storeys) || []) {
            if (!nameKey(sa.name) || nameKey(sa.name) !== nameKey(sb.name)) continue;
            if (typeof sa.elevation !== 'number' || typeof sb.elevation !== 'number' || Math.abs(sa.elevation - sb.elevation) <= STOREY_TOLERANCE) continue;
            const row = (f, s) => rowOf[f].get(Number(s.id)) || { id: Number(s.id), guid: '', typ: 'IfcBuildingStorey', namn: s.name || '', vaning: '' };
            findings.push({ kind: 'storey', a: side(i, row(i, sa)), b: side(j, row(j, sb)), volume: null, box: null, share: null, point: null, extent: 0, elevations: [sa.elevation, sb.elevation] });
          }
        }
      }

      // Elements web-ifc draws no geometry for (the 3D view shows them neither) take no part in (b); the result says how many.
      const drawn = new Set(res.drawn || []);
      let missing = 0;
      files.forEach((file, f) => { for (const id of file.ids) if (!drawn.has(f + ':' + id)) missing++; });
      const counts = Object.fromEntries(KINDS.map((k) => [k, findings.filter((x) => x.kind === k).length]));
      return {
        spec: { datasetIds: ids, threshold }, seconds: Math.round((performance.now() - t0) / 100) / 10, pairs: res.pairs || 0, missing, shared, counts, findings,
        models: models.map((m, f) => ({ datasetId: m.datasetId, name: m.name, elements: (res.elements || [])[f] || 0 })),
      };
    }

    const pct = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 10);
    const metre = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);
    /**
     * The findings as a table: one row per finding, both sides with their model, the overlap by volume and by box in per cent,
     * a storey's two elevations in metres, and the point.
     * @param {any} result @returns {{columns: Array<{name: string, type: string}>, rows: any[][]}}
     */
    function tableOf(result) {
      return {
        columns: COLUMNS.map((c) => Object.assign({}, c)),
        rows: (result.findings || []).map((f) => [f.kind, f.a.model, f.a.id, f.a.guid, f.a.typ, f.a.namn, f.b.model, f.b.id, f.b.guid, f.b.typ, f.b.namn,
          pct(f.volume), pct(f.box), f.elevations ? metre(f.elevations[0]) : null, f.elevations ? metre(f.elevations[1]) : null,
          f.point ? metre(f.point[0]) : null, f.point ? metre(f.point[1]) : null, f.point ? metre(f.point[2]) : null]),
      };
    }
    /** The ids of one model's elements in the findings, as a condition on its table. @returns {string|null} */
    function whereOf(result, datasetId) {
      const ids = new Set();
      for (const f of result.findings || []) for (const s of [f.a, f.b]) if (s.datasetId === datasetId && s.id !== null && Number.isFinite(Number(s.id))) ids.add(Number(s.id));
      return ids.size ? `id in (${Array.from(ids).join(', ')})` : null;
    }
    /**
     * A BCF viewpoint on a finding with a place, as the clash check makes it: the camera on the point, both elements selected and
     * coloured; one component when both sides have the same GlobalId. Null for a finding without a place (a storey).
     * @param {any} f @param {{a?: string, b?: string}} [colors]
     */
    function viewpointOf(f, colors = {}) {
      if (!f.point) return null;
      const vp = clash.viewpointOf(f, colors);
      if (f.a.guid && f.a.guid === f.b.guid) { vp.components.selection = vp.components.selection.slice(0, 1); vp.components.coloring = vp.components.coloring.slice(0, 1); }
      return vp;
    }
    /** The words of a finding: a title with both sides and a description with the models and the measure. */
    function topicText(f, t) {
      const who = (s) => [s.typ, s.namn].filter(Boolean).join(' ') || `#${s.id}`;
      const lines = [t('federated.kind.' + f.kind), t('federated.topic.models', { a: `${who(f.a)} (${f.a.model})`, b: `${who(f.b)} (${f.b.model})` })];
      if (f.kind === 'storey') {
        lines.push(t('federated.topic.heights', { a: f.a.model, ha: String(metre(f.elevations[0])), b: f.b.model, hb: String(metre(f.elevations[1])), mm: String(Math.round(Math.abs(f.elevations[1] - f.elevations[0]) * 1000)) }));
      } else {
        if (f.share !== null && f.share !== undefined) lines.push(f.volume === null ? t('federated.topic.overlap.box', { box: String(pct(f.box)) }) : t('federated.topic.overlap', { volume: String(pct(f.volume)), box: String(pct(f.box)) }));
        lines.push(f.a.guid === f.b.guid ? f.a.guid : `${f.a.guid || '#' + f.a.id} · ${f.b.guid || '#' + f.b.id}`);
        if (f.point) lines.push(t('clash.topic.point', { x: String(metre(f.point[0])), y: String(metre(f.point[1])), z: String(metre(f.point[2])) }));
      }
      const title = f.kind === 'guid' ? t('federated.topic.guid', { guid: f.a.guid, a: f.a.model, b: f.b.model })
        : f.kind === 'storey' ? t('federated.topic.storey', { name: f.a.namn, a: f.a.model, b: f.b.model })
          : t('federated.topic.element', { a: who(f.a), b: who(f.b) });
      return { title: title.slice(0, 255), description: lines.join('\n') };
    }
    /**
     * The findings as a BCF-XML 3.0 file, one topic per finding with its viewpoint where it has a place, and in each topic's header
     * the files of the two models it is about.
     * @param {any} result @param {{t: Function, projectName?: string, author?: string, colors?: {a?: string, b?: string}}} options
     * @returns {Promise<Blob>}
     */
    async function bcfFile(result, options) {
      const t = options.t;
      const headers = new Map();
      for (const m of result.models || []) headers.set(m.datasetId, bcfXml.headerOf(await datasets.get(m.datasetId)));
      const headerOf = (f) => {
        const out = [];
        for (const id of [f.a.datasetId, f.b.datasetId]) for (const h of headers.get(id) || []) if (!out.some((x) => x.filename === h.filename && x.ifc_project === h.ifc_project)) out.push(h);
        return out;
      };
      const items = (result.findings || []).map((f) => {
        const text = topicText(f, t);
        const vp = viewpointOf(f, options.colors);
        return {
          topic: { guid: bcfXml.newGuid(), title: text.title, description: text.description, topic_status: 'Open', labels: [t('federated.label')], creation_date: new Date().toISOString() },
          comments: [], viewpoints: vp ? [{ viewpoint: Object.assign({ guid: bcfXml.newGuid() }, vp) }] : [], header: headerOf(f),
        };
      });
      return bcfXml.write(items, { projectName: options.projectName, author: options.author });
    }

    return { KINDS, SAME, THRESHOLD, STOREY_TOLERANCE, COLUMNS, groupOf, run, tableOf, whereOf, viewpointOf, topicText, bcfFile };
  });
})();
