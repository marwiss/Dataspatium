// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * EXIF for JPEG files, without a library: the APP1 segment holds a TIFF structure with IFD0 (camera, orientation,
 * date), the Exif IFD (original date, pixel size) and the GPS IFD (position, altitude). `parse` reads what image
 * collections need; `buildApp1`/`insertApp1` write a minimal segment (tests, and later exports).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/exif', [], () => {
    const TAGS = { 0x010E: 'description', 0x010F: 'make', 0x0110: 'model', 0x0112: 'orientation', 0x0132: 'dateTime', 0x8769: 'exifIfd', 0x8825: 'gpsIfd', 0x9003: 'dateTimeOriginal', 0x9004: 'dateTimeDigitized', 0xA002: 'pixelWidth', 0xA003: 'pixelHeight' };
    const GPS = { 0x0001: 'latRef', 0x0002: 'lat', 0x0003: 'lonRef', 0x0004: 'lon', 0x0005: 'altRef', 0x0006: 'alt', 0x001D: 'dateStamp' };
    const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

    /** "2024:06:01 12:30:00" -> "2024-06-01 12:30:00" (the app's datetime text). */
    function isoDate(s) {
      const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || '').trim());
      return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : null;
    }
    const dms = (v, ref) => (Array.isArray(v) && v.length >= 3 ? (v[0] + v[1] / 60 + v[2] / 3600) * (/[SW]/i.test(ref || '') ? -1 : 1) : null);

    /**
     * Read the EXIF fields of a JPEG. Returns null when there is no EXIF segment.
     * @param {ArrayBuffer|Uint8Array} input
     * @returns {{dateTime?: string|null, dateTimeOriginal?: string|null, make?: string|null, model?: string|null, orientation?: number|null, description?: string|null, lat?: number|null, lon?: number|null, altitude?: number|null, pixelWidth?: number|null, pixelHeight?: number|null}|null}
     */
    function parse(input) {
      const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
      if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
      let offset = 2;
      while (offset + 4 <= bytes.length && bytes[offset] === 0xFF) {
        const marker = bytes[offset + 1];
        if (marker === 0xDA || marker === 0xD9) break;
        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (marker === 0xE1 && length > 8 && String.fromCharCode(...bytes.subarray(offset + 4, offset + 10)) === 'Exif\0\0') {
          return parseTiff(bytes.subarray(offset + 10, offset + 2 + length));
        }
        offset += 2 + length;
      }
      return null;
    }

    function parseTiff(tiff) {
      const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
      const little = tiff[0] === 0x49 && tiff[1] === 0x49;
      if (!little && !(tiff[0] === 0x4D && tiff[1] === 0x4D)) return null;
      if (view.getUint16(2, little) !== 42) return null;
      const out = {};
      const readIfd = (start, names, target) => {
        if (start < 0 || start + 2 > tiff.byteLength) return;
        const count = view.getUint16(start, little);
        for (let i = 0; i < count; i++) {
          const e = start + 2 + i * 12;
          if (e + 12 > tiff.byteLength) break;
          const tag = view.getUint16(e, little); const type = view.getUint16(e + 2, little); const n = view.getUint32(e + 4, little);
          const name = names[tag];
          if (!name) continue;
          const size = (SIZES[type] || 1) * n;
          const at = size <= 4 ? e + 8 : view.getUint32(e + 8, little);
          if (at + size > tiff.byteLength) continue;
          target[name] = readValue(view, tiff, at, type, n, little);
        }
      };
      readIfd(view.getUint32(4, little), TAGS, out);
      if (typeof out.exifIfd === 'number') readIfd(out.exifIfd, TAGS, out);
      const gps = {};
      if (typeof out.gpsIfd === 'number') readIfd(out.gpsIfd, GPS, gps);
      delete out.exifIfd; delete out.gpsIfd;
      const result = {
        dateTime: isoDate(out.dateTime), dateTimeOriginal: isoDate(out.dateTimeOriginal || out.dateTimeDigitized),
        make: out.make ? String(out.make).trim() : null, model: out.model ? String(out.model).trim() : null,
        orientation: typeof out.orientation === 'number' ? out.orientation : null,
        description: out.description ? String(out.description).trim() : null,
        pixelWidth: typeof out.pixelWidth === 'number' ? out.pixelWidth : null, pixelHeight: typeof out.pixelHeight === 'number' ? out.pixelHeight : null,
        lat: dms(gps.lat, gps.latRef), lon: dms(gps.lon, gps.lonRef),
        altitude: typeof gps.alt === 'number' ? (gps.altRef === 1 ? -gps.alt : gps.alt) : null,
      };
      return result;
    }

    function readValue(view, tiff, at, type, n, little) {
      if (type === 2) {
        // ASCII by the standard, but cameras and editors write UTF-8 or Latin-1; try UTF-8 first.
        let end = at; while (end < at + n && tiff[end] !== 0) end++;
        const raw = tiff.subarray(at, end);
        try { return new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (_err) { return new TextDecoder('windows-1252').decode(raw); }
      }
      const one = (i) => {
        switch (type) {
          case 1: case 7: return tiff[at + i];
          case 3: return view.getUint16(at + i * 2, little);
          case 4: return view.getUint32(at + i * 4, little);
          case 9: return view.getInt32(at + i * 4, little);
          case 5: { const num = view.getUint32(at + i * 8, little); const den = view.getUint32(at + i * 8 + 4, little); return den ? num / den : 0; }
          case 10: { const num = view.getInt32(at + i * 8, little); const den = view.getInt32(at + i * 8 + 4, little); return den ? num / den : 0; }
          default: return null;
        }
      };
      if (n === 1) return one(0);
      const arr = []; for (let i = 0; i < n; i++) arr.push(one(i));
      return arr;
    }

    /**
     * A minimal APP1 Exif segment (little-endian TIFF) with the given fields, as bytes including the marker.
     * @param {{dateTimeOriginal?: string, make?: string, model?: string, description?: string, lat?: number, lon?: number, altitude?: number}} f
     */
    function buildApp1(f) {
      const enc = new TextEncoder();
      const ascii = (s) => { const b = enc.encode(String(s)); const out = new Uint8Array(b.length + 1); out.set(b); return out; };
      const toExif = (iso) => String(iso).replace(/^(\d{4})-(\d{2})-(\d{2})[ T]/, '$1:$2:$3 ').slice(0, 19);
      const rationals = (vals) => { const b = new Uint8Array(vals.length * 8); const v = new DataView(b.buffer); vals.forEach(([num, den], i) => { v.setUint32(i * 8, num, true); v.setUint32(i * 8 + 4, den, true); }); return b; };
      const dmsOf = (deg) => { const a = Math.abs(deg); const d = Math.floor(a); const m = Math.floor((a - d) * 60); const s = Math.round(((a - d) * 60 - m) * 60 * 10000); return [[d, 1], [m, 1], [s, 10000]]; };
      // Entries: {tag, type, count, data (Uint8Array) or value (number)}
      const ifd0 = []; const exifIfd = []; const gpsIfd = [];
      if (f.description) ifd0.push({ tag: 0x010E, type: 2, data: ascii(f.description) });
      if (f.make) ifd0.push({ tag: 0x010F, type: 2, data: ascii(f.make) });
      if (f.model) ifd0.push({ tag: 0x0110, type: 2, data: ascii(f.model) });
      if (f.dateTimeOriginal) { ifd0.push({ tag: 0x0132, type: 2, data: ascii(toExif(f.dateTimeOriginal)) }); exifIfd.push({ tag: 0x9003, type: 2, data: ascii(toExif(f.dateTimeOriginal)) }); }
      if (typeof f.lat === 'number' && typeof f.lon === 'number') {
        gpsIfd.push({ tag: 0x0001, type: 2, data: ascii(f.lat < 0 ? 'S' : 'N') }, { tag: 0x0002, type: 5, data: rationals(dmsOf(f.lat)), count: 3 }, { tag: 0x0003, type: 2, data: ascii(f.lon < 0 ? 'W' : 'E') }, { tag: 0x0004, type: 5, data: rationals(dmsOf(f.lon)), count: 3 });
        if (typeof f.altitude === 'number') gpsIfd.push({ tag: 0x0005, type: 1, value: f.altitude < 0 ? 1 : 0 }, { tag: 0x0006, type: 5, data: rationals([[Math.round(Math.abs(f.altitude) * 100), 100]]), count: 1 });
      }
      // Layout: header (8) | IFD0 | Exif IFD | GPS IFD | data area. Pointers are filled once sizes are known.
      const ifdSize = (list) => 2 + list.length * 12 + 4;
      const pointerCount = (exifIfd.length ? 1 : 0) + (gpsIfd.length ? 1 : 0);
      const ifd0Start = 8; const ifd0Size = 2 + (ifd0.length + pointerCount) * 12 + 4;
      const exifStart = ifd0Start + ifd0Size; const exifSize = exifIfd.length ? ifdSize(exifIfd) : 0;
      const gpsStart = exifStart + exifSize; const gpsSize = gpsIfd.length ? ifdSize(gpsIfd) : 0;
      let dataAt = gpsStart + gpsSize;
      const blobs = [];
      const place = (e) => { const bytes = e.data; if (!bytes) return; e.count = e.count || (e.type === 2 ? bytes.length : 1); if (bytes.length <= 4) return; e.offset = dataAt; blobs.push({ at: dataAt, bytes }); dataAt += bytes.length + (bytes.length % 2); };
      for (const list of [ifd0, exifIfd, gpsIfd]) for (const e of list) place(e);
      const total = dataAt;
      const tiff = new Uint8Array(total); const view = new DataView(tiff.buffer);
      tiff[0] = 0x49; tiff[1] = 0x49; view.setUint16(2, 42, true); view.setUint32(4, ifd0Start, true);
      const writeIfd = (start, list, pointers) => {
        const all = list.concat(pointers).sort((a, b) => a.tag - b.tag);
        view.setUint16(start, all.length, true);
        all.forEach((e, i) => {
          const at = start + 2 + i * 12;
          view.setUint16(at, e.tag, true); view.setUint16(at + 2, e.type, true); view.setUint32(at + 4, e.count || 1, true);
          if (e.data) { if (e.data.length <= 4) tiff.set(e.data, at + 8); else view.setUint32(at + 8, e.offset, true); }
          else if (e.type === 1) tiff[at + 8] = e.value;
          else view.setUint32(at + 8, e.value, true);
        });
        view.setUint32(start + 2 + all.length * 12, 0, true);
      };
      const pointers = [];
      if (exifIfd.length) pointers.push({ tag: 0x8769, type: 4, count: 1, value: exifStart });
      if (gpsIfd.length) pointers.push({ tag: 0x8825, type: 4, count: 1, value: gpsStart });
      writeIfd(ifd0Start, ifd0, pointers);
      if (exifIfd.length) writeIfd(exifStart, exifIfd, []);
      if (gpsIfd.length) writeIfd(gpsStart, gpsIfd, []);
      for (const b of blobs) tiff.set(b.bytes, b.at);
      const header = enc.encode('Exif\0\0');
      const length = 2 + header.length + tiff.length;
      const seg = new Uint8Array(2 + length);
      seg[0] = 0xFF; seg[1] = 0xE1; seg[2] = (length >> 8) & 0xFF; seg[3] = length & 0xFF;
      seg.set(header, 4); seg.set(tiff, 4 + header.length);
      return seg;
    }

    /** A JPEG with the APP1 segment inserted right after SOI (any existing APP1 Exif segment is left in place after it). */
    function insertApp1(jpeg, app1) {
      const bytes = jpeg instanceof Uint8Array ? jpeg : new Uint8Array(jpeg);
      const out = new Uint8Array(bytes.length + app1.length);
      out.set(bytes.subarray(0, 2), 0); out.set(app1, 2); out.set(bytes.subarray(2), 2 + app1.length);
      return out;
    }

    return { parse, buildApp1, insertApp1, isoDate };
  });
})();
