// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * IFC geometry with web-ifc (MPL-2.0, unchanged files): the classic IIFE build of its API and the single-threaded
 * WebAssembly build run in one of Dataspatium's shimmed Blob workers. An IFC file comes back as triangle meshes in
 * metres, Y up and moved near the origin: one batch per surface colour with a vertex attribute that says which
 * element a vertex belongs to, a table of each element's index ranges (for highlighting and hiding without one draw
 * call per element), and per element the surface area, volume and bounding box measured on the triangles. The tables
 * of an IFC file come from the app's own STEP reader (data/ifc-step); web-ifc is only asked for geometry.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  /** Runs inside the worker. */
  function dataspatiumIfcWorker() {
    'use strict';
    var api = null;
    var starting = null;
    function start() {
      if (starting) return starting;
      // The IIFE build starts with "use strict", so its `var WebIFC` stays inside an eval: take it as the eval's value.
      starting = fetch('dataspatium-asset://web-ifc/web-ifc-api-iife.js').then(function (r) { return r.text(); }).then(function (text) {
        var lib = (0, eval)(text + '\n;WebIFC;');
        api = new lib.IfcAPI();
        api.SetWasmPath('dataspatium-asset://web-ifc/', true);
        return api.Init(undefined, true);
      });
      return starting;
    }
    function grown(arr, need) {
      if (arr.length >= need) return arr;
      var next = new arr.constructor(Math.max(need, Math.ceil(arr.length * 1.6)));
      next.set(arr);
      return next;
    }
    function newBatch(color) {
      return { color: color, vertices: 0, indices: 0, positions: new Float32Array(30000), normals: new Float32Array(30000), ids: new Uint8Array(30000), index: new Uint32Array(30000) };
    }
    /** @param {Uint8Array} bytes @param {(done: number) => void} report */
    function meshes(bytes, report) {
      var model = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: true });
      if (model < 0) throw new Error('web-ifc could not open the file');
      var batches = []; var byColor = new Map();
      var ranges = []; var stats = new Map(); var seen = 0;
      api.StreamAllMeshes(model, function (mesh) {
        var id = mesh.expressID;
        var count = mesh.geometries.size();
        var st = stats.get(id);
        if (!st) { st = { area: 0, volume: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; stats.set(id, st); }
        for (var g = 0; g < count; g++) {
          var placed = mesh.geometries.get(g);
          var col = placed.color;
          var key = Math.round(col.x * 255) + ',' + Math.round(col.y * 255) + ',' + Math.round(col.z * 255) + ',' + Math.round(col.w * 100);
          var bi = byColor.get(key);
          if (bi === undefined) { bi = batches.length; byColor.set(key, bi); batches.push(newBatch([col.x, col.y, col.z, col.w])); }
          var b = batches[bi];
          var geom = api.GetGeometry(model, placed.geometryExpressID);
          var v = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
          var ix = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
          var m = placed.flatTransformation;
          var n = v.length / 6;
          var base = b.vertices;
          b.positions = grown(b.positions, (base + n) * 3);
          b.normals = grown(b.normals, (base + n) * 3);
          b.ids = grown(b.ids, (base + n) * 3);
          var pos = b.positions; var nor = b.normals; var ids = b.ids;
          var r = (id >>> 16) & 255; var gr = (id >>> 8) & 255; var bl = id & 255;
          for (var i = 0; i < n; i++) {
            var x = v[i * 6]; var y = v[i * 6 + 1]; var z = v[i * 6 + 2];
            var nx = v[i * 6 + 3]; var ny = v[i * 6 + 4]; var nz = v[i * 6 + 5];
            var wx = m[0] * x + m[4] * y + m[8] * z + m[12];
            var wy = m[1] * x + m[5] * y + m[9] * z + m[13];
            var wz = m[2] * x + m[6] * y + m[10] * z + m[14];
            var o = (base + i) * 3;
            pos[o] = wx; pos[o + 1] = wy; pos[o + 2] = wz;
            nor[o] = m[0] * nx + m[4] * ny + m[8] * nz;
            nor[o + 1] = m[1] * nx + m[5] * ny + m[9] * nz;
            nor[o + 2] = m[2] * nx + m[6] * ny + m[10] * nz;
            ids[o] = r; ids[o + 1] = gr; ids[o + 2] = bl;
            if (wx < st.min[0]) st.min[0] = wx; if (wy < st.min[1]) st.min[1] = wy; if (wz < st.min[2]) st.min[2] = wz;
            if (wx > st.max[0]) st.max[0] = wx; if (wy > st.max[1]) st.max[1] = wy; if (wz > st.max[2]) st.max[2] = wz;
          }
          var start = b.indices;
          b.index = grown(b.index, start + ix.length);
          var signed = 0;
          for (var t = 0; t < ix.length; t += 3) {
            var a = ix[t] + base; var c = ix[t + 1] + base; var d = ix[t + 2] + base;
            b.index[start + t] = a; b.index[start + t + 1] = c; b.index[start + t + 2] = d;
            var ax = pos[a * 3]; var ay = pos[a * 3 + 1]; var az = pos[a * 3 + 2];
            var bx = pos[c * 3]; var by = pos[c * 3 + 1]; var bz = pos[c * 3 + 2];
            var cx = pos[d * 3]; var cy = pos[d * 3 + 1]; var cz = pos[d * 3 + 2];
            var ux = bx - ax; var uy = by - ay; var uz = bz - az; var sx = cx - ax; var sy = cy - ay; var sz = cz - az;
            var kx = uy * sz - uz * sy; var ky = uz * sx - ux * sz; var kz = ux * sy - uy * sx;
            st.area += Math.sqrt(kx * kx + ky * ky + kz * kz) / 2;
            signed += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
          }
          st.volume += Math.abs(signed);
          b.vertices = base + n; b.indices = start + ix.length;
          ranges.push(id, bi, start, ix.length);
          geom.delete();
        }
        seen++;
        if (seen % 200 === 0) report(seen);
      });
      // What web-ifc did to move the model near the origin, so that points in the view can be given back in the model's own
      // coordinates (a BCF camera, for example).
      var coordination = Array.from(api.GetCoordinationMatrix(model));
      api.CloseModel(model);
      var transfer = []; var out = [];
      for (var k = 0; k < batches.length; k++) {
        var bb = batches[k];
        var one = { color: bb.color, positions: bb.positions.slice(0, bb.vertices * 3), normals: bb.normals.slice(0, bb.vertices * 3), ids: bb.ids.slice(0, bb.vertices * 3), index: bb.index.slice(0, bb.indices) };
        batches[k] = null;
        transfer.push(one.positions.buffer, one.normals.buffer, one.ids.buffer, one.index.buffer);
        out.push(one);
      }
      var statRows = [];
      stats.forEach(function (st, id) { statRows.push([id, st.area, st.volume, st.min, st.max]); });
      var rangeArray = new Uint32Array(ranges);
      transfer.push(rangeArray.buffer);
      return { result: { batches: out, ranges: rangeArray, stats: statRows, elements: seen, coordination: coordination }, transfer: transfer };
    }
    /**
     * The triangles of chosen elements for clash detection: in IFC's own axes (Z up) and metres, not moved to the origin, so
     * that two models from one project line up and the points mean the same to other BCF clients. web-ifc gives Y up, so
     * (x, y, z) becomes (x, -z, y). One part per placed geometry.
     */
    function elementsOf(bytes, wanted, report) {
      var model = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
      if (model < 0) throw new Error('web-ifc could not open the file');
      var byId = new Map(); var seen = 0;
      api.StreamAllMeshes(model, function (mesh) {
        var id = mesh.expressID;
        if (wanted && !wanted.has(id)) return;
        var parts = byId.get(id) || [];
        var count = mesh.geometries.size();
        for (var g = 0; g < count; g++) {
          var placed = mesh.geometries.get(g);
          var geom = api.GetGeometry(model, placed.geometryExpressID);
          var v = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
          var ix = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
          var m = placed.flatTransformation;
          var n = v.length / 6;
          var pos = new Float64Array(n * 3);
          for (var i = 0; i < n; i++) {
            var x = v[i * 6]; var y = v[i * 6 + 1]; var z = v[i * 6 + 2];
            pos[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
            pos[i * 3 + 1] = -(m[2] * x + m[6] * y + m[10] * z + m[14]);
            pos[i * 3 + 2] = m[1] * x + m[5] * y + m[9] * z + m[13];
          }
          if (n && ix.length) parts.push({ pos: pos, idx: new Uint32Array(ix) });
          geom.delete();
        }
        if (parts.length) byId.set(id, parts);
        seen++;
        if (seen % 200 === 0) report({ phase: 'geometry', done: seen });
      });
      api.CloseModel(model);
      return byId;
    }
    /** Set A against set B over one or two files, with the core from analysis/clash-core (its source comes first). */
    function clashes(msg, report) {
      var core = dataspatiumClashCore();
      var setA = []; var setB = []; var origin = null; var drawn = [];
      for (var f = 0; f < msg.files.length; f++) {
        var file = msg.files[f];
        var inA = file.a === null ? null : new Set(file.a || []);
        var inB = file.b === null ? null : new Set(file.b || []);
        var wanted = inA === null || inB === null ? null : new Set(Array.from(inA).concat(Array.from(inB)));
        var byId = elementsOf(new Uint8Array(file.bytes), wanted, report);
        byId.forEach(function (parts, id) {
          if (!origin) origin = [parts[0].pos[0], parts[0].pos[1], parts[0].pos[2]];
          var built = [];
          for (var p = 0; p < parts.length; p++) {
            var pos = parts[p].pos;
            for (var k = 0; k < pos.length; k += 3) { pos[k] -= origin[0]; pos[k + 1] -= origin[1]; pos[k + 2] -= origin[2]; }
            built.push(core.part(pos, parts[p].idx));
          }
          var el = core.element(id, built);
          el.key = f + ':' + id; el.model = f;
          drawn.push(el.key);
          if (inA === null || inA.has(id)) setA.push(el);
          if (inB === null || inB.has(id)) setB.push(el);
        });
      }
      report({ phase: 'clash', done: 0, total: 0 });
      var res = core.clash(setA, setB, msg.options || {}, function (done, total) { report({ phase: 'clash', done: done, total: total }); });
      for (var c = 0; c < res.clashes.length; c++) {
        var pt = res.clashes[c].point;
        res.clashes[c].point = [pt[0] + origin[0], pt[1] + origin[1], pt[2] + origin[2]];
      }
      return { pairs: res.pairs, clashes: res.clashes, a: setA.length, b: setB.length, drawn: drawn };
    }
    self.onmessage = function (ev) {
      var msg = ev.data || {};
      var report = function (p) { self.postMessage({ id: msg.id, progress: p }); };
      if (msg.type === 'clash') {
        start().then(function () {
          self.postMessage({ id: msg.id, ok: true, result: clashes(msg, report) });
        }).catch(function (err) { self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) }); });
        return;
      }
      if (msg.type !== 'meshes') return;
      start().then(function () {
        var done = meshes(new Uint8Array(msg.bytes), function (n) { self.postMessage({ id: msg.id, progress: n }); });
        self.postMessage({ id: msg.id, ok: true, result: done.result }, done.transfer);
      }).catch(function (err) { self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) }); });
    };
    self.postMessage({ ready: true });
  }

  D.define('engines/ifc', ['analysis/clash-core'], (clashCore) => {
    let worker = null; let ready = null; let seq = 0;
    /** @type {Map<number, {resolve: Function, reject: Function, onProgress?: Function}>} */
    const pending = new Map();
    function ensureWorker() {
      if (worker) return ready;
      D.workers.provider('web-ifc', { initial: async () => ['web-ifc/web-ifc-api-iife.js', 'web-ifc/web-ifc.wasm'] });
      // The clash core is a named function without outer references; its source comes first, so the worker can call it.
      worker = D.workers.create({ namespace: 'web-ifc', source: clashCore.source + '\n' + D.workers.functionSource(dataspatiumIfcWorker), name: 'ifc' });
      ready = new Promise((resolve) => {
        worker.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.ready) { resolve(true); return; }
          const p = pending.get(msg.id);
          if (!p) return;
          if (msg.progress !== undefined) { if (p.onProgress) p.onProgress(msg.progress); return; }
          pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.result); else p.reject(new Error(msg.error));
        };
        worker.onerror = (ev) => { for (const p of pending.values()) p.reject(new Error(String((ev && ev.message) || 'IFC worker'))); pending.clear(); terminate(); };
      });
      return ready;
    }
    /** Stop the worker and free its memory; the next call starts a new one. */
    function terminate() { if (worker) { worker.terminate(); worker = null; ready = null; } }
    /** Frees web-ifc's memory, which never shrinks by itself, unless another model is on its way. */
    function release() { if (!pending.size) terminate(); }

    /**
     * The geometry of an IFC file.
     * @param {Uint8Array} bytes the file (a copy is sent to the worker)
     * @param {{onProgress?: (elements: number) => void}} [options]
     * @returns {Promise<{batches: Array<{color: number[], positions: Float32Array, normals: Float32Array, ids: Uint8Array, index: Uint32Array}>, ranges: Uint32Array, stats: any[], elements: number}>}
     *   `ids` holds each vertex's element id as three bytes; `ranges` is flat: id, batch, first index, index count.
     */
    async function meshes(bytes, options = {}) {
      await ensureWorker();
      const copy = bytes.slice().buffer;
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, onProgress: options.onProgress });
        worker.postMessage({ type: 'meshes', id, bytes: copy }, [copy]);
      });
    }
    /**
     * Clash detection in the worker: set A against set B, in one file or across two (analysis/clash-core).
     * @param {Array<{bytes: Uint8Array, a: number[]|null|undefined, b: number[]|null|undefined}>} files a and b list the element ids of
     *   each set in that file; null means every element with geometry, a missing list means none
     * @param {{mode?: string, tolerance?: number, clearance?: number}} options metres
     * @param {{onProgress?: (p: {phase: string, done: number, total?: number}) => void}} [hooks]
     * @returns {Promise<{pairs: number, clashes: any[], a: number, b: number}>} points in the model's coordinates, Z up, metres
     */
    async function clash(files, options, hooks = {}) {
      await ensureWorker();
      const sent = files.map((f) => ({ bytes: f.bytes.slice().buffer, a: f.a === undefined ? [] : f.a, b: f.b === undefined ? [] : f.b }));
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, onProgress: hooks.onProgress });
        worker.postMessage({ type: 'clash', id, files: sent, options: options || {} }, sent.map((f) => f.bytes));
      });
    }
    return { meshes, clash, terminate, release };
  });
})();
