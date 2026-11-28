// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The formats Inhämta reads, in one table (PLAN 12 c and d): each with the extensions that name it, the group by purpose it is
 * listed under, the kind of dataset it becomes (data/kinds; '' for a QGIS project, which becomes a map view) and the importer
 * that reads it. The file picker's accept, the grouped list under the drop zone and the list of formats that a pasted text is
 * recognised as all come from here. tests/io.test.js keeps the table and the importers together, tests/sniff.test.js the list
 * of pasted formats and io/sniff. Plain data at start; io/sniff and the importers load with the group 'import'.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/formats', [], () => {
    /** The groups by purpose, in the order the views list them. */
    const GROUPS = ['models', 'plans', 'geo', 'tables', 'databases', 'stats', 'documents', 'images', 'graphs'];
    /**
     * @typedef {{id: string, name?: string, nameKey?: string, ext: string[], parts?: string[], group: string, kind: string,
     *   importer: string, text?: boolean, content?: boolean}} Format
     *   `name` is the format's own name and `nameKey` a text key where it needs words. `parts`: files read together with the
     *   format's own file when they lie beside it (a shapefile's dbf, prj, cpg and shx), offered by the picker too. `text`: a pasted
     *   text (or a file without an extension) is recognised as it, by io/sniff (its TEXT) or by the pipeline in the JSON or XML
     *   io/sniff finds. `content`: recognised by its contents among files whose extension another format reads by name (a plan in
     *   GeoJSON, a data package in a ZIP), so that its importer is not the one the name picks.
     */
    /** @type {Format[]} */
    const FORMATS = [
      { id: 'ifc', name: 'IFC', ext: ['ifc'], group: 'models', kind: 'model', importer: 'model', text: true },
      { id: 'ifczip', name: 'IFCZIP', ext: ['ifczip'], group: 'models', kind: 'model', importer: 'model' },
      { id: 'dxf', name: 'DXF', ext: ['dxf'], group: 'models', kind: 'model', importer: 'model', text: true },
      { id: 'bcf', nameKey: 'import.formats.bcf', ext: ['bcf', 'bcfzip'], group: 'models', kind: 'table', importer: 'bcf' },
      { id: 'planjson', nameKey: 'import.formats.planjson', ext: ['geojson', 'json'], group: 'plans', kind: 'plan', importer: 'detaljplan', text: true, content: true },
      { id: 'plangpkg', nameKey: 'import.formats.plangpkg', ext: ['gpkg'], group: 'plans', kind: 'plan', importer: 'sqlite', content: true },
      { id: 'planarchive', nameKey: 'import.formats.planarchive', ext: ['zip'], group: 'plans', kind: 'plan', importer: 'planarchive', content: true },
      { id: 'opdelivery', nameKey: 'import.formats.opdelivery', ext: ['zip'], group: 'plans', kind: 'plan', importer: 'opdelivery', content: true },
      { id: 'geojson', name: 'GeoJSON', ext: ['geojson'], group: 'geo', kind: 'table', importer: 'json', text: true },
      { id: 'geojsonseq', name: 'GeoJSON Lines', ext: ['geojsonl', 'geojsons', 'geojsonseq'], group: 'geo', kind: 'table', importer: 'json' },
      { id: 'topojson', name: 'TopoJSON', ext: ['topojson'], group: 'geo', kind: 'table', importer: 'geo', text: true },
      { id: 'kml', name: 'KML', ext: ['kml'], group: 'geo', kind: 'table', importer: 'geo', text: true },
      { id: 'kmz', name: 'KMZ', ext: ['kmz'], group: 'geo', kind: 'table', importer: 'geo' },
      { id: 'gpx', name: 'GPX', ext: ['gpx'], group: 'geo', kind: 'table', importer: 'geo', text: true },
      { id: 'gml', name: 'GML', ext: ['gml'], group: 'geo', kind: 'table', importer: 'gml', text: true },
      { id: 'shapefile', nameKey: 'import.formats.shapefile', ext: ['shp', 'zip'], parts: ['dbf', 'prj', 'cpg', 'shx'], group: 'geo', kind: 'table', importer: 'shapefile' },
      { id: 'gpkg', name: 'GeoPackage', ext: ['gpkg'], group: 'geo', kind: 'table', importer: 'sqlite' },
      { id: 'geotiff', name: 'GeoTIFF', ext: ['tif', 'tiff', 'gtiff'], group: 'geo', kind: 'raster', importer: 'raster' },
      { id: 'qgs', nameKey: 'import.formats.qgis', ext: ['qgs', 'qgz'], group: 'geo', kind: '', importer: 'qgis', text: true },
      { id: 'csv', nameKey: 'import.formats.csv', ext: ['csv', 'txt', 'tab', 'dat'], group: 'tables', kind: 'table', importer: 'csv', text: true },
      { id: 'tsv', name: 'TSV', ext: ['tsv'], group: 'tables', kind: 'table', importer: 'csv', text: true },
      { id: 'fixed', nameKey: 'import.formats.fixed', ext: ['fwf', 'prn'], group: 'tables', kind: 'table', importer: 'fixed' },
      { id: 'excel', name: 'Excel', ext: ['xlsx', 'xlsm', 'xls', 'xlsb'], group: 'tables', kind: 'table', importer: 'excel' },
      { id: 'ods', name: 'ODS', ext: ['ods'], group: 'tables', kind: 'table', importer: 'excel' },
      { id: 'fods', name: 'FODS', ext: ['fods'], group: 'tables', kind: 'table', importer: 'excel', text: true },
      { id: 'excelxml', name: 'Excel 2003 XML', ext: ['xml'], group: 'tables', kind: 'table', importer: 'excel', text: true, content: true },
      { id: 'oldsheets', nameKey: 'import.formats.oldsheets', ext: ['dbf', 'slk', 'sylk', 'dif', 'wk1', 'wk3', 'wk4', 'wks', 'wq1', 'wq2', 'wb1', 'wb2', 'wb3', 'qpw'], group: 'tables', kind: 'table', importer: 'excel' },
      { id: 'json', name: 'JSON', ext: ['json'], group: 'tables', kind: 'table', importer: 'json', text: true },
      { id: 'ndjson', name: 'JSON Lines', ext: ['ndjson', 'jsonl'], group: 'tables', kind: 'table', importer: 'json', text: true },
      { id: 'xml', name: 'XML', ext: ['xml'], group: 'tables', kind: 'table', importer: 'xml', text: true },
      { id: 'html', nameKey: 'import.formats.html', ext: ['html', 'htm', 'xhtml'], group: 'tables', kind: 'table', importer: 'tables', text: true },
      { id: 'tex', nameKey: 'import.formats.tex', ext: ['tex'], group: 'tables', kind: 'table', importer: 'tables', text: true },
      { id: 'parquet', name: 'Parquet', ext: ['parquet'], group: 'tables', kind: 'table', importer: 'r' },
      { id: 'datapackage', nameKey: 'import.formats.datapackage', ext: ['zip'], group: 'tables', kind: 'table', importer: 'datapackage', content: true },
      { id: 'sqlite', name: 'SQLite', ext: ['sqlite', 'sqlite3', 'db', 's3db'], group: 'databases', kind: 'table', importer: 'sqlite' },
      { id: 'sql', nameKey: 'import.formats.sql', ext: ['sql'], group: 'databases', kind: 'table', importer: 'sqlite', text: true },
      { id: 'access', name: 'Access', ext: ['mdb', 'accdb'], group: 'databases', kind: 'table', importer: 'access' },
      { id: 'spss', name: 'SPSS', ext: ['sav', 'zsav', 'por'], group: 'stats', kind: 'table', importer: 'r' },
      { id: 'stata', name: 'Stata', ext: ['dta'], group: 'stats', kind: 'table', importer: 'r' },
      { id: 'sas', name: 'SAS', ext: ['sas7bdat', 'xpt'], group: 'stats', kind: 'table', importer: 'r' },
      { id: 'px', name: 'PC-Axis (PX)', ext: ['px'], group: 'stats', kind: 'table', importer: 'r', text: true },
      { id: 'rdata', name: 'R (RDS, RData)', ext: ['rds', 'rda', 'rdata'], group: 'stats', kind: 'table', importer: 'r' },
      { id: 'jsonstat', name: 'JSON-stat', ext: ['json'], group: 'stats', kind: 'table', importer: 'json', text: true, content: true },
      { id: 'sdmx', name: 'SDMX-JSON', ext: ['json'], group: 'stats', kind: 'table', importer: 'json', text: true, content: true },
      { id: 'pdf', name: 'PDF', ext: ['pdf'], group: 'documents', kind: 'document', importer: 'documents' },
      { id: 'docx', name: 'Word', ext: ['docx'], group: 'documents', kind: 'document', importer: 'documents' },
      { id: 'odt', name: 'OpenDocument', ext: ['odt'], group: 'documents', kind: 'document', importer: 'documents' },
      { id: 'md', name: 'Markdown', ext: ['md', 'markdown'], group: 'documents', kind: 'document', importer: 'documents', text: true },
      { id: 'jpeg', name: 'JPEG', ext: ['jpg', 'jpeg'], group: 'images', kind: 'images', importer: 'images' },
      { id: 'png', name: 'PNG', ext: ['png'], group: 'images', kind: 'images', importer: 'images' },
      { id: 'webp', name: 'WebP', ext: ['webp'], group: 'images', kind: 'images', importer: 'images' },
      { id: 'gif', name: 'GIF', ext: ['gif'], group: 'images', kind: 'images', importer: 'images' },
      { id: 'bmp', name: 'BMP', ext: ['bmp'], group: 'images', kind: 'images', importer: 'images' },
      { id: 'avif', name: 'AVIF', ext: ['avif'], group: 'images', kind: 'images', importer: 'images' },
      { id: 'graphml', name: 'GraphML', ext: ['graphml'], group: 'graphs', kind: 'graph', importer: 'graph', text: true },
      { id: 'gexf', name: 'GEXF', ext: ['gexf'], group: 'graphs', kind: 'graph', importer: 'graph', text: true },
      { id: 'cypher', name: 'Cypher', ext: ['cypher', 'cql', 'cyp'], group: 'graphs', kind: 'graph', importer: 'graph', text: true },
      { id: 'nodelink', nameKey: 'import.formats.nodelink', ext: ['json'], group: 'graphs', kind: 'graph', importer: 'graph', text: true, content: true },
    ];

    /** A format's name, in the language shown. @param {Format} f */
    const nameOf = (f) => (f.nameKey ? D.t(f.nameKey) : String(f.name));
    /** @param {string} id @returns {Format|null} */
    const byId = (id) => FORMATS.find((f) => f.id === id) || null;
    /** Every extension of the table, once each, in its order. @returns {string[]} */
    const extensions = () => Array.from(new Set(FORMATS.flatMap((f) => f.ext)));
    /** What the file picker offers: every extension of the table with the parts that go with them, as `accept` takes them. */
    const accept = () => Array.from(new Set(extensions().concat(FORMATS.flatMap((f) => f.parts || [])))).map((e) => '.' + e).join(',');
    /**
     * The formats by group, in the order of GROUPS, without the groups that have none.
     * @param {(f: Format) => boolean} [keep] @returns {Array<{group: string, formats: Format[]}>}
     */
    function grouped(keep) {
      const list = keep ? FORMATS.filter(keep) : FORMATS;
      return GROUPS.map((group) => ({ group, formats: list.filter((f) => f.group === group) })).filter((g) => g.formats.length);
    }
    /** The formats that a pasted text is recognised as. */
    const pasted = () => FORMATS.filter((f) => f.text);

    return { GROUPS, FORMATS, nameOf, byId, extensions, accept, grouped, pasted };
  });
})();
