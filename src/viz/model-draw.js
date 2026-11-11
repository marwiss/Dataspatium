// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Draws IFC models with three.js, for Bearbeta, Visualisera, dashboards and exports. The meshes of one model at a time
 * are kept in memory. One draw call per surface colour, whatever the number of elements: picking renders the same
 * buffers with element ids as colours into one pixel, highlighting draws the element's index ranges again, and hiding
 * rebuilds the index buffers from the ranges of the visible elements. WebGL may be missing: render() then throws an
 * error with a message the view can show, and the tables still work.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/model-draw', ['data/datasets', 'data/model', 'engines/ifc', 'viz/theme', 'viz/export'], (datasets, model, ifc, theme, vizExport) => {
    const THREE_MODULE = '/three@0.187.0/es2022/three.mjs';
    /** @type {any} */ let three = null;
    /** @type {any} */ let controlsLib = null;
    /** @type {{key: string, meshes: Promise<any>}|null} */ let cache = null;

    /** The three.js module and OrbitControls, loaded once. */
    async function ensureThree() {
      if (three) return three;
      controlsLib = await D.assets.importGraph('three');
      three = await D.assets.importGraph('three', THREE_MODULE);
      return three;
    }

    /**
     * The meshes of a model dataset, computed once per version of the dataset; a candidate file (`bytes`, the preview of a change set)
     * is meshed every time and never kept.
     * @param {string} datasetId @param {{onProgress?: (elements: number) => void, bytes?: Uint8Array|ArrayBuffer|null}} [options]
     */
    async function meshesOf(datasetId, options = {}) {
      if (options.bytes) return ifc.meshes(options.bytes, { onProgress: options.onProgress }).then((m) => { ifc.release(); return indexed(m); });
      const meta = await datasets.get(datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const key = datasetId + '|' + meta.updatedAt;
      if (cache && cache.key === key) return cache.meshes;
      const file = await model.original(datasetId);
      // A large model from the server (data/model-server) has no IFC file: its glTF is read instead (engines/gltf).
      const server = file || !D.has('data/model-server') ? null : await D.require('data/model-server').geometry(datasetId);
      if (!file && !server) throw new Error(D.t('model.err.nofile'));
      const meshes = file
        ? ifc.meshes(file.bytes, { onProgress: options.onProgress }).then((m) => { ifc.release(); return indexed(m); })
        : D.require('engines/gltf').meshes(server.bytes, { onProgress: options.onProgress }).then(indexed);
      cache = { key, meshes };
      meshes.catch(() => { if (cache && cache.key === key) cache = null; });
      return meshes;
    }
    /** Forget the kept meshes (the dataset was removed, or memory is needed). */
    function clearCache() { cache = null; ifc.terminate(); if (D.has('engines/gltf')) D.require('engines/gltf').terminate(); }

    function indexed(m) {
      /** @type {Map<number, number[]>} element -> flat [batch, first index, index count] */
      const byElement = new Map();
      const r = m.ranges;
      for (let i = 0; i < r.length; i += 4) {
        let list = byElement.get(r[i]);
        if (!list) { list = []; byElement.set(r[i], list); }
        list.push(r[i + 1], r[i + 2], r[i + 3]);
      }
      const statsById = new Map(m.stats.map((s) => [s[0], { area: s[1], volume: s[2], min: s[3], max: s[4] }]));
      let triangles = 0;
      for (const b of m.batches) triangles += b.index.length / 3;
      const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const s of statsById.values()) for (let k = 0; k < 3; k++) { if (s.min[k] < box.min[k]) box.min[k] = s.min[k]; if (s.max[k] > box.max[k]) box.max[k] = s.max[k]; }
      return { batches: m.batches, byElement, stats: statsById, elements: m.elements, triangles, box, focus: focusBox(statsById, box), coordination: m.coordination || null };
    }
    /** What the camera aims at: the elements without the odd one far away (a site marker can be hundreds of metres off). */
    /** The inverse of a column-major 4×4 matrix, or null when it has none. @param {number[]} m @returns {number[]|null} */
    function invert4(m) {
      const inv = new Array(16);
      inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
      inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
      inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
      inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
      inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
      inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
      inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
      inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
      inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
      inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
      inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
      inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
      inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
      inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
      inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
      inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
      const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
      if (!det) return null;
      return inv.map((v) => v / det);
    }
    /**
     * A point of the 3D view in the model's own coordinates. web-ifc moved the model near the origin with its coordination matrix
     * (column-major 4×4) and gives Y up, while IFC and BCF have Z up: the matrix is undone, then (x, y, z) becomes (x, -z, y).
     * @param {number[]|null} m the coordination matrix @param {number[]} p @returns {number[]}
     */
    function toIfc(m, p) {
      let w = p;
      const inv = m && m.length === 16 ? invert4(m) : null;
      if (inv) w = [inv[0] * p[0] + inv[4] * p[1] + inv[8] * p[2] + inv[12], inv[1] * p[0] + inv[5] * p[1] + inv[9] * p[2] + inv[13], inv[2] * p[0] + inv[6] * p[1] + inv[10] * p[2] + inv[14]];
      return [w[0], -w[2], w[1]];
    }
    /**
     * The inverse of toIfc: a point in the model's own coordinates (Z up) as a point of the 3D view.
     * @param {number[]|null} m the coordination matrix @param {number[]} p @returns {number[]}
     */
    function fromIfc(m, p) {
      const w = [p[0], p[2], -p[1]];
      if (!(m && m.length === 16)) return w;
      return [m[0] * w[0] + m[4] * w[1] + m[8] * w[2] + m[12], m[1] * w[0] + m[5] * w[1] + m[9] * w[2] + m[13], m[2] * w[0] + m[6] * w[1] + m[10] * w[2] + m[14]];
    }
    /** A direction in the model's own coordinates as a direction of the 3D view (the matrix without its move). */
    function fromIfcDir(m, d) {
      const w = [d[0], d[2], -d[1]];
      if (!(m && m.length === 16)) return w;
      return [m[0] * w[0] + m[4] * w[1] + m[8] * w[2], m[1] * w[0] + m[5] * w[1] + m[9] * w[2], m[2] * w[0] + m[6] * w[1] + m[10] * w[2]];
    }
    /**
     * The standard views as directions from what is shown to the camera, in the model's own axes (X east, Y north, Z up); the top
     * and bottom views lean a hair to the south so that north stays up on the screen. The keys 1–7 follow this order.
     */
    const VIEWS = { top: [0, -0.001, 1], front: [0, -1, 0], right: [1, 0, 0], back: [0, 1, 0], left: [-1, 0, 0], bottom: [0, -0.001, -1], iso: [0.6, -0.62, 0.5] };
    const VIEW_ORDER = ['top', 'front', 'right', 'back', 'left', 'bottom', 'iso'];
    /**
     * A section box in the model's own coordinates as six BCF clipping planes: a location on the plane and a direction that points
     * to the side cut away (BCF-XML: "the Direction vector points in the invisible direction").
     * @param {{min: number[], max: number[]}} box @returns {Array<{location: number[], direction: number[]}>}
     */
    function boxPlanes(box) {
      const centre = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2);
      const out = [];
      for (let k = 0; k < 3; k++) {
        const at = (v) => centre.map((c, i) => (i === k ? v : c));
        const axis = (s) => [0, 1, 2].map((i) => (i === k ? s : 0));
        out.push({ location: at(box.min[k]), direction: axis(-1) }, { location: at(box.max[k]), direction: axis(1) });
      }
      return out;
    }
    /**
     * The box of clipping planes that all stand across an axis of the model, or null for planes at other angles; an axis without a
     * plane takes the bounds given.
     * @param {Array<{location: number[], direction: number[]}>} planes @param {{min: number[], max: number[]}} bounds
     */
    function boxOfPlanes(planes, bounds) {
      const box = { min: bounds.min.slice(), max: bounds.max.slice() };
      for (const c of planes || []) {
        const d = c.direction; const len = Math.hypot(d[0], d[1], d[2]) || 1;
        const k = [0, 1, 2].find((i) => Math.abs(Math.abs(d[i] / len) - 1) < 1e-6);
        if (k === undefined) return null;
        if (d[k] < 0) box.min[k] = c.location[k]; else box.max[k] = c.location[k];
      }
      return box;
    }
    function focusBox(stats, whole) {
      const list = Array.from(stats.values()).filter((s) => Number.isFinite(s.min[0]));
      if (list.length < 20) return whole;
      const centres = [0, 1, 2].map((k) => list.map((s) => (s.min[k] + s.max[k]) / 2).sort((a, b) => a - b));
      const bounds = centres.map((c) => {
        const lo = c[Math.floor(c.length * 0.02)]; const hi = c[Math.ceil(c.length * 0.98) - 1];
        const margin = Math.max((hi - lo) * 0.25, 1);
        return [lo - margin, hi + margin];
      });
      const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const s of list) {
        let inside = true;
        for (let k = 0; k < 3; k++) { const c = (s.min[k] + s.max[k]) / 2; if (c < bounds[k][0] || c > bounds[k][1]) inside = false; }
        if (!inside) continue;
        for (let k = 0; k < 3; k++) { if (s.min[k] < box.min[k]) box.min[k] = s.min[k]; if (s.max[k] > box.max[k]) box.max[k] = s.max[k]; }
      }
      return Number.isFinite(box.min[0]) ? box : whole;
    }

    /** The index ranges of some elements in one batch, as a new index array. */
    function indexFor(meshes, batchNo, ids) {
      const source = meshes.batches[batchNo].index;
      let size = 0;
      const picks = [];
      for (const id of ids) {
        const list = meshes.byElement.get(id);
        if (!list) continue;
        for (let i = 0; i < list.length; i += 3) if (list[i] === batchNo) { picks.push(list[i + 1], list[i + 2]); size += list[i + 2]; }
      }
      const out = new Uint32Array(size);
      let at = 0;
      for (let i = 0; i < picks.length; i += 2) { out.set(source.subarray(picks[i], picks[i] + picks[i + 1]), at); at += picks[i + 1]; }
      return out;
    }

    /**
     * Draws a model into a container.
     * @param {HTMLElement} container
     * @param {{datasetId: string, visible?: number[]|null, selected?: number[], view?: any, colors?: Array<{color: string, ids: number[]}>|null, bytes?: Uint8Array|ArrayBuffer|null}} def
     * @param {{onSelect?: (id: number|null) => void, onProgress?: (elements: number) => void, navigation?: boolean, label?: string,
     *   onProjection?: (kind: string) => void, onSection?: (planes: any[]) => void}} [options] `navigation` adds the keys and the double click of an interactive view
     * @returns {Promise<any>} handle: info, select(ids, {fit}), setVisible(ids), fit(ids, dir), standardView(name),
     *   setProjection(kind), projection(), pivotAt(x, y), setViewpoint(vp), onView(fn), view(), png(scale), resize(), destroy()
     */
    async function render(container, def, options = {}) {
      const THREE = await ensureThree();
      const meshes = await meshesOf(def.datasetId, { onProgress: options.onProgress, bytes: def.bytes || null });
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!options.preserve });
      } catch (_err) { throw new Error(D.t('model.err.webgl')); }
      const tk = theme.tokens();
      const width = () => Math.max(1, container.clientWidth || options.width || 800);
      const height = () => Math.max(1, container.clientHeight || options.height || 500);
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
      renderer.localClippingEnabled = true;
      renderer.setSize(width(), height());
      const canvas = renderer.domElement;
      canvas.classList.add('dm-model-canvas');
      container.appendChild(canvas);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(tk.background);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(1, 2, 1.5);
      scene.add(sun);
      const persp = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 1000);
      /** The orthographic camera, made the first time it is chosen. @type {any} */ let ortho = null;
      /** The camera in use: one of the two. @type {any} */ let camera = persp;
      const controls = new controlsLib.OrbitControls(camera, canvas);
      controls.enableDamping = false;
      controls.zoomToCursor = true;

      const pickScene = new THREE.Scene();
      pickScene.background = new THREE.Color(0, 0, 0);
      // Picking cuts where the drawing cuts, so that a section never gives an element that is not shown.
      const pickMaterial = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        clipping: true,
        vertexShader: 'attribute vec3 pickColor; varying vec3 vPick;\n#include <clipping_planes_pars_vertex>\nvoid main() { vPick = pickColor;\n#include <begin_vertex>\n#include <project_vertex>\n#include <clipping_planes_vertex>\n}',
        fragmentShader: 'varying vec3 vPick;\n#include <clipping_planes_pars_fragment>\nvoid main() {\n#include <clipping_planes_fragment>\ngl_FragColor = vec4(vPick, 1.0); }',
      });
      const parts = meshes.batches.map((b) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3));
        geometry.setAttribute('pickColor', new THREE.BufferAttribute(b.ids, 3, true));
        geometry.setIndex(new THREE.BufferAttribute(b.index, 1));
        const color = new THREE.Color().setRGB(b.color[0], b.color[1], b.color[2], THREE.SRGBColorSpace);
        const material = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: b.color[3] < 0.99, opacity: b.color[3], depthWrite: b.color[3] >= 0.99 });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        pickScene.add(new THREE.Mesh(geometry, pickMaterial));
        return { geometry, material, mesh };
      });
      const highlightMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(tk.accent), emissive: new THREE.Color(tk.accent), emissiveIntensity: 0.45, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      // Colour groups: elements drawn again in a colour of their own (an issue's status, a class), under the highlight.
      const colored = new THREE.Group();
      scene.add(colored);
      /** @type {Map<string, any>} */
      const colorMaterials = new Map();
      const highlight = new THREE.Group();
      scene.add(highlight);
      const pickTarget = new THREE.WebGLRenderTarget(1, 1);

      let destroyed = false; let scheduled = false;
      /** @type {Set<(camera: any) => void>} */ const viewListeners = new Set();
      const draw = () => { if (destroyed) return; renderer.render(scene, camera); for (const fn of viewListeners) fn(camera); };
      const schedule = () => { if (scheduled || destroyed) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; draw(); }); };
      controls.addEventListener('change', schedule);

      /** The elements a filter or an isolation leaves, or null when all are shown. @type {number[]|null} */
      let visibleIds = null;
      const wholeSize = Math.hypot(meshes.box.max[0] - meshes.box.min[0], meshes.box.max[1] - meshes.box.min[1], meshes.box.max[2] - meshes.box.min[2]);
      const focusRadius = Math.max(0.5, Math.hypot(meshes.focus.max[0] - meshes.focus.min[0], meshes.focus.max[1] - meshes.focus.min[1], meshes.focus.max[2] - meshes.focus.min[2]) / 2);
      /** The centre and radius of some elements, of the shown ones when a filter narrows the view, or of the model without odd ones. */
      function sphereOf(ids) {
        const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
        const take = (s) => { for (let k = 0; k < 3; k++) { if (s.min[k] < min[k]) min[k] = s.min[k]; if (s.max[k] > max[k]) max[k] = s.max[k]; } };
        const list = ids && ids.length ? ids : visibleIds;
        if (list && list.length) for (const id of list) { const s = meshes.stats.get(id); if (s) take(s); }
        if (!Number.isFinite(min[0])) take(meshes.focus);
        if (!Number.isFinite(min[0])) { min[0] = min[1] = min[2] = -1; max[0] = max[1] = max[2] = 1; }
        return { centre: new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2), radius: Math.max(0.5, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2) };
      }
      /** The frustum of the orthographic camera for a height of the view in metres; the zoom is left as it is. */
      function frameOrtho(viewHeight) {
        const aspect = width() / height();
        ortho.top = viewHeight / 2; ortho.bottom = -viewHeight / 2; ortho.left = -viewHeight * aspect / 2; ortho.right = viewHeight * aspect / 2;
        ortho.updateProjectionMatrix();
      }
      /**
       * Aims the camera at some elements, or at what is shown, from a direction of the view (from what is shown towards the camera;
       * by default from above in the south-east).
       * @param {number[]|null} [ids] @param {number[]} [dir]
       */
      function fit(ids, dir) {
        const { centre, radius } = sphereOf(ids);
        const towards = new THREE.Vector3().fromArray(dir || [0.6, 0.5, 0.62]).normalize();
        const aspect = width() / height();
        const margin = aspect < 1 ? 1.1 / aspect : 1.05;
        const distance = radius / Math.sin((persp.fov * Math.PI / 180) / 2) * margin;
        if (camera === ortho) {
          ortho.zoom = 1;
          frameOrtho(2 * radius * margin);
          const back = Math.max(distance, radius * 4);
          ortho.position.copy(centre).addScaledVector(towards, back);
          ortho.near = 0.01; ortho.far = Math.max((back + radius) * 4, wholeSize * 4);
        } else {
          persp.near = Math.max(radius / 1000, 0.01);
          persp.far = Math.max((distance + radius) * 20, wholeSize * 4);
          persp.position.copy(centre).addScaledVector(towards, distance);
        }
        camera.updateProjectionMatrix();
        controls.target.copy(centre);
        controls.update();
        schedule();
      }
      /** One of the standard views of what is shown (top, front, right, back, left, bottom, iso). */
      function standardView(name) {
        const d = VIEWS[name];
        if (!d) return false;
        fit(null, fromIfcDir(meshes.coordination, d));
        return true;
      }
      const projection = () => (camera === ortho ? 'orthographic' : 'perspective');
      /**
       * Changes between the perspective and the orthographic camera from the same place: what is shown keeps its size. `height`
       * sets the height of an orthographic view in metres (a BCF viewpoint, a saved chart).
       * @param {string} kind perspective|orthographic @param {{height?: number}} [opts] @returns {string} the projection in use
       */
      function setProjection(kind, opts = {}) {
        if (kind !== 'orthographic' && kind !== 'perspective') return projection();
        if (kind === projection() && !(opts.height > 0)) return kind;
        const target = controls.target.clone();
        const offset = camera.position.clone().sub(target);
        const dist = Math.max(offset.length(), 1e-3);
        const dir = offset.normalize();
        const shown = camera === ortho ? (ortho.top - ortho.bottom) / ortho.zoom : 2 * dist * Math.tan(persp.fov * Math.PI / 360);
        if (kind === 'orthographic') {
          if (!ortho) ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
          ortho.zoom = 1;
          frameOrtho(opts.height > 0 ? opts.height : shown);
          const back = Math.max(dist, focusRadius * 2);
          ortho.position.copy(target).addScaledVector(dir, back);
          ortho.near = 0.01; ortho.far = Math.max((back + focusRadius) * 4, wholeSize * 4);
          camera = ortho;
        } else {
          const d = Math.max(shown / (2 * Math.tan(persp.fov * Math.PI / 360)), 0.05);
          persp.position.copy(target).addScaledVector(dir, d);
          persp.near = Math.max(d / 1000, 0.01); persp.far = Math.max((d + focusRadius) * 20, wholeSize * 4);
          camera = persp;
        }
        camera.updateProjectionMatrix();
        camera.lookAt(target);
        controls.object = camera;
        controls.update();
        schedule();
        if (options.onProjection) options.onProjection(projection());
        return projection();
      }
      /**
       * A BCF viewpoint's camera, perspective or orthographic, in the model's own coordinates: the view goes there and turns about
       * the point ahead of it that is nearest the model. Returns false when the viewpoint has no camera.
       * @param {any} vp
       */
      function setViewpoint(vp) {
        const pc = vp && vp.perspective_camera; const oc = vp && vp.orthogonal_camera;
        const c = pc || oc;
        const xyz = (p) => { const v = p ? [Number(p.x), Number(p.y), Number(p.z)] : []; return v.length === 3 && v.every(Number.isFinite) ? v : null; };
        const at = c ? xyz(c.camera_view_point) : null; const towards = c ? xyz(c.camera_direction) : null;
        if (!at || !towards || !Math.hypot(towards[0], towards[1], towards[2])) return false;
        const pos = new THREE.Vector3().fromArray(fromIfc(meshes.coordination, at));
        const dir = new THREE.Vector3().fromArray(fromIfcDir(meshes.coordination, towards)).normalize();
        const { centre, radius } = sphereOf(null);
        const ahead = Math.max(centre.clone().sub(pos).dot(dir), radius * 0.1, 0.5);
        const target = pos.clone().addScaledVector(dir, ahead);
        controls.target.copy(target);
        if (oc) {
          camera.position.copy(pos);
          const scale = Number(oc.view_to_world_scale);
          setProjection('orthographic', { height: scale > 0 ? scale : radius * 2 });
        } else {
          if (camera === ortho) setProjection('perspective');
          const fov = Number(pc.field_of_view);
          if (fov >= 10 && fov <= 120) persp.fov = fov;
          persp.position.copy(pos);
          persp.near = Math.max(ahead / 1000, 0.01); persp.far = Math.max((ahead + radius) * 20, wholeSize * 4);
          persp.updateProjectionMatrix();
        }
        setSection(Array.isArray(vp.clipping_planes) ? vp.clipping_planes.map((c) => ({ location: xyz(c.location), direction: xyz(c.direction) })) : []);
        controls.update();
        schedule();
        return true;
      }
      /** The section as three.js planes (the side kept is where the distance is positive). @type {any[]} */
      let clipPlanes = [];
      /** The section in BCF's form, in the model's own coordinates. @type {Array<{location: number[], direction: number[]}>} */
      let section = [];
      /**
       * Cuts the view with clipping planes in BCF's form in the model's own coordinates (a section box is six of them); an empty
       * list takes the section away. Returns the number of planes.
       * @param {Array<{location: number[]|null, direction: number[]|null}>|null} list
       */
      function setSection(list) {
        const ok = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
        section = (list || []).filter((c) => c && ok(c.location) && ok(c.direction) && Math.hypot(c.direction[0], c.direction[1], c.direction[2]) > 0)
          .map((c) => ({ location: c.location.slice(), direction: c.direction.slice() }));
        clipPlanes = section.map((c) => new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3().fromArray(fromIfcDir(meshes.coordination, c.direction)).normalize().negate(),
          new THREE.Vector3().fromArray(fromIfc(meshes.coordination, c.location))));
        const planes = clipPlanes.length ? clipPlanes : null;
        for (const part of parts) part.material.clippingPlanes = planes;
        highlightMaterial.clippingPlanes = planes;
        pickMaterial.clippingPlanes = planes;
        for (const m of colorMaterials.values()) m.clippingPlanes = planes;
        schedule();
        if (options.onSection) options.onSection(section.map((c) => ({ location: c.location.slice(), direction: c.direction.slice() })));
        return section.length;
      }
      /**
       * The box of some elements (or of the model without odd ones) in the model's own coordinates, for the section's sliders.
       * @param {number[]|null} [ids] @returns {{min: number[], max: number[]}}
       */
      function boundsIfc(ids) {
        const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
        const boxes = ids && ids.length ? ids.map((id) => meshes.stats.get(id)).filter(Boolean) : [meshes.focus];
        for (const b of boxes) {
          for (let i = 0; i < 8; i++) {
            const p = toIfc(meshes.coordination, [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]]);
            for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
          }
        }
        return Number.isFinite(min[0]) ? { min, max } : { min: [-1, -1, -1], max: [1, 1, 1] };
      }
      /** @type {number[]} */
      let marked = [];
      /** Marks elements; `fit` aims the camera at them too. */
      function select(ids, opts = {}) {
        marked = (ids || []).filter((id) => meshes.byElement.has(id));
        while (highlight.children.length) { const c = highlight.children.pop(); c.geometry.dispose(); }
        const list = marked;
        if (list.length) {
          meshes.batches.forEach((b, no) => {
            const index = indexFor(meshes, no, list);
            if (!index.length) return;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', parts[no].geometry.getAttribute('position'));
            geometry.setAttribute('normal', parts[no].geometry.getAttribute('normal'));
            geometry.setIndex(new THREE.BufferAttribute(index, 1));
            highlight.add(new THREE.Mesh(geometry, highlightMaterial));
          });
        }
        if (opts.fit && list.length) fit(list); else schedule();
        return list.length;
      }
      /**
       * Colours groups of elements: [{color: '#rrggbb', ids: [...]}]. An empty list takes the colours away. Returns the
       * number of meshes drawn in colour.
       * @param {Array<{color: string, ids: number[]}>} groups
       */
      function setColors(groups) {
        while (colored.children.length) { const c = colored.children.pop(); c.geometry.dispose(); }
        for (const g of groups || []) {
          const ids = (g.ids || []).filter((id) => meshes.byElement.has(id));
          if (!ids.length || !g.color) continue;
          let material = colorMaterials.get(g.color);
          if (!material) {
            material = new THREE.MeshLambertMaterial({ color: new THREE.Color(g.color), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, clippingPlanes: clipPlanes.length ? clipPlanes : null });
            colorMaterials.set(g.color, material);
          }
          meshes.batches.forEach((b, no) => {
            const index = indexFor(meshes, no, ids);
            if (!index.length) return;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', parts[no].geometry.getAttribute('position'));
            geometry.setAttribute('normal', parts[no].geometry.getAttribute('normal'));
            geometry.setIndex(new THREE.BufferAttribute(index, 1));
            colored.add(new THREE.Mesh(geometry, material));
          });
        }
        schedule();
        return colored.children.length;
      }
      /** Shows only these elements (null = all). */
      function setVisible(ids) {
        visibleIds = ids ? ids.slice() : null;
        meshes.batches.forEach((b, no) => {
          const index = ids ? indexFor(meshes, no, ids) : b.index;
          parts[no].geometry.setIndex(new THREE.BufferAttribute(index, 1));
        });
        schedule();
      }
      /** The element under a point of the canvas (CSS pixels from its top left), or null. */
      function pickAt(x, y) {
        const ratio = renderer.getPixelRatio();
        const w = canvas.width; const h = canvas.height;
        const previous = camera.view ? Object.assign({}, camera.view) : null;
        camera.setViewOffset(w, h, Math.round(x * ratio), Math.round(y * ratio), 1, 1);
        const background = renderer.getRenderTarget();
        renderer.setRenderTarget(pickTarget);
        renderer.render(pickScene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(pickTarget, 0, 0, 1, 1, pixel);
        renderer.setRenderTarget(background);
        camera.clearViewOffset();
        if (previous && previous.enabled) camera.setViewOffset(previous.fullWidth, previous.fullHeight, previous.offsetX, previous.offsetY, previous.width, previous.height);
        const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
        return id || null;
      }
      const raycaster = new THREE.Raycaster();
      /** Where a ray through a point of the canvas meets an element, against the element's own triangles; null when it misses. */
      function pointAt(x, y, id) {
        const list = meshes.byElement.get(id);
        if (!list) return null;
        raycaster.setFromCamera(new THREE.Vector2(x / width() * 2 - 1, 1 - y / height() * 2), camera);
        const ray = raycaster.ray;
        const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3(); const hit = new THREE.Vector3();
        let best = Infinity; let point = null;
        for (let i = 0; i < list.length; i += 3) {
          const batch = meshes.batches[list[i]]; const pos = batch.positions; const index = batch.index;
          for (let k = list[i + 1], end = list[i + 1] + list[i + 2]; k < end; k += 3) {
            a.fromArray(pos, index[k] * 3); b.fromArray(pos, index[k + 1] * 3); c.fromArray(pos, index[k + 2] * 3);
            if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
            if (clipPlanes.some((pl) => pl.distanceToPoint(hit) < 0)) continue;
            const d = hit.distanceToSquared(ray.origin);
            if (d < best) { best = d; point = hit.clone(); }
          }
        }
        return point;
      }
      /** The point under a point of the canvas becomes the centre the view turns about (a double click). Returns the element or null. */
      function pivotAt(x, y) {
        const id = pickAt(x, y);
        const p = id ? pointAt(x, y, id) : null;
        if (!p) return null;
        controls.target.copy(p);
        controls.update();
        schedule();
        return id;
      }
      // A click that did not drag selects what is under the pointer.
      let downAt = null;
      const onDown = (ev) => { downAt = [ev.clientX, ev.clientY]; };
      const onUp = (ev) => {
        if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 4) { downAt = null; return; }
        downAt = null;
        const box = canvas.getBoundingClientRect();
        const id = pickAt(ev.clientX - box.left, ev.clientY - box.top);
        select(id ? [id] : []);
        if (options.onSelect) options.onSelect(id);
      };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup', onUp);
      // An interactive view: a double click sets the centre to turn about, and the keys move the camera while the view has focus.
      const onDouble = (ev) => { const box = canvas.getBoundingClientRect(); pivotAt(ev.clientX - box.left, ev.clientY - box.top); };
      const onKey = (ev) => {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const k = ev.key;
        let done = true;
        if (k === '+' || k === '=') controls.dollyIn(0.8);
        else if (k === '-' || k === '_') controls.dollyOut(0.8);
        else if (k === 'f' || k === 'F') fit(marked.length ? marked : null);
        else if (k === 'Home') fit();
        else if (k === 'o' || k === 'O') setProjection(projection() === 'orthographic' ? 'perspective' : 'orthographic');
        else if (/^[1-7]$/.test(k)) standardView(VIEW_ORDER[Number(k) - 1]);
        else done = false;
        if (done) { ev.preventDefault(); ev.stopPropagation(); schedule(); }
      };
      if (options.navigation) {
        canvas.tabIndex = 0;
        if (options.label) canvas.setAttribute('aria-label', options.label);
        controls.listenToKeyEvents(canvas);
        canvas.addEventListener('keydown', onKey);
        canvas.addEventListener('dblclick', onDouble);
      }
      function resize() {
        if (destroyed) return;
        persp.aspect = width() / height();
        persp.updateProjectionMatrix();
        if (ortho) frameOrtho(ortho.top - ortho.bottom);
        renderer.setSize(width(), height());
        draw();
      }
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
      if (observer) observer.observe(container);

      if (def.view && def.view.position) {
        camera.position.fromArray(def.view.position);
        controls.target.fromArray(def.view.target);
        camera.near = def.view.near || camera.near; camera.far = def.view.far || camera.far;
        camera.updateProjectionMatrix();
        controls.update();
        if (def.view.projection === 'orthographic') setProjection('orthographic', { height: Number(def.view.height) || 0 });
        if (Array.isArray(def.view.section) && def.view.section.length) setSection(def.view.section);
      } else fit();
      if (Array.isArray(def.visible)) setVisible(def.visible);
      if (Array.isArray(def.selected) && def.selected.length) select(def.selected);
      if (Array.isArray(def.colors) && def.colors.length) setColors(def.colors);
      draw();

      return {
        kind: 'model',
        info: { elements: meshes.elements, triangles: meshes.triangles, colors: meshes.batches.length },
        meshes, renderer, scene,
        /** The camera in use. */
        get camera() { return camera; },
        fit, select, setVisible, setColors, pickAt, pointAt, pivotAt, resize, redraw: draw,
        standardView, setProjection, projection, setViewpoint, setSection, boundsIfc,
        /** The section in BCF's form (empty without one). */
        section: () => section.map((c) => ({ location: c.location.slice(), direction: c.direction.slice() })),
        /** Calls fn with the camera after each drawing (the view cube follows it); returns the function that stops it. */
        onView(fn) { viewListeners.add(fn); fn(camera); return () => viewListeners.delete(fn); },
        marked: () => marked.slice(),
        view: () => {
          const v = { position: camera.position.toArray(), target: controls.target.toArray(), near: camera.near, far: camera.far, projection: projection() };
          if (camera === ortho) v.height = (ortho.top - ortho.bottom) / ortho.zoom;
          if (section.length) v.section = section.map((c) => ({ location: c.location.slice(), direction: c.direction.slice() }));
          return v;
        },
        /** A point of the view in the model's own coordinates (Z up, not moved to the origin), as BCF and other tools use them. */
        toIfc: (p) => toIfc(meshes.coordination, p),
        /** The current picture as a PNG data URL. */
        png: () => { draw(); return canvas.toDataURL('image/png'); },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          for (const m of colorMaterials.values()) m.dispose();
          while (colored.children.length) { const c = colored.children.pop(); c.geometry.dispose(); }
          if (observer) observer.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          canvas.removeEventListener('pointerup', onUp);
          canvas.removeEventListener('keydown', onKey);
          canvas.removeEventListener('dblclick', onDouble);
          viewListeners.clear();
          controls.dispose();
          while (highlight.children.length) highlight.children.pop().geometry.dispose();
          for (const p of parts) { p.geometry.dispose(); p.material.dispose(); }
          highlightMaterial.dispose(); pickMaterial.dispose(); pickTarget.dispose();
          renderer.dispose();
          canvas.remove();
        },
      };
    }

    /**
     * A picture of a model without showing it: PNG, or SVG and PDF around the same picture.
     * @param {{datasetId: string, model?: any}} chart @param {string} format png|svg|pdf @param {{width?: number, height?: number}} [opts]
     */
    async function toBlob(chart, format, opts = {}) {
      const width = opts.width || 1200; const height = opts.height || 750;
      const def = chart.model || {};
      const id = def.datasetId || chart.datasetId;
      if (model.isDxf(await datasets.get(id))) {
        const text = await drawingSvg(id, def, width, height);
        if (format === 'png') return vizExport.svgToPng(text, { scale: opts.scale || 1 });
        if (format === 'pdf') return vizExport.svgToPdf(text, { title: chart.name });
        return new Blob([text], { type: 'image/svg+xml' });
      }
      const url = await pictureOf(chart, width, height, opts);
      if (format === 'svg') return new Blob([svgAround(url, width, height)], { type: 'image/svg+xml' });
      if (format === 'pdf') return vizExport.svgToPdf(svgAround(url, width, height), { title: chart.name });
      const bytes = Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
      return new Blob([bytes], { type: 'image/png' });
    }
    /** A DXF drawing as a standalone SVG: its size, a background, and only the chosen layers. */
    async function drawingSvg(id, def, width, height) {
      const text = await model.drawing(id);
      if (!text) throw new Error(D.t('model.err.nofile'));
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.documentElement;
      svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
      const hidden = new Set(def.hiddenLayers || []);
      const only = def.filter && def.filter.lager ? def.filter.lager : '';
      for (const g of Array.from(svg.querySelectorAll('[data-layer]'))) {
        const name = g.getAttribute('data-layer');
        if (hidden.has(name) || (only && only !== name)) g.remove();
      }
      const box = String(svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/);
      const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', box[0]); rect.setAttribute('y', box[1]); rect.setAttribute('width', box[2]); rect.setAttribute('height', box[3]);
      rect.setAttribute('fill', '#ffffff'); rect.setAttribute('stroke', 'none');
      svg.insertBefore(rect, svg.firstChild);
      svg.setAttribute('color', '#000000');
      return new XMLSerializer().serializeToString(svg);
    }
    /** The elements a batch group or a shared filter leaves, or null when nothing narrows them. */
    async function visibleFor(chart, def, options) {
      const filters = options.extraFilters || [];
      if (!filters.length) return def.visible || null;
      const handle = await datasets.ensureOpen(def.datasetId || chart.datasetId);
      const known = filters.filter((f) => handle.columns.some((c) => c.name === f.field) && f.op === '=');
      if (!known.length) return def.visible || null;
      const where = known.map((f) => `"${String(f.field).replace(/"/g, '""')}" = ?`).join(' and ');
      const r = await handle.engine.exec(`select id from data where ${where}`, known.map((f) => f.value));
      const ids = (r[0] ? r[0].values : []).map((row) => Number(row[0]));
      return def.visible ? ids.filter((x) => def.visible.includes(x)) : ids;
    }
    async function pictureOf(chart, width, height, options = {}) {
      const host = document.createElement('div');
      host.style.cssText = `position:absolute;left:-20000px;top:0;width:${width}px;height:${height}px;`;
      document.body.appendChild(host);
      try {
        const def = chart.model || {};
        const hd = await render(host, { datasetId: def.datasetId || chart.datasetId, visible: await visibleFor(chart, def, options), view: def.view || null, colors: def.colors || null }, { preserve: true, width, height });
        const url = hd.png();
        hd.destroy();
        return url;
      } finally { host.remove(); }
    }
    const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    function svgAround(url, width, height) {
      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" xlink:href="${url}"/></svg>`;
    }
    /** The picture as an inline image for dashboards and published pages (no WebGL or data in the page). */
    async function htmlFor(_id, chart, opts = {}) {
      const width = opts.width || 1000; const height = opts.height || 625;
      const def = chart.model || {};
      if (model.isDxf(await datasets.get(def.datasetId || chart.datasetId))) return drawingSvg(def.datasetId || chart.datasetId, def, width, height);
      const url = await pictureOf(chart, width, height, opts);
      const legend = Array.isArray(def.legend) && def.legend.length
        ? `<p style="font-size:0.85em;margin:0.4em 0 0">${def.legend.map((l) => `<span style="display:inline-block;width:0.8em;height:0.8em;border-radius:2px;background:${escapeHtml(l.color)};vertical-align:middle;margin-right:0.3em"></span>${escapeHtml(l.status || '')} (${Number(l.n) || 0})`).join(' &nbsp; ')}</p>`
        : '';
      return `<img src="${url}" alt="" width="${width}" height="${height}" style="max-width:100%;height:auto">${legend}`;
    }

    return { ensureThree, meshesOf, clearCache, render, toBlob, htmlFor, drawingSvg, toIfc, fromIfc, fromIfcDir, VIEWS, VIEW_ORDER, boxPlanes, boxOfPlanes };
  });
})();
