// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What a file is by its contents (decision F83 a), for a file whose name has no extension an importer knows. Only the start of
 * the file is read (HEAD bytes with Blob.slice), and for a ZIP its central directory, for an OLE2 file its first directory
 * sector and for Parquet its last four bytes, from where the format puts them; never the whole file.
 *
 * Only sure signatures count. The order: binary signatures at fixed places first (SQLite and GeoPackage, ZIP by its entries,
 * PDF, TIFF, PNG, JPEG, GIF, WebP, BMP, AVIF, OLE2 with a workbook, Access, shapefile, SPSS, Stata, SAS, SAS transport,
 * Parquet, RData), then text (IFC with its FILE_SCHEMA, DXF, JSON that parses on the head with GeoJSON, TopoJSON and the
 * app's own `format`, XML and HTML by the root element, SQL script, LaTeX, PC-Axis, Cypher, Markdown) and last a table with the
 * same number of delimiters on every line. Anything else gives null, and the file keeps today's way. A pasted text in Inhämta is
 * recognised the same way (TEXT lists what a text can be).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/sniff', [], () => {
    /** How much of the start of a file is read. */
    const HEAD = 16384;
    /** The most of a ZIP's central directory that is read (the names of some ten thousand entries). */
    const DIRECTORY = 1 << 20;
    const SAS7BDAT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xc2, 0xea, 0x81, 0x60, 0xb3, 0x14, 0x11, 0xcf, 0xbd, 0x92, 0x08, 0x00, 0x09, 0xc7, 0x31, 0x8c, 0x18, 0x1f, 0x10, 0x11];

    /**
     * @typedef {{ext: string, format: string, type: string, id: string}} Sniffed the extension the file gets, the format's name
     *   as the preview says it, the media type, and the format's id in io/formats (the extension where the two are the same)
     */
    /**
     * A recognised format. The type stays empty where a reader would take the type before the extension (an image/ type goes
     * to the pictures, an XML type to the XML reader). @returns {Sniffed}
     */
    const hit = (ext, format, type = '', id = ext) => ({ ext, format, type, id });
    const ascii = (b, from, to) => { let s = ''; for (let i = from; i < Math.min(to, b.length); i++) s += String.fromCharCode(b[i]); return s; };
    const has = (b, list, at = 0) => b.length >= at + list.length && list.every((x, i) => b[at + i] === x);
    const u16 = (b, at) => (at + 2 <= b.length ? b[at] | (b[at + 1] << 8) : -1);
    const u32 = (b, at) => (at + 4 <= b.length ? (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0 : -1);
    const u32be = (b, at) => (at + 4 <= b.length ? ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0 : -1);
    const bytesOf = async (blob, from, to) => new Uint8Array(await blob.slice(from, to).arrayBuffer());

    // ---- ZIP ---------------------------------------------------------------------------------------------------------
    /** The names in a ZIP's central directory, read from where the end record points; null when there is none (or ZIP64). */
    async function zipNames(file) {
      const size = file.size;
      const tail = await bytesOf(file, Math.max(0, size - 65557), size);
      for (let i = tail.length - 22; i >= 0; i--) {
        if (!has(tail, [0x50, 0x4b, 5, 6], i)) continue;
        const cdSize = u32(tail, i + 12); const cdOffset = u32(tail, i + 16);
        if (cdSize === 0xffffffff || cdOffset === 0xffffffff || cdOffset + cdSize > size) return null;
        const cd = await bytesOf(file, cdOffset, cdOffset + Math.min(cdSize, DIRECTORY));
        const names = []; const decoder = new TextDecoder('utf-8');
        for (let p = 0; p + 46 <= cd.length && has(cd, [0x50, 0x4b, 1, 2], p);) {
          const nameLen = u16(cd, p + 28); const extra = u16(cd, p + 30); const comment = u16(cd, p + 32);
          if (p + 46 + nameLen > cd.length) break;
          names.push(decoder.decode(cd.subarray(p + 46, p + 46 + nameLen)));
          p += 46 + nameLen + extra + comment;
        }
        return names;
      }
      return null;
    }
    /** A ZIP the app reads, by its entries: OpenDocument by its first entry, the others by the names in the directory. */
    async function zipKind(file, b) {
      const nameLen = u16(b, 26); const extra = u16(b, 28);
      if (ascii(b, 30, 30 + nameLen) === 'mimetype' && u16(b, 8) === 0) {
        const at = 30 + nameLen + extra;
        const mime = ascii(b, at, at + Math.min(u32(b, 18), 100)).trim();
        if (mime === 'application/vnd.oasis.opendocument.spreadsheet') return hit('ods', 'ODS', mime);
        if (mime === 'application/vnd.oasis.opendocument.text') return hit('odt', 'ODT', mime);
        return null;
      }
      const names = await zipNames(file);
      if (!names || !names.length) return null;
      const any = (re) => names.some((n) => re.test(n));
      if (any(/^\[Content_Types\]\.xml$/)) {
        if (any(/^xl\/workbook\.bin$/)) return hit('xlsb', 'XLSB', 'application/vnd.ms-excel.sheet.binary.macroEnabled.12');
        if (any(/^xl\/workbook\.xml$/)) return hit('xlsx', 'XLSX', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        if (any(/^word\/document\.xml$/)) return hit('docx', 'DOCX', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return null;
      }
      // An archive package, a data package and a delivery of an översiktsplan have readers of their own for a .zip (io/import).
      if (any(/(^|\/)metadata\/premis\.xml$/i) || any(/^([^/]+\/)?datapackage\.json$/)) return hit('zip', 'ZIP', 'application/zip');
      if (any(/\.gpkg$/i) && (any(/\.docx$/i) || any(/(^|\/)(manifest|metadata)\.xml$/i))) return hit('zip', 'ZIP', 'application/zip');
      if (any(/(^|\/)bcf\.version$/i) || any(/(^|\/)markup\.bcf$/i)) return hit('bcfzip', 'BCF');
      if (any(/\.qgs$/i)) return hit('qgz', 'QGIS');
      // Shapefiles first, as a .zip name reads them today.
      if (any(/\.shp$/i)) return hit('zip', 'Shapefile (ZIP)', 'application/zip');
      if (any(/\.ifc$/i)) return hit('ifczip', 'IFCZIP');
      if (any(/\.kml$/i)) return hit('kmz', 'KMZ', 'application/vnd.google-earth.kmz');
      return null;
    }

    // ---- OLE2 (Excel 97-2003) ----------------------------------------------------------------------------------------
    /** An OLE2 compound file is an Excel workbook when its first directory sector names a Workbook (or Book) stream. */
    async function oleKind(file, b) {
      const shift = u16(b, 0x1e);
      if (shift !== 9 && shift !== 12) return null;
      const sector = 1 << shift; const first = u32(b, 0x30);
      if (first >= 0xfffffffa) return null;
      const at = (first + 1) * sector;
      const dir = at + sector <= b.length ? b.subarray(at, at + sector) : await bytesOf(file, at, at + sector);
      const names = [];
      for (let e = 0; e + 128 <= dir.length; e += 128) {
        const len = Math.min(64, u16(dir, e + 0x40));
        let name = '';
        for (let i = 0; i + 1 < len - 2; i += 2) name += String.fromCharCode(dir[e + i] | (dir[e + i + 1] << 8));
        names.push(name);
      }
      return names.some((n) => n === 'Workbook' || n === 'Book') ? hit('xls', 'XLS', 'application/vnd.ms-excel') : null;
    }

    // ---- binary signatures at fixed places ---------------------------------------------------------------------------
    /** @returns {Promise<Sniffed|null|undefined>} undefined when no binary signature matches (the file may be text) */
    async function binary(file, b) {
      if (ascii(b, 0, 16) === 'SQLite format 3\0') {
        return /^(GPKG|GP1\d)$/.test(ascii(b, 68, 72)) ? hit('gpkg', 'GeoPackage', 'application/geopackage+sqlite3') : hit('sqlite', 'SQLite', 'application/vnd.sqlite3');
      }
      if (has(b, [0x50, 0x4b, 3, 4])) return zipKind(file, b);
      if (/^(\xEF\xBB\xBF)?\s*%PDF-\d/.test(ascii(b, 0, 64))) return hit('pdf', 'PDF', 'application/pdf');
      if (has(b, [0x49, 0x49, 0x2a, 0]) || has(b, [0x4d, 0x4d, 0, 0x2a]) || has(b, [0x49, 0x49, 0x2b, 0]) || has(b, [0x4d, 0x4d, 0, 0x2b])) return hit('tif', 'TIFF', 'image/tiff');
      if (has(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return hit('png', 'PNG', 'image/png');
      if (has(b, [0xff, 0xd8, 0xff])) return hit('jpg', 'JPEG', 'image/jpeg');
      if (/^GIF8[79]a$/.test(ascii(b, 0, 6))) return hit('gif', 'GIF', 'image/gif');
      if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return hit('webp', 'WebP', 'image/webp');
      if (ascii(b, 0, 2) === 'BM' && u32(b, 6) === 0 && [12, 40, 52, 56, 64, 108, 124].includes(u32(b, 14))) return hit('bmp', 'BMP', 'image/bmp');
      if (ascii(b, 4, 8) === 'ftyp' && /avi[fs]/.test(ascii(b, 8, Math.min(u32be(b, 0), 64)))) return hit('avif', 'AVIF', 'image/avif');
      if (has(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return oleKind(file, b);
      const jet = ascii(b, 4, 19);
      if (jet === 'Standard Jet DB') return hit('mdb', 'Access (MDB)', 'application/x-msaccess');
      if (jet === 'Standard ACE DB') return hit('accdb', 'Access (ACCDB)', 'application/x-msaccess');
      // A shapefile's .shx index has the same header; in the .shp the first record is number 1.
      if (u32be(b, 0) === 9994 && u32(b, 28) === 1000 && (file.size === 100 || u32be(b, 100) === 1)) return hit('shp', 'Shapefile');
      if (ascii(b, 0, 4) === '$FL2') return hit('sav', 'SPSS');
      if (ascii(b, 0, 4) === '$FL3') return hit('zsav', 'SPSS (zsav)');
      if (ascii(b, 0, 11) === '<stata_dta>') return hit('dta', 'Stata');
      if (has(b, SAS7BDAT)) return hit('sas7bdat', 'SAS');
      if (/^HEADER RECORD\*{7}LIB(RARY|V8) HEADER RECORD!{7}/.test(ascii(b, 0, 48))) return hit('xpt', 'SAS XPORT');
      if (ascii(b, 0, 4) === 'PAR1' && file.size >= 12) return ascii(await bytesOf(file, file.size - 4, file.size), 0, 4) === 'PAR1' ? hit('parquet', 'Parquet') : null;
      if (/^RD[AX][23]\n/.test(ascii(b, 0, 5))) return hit('rdata', 'RData');
      return undefined;
    }

    // ---- text ----------------------------------------------------------------------------------------------------------
    /** The head as text (UTF-8, or UTF-16 with a byte order mark), or null when it holds a NUL or many control characters. */
    function textOf(b) {
      let encoding = 'utf-8'; let from = 0;
      if (b[0] === 0xff && b[1] === 0xfe) { encoding = 'utf-16le'; from = 2; } else if (b[0] === 0xfe && b[1] === 0xff) { encoding = 'utf-16be'; from = 2; } else if (has(b, [0xef, 0xbb, 0xbf])) from = 3;
      const text = new TextDecoder(encoding).decode(b.subarray(from));
      let control = 0;
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === 0) return null;
        if (c < 32 && c !== 9 && c !== 10 && c !== 13 && c !== 12 && c !== 27) control++;
      }
      return control * 100 > text.length ? null : text;
    }

    const NUMBER = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y;
    /**
     * Whether a text is JSON, or, when the file goes on after the head (`complete` false), the start of JSON: every token so
     * far in its place. Objects or arrays on lines of their own, one after the other, are JSON Lines.
     * @param {string} s @param {boolean} complete @returns {{lines: boolean}|null}
     */
    function jsonCheck(s, complete) {
      if (complete) {
        try { JSON.parse(s); return { lines: false }; } catch (_err) { /* perhaps JSON Lines */ }
        const rows = s.split(/\r?\n/).filter((l) => l.trim());
        if (rows.length < 2) return null;
        try {
          for (const row of rows) { const v = JSON.parse(row); if (!v || typeof v !== 'object') return null; }
          return { lines: true };
        } catch (_err) { return null; }
      }
      const stack = []; let state = 'value'; let lines = false; let tokens = 0;
      const after = () => (stack.length ? 'next' : 'end');
      for (let i = 0; i < s.length;) {
        const c = s[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
        const rest = s.slice(i, i + 32);
        tokens++;
        if (state === 'end') {
          // A second value after the first, on a line of its own: JSON Lines.
          if ((c === '{' || c === '[') && /\n\s*$/.test(s.slice(Math.max(0, i - 32), i))) { lines = true; state = 'value'; continue; }
          return null;
        }
        if (state === 'next') {
          if (c === ',') { state = stack[stack.length - 1] === '}' ? 'key' : 'value'; i++; continue; }
          if (c === stack[stack.length - 1]) { stack.pop(); state = after(); i++; continue; }
          return null;
        }
        if (state === 'colon') { if (c !== ':') return null; state = 'value'; i++; continue; }
        if (c === '}' && state === 'key?') { stack.pop(); state = after(); i++; continue; }
        if (c === ']' && state === 'value?') { stack.pop(); state = after(); i++; continue; }
        if (c === '"') {
          // A string: to its closing quote; one cut by the end of the head counts, a raw line break does not.
          let j = i + 1;
          for (; j < s.length && s[j] !== '"'; j++) { if (s[j] === '\\') j++; else if (s[j] === '\n' || s[j] === '\r') return null; }
          if (j >= s.length) return { lines };
          i = j + 1; state = state === 'key' || state === 'key?' ? 'colon' : after(); continue;
        }
        if (state === 'key' || state === 'key?') return null;
        if (c === '{') { stack.push('}'); state = 'key?'; i++; continue; }
        if (c === '[') { stack.push(']'); state = 'value?'; i++; continue; }
        // A number or a literal; one cut by the end of the head counts when what is there could begin it.
        if (i + rest.length >= s.length && (/^-?\d*\.?\d*([eE][+-]?\d*)?$/.test(rest) || ['true', 'false', 'null'].some((w) => w.startsWith(rest)))) return { lines };
        const word = ['true', 'false', 'null'].find((w) => rest.startsWith(w));
        if (word) { i += word.length; state = after(); continue; }
        NUMBER.lastIndex = i;
        const m = NUMBER.exec(s);
        if (!m || !m[0].length) return null;
        i += m[0].length; state = after();
      }
      return tokens > 1 || state === 'end' ? { lines } : null;
    }
    function jsonKind(t, complete) {
      const r = jsonCheck(t, complete);
      if (!r) return null;
      if (r.lines) return hit('ndjson', 'NDJSON', 'application/x-ndjson');
      if (/^\{[\s\S]*?"type"\s*:\s*"Topology"/.test(t)) return hit('topojson', 'TopoJSON', 'application/json');
      if (/"type"\s*:\s*"(FeatureCollection|Feature)"/.test(t)) return hit('geojson', 'GeoJSON', 'application/geo+json');
      const own = /"format"\s*:\s*"(dataspatium-[a-z-]+\/\d+)"/.exec(t);
      return hit('json', own ? `JSON (${own[1]})` : 'JSON', 'application/json');
    }

    const SKIP = /\s+|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/iy;
    /** The root element after the prolog, comments and doctype: its prefix, local name, attributes and namespace. */
    function rootOf(t) {
      let i = 0;
      for (;;) { SKIP.lastIndex = i; const m = SKIP.exec(t); if (!m || !m[0].length) break; i += m[0].length; }
      const re = /<([A-Za-z_][\w.-]*)(?::([A-Za-z_][\w.-]*))?(\s[^<>]*)?\/?>/y;
      re.lastIndex = i;
      const m = re.exec(t);
      if (!m) return null;
      const prefix = m[2] ? m[1] : ''; const attrs = m[3] || '';
      const ns = (new RegExp(`xmlns${prefix ? ':' + prefix : ''}\\s*=\\s*["']([^"']*)["']`).exec(attrs) || [])[1] || '';
      return { prefix, local: m[2] || m[1], attrs, ns };
    }
    function xmlKind(t) {
      if (/^(<!--[\s\S]*?-->\s*)*<!doctype\s+html\b/i.test(t)) return hit('html', 'HTML', 'text/html');
      const root = rootOf(t);
      if (!root) return null;
      const name = root.local.toLowerCase();
      if (name === 'html') return hit('html', 'HTML', 'text/html');
      if (name === 'kml') return hit('kml', 'KML', 'application/vnd.google-earth.kml+xml');
      if (name === 'gpx') return hit('gpx', 'GPX', 'application/gpx+xml');
      if (name === 'graphml') return hit('graphml', 'GraphML');
      if (name === 'gexf') return hit('gexf', 'GEXF');
      if (name === 'qgis') return hit('qgs', 'QGIS');
      if (name === 'svg') return null;
      if (name === 'document' && /opendocument\.spreadsheet/.test(root.attrs)) return hit('fods', 'FODS', 'application/vnd.oasis.opendocument.spreadsheet');
      if (name === 'workbook' && /urn:schemas-microsoft-com:office:spreadsheet/.test(t)) return hit('xml', 'Excel 2003 XML', 'application/xml', 'excelxml');
      // A tag with neither the XML declaration nor a namespace is not sure to be XML.
      if (!/^<\?xml\s/.test(t) && !root.ns) return null;
      if (/opengis\.net\/(gml|wfs)/.test(t.slice(0, 4096))) return hit('xml', 'GML', 'application/gml+xml');
      if (/buildingsmart\.org\/ids/i.test(root.ns)) return hit('xml', 'IDS', 'application/xml');
      return hit('xml', `XML (${root.local})`, 'application/xml');
    }

    const SQL_LEAD = /\s+|--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/;?|(PRAGMA|SET|DROP\s+TABLE|BEGIN(\s+TRANSACTION)?)\b[^;]*;/iy;
    /** A SQL script (a database dump): statements the importer passes over, then CREATE TABLE, VIEW or INDEX. */
    function sqlKind(t) {
      let i = 0;
      for (let n = 0; n < 200; n++) { SQL_LEAD.lastIndex = i; const m = SQL_LEAD.exec(t); if (!m || !m[0].length) break; i += m[0].length; }
      return /^CREATE\s+(TABLE|VIEW|(UNIQUE\s+)?INDEX)\b/i.test(t.slice(i, i + 64)) ? hit('sql', 'SQL', 'application/sql') : null;
    }
    /** A delimiter outside quotes, counted. */
    function count(line, d) {
      let n = 0; let quoted = false;
      for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') quoted = !quoted; else if (c === d && !quoted) n++; }
      return n;
    }
    /**
     * Markdown, by what only Markdown writes: a pipe table with its line of dashes, a fenced code block, a heading first with an
     * empty line or another mark of Markdown after it, or three kinds of marks (headings, lists, quotes, links, bold text,
     * underlined headings). A script whose comments start with # has none of the others.
     */
    function markdownKind(t) {
      const lines = t.split(/\r\n|\n|\r/).slice(0, 400);
      const marks = new Set();
      let first = -1; let fences = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (first < 0 && line.trim()) first = i;
        if (/^ {0,3}(```|~~~)/.test(line)) fences++;
        if (/^ {0,3}#{1,6}\s+\S/.test(line)) marks.add('heading');
        if (/^ {0,3}([-*+]|\d{1,3}[.)])\s+\S/.test(line)) marks.add('list');
        if (/^ {0,3}>\s?\S/.test(line)) marks.add('quote');
        if (/!?\[[^\]\n]+\]\([^)\s]+\)/.test(line)) marks.add('link');
        if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(line)) marks.add('bold');
        if (i > 0 && /^(={3,}|-{3,})\s*$/.test(line) && /\S/.test(lines[i - 1]) && !/^ {0,3}([-*+]\s|#)/.test(lines[i - 1])) marks.add('setext');
        if (i > 0 && lines[i - 1].includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) return hit('md', 'Markdown', 'text/markdown');
      }
      if (fences >= 2) return hit('md', 'Markdown', 'text/markdown');
      const headed = first >= 0 && /^ {0,3}#{1,6}\s+\S/.test(lines[first]);
      const blankAfter = headed && first + 1 < lines.length && !lines[first + 1].trim();
      return (headed && (blankAfter || marks.size >= 2)) || marks.size >= 3 ? hit('md', 'Markdown', 'text/markdown') : null;
    }
    /**
     * A table: the same number of one delimiter on every line (at least three lines, or two delimiters a line; two lines with
     * tabs, which prose seldom has, as two columns copied from a spreadsheet are).
     */
    function tableKind(t, complete) {
      const all = t.split(/\r\n|\n|\r/);
      if (!complete) all.pop();
      const lines = all.filter((l) => l.trim() !== '').slice(0, 50);
      if (lines.length < 2) return null;
      for (const d of ['\t', ';', ',', '|']) {
        if (d === '|' && lines[0].trim().startsWith('|')) continue;
        const first = count(lines[0], d);
        if (first < 1 || (lines.length < 3 && first < 2 && d !== '\t')) continue;
        if (lines.every((l) => count(l, d) === first)) return d === '\t' ? hit('tsv', 'TSV', 'text/tab-separated-values') : hit('csv', 'CSV', 'text/csv');
      }
      return null;
    }
    /** @returns {Sniffed|null} */
    function text(t, complete) {
      const s = t.replace(/^﻿/, '').trimStart();
      if (!s) return null;
      if (/^ISO-10303-21\s*;/.test(s)) {
        const schema = /FILE_SCHEMA\s*\(\s*\(\s*'(IFC[0-9A-Z_]*)'/i.exec(s);
        return schema ? hit('ifc', `IFC (${schema[1].toUpperCase()})`) : null;
      }
      if (/^(999\r?\n[^\r\n]*\r?\n\s*)*0\r?\n\s*SECTION\s*\r?\n\s*2\r?\n\s*(HEADER|CLASSES|TABLES|BLOCKS|ENTITIES|OBJECTS)\s*\r?\n/.test(s)) return hit('dxf', 'DXF');
      if (s[0] === '{' || s[0] === '[') { const json = jsonKind(s, complete); if (json) return json; }
      if (s[0] === '<') { const xml = xmlKind(s); if (xml) return xml; }
      const sql = sqlKind(s);
      if (sql) return sql;
      if (/^(%[^\n]*\n\s*)*\\documentclass\b/.test(s)) return hit('tex', 'LaTeX', 'application/x-tex');
      if (/^(CHARSET|AXIS-VERSION|CODEPAGE|LANGUAGE|CREATION-DATE|DECIMALS|MATRIX)\s*=/.test(s) && /^(STUB|HEADING)(\[[^\]]*\])?\s*=/m.test(s)) return hit('px', 'PC-Axis (PX)');
      if (/^(\/\/[^\n]*\n\s*)*(CREATE|MERGE|:begin|UNWIND)\b/i.test(s) && /\b(CREATE|MERGE)\s*\(\s*[A-Za-z_]*\s*:\s*`?[A-Za-z_]/i.test(s)) return hit('cypher', 'Cypher');
      return markdownKind(s) || tableKind(s, complete);
    }

    /**
     * What a file is by its first bytes, or null when no signature is sure.
     * @param {Blob} file @returns {Promise<Sniffed|null>}
     */
    async function sniff(file) {
      if (!file || !file.size) return null;
      const b = await bytesOf(file, 0, HEAD);
      const found = await binary(file, b);
      if (found !== undefined) return found;
      const t = textOf(b);
      return t === null ? null : text(t, file.size <= HEAD);
    }

    /**
     * Whether a file reads as text by its first bytes (no NUL, few control characters), for a file no signature knows: it is then
     * read as a text document, not as a table (decision F119 a). @param {Blob} file @returns {Promise<boolean>}
     */
    async function isText(file) {
      if (!file || !file.size) return false;
      return textOf(await bytesOf(file, 0, HEAD)) !== null;
    }

    /**
     * The formats a text is recognised as (text above), by their ids in io/formats and in the order they are tried. Klistra in
     * names the formats of io/formats that a text is recognised as (pasted), and tests/sniff.test.js keeps the two the same. GML
     * and IDS are XML here.
     */
    const TEXT = ['ifc', 'dxf', 'ndjson', 'topojson', 'geojson', 'json', 'html', 'kml', 'gpx', 'graphml', 'gexf', 'qgs', 'fods', 'excelxml', 'xml', 'sql', 'tex', 'px', 'cypher', 'md', 'csv', 'tsv'];

    return { sniff, isText, HEAD, TEXT };
  });
})();
