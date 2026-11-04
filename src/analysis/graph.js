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
      /** PageRank by power iteration (damping d, dangling mass spread evenly); undirected graphs use both directions. */
      function pagerank(d = 0.85, iterations = 50) {
        const n = ids.length; if (!n) return [];
        const out = directed ? outAdj : outAdj.map((a, i) => a.concat(inAdj[i]));
        let rank = new Float64Array(n).fill(1 / n);
        for (let it = 0; it < iterations; it++) {
          const next = new Float64Array(n); let dangling = 0;
          for (let i = 0; i < n; i++) { const deg = out[i].length; if (!deg) { dangling += rank[i]; continue; } const share = rank[i] / deg; for (const w of out[i]) next[w] += share; }
          const base = (1 - d) / n + (d * dangling) / n;
          let diff = 0;
          for (let i = 0; i < n; i++) { const v = base + d * next[i]; diff += Math.abs(v - rank[i]); next[i] = v; }
          rank = next;
          if (diff < 1e-9) break;
        }
        return ids.map((id, i) => [id, rank[i]]);
      }
      /** Communities by label propagation (deterministic: nodes in degree order, ties by the smaller label). */
      function communities(maxIterations = 30) {
        const n = ids.length;
        const label = new Int32Array(n); for (let i = 0; i < n; i++) label[i] = i;
        const order = ids.map((_, i) => i).sort((a, b) => (outAdj[b].length + inAdj[b].length) - (outAdj[a].length + inAdj[a].length) || a - b);
        for (let it = 0; it < maxIterations; it++) {
          let changed = 0;
          for (const v of order) {
            const nb = neighbours(v); if (!nb.length) continue;
            const counts = new Map(); for (const w of nb) counts.set(label[w], (counts.get(label[w]) || 0) + 1);
            let best = label[v]; let bestN = counts.get(best) || 0;
            for (const [l, c] of counts) if (c > bestN || (c === bestN && l < best)) { best = l; bestN = c; }
            if (best !== label[v]) { label[v] = best; changed++; }
          }
          if (!changed) break;
        }
        // Renumber by size, largest community first.
        const sizes = new Map(); for (let i = 0; i < n; i++) sizes.set(label[i], (sizes.get(label[i]) || 0) + 1);
        const ordered = Array.from(sizes.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
        const rank = new Map(ordered.map(([l], i) => [l, i + 1]));
        return { count: ordered.length, sizes: ordered.map(([, s]) => s), members: ids.map((id, i) => [id, rank.get(label[i])]) };
      }
      /** Closeness (harmonic, from every node when n ≤ sampleLimit, else from a sample) and approximate betweenness (Brandes on a sample of sources). */
      function centrality(sampleLimit = 300) {
        const n = ids.length; const und = !directed;
        const nbOf = (v) => (und ? neighbours(v) : outAdj[v]);
        const sources = n <= sampleLimit ? ids.map((_, i) => i) : Array.from({ length: sampleLimit }, (_, k) => Math.floor((k * 2654435761) % n));
        const between = new Float64Array(n); const harmonic = new Float64Array(n);
        const dist = new Int32Array(n); const sigma = new Float64Array(n); const delta = new Float64Array(n);
        for (const s of sources) {
          dist.fill(-1); sigma.fill(0); delta.fill(0);
          const stack = []; const preds = Array.from({ length: n }, () => []);
          dist[s] = 0; sigma[s] = 1; const queue = [s]; let qi = 0;
          while (qi < queue.length) { const v = queue[qi++]; stack.push(v); for (const w of nbOf(v)) { if (dist[w] < 0) { dist[w] = dist[v] + 1; queue.push(w); } if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; preds[w].push(v); } } }
          for (let i = 0; i < n; i++) if (dist[i] > 0) harmonic[s] += 1 / dist[i];
          while (stack.length) { const w = stack.pop(); for (const v of preds[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]); if (w !== s) between[w] += delta[w]; }
        }
        const scale = sources.length ? n / sources.length : 1;
        // Closeness is exact for the sampled sources (every node when n ≤ sampleLimit); betweenness is scaled by the sample.
        return ids.map((id, i) => [id, harmonic[i] / Math.max(1, n - 1), between[i] * scale * (und ? 0.5 : 1)]);
      }
      /** A force layout (Fruchterman–Reingold with grid-bucketed repulsion) for whole graphs; returns [id, x, y]. */
      function layout(iterations = 60, seedPositions) {
        const n = ids.length; if (!n) return [];
        const area = 1000 * Math.sqrt(n); const k = Math.sqrt((area * area) / n) * 0.6;
        const x = new Float64Array(n); const y = new Float64Array(n);
        let rnd = 12345; const rand = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
        const seeds = new Map(seedPositions || []);
        for (let i = 0; i < n; i++) { const p = seeds.get(ids[i]); if (p) { x[i] = p[0]; y[i] = p[1]; } else { x[i] = (rand() - 0.5) * area; y[i] = (rand() - 0.5) * area; } }
        const dx = new Float64Array(n); const dy = new Float64Array(n);
        let temp = area / 10;
        const cell = Math.max(k * 2, 1);
        for (let it = 0; it < iterations; it++) {
          dx.fill(0); dy.fill(0);
          // Repulsion within neighbouring grid cells only (far nodes contribute little).
          const grid = new Map();
          for (let i = 0; i < n; i++) { const key = Math.floor(x[i] / cell) + ':' + Math.floor(y[i] / cell); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i); }
          for (let i = 0; i < n; i++) {
            const cx = Math.floor(x[i] / cell); const cy = Math.floor(y[i] / cell);
            for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
              const bucket = grid.get(gx + ':' + gy); if (!bucket) continue;
              for (const j of bucket) { if (j === i) continue; let ddx = x[i] - x[j]; let ddy = y[i] - y[j]; let d2 = ddx * ddx + ddy * ddy; if (d2 < 0.01) { ddx = rand() - 0.5; ddy = rand() - 0.5; d2 = 0.01; } const f = (k * k) / d2; dx[i] += ddx * f; dy[i] += ddy * f; }
            }
          }
          for (let i = 0; i < n; i++) for (const j of outAdj[i]) { const ddx = x[i] - x[j]; const ddy = y[i] - y[j]; const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01; const f = (d * d) / k; dx[i] -= (ddx / d) * f; dy[i] -= (ddy / d) * f; dx[j] += (ddx / d) * f; dy[j] += (ddy / d) * f; }
          for (let i = 0; i < n; i++) { const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1; const step = Math.min(d, temp); x[i] += (dx[i] / d) * step; y[i] += (dy[i] / d) * step; }
          temp *= 0.95;
        }
        return ids.map((id, i) => [id, Math.round(x[i] * 100) / 100, Math.round(y[i] * 100) / 100]);
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
          else if (msg.type === 'pagerank') result = pagerank(msg.damping, msg.iterations);
          else if (msg.type === 'communities') result = communities(msg.iterations);
          else if (msg.type === 'centrality') result = centrality(msg.sampleLimit);
          else if (msg.type === 'layout') result = layout(msg.iterations, msg.seeds);
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
    /** PageRank per node: [id, rank]. */
    async function pagerank(datasetId, options = {}) { await load(datasetId); return call({ type: 'pagerank', damping: options.damping || 0.85, iterations: options.iterations || 50 }); }
    /** Communities by label propagation: {count, sizes, members: [id, community]}. */
    async function communities(datasetId, options = {}) { await load(datasetId); return call({ type: 'communities', iterations: options.iterations || 30 }); }
    /** Closeness and (approximate) betweenness per node: [id, closeness, betweenness]. */
    async function centrality(datasetId, options = {}) { await load(datasetId); return call({ type: 'centrality', sampleLimit: options.sampleLimit || 300 }); }
    /** Force layout of the whole graph: positions [id, x, y], kept in the dataset's _layout when `save`. */
    async function layout(datasetId, options = {}) {
      await load(datasetId);
      const seeds = options.seed ? Array.from((await graph.layoutGet(datasetId)).entries()) : [];
      const positions = await call({ type: 'layout', iterations: options.iterations || 60, seeds });
      if (options.save !== false) await graph.layoutSet(datasetId, positions);
      return positions;
    }
    function terminate() { if (worker) { worker.terminate(); worker = null; ready = null; pending.clear(); loaded = { id: null, updatedAt: null }; } }

    return { load, degrees, components, shortestPath, summary, pagerank, communities, centrality, layout, terminate, dataspatiumGraphWorker };
  });
})();
