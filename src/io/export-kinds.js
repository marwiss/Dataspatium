// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Exports that follow what a dataset is: places as KML, GPX and GeoPackage, pictures as a contact sheet, a plan as a sheet
 * and its provisions as a document, a model's quantities in Excel, its geometry as glTF, a drawing as PDF. Everything is
 * made here in the browser. Geometries are written in WGS 84.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/export-kinds', ['data/datasets', 'data/geo', 'data/dataset-files', 'engines/sqlite'], (datasets, geo, dsFiles, sqlite) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const xml = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));
    const COLUMNS_PER_SHEET = 4;
    const ROWS_PER_SHEET = 3;

    /**
     * A dataset's rows with their shapes in degrees. Rows without a shape are left out, and counted.
     * @param {string} id @returns {Promise<{name: string, columns: any[], features: any[], without: number}>}
     */
    async function placesOf(id) {
      const exporter = D.require('io/export');
      const source = await exporter.geometrySource(id);
      if (!source) throw new Error(D.t('export.err.nogeometry'));
      const meta = await datasets.get(id);
      const all = await datasets.columns(id);
      const at = (name) => all.findIndex((c) => c.name === name);
      const skip = new Set(source.column ? [source.column, 'geometry_type'] : ['geometry_type']);
      const columns = all.filter((c) => !skip.has(c.name));
      const features = []; let without = 0;
      for (const row of await datasets.allRows(id)) {
        let shape = null;
        if (source.column) shape = geo.parseGeometry(row[at(source.column)]);
        else if (typeof row[at(source.lon)] === 'number' && typeof row[at(source.lat)] === 'number') shape = { type: 'Point', coordinates: [row[at(source.lon)], row[at(source.lat)]] };
        if (!shape || !shape.type) { without++; continue; }
        features.push({ geometry: geo.isProjected([shape]) ? geo.toWgs84(shape) : shape, values: columns.map((c) => row[at(c.name)]) });
      }
      if (!features.length) throw new Error(D.t('export.err.nogeometry'));
      return { name: meta ? meta.name : 'dataspatium', columns, features, without };
    }
    /** The column that best names a place: the first text that is not long. */
    function labelIndex(columns, features) {
      return columns.findIndex((c, i) => c.type === 'text' && features.every((f) => f.values[i] === null || String(f.values[i]).length < 120));
    }

    // ---- KML ------------------------------------------------------------------------------------------------------------
    const coordinates = (list) => list.map((c) => `${c[0]},${c[1]}${c.length > 2 ? ',' + c[2] : ''}`).join(' ');
    function kmlGeometry(g) {
      switch (g.type) {
        case 'Point': return `<Point><coordinates>${coordinates([g.coordinates])}</coordinates></Point>`;
        case 'LineString': return `<LineString><coordinates>${coordinates(g.coordinates)}</coordinates></LineString>`;
        case 'Polygon': return `<Polygon>${g.coordinates.map((ring, i) => `<${i ? 'innerBoundaryIs' : 'outerBoundaryIs'}><LinearRing><coordinates>${coordinates(ring)}</coordinates></LinearRing></${i ? 'innerBoundaryIs' : 'outerBoundaryIs'}>`).join('')}</Polygon>`;
        case 'MultiPoint': return `<MultiGeometry>${g.coordinates.map((c) => kmlGeometry({ type: 'Point', coordinates: c })).join('')}</MultiGeometry>`;
        case 'MultiLineString': return `<MultiGeometry>${g.coordinates.map((c) => kmlGeometry({ type: 'LineString', coordinates: c })).join('')}</MultiGeometry>`;
        case 'MultiPolygon': return `<MultiGeometry>${g.coordinates.map((c) => kmlGeometry({ type: 'Polygon', coordinates: c })).join('')}</MultiGeometry>`;
        case 'GeometryCollection': return `<MultiGeometry>${(g.geometries || []).map(kmlGeometry).join('')}</MultiGeometry>`;
        default: return '';
      }
    }
    /** @param {string} id @returns {Promise<Blob>} */
    async function toKml(id) {
      const { name, columns, features } = await placesOf(id);
      const label = labelIndex(columns, features);
      const marks = features.map((f, n) => {
        const data = columns.map((c, i) => (f.values[i] === null || f.values[i] === undefined ? '' : `<Data name="${xml(c.name)}"><value>${xml(f.values[i])}</value></Data>`)).join('');
        return `<Placemark><name>${xml(label >= 0 && f.values[label] !== null ? f.values[label] : String(n + 1))}</name><ExtendedData>${data}</ExtendedData>${kmlGeometry(f.geometry)}</Placemark>`;
      });
      const text = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(name)}</name>\n${marks.join('\n')}\n</Document></kml>\n`;
      return new Blob([text], { type: 'application/vnd.google-earth.kml+xml' });
    }

    // ---- GPX ------------------------------------------------------------------------------------------------------------
    /** Points become waypoints; lines and the outlines of areas become tracks. @param {string} id @returns {Promise<Blob>} */
    async function toGpx(id) {
      const { name, columns, features } = await placesOf(id);
      const label = labelIndex(columns, features);
      const wpt = []; const trk = [];
      const nameOf = (f, n) => xml(label >= 0 && f.values[label] !== null ? f.values[label] : String(n + 1));
      const segment = (line) => `<trkseg>${line.map((c) => `<trkpt lat="${c[1]}" lon="${c[0]}"/>`).join('')}</trkseg>`;
      const write = (g, f, n) => {
        switch (g.type) {
          case 'Point': wpt.push(`<wpt lat="${g.coordinates[1]}" lon="${g.coordinates[0]}"><name>${nameOf(f, n)}</name></wpt>`); break;
          case 'MultiPoint': for (const c of g.coordinates) write({ type: 'Point', coordinates: c }, f, n); break;
          case 'LineString': trk.push(`<trk><name>${nameOf(f, n)}</name>${segment(g.coordinates)}</trk>`); break;
          case 'MultiLineString': case 'Polygon': trk.push(`<trk><name>${nameOf(f, n)}</name>${g.coordinates.map(segment).join('')}</trk>`); break;
          case 'MultiPolygon': trk.push(`<trk><name>${nameOf(f, n)}</name>${g.coordinates.flat().map(segment).join('')}</trk>`); break;
          case 'GeometryCollection': for (const part of g.geometries || []) write(part, f, n); break;
          default: break;
        }
      };
      features.forEach((f, n) => write(f.geometry, f, n));
      const text = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Dataspatium" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xml(name)}</name></metadata>\n${wpt.concat(trk).join('\n')}\n</gpx>\n`;
      return new Blob([text], { type: 'application/gpx+xml' });
    }

    // ---- GeoPackage -------------------------------------------------------------------------------------------------------
    /** A geometry as little-endian WKB. */
    function wkb(g) {
      const parts = [];
      const byte = (v) => parts.push(Uint8Array.of(v));
      const int = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); parts.push(b); };
      const point = (c) => { const b = new Uint8Array(16); const v = new DataView(b.buffer); v.setFloat64(0, c[0], true); v.setFloat64(8, c[1], true); parts.push(b); };
      const points = (list) => { int(list.length); list.forEach(point); };
      const CODE = { Point: 1, LineString: 2, Polygon: 3, MultiPoint: 4, MultiLineString: 5, MultiPolygon: 6, GeometryCollection: 7 };
      const write = (x) => {
        byte(1); int(CODE[x.type]);
        switch (x.type) {
          case 'Point': point(x.coordinates); break;
          case 'LineString': points(x.coordinates); break;
          case 'Polygon': int(x.coordinates.length); x.coordinates.forEach(points); break;
          case 'MultiPoint': int(x.coordinates.length); x.coordinates.forEach((c) => write({ type: 'Point', coordinates: c })); break;
          case 'MultiLineString': int(x.coordinates.length); x.coordinates.forEach((c) => write({ type: 'LineString', coordinates: c })); break;
          case 'MultiPolygon': int(x.coordinates.length); x.coordinates.forEach((c) => write({ type: 'Polygon', coordinates: c })); break;
          case 'GeometryCollection': int(x.geometries.length); x.geometries.forEach(write); break;
          default: throw new Error(D.t('export.err.nogeometry'));
        }
      };
      write(g);
      const size = parts.reduce((n, p) => n + p.length, 0);
      const out = new Uint8Array(size);
      let at = 0;
      for (const p of parts) { out.set(p, at); at += p.length; }
      return out;
    }
    /** GeoPackage's own header in front of the WKB: magic, version, little-endian without an envelope, and the coordinate system. */
    function geoPackageBlob(g) {
      const body = wkb(g);
      const out = new Uint8Array(8 + body.length);
      out.set([0x47, 0x50, 0, 1]);
      new DataView(out.buffer).setInt32(4, 4326, true);
      out.set(body, 8);
      return out;
    }
    const SQL_TYPE = (type) => (type === 'integer' || type === 'boolean' ? 'INTEGER' : type === 'number' ? 'REAL' : 'TEXT');
    /** @param {string} id @returns {Promise<Blob>} */
    async function toGeoPackage(id) {
      const { name, columns, features } = await placesOf(id);
      const table = 'objekt';
      const bounds = geo.bounds(features.map((f) => f.geometry));
      const engine = new sqlite.SqliteEngine();
      await engine.start();
      try {
        await engine.open();
        await engine.run('pragma application_id = 1196444487');
        await engine.run('pragma user_version = 10300');
        await engine.run('create table gpkg_spatial_ref_sys (srs_name text not null, srs_id integer primary key, organization text not null, organization_coordsys_id integer not null, definition text not null, description text)');
        await engine.run("insert into gpkg_spatial_ref_sys values ('Undefined Cartesian', -1, 'NONE', -1, 'undefined', null), ('Undefined geographic', 0, 'NONE', 0, 'undefined', null), ('WGS 84', 4326, 'EPSG', 4326, 'GEOGCS[\"WGS 84\",DATUM[\"WGS_1984\",SPHEROID[\"WGS 84\",6378137,298.257223563]],PRIMEM[\"Greenwich\",0],UNIT[\"degree\",0.0174532925199433]]', null)");
        await engine.run("create table gpkg_contents (table_name text primary key, data_type text not null, identifier text unique, description text default '', last_change datetime not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x double, min_y double, max_x double, max_y double, srs_id integer)");
        await engine.run('create table gpkg_geometry_columns (table_name text not null, column_name text not null, geometry_type_name text not null, srs_id integer not null, z tinyint not null, m tinyint not null, primary key (table_name, column_name))');
        await engine.run('insert into gpkg_contents (table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id) values (?, ?, ?, ?, ?, ?, ?, ?)', [table, 'features', name, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, 4326]);
        await engine.run("insert into gpkg_geometry_columns values (?, 'geom', 'GEOMETRY', 4326, 0, 0)", [table]);
        await engine.run(`create table ${q(table)} (fid integer primary key autoincrement, geom blob${columns.map((c) => `, ${q(c.name)} ${SQL_TYPE(c.type)}`).join('')})`);
        const names = ['geom'].concat(columns.map((c) => c.name));
        for (let i = 0; i < features.length; i += 500) {
          await engine.insertRows(table, names, features.slice(i, i + 500).map((f) => [geoPackageBlob(f.geometry)].concat(f.values)));
          await breathe();
        }
        return new Blob([await engine.export()], { type: 'application/geopackage+sqlite3' });
      } finally { engine.terminate(); }
    }

    // ---- pictures ---------------------------------------------------------------------------------------------------------
    /** A picture as a JPEG data URL, whatever it was stored as. */
    async function jpegOf(bytes, type) {
      const bitmap = await createImageBitmap(new Blob([bytes], { type }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return { url: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height };
    }
    /** The pictures on sheets, with their names, for looking through or printing. @param {string} id @returns {Promise<Blob>} */
    async function toContactSheet(id) {
      const JsPdf = await D.require('viz/export').ensurePdfLibs();
      const pictures = await dsFiles.list(id, 'thumb');
      if (!pictures.length) throw new Error(D.t('export.err.nofiles'));
      const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 10; const gap = 4; const caption = 6;
      const pageW = doc.internal.pageSize.getWidth(); const pageH = doc.internal.pageSize.getHeight();
      const cellW = (pageW - 2 * margin - (COLUMNS_PER_SHEET - 1) * gap) / COLUMNS_PER_SHEET;
      const cellH = (pageH - 2 * margin - (ROWS_PER_SHEET - 1) * gap) / ROWS_PER_SHEET;
      doc.setFontSize(8);
      for (let n = 0; n < pictures.length; n++) {
        const place = n % (COLUMNS_PER_SHEET * ROWS_PER_SHEET);
        if (n && place === 0) doc.addPage();
        const file = await dsFiles.read(id, pictures[n].name, 'thumb');
        if (!file) continue;
        const image = await jpegOf(file.bytes, file.type);
        const x = margin + (place % COLUMNS_PER_SHEET) * (cellW + gap);
        const y = margin + Math.floor(place / COLUMNS_PER_SHEET) * (cellH + gap);
        const scale = Math.min(cellW / image.width, (cellH - caption) / image.height);
        doc.addImage(image.url, 'JPEG', x + (cellW - image.width * scale) / 2, y, image.width * scale, image.height * scale);
        doc.text(pictures[n].name.length > 40 ? pictures[n].name.slice(0, 39) + '…' : pictures[n].name, x + cellW / 2, y + cellH - 1, { align: 'center' });
        if (n % 12 === 11) await breathe();
      }
      return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
    }

    // ---- plans ------------------------------------------------------------------------------------------------------------
    /** The plan's rows as objects. */
    async function planRows(id) {
      const cols = await datasets.columns(id);
      return (await datasets.allRows(id)).map((r) => Object.fromEntries(cols.map((c, i) => [c.name, r[i]])));
    }
    /** The provisions of a plan as a Word document, the list on a plan map. @param {string} id @returns {Promise<Blob>} */
    async function toProvisions(id) {
      const plan = D.require('data/plan');
      const meta = await datasets.get(id);
      const labels = { plan: D.t('plan.slag.detaljplan'), beteckning: D.t('plan.field.beteckning'), kommun: D.t('plan.field.kommun'), status: D.t('plan.field.status'), lagakraft: D.t('plan.field.lagakraft') };
      for (const typ of plan.OBJECT_TYPES) labels[typ] = D.t('plan.type.' + typ);
      const text = plan.provisionsMarkdown(meta.plan || {}, await planRows(id), labels);
      const ast = D.require('docgen/markdown').parse(text);
      return D.require('docgen/builders-office').toDocx(ast, { title: meta.name });
    }
    /** The plan on a sheet: the map with its legend and a title. @param {string} id @returns {Promise<Blob>} */
    async function toPlanSheet(id) {
      const meta = await datasets.get(id);
      const charts = D.require('viz/charts');
      const chart = charts.create('map', meta, meta.name);
      chart.map = D.require('viz/plan-map').defOf(meta, await datasets.columns(id));
      chart.map.legend = true;
      return D.require('viz/render').toBlob(chart, 'pdf', { width: 1200, height: 800 });
    }

    // ---- models -----------------------------------------------------------------------------------------------------------
    /** A model's quantities in Excel: the sums per type and name, and every value. @param {string} id @returns {Promise<Blob>} */
    async function toQuantities(id) {
      await D.assets.loadVendorScript('vendor/sheetjs/xlsx.full.min.js');
      const XLSX = /** @type {any} */ (globalThis).XLSX;
      const engine = (await datasets.ensureOpen(id)).engine;
      const sheet = async (sql) => { const r = await engine.exec(sql); return r[0] ? [r[0].columns].concat(r[0].values) : [[]]; };
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(await sheet('select d.typ, q.namn, q.enhet, sum(q.varde) as summa, count(distinct d.id) as element from _quantities q join data d on d.id = q.id group by d.typ, q.namn, q.enhet order by d.typ, q.namn')), D.t('export.quantities.sums'));
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(await sheet('select d.id, d.guid, d.typ, d.namn as element, d.vaning, q.uppsattning, q.namn, q.varde, q.enhet from _quantities q join data d on d.id = q.id order by d.id, q.namn')), D.t('export.quantities.all'));
      return new Blob([XLSX.write(book, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    /** The geometry as binary glTF: one mesh per colour, as it is drawn. @param {string} id @returns {Promise<Blob>} */
    async function toGlb(id) {
      const meshes = await D.require('viz/model-draw').meshesOf(id);
      const json = { asset: { version: '2.0', generator: 'Dataspatium' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] };
      const chunks = []; let offset = 0;
      const add = (array, target) => {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
        chunks.push(bytes);
        const padding = (4 - (bytes.length % 4)) % 4;
        if (padding) chunks.push(new Uint8Array(padding));
        offset += bytes.length + padding;
        return json.bufferViews.length - 1;
      };
      const ARRAY_BUFFER = 34962; const ELEMENT_ARRAY_BUFFER = 34963; const FLOAT = 5126; const UNSIGNED_INT = 5125;
      for (const batch of meshes.batches) {
        const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
        const positions = Float32Array.from(batch.positions);
        for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { if (positions[i + k] < min[k]) min[k] = positions[i + k]; if (positions[i + k] > max[k]) max[k] = positions[i + k]; }
        const count = positions.length / 3;
        if (!count || !batch.index.length) continue;
        json.accessors.push({ bufferView: add(positions, ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3', min, max });
        const position = json.accessors.length - 1;
        json.accessors.push({ bufferView: add(Float32Array.from(batch.normals), ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3' });
        const normal = json.accessors.length - 1;
        json.accessors.push({ bufferView: add(Uint32Array.from(batch.index), ELEMENT_ARRAY_BUFFER), componentType: UNSIGNED_INT, count: batch.index.length, type: 'SCALAR' });
        const indices = json.accessors.length - 1;
        const c = batch.color || [0.8, 0.8, 0.8, 1];
        json.materials.push({ pbrMetallicRoughness: { baseColorFactor: [c[0], c[1], c[2], c.length > 3 ? c[3] : 1], metallicFactor: 0, roughnessFactor: 1 }, alphaMode: c.length > 3 && c[3] < 1 ? 'BLEND' : 'OPAQUE', doubleSided: true });
        json.meshes.push({ primitives: [{ attributes: { POSITION: position, NORMAL: normal }, indices, material: json.materials.length - 1 }] });
        json.nodes.push({ mesh: json.meshes.length - 1 });
        json.scenes[0].nodes.push(json.nodes.length - 1);
        await breathe();
      }
      if (!json.meshes.length) throw new Error(D.t('model.err.nofile'));
      json.buffers[0].byteLength = offset;
      let head = new TextEncoder().encode(JSON.stringify(json));
      const pad = (4 - (head.length % 4)) % 4;
      if (pad) { const padded = new Uint8Array(head.length + pad).fill(0x20); padded.set(head); head = padded; }
      const header = new ArrayBuffer(20);
      const view = new DataView(header);
      const total = 12 + 8 + head.length + 8 + offset;
      view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
      view.setUint32(12, head.length, true); view.setUint32(16, 0x4e4f534a, true);
      const binHeader = new ArrayBuffer(8);
      const binView = new DataView(binHeader);
      binView.setUint32(0, offset, true); binView.setUint32(4, 0x004e4942, true);
      return new Blob([header, head, binHeader, ...chunks], { type: 'model/gltf-binary' });
    }
    /** A drawing as PDF, in vectors. @param {string} id @returns {Promise<Blob>} */
    async function toDrawingPdf(id) {
      const meta = await datasets.get(id);
      const svg = await D.require('viz/model-draw').toBlob({ kind: 'model', datasetId: id, name: meta ? meta.name : '' }, 'svg', { width: 1600, height: 1200 });
      return D.require('viz/export').svgToPdf(await svg.text(), { title: meta ? meta.name : '' });
    }

    const MAKERS = { kml: toKml, gpx: toGpx, gpkg: toGeoPackage, 'images-sheet': toContactSheet, 'plan-provisions': toProvisions, 'plan-sheet': toPlanSheet, 'model-quantities-xlsx': toQuantities, 'model-glb': toGlb, 'model-pdf': toDrawingPdf };
    /** @param {string} format @returns {boolean} */
    const handles = (format) => Object.prototype.hasOwnProperty.call(MAKERS, format);
    /** @param {string} id @param {string} format @returns {Promise<Blob>} */
    const make = (id, format) => MAKERS[format](id);

    return { handles, make, wkb, geoPackageBlob };
  });
})();
