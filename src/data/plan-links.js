// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The links between a comprehensive plan's map and its text, read defensively (pure logic for data/plan-delivery). Boverket's
 * ÖP model links an object to a Word bookmark in `dokumentavsnitt`; files made by other tools, or written by hand or by an AI,
 * take other shapes. They are read in this order of strength, a weaker source only adding links for objects that no stronger
 * source has linked (`kalla` of each link):
 *
 * - `modell`: the model's `dokumentavsnitt`, with its id columns found by name in any case;
 * - `tabell`: any other table with an object id column and a bookmark column (objekt_id with identitet_i_dokument, bokmarke,
 *   avsnitt, stallning_id …);
 * - `attribut`: columns on the areas themselves that name their bookmarks or statements, one or several separated by commas or
 *   semicolons;
 * - `text`: the areas the text names (a line such as "Kopplade områden: Trossö, Lyckeby", or the area's name), only for
 *   sections that no other source links; these are inferred and shown as such.
 *
 * Ids are compared trimmed, in lower case and without braces, and an object can be found by its own id, its other id columns,
 * `<layer>:<fid>`, a table that maps ids to layer and feature (kartobjekt), or the model 0.3's dokument_id. A link's bookmark
 * is found by its name, in any case, without a prefix such as op_, by its heading, or through a table of statements
 * (stallningstagande) whose text stands in for a missing Word file. `boxHits` is the test of the plan view's box selection.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/plan-links', ['data/plan'], (plan) => {
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    /** An id as compared: trimmed, without quotes and braces, in lower case. @param {any} v */
    const key = (v) => str(v).trim().replace(/^["'{([]+|["'})\]]+$/g, '').trim().toLowerCase();
    /** Words as compared: without accents, punctuation and spaces, in lower case. @param {any} v */
    const fold = (v) => str(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    /** The strength of each source, strongest first. */
    const SOURCES = ['modell', 'tabell', 'attribut', 'text'];
    /** The section type Ställningstagande (ÖP catalogue 2.3). */
    const STATEMENT = 'Ställningstagande';
    const STATEMENT_UUID = '56d85084-b9d9-43c4-8243-1fbd3b6d3205';
    /** True for a section type that is Ställningstagande, by name in any case or by the catalogue's id. @param {any} typ */
    const isStatement = (typ) => /st[aä]llningstagande/i.test(str(typ)) || str(typ).toLowerCase().includes(STATEMENT_UUID);

    /** Column names (in lower case) by what they hold. */
    const COLUMNS = {
      object: /^(objektidentitet|objekt_?id(entitet)?|omr[aå]de_?(id|identitet|uuid)|omradesid|objektidentitet_omr[aå]de|innehall(_op)?_?id|feature_?id|object_?id|area_?id|kartobjekt_?id)$/,
      ref: /^(avsnittsbokm[aä]rke(_id|_namn)?|bokm[aä]rke(n|_id|_namn|snamn)?|identitet_i_dokument|dokumentidentitet|avsnitt(_id|sid|snamn)?|bookmarks?(_id|_name)?|section_?id|st[aä]llning(_id|sid)?|st[aä]llningstagande(n|_id|n_id|id)?)$/,
      document: /^(dokument|dokument_?namn|dokument_?fil|textfil|textdokument|dokumentreferens(_id)?|filnamn|document|file_?name)$/,
      type: /^avsnittstyp(_varde|_id)?$/,
      heading: /^(rubrik|titel|avsnittsbokm[aä]rke_text|heading|title)$/,
      text: /^(text|brodtext|lydelse|beskrivning|formulering)$/,
      name: /^(namn|name|benamning|omradesnamn)$/,
      code: /^(beteckning|kod|omradeskod|omradesnummer|nummer|nr)$/,
      layer: /^(lager|layer|tabell|table_name|lagernamn)$/,
      fid: /^(objekt_fid|feature_fid|lager_fid|fid)$/,
      key: /^(nyckel|key|egenskap|parameter|uppgift)$/,
      value: /^(v[aä]rde|value)$/,
    };
    /** The record columns that can name the same object: its own ids. */
    const ALIAS_COLUMNS = ['objektidentitet', 'objekt_id', 'objektid', 'uuid', 'globalid', 'id'];
    /** A ref column's preference when a table has several: the bookmark's own name first. */
    const REF_ORDER = [/bokm|identitet_i_dokument|bookmark/, /avsnitt|section/, /st[aä]llning/];
    const lowerNames = (cols) => cols.map((c) => str(c).toLowerCase());
    /** The first column (its index) whose lower-case name matches, in the order of `prefer` when given. */
    function pick(cols, re, prefer) {
      const names = lowerNames(cols);
      const hits = names.map((n, i) => (re.test(n) ? i : -1)).filter((i) => i >= 0);
      if (!hits.length) return -1;
      for (const p of prefer || []) { const i = hits.find((x) => p.test(names[x])); if (i !== undefined) return i; }
      return hits[0];
    }
    const recordOf = (columns, row) => { const o = {}; lowerNames(columns).forEach((n, i) => { o[n] = row[i]; }); return o; };
    /** A cell that names one or more things: split on commas, semicolons, bars and new lines. */
    const parts = (v) => str(v).split(/[,;|\n]+/).map((s) => s.trim()).filter(Boolean);

    /**
     * What a table is for the links, by its name and its columns: 'model' (dokumentavsnitt), 'links' (an object id and a bookmark),
     * 'statements' (a bookmark with a text or a heading, and no object id: stallningstagande, avsnittsbokmärke), 'aliases' (an
     * object id with a layer and a feature id: kartobjekt), 'meta' (key and value: planmetadata) or ''.
     * @param {string} name @param {string[]} columns
     */
    function tableRole(name, columns) {
      const n = str(name).toLowerCase();
      const has = (re) => pick(columns, re) >= 0;
      if (/^dokument_?avsnitt/.test(n)) return 'model';
      // The model's bookmark table names bookmarks only; its key OBJECTID (as Boverket's template has it) is no object's id.
      if (/^avsnittsbokm/.test(n)) return has(COLUMNS.ref) && (has(COLUMNS.text) || has(COLUMNS.heading)) ? 'statements' : '';
      if (has(COLUMNS.object) && has(COLUMNS.ref)) return 'links';
      if (has(COLUMNS.object) && has(COLUMNS.layer) && pick(columns, /^(objekt_fid|feature_fid|lager_fid|fid)$/) >= 0) return 'aliases';
      if (has(COLUMNS.ref) && (has(COLUMNS.text) || has(COLUMNS.heading))) return 'statements';
      if (has(COLUMNS.key) && has(COLUMNS.value)) return 'meta';
      return '';
    }
    /** The columns of a content table worth reading for the links: ids, names, codes, references, documents. @param {string} column */
    const contentColumn = (column) => {
      const c = str(column).toLowerCase();
      return ALIAS_COLUMNS.includes(c) || ['fid', 'objectid', 'dokument_id'].includes(c) || COLUMNS.ref.test(c) || COLUMNS.document.test(c) || COLUMNS.name.test(c) || COLUMNS.code.test(c);
    };
    /** Whether a table other than content is worth reading for the links. @param {string} name @param {string[]} columns */
    const linkTable = (name, columns) => !!tableRole(name, columns);

    /** The plan's facts from a key-value table (planmetadata): its id, title, municipality and status. */
    function metaOf(table) {
      const k = pick(table.columns, COLUMNS.key); const v = pick(table.columns, COLUMNS.value);
      const out = {};
      for (const r of table.rows) {
        const name = fold(r[k]); const value = str(r[v]).trim();
        if (!value) continue;
        if (/^(planid|planuuid|planidentitet|objektidentitet|oversiktsplanid|oversiktsplan)$/.test(name)) out.objektid = out.objektid || plan.normId(value);
        else if (/^(titel|planenstitel|plannamn|namn)$/.test(name)) out.namn = out.namn || value;
        else if (name === 'kommunkod') out.kommunkod = value;
        else if (/^(kommun|kommunnamn)$/.test(name)) out.kommun = value;
        else if (/^(status|planhandelse)$/.test(name)) out.status = value;
        else if (/^(datum|planhandelsedatum|datumplanhandelse)$/.test(name)) out.datum = value;
      }
      return out;
    }

    /**
     * What a GeoPackage's tables say about the links, before they are joined with the text: the content's records (each with the
     * id its row gets, its layer and feature id, name and attributes), the links each source gives (not yet resolved), the
     * statements and headings by bookmark, the aliases of objects, and the plan's facts from a key-value table.
     * @param {Array<{name: string, columns: string[], rows: any[][], content?: boolean, idColumn?: string|null}>} tables
     * @returns {{records: any[], candidates: any[], statements: any[], aliases: any[], meta: Record<string, string>, tables: Record<string, string[]>}}
     */
    function read(tables) {
      const records = []; const candidates = []; const statements = []; const aliases = []; let meta = {};
      const found = { model: [], links: [], statements: [], aliases: [], meta: [], columns: [] };
      const refColumns = new Set();
      for (const tb of tables || []) {
        if (tb.content) {
          const idCol = str(tb.idColumn || '').toLowerCase();
          tb.rows.forEach((row, i) => {
            const rec = recordOf(tb.columns, row);
            if (rec.fid === undefined || rec.fid === null) rec.fid = idCol && rec[idCol] !== undefined ? rec[idCol] : i + 1;
            const nameCol = Object.keys(rec).find((c) => COLUMNS.name.test(c) && str(rec[c]).trim());
            const codeCol = Object.keys(rec).find((c) => COLUMNS.code.test(c) && str(rec[c]).trim());
            const r = { objektid: plan.contentId(rec, tb.name), lager: tb.name, fid: str(rec.fid), namn: nameCol ? str(rec[nameCol]).trim() : '', kod: codeCol ? str(rec[codeCol]).trim() : '', attrs: rec };
            records.push(r);
            // The areas' own columns that name their bookmarks or statements (weaker than a table of links).
            const docCol = Object.keys(rec).find((c) => COLUMNS.document.test(c) && !/^dokumentreferens/.test(c) && str(rec[c]).trim());
            const seen = new Set();
            for (const c of Object.keys(rec)) {
              if (!COLUMNS.ref.test(c)) continue;
              for (const ref of parts(rec[c])) {
                refColumns.add(c);
                if (seen.has(fold(ref))) continue;
                seen.add(fold(ref));
                candidates.push({ ref, objekt: r.objektid, direct: true, dokumentnamn: docCol ? str(rec[docCol]).trim() : '', typ: /st[aä]llning/.test(c) ? STATEMENT : '', kalla: 'attribut', fran: c });
              }
            }
          });
          continue;
        }
        const role = tableRole(tb.name, tb.columns);
        if (!role) continue;
        found[role].push(tb.name);
        const statementTable = /st[aä]llning/i.test(tb.name);
        if (role === 'model' || role === 'links') {
          const ref = pick(tb.columns, COLUMNS.ref, REF_ORDER);
          const obj = pick(tb.columns, COLUMNS.object, [/^objektidentitet$/, /^objekt_?id$/]);
          const docId = lowerNames(tb.columns).indexOf('dokument_id');
          const doc = pick(tb.columns, COLUMNS.document, [/^dokumentreferens/]);
          const typ = pick(tb.columns, COLUMNS.type);
          const refName = ref >= 0 ? lowerNames(tb.columns)[ref] : '';
          if (ref < 0) continue;
          for (const row of tb.rows) {
            const docValue = doc >= 0 ? str(row[doc]).trim() : '';
            for (const value of role === 'model' ? [str(row[ref]).trim()] : parts(row[ref])) {
              if (!value) continue;
              candidates.push({ ref: value, objekt: obj >= 0 ? str(row[obj]).trim() : '', dokumentId: docId >= 0 ? str(row[docId]).trim() : '', dokumentreferens: docValue, dokumentnamn: docValue,
                typRaw: typ >= 0 ? row[typ] : '', typ: typ < 0 && (statementTable || /st[aä]llning/.test(refName)) ? STATEMENT : '', kalla: role === 'model' ? 'modell' : 'tabell', fran: tb.name });
            }
          }
        } else if (role === 'statements') {
          const refs = lowerNames(tb.columns).map((c, i) => (COLUMNS.ref.test(c) ? i : -1)).filter((i) => i >= 0);
          const own = pick(tb.columns, COLUMNS.ref, REF_ORDER);
          const ids = lowerNames(tb.columns).map((c, i) => (/^(uuid|id|objektidentitet)$/.test(c) ? i : -1)).filter((i) => i >= 0);
          const heading = pick(tb.columns, COLUMNS.heading); const text = pick(tb.columns, COLUMNS.text);
          const doc = pick(tb.columns, COLUMNS.document);
          const typ = pick(tb.columns, COLUMNS.type);
          const bookmarkTable = /^avsnittsbokm/i.test(tb.name);
          for (const row of tb.rows) {
            const name = str(row[own]).trim();
            if (!name) continue;
            const names = refs.concat(ids).map((i) => str(row[i]).trim()).filter(Boolean);
            statements.push({ name, aliases: Array.from(new Set(names)), rubrik: heading >= 0 ? str(row[heading]).trim() : '', text: text >= 0 ? str(row[text]).trim() : '', dokument: doc >= 0 ? str(row[doc]).trim() : '',
              typ: typ >= 0 ? str(row[typ]).trim() : statementTable ? STATEMENT : '', fran: tb.name, headingOnly: bookmarkTable });
          }
        } else if (role === 'aliases') {
          const obj = pick(tb.columns, COLUMNS.object); const lay = pick(tb.columns, COLUMNS.layer); const fid = pick(tb.columns, /^(objekt_fid|feature_fid|lager_fid|fid)$/);
          for (const row of tb.rows) aliases.push({ objekt: str(row[obj]).trim(), lager: str(row[lay]).trim(), fid: str(row[fid]).trim() });
        } else if (role === 'meta') meta = Object.assign(metaOf(tb), meta);
      }
      found.columns = Array.from(refColumns);
      return { records, candidates, statements, aliases, meta, tables: found };
    }

    /**
     * An index of the plan's objects for resolving the ids a link names. `resolve(id)` gives the objects' ids (as their rows keep
     * them), [] when none is found; `whole(id)` is true for the plan itself or no object at all.
     * @param {any[]} records @param {any[]} [aliases] @param {string} [planId]
     */
    function objectIndex(records, aliases, planId) {
      const own = new Map(); const other = new Map(); const byDocument = new Map(); const byPlace = new Map(); const byName = new Map();
      const add = (map, k, id) => { if (!k) return; const set = map.get(k) || new Set(); set.add(id); map.set(k, set); };
      for (const r of records || []) {
        if (!r.objektid) continue;
        add(own, key(r.objektid), r.objektid);
        add(byName, key(r.namn), r.objektid);
        for (const c of ALIAS_COLUMNS) if (r.attrs && r.attrs[c] !== undefined && r.attrs[c] !== null && !(c === 'id' && /^\d+$/.test(str(r.attrs[c]).trim()))) add(other, key(r.attrs[c]), r.objektid);
        add(byPlace, key(`${r.lager}:${r.fid}`), r.objektid);
        if (r.attrs && r.attrs.dokument_id) add(byDocument, key(r.attrs.dokument_id), r.objektid);
      }
      for (const a of aliases || []) {
        const hit = byPlace.get(key(`${a.lager}:${a.fid}`)) || byPlace.get(key(`${a.lager.replace(/^.*\./, '')}:${a.fid}`));
        if (hit) for (const id of hit) add(other, key(a.objekt), id);
      }
      const planKey = key(planId);
      return {
        whole: (id) => !key(id) || (!!planKey && key(id) === planKey),
        /** @param {string} id @param {string} [documentId] the model 0.3's dokument_id when the object id is empty */
        resolve(id, documentId) {
          const k = key(id);
          // An area's name only as a last resort, and only when one area has it.
          const named = k ? byName.get(k) : null;
          const set = (k && (own.get(k) || other.get(k) || byPlace.get(k) || (named && named.size === 1 ? named : null))) || (!k && documentId ? own.get(key(documentId)) || byDocument.get(key(documentId)) : null);
          return set ? Array.from(set) : [];
        },
        has: (id) => own.has(key(id)),
      };
    }

    /**
     * The links of all sources with their objects resolved, weaker sources left out for objects a stronger one links: each
     * {bokmarke, objektid ('' the whole plan), known, dokumentreferens, dokumentnamn, typ, typRaw, kalla, fran}, and per source
     * how many were read and used.
     * @param {any[]} candidates @param {ReturnType<typeof objectIndex>} index
     * @returns {{links: any[], used: Array<{kalla: string, fran: string, lasta: number, antal: number}>, unresolved: string[]}}
     */
    function resolveLinks(candidates, index) {
      const links = []; const counts = new Map(); const unresolved = new Set();
      const linked = new Set();
      for (const kalla of SOURCES) {
        const stronger = new Set(linked);
        for (const c of candidates.filter((x) => x.kalla === kalla)) {
          const count = counts.get(kalla + '\u0000' + c.fran) || { kalla, fran: c.fran, lasta: 0, antal: 0 };
          counts.set(kalla + '\u0000' + c.fran, count);
          count.lasta++;
          const base = { bokmarke: c.ref, rubrik: '', dokumentreferens: c.dokumentreferens || '', dokumentnamn: c.dokumentnamn || '', typ: c.typ || '', typRaw: c.typRaw || '', kalla, fran: c.fran };
          if (!c.direct && index.whole(c.objekt) && !c.dokumentId) { links.push(Object.assign(base, { objektid: '', known: true })); count.antal++; continue; }
          const ids = c.direct ? [c.objekt] : index.resolve(c.objekt, c.dokumentId);
          if (!ids.length) {
            if (c.dokumentId && index.whole(c.dokumentId)) { links.push(Object.assign(base, { objektid: '', known: true })); count.antal++; continue; }
            unresolved.add(c.objekt || c.dokumentId);
            links.push(Object.assign(base, { objektid: plan.normId(c.objekt), known: false }));
            continue;
          }
          for (const id of ids) {
            if (stronger.has(key(id))) continue;
            links.push(Object.assign({}, base, { objektid: id, known: true }));
            linked.add(key(id));
            count.antal++;
          }
        }
      }
      return { links, used: Array.from(counts.values()), unresolved: Array.from(unresolved).filter(Boolean) };
    }

    /**
     * A finder of Word bookmarks (and statements of a table) by a name a link gives: the name itself, in any case, folded, without
     * a prefix (op_, bm_), by its heading or first line, or through a statement's other names (its id, its UUID).
     * @param {Array<{name: string, rubrik?: string, text?: string}>} bookmarks visible Word bookmarks, text document first
     * @param {any[]} [statements] from `read`
     * @returns {(name: string) => string} the bookmark's own name, '' when none
     */
    function bookmarkMatcher(bookmarks, statements) {
      const exact = new Set(); const lower = new Map(); const folded = new Map(); const headings = new Map();
      const strip = (f) => f.replace(/^(op|bm|bokmarke|avsnitt)(?=[\p{L}\p{N}])/u, '');
      const put = (map, k, name) => { if (k && !map.has(k)) map.set(k, name); };
      const heading = (k, name) => { if (!k) return; if (headings.has(k) && headings.get(k) !== name) headings.set(k, null); else headings.set(k, name); };
      for (const b of bookmarks || []) {
        exact.add(b.name); put(lower, b.name.toLowerCase(), b.name); put(folded, fold(b.name), b.name); put(folded, strip(fold(b.name)), b.name);
        heading(fold(b.rubrik), b.name); heading(fold(str(b.text).split('\n')[0]), b.name);
      }
      const own = (name) => {
        const n = str(name).trim();
        if (!n) return '';
        if (exact.has(n)) return n;
        return lower.get(n.toLowerCase()) || folded.get(fold(n)) || folded.get(strip(fold(n))) || headings.get(fold(n)) || '';
      };
      const viaStatement = new Map();
      for (const s of statements || []) for (const a of [s.name].concat(s.aliases || [], s.rubrik ? [s.rubrik] : [])) put(viaStatement, fold(a), s.name);
      return (name) => own(name) || own(viaStatement.get(fold(name)) || '') || '';
    }
    /** The statement of a table a name gives (by its name, other names or heading), or null. @param {any[]} statements */
    function statementFinder(statements) {
      const by = new Map();
      for (const s of statements || []) for (const a of [s.name].concat(s.aliases || [], s.rubrik ? [s.rubrik] : [])) if (fold(a) && !by.has(fold(a))) by.set(fold(a), s);
      return (name) => by.get(fold(name)) || null;
    }

    /** Words that name no area of their own. */
    const GENERIC = new Set(['omrade', 'omraden', 'plangeometri', 'planomrade', 'planen', 'kommunen', 'hela', 'alla']);
    const CODE = /^[\p{Lu}]{1,4}[-_ ]?\d{1,4}[\p{Ll}]?$/u;
    const WORDS = /[^\p{L}\p{N}]+/u;
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+').replace(/[-‐‑‒–—]/g, '[-‐‑‒–—]');
    /** Lines that list a section's areas ("Kopplade områden: …", "gäller områdena A2 och A3"); the whole text when none does. */
    const LIST_LINE = /\b(kopplade|ber[öo]rda|ber[öo]r|g[äa]ller|omfattar|avser|aktuella)\b[^\n]{0,40}\bomr[åa]d/i;
    /**
     * The areas the sections' text names, for the sections that no other source links: a link per section and area (kalla
     * 'text'), the longest name first so that "Trossö kulturmiljö" is not also "Trossö", and a code such as B1 only as a whole word.
     * @param {Array<{name: string, dokument: string, rubrik: string, text: string, typ: string}>} sections
     * @param {any[]} records @param {Set<string>} linked the names of the sections already linked
     * @returns {any[][]} rows [avsnitt, objektid, dokument, typ, 'text']
     */
    function mentions(sections, records, linked) {
      const labels = new Map();
      for (const r of records || []) {
        if (!r.objektid || /plangeometri|planomr[aå]de/i.test(r.lager)) continue;
        for (const label of [r.namn, r.kod]) {
          const l = str(label).trim();
          if (!l || GENERIC.has(fold(l)) || /^\d+$/.test(l) || (l.length < 3 && !CODE.test(l))) continue;
          const k = l.toLowerCase();
          const e = labels.get(k) || { label: l, code: CODE.test(l), ids: new Set() };
          e.ids.add(r.objektid); labels.set(k, e);
        }
      }
      const list = Array.from(labels.values()).sort((a, b) => b.label.length - a.label.length)
        .map((e) => Object.assign(e, { first: e.label.toLowerCase().split(WORDS).filter(Boolean)[0] || '', re: new RegExp(`(?<![\\p{L}\\p{N}])${escape(e.label)}(?![\\p{L}\\p{N}])`, e.code ? 'gu' : 'giu') }));
      const rows = [];
      if (!list.length) return rows;
      for (const s of sections || []) {
        if (linked.has(s.name)) continue;
        const all = [s.rubrik, s.text].filter(Boolean).join('\n');
        const lines = all.split('\n').filter((l) => LIST_LINE.test(l));
        const text = lines.length ? lines.join('\n') : all;
        if (!text) continue;
        const taken = [];
        const free = (a, b) => taken.every(([x, y]) => b <= x || a >= y);
        const ids = new Set();
        // Only the names whose first word the text has are searched for, so that a large plan stays quick.
        const words = new Set(text.toLowerCase().split(WORDS));
        for (const e of list) {
          if (!words.has(e.first)) continue;
          e.re.lastIndex = 0;
          let m;
          while ((m = e.re.exec(text))) {
            const a = m.index; const b = a + m[0].length;
            if (free(a, b)) { taken.push([a, b]); for (const id of e.ids) ids.add(id); }
          }
        }
        for (const id of ids) rows.push([s.name, id, s.dokument, s.typ, 'text']);
      }
      return rows;
    }

    /**
     * What the plan's links add up to, for the plan's facts and its warnings: how many links each source gave, how many areas and
     * ställningstaganden have none, and when there are none at all, why (each reason a key: no text document or bookmarks, no
     * table of links, no columns on the areas, no names in the text, or links whose objects the map lacks).
     * @param {{rows: any[][], sections: any[][], records: any[], used: any[], textRows: number, tables: any, bookmarks: number, unresolved: string[]}} input
     */
    function summary(input) {
      const rows = input.rows || [];
      const linkedIds = new Set(rows.map((r) => key(r[1])).filter(Boolean));
      const linkedSections = new Set(rows.map((r) => r[0]));
      const areas = (input.records || []).filter((r) => r.objektid && !/plangeometri|planomr[aå]de/i.test(r.lager));
      const statements = (input.sections || []).filter((s) => isStatement(s[4]));
      const kallor = (input.used || []).filter((u) => u.antal || u.lasta).map((u) => ({ kalla: u.kalla, fran: u.fran, antal: u.antal, lasta: u.lasta }));
      if (input.textRows) kallor.push({ kalla: 'text', fran: '', antal: input.textRows, lasta: input.textRows });
      const out = {
        antal: rows.length,
        kallor,
        omraden: areas.length, omradenUtan: areas.filter((r) => !linkedIds.has(key(r.objektid))).length,
        avsnitt: (input.sections || []).length, avsnittUtan: (input.sections || []).filter((s) => !linkedSections.has(s[0])).length,
        stallningstaganden: statements.length, stallningstagandenUtan: statements.filter((s) => !linkedSections.has(s[0])).length,
        okanda: (input.unresolved || []).length,
        orsaker: /** @type {string[]} */ ([]),
      };
      if (!rows.length) {
        const t = input.tables || {};
        if (!input.bookmarks && !(input.sections || []).length) out.orsaker.push('notext');
        if (!(t.model || []).length && !(t.links || []).length) out.orsaker.push('notable');
        if (!(t.columns || []).length) out.orsaker.push('nocolumn');
        if ((input.sections || []).length) out.orsaker.push('nomention');
        if ((input.unresolved || []).length) out.orsaker.push('unresolved');
      }
      return out;
    }

    // ---- the box selection ---------------------------------------------------------------------------------------
    const inside = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    function segmentsMeet(p1, p2, q1, q2) {
      const d1 = cross(q1, q2, p1); const d2 = cross(q1, q2, p2); const d3 = cross(p1, p2, q1); const d4 = cross(p1, p2, q2);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
      const on = (a, b, c) => Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
      return (d1 === 0 && on(q1, q2, p1)) || (d2 === 0 && on(q1, q2, p2)) || (d3 === 0 && on(p1, p2, q1)) || (d4 === 0 && on(p1, p2, q2));
    }
    function inRing(p, ring) {
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i]; const b = ring[j];
        if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
      }
      return hit;
    }
    /** Whether a path (a ring or a line) touches the box: a point in it, or an edge across one of its sides. */
    function pathHits(path, b) {
      if (path.some((p) => inside(p, b))) return true;
      const corners = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]];
      for (let i = 1; i < path.length; i++) for (let k = 0; k < 4; k++) if (segmentsMeet(path[i - 1], path[i], corners[k], corners[(k + 1) % 4])) return true;
      return false;
    }
    function polygonHits(rings, b) {
      if (!rings.length) return false;
      if (rings.some((r) => pathHits(r, b))) return true;
      // The box wholly inside the area (and not in one of its holes).
      const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      return inRing(c, rings[0]) && !rings.slice(1).some((h) => inRing(c, h));
    }
    /**
     * Whether a GeoJSON geometry meets a box [west, south, east, north] in the same coordinates (an area inside it, across its
     * edge or around it; a line through it; a point in it).
     * @param {any} g @param {number[]} box @returns {boolean}
     */
    function boxHits(g, box) {
      if (!g || !box) return false;
      const b = [Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])];
      switch (g.type) {
        case 'Point': return inside(g.coordinates, b);
        case 'MultiPoint': return g.coordinates.some((p) => inside(p, b));
        case 'LineString': return pathHits(g.coordinates, b);
        case 'MultiLineString': return g.coordinates.some((l) => pathHits(l, b));
        case 'Polygon': return polygonHits(g.coordinates, b);
        case 'MultiPolygon': return g.coordinates.some((p) => polygonHits(p, b));
        case 'GeometryCollection': return (g.geometries || []).some((x) => boxHits(x, b));
        default: return false;
      }
    }

    return { SOURCES, STATEMENT, key, fold, isStatement, tableRole, contentColumn, linkTable, read, objectIndex, resolveLinks, bookmarkMatcher, statementFinder, mentions, summary, boxHits };
  });
})();
