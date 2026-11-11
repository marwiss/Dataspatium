// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Stora modeller från servern (decision OB-20.1, step 4): a model dataset made from Dataregium without its IFC file. The geometry
 * comes as the server's binary glTF (`ifc_geometry`, lod full or box) and is kept with the dataset, and the rows come from the
 * glTF's nodes (id, GlobalId, class, storey) with names and containers from the server's named queries (`ifc_queries`). The
 * side tables of properties and quantities stay empty, and what needs the file (clash detection, the original's export) is not
 * there; the dataset says so through `model.geometry === 'server'`. Nothing is fetched before the person presses the button.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/model-server', ['data/datasets', 'data/dataset-files', 'data/model', 'api/families/opencde', 'engines/gltf'], (datasets, files, model, opencde, gltf) => {
    const GEOMETRY_FILE = 'geometry.glb';
    const LODS = ['full', 'box'];

    /** The server's geometry kept with a model, or null. @param {string} id @returns {Promise<{bytes: Uint8Array, name: string}|null>} */
    async function geometry(id) {
      const list = await files.list(id, 'geometry');
      if (!list.length) return null;
      const f = await files.read(id, list[0].name, 'geometry');
      return f ? { bytes: f.bytes, name: list[0].name } : null;
    }
    /** The host of a server address, for the dataset's source. */
    const hostOf = (url) => { try { return new URL(String(url)).host; } catch (_e) { return String(url || ''); } };
    /** Whether a model dataset draws the server's geometry. @param {any} meta */
    const isServer = (meta) => !!(meta && meta.kind === 'model' && meta.model && meta.model.geometry === 'server');

    /** A named query's answer as a map from a column to each row. */
    const column = (out, name) => (out && Array.isArray(out.columns) ? out.columns.indexOf(name) : -1);

    /**
     * Fetches a version's geometry and its elements from the server and makes the model dataset.
     * @param {any} connector @param {any} project {project_id, name} @param {any} entry a file of the project (documentId, versionIndex, filename, reference)
     * @param {{lod?: string, classes?: string, name?: string, onProgress?: (n: number) => void, io?: {geometry?: Function, query?: Function}}} [options]
     *   io replaces the server calls (tests)
     * @returns {Promise<any>} the dataset's meta
     */
    async function fetchLarge(connector, project, entry, options = {}) {
      const lod = LODS.includes(String(options.lod)) ? String(options.lod) : 'full';
      const io = Object.assign({ geometry: opencde.ifcGeometry, query: opencde.ifcQuery }, options.io || {});
      const got = await io.geometry(connector, entry.documentId, entry.versionIndex, { lod, classes: options.classes || '' });
      const glb = got instanceof Uint8Array ? got : new Uint8Array(got);
      // The worker stays for the drawing that follows; viz/model-draw.clearCache stops it with the IFC engine's.
      const parsed = await gltf.meshes(glb, { onProgress: options.onProgress });
      if (!parsed.nodes.length) throw new Error(D.t('large.err.empty'));
      // The storeys by GlobalId, for the elements' storey column, and the names and containers of each class's elements.
      const storeyName = new Map(); const storeys = [];
      const st = await io.query(connector, entry.documentId, entry.versionIndex, 'storeys', {}).catch(() => null);
      if (st) {
        const g = column(st, 'global_id'); const n = column(st, 'name'); const e = column(st, 'elevation');
        for (const r of st.rows || []) { storeyName.set(String(r[g]), String(r[n] || '')); storeys.push({ name: String(r[n] || ''), elevation: r[e] }); }
      }
      const named = new Map();
      for (const cls of Array.from(new Set(parsed.nodes.map((x) => x.cls).filter(Boolean)))) {
        const out = await io.query(connector, entry.documentId, entry.versionIndex, 'elements', { class: cls }).catch(() => null);
        if (!out) continue;
        const g = column(out, 'global_id'); const n = column(out, 'name'); const c = column(out, 'container');
        for (const r of out.rows || []) named.set(String(r[g]), { name: r[n], container: r[c] });
      }
      const text = (v) => (v === null || v === undefined ? '' : String(v));
      const rows = parsed.nodes.map((x) => {
        const info = named.get(x.guid) || {};
        return [x.id, x.guid, x.cls, x.cls === 'IfcSpace' ? 'rum' : 'byggdel', text(info.name), '', '', '', storeyName.get(x.storey) || text(info.container), '', '', '', '', ''];
      });
      const name = options.name || String(entry.filename || 'modell').replace(/\.[^.]+$/, '');
      const handle = await datasets.createEmpty({ name, columns: model.IFC_COLUMNS, kind: 'model', source: null, description: '' });
      try {
        const e = handle.engine;
        await e.run('create table _properties (id integer, uppsattning text, namn text, varde text, tal real, enhet text, kalla text)');
        await e.run('create table _quantities (id integer, uppsattning text, namn text, varde real, slag text, enhet text)');
        await e.run('create table _entities (id integer primary key, typ text, attribut text)');
        await datasets.appendImportRows(handle, rows);
        await e.run('create index _properties_id on _properties (id)');
        await e.run('create index _quantities_id on _quantities (id)');
        await files.put(handle, [{ name: GEOMETRY_FILE, kind: 'geometry', type: 'model/gltf-binary', bytes: glb }]);
        const counts = new Map();
        for (const x of parsed.nodes) counts.set(x.cls, (counts.get(x.cls) || 0) + 1);
        const summary = {
          schema: '', units: {}, entities: rows.length, types: Array.from(counts, ([n, count]) => ({ name: n, count })).sort((a, b) => b.count - a.count).slice(0, 400),
          storeys, elements: rows.filter((r) => r[3] === 'byggdel').length, rows: rows.length, rooms: rows.filter((r) => r[3] === 'rum').length, properties: 0,
          file: entry.filename || '', geometry: 'server', lod, geometryAt: new Date().toISOString(),
        };
        handle.meta.model = summary;
        await e.run('insert or replace into _meta (key, value) values (?, ?)', ['model', JSON.stringify(summary)]);
        const meta = await datasets.finishImport(handle, {});
        const cde = { connectorId: connector.id, connectorName: connector.name, host: hostOf(connector.baseUrl), projectId: project.project_id, projectName: project.name || '', kind: 'document', reference: entry.reference, documentId: entry.documentId, versionIndex: entry.versionIndex, ifcProject: entry.ifcProject, fetchedAt: new Date().toISOString() };
        await datasets.updateMeta(meta.id, { source: { kind: 'file', fileName: entry.filename || '', cde, large: { lod } } });
        return datasets.get(meta.id);
      } catch (err) { datasets.abortImport(handle); throw err; }
    }
    return { GEOMETRY_FILE, LODS, geometry, isServer, fetchLarge };
  });
})();
