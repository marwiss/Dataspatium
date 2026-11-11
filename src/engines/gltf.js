// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Geometry from Dataregium's geometry API (decision OB-20.1, step 4): a binary glTF (GLB) is read in a worker into the same
 * meshes that engines/ifc makes of web-ifc's, so that viz/model-draw draws a model from the server without its IFC file. A node
 * with a mesh is one element: named by its GlobalId, with `extras.step` as the element's id and `extras.class` and
 * `extras.storey` beside it; children with meshes belong to the same element. The server's root turns IFC's Z up into glTF's
 * Y up, which is the view's own frame, so no coordination matrix is needed. No library: the JSON and BIN chunks are read directly,
 * triangles only, and a primitive without normals gets flat ones.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  /** The worker: a standalone named function, serialised as source; nothing outside it is referenced. */
  function dataspatiumGltfWorker() {
    var TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
    function readOne(dv, at, type) {
      switch (type) {
        case 5126: return dv.getFloat32(at, true);
        case 5125: return dv.getUint32(at, true);
        case 5123: return dv.getUint16(at, true);
        case 5122: return dv.getInt16(at, true);
        case 5121: return dv.getUint8(at);
        default: return dv.getInt8(at);
      }
    }
    function accessor(gltf, bin, index) {
      var acc = gltf.accessors[index];
      var n = TYPES[acc.type] || 1;
      var out = new Float64Array(acc.count * n);
      if (acc.bufferView === undefined) return { data: out, n: n, count: acc.count };
      var view = gltf.bufferViews[acc.bufferView];
      var size = acc.componentType === 5126 || acc.componentType === 5125 ? 4 : acc.componentType === 5123 || acc.componentType === 5122 ? 2 : 1;
      var offset = (view.byteOffset || 0) + (acc.byteOffset || 0);
      var stride = view.byteStride || n * size;
      var dv = new DataView(bin);
      for (var k = 0; k < acc.count; k++) for (var c = 0; c < n; c++) out[k * n + c] = readOne(dv, offset + k * stride + c * size, acc.componentType);
      return { data: out, n: n, count: acc.count };
    }
    /** Column-major 4x4 product a * b. */
    function mul(a, b) {
      var o = new Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
      return o;
    }
    var IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    function local(node) {
      if (node.matrix && node.matrix.length === 16) return node.matrix.slice();
      var t = node.translation || [0, 0, 0]; var q = node.rotation || [0, 0, 0, 1]; var s = node.scale || [1, 1, 1];
      var x = q[0], y = q[1], z = q[2], w = q[3];
      var xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
      return [
        (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
        2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
        2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
        t[0], t[1], t[2], 1];
    }
    function parse(buffer) {
      var dv = new DataView(buffer);
      if (buffer.byteLength < 20 || dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a binary glTF');
      var length = Math.min(dv.getUint32(8, true), buffer.byteLength);
      var at = 12; var json = null; var bin = null;
      while (at + 8 <= length) {
        var len = dv.getUint32(at, true); var type = dv.getUint32(at + 4, true);
        if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, at + 8, len)));
        else if (type === 0x004E4942) bin = buffer.slice(at + 8, at + 8 + len);
        at += 8 + len;
      }
      if (!json) throw new Error('glTF without a JSON chunk');
      return { json: json, bin: bin || new ArrayBuffer(0) };
    }
    function meshes(buffer, report) {
      var g = parse(buffer); var gltf = g.json; var bin = g.bin;
      var byColor = {}; var batches = []; var ranges = []; var stats = {}; var nodes = []; var seq = 0;
      function batchFor(prim) {
        var m = prim.material !== undefined && gltf.materials ? gltf.materials[prim.material] : null;
        var c = (m && m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorFactor) || [0.8, 0.8, 0.8, 1];
        var color = [c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]];
        var key = color.map(function (v) { return Math.round(v * 1000) / 1000; }).join(',');
        var b = byColor[key];
        if (!b) { b = { at: batches.length, color: color, positions: [], normals: [], ids: [], index: [], vertices: 0 }; byColor[key] = b; batches.push(b); }
        return b;
      }
      function addMesh(mesh, m, id) {
        var st = stats[id];
        var prims = mesh.primitives || [];
        for (var p = 0; p < prims.length; p++) {
          var prim = prims[p];
          if ((prim.mode !== undefined && prim.mode !== 4) || !prim.attributes || prim.attributes.POSITION === undefined) continue;
          var pos = accessor(gltf, bin, prim.attributes.POSITION);
          var nor = prim.attributes.NORMAL !== undefined ? accessor(gltf, bin, prim.attributes.NORMAL) : null;
          var idx = prim.indices !== undefined ? accessor(gltf, bin, prim.indices).data : null;
          var b = batchFor(prim);
          var base = b.vertices;
          var r = (id >>> 16) & 255; var gr = (id >>> 8) & 255; var bl = id & 255;
          for (var v = 0; v < pos.count; v++) {
            var x = pos.data[v * 3], y = pos.data[v * 3 + 1], z = pos.data[v * 3 + 2];
            var wx = m[0] * x + m[4] * y + m[8] * z + m[12]; var wy = m[1] * x + m[5] * y + m[9] * z + m[13]; var wz = m[2] * x + m[6] * y + m[10] * z + m[14];
            b.positions.push(wx, wy, wz);
            if (nor) {
              var nx = nor.data[v * 3], ny = nor.data[v * 3 + 1], nz = nor.data[v * 3 + 2];
              var tx = m[0] * nx + m[4] * ny + m[8] * nz; var ty = m[1] * nx + m[5] * ny + m[9] * nz; var tz = m[2] * nx + m[6] * ny + m[10] * nz;
              var l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
              b.normals.push(tx / l, ty / l, tz / l);
            } else b.normals.push(0, 0, 0);
            b.ids.push(r, gr, bl);
            if (wx < st.min[0]) st.min[0] = wx; if (wy < st.min[1]) st.min[1] = wy; if (wz < st.min[2]) st.min[2] = wz;
            if (wx > st.max[0]) st.max[0] = wx; if (wy > st.max[1]) st.max[1] = wy; if (wz > st.max[2]) st.max[2] = wz;
          }
          var first = b.index.length; var count = idx ? idx.length : pos.count; count -= count % 3;
          var signed = 0;
          for (var t = 0; t < count; t += 3) {
            var a = base + (idx ? idx[t] : t); var c2 = base + (idx ? idx[t + 1] : t + 1); var d = base + (idx ? idx[t + 2] : t + 2);
            b.index.push(a, c2, d);
            var P = b.positions;
            var ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2]; var bx = P[c2 * 3], by = P[c2 * 3 + 1], bz = P[c2 * 3 + 2]; var cx = P[d * 3], cy = P[d * 3 + 1], cz = P[d * 3 + 2];
            var ux = bx - ax, uy = by - ay, uz = bz - az; var sx = cx - ax, sy = cy - ay, sz = cz - az;
            var kx = uy * sz - uz * sy, ky = uz * sx - ux * sz, kz = ux * sy - uy * sx;
            var area2 = Math.sqrt(kx * kx + ky * ky + kz * kz);
            st.area += area2 / 2;
            signed += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
            if (!nor && area2 > 0) {
              // Flat normals: the face normal added to its three corners, normalised afterwards.
              var N = b.normals;
              N[a * 3] += kx / area2; N[a * 3 + 1] += ky / area2; N[a * 3 + 2] += kz / area2;
              N[c2 * 3] += kx / area2; N[c2 * 3 + 1] += ky / area2; N[c2 * 3 + 2] += kz / area2;
              N[d * 3] += kx / area2; N[d * 3 + 1] += ky / area2; N[d * 3 + 2] += kz / area2;
            }
          }
          if (!nor) for (var q = base; q < base + pos.count; q++) { var Q = b.normals; var ln = Math.sqrt(Q[q * 3] * Q[q * 3] + Q[q * 3 + 1] * Q[q * 3 + 1] + Q[q * 3 + 2] * Q[q * 3 + 2]) || 1; Q[q * 3] /= ln; Q[q * 3 + 1] /= ln; Q[q * 3 + 2] /= ln; }
          st.volume += Math.abs(signed);
          b.vertices = base + pos.count;
          ranges.push(id, b.at, first, count);
        }
      }
      function walk(index, parent, elementId) {
        var node = gltf.nodes[index];
        if (!node) return;
        var world = mul(parent, local(node));
        var extras = node.extras || {};
        var own = elementId;
        if (own === null && node.mesh !== undefined) {
          var given = Number(extras.step);
          own = Number.isFinite(given) && given > 0 ? Math.floor(given) : 10000000 + (++seq);
          nodes.push({ id: own, guid: String(node.name || ''), cls: String(extras.class || ''), storey: String(extras.storey || '') });
          stats[own] = { area: 0, volume: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
          if (report && nodes.length % 200 === 0) report(nodes.length);
        }
        if (node.mesh !== undefined && own !== null && gltf.meshes[node.mesh]) addMesh(gltf.meshes[node.mesh], world, own);
        var children = node.children || [];
        for (var i = 0; i < children.length; i++) walk(children[i], world, own);
      }
      var scene = gltf.scenes ? gltf.scenes[gltf.scene || 0] : null;
      var roots = scene && scene.nodes ? scene.nodes : (gltf.nodes || []).map(function (_n, i) { return i; });
      for (var r0 = 0; r0 < roots.length; r0++) walk(roots[r0], IDENTITY, null);
      var transfer = []; var out = [];
      for (var k = 0; k < batches.length; k++) {
        var bb = batches[k];
        var one = { color: bb.color, positions: new Float32Array(bb.positions), normals: new Float32Array(bb.normals), ids: new Uint8Array(bb.ids), index: new Uint32Array(bb.index) };
        transfer.push(one.positions.buffer, one.normals.buffer, one.ids.buffer, one.index.buffer);
        out.push(one);
      }
      var statRows = [];
      Object.keys(stats).forEach(function (key) { var st = stats[key]; statRows.push([Number(key), st.area, st.volume, st.min, st.max]); });
      var rangeArray = new Uint32Array(ranges);
      transfer.push(rangeArray.buffer);
      return { result: { batches: out, ranges: rangeArray, stats: statRows, elements: nodes.length, coordination: null, nodes: nodes }, transfer: transfer };
    }
    self.onmessage = function (ev) {
      var msg = ev.data || {};
      if (msg.type !== 'meshes') return;
      try {
        var done = meshes(msg.bytes, function (n) { self.postMessage({ id: msg.id, progress: n }); });
        self.postMessage({ id: msg.id, ok: true, result: done.result }, done.transfer);
      } catch (err) { self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) }); }
    };
    self.postMessage({ ready: true });
  }

  D.define('engines/gltf', [], () => {
    let worker = null; let ready = null; let seq = 0;
    /** @type {Map<number, {resolve: Function, reject: Function, onProgress?: Function}>} */
    const pending = new Map();
    function ensureWorker() {
      if (worker) return ready;
      worker = D.workers.create({ namespace: 'gltf', source: D.workers.functionSource(dataspatiumGltfWorker), name: 'gltf' });
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
        worker.onerror = (ev) => { for (const p of pending.values()) p.reject(new Error(String((ev && ev.message) || 'glTF worker'))); pending.clear(); terminate(); };
      });
      return ready;
    }
    /** Stop the worker; the next call starts a new one. */
    function terminate() { if (worker) { worker.terminate(); worker = null; ready = null; } }
    /**
     * The meshes of a binary glTF, in the form engines/ifc gives: batches by colour with each vertex's element id, the index
     * ranges per element, the stats per element (area, volume, box) and the nodes (id, guid, cls, storey).
     * @param {Uint8Array|ArrayBuffer} bytes @param {{onProgress?: (elements: number) => void}} [options]
     * @returns {Promise<{batches: any[], ranges: Uint32Array, stats: any[], elements: number, coordination: null, nodes: Array<{id: number, guid: string, cls: string, storey: string}>}>}
     */
    async function meshes(bytes, options = {}) {
      await ensureWorker();
      const copy = bytes instanceof ArrayBuffer ? bytes.slice(0) : bytes.slice().buffer;
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, onProgress: options.onProgress });
        worker.postMessage({ type: 'meshes', id, bytes: copy }, [copy]);
      });
    }
    return { meshes, terminate };
  });
})();
