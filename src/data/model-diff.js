// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What differs between two versions of a building model, element by element: the other version is a saved snapshot of the same
 * dataset or another model dataset (a newer version fetched from a CDE, a colleague's file). Elements are matched on GlobalId; an
 * element is "changed" when an attribute the table shows or a property (set.name) differs. Pure logic over two engines, answered in
 * the ids of each file so that the 3D view can colour either: green for what is only here, yellow for changed, red for what is only
 * in the other version. Dataregium's diff API (OB-30) will be a third source with the same shape.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/model-diff', ['data/datasets', 'engines/sqlite', 'platform/storage/idb', 'data/model'], (datasets, sqlite, idb, model) => {
    const MAX_LIST = 2000;
    const MAX_FIELDS = 20;
    /** The attributes compared, when the table has them; ids, counts and geometry stay out. */
    const FIELDS = ['typ', 'kategori', 'namn', 'beskrivning', 'objekttyp', 'tagg', 'vaning', 'typnamn', 'material', 'klassificering'];
    const same = (a, b) => (a === null || a === undefined || a === '' ? '' : String(a)) === (b === null || b === undefined || b === '' ? '' : String(b));

    async function hasTable(engine, name) {
      const r = await engine.exec("select count(*) from sqlite_master where type = 'table' and name = ?", [name]);
      return !!(r[0] && Number(r[0].values[0][0]));
    }
    /** Every element by GlobalId: its id and the attributes compared. */
    async function elementsOf(engine) {
      const r = await engine.exec('select * from data where guid is not null');
      const out = new Map();
      if (!r[0]) return out;
      const cols = r[0].columns;
      const idAt = cols.indexOf('id'); const guidAt = cols.indexOf('guid');
      const fieldAt = FIELDS.map((f) => [f, cols.indexOf(f)]).filter(([, i]) => i >= 0);
      for (const row of r[0].values) {
        const fields = {};
        for (const [f, i] of fieldAt) fields[f] = row[i];
        out.set(String(row[guidAt]), { id: Number(row[idAt]), fields });
      }
      return out;
    }
    /** Every property by element id: "set.name" → value. */
    async function propertiesOf(engine) {
      const out = new Map();
      if (!(await hasTable(engine, '_properties'))) return out;
      const r = await engine.exec('select id, uppsattning, namn, varde from _properties');
      for (const row of (r[0] ? r[0].values : [])) {
        const id = Number(row[0]);
        let props = out.get(id);
        if (!props) { props = new Map(); out.set(id, props); }
        props.set(`${row[1] || ''}.${row[2] || ''}`, row[3]);
      }
      return out;
    }
    const brief = (guid, e) => ({ guid, id: e.id, typ: e.fields.typ || '', namn: e.fields.namn || '', vaning: e.fields.vaning || '' });
    /**
     * The elements only here (in `here`), only there (in `there`) and changed, with the fields that differ.
     * @param {any} here the engine of this version @param {any} there the engine of the other version
     * @returns {Promise<{onlyHere: any[], onlyThere: any[], changed: any[], counts: {here: number, there: number, onlyHere: number, onlyThere: number, changed: number}, truncated: boolean}>}
     */
    async function compare(here, there) {
      const [a, b] = await Promise.all([elementsOf(here), elementsOf(there)]);
      const onlyHere = []; const onlyThere = []; const changed = [];
      let nHere = 0; let nThere = 0; let nChanged = 0;
      for (const [guid, e] of a) if (!b.has(guid)) { nHere++; if (onlyHere.length < MAX_LIST) onlyHere.push(brief(guid, e)); }
      for (const [guid, e] of b) if (!a.has(guid)) { nThere++; if (onlyThere.length < MAX_LIST) onlyThere.push(brief(guid, e)); }
      const [pa, pb] = await Promise.all([propertiesOf(here), propertiesOf(there)]);
      for (const [guid, e] of a) {
        const o = b.get(guid);
        if (!o) continue;
        const fields = [];
        for (const f of Object.keys(e.fields)) if (f in o.fields && !same(e.fields[f], o.fields[f])) fields.push({ name: f, here: e.fields[f], there: o.fields[f] });
        const ph = pa.get(e.id) || new Map(); const pt = pb.get(o.id) || new Map();
        for (const [key, v] of ph) if (!same(v, pt.get(key))) fields.push({ name: key, here: v, there: pt.has(key) ? pt.get(key) : null });
        for (const [key, v] of pt) if (!ph.has(key)) fields.push({ name: key, here: null, there: v });
        if (!fields.length) continue;
        nChanged++;
        if (changed.length < MAX_LIST) changed.push(Object.assign(brief(guid, e), { idThere: o.id, fields: fields.slice(0, MAX_FIELDS), moreFields: Math.max(0, fields.length - MAX_FIELDS) }));
      }
      return { onlyHere, onlyThere, changed, counts: { here: a.size, there: b.size, onlyHere: nHere, onlyThere: nThere, changed: nChanged }, truncated: nHere > MAX_LIST || nThere > MAX_LIST || nChanged > MAX_LIST };
    }
    /**
     * The other version as an engine with its IFC file: a saved snapshot of the dataset (`{datasetId, snapshot: n}`) opened from its
     * bytes in a worker of its own, or another model dataset (`{datasetId}`). Call `release()` when done.
     * @param {{datasetId: string, snapshot?: number}} ref
     * @returns {Promise<{engine: any, bytes: Uint8Array|null, label: string, release: () => void}>}
     */
    async function openOther(ref) {
      if (ref.snapshot) {
        const blob = await idb.loadBlob(`ds:${ref.datasetId}:v${ref.snapshot}`);
        if (!blob) throw new Error(D.t('datasets.version.gone'));
        const engine = new sqlite.SqliteEngine();
        await engine.start();
        await engine.open(blob.slice(0));
        let bytes = null;
        if (await hasTable(engine, '_files')) {
          const r = await engine.exec("select bytes from _files where kind = 'original' order by name limit 1");
          const raw = r[0] && r[0].values[0] ? r[0].values[0][0] : null;
          if (raw) bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        }
        const versions = await datasets.listVersions(ref.datasetId);
        const v = versions.find((x) => x.n === ref.snapshot);
        return { engine, bytes, label: v ? v.label : D.t('datasets.version.n', { n: ref.snapshot }), release: () => engine.terminate() };
      }
      const meta = await datasets.get(ref.datasetId);
      if (!meta || !model.isModel(meta) || model.isDxf(meta)) throw new Error(D.t('op.err.ifc.notmodel'));
      const handle = await datasets.ensureOpen(ref.datasetId);
      const file = await model.original(ref.datasetId);
      return { engine: handle.engine, bytes: file ? file.bytes : null, label: meta.name, release: () => {} };
    }
    /**
     * What a model dataset can be compared with: its saved snapshots and the other IFC models in the workspace, the ones with the same
     * file name first.
     * @param {string} datasetId @returns {Promise<Array<{datasetId: string, snapshot?: number, label: string}>>}
     */
    async function choices(datasetId) {
      const meta = await datasets.get(datasetId);
      const out = [];
      for (const v of (await datasets.listVersions(datasetId)).slice().reverse()) out.push({ datasetId, snapshot: v.n, label: D.t('compare.snapshot', { label: v.label, ts: D.require('ui/i18n').formatDateTime(v.ts) }) });
      const file = meta && meta.model ? String(meta.model.file || '') : '';
      const others = (await datasets.list()).filter((d) => d.id !== datasetId && model.isModel(d) && !model.isDxf(d));
      others.sort((x, y) => Number(!!(y.model && y.model.file === file)) - Number(!!(x.model && x.model.file === file)) || String(x.name).localeCompare(String(y.name)));
      for (const d of others) out.push({ datasetId: d.id, label: d.name });
      return out;
    }
    /**
     * The whole comparison of a model dataset with the other version named by `ref`.
     * @param {string} datasetId @param {{datasetId: string, snapshot?: number}} ref
     */
    async function diff(datasetId, ref) {
      const here = await datasets.ensureOpen(datasetId);
      const other = await openOther(ref);
      try {
        const result = await compare(here.engine, other.engine);
        return Object.assign(result, { other: { label: other.label, bytes: other.bytes, ref } });
      } finally { other.release(); }
    }
    return { FIELDS, MAX_LIST, compare, openOther, choices, diff };
  });
})();
