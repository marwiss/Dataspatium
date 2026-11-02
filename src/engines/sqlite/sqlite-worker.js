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
 * dm_fingerprint(), dm_squish(), dm_hash() (salted SHA-256 prefix) and dm_mask().
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
    var dm = self.__dataspatium;
    var readyPromise = dm.ready.then(function () {
      importScripts('dataspatium-asset://sqljs/sql-wasm.js');
      var wasm = dm.get('sqljs/sql-wasm.wasm');
      if (!wasm) throw new Error('sqljs/sql-wasm.wasm was not provided to the worker');
      return self.initSqlJs({ wasmBinary: wasm.data, locateFile: function (file) { return 'dataspatium-asset://sqljs/' + file; } });
    }).then(function (module) { SQL = module; });

    // ---- helper functions available in SQL -----------------------------------------------------
    var regexCache = { key: null, re: null };
    function regex(pattern, flags) {
      var key = pattern + '\u0000' + (flags || '');
      if (regexCache.key !== key) { regexCache.key = key; regexCache.re = new RegExp(pattern, flags || ''); }
      return regexCache.re;
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
    function registerFunctions(database) {
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
    }

    function requireDb() { if (!db) throw new Error('No database is open'); return db; }
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
        case 'export': {
          // sql.js closes and reopens the connection to export, which drops custom functions and temp
          // tables; register the helpers again so later statements keep working.
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
