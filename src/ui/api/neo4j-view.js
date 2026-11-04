// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for a Neo4j source in Inhämta: a Cypher editor, Run (after consent, with the user's credentials), the
 * result as a table with "Spara som datamängd", and "Spara som graf" when the result holds nodes and relationships
 * (a graph dataset with the nodes and relationships found). Queries can be kept on the connector as saved fetches
 * and run again with one click.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/neo4j-view', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/neo4j', 'api/connectors', 'api/runner', 'data/graph'], (base, basic, overlays, neo4j, connectors, runner, graph) => {
    const { h, t, i18n, replace } = base;
    const PREVIEW_ROWS = 500;

    /** @param {{connector: any, log?: Function, onDataset?: Function}} api */
    function create(api) {
      const { connector } = api;
      const s = { query: (connector.queries && connector.queries[0] && connector.queries[0].cypher) || 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 50', busy: false, result: null, error: '', saving: false, saved: '' };
      const el = h('div', { class: 'dm-stack' });
      let editor = null; let resultEl = null;

      async function run() {
        if (s.busy) return;
        const text = (editor ? editor.value : s.query).trim(); if (!text) return;
        s.query = text; s.busy = true; s.error = ''; s.saved = ''; render();
        try {
          const out = await neo4j.run(connector, text);
          s.result = Object.assign(out, { name: `${connector.name}: ${text.slice(0, 40)}` });
          if (api.log) api.log(t('neo4j.ran', { n: i18n.formatNumber(out.rows.length) }), 'ok');
        } catch (err) { s.result = null; s.error = String((err && err.message) || err); if (api.log) api.log(`${connector.name}: ${s.error}`, 'error'); }
        s.busy = false; render();
      }
      async function saveTable(name) {
        const r = s.result; if (!r || s.saving) return;
        s.saving = true; render();
        try {
          const meta = await runner.toDataset({ columns: r.columns, rows: r.rows, meta: {} }, { name: name || r.name, description: neo4j.describe(connector, s.query), source: { kind: 'api', connector: connector.id, cypher: s.query, fetchedAt: new Date().toISOString() } });
          s.saved = t('api.saved', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          if (api.log) api.log(s.saved, 'ok');
          if (api.onDataset) api.onDataset(meta);
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        s.saving = false; render();
      }
      async function saveGraph(name) {
        const r = s.result; if (!r || !r.graph || s.saving) return;
        s.saving = true; render();
        try {
          const meta = await graph.createGraphDataset({ name: name || r.name, graph: r.graph, description: neo4j.describe(connector, s.query), source: { kind: 'api', connector: connector.id, cypher: s.query, fetchedAt: new Date().toISOString() } });
          s.saved = t('graph.from.done', { name: meta.name, nodes: i18n.formatNumber(r.graph.nodes.length), edges: i18n.formatNumber(r.graph.edges.length) });
          if (api.log) api.log(s.saved, 'ok');
          if (api.onDataset) api.onDataset(meta);
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        s.saving = false; render();
      }
      /** Keep the query on the connector (the user's copy) so it can be run again later. */
      async function keepQuery() {
        const text = (editor ? editor.value : s.query).trim(); if (!text) return;
        const list = (connector.queries || []).filter((q) => q.cypher !== text);
        list.unshift({ name: text.slice(0, 60), cypher: text, savedAt: new Date().toISOString() });
        connector.queries = list.slice(0, 20);
        await connectors.save(connector);
        overlays.toast.show(t('neo4j.query.kept'), { kind: 'ok' });
        render();
      }
      function render() {
        editor = /** @type {any} */ (h('dm-code', { language: 'sql', placeholder: 'MATCH (n) RETURN n LIMIT 25' }));
        editor.value = s.query;
        editor.addEventListener('input', () => { s.query = editor.value; });
        const kept = connector.queries && connector.queries.length ? h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-xs', text: t('neo4j.query.saved') }), connector.queries.slice(0, 8).map((q) => basic.button({ label: q.name, size: 'sm', variant: 'ghost', title: q.cypher, onClick: () => { s.query = q.cypher; editor.value = q.cypher; run(); } }))) : null;
        resultEl = h('div');
        replace(el,
          h('div', { class: 'dm-card dm-stack-sm' },
            h('p', { class: 'dm-help dm-small', text: t('neo4j.hint', { host: neo4j.hostOf(connector.baseUrl), database: (connector.family && connector.family.database) || 'neo4j' }) }),
            editor,
            h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('common.run'), icon: 'play', variant: 'primary', loading: s.busy, title: t('neo4j.run.hint'), onClick: run }), basic.button({ label: t('neo4j.query.keep'), icon: 'save', size: 'sm', onClick: keepQuery })),
            kept),
          resultEl);
        renderResult();
      }
      function renderResult() {
        if (!resultEl) return;
        if (s.error) { replace(resultEl, h('div', { class: 'dm-card' }, h('p', { class: 'dm-error', text: s.error }))); return; }
        const r = s.result; if (!r) { replace(resultEl); return; }
        const table = /** @type {any} */ (h('dm-table', { class: 'dm-table-tall' }));
        const rows = r.rows.slice(0, PREVIEW_ROWS);
        const nameInput = /** @type {any} */ (h('dm-input', { label: t('api.name') })); nameInput.value = r.name;
        replace(resultEl, h('div', { class: 'dm-card dm-stack' },
          h('div', { class: 'dm-row-wrap' }, h('strong', { text: t('api.result', { rows: i18n.formatNumber(r.rows.length), cols: r.columns.length }) }), r.graph ? h('dm-badge', { kind: 'accent', text: `${t('graph.nodes.n', { n: i18n.formatNumber(r.graph.nodes.length) })} · ${t('graph.edges.n', { n: i18n.formatNumber(r.graph.edges.length) })}` }) : null),
          h('div', { class: 'dm-table-wrap' }, table),
          s.saved ? h('p', { class: 'dm-success', text: s.saved }) : h('div', { class: 'dm-row-wrap dm-api-save' }, nameInput, basic.button({ label: t('api.save'), icon: 'save', variant: r.graph ? undefined : 'primary', loading: s.saving, onClick: () => saveTable(nameInput.value.trim()) }), r.graph ? basic.button({ label: t('neo4j.save.graph'), icon: 'share-2', variant: 'primary', loading: s.saving, title: t('neo4j.save.graph.hint'), onClick: () => saveGraph(nameInput.value.trim()) }) : null)));
        requestAnimationFrame(() => table.setData({ columns: r.columns.map((c) => ({ key: c, label: c, type: 'text' })), rowCount: rows.length, rowProvider: async (start, count) => rows.slice(start, start + count) }));
      }
      function start() { render(); }
      return { el, start, state: s, run, saveGraph, saveTable };
    }
    return { create };
  });
})();
