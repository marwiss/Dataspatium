// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Graph measures in a worker: the whole graph is loaded once as compact adjacency lists (CSR) and queried for
 * degrees, weakly connected components, shortest paths (breadth first), a summary (density, isolated nodes,
 * degree distribution, component sizes) and top nodes. Results come back as plain tables or arrays. The worker is
 * a standalone function sent as text (platform/workers), so it has no closures over the page.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/graph', ['data/graph', 'data/datasets'], (graph, datasets) => {
    /** The worker body: a message loop over one loaded graph. */
    function dataspatiumGraphWorker() {
      let ids = []; let index = new Map(); let outAdj = []; let inAdj = []; let edgeCount = 0; let directed = true;
      function load(msg) {
        ids = msg.nodes.slice(); index = new Map(); directed = msg.directed !== false;
        ids.forEach((id, i) => index.set(id, i));
        outAdj = ids.map(() => []); inAdj = ids.map(() => []); edgeCount = 0;
        for (const e of msg.edges) {
          const a = index.get(e[0]); const b = index.get(e[1]);
          if (a === undefined || b === undefined) continue;
          outAdj[a].push(b); inAdj[b].push(a); edgeCount++;
        }
        return { nodes: ids.length, edges: edgeCount };
      }
      const neighbours = (i) => (directed ? outAdj[i].concat(inAdj[i]) : outAdj[i].concat(inAdj[i]));
      function degrees() {
        return ids.map((id, i) => [id, outAdj[i].length, inAdj[i].length, outAdj[i].length + inAdj[i].length]);
      }
      function components() {
        const comp = new Int32Array(ids.length).fill(-1); let n = 0; const sizes = [];
        for (let s = 0; s < ids.length; s++) {
          if (comp[s] >= 0) continue;
          const stack = [s]; comp[s] = n; let size = 0;
          while (stack.length) { const v = stack.pop(); size++; for (const w of neighbours(v)) if (comp[w] < 0) { comp[w] = n; stack.push(w); } }
          sizes.push(size); n++;
        }
        // Components numbered by size (largest first) for stable, readable output.
        const order = sizes.map((size, i) => [i, size]).sort((a, b) => b[1] - a[1]).map(([i]) => i);
        const rank = new Int32Array(n); order.forEach((orig, r) => { rank[orig] = r + 1; });
        return { count: n, sizes: order.map((i) => sizes[i]), members: ids.map((id, i) => [id, rank[comp[i]]]) };
      }
      function shortest(from, to, undirected) {
        const s = index.get(from); const t = index.get(to);
        if (s === undefined || t === undefined) return { found: false, reason: 'missing' };
        const prev = new Int32Array(ids.length).fill(-1); const seen = new Uint8Array(ids.length); seen[s] = 1;
        let frontier = [s]; let found = s === t;
        while (frontier.length && !found) {
          const next = [];
          for (const v of frontier) { for (const w of (undirected || !directed ? neighbours(v) : outAdj[v])) { if (seen[w]) continue; seen[w] = 1; prev[w] = v; if (w === t) { found = true; break; } next.push(w); } if (found) break; }
          frontier = next;
        }
        if (!found) return { found: false, reason: 'none' };
        const path = []; for (let v = t; v !== -1; v = prev[v]) { path.push(ids[v]); if (v === s) break; }
        return { found: true, length: path.length - 1, path: path.reverse() };
      }
      function summary() {
        const n = ids.length; const m = edgeCount;
        const deg = ids.map((_, i) => outAdj[i].length + inAdj[i].length);
        const isolated = deg.filter((d) => d === 0).length;
        const maxDegree = deg.length ? Math.max(...deg) : 0;
        const density = n > 1 ? (directed ? m / (n * (n - 1)) : (2 * m) / (n * (n - 1))) : 0;
        const comps = components();
        const buckets = [[1, 1], [2, 2], [3, 5], [6, 10], [11, 50], [51, 100], [101, Infinity]].map(([lo, hi]) => ({ from: lo, to: hi, count: deg.filter((d) => d >= lo && d <= hi).length }));
        buckets.unshift({ from: 0, to: 0, count: isolated });
        const top = ids.map((id, i) => [id, deg[i]]).sort((a, b) => b[1] - a[1]).slice(0, 20);
        let selfLoops = 0; for (let i = 0; i < n; i++) for (const w of outAdj[i]) if (w === i) selfLoops++;
        return { nodes: n, edges: m, directed, density, isolated, maxDegree, avgDegree: n ? (2 * m) / n : 0, components: comps.count, largestComponent: comps.sizes[0] || 0, componentSizes: comps.sizes.slice(0, 10), degreeBuckets: buckets, top, selfLoops };
      }
      self.onmessage = (ev) => {
        const msg = ev.data || {};
        try {
          let result;
          if (msg.type === 'load') result = load(msg);
          else if (msg.type === 'degrees') result = degrees();
          else if (msg.type === 'components') result = components();
          else if (msg.type === 'shortest') result = shortest(msg.from, msg.to, msg.undirected);
          else if (msg.type === 'summary') result = summary();
          else throw new Error('unknown message ' + msg.type);
          self.postMessage({ id: msg.id, ok: true, result });
        } catch (err) { self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) }); }
      };
      self.postMessage({ ready: true });
    }

    let worker = null; let ready = null; let seq = 0; const pending = new Map();
    let loaded = { id: null, updatedAt: null };
    function ensureWorker() {
      if (worker) return ready;
      worker = D.workers.create({ namespace: 'graph', source: D.workers.functionSource(dataspatiumGraphWorker), name: 'graph' });
      ready = new Promise((resolve) => {
        worker.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.ready) { resolve(true); return; }
          const p = pending.get(msg.id); if (!p) return; pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.result); else p.reject(new Error(msg.error));
        };
        worker.onerror = (ev) => { for (const p of pending.values()) p.reject(new Error(String(ev.message || 'graph worker'))); pending.clear(); };
      });
      return ready;
    }
    function call(msg) {
      return ensureWorker().then(() => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); worker.postMessage(Object.assign({ id }, msg)); }));
    }
    /** Load a graph dataset into the worker (once per dataset version). */
    async function load(datasetId) {
      const meta = await datasets.get(datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      if (loaded.id === datasetId && loaded.updatedAt === meta.updatedAt && worker) return meta;
      const g = await graph.whole(datasetId);
      await call({ type: 'load', nodes: g.nodes.map((n) => n.id), edges: g.edges.map((e) => [e.source, e.target]), directed: g.directed });
      loaded = { id: datasetId, updatedAt: meta.updatedAt };
      return meta;
    }
    /** Degrees per node: [id, out, in, total]. */
    async function degrees(datasetId) { await load(datasetId); return call({ type: 'degrees' }); }
    /** Weakly connected components: {count, sizes, members: [id, component]}. */
    async function components(datasetId) { await load(datasetId); return call({ type: 'components' }); }
    /** Shortest path between two node ids (breadth first; directed unless `undirected`). */
    async function shortestPath(datasetId, from, to, undirected) { await load(datasetId); return call({ type: 'shortest', from: String(from), to: String(to), undirected: !!undirected }); }
    /** Summary measures of the graph. */
    async function summary(datasetId) { await load(datasetId); return call({ type: 'summary' }); }
    function terminate() { if (worker) { worker.terminate(); worker = null; ready = null; pending.clear(); loaded = { id: null, updatedAt: null }; } }

    return { load, degrees, components, shortestPath, summary, terminate, dataspatiumGraphWorker };
  });
})();
