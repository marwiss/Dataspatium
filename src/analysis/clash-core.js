// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Clash detection on triangle meshes, pure logic without the DOM or outer references. It is one named function so that it runs
 * in the IFC worker (engines/ifc puts its source in front of the worker's) and on the main thread in tests.
 *
 * An element is one or more parts, each a closed triangle mesh (web-ifc gives one per placed geometry), with a box tree (BVH)
 * over its triangles. Pairs whose boxes overlap are checked closer:
 * - intersection: how far one element reaches into the other. Corners and the inside stretches of edges of one element that
 *   lie inside the other (ray parity per part) are measured to the other's surface, and the largest distance is the depth. A
 *   pair counts when the depth exceeds the tolerance, so touching faces and overlaps below it do not.
 * - clearance: the smallest distance between the two surfaces, triangle against triangle; a pair counts when it is below the
 *   clearance.
 * Coordinates are metres; callers move them near the origin first, so that the arithmetic keeps its precision.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  function dataspatiumClashCore() {
    'use strict';
    var LEAF = 4;
    // Six directions, near +x, -x, +y, -y, +z and -z but tilted off the axes, so that every side of a body is tried and a ray
    // seldom runs along an edge.
    var RAYS = [[1, 0.123, 0.071], [-1, -0.097, 0.131], [0.089, 1, -0.117], [-0.141, -1, 0.083], [0.113, -0.067, 1], [-0.079, 0.137, -1]].map(function (d) {
      var l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]); return [d[0] / l, d[1] / l, d[2] / l];
    });

    // ---------------------------------------------------------------------------------------------- building the parts
    function nthElement(order, cent, axis, lo, hi, k) {
      while (hi > lo) {
        var pivot = cent[order[(lo + hi) >> 1] * 3 + axis];
        var i = lo; var j = hi;
        while (i <= j) {
          while (cent[order[i] * 3 + axis] < pivot) i++;
          while (cent[order[j] * 3 + axis] > pivot) j--;
          if (i <= j) { var tmp = order[i]; order[i] = order[j]; order[j] = tmp; i++; j--; }
        }
        if (k <= j) hi = j; else if (k >= i) lo = i; else return;
      }
    }
    /**
     * One closed triangle mesh with its box tree.
     * @param {Float64Array|number[]} pos x, y, z per vertex @param {Uint32Array|number[]} idx three vertex numbers per triangle
     */
    function part(pos, idx) {
      var n = Math.floor(idx.length / 3);
      var tb = new Float64Array(n * 6); var cent = new Float64Array(n * 3);
      var box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (var t = 0; t < n; t++) {
        for (var k = 0; k < 3; k++) { tb[t * 6 + k] = Infinity; tb[t * 6 + 3 + k] = -Infinity; }
        for (var c = 0; c < 3; c++) {
          var v = idx[t * 3 + c] * 3;
          for (var a = 0; a < 3; a++) {
            var x = pos[v + a];
            if (x < tb[t * 6 + a]) tb[t * 6 + a] = x;
            if (x > tb[t * 6 + 3 + a]) tb[t * 6 + 3 + a] = x;
          }
        }
        for (var b = 0; b < 3; b++) {
          cent[t * 3 + b] = (tb[t * 6 + b] + tb[t * 6 + 3 + b]) / 2;
          if (tb[t * 6 + b] < box[b]) box[b] = tb[t * 6 + b];
          if (tb[t * 6 + 3 + b] > box[3 + b]) box[3 + b] = tb[t * 6 + 3 + b];
        }
      }
      var order = new Int32Array(n);
      for (var o = 0; o < n; o++) order[o] = o;
      var nb = []; var nl = []; var nr = []; var ns = []; var nc = [];
      function build(start, end) {
        var id = nl.length;
        nl.push(-1); nr.push(-1); ns.push(start); nc.push(end - start);
        var lo = [Infinity, Infinity, Infinity]; var hi = [-Infinity, -Infinity, -Infinity];
        var clo = [Infinity, Infinity, Infinity]; var chi = [-Infinity, -Infinity, -Infinity];
        for (var i = start; i < end; i++) {
          var tt = order[i];
          for (var q = 0; q < 3; q++) {
            if (tb[tt * 6 + q] < lo[q]) lo[q] = tb[tt * 6 + q];
            if (tb[tt * 6 + 3 + q] > hi[q]) hi[q] = tb[tt * 6 + 3 + q];
            var cc = cent[tt * 3 + q];
            if (cc < clo[q]) clo[q] = cc;
            if (cc > chi[q]) chi[q] = cc;
          }
        }
        nb.push(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]);
        if (end - start > LEAF) {
          var ex = [chi[0] - clo[0], chi[1] - clo[1], chi[2] - clo[2]];
          var axis = ex[0] >= ex[1] && ex[0] >= ex[2] ? 0 : (ex[1] >= ex[2] ? 1 : 2);
          if (ex[axis] > 0) {
            var mid = (start + end) >> 1;
            nthElement(order, cent, axis, start, end - 1, mid);
            var left = build(start, mid); var right = build(mid, end);
            nl[id] = left; nr[id] = right;
          }
        }
        return id;
      }
      if (n) build(0, n);
      // Area and volume give a ceiling on how deep any point can lie inside a closed body (about 3V/A, exact for a slab):
      // a depth beyond it means that the mesh is not closed there and the parity misled, so it is not taken.
      var area = 0; var vol = 0;
      for (var f = 0; f < n; f++) {
        var p0 = idx[f * 3] * 3; var p1 = idx[f * 3 + 1] * 3; var p2 = idx[f * 3 + 2] * 3;
        var ux = pos[p1] - pos[p0]; var uy = pos[p1 + 1] - pos[p0 + 1]; var uz = pos[p1 + 2] - pos[p0 + 2];
        var wx = pos[p2] - pos[p0]; var wy = pos[p2 + 1] - pos[p0 + 1]; var wz = pos[p2 + 2] - pos[p0 + 2];
        var cx = uy * wz - uz * wy; var cy = uz * wx - ux * wz; var cz = ux * wy - uy * wx;
        area += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
        vol += (pos[p0] * (pos[p1 + 1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2 + 1]) - pos[p0 + 1] * (pos[p1] * pos[p2 + 2] - pos[p1 + 2] * pos[p2]) + pos[p0 + 2] * (pos[p1] * pos[p2 + 1] - pos[p1 + 1] * pos[p2])) / 6;
      }
      var maxDepth = area > 0 ? 3 * Math.abs(vol) / area : 0;
      return { pos: pos, idx: idx, n: n, tb: tb, box: box, order: order, nb: nb, nl: nl, nr: nr, ns: ns, nc: nc, area: area, volume: Math.abs(vol), maxDepth: maxDepth };
    }
    /** An element: an id, its parts and the box around them. @param {any} id @param {any[]} parts */
    function element(id, parts) {
      var box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      var kept = [];
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i].n) continue;
        kept.push(parts[i]);
        for (var a = 0; a < 3; a++) { if (parts[i].box[a] < box[a]) box[a] = parts[i].box[a]; if (parts[i].box[3 + a] > box[3 + a]) box[3 + a] = parts[i].box[3 + a]; }
      }
      return { id: id, parts: kept, box: box };
    }

    // ---------------------------------------------------------------------------------------------- geometry
    function boxesOverlap(a, ai, b, bi, margin) {
      return a[ai] - margin <= b[bi + 3] && b[bi] - margin <= a[ai + 3] && a[ai + 1] - margin <= b[bi + 4] && b[bi + 1] - margin <= a[ai + 4] && a[ai + 2] - margin <= b[bi + 5] && b[bi + 2] - margin <= a[ai + 5];
    }
    function boxDistance(a, ai, b, bi) {
      var s = 0;
      for (var k = 0; k < 3; k++) {
        var d = Math.max(0, a[ai + k] - b[bi + 3 + k], b[bi + k] - a[ai + 3 + k]);
        s += d * d;
      }
      return Math.sqrt(s);
    }
    function pointBoxDistance(p, b, bi) {
      var s = 0;
      for (var k = 0; k < 3; k++) { var d = Math.max(0, b[bi + k] - p[k], p[k] - b[bi + 3 + k]); s += d * d; }
      return Math.sqrt(s);
    }
    function vert(P, t, c) { var v = P.idx[t * 3 + c] * 3; return [P.pos[v], P.pos[v + 1], P.pos[v + 2]]; }
    /**
     * Where a segment from o along d (t in [0, tmax]) meets a triangle (Möller and Trumbore). The edge flag says the hit is so
     * close to the triangle's border that the parity of a ray through it can not be trusted.
     */
    function rayTriangle(o, d, P, t, tmax, hit) {
      var a = vert(P, t, 0); var b = vert(P, t, 1); var c = vert(P, t, 2);
      var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; var e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      var pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      var det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
      var scale = Math.sqrt((e1[0] * e1[0] + e1[1] * e1[1] + e1[2] * e1[2]) * (e2[0] * e2[0] + e2[1] * e2[1] + e2[2] * e2[2]));
      if (Math.abs(det) <= 1e-12 * scale) return false;
      var inv = 1 / det;
      var tv = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
      var u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * inv;
      if (u < -1e-9 || u > 1 + 1e-9) return false;
      var qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
      var v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) * inv;
      if (v < -1e-9 || u + v > 1 + 1e-9) return false;
      var tt = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv;
      if (tt <= 1e-12 || tt > tmax) return false;
      hit.t = tt;
      hit.edge = u < 1e-7 || v < 1e-7 || u + v > 1 - 1e-7;
      return true;
    }
    function segmentHitsBox(o, d, tmax, b, bi) {
      var t0 = 0; var t1 = tmax;
      for (var k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-300) { if (o[k] < b[bi + k] - 1e-9 || o[k] > b[bi + 3 + k] + 1e-9) return false; continue; }
        var ta = (b[bi + k] - o[k]) / d[k]; var tb2 = (b[bi + 3 + k] - o[k]) / d[k];
        if (ta > tb2) { var x = ta; ta = tb2; tb2 = x; }
        if (ta > t0) t0 = ta;
        if (tb2 < t1) t1 = tb2;
        if (t0 > t1 + 1e-12) return false;
      }
      return true;
    }
    /** The parameters where a segment crosses a part's surface, sorted, and whether any crossing grazed an edge. */
    function crossings(o, d, tmax, P) {
      var ts = []; var grazed = false;
      if (!P.n || !segmentHitsBox(o, d, tmax, P.nb, 0)) return { ts: ts, grazed: false };
      var stack = [0]; var hit = { t: 0, edge: false };
      while (stack.length) {
        var nd = stack.pop();
        if (!segmentHitsBox(o, d, tmax, P.nb, nd * 6)) continue;
        if (P.nl[nd] < 0) {
          for (var i = P.ns[nd]; i < P.ns[nd] + P.nc[nd]; i++) {
            if (rayTriangle(o, d, P, P.order[i], tmax, hit)) { ts.push(hit.t); if (hit.edge) grazed = true; }
          }
        } else { stack.push(P.nl[nd], P.nr[nd]); }
      }
      ts.sort(function (x, y) { return x - y; });
      var merged = [];
      for (var j = 0; j < ts.length; j++) if (!merged.length || ts[j] - merged[merged.length - 1] > 1e-9 * Math.max(1, tmax)) merged.push(ts[j]);
      return { ts: merged, grazed: grazed };
    }
    /**
     * Whether a point is inside a part: every ray in six directions that does not graze an edge must cross the surface an odd
     * number of times, and at least three must be clean. On a closed mesh they always agree; where a mesh is open, a ray out
     * through the gap disagrees, and the point counts as outside, so that an imperfect mesh gives no clash rather than a false one.
     */
    function insidePart(p, P) {
      if (!P.n || pointBoxDistance(p, P.box, 0) > 0) return false;
      var len = 0;
      for (var k = 0; k < 3; k++) len = Math.max(len, Math.abs(P.box[3 + k] - P.box[k]));
      len = len * 2 + 1;
      var clean = 0;
      for (var r = 0; r < RAYS.length; r++) {
        var c = crossings(p, RAYS[r], len, P);
        if (c.grazed) continue;
        if (c.ts.length % 2 === 0) return false;
        clean++;
      }
      return clean >= 3;
    }
    /** A depth that a closed part of this size can have; anything deeper is an artefact of an open mesh. */
    function plausible(d, P, margin) { return d <= P.maxDepth * 1.05 + margin + 1e-9; }
    function closestOnTriangle(p, a, b, c) {
      var ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; var ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; var ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      var d1 = ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]; var d2 = ac[0] * ap[0] + ac[1] * ap[1] + ac[2] * ap[2];
      if (d1 <= 0 && d2 <= 0) return a;
      var bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]];
      var d3 = ab[0] * bp[0] + ab[1] * bp[1] + ab[2] * bp[2]; var d4 = ac[0] * bp[0] + ac[1] * bp[1] + ac[2] * bp[2];
      if (d3 >= 0 && d4 <= d3) return b;
      var vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { var v1 = d1 / (d1 - d3); return [a[0] + v1 * ab[0], a[1] + v1 * ab[1], a[2] + v1 * ab[2]]; }
      var cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      var d5 = ab[0] * cp[0] + ab[1] * cp[1] + ab[2] * cp[2]; var d6 = ac[0] * cp[0] + ac[1] * cp[1] + ac[2] * cp[2];
      if (d6 >= 0 && d5 <= d6) return c;
      var vb = d5 * d2 - d1 * d6;
      if (vb <= 0 && d2 >= 0 && d6 <= 0) { var w1 = d2 / (d2 - d6); return [a[0] + w1 * ac[0], a[1] + w1 * ac[1], a[2] + w1 * ac[2]]; }
      var va = d3 * d6 - d5 * d4;
      if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { var w2 = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + w2 * (c[0] - b[0]), b[1] + w2 * (c[1] - b[1]), b[2] + w2 * (c[2] - b[2])]; }
      var denom = 1 / (va + vb + vc); var v = vb * denom; var w = vc * denom;
      return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
    }
    /** The distance from a point to a part's surface, searched through the box tree. */
    function distanceToPart(p, P, best) {
      var d = best === undefined ? Infinity : best;
      if (!P.n) return d;
      var stack = [0];
      while (stack.length) {
        var nd = stack.pop();
        if (pointBoxDistance(p, P.nb, nd * 6) >= d) continue;
        if (P.nl[nd] < 0) {
          for (var i = P.ns[nd]; i < P.ns[nd] + P.nc[nd]; i++) {
            var t = P.order[i];
            var q = closestOnTriangle(p, vert(P, t, 0), vert(P, t, 1), vert(P, t, 2));
            var dd = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
            if (dd < d) d = dd;
          }
        } else {
          var l = P.nl[nd]; var r = P.nr[nd];
          var dl = pointBoxDistance(p, P.nb, l * 6); var dr = pointBoxDistance(p, P.nb, r * 6);
          if (dl < dr) stack.push(r, l); else stack.push(l, r);
        }
      }
      return d;
    }
    function segmentSegment(p1, q1, p2, q2) {
      var d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]]; var d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]]; var r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
      var a = d1[0] * d1[0] + d1[1] * d1[1] + d1[2] * d1[2]; var e = d2[0] * d2[0] + d2[1] * d2[1] + d2[2] * d2[2]; var f = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
      var s; var t;
      if (a <= 1e-24 && e <= 1e-24) { s = 0; t = 0; } else if (a <= 1e-24) { s = 0; t = Math.min(1, Math.max(0, f / e)); } else {
        var c = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2];
        if (e <= 1e-24) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else {
          var b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]; var den = a * e - b * b;
          s = den > 1e-24 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
          t = (b * s + f) / e;
          if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
        }
      }
      var c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s]; var c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
      return { d: Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]), p: [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2, (c1[2] + c2[2]) / 2] };
    }
    /** The distance between two triangles that do not cross: the nearest of their corners to the other and of their edges. */
    function triangleDistance(A, s, B, t) {
      var a = [vert(A, s, 0), vert(A, s, 1), vert(A, s, 2)]; var b = [vert(B, t, 0), vert(B, t, 1), vert(B, t, 2)];
      var best = { d: Infinity, p: null };
      for (var i = 0; i < 3; i++) {
        var q = closestOnTriangle(a[i], b[0], b[1], b[2]); var d = Math.hypot(a[i][0] - q[0], a[i][1] - q[1], a[i][2] - q[2]);
        if (d < best.d) best = { d: d, p: [(a[i][0] + q[0]) / 2, (a[i][1] + q[1]) / 2, (a[i][2] + q[2]) / 2] };
        var q2 = closestOnTriangle(b[i], a[0], a[1], a[2]); var d2 = Math.hypot(b[i][0] - q2[0], b[i][1] - q2[1], b[i][2] - q2[2]);
        if (d2 < best.d) best = { d: d2, p: [(b[i][0] + q2[0]) / 2, (b[i][1] + q2[1]) / 2, (b[i][2] + q2[2]) / 2] };
      }
      for (var x = 0; x < 3; x++) for (var y = 0; y < 3; y++) {
        var ss = segmentSegment(a[x], a[(x + 1) % 3], b[y], b[(y + 1) % 3]);
        if (ss.d < best.d) best = ss;
      }
      return best;
    }

    // ---------------------------------------------------------------------------------------------- one pair
    /** Triangles of a part whose boxes come within a margin of a box. */
    function trianglesNear(P, box, margin) {
      var out = [];
      if (!P.n || !boxesOverlap(P.nb, 0, box, 0, margin)) return out;
      var stack = [0];
      while (stack.length) {
        var nd = stack.pop();
        if (!boxesOverlap(P.nb, nd * 6, box, 0, margin)) continue;
        if (P.nl[nd] < 0) {
          for (var i = P.ns[nd]; i < P.ns[nd] + P.nc[nd]; i++) { var t = P.order[i]; if (boxesOverlap(P.tb, t * 6, box, 0, margin)) out.push(t); }
        } else { stack.push(P.nl[nd], P.nr[nd]); }
      }
      return out;
    }
    /**
     * How far element A reaches into element B: the largest distance to B's surface of A's corners inside B and of the middles of
     * the stretches of A's edges that run inside B, part by part. Returns the depth, the point that gave it, and whether any edge
     * of A crossed B's surface.
     */
    function reach(A, B, margin) {
      var best = { depth: 0, point: null, crossed: false, inside: false };
      for (var pa = 0; pa < A.parts.length; pa++) {
        var P = A.parts[pa];
        var tris = trianglesNear(P, B.box, margin);
        if (!tris.length) continue;
        var seenV = {}; var seenE = {};
        for (var k = 0; k < tris.length; k++) {
          var t = tris[k];
          for (var c = 0; c < 3; c++) {
            var vi = P.idx[t * 3 + c]; var vj = P.idx[t * 3 + (c + 1) % 3];
            var key = vi < vj ? vi + ',' + vj : vj + ',' + vi;
            var p = vert(P, t, c);
            if (!seenV[vi]) {
              seenV[vi] = true;
              for (var pb = 0; pb < B.parts.length; pb++) {
                if (insidePart(p, B.parts[pb])) {
                  var dv = distanceToPart(p, B.parts[pb]);
                  if (!plausible(dv, B.parts[pb], margin)) continue;
                  best.inside = true;
                  if (dv > best.depth) { best.depth = dv; best.point = p; }
                }
              }
            }
            if (seenE[key]) continue;
            seenE[key] = true;
            var q = vert(P, t, (c + 1) % 3);
            var d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
            for (var pb2 = 0; pb2 < B.parts.length; pb2++) {
              var Q = B.parts[pb2];
              if (!boxesOverlap([Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2]), Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])], 0, Q.box, 0, margin)) continue;
              var cr = crossings(p, d, 1, Q);
              if (!cr.ts.length) continue;
              best.crossed = true;
              var ins = insidePart(p, Q);
              var prev = 0;
              for (var x = 0; x <= cr.ts.length; x++) {
                var next = x < cr.ts.length ? cr.ts[x] : 1;
                if (ins && next - prev > 1e-9) {
                  var m = (prev + next) / 2; var mp = [p[0] + d[0] * m, p[1] + d[1] * m, p[2] + d[2] * m];
                  // The parity along the edge is checked again at the middle, where an open mesh shows itself.
                  if (insidePart(mp, Q)) {
                    var dm = distanceToPart(mp, Q);
                    if (plausible(dm, Q, margin) && dm > best.depth) { best.depth = dm; best.point = mp; }
                  }
                }
                ins = !ins; prev = next;
              }
            }
          }
        }
      }
      return best;
    }
    /** The smallest distance between two elements' surfaces, stopping early below a limit. */
    function surfaceDistance(A, B, limit) {
      var best = { d: Infinity, p: null };
      for (var i = 0; i < A.parts.length; i++) for (var j = 0; j < B.parts.length; j++) {
        var P = A.parts[i]; var Q = B.parts[j];
        if (boxDistance(P.box, 0, Q.box, 0) >= Math.min(best.d, limit)) continue;
        var stack = [[0, 0]];
        while (stack.length) {
          var pr = stack.pop(); var na = pr[0]; var nb2 = pr[1];
          if (boxDistance(P.nb, na * 6, Q.nb, nb2 * 6) >= Math.min(best.d, limit)) continue;
          var la = P.nl[na] < 0; var lb = Q.nl[nb2] < 0;
          if (la && lb) {
            for (var x = P.ns[na]; x < P.ns[na] + P.nc[na]; x++) for (var y = Q.ns[nb2]; y < Q.ns[nb2] + Q.nc[nb2]; y++) {
              var td = triangleDistance(P, P.order[x], Q, Q.order[y]);
              if (td.d < best.d) best = td;
            }
          } else if (lb || (!la && P.nc[na] >= Q.nc[nb2])) { stack.push([P.nl[na], nb2], [P.nr[na], nb2]); } else { stack.push([na, Q.nl[nb2]], [na, Q.nr[nb2]]); }
        }
      }
      return best;
    }
    function centre(A, B) {
      var b = [Math.max(A.box[0], B.box[0]), Math.max(A.box[1], B.box[1]), Math.max(A.box[2], B.box[2]), Math.min(A.box[3], B.box[3]), Math.min(A.box[4], B.box[4]), Math.min(A.box[5], B.box[5])];
      return [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
    }
    /**
     * One pair. @param {any} A @param {any} B @param {{mode?: string, tolerance?: number, clearance?: number}} options
     * @returns {{kind: string, depth?: number, distance?: number, point: number[]}|null}
     */
    function pair(A, B, options) {
      var mode = options.mode || 'intersection';
      var tol = options.tolerance === undefined ? 0.002 : options.tolerance;
      if (mode === 'clearance') {
        var clear = options.clearance === undefined ? 0.05 : options.clearance;
        var ab = reach(A, B, 1e-9); var ba = reach(B, A, 1e-9);
        if (ab.depth > tol || ba.depth > tol) { var deep = ab.depth >= ba.depth ? ab : ba; return { kind: 'intersection', depth: deep.depth, distance: 0, point: deep.point || centre(A, B) }; }
        var sd = surfaceDistance(A, B, clear);
        return sd.d < clear ? { kind: 'clearance', distance: sd.d, point: sd.p || centre(A, B) } : null;
      }
      var r1 = reach(A, B, tol); var r2 = reach(B, A, tol);
      var r = r1.depth >= r2.depth ? r1 : r2;
      if (r.depth <= tol) return null;
      var contained = !r1.crossed && !r2.crossed;
      return { kind: contained ? 'contained' : 'intersection', depth: r.depth, point: r.point || centre(A, B) };
    }

    // ---------------------------------------------------------------------------------------------- all pairs
    /**
     * The pairs of set A against set B whose boxes come within the margin (sort and sweep along x). When an element is in both
     * sets, each pair is checked once; an element is never checked against itself.
     */
    function candidates(setA, setB, margin) {
      var items = [];
      for (var i = 0; i < setA.length; i++) items.push({ e: setA[i], s: 1 });
      for (var j = 0; j < setB.length; j++) items.push({ e: setB[j], s: 2 });
      items.sort(function (x, y) { return x.e.box[0] - y.e.box[0]; });
      var active = []; var out = []; var seen = {};
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var keep = [];
        for (var a = 0; a < active.length; a++) {
          var other = active[a];
          if (other.e.box[3] + margin < it.e.box[0]) continue;
          keep.push(other);
          if (other.s === it.s || other.e.key === it.e.key) continue;
          if (!boxesOverlap(other.e.box, 0, it.e.box, 0, margin)) continue;
          var A = other.s === 1 ? other.e : it.e; var B = other.s === 1 ? it.e : other.e;
          var key = A.key < B.key ? A.key + '|' + B.key : B.key + '|' + A.key;
          if (seen[key]) continue;
          seen[key] = true;
          out.push([A, B]);
        }
        keep.push(it);
        active = keep;
      }
      return out;
    }
    /**
     * Every clash of set A against set B. Elements need a `key` that is unique across both sets (for example model:id).
     * @param {any[]} setA @param {any[]} setB @param {{mode?: string, tolerance?: number, clearance?: number}} options
     * @param {(done: number, total: number) => void} [onProgress]
     * @returns {{pairs: number, clashes: Array<{a: any, b: any, kind: string, depth?: number, distance?: number, point: number[]}>}}
     */
    function clash(setA, setB, options, onProgress) {
      var opts = options || {};
      var margin = opts.mode === 'clearance' ? (opts.clearance === undefined ? 0.05 : opts.clearance) : 0;
      var list = candidates(setA, setB, margin);
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var res = pair(list[i][0], list[i][1], opts);
        if (res) {
          var A = list[i][0]; var B = list[i][1];
          res.a = A.id; res.b = B.id; res.am = A.model; res.bm = B.model;
          // The size of the region where the two meet, for a camera that shows it.
          var ext = 0;
          for (var k = 0; k < 3; k++) { var e = Math.min(A.box[3 + k], B.box[3 + k]) - Math.max(A.box[k], B.box[k]); if (e > 0) ext += e * e; }
          res.extent = Math.sqrt(ext);
          out.push(res);
        }
        if (onProgress && (i % 50 === 49 || i === list.length - 1)) onProgress(i + 1, list.length);
      }
      return { pairs: list.length, clashes: out };
    }

    return { part: part, element: element, pair: pair, candidates: candidates, clash: clash, insidePart: insidePart, distanceToPart: distanceToPart, surfaceDistance: surfaceDistance, crossings: crossings };
  }

  D.define('analysis/clash-core', [], () => ({ source: dataspatiumClashCore.toString(), create: dataspatiumClashCore }));
})();
