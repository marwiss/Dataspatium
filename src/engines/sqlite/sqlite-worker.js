// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * sql.js (SQLite compiled to WebAssembly) running inside a shimmed Blob worker.
 *
 * The function below is serialised with Function.prototype.toString(), so it must not reference
 * anything outside itself. `self.__dataspatium` is provided by the worker shim.
 *
 * Besides plain SQL it registers Dataspatium's helper functions so that cleaning operations run inside
 * the engine: regexp(), regexp_replace(), dm_replace(), dm_parse_number(), dm_parse_date(),
 * dm_parse_datetime(), dm_parse_bool(), dm_upper(), dm_lower(), dm_title(), dm_fix_encoding(),
 * dm_fingerprint(), dm_squish(), dm_hash() (salted SHA-256 prefix), dm_mask(), dm_round(), dm_pad(),
 * dm_date_part(), dm_date_diff(), dm_valid_id() (Nordic identity numbers), the regex functions
 * dm_regex_test(), dm_regex_extract(), dm_regex_all(), dm_regex_count(), dm_regex_split() and dm_shape()
 * (pattern profile), and for geodata
 * dm_geo_lon()/dm_geo_lat()/dm_geo_area() (centroids and areas of GeoJSON or WKT geometry),
 * dm_to_lon()/dm_to_lat()/dm_to_east()/dm_to_north() (SWEREF 99 TM <-> WGS 84) and dm_region()
 * (region of a coordinate among boundaries loaded with the 'regions' message).
 *
 * Message protocol: {id, op, args} -> {id, ok, value} | {id, ok: false, error}
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('engines/sqlite/worker-source', [], () => function dataspatiumSqliteWorker() {
    'use strict';
    var SQL = null;
    var db = null;
    // Other datasets mounted for cross-dataset queries: name -> {db, version}. Each is its own sql.js database
    // whose file lives in the shared virtual file system, so the main connection can ATTACH it by path.
    var mounts = {};
    var dm = self.__dataspatium;
    var readyPromise = dm.ready.then(function () {
      importScripts('dataspatium-asset://sqljs/sql-wasm.js');
      var wasm = dm.get('sqljs/sql-wasm.wasm');
      if (!wasm) throw new Error('sqljs/sql-wasm.wasm was not provided to the worker');
      return self.initSqlJs({ wasmBinary: wasm.data, locateFile: function (file) { return 'dataspatium-asset://sqljs/' + file; } });
    }).then(function (module) { SQL = module; });

    // ---- helper functions available in SQL -----------------------------------------------------
    // Patterns are JavaScript (ECMAScript) regular expressions. A leading inline flag group such as (?i), as
    // written in R, Python and PCRE, becomes flags, and the Unicode flag is added whenever the pattern allows
    // it, so that \p{L} works while older patterns that are only valid without it keep working. The same
    // rules are applied in analysis/regex.js.
    var regexCache = new Map();
    function regex(pattern, flags) {
      var key = pattern + '\u0000' + (flags || '');
      var cached = regexCache.get(key);
      if (cached) { cached.lastIndex = 0; return cached; }
      var p = String(pattern); var f = '';
      var lead = /^(?:\(\?[ims]+\))+/.exec(p);
      if (lead) p = p.slice(lead[0].length);
      String(flags || '').concat(lead ? lead[0].replace(/[^ims]/g, '') : '').split('').forEach(function (c) { if ('dgimsuyv'.indexOf(c) >= 0 && f.indexOf(c) < 0) f += c; });
      var re;
      if (f.indexOf('u') < 0 && f.indexOf('v') < 0) { try { re = new RegExp(p, f + 'u'); } catch (e) { re = new RegExp(p, f); } } else re = new RegExp(p, f);
      if (regexCache.size >= 64) regexCache.clear();
      regexCache.set(key, re);
      return re;
    }
    /** Matches of a global copy of a pattern, at most `limit`; empty matches advance one position. */
    function regexMatches(text, pattern, flags, limit) {
      var re = regex(pattern, String(flags || '').replace(/g/g, '') + 'g');
      var out = []; var m;
      while (out.length < (limit || 1e6) && (m = re.exec(text)) !== null) {
        out.push(m);
        if (m[0] === '') re.lastIndex++;
      }
      return out;
    }
    /** A group of a match by number or name (null when it did not take part). */
    function matchGroup(m, group) {
      var g = group === null || group === undefined || group === '' ? 0 : group;
      var v = /^\d+$/.test(String(g)) ? m[Number(g)] : (m.groups ? m.groups[String(g)] : undefined);
      return v === undefined ? null : v;
    }
    /** Part `part` (1-based) of `text` split at the matches; with `parts` the last part keeps the rest. */
    function regexSplit(text, pattern, flags, part, parts) {
      var n = Math.max(1, Math.trunc(Number(part) || 1));
      var max = Math.trunc(Number(parts) || 0);
      var cuts = regexMatches(text, pattern, flags, max > 0 ? max - 1 : 0).filter(function (m) { return !(m[0] === '' && (m.index === 0 || m.index >= text.length)); });
      var starts = [0]; var ends = [];
      cuts.forEach(function (m) { ends.push(m.index); starts.push(m.index + m[0].length); });
      ends.push(text.length);
      if (n > starts.length) return null;
      return text.slice(starts[n - 1], ends[n - 1]);
    }
    var SHAPE_UPPER = /\p{Lu}/u; var SHAPE_LETTER = /\p{L}/u; var SHAPE_DIGIT = /\p{Nd}/u;
    /**
     * Shape of a text: A for an upper-case letter, a for another letter, 9 for a digit, other characters as
     * they are; with `collapse` a run of the same class is written once followed by +.
     */
    function textShape(text, collapse) {
      var out = ''; var prev = ''; var run = false;
      Array.from(String(text)).forEach(function (ch) {
        var c = SHAPE_UPPER.test(ch) ? 'A' : SHAPE_LETTER.test(ch) ? 'a' : SHAPE_DIGIT.test(ch) ? '9' : ch;
        if (collapse && c === prev && (c === 'A' || c === 'a' || c === '9')) { if (!run) { out += '+'; run = true; } return; }
        out += c; prev = c; run = false;
      });
      return out;
    }
    var pad = function (x) { return String(x).padStart(2, '0'); };
    function parseNumber(raw, decimal) {
      if (raw === null || raw === undefined) return null;
      if (typeof raw === 'number') return raw;
      var s = String(raw).trim();
      if (!s) return null;
      var dec = decimal === 'point' ? 'point' : decimal === 'comma' ? 'comma' : null;
      if (dec === null) { var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.'); dec = lc > ld ? 'comma' : 'point'; }
      if (/^[+-]?\d+([.,]\d+)?[eE][+-]?\d+$/.test(s)) s = s.replace(',', '.');
      else if (dec === 'comma') s = s.replace(/[   .]/g, '').replace(',', '.');
      else s = s.replace(/[   ,]/g, '');
      var n = Number(s);
      return isFinite(n) ? n : null;
    }
    function fromExcelSerial(n) {
      // Excel/LibreOffice day numbers (1899-12-30 epoch), as they appear after a lossy export.
      if (!(n > 20000 && n < 80000)) return null;
      var d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    function parseDateParts(raw, format) {
      if (raw === null || raw === undefined) return null;
      if (typeof raw === 'number') { var iso = fromExcelSerial(raw); return iso ? { date: iso, time: '00:00:00' } : null; }
      var s = String(raw).trim();
      if (!s) return null;
      var m;
      if (format && format !== 'auto') {
        // Tokens: YYYY, YY, MM, M, DD, D, HH, mm, ss; everything else is literal.
        var src = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace('YYYY', '(?<y>\\d{4})').replace('YY', '(?<yy>\\d{2})')
          .replace('MM', '(?<mo>\\d{1,2})').replace(/(^|[^M])M(?!M)/, '$1(?<mo>\\d{1,2})')
          .replace('DD', '(?<d>\\d{1,2})').replace(/(^|[^D])D(?!D)/, '$1(?<d>\\d{1,2})')
          .replace('HH', '(?<h>\\d{1,2})').replace('mm', '(?<mi>\\d{1,2})').replace('ss', '(?<se>\\d{1,2})');
        m = new RegExp('^' + src + '$').exec(s);
        if (!m || !m.groups) return null;
        var g = m.groups;
        var year = g.y ? Number(g.y) : (g.yy ? 2000 + Number(g.yy) - (Number(g.yy) > 68 ? 100 : 0) : null);
        if (year === null || !g.mo || !g.d) return null;
        return { date: year + '-' + pad(g.mo) + '-' + pad(g.d), time: pad(g.h || 0) + ':' + pad(g.mi || 0) + ':' + pad(g.se || 0) };
      }
      if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s))) return { date: m[1] + '-' + m[2] + '-' + m[3], time: pad(m[4] || 0) + ':' + pad(m[5] || 0) + ':' + pad(m[6] || 0) };
      if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s))) return { date: m[3] + '-' + pad(m[2]) + '-' + pad(m[1]), time: pad(m[4] || 0) + ':' + pad(m[5] || 0) + ':' + pad(m[6] || 0) };
      if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return { date: m[1] + '-' + m[2] + '-' + m[3], time: '00:00:00' };
      if (/^\d+(\.\d+)?$/.test(s)) { var iso2 = fromExcelSerial(Number(s)); return iso2 ? { date: iso2, time: '00:00:00' } : null; }
      return null;
    }
    function parseDate(raw, format) { var p = parseDateParts(raw, format); return p ? p.date : null; }
    function parseDateTime(raw, format) { var p = parseDateParts(raw, format); return p ? p.date + ' ' + p.time : null; }
    var BOOL = { 'true': 1, 'false': 0, ja: 1, nej: 0, yes: 1, no: 0, sant: 1, falskt: 0, j: 1, n: 0, '1': 1, '0': 0, x: 1 };
    function parseBool(raw) {
      if (raw === null || raw === undefined) return null;
      if (typeof raw === 'number') return raw ? 1 : 0;
      var k = String(raw).trim().toLowerCase();
      return Object.prototype.hasOwnProperty.call(BOOL, k) ? BOOL[k] : null;
    }
    // Reverse Windows-1252 map for code points that differ from Latin-1 (bytes 0x80-0x9F).
    var CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
    var utf8Strict = new TextDecoder('utf-8', { fatal: true });
    /** Repair text whose UTF-8 bytes were decoded as Windows-1252 ("Ã–rebro" -> "Örebro"). */
    function fixEncoding(s) {
      if (!/[ÂÃÅÆâ]/.test(s)) return s;
      var bytes = new Uint8Array(s.length);
      var n = 0;
      for (var i = 0; i < s.length; i++) {
        var code = s.charCodeAt(i);
        if (code < 0x80 || (code >= 0xa0 && code <= 0xff) || (code >= 0x80 && code <= 0x9f)) bytes[n++] = code;
        else if (CP1252[code] !== undefined) bytes[n++] = CP1252[code];
        else return s;
      }
      try { var fixed = utf8Strict.decode(bytes.subarray(0, n)); return fixed.length < s.length ? fixed : s; } catch (e) { return s; }
    }
    function titleCase(s) { return s.toLocaleLowerCase('sv').replace(/(^|[\s\-\/(])(\p{L})/gu, function (m, pre, ch) { return pre + ch.toLocaleUpperCase('sv'); }); }
    function fingerprint(s) {
      var t = String(s).trim().toLocaleLowerCase('sv').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
      var parts = t.split(' ').filter(Boolean);
      var uniq = Array.from(new Set(parts)).sort();
      return uniq.join(' ');
    }
    // SHA-256 (FIPS 180-4) in plain JS: pseudonymisation runs inside synchronous SQL functions, where Web Crypto cannot be awaited.
    var K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
    var sha256Encoder = new TextEncoder();
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    function sha256Hex(message) {
      var bytes = sha256Encoder.encode(message);
      var len = bytes.length;
      var padded = new Uint8Array((((len + 9) + 63) >> 6) << 6);
      padded.set(bytes);
      padded[len] = 0x80;
      var view = new DataView(padded.buffer);
      view.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296));
      view.setUint32(padded.length - 4, (len * 8) >>> 0);
      var H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
      var W = new Uint32Array(64);
      for (var off = 0; off < padded.length; off += 64) {
        var i;
        for (i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
        for (i = 16; i < 64; i++) {
          var s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
          var s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
          W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
        }
        var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
        for (i = 0; i < 64; i++) {
          var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
          var ch = (e & f) ^ (~e & g);
          var t1 = (hh + S1 + ch + K256[i] + W[i]) >>> 0;
          var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
          var maj = (a & b) ^ (a & c) ^ (b & c);
          var t2 = (S0 + maj) >>> 0;
          hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += hh;
      }
      var hex = '';
      for (var j = 0; j < 8; j++) hex += ('00000000' + H[j].toString(16)).slice(-8);
      return hex;
    }
    /** Keep the first/last characters and separators, replace the rest with the mask character. */
    function maskText(s, keepStart, keepEnd, ch) {
      var chars = Array.from(s); var n = chars.length; var out = '';
      for (var i = 0; i < n; i++) { var c = chars[i]; out += (i < keepStart || i >= n - keepEnd || /[\s\-\/.+]/.test(c)) ? c : ch; }
      return out;
    }
    // ---- geodata: GeoJSON/WKT parsing, SWEREF 99 TM <-> WGS 84, centroids, areas, point in polygon ----
    var regions = null; // boundaries for dm_region(), loaded with the 'regions' message: [{polys, bbox, props}]
    var geoMemo = { text: null, geom: null, centroid: undefined };
    var regionMemo = { lon: null, lat: null, index: -1 };
    var GEO = { a: 6378137, f: 1 / 298.257222101, k0: 0.9996, lon0: 15, falseE: 500000, deg: Math.PI / 180, radius: 6371008.8 };
    function geoConst() { var e2 = GEO.f * (2 - GEO.f); var n = GEO.f / (2 - GEO.f); return { e2: e2, n: n, aHat: GEO.a / (1 + n) * (1 + n * n / 4 + Math.pow(n, 4) / 64) }; }
    /** SWEREF 99 TM metres -> [longitude, latitude] (Lantmäteriet's Gauss-Krüger series). */
    function swerefToWgs84(x, y) {
      var c = geoConst(); var n = c.n; var e2 = c.e2;
      var xi = y / (GEO.k0 * c.aHat); var eta = (x - GEO.falseE) / (GEO.k0 * c.aHat);
      var d1 = n / 2 - 2 * n * n / 3 + 37 * Math.pow(n, 3) / 96 - Math.pow(n, 4) / 360;
      var d2 = n * n / 48 + Math.pow(n, 3) / 15 - 437 * Math.pow(n, 4) / 1440;
      var d3 = 17 * Math.pow(n, 3) / 480 - 37 * Math.pow(n, 4) / 840;
      var d4 = 4397 * Math.pow(n, 4) / 161280;
      var xiP = xi - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta) - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
      var etaP = eta - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta) - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
      var phiStar = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
      var dLon = Math.atan(Math.sinh(etaP) / Math.cos(xiP));
      var aS = e2 + e2 * e2 + Math.pow(e2, 3) + Math.pow(e2, 4);
      var bS = -(7 * e2 * e2 + 17 * Math.pow(e2, 3) + 30 * Math.pow(e2, 4)) / 6;
      var cS = (224 * Math.pow(e2, 3) + 889 * Math.pow(e2, 4)) / 120;
      var dS = -(4279 * Math.pow(e2, 4)) / 1260;
      var s = Math.sin(phiStar);
      var phi = phiStar + s * Math.cos(phiStar) * (aS + bS * s * s + cS * Math.pow(s, 4) + dS * Math.pow(s, 6));
      return [GEO.lon0 + dLon / GEO.deg, phi / GEO.deg];
    }
    /** [longitude, latitude] -> SWEREF 99 TM [east, north]. */
    function wgs84ToSweref(lon, lat) {
      var c = geoConst(); var n = c.n; var e2 = c.e2;
      var phi = lat * GEO.deg;
      var aC = e2; var bC = (5 * e2 * e2 - Math.pow(e2, 3)) / 6; var cC = (104 * Math.pow(e2, 3) - 45 * Math.pow(e2, 4)) / 120; var dC = 1237 * Math.pow(e2, 4) / 1260;
      var s = Math.sin(phi);
      var phiStar = phi - s * Math.cos(phi) * (aC + bC * s * s + cC * Math.pow(s, 4) + dC * Math.pow(s, 6));
      var dLon = (lon - GEO.lon0) * GEO.deg;
      var xiP = Math.atan(Math.tan(phiStar) / Math.cos(dLon));
      var etaP = Math.atanh(Math.cos(phiStar) * Math.sin(dLon));
      var b1 = n / 2 - 2 * n * n / 3 + 5 * Math.pow(n, 3) / 16 + 41 * Math.pow(n, 4) / 180;
      var b2 = 13 * n * n / 48 - 3 * Math.pow(n, 3) / 5 + 557 * Math.pow(n, 4) / 1440;
      var b3 = 61 * Math.pow(n, 3) / 240 - 103 * Math.pow(n, 4) / 140;
      var b4 = 49561 * Math.pow(n, 4) / 161280;
      var north = GEO.k0 * c.aHat * (xiP + b1 * Math.sin(2 * xiP) * Math.cosh(2 * etaP) + b2 * Math.sin(4 * xiP) * Math.cosh(4 * etaP) + b3 * Math.sin(6 * xiP) * Math.cosh(6 * etaP) + b4 * Math.sin(8 * xiP) * Math.cosh(8 * etaP));
      var east = GEO.k0 * c.aHat * (etaP + b1 * Math.cos(2 * xiP) * Math.sinh(2 * etaP) + b2 * Math.cos(4 * xiP) * Math.sinh(4 * etaP) + b3 * Math.cos(6 * xiP) * Math.sinh(6 * etaP) + b4 * Math.cos(8 * xiP) * Math.sinh(8 * etaP)) + GEO.falseE;
      return [east, north];
    }
    /** WKT (POINT, LINESTRING, POLYGON, MULTI*, optional SRID prefix and Z/M) -> GeoJSON geometry, or null. */
    function wktToGeoJson(text) {
      var s = String(text).trim().replace(/^SRID=\d+\s*;\s*/i, '');
      var m = /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON)\s*(ZM|Z|M)?\s*(EMPTY|\([\s\S]*\))\s*$/i.exec(s);
      if (!m || m[3].toUpperCase() === 'EMPTY') return null;
      var body = m[3]; var i = 0;
      function list() {
        if (body[i] !== '(') throw new Error('wkt');
        i++;
        var items = [];
        for (;;) {
          while (i < body.length && /\s/.test(body[i])) i++;
          if (body[i] === '(') items.push(list());
          else {
            var start = i;
            while (i < body.length && body[i] !== ',' && body[i] !== ')') i++;
            var nums = body.slice(start, i).trim().split(/\s+/).map(Number);
            if (nums.length < 2 || !isFinite(nums[0]) || !isFinite(nums[1])) throw new Error('wkt');
            items.push([nums[0], nums[1]]);
          }
          while (i < body.length && /\s/.test(body[i])) i++;
          if (body[i] === ',') { i++; continue; }
          if (body[i] === ')') { i++; return items; }
          throw new Error('wkt');
        }
      }
      var items;
      try { items = list(); } catch (e) { return null; }
      var type = m[1].toUpperCase();
      var isPt = function (v) { return Array.isArray(v) && typeof v[0] === 'number'; };
      if (type === 'POINT') return isPt(items[0]) ? { type: 'Point', coordinates: items[0] } : null;
      if (type === 'LINESTRING') return { type: 'LineString', coordinates: items };
      if (type === 'POLYGON') return { type: 'Polygon', coordinates: items };
      if (type === 'MULTIPOINT') return { type: 'MultiPoint', coordinates: items.map(function (it) { return isPt(it) ? it : it[0]; }) };
      if (type === 'MULTILINESTRING') return { type: 'MultiLineString', coordinates: items };
      return { type: 'MultiPolygon', coordinates: items };
    }
    /** A geometry cell (GeoJSON text or object, Feature, WKT) -> geometry or null; the last text is memoised. */
    function geoParse(value) {
      if (value === null || value === undefined) return null;
      if (typeof value === 'object') return value.type === 'Feature' ? value.geometry || null : value;
      var s = String(value).trim();
      if (!s) return null;
      if (geoMemo.text === s) return geoMemo.geom;
      var g = null;
      if (s.charAt(0) === '{') { try { g = JSON.parse(s); if (g && g.type === 'Feature') g = g.geometry || null; } catch (e) { g = null; } }
      else g = wktToGeoJson(s);
      geoMemo.text = s; geoMemo.geom = g; geoMemo.centroid = undefined;
      return g;
    }
    function geoPositions(g, out) {
      out = out || [];
      if (!g) return out;
      if (g.type === 'GeometryCollection') { (g.geometries || []).forEach(function (gg) { geoPositions(gg, out); }); return out; }
      (function walk(c) { if (!Array.isArray(c)) return; if (typeof c[0] === 'number') out.push(c); else c.forEach(walk); })(g.coordinates);
      return out;
    }
    /** Polygons of a geometry as [[outerRing, hole, ...], ...]. */
    function geoPolygons(g) {
      if (!g) return [];
      if (g.type === 'Polygon') return [g.coordinates || []];
      if (g.type === 'MultiPolygon') return g.coordinates || [];
      if (g.type === 'GeometryCollection') return (g.geometries || []).reduce(function (acc, gg) { return acc.concat(geoPolygons(gg)); }, []);
      return [];
    }
    /** Metres rather than degrees: any position outside the longitude/latitude range. */
    function geoIsProjected(g) { var p = geoPositions(g); for (var i = 0; i < p.length; i++) if (Math.abs(p[i][0]) > 180 || Math.abs(p[i][1]) > 90) return true; return false; }
    function ringSignedArea(ring) { var a = 0; for (var i = 0, n = ring.length; i < n; i++) { var p = ring[i], r = ring[(i + 1) % n]; a += p[0] * r[1] - r[0] * p[1]; } return a / 2; }
    function ringCentroid(ring) { var a = 0, cx = 0, cy = 0; for (var i = 0, n = ring.length; i < n; i++) { var p = ring[i], r = ring[(i + 1) % n]; var f = p[0] * r[1] - r[0] * p[1]; a += f; cx += (p[0] + r[0]) * f; cy += (p[1] + r[1]) * f; } return a ? [cx / (3 * a), cy / (3 * a), a / 2] : null; }
    /** Centroid as [longitude, latitude]: area-weighted for polygons in a local planar frame, mean of vertices otherwise. */
    function geoCentroid(g) {
      if (!g) return null;
      var projected = geoIsProjected(g);
      var toWgs = function (x, y) { return projected ? swerefToWgs84(x, y) : [x, y]; };
      var polys = geoPolygons(g);
      var pts = geoPositions(g);
      if (!pts.length) return null;
      if (polys.length) {
        // Metres are planar already; degrees get longitude scaled by cos(latitude) so both axes share a unit.
        var lat0 = 0; if (!projected) { for (var i = 0; i < pts.length; i++) lat0 += pts[i][1]; lat0 /= pts.length; }
        var k = projected ? 1 : (Math.cos(lat0 * GEO.deg) || 1e-9);
        var sumA = 0, sumX = 0, sumY = 0;
        polys.forEach(function (poly) { poly.forEach(function (ring) { var c = ringCentroid(ring.map(function (p) { return [p[0] * k, p[1]]; })); if (c) { sumA += c[2]; sumX += c[0] * c[2]; sumY += c[1] * c[2]; } }); });
        if (Math.abs(sumA) > 1e-12) return toWgs(sumX / sumA / k, sumY / sumA);
      }
      var mx = 0, my = 0; for (var j = 0; j < pts.length; j++) { mx += pts[j][0]; my += pts[j][1]; }
      return toWgs(mx / pts.length, my / pts.length);
    }
    /** Area of a longitude/latitude ring on the sphere (square metres). */
    function ringSphereArea(ring) {
      var pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
      var n = pts.length; if (n < 3) return 0;
      var total = 0;
      for (var i = 0; i < n; i++) { var prev = pts[(i + n - 1) % n], cur = pts[i], next = pts[(i + 1) % n]; total += (next[0] - prev[0]) * GEO.deg * Math.sin(cur[1] * GEO.deg); }
      return Math.abs(total) * GEO.radius * GEO.radius / 2;
    }
    /** Area in square kilometres: planar for projected metres, spherical for degrees; holes subtracted. */
    function geoArea(g) {
      var polys = geoPolygons(g);
      if (!polys.length) return null;
      var projected = geoIsProjected(g);
      var total = 0;
      polys.forEach(function (poly) { poly.forEach(function (ring, idx) { var a = projected ? Math.abs(ringSignedArea(ring)) : ringSphereArea(ring); total += idx === 0 ? a : -a; }); });
      return Math.max(0, total) / 1e6;
    }
    function pointInRing(x, y, ring) {
      var inside = false;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    /** Index of the loaded region containing a coordinate (degrees, or SWEREF 99 TM metres), or -1. */
    function regionIndex(lon, lat) {
      if (!regions || lon === null || lat === null) return -1;
      if (regionMemo.lon === lon && regionMemo.lat === lat) return regionMemo.index;
      var p = Math.abs(lon) > 180 || Math.abs(lat) > 90 ? swerefToWgs84(lon, lat) : [lon, lat];
      var found = -1;
      for (var r = 0; r < regions.length && found < 0; r++) {
        var reg = regions[r]; var b = reg.bbox;
        if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue;
        for (var k = 0; k < reg.polys.length; k++) {
          var poly = reg.polys[k];
          if (!poly.length || !pointInRing(p[0], p[1], poly[0])) continue;
          var inHole = false;
          for (var h = 1; h < poly.length; h++) if (pointInRing(p[0], p[1], poly[h])) { inHole = true; break; }
          if (!inHole) { found = r; break; }
        }
      }
      regionMemo.lon = lon; regionMemo.lat = lat; regionMemo.index = found;
      return found;
    }
    function loadRegions(features) {
      regions = (features || []).map(function (f) {
        var polys = geoPolygons(f.geometry);
        var bbox = [Infinity, Infinity, -Infinity, -Infinity];
        polys.forEach(function (poly) { (poly[0] || []).forEach(function (p) { if (p[0] < bbox[0]) bbox[0] = p[0]; if (p[1] < bbox[1]) bbox[1] = p[1]; if (p[0] > bbox[2]) bbox[2] = p[0]; if (p[1] > bbox[3]) bbox[3] = p[1]; }); });
        return { polys: polys, bbox: bbox, props: f.props || {} };
      });
      regionMemo.lon = null; regionMemo.lat = null; regionMemo.index = -1;
      return regions.length;
    }

    // ---- rounding, padding, dates and identity numbers (table operations and rules) ----------------
    /** A period in a table: 2024M03, 2024-03, 202403, 2024K1, 2024Q1, 2024-Q1, Q1 2024, 2024 or a date, as year, quarter and month. */
    function periodParts(x) {
      if (x === null || x === undefined) return null;
      var s = String(x).trim();
      var m = /^(\d{4})$/.exec(s);
      if (m) return { y: +m[1] };
      m = /^(\d{4})[-/ ]?[KkQq]([1-4])$/.exec(s) || /^(\d{4})[-/ ]?T([1-4])$/.exec(s);
      if (m) return { y: +m[1], q: +m[2] };
      m = /^[KkQq]([1-4])[-/ ](\d{4})$/.exec(s);
      if (m) return { y: +m[2], q: +m[1] };
      m = /^(\d{4})[-/ ]?[Mm]?(\d{2})$/.exec(s) || /^(\d{4})[Mm](\d{1})$/.exec(s) || /^(\d{4})-(\d{1})$/.exec(s);
      if (m && +m[2] >= 1 && +m[2] <= 12) return { y: +m[1], m: +m[2], q: Math.ceil(+m[2] / 3) };
      m = /^(\d{4})-(\d{1,2})-\d{1,2}/.exec(s);
      if (m && +m[2] >= 1 && +m[2] <= 12) return { y: +m[1], m: +m[2], q: Math.ceil(+m[2] / 3) };
      return null;
    }
    function periodOf(x, frequency) {
      var p = periodParts(x);
      if (!p) return null;
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var f = frequency || 'auto';
      if (f === 'year') return String(p.y);
      if (f === 'quarter') return p.q ? p.y + '-Q' + p.q : null;
      if (f === 'month') return p.m ? p.y + '-' + pad(p.m) : null;
      if (p.m) return p.y + '-' + pad(p.m);
      if (p.q) return p.y + '-Q' + p.q;
      return String(p.y);
    }
    function periodDate(x) {
      var p = periodParts(x);
      if (!p) return null;
      var month = p.m || (p.q ? (p.q - 1) * 3 + 1 : 1);
      return p.y + '-' + (month < 10 ? '0' : '') + month + '-01';
    }
    function periodShift(x, years) {
      var p = periodParts(x);
      if (!p) return null;
      var y = p.y + (Number(years) || 0);
      if (p.m) return y + '-' + (p.m < 10 ? '0' : '') + p.m;
      if (p.q) return y + '-Q' + p.q;
      return String(y);
    }
    function roundNumber(x, decimals, mode) {
      if (x === null || x === undefined || x === '') return null;
      var v = Number(x);
      if (!isFinite(v)) return x;
      var d = Math.max(-10, Math.min(10, Math.trunc(Number(decimals) || 0)));
      var f = Math.pow(10, d);
      // 1.005 * 100 is 100.49999999999999 in binary; 15 significant digits undo that before rounding.
      var s = Number((v * f).toPrecision(15));
      var r = mode === 'floor' ? Math.floor(s) : mode === 'ceil' ? Math.ceil(s) : mode === 'trunc' ? Math.trunc(s) : Math.sign(s) * Math.round(Math.abs(s));
      return Number((r / f).toPrecision(15));
    }
    function padText(x, length, ch, side) {
      if (x === null || x === undefined) return null;
      var s = String(x);
      var n = Math.max(1, Math.min(100, Math.trunc(Number(length) || 1)));
      var c = Array.from(ch === null || ch === undefined || ch === '' ? '0' : String(ch))[0];
      if (s.length >= n) return s;
      var fill = new Array(n - s.length + 1).join(c);
      return side === 'right' ? s + fill : fill + s;
    }
    /** ISO date or date-time text (or another format parseDate understands) -> UTC Date, or null. */
    function toDate(x) {
      if (x === null || x === undefined || x === '') return null;
      var s = String(x);
      var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
      if (!m) { var iso = parseDateTime(s, null) || parseDate(s, null); m = iso ? /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso) : null; }
      if (!m) return null;
      var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
      return isNaN(d.getTime()) ? null : d;
    }
    function isoWeek(d) {
      var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      var day = t.getUTCDay() || 7;
      t.setUTCDate(t.getUTCDate() + 4 - day);
      return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
    }
    function datePart(x, part) {
      var d = toDate(x);
      if (!d) return null;
      switch (String(part)) {
        case 'year': return d.getUTCFullYear();
        case 'quarter': return Math.floor(d.getUTCMonth() / 3) + 1;
        case 'month': return d.getUTCMonth() + 1;
        case 'week': return isoWeek(d);
        case 'weekday': return d.getUTCDay() || 7;
        case 'day': return d.getUTCDate();
        case 'dayofyear': return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
        case 'yearmonth': return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1);
        case 'hour': return d.getUTCHours();
        default: return null;
      }
    }
    /** Whole days, weeks, months or years from a to b (negative when b is earlier). */
    function dateDiff(a, b, unit) {
      var x = toDate(a); var y = toDate(b);
      if (!x || !y) return null;
      if (unit === 'months' || unit === 'years') {
        var sign = y >= x ? 1 : -1; var lo = sign > 0 ? x : y; var hi = sign > 0 ? y : x;
        var months = (hi.getUTCFullYear() - lo.getUTCFullYear()) * 12 + (hi.getUTCMonth() - lo.getUTCMonth());
        var timeOfDay = function (d) { return ((d.getTime() % 86400000) + 86400000) % 86400000; };
        if (hi.getUTCDate() < lo.getUTCDate() || (hi.getUTCDate() === lo.getUTCDate() && timeOfDay(hi) < timeOfDay(lo))) months -= 1;
        return sign * (unit === 'years' ? Math.floor(months / 12) : months);
      }
      var days = (y.getTime() - x.getTime()) / 86400000;
      return unit === 'weeks' ? Math.trunc(days / 7) : Math.trunc(days);
    }
    function luhn(digits) {
      var sum = 0;
      for (var i = 0; i < digits.length; i++) { var v = Number(digits[digits.length - 1 - i]) * (i % 2 ? 2 : 1); sum += v > 9 ? v - 9 : v; }
      return sum % 10 === 0;
    }
    function validDay(year, month, day) {
      if (month < 1 || month > 12 || day < 1) return false;
      return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
    }
    /**
     * Nordic identity numbers: Swedish personnummer and samordningsnummer (date + Luhn), organisationsnummer
     * (Luhn, third digit at least 2), Norwegian fødselsnummer and D-number (two mod-11 check digits), Danish
     * CPR (date only; CPR has had no check digit since 2007), Finnish henkilötunnus (check character) and
     * Icelandic kennitala (mod-11 check digit).
     */
    function validId(x, kind) {
      if (x === null || x === undefined) return null;
      var s = String(x).trim().toUpperCase();
      var digits = s.replace(/[\s+-]/g, '');
      switch (String(kind)) {
        case 'se_pnr': {
          if (!/^(\d{6}|\d{8})[-+]?\d{4}$/.test(s.replace(/\s/g, ''))) return 0;
          var ten = digits.slice(-10);
          var yy = Number(ten.slice(0, 2)); var mm = Number(ten.slice(2, 4)); var dd = Number(ten.slice(4, 6));
          if (dd > 60) dd -= 60; // samordningsnummer
          var years = digits.length === 12 ? [Number(digits.slice(0, 4))] : [1900 + yy, 2000 + yy];
          if (!years.some(function (y) { return validDay(y, mm, dd); })) return 0;
          return luhn(ten) ? 1 : 0;
        }
        case 'se_orgnr': {
          if (!/^(16)?\d{6}-?\d{4}$/.test(s.replace(/\s/g, ''))) return 0;
          var org = digits.slice(-10);
          return Number(org[2]) >= 2 && luhn(org) ? 1 : 0;
        }
        case 'no_fnr': {
          if (!/^\d{11}$/.test(digits)) return 0;
          var n = digits.split('').map(Number);
          var w1 = [3, 7, 6, 1, 8, 9, 4, 5, 2]; var w2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
          var k1 = 11 - (w1.reduce(function (a, w, i) { return a + w * n[i]; }, 0) % 11); if (k1 === 11) k1 = 0;
          var k2 = 11 - (w2.reduce(function (a, w, i) { return a + w * n[i]; }, 0) % 11); if (k2 === 11) k2 = 0;
          if (k1 === 10 || k2 === 10 || k1 !== n[9] || k2 !== n[10]) return 0;
          var day = n[0] * 10 + n[1]; var month = n[2] * 10 + n[3];
          if (day > 40) day -= 40; // D-number
          if (month > 40) month -= 40; // H-number
          return validDay(2000 + n[4] * 10 + n[5], month, day) || validDay(1900 + n[4] * 10 + n[5], month, day) ? 1 : 0;
        }
        case 'dk_cpr': {
          if (!/^\d{10}$/.test(digits)) return 0;
          var dy = Number(digits.slice(4, 6));
          return validDay(2000 + dy, Number(digits.slice(2, 4)), Number(digits.slice(0, 2))) || validDay(1900 + dy, Number(digits.slice(2, 4)), Number(digits.slice(0, 2))) ? 1 : 0;
        }
        case 'fi_hetu': {
          var m = /^(\d{2})(\d{2})(\d{2})([-+ABCDEFUVWXY])(\d{3})([0-9A-Y])$/.exec(s);
          if (!m) return 0;
          var century = m[4] === '+' ? 1800 : /[ABCDEF]/.test(m[4]) ? 2000 : 1900;
          if (!validDay(century + Number(m[3]), Number(m[2]), Number(m[1]))) return 0;
          return '0123456789ABCDEFHJKLMNPRSTUVWXY'[Number(m[1] + m[2] + m[3] + m[5]) % 31] === m[6] ? 1 : 0;
        }
        case 'is_kt': {
          if (!/^\d{10}$/.test(digits)) return 0;
          var k = digits.split('').map(Number);
          var sum = [3, 2, 7, 6, 5, 4, 3, 2].reduce(function (a, w, i) { return a + w * k[i]; }, 0);
          var c = 11 - (sum % 11); if (c === 11) c = 0;
          if (c === 10 || c !== k[8]) return 0;
          var kd = k[0] * 10 + k[1]; if (kd > 40) kd -= 40; // companies
          var base = k[9] === 8 ? 1800 : k[9] === 9 ? 1900 : 2000;
          return validDay(base + k[4] * 10 + k[5], k[2] * 10 + k[3], kd) ? 1 : 0;
        }
        default: return null;
      }
    }

    /**
     * Personal data inside running text: e-mail addresses, Nordic identity numbers that pass their own checks, and phone
     * numbers in the international or mobile form. Names and addresses cannot be recognised this way.
     */
    var PERSONAL = [
      { re: /[^\s@<>"',;:()\[\]{}]+@[^\s@<>"',;:()\[\]{}]+\.[A-Za-z]{2,}/g },
      { re: /\b\d{6}[-+ABCDEFUVWXY]\d{3}[0-9A-Y]\b/g, kinds: ['fi_hetu'] },
      { re: /\b\d{6} ?\d{5}\b/g, kinds: ['no_fnr'] },
      { re: /\b(?:\d{2})?\d{6}[-+]?\d{4}\b/g, kinds: ['se_pnr', 'is_kt'] },
      { re: /\b\d{6}-\d{4}\b/g, kinds: ['dk_cpr'] },
      { re: /\+\d{1,3}[ -]?\d(?:[ -]?\d){6,11}\b/g },
      { re: /\b07\d[- ]?\d{3}[- ]?\d{2}[- ]?\d{2}\b/g },
    ];
    var MASK = '[***]';
    function isPersonal(pattern, match) {
      return !pattern.kinds || pattern.kinds.some(function (kind) { return validId(match, kind) === 1; });
    }
    function hasPersonal(x) {
      if (x === null || x === undefined || typeof x !== 'string') return 0;
      for (var i = 0; i < PERSONAL.length; i++) {
        var hits = x.match(PERSONAL[i].re);
        if (hits && hits.some(function (m) { return isPersonal(PERSONAL[i], m); })) return 1;
      }
      return 0;
    }
    function maskPersonal(x) {
      if (x === null || x === undefined || typeof x !== 'string') return x;
      var out = x;
      PERSONAL.forEach(function (pattern) {
        out = out.replace(pattern.re, function (m) { return isPersonal(pattern, m) ? MASK : m; });
      });
      return out;
    }

    function registerFunctions(database) {
      database.create_function('dm_period', function (x, frequency) { return periodOf(x, frequency); });
      database.create_function('dm_period_date', function (x) { return periodDate(x); });
      database.create_function('dm_period_shift', function (x, years) { return periodShift(x, years); });
      database.create_function('dm_logistic', function (x) { return x === null || x === undefined ? null : 1 / (1 + Math.exp(-x)); });
      database.create_function('dm_round', function (x, decimals, mode) { return roundNumber(x, decimals, mode); });
      database.create_function('dm_pad', function (x, length, ch, side) { return padText(x, length, ch, side); });
      database.create_function('dm_date_part', function (x, part) { return datePart(x, part); });
      database.create_function('dm_date_diff', function (a, b, unit) { return dateDiff(a, b, unit); });
      database.create_function('dm_valid_id', function (x, kind) { return validId(x, kind); });
      database.create_function('dm_has_personal', function (x) { return hasPersonal(x); });
      database.create_function('dm_mask_personal', function (x) { return maskPersonal(x); });
      database.create_function('dm_hash', function (text, salt, length) {
        if (text === null) return null;
        var key = salt === null || salt === undefined || salt === '' ? String(text) : String(salt) + '|' + String(text);
        var n = length === null || length === undefined ? 16 : Math.max(4, Math.min(64, Number(length) || 16));
        return sha256Hex(key).slice(0, n);
      });
      database.create_function('dm_mask', function (text, keepStart, keepEnd, ch) {
        if (text === null) return null;
        return maskText(String(text), Number(keepStart) || 0, Number(keepEnd) || 0, ch === null || ch === undefined || ch === '' ? '*' : Array.from(String(ch))[0]);
      });
      database.create_function('regexp', function (pattern, text) { if (text === null || pattern === null) return 0; try { return regex(String(pattern), '').test(String(text)) ? 1 : 0; } catch (e) { return 0; } });
      database.create_function('regexp_replace', function (text, pattern, repl, flags) { if (text === null) return null; try { return String(text).replace(regex(String(pattern), flags === null || flags === undefined ? 'g' : String(flags)), repl === null ? '' : String(repl)); } catch (e) { return text; } });
      // Regex functions for the Regex tab and its recipe steps; an invalid pattern is an SQL error.
      database.create_function('dm_regex_test', function (text, pattern, flags) { if (text === null || pattern === null) return null; return regex(String(pattern), String(flags || '').replace(/g/g, '')).test(String(text)) ? 1 : 0; });
      database.create_function('dm_regex_extract', function (text, pattern, group, flags) {
        if (text === null || pattern === null) return null;
        var m = regex(String(pattern), String(flags || '').replace(/g/g, '')).exec(String(text));
        return m ? matchGroup(m, group) : null;
      });
      database.create_function('dm_regex_all', function (text, pattern, group, sep, flags) {
        if (text === null || pattern === null) return null;
        var found = regexMatches(String(text), String(pattern), flags, 10000).map(function (m) { return matchGroup(m, group); }).filter(function (v) { return v !== null && v !== ''; });
        return found.length ? found.join(sep === null || sep === undefined ? ', ' : String(sep)) : null;
      });
      database.create_function('dm_regex_count', function (text, pattern, flags) { if (text === null || pattern === null) return null; return regexMatches(String(text), String(pattern), flags).filter(function (m) { return m[0] !== ''; }).length; });
      database.create_function('dm_regex_split', function (text, pattern, part, parts, flags) { if (text === null || pattern === null) return null; return regexSplit(String(text), String(pattern), flags, part, parts); });
      database.create_function('dm_shape', function (text, collapse) { return text === null ? null : textShape(text, !!collapse); });
      database.create_function('dm_replace', function (text, find, repl, ci) {
        if (text === null || find === null) return text;
        var s = String(text); var f = String(find); var r = repl === null ? '' : String(repl);
        if (!f) return s;
        if (ci) { var re = regex(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); return s.replace(re, r); }
        return s.split(f).join(r);
      });
      database.create_function('dm_parse_number', function (text, decimal) { return parseNumber(text, decimal); });
      database.create_function('dm_parse_date', function (text, format) { return parseDate(text, format); });
      database.create_function('dm_parse_datetime', function (text, format) { return parseDateTime(text, format); });
      database.create_function('dm_parse_bool', function (text) { return parseBool(text); });
      database.create_function('dm_upper', function (text) { return text === null ? null : String(text).toLocaleUpperCase('sv'); });
      database.create_function('dm_lower', function (text) { return text === null ? null : String(text).toLocaleLowerCase('sv'); });
      database.create_function('dm_title', function (text) { return text === null ? null : titleCase(String(text)); });
      database.create_function('dm_squish', function (text) { return text === null ? null : String(text).replace(/\s+/g, ' ').trim(); });
      database.create_function('dm_fix_encoding', function (text) { return text === null ? null : fixEncoding(String(text)); });
      database.create_function('dm_fingerprint', function (text) { return text === null ? null : fingerprint(text); });
      // Geodata: centroids, areas, SWEREF 99 TM <-> WGS 84 and region lookup against loaded boundaries.
      var centroidOf = function (text) { var g = geoParse(text); if (!g) return null; if (geoMemo.geom === g && geoMemo.centroid !== undefined) return geoMemo.centroid; var c = geoCentroid(g); if (geoMemo.geom === g) geoMemo.centroid = c; return c; };
      var num = function (v) { return v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v); };
      database.create_function('dm_geo_lon', function (text) { var c = centroidOf(text); return c ? c[0] : null; });
      database.create_function('dm_geo_lat', function (text) { var c = centroidOf(text); return c ? c[1] : null; });
      database.create_function('dm_geo_area', function (text) { var g = geoParse(text); return g ? geoArea(g) : null; });
      database.create_function('dm_to_lon', function (x, y) { var a = num(x), b = num(y); return a === null || b === null ? null : swerefToWgs84(a, b)[0]; });
      database.create_function('dm_to_lat', function (x, y) { var a = num(x), b = num(y); return a === null || b === null ? null : swerefToWgs84(a, b)[1]; });
      database.create_function('dm_to_east', function (lon, lat) { var a = num(lon), b = num(lat); return a === null || b === null ? null : wgs84ToSweref(a, b)[0]; });
      database.create_function('dm_to_north', function (lon, lat) { var a = num(lon), b = num(lat); return a === null || b === null ? null : wgs84ToSweref(a, b)[1]; });
      database.create_function('dm_region', function (lon, lat, field) { var idx = regionIndex(num(lon), num(lat)); if (idx < 0) return null; var v = regions[idx].props[String(field)]; return v === undefined ? null : v; });
    }

    function requireDb() { if (!db) throw new Error('No database is open'); return db; }
    var ident = function (name) { return '"' + String(name).replace(/"/g, '""') + '"'; };
    /**
     * Make short names usable in the current connection: the primary dataset's own short name as a view on
     * data, and each mounted dataset ATTACHed (as <name>__db) with a view named by its short name.
     * Attachments do not survive export(), which reopens the connection, so this runs before every query.
     */
    /** Schemas attached in a connection (pragma database_list), so that no state has to be tracked across reopens. */
    function attachedSchemas(d) {
      var out = {};
      var res = d.exec('pragma database_list');
      if (res[0]) res[0].values.forEach(function (r) { out[String(r[1])] = true; });
      return out;
    }
    function ensureAttached(d, names, self) {
      var have = attachedSchemas(d);
      if (self) d.exec('create temp view if not exists ' + ident(self) + ' as select * from main.data');
      for (var i = 0; i < names.length; i++) {
        var name = names[i]; var m = mounts[name];
        if (!m) continue;
        if (!have[name + '__db']) d.exec("attach database '/" + m.db.filename + "' as " + ident(name + '__db'));
        d.exec('create temp view if not exists ' + ident(name) + ' as select * from ' + ident(name + '__db') + '.data');
      }
    }
    function detachMount(name) {
      if (!db) return;
      try {
        if (attachedSchemas(db)[name + '__db']) { db.exec('drop view if exists ' + ident(name)); db.exec('detach database ' + ident(name + '__db')); }
      } catch (e) { /* a statement may be running; the next mount will try again */ }
    }
    function withSavepoint(d, name, fn) {
      d.exec('savepoint ' + name);
      try { var r = fn(); d.exec('release ' + name); return r; }
      catch (e) { d.exec('rollback to ' + name); d.exec('release ' + name); throw e; }
    }

    function handle(op, args) {
      switch (op) {
        case 'open':
          if (db) db.close();
          db = args.bytes ? new SQL.Database(new Uint8Array(args.bytes)) : new SQL.Database();
          registerFunctions(db);
          return { value: true };
        case 'exec':
          return { value: requireDb().exec(args.sql, args.params).map(function (r) { return { columns: r.columns, values: r.values }; }) };
        case 'run':
          requireDb().run(args.sql, args.params);
          return { value: db.getRowsModified() };
        case 'execMany': {
          var d1 = requireDb();
          var total = 0;
          withSavepoint(d1, 'dm_many', function () {
            for (var i = 0; i < args.statements.length; i++) {
              var st = args.statements[i];
              d1.run(typeof st === 'string' ? st : st.sql, typeof st === 'string' ? undefined : st.params);
              total += d1.getRowsModified();
            }
          });
          return { value: total };
        }
        case 'insertRows': {
          var d2 = requireDb();
          var cols = args.columns.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; });
          var placeholders = args.columns.map(function () { return '?'; }).join(', ');
          var sql = 'insert into "' + String(args.table).replace(/"/g, '""') + '" (' + cols.join(', ') + ') values (' + placeholders + ')';
          withSavepoint(d2, 'dm_insert', function () {
            var stmt = d2.prepare(sql);
            try { for (var i = 0; i < args.rows.length; i++) stmt.run(args.rows[i]); } finally { stmt.free(); }
          });
          return { value: args.rows.length };
        }
        case 'updateRows': {
          // args: table, column, pairs [[rowid, value], ...]
          var d3 = requireDb();
          var usql = 'update "' + String(args.table).replace(/"/g, '""') + '" set "' + String(args.column).replace(/"/g, '""') + '" = ? where rowid = ?';
          withSavepoint(d3, 'dm_update', function () {
            var stmt = d3.prepare(usql);
            try { for (var i = 0; i < args.pairs.length; i++) stmt.run([args.pairs[i][1], args.pairs[i][0]]); } finally { stmt.free(); }
          });
          return { value: args.pairs.length };
        }
        case 'regions':
          return { value: loadRegions(args.features) };
        case 'mount': {
          if (mounts[args.name]) { detachMount(args.name); mounts[args.name].db.close(); }
          mounts[args.name] = { db: new SQL.Database(new Uint8Array(args.bytes)), version: args.version || '' };
          return { value: true };
        }
        case 'unmount':
          if (mounts[args.name]) { detachMount(args.name); mounts[args.name].db.close(); delete mounts[args.name]; }
          return { value: true };
        case 'mounted': {
          var versions = {};
          for (var mk in mounts) versions[mk] = mounts[mk].version;
          return { value: versions };
        }
        case 'attach':
          ensureAttached(requireDb(), args.names || [], args.self || null);
          return { value: true };
        case 'query': {
          var dq = requireDb();
          ensureAttached(dq, args.names || [], args.self || null);
          if (args.readOnly) return { value: readOnlyQuery(dq, args.sql, args.params) };
          return { value: dq.exec(args.sql, args.params).map(function (r) { return { columns: r.columns, values: r.values }; }) };
        }
        case 'export': {
          // sql.js closes and reopens the connection to export, which drops custom functions, temp tables,
          // views and attachments; register the helpers again so later statements keep working.
          var bytes = requireDb().export();
          registerFunctions(db);
          return { value: bytes.buffer, transfer: [bytes.buffer] };
        }
        case 'close':
          if (db) db.close();
          db = null;
          return { value: true };
        case 'version':
          return { value: String(requireDb().exec('select sqlite_version()')[0].values[0][0]) };
        default:
          throw new Error('Unknown operation: ' + op);
      }
    }

    // A statement nobody at the keyboard wrote (an AI's): exactly one, and one that reads, run with the database locked against
    // writes, so that neither a second statement nor WITH … DELETE can change anything.
    function readOnlyQuery(d, sql, params) {
      var count = 0;
      for (var st of d.iterateStatements(String(sql))) {
        count++;
        var text = String(st.getSQL()).replace(/^(\s*(--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/))*/, '');
        var reads = /^\s*(select|with|values)\b/i.test(text);
        st.free();
        if (!reads || count > 1) throw new Error('DM_READ_ONLY: one statement that only reads');
      }
      if (count !== 1) throw new Error('DM_READ_ONLY: one statement that only reads');
      d.run('pragma query_only = 1');
      try { return d.exec(sql, params).map(function (r) { return { columns: r.columns, values: r.values }; }); }
      finally { d.run('pragma query_only = 0'); }
    }

    self.onmessage = function (ev) {
      var msg = ev.data;
      readyPromise.then(function () {
        var result = handle(msg.op, msg.args || {});
        self.postMessage({ id: msg.id, ok: true, value: result.value }, result.transfer || []);
      }).catch(function (err) {
        self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) });
      });
    };
  });
})();
