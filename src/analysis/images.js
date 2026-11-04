// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Image analysis without code for image datasets (kind "images"): an overview by type, camera and date, and
 * near-duplicate detection with an 8×8 average hash (aHash) computed from the stored thumbnails. The hashing
 * uses a canvas and runs on the main thread in small steps; a collection of a few thousand pictures takes seconds.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/images', [], () => {
    const SIZE = 8;
    const BIT_COUNT = new Uint8Array(16).map((_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));

    /** The 64-bit hash of 64 grey values as 16 hex digits: a bit is set where the pixel is brighter than the mean. */
    function hashOfGray(gray) {
      let sum = 0; for (let i = 0; i < 64; i++) sum += gray[i];
      const mean = sum / 64;
      let hex = '';
      for (let n = 0; n < 16; n++) {
        let nibble = 0;
        for (let b = 0; b < 4; b++) if (gray[n * 4 + b] > mean) nibble |= 1 << (3 - b);
        hex += nibble.toString(16);
      }
      return hex;
    }
    function canvasFor() {
      if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(SIZE, SIZE);
      const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE; return c;
    }
    /**
     * Average hash of an image: an ImageBitmap, a canvas or a Blob of image bytes.
     * @param {any} source
     * @returns {Promise<string>}
     */
    async function aHash(source) {
      const own = !(typeof ImageBitmap === 'function' && source instanceof ImageBitmap) && !(source && typeof source.getContext === 'function');
      const bmp = own ? await createImageBitmap(source) : source;
      try {
        const canvas = canvasFor();
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.drawImage(bmp, 0, 0, SIZE, SIZE);
        const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const gray = new Float32Array(64);
        for (let i = 0; i < 64; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
        return hashOfGray(gray);
      } finally { if (own && bmp && typeof bmp.close === 'function') bmp.close(); }
    }
    /** Number of differing bits between two hashes (0 = identical, 64 = opposite). */
    function hamming(a, b) {
      let d = 0;
      for (let i = 0; i < 16; i++) d += BIT_COUNT[(parseInt(a[i] || '0', 16) ^ parseInt(b[i] || '0', 16)) & 15];
      return d;
    }
    /**
     * Groups of pictures whose hashes lie within `maxDistance` bits of the group's first picture.
     * @param {Array<{name: string, hash: string}>} items @param {number} [maxDistance]
     * @returns {Array<Array<{name: string, hash: string, distance: number}>>} groups with two or more pictures
     */
    function groupDuplicates(items, maxDistance = 5) {
      const groups = []; const used = new Set();
      for (let i = 0; i < items.length; i++) {
        if (used.has(i)) continue;
        const group = [Object.assign({ distance: 0 }, items[i])];
        for (let j = i + 1; j < items.length; j++) {
          if (used.has(j)) continue;
          const d = hamming(items[i].hash, items[j].hash);
          if (d <= maxDistance) { used.add(j); group.push(Object.assign({ distance: d }, items[j])); }
        }
        if (group.length > 1) { used.add(i); groups.push(group); }
      }
      return groups;
    }
    const countBy = (rows, key) => {
      const m = new Map();
      for (const r of rows) { const k = key(r); if (k === null || k === undefined || k === '') continue; m.set(k, (m.get(k) || 0) + 1); }
      return Array.from(m, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
    };
    /**
     * Overview of an image dataset from its rows.
     * @param {any[][]} rows @param {{typeIndex: number, sizeIndex: number, widthIndex: number, heightIndex: number, dateIndex: number, cameraIndex: number, lonIndex: number, latIndex: number}} idx
     */
    function summarize(rows, idx) {
      const bytes = rows.reduce((n, r) => n + (Number(r[idx.sizeIndex]) || 0), 0);
      const pixels = rows.reduce((n, r) => n + (Number(r[idx.widthIndex]) || 0) * (Number(r[idx.heightIndex]) || 0), 0);
      const dates = rows.map((r) => String(r[idx.dateIndex] || '')).filter(Boolean).sort();
      return {
        count: rows.length, bytes, pixels,
        withDate: dates.length, withCamera: rows.filter((r) => r[idx.cameraIndex]).length, withPosition: rows.filter((r) => typeof r[idx.lonIndex] === 'number' && typeof r[idx.latIndex] === 'number').length,
        first: dates[0] || null, last: dates[dates.length - 1] || null,
        byType: countBy(rows, (r) => r[idx.typeIndex]), byCamera: countBy(rows, (r) => r[idx.cameraIndex]),
        byYear: countBy(rows, (r) => (r[idx.dateIndex] ? String(r[idx.dateIndex]).slice(0, 4) : null)), byMonth: countBy(rows, (r) => (r[idx.dateIndex] ? String(r[idx.dateIndex]).slice(0, 7) : null)),
        largest: rows.slice().sort((a, b) => (Number(b[idx.sizeIndex]) || 0) - (Number(a[idx.sizeIndex]) || 0)).slice(0, 10),
      };
    }
    /** Column positions of an image dataset by name, with the fixed positions as fallback. */
    function indexes(columns) {
      const find = (name, fallback) => { const i = columns.findIndex((c) => c.name === name); return i >= 0 ? i : fallback; };
      return { fileIndex: find('fil', 0), typeIndex: find('typ', 1), sizeIndex: find('storlek', 2), widthIndex: find('bredd', 3), heightIndex: find('hojd', 4), dateIndex: find('datum', 5), cameraIndex: find('kamera', 6), lonIndex: find('lon', 7), latIndex: find('lat', 8), altIndex: find('altitud', 9), descIndex: find('beskrivning', 10) };
    }

    return { aHash, hashOfGray, hamming, groupDuplicates, summarize, indexes, SIZE };
  });
})();
