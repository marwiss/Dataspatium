// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Importer for graphs (dataset kind "graph"): GraphML (.graphml), GEXF (.gexf), node-link JSON (nodes and
 * edges/links, also Cytoscape's elements; sniffed by io/import) and Cypher scripts as APOC exports them
 * (.cypher, .cql). One file becomes one graph dataset: nodes as rows, edges in `_edges`, the original kept.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/graph', ['data/graph', 'data/encoding'], (graph, encoding) => {
    const EXT = /\.(graphml|gexf|cypher|cql|cyp)$/i;
    function detect(file) { return EXT.test(file.name || ''); }
    /** True when a JSON or XML head is a graph (node-link JSON, GraphML, GEXF, Cypher). */
    function sniff(head) { return !!graph.detectText(head); }
    function formatOf(file, text) {
      const name = String(file && file.name || '').toLowerCase();
      if (/\.graphml$/.test(name)) return 'graphml';
      if (/\.gexf$/.test(name)) return 'gexf';
      if (/\.(cypher|cql|cyp)$/.test(name)) return 'cypher';
      return graph.detectText(text.slice(0, 65536)) || (/^\s*[{[]/.test(text) ? 'nodelink' : null);
    }
    async function read(file, options = {}) {
      const text = typeof file === 'string' ? file : (await encoding.readText(file, { encoding: options.encoding })).text;
      const format = options.graphFormat || formatOf(file, text);
      if (!format) throw new Error(D.t('graph.err.format'));
      const g = graph.parse(format, text);
      if (!g.nodes.length) throw new Error(D.t('graph.err.empty'));
      return { format, graph: g, summary: graph.summarise(g) };
    }
    const columns = () => graph.NODE_COLUMNS.map((c) => c.name);
    const nodeRows = (g) => g.nodes.map((n) => [n.id, n.label || null, n.name || null, Object.keys(n.properties || {}).length ? JSON.stringify(n.properties) : null]);
    const baseName = (file) => String(file && file.name || D.t('graph.name.default')).replace(/\.[^.]+$/, '');

    /** Preview for Inhämta: the graph's facts and the nodes as a table. */
    async function preview(file, options = {}) {
      const r = await read(file, options);
      return { kind: 'graph', format: 'graph', graphFormat: r.format, graph: r.summary, sample: { nodes: r.graph.nodes.slice(0, 60).map((n) => n.id), edges: r.graph.edges.slice(0, 2000).map((e) => [e.source, e.target]) }, header: true, columns: columns(), declaredTypes: graph.NODE_COLUMNS.map((c) => c.type), dataRows: nodeRows(r.graph).slice(0, options.previewRows || 100), totalRows: r.graph.nodes.length, datasetName: baseName(file) };
    }
    /** The nodes as a plain table (when someone insists on a table). */
    async function parse(file, options = {}) {
      const r = await read(file, options);
      return { columns: columns(), rows: nodeRows(r.graph), meta: { format: 'graph', graphFormat: r.format, declaredTypes: graph.NODE_COLUMNS.map((c) => c.type) } };
    }
    /** One graph file → one graph dataset with the original kept. */
    async function importFile(file, options = {}, name, progress) {
      if (progress) progress({ step: 'read', file: file.name });
      const r = await read(file, options);
      const original = { name: file.name, kind: 'original', type: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) };
      return graph.createGraphDataset({ name: name || baseName(file), graph: r.graph, files: [original], source: { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: 'graph', graphFormat: r.format } });
    }

    return { id: 'graph', kind: 'graph', detect, sniff, read, preview, parse, importFile, formatOf };
  });
})();
