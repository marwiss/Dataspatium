// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Image collections as datasets (kind "images"): one row per picture with file name, type, size, pixel size,
 * EXIF date, camera, position and description. A preview (long side at most 1600 px) and a thumbnail (320 px)
 * are kept in the dataset (data/dataset-files); the originals are not stored, so a collection stays small enough
 * for the browser. EXIF is read with data/exif; sizes and the scaled copies come from createImageBitmap.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/images', ['data/dataset-files', 'data/exif'], (dsFiles, exif) => {
    const EXT = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
    const PREVIEW = 1600;
    const THUMB = 320;
    const COLUMNS = [
      { name: 'fil', type: 'text' }, { name: 'typ', type: 'text' }, { name: 'storlek', type: 'integer' }, { name: 'bredd', type: 'integer' }, { name: 'hojd', type: 'integer' },
      { name: 'datum', type: 'datetime' }, { name: 'kamera', type: 'text' }, { name: 'lon', type: 'number' }, { name: 'lat', type: 'number' }, { name: 'altitud', type: 'number' }, { name: 'beskrivning', type: 'text' },
    ];
    /** @type {WeakMap<File, any>} */
    const cache = new WeakMap();

    function detect(file) { return EXT.test(file.name) || /^image\//.test(file.type || ''); }

    function canvasFor(w, h) {
      if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
      const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    async function toBytes(canvas, type, quality) {
      const blob = typeof canvas.convertToBlob === 'function'
        ? await canvas.convertToBlob({ type, quality })
        : await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      return new Uint8Array(await blob.arrayBuffer());
    }
    /** A scaled copy with the long side at most `max` pixels. */
    async function scaled(bitmap, max, type, quality) {
      const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * ratio)); const h = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = canvasFor(w, h);
      const ctx = canvas.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(bitmap, 0, 0, w, h);
      return { bytes: await toBytes(canvas, type, quality), width: w, height: h, type };
    }

    /**
     * Read one image: size, EXIF, preview and thumbnail (cached per File object).
     * @param {File} file
     */
    async function readImage(file) {
      const cached = cache.get(file);
      if (cached) return cached;
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8;
      const ex = isJpeg ? exif.parse(bytes) : null;
      const mime = file.type || (isJpeg ? 'image/jpeg' : 'application/octet-stream');
      let bitmap;
      try { bitmap = await createImageBitmap(new Blob([buf], { type: mime })); }
      catch (err) { throw new Error(D.t('import.err.image', { name: file.name })); }
      try {
        const keepsAlpha = /png|webp|gif/.test(mime);
        const previewType = keepsAlpha ? 'image/png' : 'image/jpeg';
        const preview = Math.max(bitmap.width, bitmap.height) > PREVIEW || !/jpeg|png|webp/.test(mime)
          ? await scaled(bitmap, PREVIEW, previewType, 0.85)
          : { bytes, width: bitmap.width, height: bitmap.height, type: mime };
        const thumb = await scaled(bitmap, THUMB, previewType, 0.8);
        const result = {
          name: file.name, type: mime, size: file.size, width: bitmap.width, height: bitmap.height, exif: ex, preview, thumb,
          row: [file.name, mime.replace(/^image\//, ''), file.size, bitmap.width, bitmap.height,
            ex ? (ex.dateTimeOriginal || ex.dateTime) : null, ex && (ex.make || ex.model) ? [ex.make, ex.model].filter(Boolean).join(' ') : null,
            ex && typeof ex.lon === 'number' ? ex.lon : null, ex && typeof ex.lat === 'number' ? ex.lat : null, ex && typeof ex.altitude === 'number' ? ex.altitude : null,
            ex ? ex.description : null],
        };
        cache.set(file, result);
        return result;
      } finally { try { bitmap.close(); } catch (_err) { /* ignore */ } }
    }

    async function preview(file) {
      const img = await readImage(file);
      return { columns: COLUMNS.map((c) => c.name), dataRows: [img.row], header: true, declaredTypes: COLUMNS.map((c) => c.type), meta: { format: 'images' }, totalRows: 1 };
    }
    async function parse(file) {
      const img = await readImage(file);
      return { columns: COLUMNS.map((c) => c.name), rows: [img.row], meta: { format: 'images' } };
    }

    /**
     * One dataset (kind images) from the files: metadata rows, previews and thumbnails in `_files`.
     * @param {File[]} files @param {any} options @param {string} [name] @param {Function} [progress]
     */
    async function importFiles(files, options = {}, name, progress) {
      const images = [];
      const skipped = [];
      for (let i = 0; i < files.length; i++) {
        if (progress) progress({ file: files[i].name, index: i, total: files.length });
        try { images.push(await readImage(files[i])); }
        catch (err) { skipped.push({ name: files[i].name, error: (err && err.message) || String(err) }); }
      }
      if (!images.length) throw new Error(skipped.length ? skipped[0].error : D.t('import.err.empty'));
      const baseName = D.require('io/import').baseName;
      const datasetName = name || (files.length === 1 ? baseName(files[0].name) : D.t('import.collection.images', { n: files.length }));
      const fileRows = [];
      for (const img of images) {
        fileRows.push({ name: img.name, kind: 'preview', type: img.preview.type, bytes: img.preview.bytes });
        fileRows.push({ name: img.name, kind: 'thumb', type: img.thumb.type, bytes: img.thumb.bytes });
      }
      return dsFiles.createDataset({
        name: datasetName, kind: 'images', columns: COLUMNS, rows: images.map((img) => img.row), files: fileRows,
        source: { kind: 'files', format: 'images', files: images.map((img) => ({ name: img.name, size: img.size, type: img.type })), skipped },
        meta: { images: { count: images.length, preview: PREVIEW, thumb: THUMB, skipped } },
        importOptions: Object.assign({}, options, { format: 'images' }),
      });
    }

    return { id: 'images', kind: 'images', collection: true, detect, accepts: detect, preview, parse, readImage, importFiles, scaled, COLUMNS, PREVIEW, THUMB };
  });
})();
