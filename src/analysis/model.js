// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Take-offs from a model dataset. Quantities per group come from the file's quantity sets, with one value per element
 * and kind (net before plain before gross, so that a wall is not counted twice), or are measured on the triangles of
 * the geometry when the file has none. Also a list of every quantity name, the values of a property, and the counts
 * of entity types. For a DXF drawing: count, length and area per layer and type. SQL does the work in the engine's
 * worker; measuring on the geometry runs engines/ifc in its worker.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/model', ['data/datasets', 'data/model', 'viz/model-draw'], (datasets, model, draw) => {
    const IFC_GROUPS = ['typ', 'vaning', 'material', 'typnamn', 'klassificering'];
    const DXF_GROUPS = ['lager', 'typ'];
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const col = (name, type, label) => ({ name, type, label: label || name });
    const round = (v, d = 3) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * Math.pow(10, d)) / Math.pow(10, d) : null);

    async function exec(id, sql) {
      const handle = await datasets.ensureOpen(id);
      const res = await handle.engine.exec(sql);
      return res[0] ? res[0].values : [];
    }
    const cleanGroups = (groups, allowed) => Array.from(new Set((groups || []).filter((g) => allowed.includes(g))));

    /**
     * Elements' quantities from the file's quantity sets, per group.
     * @param {string} id @param {{groups: string[], category?: string}} options
     */
    async function fromFile(id, options) {
      const groups = cleanGroups(options.groups, IFC_GROUPS);
      const select = groups.map(q);
      const where = options.category ? `where d.kategori = '${String(options.category).replace(/'/g, "''")}'` : '';
      const sql = `with ranked as (
          select id, slag, varde, row_number() over (partition by id, slag order by
            case when slag = 'area' and namn in ('NetSideArea', 'NetArea', 'NetFloorArea', 'NetSurfaceArea', 'Area') then 0
                 when namn like 'Net%' then 1 when namn like 'Gross%' then 3 else 2 end, namn) as rn
          from _quantities where slag in ('area', 'volym', 'vikt') or (slag = 'langd' and namn like '%Length%')),
        picked as (select id, max(case when slag = 'langd' then varde end) as langd, max(case when slag = 'area' then varde end) as area,
            max(case when slag = 'volym' then varde end) as volym, max(case when slag = 'vikt' then varde end) as vikt from ranked where rn = 1 group by id)
        select ${select.map((g) => 'd.' + g).concat(['count(*)', 'sum(p.langd)', 'sum(p.area)', 'sum(p.volym)', 'sum(p.vikt)']).join(', ')}
        from data d left join picked p on p.id = d.id ${where}
        ${groups.length ? 'group by ' + groups.map((_g, i) => i + 1).join(', ') + ' order by ' + groups.map((_g, i) => i + 1).join(', ') : ''}`;
      const rows = await exec(id, sql);
      return {
        columns: groups.map((g) => col(g, 'text')).concat([col('antal', 'integer'), col('langd_m', 'number'), col('area_m2', 'number'), col('volym_m3', 'number'), col('vikt_kg', 'number')]),
        rows: rows.map((r) => r.slice(0, groups.length + 1).concat(r.slice(groups.length + 1).map((v) => round(v)))),
      };
    }
    /**
     * Quantities measured on the geometry, per group: surface area and volume of the triangles.
     * @param {string} id @param {{groups: string[], category?: string, onProgress?: (n: number) => void}} options
     */
    async function fromGeometry(id, options) {
      const groups = cleanGroups(options.groups, IFC_GROUPS);
      const meshes = await draw.meshesOf(id, { onProgress: options.onProgress });
      const where = options.category ? ` where kategori = '${String(options.category).replace(/'/g, "''")}'` : '';
      const rows = await exec(id, `select id${groups.map((g) => ', ' + q(g)).join('')} from data${where}`);
      const out = new Map();
      for (const r of rows) {
        const key = JSON.stringify(r.slice(1));
        let e = out.get(key);
        if (!e) { e = { group: r.slice(1), count: 0, area: 0, volume: 0, drawn: 0 }; out.set(key, e); }
        e.count++;
        const st = meshes.stats.get(Number(r[0]));
        if (st) { e.area += st.area; e.volume += st.volume; e.drawn++; }
      }
      const sorted = Array.from(out.values()).sort((a, b) => String(a.group).localeCompare(String(b.group)));
      return {
        columns: groups.map((g) => col(g, 'text')).concat([col('antal', 'integer'), col('med_geometri', 'integer'), col('yta_m2', 'number'), col('volym_m3', 'number')]),
        rows: sorted.map((e) => e.group.concat([e.count, e.drawn, round(e.area), round(e.volume)])),
      };
    }
    /** Every quantity name in the file, per element type. */
    async function quantityList(id) {
      const rows = await exec(id, 'select d.typ, q.uppsattning, q.namn, q.slag, q.enhet, count(*), sum(q.varde) from _quantities q join data d on d.id = q.id group by 1, 2, 3, 4, 5 order by 1, 2, 3');
      return {
        columns: [col('typ', 'text'), col('uppsattning', 'text'), col('namn', 'text'), col('slag', 'text'), col('enhet', 'text'), col('antal', 'integer'), col('summa', 'number')],
        rows: rows.map((r) => r.slice(0, 6).concat([round(r[6])])),
      };
    }
    /** The properties in the file with how many elements have them. */
    async function propertyNames(id) {
      const rows = await exec(id, 'select uppsattning, namn, count(*) from _properties group by 1, 2 order by 1, 2');
      return rows.map((r) => ({ set: r[0], name: r[1], count: Number(r[2]) }));
    }
    /** One property's values with the number of elements per element type and value. */
    async function propertyValues(id, set, name) {
      const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
      const rows = await exec(id, `select d.typ, p.varde, p.enhet, count(*) from _properties p join data d on d.id = p.id where p.uppsattning = ${esc(set)} and p.namn = ${esc(name)} group by 1, 2, 3 order by 1, 4 desc, 2`);
      return { columns: [col('typ', 'text'), col('varde', 'text'), col('enhet', 'text'), col('antal', 'integer')], rows };
    }
    /** Count, length and area of a DXF drawing per layer and type. */
    async function drawing(id, groups) {
      const list = cleanGroups(groups, DXF_GROUPS);
      const by = list.length ? list : ['lager'];
      const rows = await exec(id, `select ${by.map(q).join(', ')}, count(*), sum(langd), sum(area) from data group by ${by.map((_g, i) => i + 1).join(', ')} order by ${by.map((_g, i) => i + 1).join(', ')}`);
      return {
        columns: by.map((g) => col(g, 'text')).concat([col('antal', 'integer'), col('langd', 'number'), col('area', 'number')]),
        rows: rows.map((r) => r.slice(0, by.length + 1).concat(r.slice(by.length + 1).map((v) => round(v)))),
      };
    }
    /** Tools that run in Python with IfcOpenShell (python/dataspatium.py `_ifc_tool`), in the order of the tab. */
    const IFC_TOOLS = ['validate', 'ids', 'structure', 'psets', 'select', 'geometry'];
    /**
     * One of IfcOpenShell's tools on the model: validate {express}, ids {ids: a path in Python's file system}, structure, psets {ifc_class, qtos}, select {query},
     * elements {ifc_class}, geometry {ifc_class}. Python starts and the wheels are fetched (after consent) the first time.
     * @returns {Promise<{columns: any[], rows: any[][], total: number}>}
     */
    async function ifcTool(id, tool, params = {}) {
      const res = await D.require('data/python-bridge').bridge.ifcTool(id, tool, params);
      return { columns: (res.columns || []).map((c) => col(String(c.name), String(c.type || 'text'))), rows: res.rows || [], total: Number(res.total) || 0, summary: res.summary || null };
    }
    /** Counts per entity type in the file (geometry too). */
    function entityTypes(meta) {
      const list = (meta && meta.model && meta.model.types) || [];
      return { columns: [col('typ', 'text'), col('antal', 'integer')], rows: list.map((x) => [x.name, x.count]) };
    }
    return { IFC_GROUPS, DXF_GROUPS, IFC_TOOLS, fromFile, fromGeometry, quantityList, propertyNames, propertyValues, drawing, entityTypes, ifcTool };
  });
})();
