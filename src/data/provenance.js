// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Where a dataset comes from and what it has become: its source, the datasets it was made from, its recipe and versions, and the
 * datasets, charts, dashboards, documents, notebooks, lists, flows and shares that build on it. Objects refer to datasets in
 * many shapes, so references are found by looking for the ids themselves in what is stored.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/provenance', ['data/datasets', 'data/recipes'], (datasets, recipes) => {
    const MAX_DEPTH = 4;
    const t = (key, params) => D.t(key, params);
    const CHART_TAG = /\{\{(?:diagram|karta|graf|modell|plan)\s+"([^"]+)"/g;
    /** Kinds of derived dataset that have a word of their own on the arrow. */
    const EDGE_WORDS = new Set(['join', 'append', 'aggregate', 'query']);

    /** The datasets a dataset was made from, by id, including ones that have since been removed. */
    function parentsOf(source, known) {
      if (!source) return [];
      const out = new Set();
      for (const key of ['from', 'left', 'right']) for (const v of [].concat(source[key] || [])) if (typeof v === 'string') out.add(v);
      for (const value of Object.values(source)) for (const v of [].concat(value || [])) if (typeof v === 'string' && known.has(v)) out.add(v);
      for (const join of (source.spec && source.spec.joins) || []) if (join && known.has(join.datasetId)) out.add(join.datasetId);
      return Array.from(out);
    }
    /** What a source that is not another dataset is called, or null. */
    function originOf(source) {
      if (!source) return null;
      if (source.fileName) return { kind: 'file', label: source.fileName };
      if (Array.isArray(source.files) && source.files.length) return { kind: 'file', label: source.files.length === 1 ? source.files[0].name : t('provenance.files', { n: source.files.length }), detail: source.files.map((f) => f.name).join(', ') };
      if (source.connectorName) return { kind: 'api', label: source.connectorName, detail: source.publisher || '' };
      if (source.url) return { kind: 'url', label: String(source.url) };
      if (source.kind === 'paste') return { kind: 'paste', label: t('provenance.source.paste') };
      if (source.kind === 'field') return { kind: 'field', label: t('provenance.source.field') };
      if (source.kind === 'api') return { kind: 'api', label: t('provenance.source.api') };
      return null;
    }
    const safely = async (fn, fallback) => { try { return await fn(); } catch (err) { D.log('provenance', err); return fallback; } };

    /**
     * The graph around a dataset.
     * @param {string} id
     * @returns {Promise<{center: string, nodes: Array<{id: string, kind: string, label: string, detail?: string, side: 'from'|'center'|'to', open?: any}>, edges: Array<{from: string, to: string, label: string}>}>}
     */
    async function of(id) {
      const all = await datasets.list();
      const known = new Map(all.map((m) => [m.id, m]));
      const nodes = new Map();
      const edges = [];
      const add = (node) => { if (!nodes.has(node.id)) nodes.set(node.id, node); return node.id; };
      const link = (from, to, label = '') => { if (!edges.some((e) => e.from === from && e.to === to)) edges.push({ from, to, label }); };
      const datasetNode = (dsId, side) => add({ id: dsId, kind: 'dataset', side, label: known.has(dsId) ? known.get(dsId).name : t('provenance.gone'), detail: known.has(dsId) ? D.require('data/kinds').summary(known.get(dsId)) : '', open: known.has(dsId) ? { mode: 'hantera', store: { selectedId: dsId } } : null });

      /** Backwards: the sources and the datasets this one was made from. */
      const up = new Set();
      function walkUp(dsId, depth) {
        if (up.has(dsId) || depth > MAX_DEPTH) return;
        up.add(dsId);
        const meta = known.get(dsId);
        if (!meta) return;
        const origin = originOf(meta.source);
        if (origin) link(add({ id: `source:${dsId}`, kind: origin.kind, side: 'from', label: origin.label, detail: origin.detail || '' }), dsId);
        const word = meta.source && EDGE_WORDS.has(meta.source.op || meta.source.kind) ? t(`provenance.edge.${meta.source.op || meta.source.kind}`) : '';
        for (const parent of parentsOf(meta.source, known)) {
          datasetNode(parent, 'from');
          link(parent, dsId, word);
          walkUp(parent, depth + 1);
        }
      }
      /** Forwards: the datasets made from this one. */
      const down = new Set();
      function walkDown(dsId, depth) {
        if (down.has(dsId) || depth > MAX_DEPTH) return;
        down.add(dsId);
        for (const other of all) {
          if (other.id === dsId || !parentsOf(other.source, known).includes(dsId)) continue;
          datasetNode(other.id, 'to');
          const word = other.source && EDGE_WORDS.has(other.source.op || other.source.kind) ? t(`provenance.edge.${other.source.op || other.source.kind}`) : '';
          link(dsId, other.id, word);
          walkDown(other.id, depth + 1);
        }
      }
      datasetNode(id, 'center');
      nodes.get(id).side = 'center';
      walkUp(id, 0);
      walkDown(id, 0);
      nodes.get(id).side = 'center';

      // Steps and versions of the dataset itself; a step that brought in another dataset is one more source.
      const steps = await safely(() => recipes.steps(id), []);
      if (steps.length) {
        const recipeId = add({ id: `recipe:${id}`, kind: 'recipe', side: 'from', label: t('provenance.recipe', { n: steps.length }), detail: steps.slice(-5).map((s) => s.description).filter(Boolean).join(' · '), open: { mode: 'bearbeta', store: { selectedId: id } } });
        link(recipeId, id);
        for (const step of steps) {
          const text = JSON.stringify(step.params || {});
          for (const other of all) {
            if (other.id === id || !text.includes(other.id)) continue;
            datasetNode(other.id, 'from');
            link(other.id, recipeId, step.description || '');
          }
        }
      }
      const versions = await safely(() => datasets.listVersions(id), []);
      if (versions.length) link(add({ id: `versions:${id}`, kind: 'version', side: 'from', label: t('provenance.versions', { n: versions.length }), detail: versions.map((v) => v.label).filter(Boolean).join(' · ') }), id);

      // Shares in and out come from the history.
      const log = await safely(() => datasets.log(id), []);
      log.forEach((entry, i) => {
        const d = entry.details && typeof entry.details === 'object' ? entry.details : {};
        if (entry.action === 'received') link(add({ id: `received:${i}`, kind: 'share', side: 'from', label: t('provenance.received', { name: d.name || d.author || t('comments.anonymous') }), detail: D.require('ui/i18n').formatDateTime(entry.ts) }), id);
        if (entry.action === 'shared') link(id, add({ id: `shared:${i}`, kind: 'share', side: 'to', label: t('provenance.shared', { name: d.name || '' }), detail: D.require('ui/i18n').formatDateTime(entry.ts) }));
      });

      // What builds on the dataset or on what it became.
      const family = Array.from(down);
      const uses = (object) => { const text = JSON.stringify(object); return family.filter((dsId) => text.includes(dsId)); };
      const charts = await safely(() => D.require('viz/charts').list(), []);
      const chartIds = new Map();
      for (const chart of charts) {
        const users = uses(chart);
        if (!users.length) continue;
        const node = add({ id: `chart:${chart.id}`, kind: 'chart', side: 'to', label: chart.name, open: { mode: 'visualisera', store: { selectedId: chart.datasetId || id, openChartId: chart.id } } });
        chartIds.set(chart.id, node);
        chartIds.set(chart.name, node);
        for (const dsId of users) link(dsId, node);
      }
      const dashes = await safely(() => D.require('viz/dashboards').list(), []);
      for (const dash of dashes) {
        const using = (dash.items || []).map((it) => chartIds.get(it.chartId)).filter(Boolean);
        if (!using.length) continue;
        const node = add({ id: `dash:${dash.id}`, kind: 'dashboard', side: 'to', label: dash.name, open: { mode: 'visualisera', store: { openDashboardId: dash.id } } });
        for (const chart of using) link(chart, node);
      }
      const documents = await safely(() => D.require('docgen/documents').list(), []);
      for (const doc of documents) {
        const named = Array.from(String(doc.body || '').matchAll(CHART_TAG)).map((m) => chartIds.get(m[1])).filter(Boolean);
        if (!named.length) continue;
        const node = add({ id: `doc:${doc.id}`, kind: 'document', side: 'to', label: doc.name, open: { mode: 'exportera', store: {} } });
        for (const chart of named) link(chart, node);
      }
      const notebooks = await safely(() => D.require('analysis/notebooks').list(), []);
      for (const nb of notebooks) for (const dsId of uses({ datasetId: nb.datasetId })) link(dsId, add({ id: `nb:${nb.id}`, kind: 'notebook', side: 'to', label: nb.name, open: { mode: 'analysera', store: { selectedId: dsId, openNotebookId: nb.id } } }));
      const lists = await safely(() => D.require('data/lists').list(), []);
      for (const list of lists) for (const dsId of uses({ datasetId: list.datasetId })) link(dsId, add({ id: `list:${list.id}`, kind: 'list', side: 'to', label: list.name, open: { mode: 'soka', store: { selectedId: dsId } } }));
      const flows = await safely(() => D.require('data/flows').list(), []);
      for (const flow of flows) for (const dsId of uses(flow)) link(dsId, add({ id: `flow:${flow.id}`, kind: 'flow', side: 'to', label: flow.name, open: { flow: flow.id } }));
      return { center: id, nodes: Array.from(nodes.values()), edges };
    }
    /**
     * The same as text, for a report.
     * @param {{center: string, nodes: any[]}} graph @returns {string}
     */
    function toMarkdown(graph) {
      const center = graph.nodes.find((n) => n.id === graph.center);
      const line = (n) => `- ${t(`provenance.kind.${n.kind}`)}: ${n.label}${n.detail ? ` (${n.detail})` : ''}`;
      const part = (side, title) => {
        const found = graph.nodes.filter((n) => n.side === side);
        return found.length ? [`## ${title}`, '', ...found.map(line), ''] : [];
      };
      return [`# ${t('provenance.report', { name: center ? center.label : '' })}`, '', ...part('from', t('provenance.from')), ...part('to', t('provenance.to'))].join('\n');
    }

    return { of, toMarkdown, parentsOf, originOf };
  });
})();
