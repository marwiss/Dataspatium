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
     * The meshes of a model dataset, computed once per version of the dataset.
     * @param {string} datasetId @param {{onProgress?: (elements: number) => void}} [options]
     */
    async function meshesOf(datasetId, options = {}) {
      const meta = await datasets.get(datasetId);
      if (!meta) throw new Error(D.t('err.dataset.gone'));
      const key = datasetId + '|' + meta.updatedAt;
      if (cache && cache.key === key) return cache.meshes;
      const file = await model.original(datasetId);
      if (!file) throw new Error(D.t('model.err.nofile'));
      const meshes = ifc.meshes(file.bytes, { onProgress: options.onProgress }).then((m) => { ifc.release(); return indexed(m); });
      cache = { key, meshes };
      meshes.catch(() => { if (cache && cache.key === key) cache = null; });
      return meshes;
    }
    /** Forget the kept meshes (the dataset was removed, or memory is needed). */
    function clearCache() { cache = null; ifc.terminate(); }

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
     * @param {{datasetId: string, visible?: number[]|null, selected?: number[], view?: any, colors?: Array<{color: string, ids: number[]}>|null}} def
     * @param {{onSelect?: (id: number|null) => void, onProgress?: (elements: number) => void}} [options]
     * @returns {Promise<any>} handle: info, select(ids, {fit}), setVisible(ids), fit(ids), view(), png(scale), resize(), destroy()
     */
    async function render(container, def, options = {}) {
      const THREE = await ensureThree();
      const meshes = await meshesOf(def.datasetId, { onProgress: options.onProgress });
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!options.preserve });
      } catch (_err) { throw new Error(D.t('model.err.webgl')); }
      const tk = theme.tokens();
      const width = () => Math.max(1, container.clientWidth || options.width || 800);
      const height = () => Math.max(1, container.clientHeight || options.height || 500);
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
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
      const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 1000);
      const controls = new controlsLib.OrbitControls(camera, canvas);
      controls.enableDamping = false;

      const pickScene = new THREE.Scene();
      pickScene.background = new THREE.Color(0, 0, 0);
      const pickMaterial = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        vertexShader: 'attribute vec3 pickColor; varying vec3 vPick; void main() { vPick = pickColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'varying vec3 vPick; void main() { gl_FragColor = vec4(vPick, 1.0); }',
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
      const draw = () => { if (!destroyed) renderer.render(scene, camera); };
      const schedule = () => { if (scheduled || destroyed) return; scheduled = true; requestAnimationFrame(() => { scheduled = false; draw(); }); };
      controls.addEventListener('change', schedule);

      /** Aims the camera at the whole model, or at some elements. */
      function fit(ids) {
        const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
        const take = (s) => { for (let k = 0; k < 3; k++) { if (s.min[k] < min[k]) min[k] = s.min[k]; if (s.max[k] > max[k]) max[k] = s.max[k]; } };
        if (ids && ids.length) for (const id of ids) { const s = meshes.stats.get(id); if (s) take(s); }
        if (!Number.isFinite(min[0])) take(meshes.focus);
        if (!Number.isFinite(min[0])) { min[0] = min[1] = min[2] = -1; max[0] = max[1] = max[2] = 1; }
        const centre = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
        const radius = Math.max(0.5, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
        const distance = radius / Math.sin((camera.fov * Math.PI / 180) / 2) * (camera.aspect < 1 ? 1.1 / camera.aspect : 1.05);
        camera.near = Math.max(radius / 1000, 0.01);
        camera.far = Math.max((distance + radius) * 20, Math.hypot(meshes.box.max[0] - meshes.box.min[0], meshes.box.max[1] - meshes.box.min[1], meshes.box.max[2] - meshes.box.min[2]) * 4);
        camera.position.set(centre.x + distance * 0.6, centre.y + distance * 0.5, centre.z + distance * 0.62);
        camera.updateProjectionMatrix();
        controls.target.copy(centre);
        controls.update();
        schedule();
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
            material = new THREE.MeshLambertMaterial({ color: new THREE.Color(g.color), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
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
      function resize() {
        if (destroyed) return;
        camera.aspect = width() / height();
        camera.updateProjectionMatrix();
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
      } else fit();
      if (Array.isArray(def.visible)) setVisible(def.visible);
      if (Array.isArray(def.selected) && def.selected.length) select(def.selected);
      if (Array.isArray(def.colors) && def.colors.length) setColors(def.colors);
      draw();

      return {
        kind: 'model',
        info: { elements: meshes.elements, triangles: meshes.triangles, colors: meshes.batches.length },
        meshes, renderer, scene, camera,
        fit, select, setVisible, setColors, pickAt, resize, redraw: draw,
        marked: () => marked.slice(),
        view: () => ({ position: camera.position.toArray(), target: controls.target.toArray(), near: camera.near, far: camera.far }),
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

    return { ensureThree, meshesOf, clearCache, render, toBlob, htmlFor, drawingSvg, toIfc };
  });
})();
