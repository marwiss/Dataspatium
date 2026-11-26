// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A digital översiktsplan as it is delivered (B-73, B-73.1, F105 a): a folder, a ZIP or a choice of files with one or more
 * GeoPackages (the plan map in Boverket's ÖP model, perhaps underlag), one or more Word files (the text document and its
 * appendices) and sometimes a manifest.xml and a metadata.xml. Together they become one dataset of the kind `plan` (slag
 * oversiktsplan): every layer's objects as rows (OP_COLUMNS, with the layer in `lager` and the GeoPackage in `fil`), every file
 * of the delivery in `_files` with its role as its kind, the text document's bookmarks in `_sections` and their links to the
 * map's objects in `_section_links`, and what was checked in `_meta.plan.leverans`. A GeoPackage on its own can also become a
 * dataset of the kind `layers` (all its feature layers, chosen for display afterwards).
 *
 * The files are sorted by their contents, not their names: a GeoPackage by its SQLite header and tables, a Word file by its ZIP
 * entries, a manifest or metadata file by its root element. The link between the map and the text is the Word bookmark: the
 * GeoPackage's `dokumentavsnitt` has a row per bookmark and object (many to many), and the text itself is only in the DOCX.
 * manifest.xml and metadata.xml have no formal role (underlag/op-leverans.md): they are read when present and never required.
 * Nothing is fetched and nothing in the files runs: XML with a DOCTYPE is refused (no entities), relationships to other places
 * are never followed, macros are never run, and the DOCX text only ever reaches the DOM as text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/plan-delivery', ['data/plan', 'data/plan-links', 'data/geo', 'data/datasets', 'data/dataset-files', 'io/importers/sqlite', 'io/importers/detaljplan', 'platform/storage/zip'], (plan, planLinks, geo, datasets, dsFiles, sqliteImp, dpImp, zip) => {
    const t = (key, params) => D.t(key, params);
    const SECTIONS = '_sections';
    const LINKS = '_section_links';
    /** `_sections`: one row per bookmark of a Word file (or named by the GeoPackage and missing in the files). */
    const SECTION_COLUMNS = [{ name: 'avsnitt', type: 'text' }, { name: 'dokument', type: 'text' }, { name: 'rubrik', type: 'text' }, { name: 'text', type: 'text' }, { name: 'typ', type: 'text' }, { name: 'ordning', type: 'integer' }];
    /**
     * `_section_links`: one row per bookmark and object; objektid '' is the whole plan. `kalla` says where the link was read
     * (data/plan-links: modell, tabell, attribut, or text for an area the text only names); plans read before it have no such column.
     */
    const LINK_COLUMNS = [{ name: 'avsnitt', type: 'text' }, { name: 'objektid', type: 'text' }, { name: 'dokument', type: 'text' }, { name: 'typ', type: 'text' }, { name: 'kalla', type: 'text' }];
    /** The columns of a dataset of the kind `layers`: one feature per row, its attributes as JSON, geometry as GeoJSON in WGS 84. */
    const LAYER_COLUMNS = [{ name: 'lager', type: 'text' }, { name: 'fil', type: 'text' }, { name: 'objektid', type: 'text' }, { name: 'geometrityp', type: 'text' }, { name: 'geometri', type: 'text' }, { name: 'egenskaper', type: 'text' }, { name: 'ordning', type: 'integer' }];
    /** The bookmark names the exchange model allows (OP-JSON-003); others are read and only warned about. */
    const BOOKMARK_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
    const TYPES = { gpkg: 'application/geopackage+sqlite3', sqlite: 'application/vnd.sqlite3', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt: 'application/vnd.oasis.opendocument.text', pdf: 'application/pdf', xml: 'application/xml' };
    const JUNK = /^(thumbs\.db|desktop\.ini|\.ds_store)$|^\._/i;
    /** The most a Word part or an XML file may unpack to; a larger one (a ZIP bomb) is refused before it is unpacked. */
    const MAX_XML = 64 * 1024 * 1024;
    /** The warnings kept with a plan, at most; the rest are counted. */
    const MAX_WARNINGS = 60;
    /** The GeoPackage tables the links are read from (small), besides the content tables' ids. */
    const LINK_TABLES = ['oversiktsplan', 'dokumentreferens_op', 'dokumentavsnitt', 'avsnittsbokmärke', 'avsnittsbokmarke', 'avsnittstyp_varde_lookup'];

    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const clean = (s) => str(s).replace(/\s+/g, ' ').trim();
    const pathOf = (f) => str(/** @type {any} */ (f).dmPath || /** @type {any} */ (f).webkitRelativePath || f.name).replace(/\\/g, '/');
    const baseOf = (p) => str(p).split('/').pop() || '';
    const stemOf = (p) => baseOf(p).replace(/\.[^.]+$/, '');
    const listed = (names) => names.slice(0, 8).join(', ') + (names.length > 8 ? ' …' : '');
    const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

    // ---- what a file is, by its contents ----------------------------------------------------------------------
    const ascii = (bytes, a, b) => String.fromCharCode(...Array.from(bytes.subarray(a, b)));
    /**
     * What a file is by its first bytes: 'sqlite' (with `gpkg` when its application id says GeoPackage), 'zip', 'pdf', 'xml' or ''.
     * @param {Uint8Array} bytes @returns {{sort: string, gpkg?: boolean}}
     */
    function sniffHead(bytes) {
      if (bytes.length >= 16 && ascii(bytes, 0, 15) === 'SQLite format 3') return { sort: 'sqlite', gpkg: bytes.length >= 72 && /^(GPKG|GP1\d)$/.test(ascii(bytes, 68, 72)) };
      if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5)) return { sort: 'zip' };
      if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return { sort: 'pdf' };
      const text = new TextDecoder('utf-8').decode(bytes.subarray(0, 512)).replace(/^﻿/, '').trimStart();
      return { sort: text.startsWith('<') ? 'xml' : '' };
    }
    /** The root element of an XML text: its local name and its namespace, after the prolog and comments. */
    function rootOf(text) {
      const s = str(text).replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g, '');
      const m = /<([A-Za-z_][\w.-]*)(?::([A-Za-z_][\w.-]*))?([^>]*)>/.exec(s);
      if (!m) return { local: '', ns: '' };
      const prefix = m[2] ? m[1] : '';
      const ns = (new RegExp(`xmlns${prefix ? ':' + prefix : ''}\\s*=\\s*["']([^"']*)["']`).exec(m[3]) || [])[1] || '';
      return { local: m[2] || m[1], ns };
    }
    /** The role of an XML file: 'manifest' or 'metadata' by its name or its root element (ODF, METS, ISO 19139/19115-3, PREMIS), else ''. */
    function xmlRole(name, root) {
      if (/(^|\/)manifest\.xml$/i.test(name) || /^(manifest|mets|sip)$/i.test(root.local) || /opendocument.*manifest|loc\.gov\/mets/i.test(root.ns)) return 'manifest';
      if (/(^|\/)metadata\.xml$/i.test(name) || /^(md_metadata|mi_metadata|premis)$/i.test(root.local) || /isotc211|iso\/19115|premis/i.test(root.ns)) return 'metadata';
      return '';
    }
    /**
     * One file of a delivery, sorted by its contents: sort ('sqlite', 'docx', 'odt', 'package' for a ZIP holding a GeoPackage,
     * 'zip', 'pdf', 'xml' or ''), its path and name, and for XML its root element.
     * @param {File} file @param {string} [path]
     */
    async function classify(file, path) {
      const p = path || pathOf(file);
      const head = sniffHead(new Uint8Array(await file.slice(0, 4096).arrayBuffer()));
      /** @type {any} */
      const out = { file, path: p, name: baseOf(p), size: file.size, sort: head.sort, gpkgHeader: !!head.gpkg, role: '', stored: '' };
      if (head.sort === 'zip') {
        let entries = [];
        try { entries = await zip.listZip(file); } catch (_err) { entries = []; }
        const names = entries.map((e) => e.name);
        if (names.includes('word/document.xml')) { out.sort = 'docx'; out.macros = names.some((n) => /vbaProject\.bin$/i.test(n)); }
        else if (names.includes('content.xml') && names.includes('mimetype')) out.sort = 'odt';
        else if (names.some((n) => /\.gpkg$/i.test(n))) out.sort = 'package';
      } else if (head.sort === 'xml') {
        out.root = rootOf(await file.slice(0, 8192).text());
      }
      return out;
    }

    // ---- XML, read without running anything ----------------------------------------------------------------
    const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
    const codePoint = (n) => (Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');
    const decodeXml = (s) => s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => (e[0] === '#' ? codePoint(/x/i.test(e[1]) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] !== undefined ? ENTITIES[e] : m));
    const localOf = (q) => q.slice(q.indexOf(':') + 1);
    /** The platform's parser: elements, attributes by local name and text, in document order, without recursion. */
    function domEvents(text, on) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error(t('plan.delivery.err.xml'));
      /** @type {Array<[Node, boolean]>} */
      const stack = [[doc.documentElement, false]];
      while (stack.length) {
        const [node, closing] = /** @type {[any, boolean]} */ (stack.pop());
        if (closing) { on.close(node.localName); continue; }
        if (node.nodeType === 3 || node.nodeType === 4) { on.text(node.data); continue; }
        if (node.nodeType !== 1) continue;
        const attrs = {};
        for (const a of Array.from(/** @type {NamedNodeMap} */ (node.attributes))) attrs[a.localName] = a.value;
        on.open(node.localName, attrs);
        stack.push([node, true]);
        for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push([node.childNodes[i], false]);
      }
    }
    /** Where no DOMParser is (a worker, Node): a tokenizer for well-formed XML with the five entities and character references. */
    function textEvents(text, on) {
      const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
      const attrRe = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let m;
      while ((m = re.exec(text))) {
        if (m[1] !== undefined) on.text(m[1]);
        else if (m[2]) on.close(localOf(m[2]));
        else if (m[3]) {
          const attrs = {};
          let a;
          attrRe.lastIndex = 0;
          while ((a = attrRe.exec(m[4] || ''))) attrs[localOf(a[1])] = decodeXml(a[2] !== undefined ? a[2] : a[3]);
          const name = localOf(m[3]);
          on.open(name, attrs);
          if (m[5]) on.close(name);
        } else if (m[6] !== undefined) on.text(decodeXml(m[6]));
      }
    }
    /**
     * An XML text as events {open(name, attrs), close(name), text(s)} with local names. A document type declaration is refused:
     * a Word file never has one, and its entities could expand without end.
     * @param {string} text @param {{open: Function, close: Function, text: Function}} on @param {{fallback?: boolean}} [options]
     */
    function xmlEvents(text, on, options = {}) {
      if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error(t('plan.delivery.err.doctype'));
      if (typeof DOMParser === 'function' && !options.fallback) domEvents(text, on); else textEvents(text, on);
    }
    /** An XML text as a small tree {name, attrs, children, text} (for manifests and metadata). */
    function treeOf(text) {
      const root = { name: '', attrs: {}, children: [], text: '', parent: null };
      let cur = root;
      xmlEvents(text, {
        open(name, attrs) { const n = { name, attrs, children: [], text: '', parent: cur }; cur.children.push(n); cur = n; },
        close() { if (cur.parent) cur = cur.parent; },
        text(s) { cur.text += s; },
      });
      return root.children[0] || null;
    }

    // ---- Word: bookmarks with their text and the nearest heading ------------------------------------------
    const HEADING_STYLE = /heading|rubrik|overskrift|otsikko|fyrirs|^title$|^titel$/i;
    const HEADING_NAME = /^(heading|rubrik|overskrift|otsikko|fyrirsögn|title|titel)\b/i;
    /** The ids of a document's heading styles (word/styles.xml): by their names, or by an outline level. */
    function headingStylesOf(xml) {
      const out = new Set();
      if (!xml) return out;
      let style = null;
      xmlEvents(xml, {
        open(name, a) {
          if (name === 'style') style = a.type === 'paragraph' || !a.type ? str(a.styleId) : null;
          else if (style && name === 'name' && HEADING_NAME.test(str(a.val))) out.add(style);
          else if (style && name === 'outlineLvl' && Number(a.val) >= 0 && Number(a.val) < 9) out.add(style);
        },
        close(name) { if (name === 'style') style = null; },
        text() {},
      });
      return out;
    }
    const SKIP = new Set(['del', 'moveFrom', 'instrText', 'delText', 'delInstrText']);
    /**
     * The bookmarks of a Word document (word/document.xml): each w:bookmarkStart with its w:name and w:id through the matching
     * w:bookmarkEnd, across runs and paragraphs (they may overlap), with the plain text of that range (or of its paragraph when the
     * range is empty), the nearest heading at or before its start (a paragraph style named as a heading, or an outline level) and
     * its place in the document. Deleted text and field codes are left out. Names that begin with _ (Word's own, such as _Toc and
     * _GoBack) are marked hidden; a bookmark without an end runs to the end of the document.
     * @param {string} xml @param {Set<string>} [headingStyles] @param {{fallback?: boolean}} [options]
     * @returns {Array<{name: string, id: string, text: string, rubrik: string, hidden: boolean, noEnd: boolean, order: number}>}
     */
    function bookmarksOf(xml, headingStyles, options = {}) {
      const styles = headingStyles || new Set();
      const paragraphs = [];
      const stack = [];
      const open = new Map();
      const all = [];
      let inText = 0; let skip = 0; let inPPr = 0;
      const top = () => stack[stack.length - 1] || null;
      const add = (s) => { const p = top(); if (p) p.parts.push(s); for (const bm of open.values()) bm.parts.push(s); };
      xmlEvents(xml, {
        open(name, a) {
          switch (name) {
            case 'p': { const p = { index: paragraphs.length, parts: [], style: '', outline: -1, text: '', heading: false }; paragraphs.push(p); stack.push(p); break; }
            case 'pPr': inPPr++; break;
            case 'pStyle': if (inPPr && top()) top().style = str(a.val); break;
            case 'outlineLvl': if (inPPr && top()) top().outline = Number(a.val); break;
            case 't': inText++; break;
            case 'tab': case 'br': case 'cr': if (!skip && !inPPr) add(' '); break;
            case 'bookmarkStart': {
              const bname = str(a.name);
              if (!bname) break;
              const bm = { id: str(a.id), name: bname, start: top() ? top().index : paragraphs.length, parts: [], closed: false, order: all.length };
              open.set(bm.id, bm); all.push(bm);
              break;
            }
            case 'bookmarkEnd': { const bm = open.get(str(a.id)); if (bm) { bm.closed = true; open.delete(bm.id); } break; }
            default: if (SKIP.has(name)) skip++;
          }
        },
        close(name) {
          if (name === 'p') {
            const p = stack.pop();
            if (!p) return;
            p.text = clean(p.parts.join(''));
            p.parts = null;
            p.heading = (p.outline >= 0 && p.outline < 9) || (!!p.style && (styles.has(p.style) || HEADING_STYLE.test(p.style)));
            for (const bm of open.values()) bm.parts.push('\n');
          } else if (name === 'pPr') inPPr = Math.max(0, inPPr - 1);
          else if (name === 't') inText = Math.max(0, inText - 1);
          else if (SKIP.has(name)) skip = Math.max(0, skip - 1);
        },
        text(s) { if (inText && !skip) add(s); },
      }, options);
      // The nearest heading at or before each paragraph, in one pass.
      const heading = new Array(paragraphs.length);
      let last = -1;
      for (let i = 0; i < paragraphs.length; i++) { if (paragraphs[i].heading) last = i; heading[i] = last; }
      return all.map((bm) => {
        const text = bm.parts.join('').split('\n').map(clean).filter(Boolean).join('\n');
        const at = Math.min(bm.start, paragraphs.length - 1);
        const h = at >= 0 ? heading[at] : -1;
        const own = paragraphs[bm.start];
        return { name: bm.name, id: bm.id, text: text || (own ? own.text : ''), rubrik: h >= 0 ? paragraphs[h].text : '', hidden: bm.name.startsWith('_'), noEnd: !bm.closed, order: bm.order };
      });
    }
    /**
     * The bookmarks of a Word file's bytes: only word/document.xml and word/styles.xml are unpacked, each refused above MAX_XML.
     * @param {Uint8Array} bytes @returns {Promise<ReturnType<typeof bookmarksOf>>}
     */
    async function readDocx(bytes) {
      const wanted = new Set(['word/document.xml', 'word/styles.xml']);
      let big = '';
      const parts = await zip.readZip(bytes, { filter: (e) => { if (!wanted.has(e.name)) return false; if (e.originalSize > MAX_XML) { big = e.name; return false; } return true; } });
      if (big) throw new Error(t('plan.delivery.err.large', { name: big }));
      const doc = parts['word/document.xml'];
      if (!doc || doc.byteLength > MAX_XML) throw new Error(t('import.err.docx'));
      const decode = (b) => new TextDecoder('utf-8').decode(b);
      return bookmarksOf(decode(doc), headingStylesOf(parts['word/styles.xml'] ? decode(parts['word/styles.xml']) : ''));
    }

    // ---- manifest and metadata, read defensively ------------------------------------------------------------
    const PATH_KEYS = ['href', 'full-path', 'path', 'file', 'filename', 'filnamn', 'location', 'src', 'contentlocationvalue', 'originalname', 'name', 'namn'];
    const SUM_KEYS = ['checksum', 'sha256', 'sha-256', 'sha1', 'sha-1', 'sha512', 'md5', 'hash', 'digest', 'kontrollsumma', 'messagedigest'];
    const ALG_KEYS = ['checksumtype', 'algorithm', 'algoritm', 'hashalgorithm', 'messagedigestalgorithm', 'digestalgorithm'];
    const ROLE_KEYS = ['role', 'roll', 'use', 'kind', 'typ', 'media-type', 'mimetype'];
    const ID_KEYS = ['id', 'identifier', 'uuid', 'objektidentitet', 'objectidentifiervalue'];
    const fileLike = (v) => /\.[A-Za-z0-9]{1,6}$/.test(str(v).trim()) && !/^[a-z]+:\/\/[^/]+\/?$/i.test(str(v).trim());
    const deepText = (n) => n.text + n.children.map(deepText).join('');
    /** A value of a node by one of the keys: an attribute, else a child element's text; '' when none has it. */
    function valueOf(node, keys) {
      if (!node) return '';
      for (const [k, v] of Object.entries(node.attrs)) if (keys.includes(k.toLowerCase()) && str(v).trim()) return str(v).trim();
      for (const c of node.children) if (keys.includes(c.name.toLowerCase())) { const v = clean(deepText(c)); if (v) return v; }
      return '';
    }
    /** The same, searched a few levels down (PREMIS keeps the digest in objectCharacteristics/fixity). */
    function valueBelow(node, keys, depth = 4) {
      const own = valueOf(node, keys);
      if (own || depth <= 0) return own;
      for (const c of node.children) { const v = valueBelow(c, keys, depth - 1); if (v) return v; }
      return '';
    }
    const plainPath = (v) => { let s = str(v).trim().replace(/^file:\/\/\/?/i, ''); try { s = decodeURIComponent(s); } catch (_e) { /* keep it */ } return s.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/[?#].*$/, ''); };
    const algorithmOf = (key, value) => (value ? value : /sha-?256/i.test(key) ? 'SHA-256' : /sha-?1$/i.test(key) ? 'SHA-1' : /sha-?512/i.test(key) ? 'SHA-512' : /md5/i.test(key) ? 'MD5' : '');
    /**
     * The files a manifest or a metadata file lists, whatever its format: every element with a file name (an attribute such as
     * href or full-path, or a child such as path), with a checksum, algorithm, role and id from the element, its parent (METS) or
     * its children a few levels down (PREMIS). Ids are kept as the plan keeps them (a UUID without braces, in lower case).
     * @returns {Array<{namn: string, roll: string, id: string, algoritm: string, kontrollsumma: string}>}
     */
    function fileEntries(root) {
      const byPath = new Map();
      const visit = (node, parent, depth) => {
        if (depth > 40) return;
        const p = node !== root ? valueOf(node, PATH_KEYS) : '';
        if (p && fileLike(p)) {
          const sumKey = Object.keys(node.attrs).find((k) => SUM_KEYS.includes(k.toLowerCase())) || '';
          const sum = valueBelow(node, SUM_KEYS) || valueOf(parent, SUM_KEYS);
          const alg = valueBelow(node, ALG_KEYS) || valueOf(parent, ALG_KEYS);
          const entry = { namn: plainPath(p), roll: valueOf(node, ROLE_KEYS) || valueOf(parent, ROLE_KEYS), id: plan.normId(valueBelow(node, ID_KEYS, 2) || valueOf(parent, ID_KEYS)), algoritm: algorithmOf(sumKey, alg), kontrollsumma: sum.replace(/\s+/g, '') };
          const had = byPath.get(entry.namn);
          if (!had || (!had.kontrollsumma && entry.kontrollsumma)) byPath.set(entry.namn, entry);
        }
        for (const c of node.children) visit(c, node, depth + 1);
      };
      visit(root, null, 0);
      return Array.from(byPath.values());
    }
    /** The format of a manifest or metadata file by its root element. */
    function xmlFormat(root) {
      const ns = str(root.ns); const local = str(root.local).toLowerCase();
      if (local === 'mets' || /loc\.gov\/mets/i.test(ns)) return 'mets';
      if (/premis/i.test(ns) || local === 'premis') return 'premis';
      if (/opendocument/i.test(ns) && local === 'manifest') return 'odf';
      if (/iso\/19115\/-3|19115-3/i.test(ns)) return 'iso19115-3';
      if (/isotc211\.org\/2005\/gmd/i.test(ns) || local === 'md_metadata') return 'iso19139';
      return 'annat';
    }
    /** The first text under an element named one of `names`, anywhere in the tree. */
    function firstText(node, names, depth = 0) {
      if (!node || depth > 40) return '';
      if (names.includes(node.name.toLowerCase())) { const v = clean(deepText(node)); if (v) return v; }
      for (const c of node.children) { const v = firstText(c, names, depth + 1); if (v) return v; }
      return '';
    }
    /**
     * What a manifest or metadata file says: its format, root element and namespace, the files it lists (with checksums) and, for
     * metadata, a title, an id and a date. The plan's identity is always read from the GeoPackage, never from here.
     * @param {string} text @param {string} role
     */
    function readXmlInfo(text, role) {
      const tree = treeOf(text);
      if (!tree) return null;
      const root = rootOf(text);
      const out = { format: xmlFormat(root), rot: root.local, namnrymd: root.ns, filer: fileEntries(tree) };
      if (role === 'metadata') Object.assign(out, { titel: firstText(tree, ['title', 'titel', 'planens_titel']), id: plan.normId(firstText(tree, ['fileidentifier', 'identifier', 'objectidentifiervalue', 'objektidentitet'])), datum: firstText(tree, ['datestamp', 'date', 'datum', 'datetime']) });
      return out;
    }

    // ---- digests ---------------------------------------------------------------------------------------------
    const ALGORITHMS = { 'sha1': 'SHA-1', 'sha256': 'SHA-256', 'sha384': 'SHA-384', 'sha512': 'SHA-512' };
    const webAlgorithm = (name) => ALGORITHMS[str(name).toLowerCase().replace(/[^a-z0-9]/g, '')] || '';
    const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    async function digest(algorithm, bytes) { return hex(await crypto.subtle.digest(algorithm, bytes)); }
    const base64OfHex = (h) => btoa(String.fromCharCode(...(h.match(/../g) || []).map((x) => parseInt(x, 16))));
    /** True when a listed checksum (hex in any case, or base64) is the digest. */
    const sameDigest = (listedSum, own) => listedSum.toLowerCase() === own || listedSum === base64OfHex(own);

    // ---- GeoPackages ----------------------------------------------------------------------------------------
    /** A whole table (or some of its columns) as {name, columns, rows}, read in batches. */
    async function readTable(engine, name, columns) {
      const rows = [];
      const res = await sqliteImp.readRows(engine, name, { columns, onRows: (batch) => { for (const r of batch) rows.push(r); } });
      return { name, columns: res.columns, rows };
    }
    /** SQLite's and GeoPackage's own tables, never read for links. */
    const SYSTEM_TABLE = /^(gpkg_|gpkgext_|rtree_|sqlite_)/i;
    /**
     * The tables the links are read from: the model's link tables and any other table that holds links, statements, aliases of
     * objects or the plan's facts (data/plan-links tableRole), and of the content (the ÖP model's content tables, else the feature
     * layers) the columns that identify, name or refer, with the feature id.
     */
    async function readLinkTables(engine, names, op, layers) {
      const tables = [];
      for (const n of names) {
        if (SYSTEM_TABLE.test(n)) continue;
        const layer = op ? null : layers.find((l) => l.table === n);
        const cols = (await sqliteImp.tableColumns(engine, n)).map((c) => c.name);
        if (op ? plan.isContentTable(n) : layer) {
          const wanted = cols.filter((c) => planLinks.contentColumn(c) && c !== (layer && layer.geometryColumn));
          if (layer && layer.idColumn && !wanted.includes(layer.idColumn)) wanted.push(layer.idColumn);
          if (wanted.length) tables.push(Object.assign(await readTable(engine, n, wanted), { content: true, idColumn: layer ? layer.idColumn : null }));
        } else if (LINK_TABLES.includes(n.toLowerCase()) || planLinks.linkTable(n, cols)) tables.push(await readTable(engine, n));
      }
      return tables;
    }
    /**
     * What a SQLite file holds: whether it is a GeoPackage, its feature layers, whether it follows the ÖP model (and which plan it
     * is otherwise), its title and the documents it names, and what it says about the links between its objects and the text
     * (data/plan-links read: the content's records, the links of each source, statements, aliases, the plan's facts); `linked` is
     * true when a GeoPackage outside the ÖP model still links its objects to a text, so that it is read as a plan.
     * @param {File} file
     */
    async function describeGeoPackage(file) {
      const { engine } = await sqliteImp.openFile(file);
      try {
        const all = await engine.exec("select name from sqlite_master where type in ('table', 'view') and name not like 'sqlite_%' order by name");
        const names = (all[0] ? all[0].values : []).map((r) => String(r[0]));
        const geopackage = names.includes('gpkg_contents');
        const op = geopackage && plan.isOpGeoPackage(names);
        const layers = geopackage ? await sqliteImp.featureLayers(engine) : [];
        const out = { names, geopackage, op, kind: geopackage ? dpImp.gpkgKind(names) : null, layers, title: '', planId: '', documents: [], records: [], candidates: [], statements: [], aliases: [], meta: {}, found: {}, linked: false };
        if (!geopackage) return out;
        const tables = await readLinkTables(engine, names, op, layers);
        const read = planLinks.read(tables);
        // The section types by the catalogue's words (a value list's id, or a name in any case).
        const types = plan.lookupWords(tables.find((x) => x.name.toLowerCase() === 'avsnittstyp_varde_lookup'));
        for (const c of read.candidates) if (c.typRaw) c.typ = plan.sectionType(c.typRaw, types) || c.typ;
        Object.assign(out, { records: read.records, candidates: read.candidates, statements: read.statements, aliases: read.aliases, meta: read.meta, found: read.tables });
        if (op) {
          const parsed = plan.fromOpTables(tables, {});
          Object.assign(out, { title: parsed.plan.namn || '', planId: parsed.plan.objektid || '', documents: parsed.documents });
        }
        out.title = out.title || read.meta.namn || '';
        out.planId = out.planId || read.meta.objektid || '';
        out.linked = read.candidates.length > 0 || read.statements.some((s) => !s.headingOnly);
        return out;
      } finally { engine.terminate(); }
    }
    /**
     * The links of a delivery's plan maps with their objects found among the objects of all its GeoPackages (data/plan-links):
     * `links` for linkUp, the statements, the records of the plan maps, what each source gave and the ids no object has.
     * `rowIds`, when given, are the ids the plan's rows have (a plan read before an id column was known): a record is then known by
     * its `<layer>:<fid>` when its own id is not among them.
     * @param {any[]} maps the plan maps' items (with gpkg) @param {any[]} all every GeoPackage item @param {Set<string>} [rowIds]
     */
    /**
     * The GeoPackages whose links and areas make the plan's links: those in the ÖP model, else those that link their objects to a
     * text in a shape of their own, else the plan maps by their role, else all of them (the text may still name their areas).
     */
    function planMaps(items) {
      for (const test of [(c) => c.gpkg.op, (c) => c.gpkg.linked, (c) => c.role === 'plankarta']) if (items.some(test)) return items.filter(test);
      return items;
    }
    function linkInputs(maps, all, rowIds) {
      const described = all.filter((c) => c.gpkg);
      if (rowIds) {
        for (const c of described) for (const r of c.gpkg.records) {
          const place = `${r.lager}:${r.fid}`;
          if (!rowIds.has(planLinks.key(r.objektid)) && rowIds.has(planLinks.key(place))) r.objektid = place;
        }
      }
      const planId = (maps.find((c) => c.gpkg.planId) || { gpkg: { planId: '' } }).gpkg.planId;
      const index = planLinks.objectIndex(described.flatMap((c) => c.gpkg.records), described.flatMap((c) => c.gpkg.aliases), planId);
      const resolved = planLinks.resolveLinks(maps.flatMap((c) => c.gpkg.candidates), index);
      const found = { model: [], links: [], statements: [], aliases: [], meta: [], columns: [] };
      for (const c of maps) for (const [k, v] of Object.entries(c.gpkg.found || {})) found[k] = (found[k] || []).concat(v);
      return {
        links: resolved.links, used: resolved.used, unresolved: resolved.unresolved, index, planId,
        documents: maps.flatMap((c) => c.gpkg.documents), statements: maps.flatMap((c) => c.gpkg.statements), records: maps.flatMap((c) => c.gpkg.records),
        meta: Object.assign({}, ...maps.map((c) => c.gpkg.meta).reverse()), found,
      };
    }
    /** GeoPackage geometry type names as GeoJSON writes them. */
    const GEOMETRY_TYPES = { point: 'Point', multipoint: 'MultiPoint', linestring: 'LineString', multilinestring: 'MultiLineString', polygon: 'Polygon', multipolygon: 'MultiPolygon' };
    /**
     * The features of one layer in batches: `onFeatures` gets {id (the feature id, else its place), type, geometri (GeoJSON text
     * in WGS 84, or null without a place or in a system the app cannot convert), props (the other attributes), egenskaper (them as JSON)}.
     */
    async function readLayer(engine, layer, onFeatures) {
      const cols = (await sqliteImp.tableColumns(engine, layer.table)).map((c) => c.name);
      let place = 0;
      const types = new Map();
      await sqliteImp.readRows(engine, layer.table, { columns: cols, geometryColumn: layer.geometryColumn, batch: 500, onRows: (rows) => onFeatures(rows.map((r) => {
        const props = {}; let id = null; let text = null;
        cols.forEach((c, i) => { if (c === layer.geometryColumn) text = r[i]; else if (c === layer.idColumn) id = r[i]; else if (r[i] !== null && r[i] !== undefined) props[c] = r[i]; });
        place++;
        const g = text ? geo.parseGeometry(text) : null;
        if (g) types.set(g.type, (types.get(g.type) || 0) + 1);
        return { id: id === null || id === undefined ? String(place) : String(id), type: g ? g.type : '', geometri: g ? plan.geometryText(g, layer.crs || null) : null, props, egenskaper: JSON.stringify(props) };
      })) });
      const declared = GEOMETRY_TYPES[str(layer.geometryType).toLowerCase()];
      const seen = Array.from(types.entries()).sort((a, b) => b[1] - a[1]);
      return { count: place, geometrityp: declared || (seen[0] ? seen[0][0] : '') };
    }

    // ---- the files of a delivery, sorted ---------------------------------------------------------------------
    /**
     * The files of a ZIP as File objects with their paths (dmPath): in the folder they share inside the ZIP, else in a folder named
     * after the ZIP, so that the plan keeps their names below it.
     */
    async function filesOfZip(file) {
      const entries = await zip.readZip(file, { filter: (e) => !e.name.endsWith('/') && !JUNK.test(baseOf(e.name)) });
      const names = Object.keys(entries).map((n) => n.replace(/^\/+/, ''));
      const tops = new Set(names.map((n) => (n.includes('/') ? n.split('/')[0] : '')));
      const prefix = tops.size === 1 && !tops.has('') ? '' : stemOf(file.name) + '/';
      return Object.entries(entries).map(([n, bytes]) => {
        const f = new File([bytes], baseOf(n) || n, { type: '' });
        /** @type {any} */ (f).dmPath = prefix + n.replace(/^\/+/, '');
        return f;
      });
    }
    /**
     * The names the files keep in the plan: their paths below the folder they share (a folder or a ZIP), else their own names,
     * made unique. Returns the shared folder's name ('' when there is none).
     */
    function nameItems(items, taken) {
      const paths = items.map((c) => c.path);
      const top = paths.length && paths.every((p) => p.includes('/')) ? paths[0].split('/')[0] : '';
      const shared = top && paths.every((p) => p.split('/')[0] === top) ? top + '/' : '';
      const used = taken || new Set();
      for (const c of items) { c.stored = uniqueName(shared ? c.path.slice(shared.length) : c.name, used); used.add(c.stored); }
      return shared ? top : '';
    }
    /** A name not among `used`: the name itself, else with (2), (3) … before its ending. */
    function uniqueName(wanted, used) {
      let n = wanted;
      for (let k = 2; used.has(n); k++) n = wanted.replace(/(\.[^./]+)?$/, (ext) => ` (${k})${ext}`);
      return n;
    }
    const plainName = (s) => { let v = str(s).trim(); try { v = decodeURIComponent(v); } catch (_e) { /* keep it */ } return baseOf(v.replace(/[?#].*$/, '').replace(/\\/g, '/')); };
    /** The delivered document a dokumentreferens names, by the file name in its link or its name (with or without the ending). */
    function matchDocument(ref, docs) {
      const wanted = [ref.lank, ref.namn, ref.kortnamn].map((x) => plainName(x).toLowerCase()).filter(Boolean);
      for (const w of wanted) {
        const hit = docs.find((d) => baseOf(d.stored).toLowerCase() === w) || docs.find((d) => stemOf(d.stored).toLowerCase() === w.replace(/\.[^.]+$/, ''));
        if (hit) return hit;
      }
      return null;
    }
    const refLabel = (ref) => plainName(ref.lank) || ref.namn || ref.kortnamn || ref.id;
    /**
     * The roles of the files: an ÖP GeoPackage is the plan map (several may be), else the first plan GeoPackage or the one with the
     * most features; other GeoPackages are underlag. The text document is the Word file the GeoPackage's links name
     * (dokumentreferens_op), else the only one, else the one with the most of the links' bookmarks; other Word files, PDF and ODT
     * files are appendices; manifest and metadata by their contents; anything else is ovrigt.
     */
    function assignRoles(items, links, documents) {
      const gpkgs = items.filter((c) => c.gpkg && c.gpkg.geopackage);
      // The ÖP model's GeoPackages are the plan map; without one, a GeoPackage that links its objects to a text.
      const maps = gpkgs.some((c) => c.gpkg.op) ? gpkgs.filter((c) => c.gpkg.op) : gpkgs.filter((c) => c.gpkg.linked);
      const features = (c) => c.gpkg.layers.reduce((s, l) => s + l.count, 0);
      const main = maps.length ? maps : gpkgs.length ? [gpkgs.find((c) => c.gpkg.kind) || gpkgs.slice().sort((a, b) => features(b) - features(a))[0]] : [];
      for (const c of gpkgs) c.role = main.includes(c) ? 'plankarta' : 'underlag';
      const docx = items.filter((c) => c.sort === 'docx');
      const usedRefs = new Set(links.map((l) => l.dokumentreferens).filter(Boolean));
      const named = (refs) => refs.map((ref) => matchDocument(ref, docx)).filter(Boolean);
      let text = named(documents.filter((d) => usedRefs.has(d.id)));
      if (!text.length) text = named(documents);
      // A link that names its Word file by the file's name (a table of links, a column on the areas).
      if (!text.length) text = Array.from(new Set(links.map((l) => (l.dokumentnamn ? matchDocument({ lank: l.dokumentnamn }, docx) : null)).filter(Boolean)));
      if (!text.length && docx.length) {
        const wanted = new Set(links.flatMap((l) => l.bokmarke.split(',').concat(l.rubrik ? l.rubrik.split(',') : []).map((s) => s.trim())));
        const score = (c) => (c.bookmarks || []).filter((b) => wanted.has(b.name)).length;
        text = [docx.slice().sort((a, b) => score(b) - score(a) || (b.bookmarks || []).length - (a.bookmarks || []).length || b.size - a.size)[0]];
      }
      for (const c of docx) c.role = text.includes(c) ? 'textdokument' : 'bilaga';
      for (const c of items) {
        if (c.role) continue;
        if (c.sort === 'pdf' || c.sort === 'odt') c.role = 'bilaga';
        else if (c.sort === 'xml') c.role = xmlRole(c.stored || c.name, c.root || {}) || 'ovrigt';
        else c.role = 'ovrigt';
      }
    }
    const typeOfItem = (c) => (c.gpkg && c.gpkg.geopackage ? TYPES.gpkg : TYPES[c.sort === 'sqlite' ? 'sqlite' : c.sort] || c.file.type || 'application/octet-stream');

    /**
     * Read a delivery without making a dataset: every file sorted by its contents and given its role, the Word files' bookmarks,
     * the GeoPackages' layers, the ÖP links and the documents they name, the manifest and the metadata. A ZIP that holds a
     * GeoPackage is unpacked into its files; Thumbs.db and the like are left out.
     * @param {File[]} files @param {{taken?: Set<string>}} [options]
     * @returns {Promise<{items: any[], folder: string, op: boolean, linked: boolean, title: string, planId: string, links: any[], documents: any[], inputs: any, manifest: any, metadata: any, warnings: string[]}>}
     */
    async function readDelivery(files, options = {}) {
      const items = [];
      for (const f of files || []) {
        if (JUNK.test(baseOf(pathOf(f)))) continue;
        const c = await classify(f);
        if (c.sort === 'package') { for (const inner of await filesOfZip(f)) items.push(await classify(inner)); continue; }
        items.push(c);
      }
      const folder = nameItems(items, options.taken);
      const warnings = [];
      for (const c of items) {
        if (c.sort === 'sqlite') {
          try { c.gpkg = await describeGeoPackage(c.file); } catch (err) { c.gpkg = null; warnings.push(t('plan.delivery.warn.read', { file: c.stored, message: String((err && err.message) || err) })); }
        } else if (c.sort === 'docx') {
          try { c.bookmarks = await readDocx(new Uint8Array(await c.file.arrayBuffer())); } catch (err) { c.bookmarks = []; warnings.push(t('plan.delivery.warn.docx', { file: c.stored, message: String((err && err.message) || err) })); }
          if (c.macros) warnings.push(t('plan.delivery.warn.macros', { file: c.stored }));
        }
      }
      const gpkgItems = items.filter((c) => c.gpkg && c.gpkg.geopackage);
      const maps = planMaps(gpkgItems);
      const inputs = linkInputs(maps, gpkgItems);
      const { links, documents } = inputs;
      assignRoles(items, links, documents);
      let manifest = null; let metadata = null;
      for (const c of items) {
        if (c.role !== 'manifest' && c.role !== 'metadata') continue;
        try {
          if (c.size > MAX_XML) throw new Error(t('plan.delivery.err.large', { name: c.stored }));
          const info = readXmlInfo(await c.file.text(), c.role);
          if (c.role === 'manifest' && !manifest) manifest = Object.assign({ fil: c.stored }, info);
          if (c.role === 'metadata' && !metadata) metadata = Object.assign({ fil: c.stored }, info);
        } catch (err) { warnings.push(t('plan.delivery.warn.read', { file: c.stored, message: String((err && err.message) || err) })); }
      }
      const first = maps.find((c) => c.gpkg.title) || maps[0];
      return { items, folder, op: maps.some((c) => c.gpkg.op), linked: maps.some((c) => c.gpkg.linked), title: first ? first.gpkg.title : '', planId: inputs.planId, links, documents, inputs, manifest, metadata, warnings };
    }

    /**
     * Whether a choice of files is a delivery worth offering as one plan: one or more GeoPackages together with Word files, a
     * manifest.xml or a metadata.xml. Null otherwise; else every file of the choice (the junk aside), whether a GeoPackage follows
     * the ÖP model (the choice is then on by default) and a name.
     * @param {File[]} files
     * @returns {Promise<{importer: string, collection: boolean, files: File[], op: boolean, name: string}|null>}
     */
    async function candidate(files) {
      const kept = (files || []).filter((f) => !JUNK.test(baseOf(pathOf(f))));
      const gpkgs = []; let others = 0;
      for (const f of kept) {
        const head = sniffHead(new Uint8Array(await f.slice(0, 4096).arrayBuffer()));
        if (head.sort === 'sqlite' && (head.gpkg || /\.gpkg$/i.test(f.name))) gpkgs.push(f);
        else if (head.sort === 'zip' && /\.docx$/i.test(f.name)) others++;
        else if (head.sort === 'zip') { try { if ((await zip.listZip(f)).some((e) => e.name === 'word/document.xml')) others++; } catch (_err) { /* not a ZIP after all */ } }
        else if (head.sort === 'xml' && xmlRole(f.name, rootOf(await f.slice(0, 8192).text()))) others++;
      }
      if (!gpkgs.length || !others) return null;
      let op = false; let title = '';
      for (const f of gpkgs) {
        // On by default for the ÖP model, and for a GeoPackage that links its objects to a text in a shape of its own.
        try { const d = await describeGeoPackage(f); if (d.op || d.linked) { op = true; title = title || d.title; } } catch (_err) { /* read again, and reported, on import */ }
      }
      const path = pathOf(kept[0]);
      const folder = kept.every((f) => pathOf(f).includes('/') && pathOf(f).split('/')[0] === path.split('/')[0]) ? path.split('/')[0] : '';
      return { importer: 'opdelivery', collection: true, files: kept, op, name: title || folder || t('plan.delivery.name') };
    }

    // ---- sections and links ------------------------------------------------------------------------------------
    /**
     * The plan's sections and links: the Word files' bookmarks joined with the GeoPackage's links. A link's bookmark is found by
     * its name (in any case, without a prefix, by its heading: data/plan-links bookmarkMatcher), else by the bookmark table's text
     * (either can hold Word's name, and an older form lists several separated by commas), else through a table of statements;
     * its document is the one its dokumentreferens or file name names, else the one that has the bookmark, else the text document.
     * Sections are the visible bookmarks of every Word file (the text document first), the links' bookmarks missing from them
     * (with the GeoPackage's heading, and the text of a table of statements when it has one) and the statements no link names.
     * What does not add up is said in `warnings`.
     * @param {Array<{stored: string, role: string, bookmarks: any[]}>} docs Word files, text document first
     * @param {any[]} links data/plan-links resolveLinks @param {any[]} documents dokumentreferens_op
     * @param {{statements?: any[]}} [extra] the statements of a table (data/plan-links read)
     * @returns {{sections: any[][], links: any[][], warnings: string[]}}
     */
    function linkUp(docs, links, documents, extra = {}) {
      const warnings = [];
      const where = new Map(); const all = [];
      for (const d of docs) for (const bm of d.bookmarks || []) { where.set(bm.name, (where.get(bm.name) || []).concat(d)); all.push(bm); }
      const statements = extra.statements || [];
      const findStatement = planLinks.statementFinder(statements);
      const canonical = planLinks.bookmarkMatcher(all.filter((b) => !b.hidden).concat(all.filter((b) => b.hidden)), statements);
      const main = docs.find((d) => d.role === 'textdokument') || docs[0] || null;
      const missingDocs = new Map();
      const wanted = new Map();
      const rows = []; const seen = new Set(); const unknown = new Set(); const badNames = new Set(); const twice = new Set();
      for (const l of links) {
        const st = findStatement(l.bokmarke);
        const rubrik = l.rubrik || (st ? st.rubrik : '');
        const ids = l.bokmarke.split(',').map((s) => s.trim()).filter(Boolean);
        const spare = (rubrik ? rubrik.split(',').map((s) => s.trim()) : []).map(canonical).filter(Boolean);
        const names = ids.map((id) => canonical(id) || spare.shift() || (findStatement(id) || { name: id }).name);
        const ref = l.dokumentreferens ? documents.find((d) => d.id && d.id === l.dokumentreferens) : null;
        const named = l.dokumentnamn || (st ? st.dokument : '');
        const refDoc = ref ? matchDocument(ref, docs) : named ? matchDocument({ lank: named }, docs) : null;
        for (const name of names) {
          const hits = where.get(name) || [];
          let dokument;
          if (refDoc && hits.includes(refDoc)) dokument = refDoc.stored;
          else if (hits.length) dokument = (main && hits.includes(main) ? main : hits[0]).stored;
          else if (refDoc) dokument = refDoc.stored;
          else if (ref) { dokument = refLabel(ref); missingDocs.set(dokument, true); }
          else if (named && fileLike(named)) { dokument = plainName(named); missingDocs.set(dokument, true); }
          else dokument = main ? main.stored : '';
          if (hits.length > 1) twice.add(name);
          if (!BOOKMARK_NAME.test(name)) badNames.add(name);
          const key = dokument + '\u0000' + name;
          const w = wanted.get(key) || { name, dokument, rubrik: rubrik && rubrik !== name && !rubrik.includes(',') ? rubrik : '', typ: '', found: false };
          if (!w.typ && l.typ) w.typ = l.typ;
          wanted.set(key, w);
          const linkKey = key + '\u0000' + l.objektid;
          if (!seen.has(linkKey)) { seen.add(linkKey); rows.push([name, l.objektid, dokument, l.typ || '', l.kalla || 'modell']); }
          if (!l.known) unknown.add(l.objektid);
        }
      }
      const typeByName = new Map();
      for (const w of wanted.values()) if (w.typ && !typeByName.has(w.name)) typeByName.set(w.name, w.typ);
      const typeOf = (name, w) => (w && w.typ) || typeByName.get(name) || (findStatement(name) || { typ: '' }).typ || '';
      const sections = []; let order = 0; const unlinked = [];
      const linkedNames = new Set(Array.from(wanted.values()).map((w) => w.name));
      const named = new Set();
      for (const d of docs) {
        for (const bm of d.bookmarks || []) {
          const w = wanted.get(d.stored + '\u0000' + bm.name);
          if (bm.hidden && !w) continue;
          sections.push([bm.name, d.stored, bm.rubrik || (w ? w.rubrik : ''), bm.text, typeOf(bm.name, w), order++]);
          named.add(bm.name);
          if (w) w.found = true;
          else if (links.length && !bm.hidden && !linkedNames.has(bm.name)) unlinked.push(bm.name);
        }
        const open = (d.bookmarks || []).filter((bm) => bm.noEnd && !bm.hidden).map((bm) => bm.name);
        if (open.length) warnings.push(t('plan.delivery.warn.noend', { file: d.stored, names: listed(open) }));
      }
      const missing = [];
      for (const w of wanted.values()) {
        if (w.found || (where.get(w.name) || []).length) continue;
        // A bookmark no Word file has: the text of a table of statements stands in for it, when there is one.
        const st = findStatement(w.name);
        sections.push([w.name, w.dokument, w.rubrik || (st ? st.rubrik : ''), st ? st.text : '', typeOf(w.name, w), order++]);
        named.add(w.name);
        if (!st || !st.text) missing.push(w);
      }
      // The statements of a table that no link names and no Word file has, with their own text.
      for (const st of statements) {
        if (st.headingOnly || named.has(st.name) || canonical(st.name)) continue;
        sections.push([st.name, st.dokument ? plainName(st.dokument) : '', st.rubrik, st.text, st.typ, order++]);
        named.add(st.name);
      }
      // A bookmark missing from a delivered Word file is named; those of a document that was not delivered are said with it.
      for (const [name] of missingDocs) warnings.push(t('plan.delivery.warn.doc.missing', { file: name }));
      const inDelivered = missing.filter((w) => w.dokument && !missingDocs.has(w.dokument));
      for (const w of inDelivered.slice(0, 20)) warnings.push(t('plan.delivery.warn.bookmark.missing', { name: w.name, file: w.dokument }));
      if (inDelivered.length > 20) warnings.push(t('plan.delivery.warn.more', { n: inDelivered.length - 20 }));
      const homeless = missing.filter((w) => !w.dokument).map((w) => w.name);
      if (homeless.length) warnings.push(t('plan.delivery.warn.bookmark.nodoc', { n: homeless.length, names: listed(homeless) }));
      if (twice.size) warnings.push(t('plan.delivery.warn.bookmark.twice', { names: listed(Array.from(twice)) }));
      if (badNames.size) warnings.push(t('plan.delivery.warn.bookmark.name', { names: listed(Array.from(badNames)) }));
      if (unknown.size) warnings.push(t('plan.delivery.warn.object', { n: unknown.size, ids: listed(Array.from(unknown)) }));
      if (unlinked.length) warnings.push(t('plan.delivery.warn.unlinked', { n: unlinked.length, names: listed(unlinked) }));
      return { sections, links: rows, warnings };
    }
    /**
     * The sections and links of a plan with the areas its text names (data/plan-links mentions, for the sections no other source
     * links: inferred, kalla 'text'), and what the links add up to: `kopplingar` for the plan's facts and lines for its warnings
     * that say how many links were read and from where, how many areas and ställningstaganden have none, and why none when none.
     * @param {any[]} docs Word files, text document first @param {ReturnType<typeof linkInputs>} inputs
     */
    function joinLinks(docs, inputs) {
      const joined = linkUp(docs, inputs.links, inputs.documents, { statements: inputs.statements });
      // A section counts as linked when one of its links reaches an object of the map or the whole plan.
      const linked = new Set(joined.links.filter((r) => !r[1] || inputs.index.has(r[1])).map((r) => r[0]));
      const sections = joined.sections.map(([name, dokument, rubrik, text, typ]) => ({ name, dokument, rubrik, text, typ }));
      const textRows = planLinks.mentions(sections, inputs.records, linked);
      const rows = joined.links.concat(textRows);
      const bookmarks = docs.reduce((n, d) => n + (d.bookmarks || []).filter((b) => !b.hidden).length, 0);
      const kopplingar = planLinks.summary({ rows, sections: joined.sections, records: inputs.records, used: inputs.used, textRows: textRows.length, tables: inputs.found, bookmarks, unresolved: inputs.unresolved });
      return { sections: joined.sections, links: rows, kopplingar, warnings: linkWarnings(kopplingar).concat(joined.warnings) };
    }
    /** Where links came from, as words: "23 ur tabellen objektreferens". */
    const sourceText = (s) => t('plan.links.source.' + s.kalla, { n: s.antal, name: s.fran });
    /**
     * The lines the plan's warnings get about its links: how many and from where, how many areas and ställningstaganden have
     * none, the links only the text gives, and, when there are none at all, why. @param {any} k data/plan-links summary
     */
    function linkWarnings(k) {
      if (!k) return [];
      const out = [];
      if (!k.antal) out.push(t('plan.links.warn.none', { why: k.orsaker.map((r) => t('plan.links.why.' + r)).join(' ') }));
      else out.push(t('plan.links.warn.read', { n: k.antal, sources: k.kallor.filter((s) => s.antal).map(sourceText).join(', ') }));
      if (k.antal && (k.omradenUtan || k.stallningstagandenUtan)) out.push(t('plan.links.warn.without', { areas: k.omradenUtan, of: k.omraden, statements: k.stallningstagandenUtan, all: k.stallningstaganden }));
      if (k.kallor.some((s) => s.kalla === 'text' && s.antal)) out.push(t('plan.links.warn.text'));
      return out;
    }
    /** The Word files of a delivery in the order their sections take: the text document first, then the appendices by name. */
    const docsInOrder = (items) => items.filter((c) => c.bookmarks && (c.role === 'textdokument' || c.role === 'bilaga'))
      .sort((a, b) => (a.role === b.role ? a.stored.localeCompare(b.stored) : a.role === 'textdokument' ? -1 : 1));

    /**
     * The manifest's and metadata's checksums against the files: listed but not delivered, not the same, or of an algorithm the
     * browser cannot compute (MD5 and others: not checked). `sums(item, algorithm)` gives a file's digest in hex.
     * @returns {Promise<string[]>}
     */
    async function checkListed(lists, items, sums) {
      const warnings = [];
      for (const list of lists) {
        if (!list || !Array.isArray(list.filer)) continue;
        for (const e of list.filer) {
          if (!e.kontrollsumma && !e.namn) continue;
          const wanted = e.namn.toLowerCase();
          const item = items.find((c) => c.stored.toLowerCase() === wanted) || items.filter((c) => baseOf(c.stored).toLowerCase() === baseOf(wanted)).find((_c, _i, all) => all.length === 1);
          if (!item) { if (e.namn !== list.fil) warnings.push(t('plan.delivery.warn.listed.missing', { list: list.fil, file: e.namn })); continue; }
          if (!e.kontrollsumma) continue;
          // Without an algorithm, a hex digest's length says which SHA it is.
          const algorithm = webAlgorithm(e.algoritm || ({ 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' })[e.kontrollsumma.length] || '');
          if (!algorithm) { warnings.push(t('plan.delivery.warn.unchecked', { list: list.fil, file: item.stored, algorithm: e.algoritm || '?' })); continue; }
          if (!sameDigest(e.kontrollsumma, await sums(item, algorithm))) warnings.push(t('plan.delivery.warn.checksum', { list: list.fil, file: item.stored }));
        }
      }
      return warnings;
    }
    const capped = (list) => (list.length > MAX_WARNINGS ? list.slice(0, MAX_WARNINGS).concat(t('plan.delivery.warn.more', { n: list.length - MAX_WARNINGS })) : list);

    // ---- the dataset ---------------------------------------------------------------------------------------------
    async function setMeta(handle, key, value) {
      handle.meta[key] = value;
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', [key, JSON.stringify(value)]);
    }
    /** A row of the plan for a feature of a GeoPackage outside the ÖP model (underlag, or a plan map in another model). */
    function opRowOf(c, layer, f) {
      const p = f.props;
      // The same id data/plan-links gives the feature's record: its id column (objekt_id …), else <layer>:<fid>.
      const own = { fid: f.id };
      for (const [k, v] of Object.entries(p)) own[k.toLowerCase()] = v;
      const id = plan.contentId(own, layer.table);
      return {
        objektid: id || `${layer.table}:${f.id}`, tema: c.role === 'underlag' ? 'underlag' : plan.themeKey(layer.title || layer.table) || 'omrade', innehallstyp: layer.title,
        namn: str(p.namn || p.name || p.benamning || p.titel || p.beteckning || ''), geometrityp: f.type, egenskaper: Object.keys(p).length ? f.egenskaper : '', lager: layer.table, fil: c.stored, geometri: f.geometri,
      };
    }
    /** Every feature layer with features of a GeoPackage as plan rows, in batches (`append`); the layers read, as _meta lists them. */
    async function appendLayers(c, append) {
      const { engine } = await sqliteImp.openFile(c.file);
      const out = [];
      try {
        for (const layer of (await sqliteImp.featureLayers(engine)).filter((l) => l.count > 0)) {
          const r = await readLayer(engine, layer, (features) => append(features.map((f) => opRowOf(c, layer, f))));
          out.push({ namn: layer.table, titel: layer.title, fil: c.stored, roll: c.role, geometrityp: r.geometrityp, antal: r.count, crs: layer.crs });
        }
      } finally { engine.terminate(); }
      return out;
    }
    /** The layers of an ÖP plan map as _meta lists them: the content tables that have objects, counted from the rows read. */
    function opLayers(c, rows) {
      const counts = new Map();
      for (const r of rows) counts.set(r.lager, (counts.get(r.lager) || 0) + 1);
      return c.gpkg.layers.filter((l) => counts.get(l.table)).map((l) => ({ namn: l.table, titel: l.title, fil: c.stored, roll: c.role, geometrityp: GEOMETRY_TYPES[str(l.geometryType).toLowerCase()] || (rows.find((r) => r.lager === l.table && r.geometrityp) || {}).geometrityp || '', antal: counts.get(l.table), crs: l.crs }));
    }

    /**
     * A delivery → one plan dataset (kind plan, slag oversiktsplan). A GeoPackage alone in another plan model (Rita Detaljplan's,
     * the Nordic ones) is imported as that plan, as before; one that is no plan is refused as before. Every file is kept with its
     * role in `_files`, the plan map's rows come first, then the underlag's, and `_meta.plan.leverans` says what was checked.
     * @param {File[]} files @param {Record<string, any>} [options] `folder` names the plan when nothing else does
     * @param {string} [name] @param {Function} [progress]
     */
    async function importDelivery(files, options = {}, name, progress) {
      if (progress) progress({ step: 'read', file: files[0] ? files[0].name : '' });
      const d = await readDelivery(files);
      const gpkgs = d.items.filter((c) => c.role === 'plankarta' || c.role === 'underlag');
      if ((files || []).length === 1 && d.items.length <= 1 && !d.op && !d.linked) return dpImp.importGeoPackage(files[0], options, name, progress);
      if (!gpkgs.length) throw new Error(t('plan.delivery.err.nogpkg'));
      const first = gpkgs[0];
      const datasetName = name || d.title || (d.metadata && d.metadata.titel) || options.folder || d.folder || stemOf(first.stored);
      const handle = await datasets.createEmpty({
        name: datasetName, columns: plan.OP_COLUMNS, kind: 'plan',
        source: { kind: 'files', format: 'plan-delivery', planFormat: d.op ? 'oversiktsplan-gpkg' : 'oversiktsplan-leverans', fileName: d.folder || first.stored, files: d.items.map((c) => ({ name: c.stored, role: c.role, size: c.size })) },
        importOptions: Object.assign({}, options, { format: 'opdelivery' }),
      });
      try {
        let info = null; let order = 0; const counts = {}; const lager = [];
        const append = async (rows) => {
          for (const r of rows) { r.ordning = order++; counts[r.tema || 'annan'] = (counts[r.tema || 'annan'] || 0) + 1; }
          await datasets.appendImportRows(handle, plan.toRows(rows, plan.OP_COLUMNS));
        };
        for (const c of gpkgs.filter((x) => x.gpkg.op)) {
          const { parsed } = await dpImp.readGeoPackage(c.file, Object.assign({}, options, { plan: true, fileName: c.stored }), progress);
          if (!info || (!info.objektid && parsed.plan.objektid)) info = Object.assign({}, parsed.plan);
          lager.push(...opLayers(c, parsed.rows));
          for (let i = 0; i < parsed.rows.length; i += 2000) await append(parsed.rows.slice(i, i + 2000));
        }
        for (const c of gpkgs.filter((x) => !x.gpkg.op)) {
          if (progress) progress({ step: 'layers', file: c.stored });
          lager.push(...await appendLayers(c, append));
        }
        if (!order) throw new Error(t('plan.err.empty'));
        // Outside the ÖP model the plan's facts come from a key-value table (planmetadata) when there is one.
        const facts = d.inputs.meta || {};
        info = info || { slag: 'oversiktsplan', objektid: d.planId || '', namn: d.title || (d.metadata && d.metadata.titel) || '', kommun: facts.kommun || '', kommunkod: facts.kommunkod || '', status: facts.status || '', datumPlanhandelse: facts.datum || '', format: 'oversiktsplan-leverans', crs: (lager.find((l) => l.crs) || {}).crs || '' };
        info.antal = counts;
        info.lager = lager;
        // The files, one at a time (their bytes go to the dataset's file), with what the manifest asks to be checked.
        const sums = new Map();
        const sumOf = async (item, algorithm) => {
          const key = item.stored + '\u0000' + algorithm;
          if (!sums.has(key)) sums.set(key, await digest(algorithm, new Uint8Array(await item.file.arrayBuffer())));
          return sums.get(key);
        };
        const filer = [];
        for (const c of d.items) {
          if (progress) progress({ step: 'file', file: c.stored });
          const bytes = new Uint8Array(await c.file.arrayBuffer());
          const sha = await digest('SHA-256', bytes);
          sums.set(c.stored + '\u0000SHA-256', sha);
          await dsFiles.put(handle, [{ name: c.stored, kind: c.role, type: typeOfItem(c), bytes }]);
          filer.push({ namn: c.stored, roll: c.role, storlek: c.size, sha256: sha });
          await breathe();
        }
        const joined = joinLinks(docsInOrder(d.items), d.inputs);
        await dsFiles.writeTable(handle, { name: SECTIONS, columns: SECTION_COLUMNS, rows: joined.sections, index: ['avsnitt'] });
        await dsFiles.writeTable(handle, { name: LINKS, columns: LINK_COLUMNS, rows: joined.links, index: ['avsnitt', 'objektid'] });
        const listedWarnings = await checkListed([d.manifest, d.metadata], d.items, sumOf);
        info.leverans = { filer, manifest: d.manifest, metadata: d.metadata, kopplingar: joined.kopplingar, varningar: capped(d.warnings.concat(joined.warnings, listedWarnings)) };
        await setMeta(handle, 'plan', info);
        return await datasets.finishImport(handle, {});
      } catch (err) {
        datasets.abortImport(handle);
        throw err;
      }
    }

    /**
     * A GeoPackage → one dataset of the kind `layers` with every feature layer that has features: a row per feature (layer, file,
     * feature id, geometry type, GeoJSON in WGS 84, its attributes as JSON). `_meta.layers` = {filer, lager: [{namn (the table),
     * titel (gpkg_contents' identifier, else the table), fil, geometrityp, antal, crs}], tomma (the layers without features, not listed)}.
     * Value lists and link tables (data_type 'attributes') are no layers. The original file is kept unless `keepOriginal` is false.
     * @param {File} file @param {Record<string, any>} [options] @param {string} [name] @param {Function} [progress]
     */
    async function importLayers(file, options = {}, name, progress) {
      const fil = options.fileName || file.name;
      const { engine } = await sqliteImp.openFile(file);
      let handle = null;
      try {
        const layers = await sqliteImp.featureLayers(engine);
        const shown = layers.filter((l) => l.count > 0);
        if (!shown.length) throw new Error(t(layers.length ? 'layers.err.empty' : 'layers.err.none'));
        handle = await datasets.createEmpty({
          name: name || stemOf(file.name).replace(/[_-]+/g, ' ').trim() || t('datasets.kind.layers'), columns: LAYER_COLUMNS, kind: 'layers',
          source: { kind: 'file', fileName: file.name, size: file.size, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null, format: 'geopackage' },
          importOptions: { format: 'sqlite', layers: true },
        });
        let order = 0; const lager = [];
        for (let i = 0; i < shown.length; i++) {
          const layer = shown[i];
          if (progress) progress({ step: 'table', done: i, total: shown.length, table: layer.table });
          const r = await readLayer(engine, layer, (features) => datasets.appendImportRows(handle, features.map((f) => [layer.table, fil, f.id, f.type, f.geometri, f.egenskaper, order++])));
          lager.push({ namn: layer.table, titel: layer.title, fil, geometrityp: r.geometrityp, antal: r.count, crs: layer.crs });
        }
        engine.terminate();
        if (options.keepOriginal !== false) await dsFiles.put(handle, [{ name: file.name, kind: 'original', type: TYPES.gpkg, bytes: new Uint8Array(await file.arrayBuffer()) }]);
        await setMeta(handle, 'layers', { filer: [fil], lager, tomma: layers.filter((l) => !l.count).map((l) => l.table) });
        return await datasets.finishImport(handle, {});
      } catch (err) {
        if (handle) datasets.abortImport(handle);
        throw err;
      } finally { engine.terminate(); }
    }

    // ---- what the plan already holds, and adding to it -----------------------------------------------------------
    /** A stored file as a File, for the readers that take one. */
    const asFile = (bytes, name, type) => new File([bytes], baseOf(name) || 'fil', { type: type || '' });
    /**
     * Files added to a plan later: a Word file (its bookmarks become sections and are linked as the plan's GeoPackage says), a PDF,
     * a manifest or metadata file, anything else; a GeoPackage comes in as underlag with its layers as rows. A file with the name of
     * one the plan holds replaces it (a corrected text document), unless either is a GeoPackage, which is added beside under a name
     * of its own. The sections, links and warnings are made anew from every file the plan holds. The change is logged and saved.
     * With no files the links are only read again (`relink`).
     * @param {string} datasetId @param {File[]} files @param {{relink?: boolean}} [options]
     * @returns {Promise<{added: Array<{namn: string, roll: string}>, sections: number, links: number, warnings: string[], kopplingar: any}>}
     */
    async function addFiles(datasetId, files, options = {}) {
      const handle = await datasets.ensureOpen(datasetId);
      if (handle.meta.kind !== 'plan') throw new Error(t('plan.delivery.err.notplan'));
      const all0 = await dsFiles.list(datasetId);
      const d = await readDelivery(files);
      const isMap = (kind) => kind === 'plankarta' || kind === 'underlag';
      const taken = new Set(all0.map((f) => f.name));
      const replaced = new Set();
      for (const c of d.items) {
        const old = all0.find((f) => f.name === c.stored);
        if (old && c.sort !== 'sqlite' && !isMap(old.kind) && !replaced.has(c.stored)) { replaced.add(c.stored); continue; }
        if (taken.has(c.stored)) c.stored = uniqueName(c.stored, taken);
        taken.add(c.stored);
      }
      for (const name of replaced) await handle.engine.run(`delete from ${dsFiles.TABLE} where name = ?`, [name]);
      const before = all0.filter((f) => !replaced.has(f.name));
      const info = Object.assign({}, handle.meta.plan || {});
      const leverans = Object.assign({ filer: [], manifest: null, metadata: null, varningar: [] }, info.leverans || {});
      leverans.filer = (Array.isArray(leverans.filer) ? leverans.filer : []).filter((x) => !replaced.has(x.namn));
      for (const role of ['manifest', 'metadata']) if (leverans[role] && replaced.has(leverans[role].fil)) leverans[role] = null;
      // What the plan holds: its GeoPackage's links, its Word files' bookmarks, its manifest and metadata.
      const held = [];
      for (const f of before.filter((x) => dsFiles.ORIGINAL_KINDS.includes(x.kind))) {
        const got = await dsFiles.read(datasetId, f.name, f.kind);
        if (!got) continue;
        const c = await classify(asFile(got.bytes, f.name, got.type), f.name);
        c.stored = f.name; c.role = f.kind === 'original' ? '' : f.kind;
        held.push(c);
      }
      const newGpkgs = d.items.filter((c) => c.role === 'plankarta' || c.role === 'underlag');
      for (const c of newGpkgs) c.role = 'underlag';
      // A held GeoPackage that cannot be read again (damaged since, or not a database at all) must not stop the new files from
      // being added: they are kept, and the plan's sections and links stay as they were, with a warning.
      const unreadable = [];
      for (const c of held) {
        if (c.sort === 'sqlite') {
          try { c.gpkg = await describeGeoPackage(c.file); } catch (err) {
            D.log('plan-delivery', 'a held GeoPackage could not be read again', c.stored, err);
            unreadable.push(c.stored);
            if (!c.role) c.role = 'underlag';
            continue;
          }
          if (!c.role) c.role = c.gpkg.op || c.gpkg.linked ? 'plankarta' : 'underlag';
        } else if (c.sort === 'docx') {
          try { c.bookmarks = await readDocx(new Uint8Array(await c.file.arrayBuffer())); } catch (_err) { c.bookmarks = []; }
          if (!c.role) c.role = 'textdokument';
        } else if (!c.role) c.role = c.sort === 'xml' ? xmlRole(c.stored, c.root || {}) || 'ovrigt' : c.sort === 'pdf' ? 'bilaga' : 'ovrigt';
      }
      // The links of the plan maps it holds (and of new ones), found among the objects of every GeoPackage, by the ids its rows have.
      const gpkgItems = held.concat(d.items).filter((c) => c.gpkg && c.gpkg.geopackage);
      const maps = planMaps(gpkgItems);
      const ids = await handle.engine.exec('select distinct objektid from data');
      const inputs = linkInputs(maps, gpkgItems, new Set((ids[0] ? ids[0].values : []).map((r) => planLinks.key(r[0]))));
      const { links, documents } = inputs;
      // The new Word files: a text document when the plan's links name them or the plan has none, else appendices.
      const newDocs = d.items.filter((c) => c.sort === 'docx');
      if (newDocs.length) {
        const hasText = held.some((c) => c.role === 'textdokument');
        for (const c of newDocs) c.role = '';
        assignRoles(newDocs, links, documents);
        const named = documents.map((ref) => matchDocument(ref, newDocs)).filter(Boolean);
        if (hasText) for (const c of newDocs) if (!named.includes(c)) c.role = 'bilaga';
      }
      let order = Number(handle.meta.rowCount) || 0;
      const counts = Object.assign({}, info.antal || {});
      const lager = Array.isArray(info.lager) ? info.lager.slice() : [];
      for (const c of newGpkgs) {
        lager.push(...await appendLayers(c, async (rows) => {
          for (const r of rows) { r.ordning = order++; counts[r.tema] = (counts[r.tema] || 0) + 1; }
          // A plan imported before the columns lager and fil has the others only.
          await handle.engine.insertRows('data', handle.columns.map((x) => x.name), plan.toRows(rows, handle.columns));
        }));
      }
      const added = [];
      for (const c of d.items) {
        const bytes = new Uint8Array(await c.file.arrayBuffer());
        const sha = await digest('SHA-256', bytes);
        await dsFiles.put(handle, [{ name: c.stored, kind: c.role, type: typeOfItem(c), bytes }]);
        leverans.filer = leverans.filer.concat({ namn: c.stored, roll: c.role, storlek: c.size, sha256: sha });
        added.push({ namn: c.stored, roll: c.role });
      }
      for (const c of held) if (!leverans.filer.some((x) => x.namn === c.stored)) leverans.filer.push({ namn: c.stored, roll: c.role, storlek: c.size, sha256: '' });
      const all = held.concat(d.items);
      let joined;
      if (unreadable.length) {
        const count = async (name) => ((await tableIn(handle.engine, name)) ? Number(((await handle.engine.exec(`select count(*) from ${name}`))[0] || { values: [[0]] }).values[0][0]) : 0);
        joined = { sections: { length: await count(SECTIONS) }, links: { length: await count(LINKS) }, warnings: [t('plan.delivery.warn.kept', { files: unreadable.join(', ') })] };
      } else {
        joined = joinLinks(docsInOrder(all), inputs);
        await dsFiles.writeTable(handle, { name: SECTIONS, columns: SECTION_COLUMNS, rows: joined.sections, index: ['avsnitt'] });
        await dsFiles.writeTable(handle, { name: LINKS, columns: LINK_COLUMNS, rows: joined.links, index: ['avsnitt', 'objektid'] });
        leverans.kopplingar = joined.kopplingar;
      }
      for (const c of d.items) {
        if ((c.role === 'manifest' && !leverans.manifest) || (c.role === 'metadata' && !leverans.metadata)) {
          try { leverans[c.role] = Object.assign({ fil: c.stored }, readXmlInfo(await c.file.text(), c.role)); } catch (err) { d.warnings.push(t('plan.delivery.warn.read', { file: c.stored, message: String((err && err.message) || err) })); }
        }
      }
      const known = new Map(leverans.filer.filter((x) => x.sha256).map((x) => [x.namn, x.sha256]));
      const sumOf = async (item, algorithm) => (algorithm === 'SHA-256' && known.has(item.stored) ? known.get(item.stored) : digest(algorithm, new Uint8Array(await item.file.arrayBuffer())));
      const listedWarnings = await checkListed([leverans.manifest, leverans.metadata], all, sumOf);
      leverans.varningar = capped(d.warnings.concat(joined.warnings, listedWarnings));
      Object.assign(info, { leverans, lager, antal: counts });
      await setMeta(handle, 'plan', info);
      if (newGpkgs.length) await datasets.refreshCounts(handle);
      if (options.relink) await datasets.appendLog(handle, 'plan_relink', { links: joined.links.length });
      else await datasets.appendLog(handle, 'plan_add_files', { files: added, replaced: Array.from(replaced) });
      await datasets.save(datasetId);
      // A replaced file's address for the views is stale now (data/dataset-files drops them on 'changed').
      datasets.notify('changed', { id: datasetId });
      return { added, sections: joined.sections.length, links: joined.links.length, warnings: leverans.varningar, kopplingar: leverans.kopplingar || null };
    }
    /**
     * The plan's links read again from the files it holds, the way data/plan-links reads them now (a plan read before the app knew
     * a shape of links). @param {string} datasetId
     */
    const relink = (datasetId) => addFiles(datasetId, [], { relink: true });

    // ---- reading the sections back ------------------------------------------------------------------------------
    async function tableIn(engine, name) {
      const r = await engine.exec("select count(*) from sqlite_master where type = 'table' and name = ?", [name]);
      return !!(r[0] && Number(r[0].values[0][0]));
    }
    const sectionOf = (r) => ({ avsnitt: str(r[0]), dokument: str(r[1]), rubrik: str(r[2]), text: str(r[3]), typ: str(r[4]), ordning: Number(r[5]) || 0 });
    /** Whether a table has a column (`_section_links` of a plan read before `kalla`, or one a test made, has not). */
    async function hasColumn(engine, table, column) {
      const r = await engine.exec(`pragma table_info(${table})`);
      return (r[0] ? r[0].values : []).some((v) => String(v[1]) === column);
    }
    /**
     * Every link of the plan: {avsnitt, objektid, dokument, typ, kalla} ('modell' for a plan read before the sources were kept).
     * @param {any} engine @returns {Promise<Array<{avsnitt: string, objektid: string, dokument: string, typ: string, kalla: string}>>}
     */
    async function linksOf(engine) {
      if (!(await tableIn(engine, LINKS))) return [];
      const kalla = (await hasColumn(engine, LINKS, 'kalla')) ? "coalesce(nullif(kalla, ''), 'modell')" : "'modell'";
      const res = await engine.exec(`select avsnitt, coalesce(objektid, ''), coalesce(dokument, ''), coalesce(typ, ''), ${kalla} from ${LINKS}`);
      return (res[0] ? res[0].values : []).map((r) => ({ avsnitt: str(r[0]), objektid: str(r[1]), dokument: str(r[2]), typ: str(r[3]), kalla: str(r[4]) }));
    }
    /**
     * A section's links: those in its document, and those whose document is empty or names no section of that bookmark (a link
     * written by hand, or before the document was known), so that a link is never lost to a document name that differs.
     */
    function linksBySection(sections, links) {
      const own = new Set(sections.map((s) => s.dokument + '\u0000' + s.avsnitt));
      const by = new Map();
      for (const l of links) {
        const exact = own.has(l.dokument + '\u0000' + l.avsnitt);
        for (const s of sections) {
          if (s.avsnitt !== l.avsnitt || (exact ? s.dokument !== l.dokument : false)) continue;
          const k = s.dokument + '\u0000' + s.avsnitt;
          by.set(k, (by.get(k) || []).concat(l));
          if (!exact) break;
        }
      }
      return by;
    }
    /**
     * The plan's sections in document order, each with the objects it is linked to (`objekt`, with where each link was read in
     * `kallor`: modell, tabell, attribut or text; the whole plan is `helaPlanen`, not an id); [] for a plan without sections.
     * @param {string} datasetId
     * @returns {Promise<Array<{avsnitt: string, dokument: string, rubrik: string, text: string, typ: string, ordning: number, objekt: string[], kallor: string[], helaPlanen: boolean}>>}
     */
    async function sectionsOf(datasetId) {
      const { engine } = await datasets.ensureOpen(datasetId);
      if (!(await tableIn(engine, SECTIONS))) return [];
      const res = await engine.exec(`select avsnitt, dokument, rubrik, text, typ, ordning from ${SECTIONS} order by ordning, rowid`);
      const sections = (res[0] ? res[0].values : []).map(sectionOf);
      const by = linksBySection(sections, await linksOf(engine));
      return sections.map((s) => {
        const list = (by.get(s.dokument + '\u0000' + s.avsnitt) || []).filter((l, i, all) => all.findIndex((x) => planLinks.key(x.objektid) === planLinks.key(l.objektid)) === i);
        const objects = list.filter((l) => planLinks.key(l.objektid));
        return Object.assign(s, { objekt: objects.map((l) => l.objektid), kallor: objects.map((l) => l.kalla), helaPlanen: list.some((l) => !planLinks.key(l.objektid)) });
      });
    }
    /**
     * The sections linked to an object, in document order, each with where its link was read (`kalla`); objektid '' gives those
     * linked to the whole plan. The object's id is compared trimmed, in lower case and without braces, on both sides.
     * @param {string} datasetId @param {string} objektid
     */
    async function sectionsForObject(datasetId, objektid) {
      const id = planLinks.key(objektid);
      const all = await sectionsOf(datasetId);
      const out = [];
      for (const s of all) {
        const at = id ? s.objekt.findIndex((x) => planLinks.key(x) === id) : -1;
        if (id ? at < 0 : !s.helaPlanen) continue;
        out.push(Object.assign({}, s, { kalla: at >= 0 ? s.kallor[at] : 'modell' }));
      }
      return out;
    }
    /**
     * The objects a section is linked to (their objektid, as the plan's rows have it), '' for the whole plan as `_section_links`
     * keeps it; `dokument` narrows it to one Word file when the same bookmark is in several.
     * @param {string} datasetId @param {string} avsnitt @param {string} [dokument] @returns {Promise<string[]>}
     */
    async function objectsForSection(datasetId, avsnitt, dokument) {
      const { engine } = await datasets.ensureOpen(datasetId);
      if (!(await tableIn(engine, LINKS))) return [];
      const res = await engine.exec(`select distinct objektid from ${LINKS} where avsnitt = ?${dokument ? ' and dokument = ?' : ''} order by objektid`, dokument ? [avsnitt, dokument] : [avsnitt]);
      return (res[0] ? res[0].values : []).map((r) => str(r[0]));
    }

    /**
     * A delivery's preview for Inhämta: the plan's facts, its files with their roles and the warnings, and the plan map's first rows.
     * @param {File[]} files @param {Record<string, any>} [options]
     */
    async function previewDelivery(files, options = {}) {
      const d = await readDelivery(files);
      const map = d.items.find((c) => c.role === 'plankarta' && c.gpkg && c.gpkg.op);
      const facts = d.inputs.meta || {};
      const parsed = map ? (await dpImp.readGeoPackage(map.file, Object.assign({}, options, { plan: true, fileName: map.stored }))).parsed : { plan: { slag: 'oversiktsplan', objektid: d.planId || '', namn: d.title, kommun: facts.kommun || '', kommunkod: facts.kommunkod || '', status: facts.status || '', format: 'oversiktsplan-leverans' }, rows: [] };
      const joined = joinLinks(docsInOrder(d.items), d.inputs);
      const columns = plan.OP_COLUMNS;
      const leverans = { filer: d.items.map((c) => ({ namn: c.stored, roll: c.role, storlek: c.size })), manifest: d.manifest, metadata: d.metadata, kopplingar: joined.kopplingar, varningar: capped(d.warnings.concat(joined.warnings)) };
      return { kind: 'plan', format: 'opdelivery', plan: Object.assign({}, parsed.plan, { leverans }), planFormat: parsed.plan.format || 'oversiktsplan-leverans', header: true,
        columns: columns.map((c) => c.name), declaredTypes: columns.map((c) => c.type), dataRows: plan.toRows(parsed.rows, columns).slice(0, options.previewRows || 100), totalRows: parsed.rows.length,
        sections: joined.sections.length, links: joined.links.length, datasetName: d.title || d.folder || (map ? stemOf(map.stored) : t('plan.delivery.name')) };
    }

    return {
      SECTIONS, LINKS, SECTION_COLUMNS, LINK_COLUMNS, LAYER_COLUMNS, BOOKMARK_NAME,
      sniffHead, rootOf, xmlRole, classify, xmlEvents, bookmarksOf, headingStylesOf, readDocx, fileEntries, readXmlInfo, describeGeoPackage,
      filesOfZip, readDelivery, candidate, linkUp, joinLinks, linkWarnings, importDelivery, importLayers, addFiles, relink, previewDelivery, sectionsOf, sectionsForObject, objectsForSection,
    };
  });
})();
