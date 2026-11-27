// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Editing a digital comprehensive plan (B-73, F65): its sections (the plan description's ställningstaganden and other sections,
 * `_sections`), its areas (the plan's rows in `data`) and the links between them (`_section_links`, a row per bookmark and object,
 * typ the section's type; objektid '' is the whole plan). Every edit is an operation of data/operations (group "plan"), applied
 * through data/recipes, so that it is logged in the dataset's `_log` and undone with the app's own undo; each operation brings its
 * inverse, so an undo never has to copy the whole file (a plan keeps its delivery's files with it). `_meta.plan` follows: the
 * counts per theme and per layer, and an area's sections (`egenskaper.dokument`) as the links now say.
 *
 * Text is plain text: a section's heading is one line and its text lines are its paragraphs, cleaned the way data/plan-delivery
 * reads a Word file's bookmarks, so that what is exported comes back the same. A new section gets a bookmark name by the exchange
 * model's rule (OP-JSON-003: a letter, then at most 39 letters, digits or underscores), unique in the plan; a new area gets a new
 * objektidentitet (a UUID).
 *
 * A change set (B-78: the edits the plan's AI proposes) is a list of those edits that is tried on a copy of the plan first
 * (`tryChanges`) and, once approved, applied as the one step plan_changeset (`applyChanges`): one entry in the log with its
 * provenance, and one undo, whose inverse is every step's own, taken in turn on a copy and run backwards.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/plan-edit', ['data/operations', 'data/datasets', 'data/plan', 'data/geo', 'data/plan-links', 'engines/sqlite'], (ops, datasets, plan, geo, planLinks, sqlite) => {
    const t = (key, params) => D.t(key, params);
    /** The side tables, as data/plan-delivery writes them. */
    const SECTIONS = '_sections';
    const LINKS = '_section_links';
    const SECTION_SQL = 'avsnitt text, dokument text, rubrik text, text text, typ text, ordning integer';
    const LINK_SQL = 'avsnitt text, objektid text, dokument text, typ text, kalla text';
    /** Where a link made or changed here was read (`_section_links.kalla`, beside data/plan-links' modell, tabell, attribut, text). */
    const EDITED = 'redigerad';
    /** The bookmark names the exchange model allows (OP-JSON-003). */
    const BOOKMARK_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
    const MAX_BOOKMARK = 40;
    /** The section type Ställningstagande in Boverket's ÖP catalogue. */
    const STATEMENT = 'Ställningstagande';
    const STATEMENT_UUID = '56d85084-b9d9-43c4-8243-1fbd3b6d3205';
    /** The text document's name when the plan has none yet. */
    const DEFAULT_DOCUMENT = 'planbeskrivning.docx';
    /** The columns of an area that its attributes may change. */
    const AREA_FIELDS = ['innehallstyp', 'namn', 'precisering', 'anvandningsstatus', 'kompletterande', 'utbyggnadsordning'];
    /** Themes whose content may only be areas (ÖP catalogue: Område; the plan's boundary). */
    const AREA_ONLY = new Set(['omrade', 'plangeometri']);
    const FAMILY = { Point: 'point', MultiPoint: 'point', LineString: 'line', MultiLineString: 'line', Polygon: 'polygon', MultiPolygon: 'polygon' };
    const SUFFIX_FAMILY = { polygon: 'polygon', line: 'line', linje: 'line', point: 'point', punkt: 'point' };

    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    /** An id as stored: trimmed, as the plan's rows have it. */
    const idOf = (v) => str(v).trim();
    /** An id as compared (data/plan-links): without braces and quotes, in lower case. */
    const keyOf = (v) => planLinks.key(v);
    /** The same comparison in SQL, for a column. */
    const KEY = (col) => `lower(trim(replace(replace(replace(coalesce(${col}, ''), '{', ''), '}', ''), '"', '')))`;
    const parse = (v) => { if (typeof v !== 'string') return v; const s = v.trim(); if (!/^[[{]/.test(s)) return v; try { return JSON.parse(s); } catch (_e) { return v; } };
    const list = (v) => { const p = parse(v); return Array.isArray(p) ? p.map(str) : str(v).split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean); };
    const rowsOf = (r) => (r[0] ? r[0].values : []);

    // ---- text ----------------------------------------------------------------------------------------------
    // C0 control characters other than tab and line breaks cannot be written to a Word file.
    const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
    /** One line: control characters and runs of white space become a space, trimmed. @param {any} s @returns {string} */
    const cleanLine = (s) => str(s).replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
    /**
     * Plain text with paragraphs: a line per paragraph, each cleaned, empty lines left out (as a Word file's bookmark is read).
     * @param {any} s @returns {string}
     */
    const cleanText = (s) => str(s).replace(/\r\n?/g, '\n').split('\n').map(cleanLine).filter(Boolean).join('\n');
    /** Whether a section's text begins with its own heading (its bookmark spans the heading, as Word files often have it). */
    const spansHeading = (s) => !!(s && s.rubrik && str(s.text).split('\n')[0] === s.rubrik);
    /** A section's text without its heading line, for editing. @param {{rubrik?: string, text?: string}} s @returns {string} */
    const bodyOf = (s) => (spansHeading(s) ? str(s.text).split('\n').slice(1).join('\n') : str(s && s.text));
    /**
     * The text to keep for a section edited as heading and body: with the heading as its first line again when the section's
     * bookmark spanned it before. @param {{rubrik?: string, text?: string}} s @param {string} rubrik @param {string} body
     */
    function composeText(s, rubrik, body) {
      const head = cleanLine(rubrik); const text = cleanText(body);
      return spansHeading(s) && head ? [head, text].filter(Boolean).join('\n') : text;
    }
    /** True for a section of the type Ställningstagande (by name in any case, or by the catalogue's id). */
    const isStatement = (s) => planLinks.isStatement(s && s.typ);

    // ---- names and ids -------------------------------------------------------------------------------------
    /** Whether a bookmark name follows the exchange model's rule. @param {any} name @returns {boolean} */
    const validBookmark = (name) => BOOKMARK_NAME.test(str(name));
    /**
     * A new bookmark name from a heading: `op_` and the heading's words in ASCII (å, ä → a, ö → o), at most 40 characters, made
     * unique among `taken` (compared without case, as Word compares them) with _2, _3 …
     * @param {string} heading @param {Iterable<string>} [taken] @returns {string}
     */
    function bookmarkName(heading, taken) {
      const used = new Set(Array.from(taken || [], (x) => str(x).toLowerCase()));
      const words = str(heading).toLowerCase().replace(/æ/g, 'ae').replace(/[øö]/g, 'o').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ß/g, 'ss')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const base = ('op_' + (words || 'avsnitt')).slice(0, MAX_BOOKMARK).replace(/_+$/, '');
      if (!used.has(base.toLowerCase())) return base;
      for (let n = 2; ; n++) {
        const tail = '_' + n;
        const name = base.slice(0, MAX_BOOKMARK - tail.length).replace(/_+$/, '') + tail;
        if (!used.has(name.toLowerCase())) return name;
      }
    }
    /** A new objektidentitet: a random UUID in lower case, as the plan's rows keep them. @returns {string} */
    function newId() {
      const c = globalThis.crypto;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // ---- the tables -------------------------------------------------------------------------------------------
    async function ensureTables(engine) {
      await engine.run(`create table if not exists ${SECTIONS} (${SECTION_SQL})`);
      await engine.run(`create table if not exists ${LINKS} (${LINK_SQL})`);
      // A plan read before the links' sources were kept has four columns; the fifth is added (empty is 'modell').
      const cols = rowsOf(await engine.exec(`pragma table_info(${LINKS})`)).map((r) => str(r[1]));
      if (!cols.includes('kalla')) await engine.run(`alter table ${LINKS} add column kalla text`);
      await engine.run(`create index if not exists ${q(SECTIONS + '_avsnitt')} on ${SECTIONS} (avsnitt)`);
      await engine.run(`create index if not exists ${q(LINKS + '_avsnitt')} on ${LINKS} (avsnitt)`);
      await engine.run(`create index if not exists ${q(LINKS + '_objektid')} on ${LINKS} (objektid)`);
    }
    const sectionOf = (r) => ({ avsnitt: str(r[0]), dokument: str(r[1]), rubrik: str(r[2]), text: str(r[3]), typ: str(r[4]), ordning: Number(r[5]) || 0 });
    async function findSection(engine, avsnitt, dokument) {
      const r = await engine.exec(`select avsnitt, dokument, rubrik, text, typ, ordning from ${SECTIONS} where avsnitt = ? and coalesce(dokument, '') = ?`, [str(avsnitt), str(dokument)]);
      const row = rowsOf(r)[0];
      return row ? sectionOf(row) : null;
    }
    async function sectionOrFail(engine, avsnitt, dokument) {
      const s = await findSection(engine, avsnitt, dokument);
      if (!s) throw new Error(t('plan.edit.err.section', { name: str(avsnitt) }));
      return s;
    }
    /** The links of a section: [{objektid, typ, kalla}]. */
    async function linksOf(engine, avsnitt, dokument) {
      const r = await engine.exec(`select coalesce(objektid, ''), coalesce(typ, ''), coalesce(kalla, '') from ${LINKS} where avsnitt = ? and coalesce(dokument, '') = ? order by rowid`, [str(avsnitt), str(dokument)]);
      return rowsOf(r).map((x) => ({ objektid: str(x[0]), typ: str(x[1]), kalla: str(x[2]) }));
    }
    /** A link written with named columns; one made here has the source 'redigerad', one put back by an undo its own. */
    const insertLink = (engine, l) => engine.run(`insert into ${LINKS} (avsnitt, objektid, dokument, typ, kalla) values (?, ?, ?, ?, ?)`, [str(l.avsnitt), idOf(l.objektid), str(l.dokument), str(l.typ), str(l.kalla) || EDITED]);
    /** The text document a new section goes to: the plan's text document, else the one its sections use most, else a new one. */
    async function defaultDocument(engine) {
      const files = await engine.exec("select count(*) from sqlite_master where type = 'table' and name = '_files'");
      if (Number(rowsOf(files)[0][0])) {
        const doc = rowsOf(await engine.exec("select name from _files where kind = 'textdokument' order by name limit 1"))[0];
        if (doc) return str(doc[0]);
      }
      const used = rowsOf(await engine.exec(`select dokument, count(*) from ${SECTIONS} where coalesce(dokument, '') != '' group by dokument order by 2 desc, 1 limit 1`))[0];
      return used ? str(used[0]) : DEFAULT_DOCUMENT;
    }
    const hasColumn = (ctx, name) => ctx.columns.some((c) => c.name === name);
    function requireArea(ctx) { if (!hasColumn(ctx, 'tema') || !hasColumn(ctx, 'innehallstyp') || !hasColumn(ctx, 'objektid')) throw new Error(t('plan.edit.err.notop')); }
    /** A plan row as an object, by its objektid in any form. */
    async function areaOf(ctx, objektid) {
      const names = ctx.columns.map((c) => c.name);
      const r = await ctx.engine.exec(`select ${names.map(q).join(', ')} from data where objektid = ? or ${KEY('objektid')} = ? limit 1`, [idOf(objektid), keyOf(objektid)]);
      const row = rowsOf(r)[0];
      if (!row) return null;
      const out = {};
      names.forEach((n, i) => { out[n] = row[i]; });
      return out;
    }
    async function areaOrFail(ctx, objektid) {
      const a = await areaOf(ctx, objektid);
      if (!a) throw new Error(t('plan.edit.err.area', { id: str(objektid) }));
      return a;
    }

    // ---- geometry -----------------------------------------------------------------------------------------
    const finite = (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
    const ring = (r) => Array.isArray(r) && r.length >= 4 && r.every(finite);
    const line = (l) => Array.isArray(l) && l.length >= 2 && l.every(finite);
    const VALID = {
      Point: finite, MultiPoint: (c) => Array.isArray(c) && c.length > 0 && c.every(finite),
      LineString: line, MultiLineString: (c) => Array.isArray(c) && c.length > 0 && c.every(line),
      Polygon: (c) => Array.isArray(c) && c.length > 0 && c.every(ring), MultiPolygon: (c) => Array.isArray(c) && c.length > 0 && c.every((p) => Array.isArray(p) && p.length > 0 && p.every(ring)),
    };
    /**
     * A geometry for a plan row: GeoJSON (object or text) in WGS 84, a point, line or area (single or multi) with usable positions.
     * @param {any} value @returns {any} the geometry
     */
    function checkGeometry(value) {
      const g = geo.parseGeometry(value);
      if (!g || !VALID[g.type] || !VALID[g.type](g.coordinates)) throw new Error(t('plan.edit.err.geometry'));
      return { type: g.type, coordinates: g.coordinates };
    }
    /** The kind of geometry a layer takes by its table name (…_polygon, _line, _point, _linje, _punkt), or '' when it does not say. */
    function layerFamily(lager, tema) {
      if (AREA_ONLY.has(str(tema))) return 'polygon';
      const m = /_(polygon|line|point|linje|punkt)$/i.exec(str(lager));
      return m ? SUFFIX_FAMILY[m[1].toLowerCase()] : /^innehall_op_(omrade|plangeometri)$/i.test(str(lager)) ? 'polygon' : '';
    }
    /** The family of a geometry: 'polygon', 'line' or 'point'. */
    const familyOf = (g) => FAMILY[g && g.type] || '';
    function fitsLayer(g, lager, tema) {
      const want = layerFamily(lager, tema);
      if (want && familyOf(g) !== want) throw new Error(t('plan.edit.err.geometry.layer', { mark: t('layers.mark.' + want) }));
    }
    /**
     * The layer (table) and file a new area of a theme and kind of geometry goes to in a plan whose rows name their layers:
     * `innehall_op_<tema>_<polygon|line|point>` (the area and the plan boundary have tables of their own), in the plan map's file.
     * @param {string} tema @param {string} family 'polygon', 'line' or 'point' @param {string} fil
     */
    function tableFor(tema, family, fil) {
      const key = plan.themeKey(tema) || 'omrade';
      if (AREA_ONLY.has(key)) return { lager: 'innehall_op_' + key, fil };
      return { lager: `innehall_op_${key}_${family || 'polygon'}`, fil };
    }

    // ---- _meta.plan ---------------------------------------------------------------------------------------
    async function planInfo(engine) {
      const r = rowsOf(await engine.exec("select value from _meta where key = 'plan'"))[0];
      try { const o = r ? JSON.parse(r[0]) : {}; return o && typeof o === 'object' ? o : {}; } catch (_e) { return {}; }
    }
    /**
     * The plan's counts after an edit: objects per theme (`antal`) and per layer and file (`lager`, a layer new to the plan added
     * with its kind of geometry), in `_meta.plan` and on the open dataset.
     */
    async function refreshMeta(ctx) {
      const info = await planInfo(ctx.engine);
      const antal = {};
      for (const [tema, n] of rowsOf(await ctx.engine.exec("select coalesce(nullif(tema, ''), 'annan'), count(*) from data group by 1 order by 1"))) antal[str(tema)] = Number(n);
      info.antal = antal;
      if (hasColumn(ctx, 'lager')) {
        const fil = hasColumn(ctx, 'fil') ? "coalesce(fil, '')" : "''";
        const counted = rowsOf(await ctx.engine.exec(`select lager, ${fil}, count(*), max(geometrityp) from data where coalesce(lager, '') != '' group by 1, 2 order by 1, 2`));
        const lager = Array.isArray(info.lager) ? info.lager.map((l) => Object.assign({}, l)) : [];
        for (const l of lager) { const hit = counted.find((c) => str(c[0]) === str(l.namn) && str(c[1]) === str(l.fil)); l.antal = hit ? Number(hit[2]) : 0; }
        for (const [namn, f, n, typ] of counted) {
          if (lager.some((l) => str(l.namn) === str(namn) && str(l.fil) === str(f))) continue;
          lager.push({ namn: str(namn), titel: str(namn), fil: str(f), roll: 'plankarta', geometrityp: str(typ), antal: Number(n), crs: str(info.crs) || 'EPSG:3006' });
        }
        info.lager = lager;
      }
      await ctx.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['plan', JSON.stringify(info)]);
      if (ctx.datasetId) { try { (await datasets.ensureOpen(ctx.datasetId)).meta.plan = info; } catch (_e) { /* not open */ } }
      return info;
    }
    /**
     * The sections an area's facts name (`egenskaper.dokument`, as the import gave them), as its links now say: their headings in
     * the order of the plan description; the fact goes when the area has none. @param {any} ctx @param {string[]} ids
     */
    async function refreshAreaDocs(ctx, ids) {
      if (!hasColumn(ctx, 'egenskaper')) return;
      for (const id of Array.from(new Set(ids.map(keyOf).filter(Boolean)))) {
        const heads = rowsOf(await ctx.engine.exec(`select coalesce(nullif(s.rubrik, ''), s.avsnitt) from ${SECTIONS} s join (select distinct avsnitt, coalesce(dokument, '') as dokument from ${LINKS} where ${KEY('objektid')} = ?) l on l.avsnitt = s.avsnitt and l.dokument = coalesce(s.dokument, '') order by s.ordning`, [id])).map((r) => str(r[0]));
        const r = rowsOf(await ctx.engine.exec(`select rowid, egenskaper from data where ${KEY('objektid')} = ?`, [id]));
        for (const [rowid, text] of r) {
          let e = {};
          try { e = text ? JSON.parse(text) : {}; } catch (_e) { e = {}; }
          if (!e || typeof e !== 'object' || Array.isArray(e)) e = {};
          if (heads.length) e.dokument = Array.from(new Set(heads)); else delete e.dokument;
          await ctx.engine.run('update data set egenskaper = ? where rowid = ?', [Object.keys(e).length ? JSON.stringify(e) : null, rowid]);
        }
      }
    }
    /** The facts (`egenskaper`) of areas as they are now, for an undo to put back exactly: JSON {objektid: text or null}. */
    async function factsOf(ctx, ids) {
      const out = {};
      if (!hasColumn(ctx, 'egenskaper')) return JSON.stringify(out);
      for (const id of Array.from(new Set(ids.map(keyOf).filter(Boolean)))) {
        const r = rowsOf(await ctx.engine.exec(`select egenskaper from data where ${KEY('objektid')} = ? limit 1`, [id]))[0];
        if (r) out[id] = r[0] === undefined ? null : r[0];
      }
      return JSON.stringify(out);
    }
    /** After a change of links: the areas' facts put back as an undo gives them (`p.egenskaper`), else made anew from the links. */
    async function areaFacts(ctx, ids, p) {
      const given = parse(p && p.egenskaper);
      if (!given || typeof given !== 'object' || Array.isArray(given)) return refreshAreaDocs(ctx, ids);
      if (!hasColumn(ctx, 'egenskaper')) return undefined;
      for (const [id, text] of Object.entries(given)) await ctx.engine.run(`update data set egenskaper = ? where ${KEY('objektid')} = ?`, [text === undefined ? null : text, keyOf(id)]);
      return undefined;
    }

    // ---- operations: sections ---------------------------------------------------------------------------------
    /** A step written as SQL or R is a comment: the edit's name and what it changed. */
    const noteOf = (op, p) => `${t('op.' + op)}: ${str(p.avsnitt || p.objektid || (parse(p.row) || {}).objektid)}`;
    const comment = (op) => (p) => [`-- ${noteOf(op, p)}`];
    const rComment = (op) => (p) => `# ${noteOf(op, p)}`;

    ops.define({
      id: 'plan_section_set', group: 'plan', manualPreview: true,
      params: [{ name: 'avsnitt', type: 'text', required: true }, { name: 'dokument', type: 'text' }, { name: 'rubrik', type: 'text' }, { name: 'text', type: 'lines' }, { name: 'typ', type: 'text' }, { name: 'egenskaper', type: 'lines' }],
      async inverse(ctx, p) {
        await ensureTables(ctx.engine);
        const s = await sectionOrFail(ctx.engine, p.avsnitt, p.dokument);
        const ids = (await linksOf(ctx.engine, s.avsnitt, s.dokument)).map((l) => l.objektid);
        return { op: 'plan_section_set', params: { avsnitt: s.avsnitt, dokument: s.dokument, rubrik: s.rubrik, text: s.text, typ: s.typ, egenskaper: await factsOf(ctx, ids) } };
      },
      async apply(ctx, p) {
        await ensureTables(ctx.engine);
        const s = await sectionOrFail(ctx.engine, p.avsnitt, p.dokument);
        const next = { rubrik: p.rubrik === undefined ? s.rubrik : cleanLine(p.rubrik), text: p.text === undefined ? s.text : cleanText(p.text), typ: p.typ === undefined ? s.typ : cleanLine(p.typ) };
        await ctx.engine.run(`update ${SECTIONS} set rubrik = ?, text = ?, typ = ? where avsnitt = ? and coalesce(dokument, '') = ?`, [next.rubrik, next.text, next.typ, s.avsnitt, s.dokument]);
        // The links carry the section's type (dokumentavsnitt.avsnittstyp_varde).
        if (next.typ !== s.typ) await ctx.engine.run(`update ${LINKS} set typ = ? where avsnitt = ? and coalesce(dokument, '') = ?`, [next.typ, s.avsnitt, s.dokument]);
        if (next.rubrik !== s.rubrik || p.egenskaper) await areaFacts(ctx, (await linksOf(ctx.engine, s.avsnitt, s.dokument)).map((l) => l.objektid), p);
        return { rows: 1 };
      },
      toSQL: comment('plan_section_set'), toR: rComment('plan_section_set'),
    });

    ops.define({
      id: 'plan_section_add', group: 'plan', manualPreview: true,
      params: [{ name: 'avsnitt', type: 'text', required: true }, { name: 'dokument', type: 'text' }, { name: 'rubrik', type: 'text' }, { name: 'text', type: 'lines' }, { name: 'typ', type: 'text' }, { name: 'ordning', type: 'text' }, { name: 'after', type: 'text' }, { name: 'links', type: 'lines' }, { name: 'egenskaper', type: 'lines' }],
      async inverse(ctx, p) {
        const ids = (Array.isArray(parse(p.links)) ? parse(p.links) : []).map((l) => idOf(l && typeof l === 'object' ? l.objektid : l));
        return { op: 'plan_section_delete', params: { avsnitt: str(p.avsnitt), dokument: str(p.dokument), egenskaper: await factsOf(ctx, ids) } };
      },
      async apply(ctx, p) {
        await ensureTables(ctx.engine);
        const avsnitt = str(p.avsnitt).trim();
        if (!validBookmark(avsnitt)) throw new Error(t('plan.edit.err.bookmark', { name: avsnitt }));
        const taken = rowsOf(await ctx.engine.exec(`select 1 from ${SECTIONS} where lower(avsnitt) = ? limit 1`, [avsnitt.toLowerCase()]));
        if (taken.length) throw new Error(t('plan.edit.err.bookmark.taken', { name: avsnitt }));
        const dokument = str(p.dokument) || await defaultDocument(ctx.engine);
        let ordning = Number(p.ordning);
        if (!Number.isFinite(ordning) || p.ordning === '' || p.ordning === undefined || p.ordning === null) {
          const after = p.after ? await findSection(ctx.engine, p.after, dokument) : null;
          if (after) {
            ordning = after.ordning + 1;
            await ctx.engine.run(`update ${SECTIONS} set ordning = ordning + 1 where ordning >= ?`, [ordning]);
          } else ordning = Number(rowsOf(await ctx.engine.exec(`select coalesce(max(ordning), -1) + 1 from ${SECTIONS}`))[0][0]) || 0;
        }
        const typ = cleanLine(p.typ);
        await ctx.engine.run(`insert into ${SECTIONS} (avsnitt, dokument, rubrik, text, typ, ordning) values (?, ?, ?, ?, ?, ?)`, [avsnitt, dokument, cleanLine(p.rubrik), cleanText(p.text), typ, ordning]);
        const links = (Array.isArray(parse(p.links)) ? parse(p.links) : []).map((l) => (l && typeof l === 'object' ? { objektid: idOf(l.objektid), typ: str(l.typ) || typ, kalla: str(l.kalla) } : { objektid: idOf(l), typ, kalla: '' }));
        for (const l of links) await insertLink(ctx.engine, Object.assign({ avsnitt, dokument }, l));
        await areaFacts(ctx, links.map((l) => l.objektid), p);
        return { rows: 1, links: links.length, avsnitt, dokument };
      },
      toSQL: comment('plan_section_add'), toR: rComment('plan_section_add'),
    });

    ops.define({
      id: 'plan_section_delete', group: 'plan', manualPreview: true,
      params: [{ name: 'avsnitt', type: 'text', required: true }, { name: 'dokument', type: 'text' }, { name: 'egenskaper', type: 'lines' }],
      async inverse(ctx, p) {
        await ensureTables(ctx.engine);
        const s = await sectionOrFail(ctx.engine, p.avsnitt, p.dokument);
        const links = await linksOf(ctx.engine, s.avsnitt, s.dokument);
        return { op: 'plan_section_add', params: Object.assign({}, s, { links: JSON.stringify(links), egenskaper: await factsOf(ctx, links.map((l) => l.objektid)) }) };
      },
      async apply(ctx, p) {
        await ensureTables(ctx.engine);
        const s = await sectionOrFail(ctx.engine, p.avsnitt, p.dokument);
        const linked = await linksOf(ctx.engine, s.avsnitt, s.dokument);
        await ctx.engine.run(`delete from ${LINKS} where avsnitt = ? and coalesce(dokument, '') = ?`, [s.avsnitt, s.dokument]);
        await ctx.engine.run(`delete from ${SECTIONS} where avsnitt = ? and coalesce(dokument, '') = ?`, [s.avsnitt, s.dokument]);
        await areaFacts(ctx, linked.map((l) => l.objektid), p);
        return { rows: 1, links: linked.length };
      },
      toSQL: comment('plan_section_delete'), toR: rComment('plan_section_delete'),
    });

    // ---- operations: links ------------------------------------------------------------------------------------
    ops.define({
      id: 'plan_link', group: 'plan', manualPreview: true,
      params: [{ name: 'avsnitt', type: 'text', required: true }, { name: 'dokument', type: 'text' }, { name: 'objekt', type: 'lines' }, { name: 'typ', type: 'text' }, { name: 'links', type: 'lines' }, { name: 'egenskaper', type: 'lines' }],
      async inverse(ctx, p) {
        await ensureTables(ctx.engine);
        const had = new Set((await linksOf(ctx.engine, p.avsnitt, p.dokument)).map((l) => keyOf(l.objektid)));
        const wanted = Array.from(new Set(linkRows(p, '').map((l) => l.objektid).filter((id) => !had.has(keyOf(id)))));
        return { op: 'plan_unlink', params: { avsnitt: str(p.avsnitt), dokument: str(p.dokument), objekt: JSON.stringify(wanted), egenskaper: await factsOf(ctx, wanted) } };
      },
      async apply(ctx, p) {
        await ensureTables(ctx.engine);
        const s = await sectionOrFail(ctx.engine, p.avsnitt, p.dokument);
        const had = new Set((await linksOf(ctx.engine, s.avsnitt, s.dokument)).map((l) => keyOf(l.objektid)));
        let added = 0; const ids = [];
        for (const l of linkRows(p, s.typ)) {
          if (had.has(keyOf(l.objektid))) continue;
          had.add(keyOf(l.objektid)); ids.push(l.objektid);
          await insertLink(ctx.engine, { avsnitt: s.avsnitt, objektid: l.objektid, dokument: s.dokument, typ: l.typ, kalla: l.kalla });
          added++;
        }
        await areaFacts(ctx, ids, p);
        return { rows: added };
      },
      toSQL: comment('plan_link'), toR: rComment('plan_link'),
    });
    /** The links an operation names: `links` [{objektid, typ}] as they were, else `objekt` (ids) with the type given or the section's. */
    function linkRows(p, typ) {
      const given = parse(p.links);
      if (Array.isArray(given) && given.length) return given.map((l) => (l && typeof l === 'object' ? { objektid: idOf(l.objektid), typ: str(l.typ) || str(p.typ) || typ, kalla: str(l.kalla) } : { objektid: idOf(l), typ: str(p.typ) || typ, kalla: '' }));
      return objektList(p.objekt).map((x) => ({ objektid: x, typ: str(p.typ) || typ, kalla: '' }));
    }

    ops.define({
      id: 'plan_unlink', group: 'plan', manualPreview: true,
      params: [{ name: 'avsnitt', type: 'text', required: true }, { name: 'dokument', type: 'text' }, { name: 'objekt', type: 'lines' }, { name: 'egenskaper', type: 'lines' }],
      async inverse(ctx, p) {
        await ensureTables(ctx.engine);
        const wanted = new Set(objektList(p.objekt).map(keyOf));
        const removed = (await linksOf(ctx.engine, p.avsnitt, p.dokument)).filter((l) => wanted.has(keyOf(l.objektid)));
        return { op: 'plan_link', params: { avsnitt: str(p.avsnitt), dokument: str(p.dokument), links: JSON.stringify(removed), egenskaper: await factsOf(ctx, removed.map((l) => l.objektid)) } };
      },
      async apply(ctx, p) {
        await ensureTables(ctx.engine);
        const s = await sectionOrFail(ctx.engine, p.avsnitt, p.dokument);
        const ids = objektList(p.objekt);
        let removed = 0;
        for (const id of ids) removed += await ctx.engine.run(`delete from ${LINKS} where avsnitt = ? and coalesce(dokument, '') = ? and ${KEY('objektid')} = ?`, [s.avsnitt, s.dokument, keyOf(id)]);
        await areaFacts(ctx, ids, p);
        return { rows: removed };
      },
      toSQL: comment('plan_unlink'), toR: rComment('plan_unlink'),
    });
    /** Object ids from a list, the whole plan ('') kept when the list is JSON. */
    function objektList(v) {
      const p = parse(v);
      return (Array.isArray(p) ? p.map(str) : list(v)).map(idOf);
    }

    // ---- operations: areas ------------------------------------------------------------------------------------
    ops.define({
      id: 'plan_area_add', group: 'plan', manualPreview: true,
      params: [{ name: 'row', type: 'lines', required: true }, { name: 'links', type: 'lines' }, { name: 'egenskaper', type: 'lines' }],
      async inverse(_ctx, p) { const row = parse(p.row) || {}; return { op: 'plan_area_delete', params: { objektid: str(row.objektid) } }; },
      async apply(ctx, p) {
        requireArea(ctx);
        await ensureTables(ctx.engine);
        const row = Object.assign({}, parse(p.row) || {});
        const id = idOf(row.objektid);
        if (!id) throw new Error(t('plan.edit.err.id'));
        if (await areaOf(ctx, id)) throw new Error(t('plan.edit.err.id.taken', { id }));
        row.objektid = id;
        if (row.geometri !== null && row.geometri !== undefined && row.geometri !== '') {
          const g = checkGeometry(row.geometri);
          fitsLayer(g, row.lager, row.tema);
          row.geometri = JSON.stringify(g);
          row.geometrityp = g.type;
        } else { row.geometri = null; row.geometrityp = row.geometrityp || ''; }
        if (row.ordning === undefined || row.ordning === null || row.ordning === '') row.ordning = Number(rowsOf(await ctx.engine.exec('select coalesce(max(ordning), -1) + 1 from data'))[0][0]) || 0;
        const names = ctx.columns.map((c) => c.name);
        await ctx.engine.run(`insert into data (${names.map(q).join(', ')}) values (${names.map(() => '?').join(', ')})`, names.map((n) => (row[n] === undefined || row[n] === '' ? null : row[n])));
        const links = Array.isArray(parse(p.links)) ? parse(p.links) : [];
        for (const l of links) await insertLink(ctx.engine, Object.assign({}, l, { objektid: l.objektid || id }));
        if (links.length) await areaFacts(ctx, [id], p);
        await refreshMeta(ctx);
        return { rows: 1, objektid: id };
      },
      toSQL: comment('plan_area_add'), toR: rComment('plan_area_add'),
    });

    ops.define({
      id: 'plan_area_set', group: 'plan', manualPreview: true,
      params: [{ name: 'objektid', type: 'text', required: true }, { name: 'fields', type: 'lines', required: true }],
      async inverse(ctx, p) {
        requireArea(ctx);
        const a = await areaOrFail(ctx, p.objektid);
        const fields = {};
        for (const k of Object.keys(parse(p.fields) || {})) if (AREA_FIELDS.includes(k) && hasColumn(ctx, k)) fields[k] = a[k] === null || a[k] === undefined ? '' : a[k];
        return { op: 'plan_area_set', params: { objektid: str(a.objektid), fields: JSON.stringify(fields) } };
      },
      async apply(ctx, p) {
        requireArea(ctx);
        const a = await areaOrFail(ctx, p.objektid);
        const fields = parse(p.fields) || {};
        const keys = Object.keys(fields).filter((k) => AREA_FIELDS.includes(k) && hasColumn(ctx, k));
        if (!keys.length) return { rows: 0 };
        const values = keys.map((k) => { const v = k === 'precisering' ? cleanText(fields[k]) : cleanLine(fields[k]); return v === '' ? null : v; });
        await ctx.engine.run(`update data set ${keys.map((k) => q(k) + ' = ?').join(', ')} where objektid = ?`, values.concat([a.objektid]));
        return { rows: 1 };
      },
      toSQL: comment('plan_area_set'), toR: rComment('plan_area_set'),
    });

    ops.define({
      id: 'plan_area_geometry', group: 'plan', manualPreview: true,
      params: [{ name: 'objektid', type: 'text', required: true }, { name: 'geometri', type: 'lines', required: true }],
      async inverse(ctx, p) {
        requireArea(ctx);
        const a = await areaOrFail(ctx, p.objektid);
        return { op: 'plan_area_geometry', params: { objektid: str(a.objektid), geometri: str(a.geometri) } };
      },
      async apply(ctx, p) {
        requireArea(ctx);
        const a = await areaOrFail(ctx, p.objektid);
        const g = checkGeometry(p.geometri);
        fitsLayer(g, a.lager, a.tema);
        await ctx.engine.run('update data set geometri = ?, geometrityp = ? where objektid = ?', [JSON.stringify(g), g.type, a.objektid]);
        return { rows: 1 };
      },
      toSQL: comment('plan_area_geometry'), toR: rComment('plan_area_geometry'),
    });

    ops.define({
      id: 'plan_area_delete', group: 'plan', manualPreview: true,
      params: [{ name: 'objektid', type: 'text', required: true }],
      async inverse(ctx, p) {
        requireArea(ctx);
        await ensureTables(ctx.engine);
        const a = await areaOrFail(ctx, p.objektid);
        const links = rowsOf(await ctx.engine.exec(`select avsnitt, coalesce(dokument, ''), coalesce(typ, ''), coalesce(kalla, ''), objektid from ${LINKS} where ${KEY('objektid')} = ? order by rowid`, [keyOf(a.objektid)])).map((r) => ({ avsnitt: str(r[0]), dokument: str(r[1]), typ: str(r[2]), kalla: str(r[3]), objektid: str(r[4]) }));
        return { op: 'plan_area_add', params: { row: JSON.stringify(a), links: JSON.stringify(links), egenskaper: await factsOf(ctx, [idOf(a.objektid)]) } };
      },
      async apply(ctx, p) {
        requireArea(ctx);
        await ensureTables(ctx.engine);
        const a = await areaOrFail(ctx, p.objektid);
        const links = await ctx.engine.run(`delete from ${LINKS} where ${KEY('objektid')} = ?`, [keyOf(a.objektid)]);
        await ctx.engine.run('delete from data where objektid = ?', [a.objektid]);
        await refreshMeta(ctx);
        return { rows: 1, links };
      },
      toSQL: comment('plan_area_delete'), toR: rComment('plan_area_delete'),
    });

    // ---- a change set: several edits as one step (the plan's AI panel, ui/bearbeta/plan-ai) ------------------------------
    /** The edits a change set may hold, and nothing else. */
    const STEPS = ['plan_section_set', 'plan_section_add', 'plan_section_delete', 'plan_link', 'plan_unlink', 'plan_area_add', 'plan_area_set', 'plan_area_geometry', 'plan_area_delete'];
    /** A change set's steps [{op, params}] from JSON, each one of STEPS. @param {any} v @returns {Array<{op: string, params: Record<string, any>}>} */
    function stepsOf(v) {
      const list = parse(v);
      if (!Array.isArray(list)) throw new Error(t('plan.edit.err.steps'));
      return list.map((s, i) => {
        if (!s || typeof s !== 'object' || !STEPS.includes(s.op) || !s.params || typeof s.params !== 'object') throw new Error(t('plan.edit.err.step', { n: i + 1 }));
        return { op: s.op, params: Object.assign({}, s.params) };
      });
    }
    /**
     * Run steps on a copy of the plan, as recipes.apply would run them one by one: each step's inverse taken just before it runs,
     * then what it gave, or the error that stopped it (a step that fails is left out and the next tried). The plan is not touched.
     * @param {any} engine the plan's @param {any[]} columns @param {Array<{op: string, params: any}>} steps
     * @returns {Promise<Array<{op: string, ok: boolean, inverse?: any, result?: any, error?: string}>>}
     */
    async function trial(engine, columns, steps) {
      const copy = new sqlite.SqliteEngine();
      await copy.start();
      try {
        await copy.open(await engine.export());
        // Without a dataset id the steps keep `_meta.plan` of the copy only (refreshMeta).
        const ctx = ops.makeContext(copy, columns);
        const out = [];
        for (const s of steps) {
          const op = ops.get(s.op);
          try {
            await copy.run('savepoint dm_trial');
            const inverse = await op.inverse(ctx, s.params);
            const result = await op.apply(ctx, s.params);
            await copy.run('release dm_trial');
            out.push({ op: s.op, ok: true, inverse, result });
          } catch (err) {
            try { await copy.run('rollback to dm_trial'); await copy.run('release dm_trial'); } catch (_e) { /* already closed */ }
            out.push({ op: s.op, ok: false, error: String((err && err.message) || err) });
          }
        }
        return out;
      } finally { copy.terminate(); }
    }
    ops.define({
      id: 'plan_changeset', group: 'plan', manualPreview: true,
      params: [{ name: 'steps', type: 'lines', required: true }, { name: 'provenance', type: 'lines' }],
      // The inverse of the whole: every step's own, taken on a copy in turn and run backwards; a step that fails stops it all.
      async inverse(ctx, p) {
        const done = await trial(ctx.engine, ctx.columns, stepsOf(p.steps));
        const bad = done.find((d) => !d.ok);
        if (bad) throw new Error(bad.error);
        return { op: 'plan_changeset', params: { steps: JSON.stringify(done.map((d) => d.inverse).reverse()) } };
      },
      async apply(ctx, p) {
        const steps = stepsOf(p.steps);
        let rows = 0;
        for (const s of steps) { const r = await ops.get(s.op).apply(ctx, s.params); rows += Number(r && r.rows) || 0; }
        return { rows, steps: steps.length };
      },
      toSQL: (p) => [`-- ${t('op.plan_changeset')}: ${stepsOf(p.steps).map((s) => noteOf(s.op, s.params)).join('; ')}`],
      toR: (p) => `# ${t('op.plan_changeset')}: ${stepsOf(p.steps).map((s) => noteOf(s.op, s.params)).join('; ')}`,
    });

    // ---- the edits, as the view and the tests make them ---------------------------------------------------------
    /** Apply an edit as a recipe step and save the plan at once (the view draws it again from the saved plan). */
    async function run(id, op, params) {
      const recipes = D.require('data/recipes');
      const result = await recipes.apply(id, op, params);
      await datasets.flushSaves();
      return result;
    }
    /** Undo the plan's last edit (or any step) with the app's undo, saved at once. @param {string} id @returns {Promise<string>} its label */
    async function undo(id) {
      const label = await D.require('data/recipes').undo(id);
      await datasets.flushSaves();
      return label;
    }
    /**
     * Change a section's heading, text or type. @param {string} id @param {{avsnitt: string, dokument?: string}} key
     * @param {{rubrik?: string, text?: string, typ?: string}} values
     */
    const editSection = (id, key, values) => run(id, 'plan_section_set', Object.assign({ avsnitt: key.avsnitt, dokument: str(key.dokument) }, values));
    /**
     * A new section: its bookmark from its heading unless one is given, in the plan's text document unless another is named, at
     * the end or after the section `after`, linked to `objekt` when given. Answers its bookmark and document.
     * @param {string} id @param {{rubrik?: string, text?: string, typ?: string, avsnitt?: string, dokument?: string, after?: string, objekt?: string[]}} section
     * @returns {Promise<{avsnitt: string, dokument: string}>}
     */
    async function addSection(id, section) {
      const handle = await datasets.ensureOpen(id);
      await ensureTables(handle.engine);
      const taken = rowsOf(await handle.engine.exec(`select avsnitt from ${SECTIONS}`)).map((r) => str(r[0]));
      const avsnitt = str(section.avsnitt).trim() || bookmarkName(section.rubrik || '', taken);
      const dokument = str(section.dokument) || await defaultDocument(handle.engine);
      const typ = section.typ === undefined ? STATEMENT : section.typ;
      const res = await run(id, 'plan_section_add', { avsnitt, dokument, rubrik: str(section.rubrik), text: str(section.text), typ, after: str(section.after), links: JSON.stringify((section.objekt || []).map((o) => ({ objektid: o, typ }))) });
      return { avsnitt: res.avsnitt || avsnitt, dokument: res.dokument || dokument };
    }
    /** Remove a section with its links. @param {string} id @param {{avsnitt: string, dokument?: string}} key */
    const deleteSection = (id, key) => run(id, 'plan_section_delete', { avsnitt: key.avsnitt, dokument: str(key.dokument) });
    /** Link areas ('' for the whole plan) to a section. @param {string} id @param {{avsnitt: string, dokument?: string}} key @param {string[]} objekt */
    const link = (id, key, objekt) => run(id, 'plan_link', { avsnitt: key.avsnitt, dokument: str(key.dokument), objekt: JSON.stringify(objekt) });
    /** Unlink areas from a section. @param {string} id @param {{avsnitt: string, dokument?: string}} key @param {string[]} objekt */
    const unlink = (id, key, objekt) => run(id, 'plan_unlink', { avsnitt: key.avsnitt, dokument: str(key.dokument), objekt: JSON.stringify(objekt) });
    /**
     * A new area: a new objektidentitet, the theme and its layer (`lager` and `fil` given, or the theme's table for the geometry
     * when the plan's rows name their layers), the content type, name and precision, and the geometry in WGS 84.
     * @param {string} id @param {{tema: string, geometry: any, lager?: string, fil?: string, innehallstyp?: string, namn?: string, precisering?: string, objektid?: string}} area
     * @returns {Promise<string>} the new objektidentitet
     */
    async function addArea(id, area) {
      const row = await areaRow(id, area);
      await run(id, 'plan_area_add', { row: JSON.stringify(row) });
      return row.objektid;
    }
    /**
     * The row a new area becomes (addArea's, without adding it): its objektidentitet, theme, layer and file, texts and geometry.
     * @param {string} id @param {Parameters<typeof addArea>[1]} area @returns {Promise<Record<string, any>>}
     */
    async function areaRow(id, area) {
      const handle = await datasets.ensureOpen(id);
      const g = checkGeometry(area.geometry);
      const tema = plan.themeKey(area.tema) || 'omrade';
      const place = area.lager !== undefined ? { lager: str(area.lager), fil: str(area.fil) } : await placeFor(handle, tema, familyOf(g));
      const objektid = area.objektid ? idOf(area.objektid) : newId();
      return { objektid, tema, innehallstyp: cleanLine(area.innehallstyp !== undefined ? area.innehallstyp : plan.OP_CATEGORIES[tema] || ''), namn: cleanLine(area.namn), precisering: cleanText(area.precisering), geometri: JSON.stringify(g), geometrityp: g.type, lager: place.lager, fil: place.fil };
    }
    /** The text document a new section of the plan goes to (the plan's, else the one its sections use most, else a new one). @param {string} id */
    async function documentFor(id) {
      const { engine } = await datasets.ensureOpen(id);
      // A plan without the side tables (read from GeoJSON) gets them with its first section; nothing is written here.
      try { return await defaultDocument(engine); } catch (_err) { return DEFAULT_DOCUMENT; }
    }
    /**
     * Where a new area of a theme goes in a plan: the layer of the plan map that already holds that theme and kind of geometry,
     * else the theme's table in the plan map's file; nothing for a plan whose rows do not name their layers (a layer per theme).
     */
    async function placeFor(handle, tema, family) {
      const cols = handle.columns.map((c) => c.name);
      if (!cols.includes('lager')) return { lager: '', fil: '' };
      const fil = cols.includes('fil') ? 'coalesce(fil, \'\')' : "''";
      const layers = rowsOf(await handle.engine.exec(`select lager, ${fil}, tema, count(*) from data where coalesce(lager, '') != '' and coalesce(tema, '') != 'underlag' group by 1, 2, 3 order by 4 desc`));
      if (!layers.length) return { lager: '', fil: '' };
      const same = layers.find((l) => str(l[2]) === tema && layerFamily(str(l[0]), tema) === family);
      if (same) return { lager: str(same[0]), fil: str(same[1]) };
      const files = rowsOf(await handle.engine.exec("select count(*) from sqlite_master where type = 'table' and name = '_files'"));
      let mapFile = '';
      if (Number(files[0][0])) { const f = rowsOf(await handle.engine.exec("select name from _files where kind = 'plankarta' order by name limit 1"))[0]; if (f) mapFile = str(f[0]); }
      return tableFor(tema, family, mapFile || str(layers[0][1]));
    }
    /** Change an area's attributes (innehållstyp, namn, precisering …). @param {string} id @param {string} objektid @param {Record<string, string>} fields */
    const editArea = (id, objektid, fields) => run(id, 'plan_area_set', { objektid, fields: JSON.stringify(fields) });
    /** Give an area a new geometry (its vertices edited, or moved). @param {string} id @param {string} objektid @param {any} geometry */
    const setGeometry = (id, objektid, geometry) => run(id, 'plan_area_geometry', { objektid, geometri: JSON.stringify(checkGeometry(geometry)) });
    /** Remove an area with its links. @param {string} id @param {string} objektid */
    const deleteArea = (id, objektid) => run(id, 'plan_area_delete', { objektid });
    /**
     * A change set tried on a copy of the plan: per step whether it would run and the error when not. The plan is not touched.
     * @param {string} id @param {Array<{op: string, params: any}>} steps
     * @returns {Promise<Array<{op: string, ok: boolean, error?: string, result?: any}>>}
     */
    async function tryChanges(id, steps) {
      const handle = await datasets.ensureOpen(id);
      return (await trial(handle.engine, handle.columns, stepsOf(steps))).map((d) => (d.ok ? { op: d.op, ok: true, result: d.result } : { op: d.op, ok: false, error: d.error }));
    }
    /**
     * A change set made one step of the plan's log (plan_changeset), with where it came from, undone at once with the app's undo.
     * @param {string} id @param {Array<{op: string, params: any}>} steps @param {Record<string, any>} [provenance]
     */
    const applyChanges = (id, steps, provenance) => run(id, 'plan_changeset', { steps: JSON.stringify(stepsOf(steps)), provenance: JSON.stringify(provenance || {}) });

    /**
     * The content types to choose from per theme: the value lists of the plan's GeoPackage in Boverket's model (the ÖP catalogue,
     * tables `innehall_op_<tema>_lookup`), the land uses the app knows, and those the plan's rows already use.
     * @param {string} id @returns {Promise<Map<string, string[]>>}
     */
    async function catalogue(id) {
      const handle = await datasets.ensureOpen(id);
      const out = new Map();
      const add = (tema, v) => { const words = cleanLine(v); if (!words || !tema) return; const l = out.get(tema) || []; if (!l.some((x) => x.toLowerCase() === words.toLowerCase())) l.push(words); out.set(tema, l); };
      try {
        const files = rowsOf(await handle.engine.exec("select count(*) from sqlite_master where type = 'table' and name = '_files'"));
        const maps = Number(files[0][0]) ? rowsOf(await handle.engine.exec("select name, bytes from _files where kind in ('plankarta', 'original') and (lower(name) like '%.gpkg' or kind = 'plankarta')")) : [];
        for (const [name, bytes] of maps) {
          if (!bytes) continue;
          for (const [tema, values] of await lookupValues(new File([bytes], str(name)))) for (const v of values) add(tema, v);
        }
      } catch (err) { D.log('plan-edit', 'the value lists could not be read', err); }
      for (const use of Object.keys(plan.OP_USE_COLORS)) add('markochvattenanvandning', use.charAt(0).toUpperCase() + use.slice(1));
      for (const [tema, typ] of rowsOf(await handle.engine.exec("select tema, innehallstyp from data where coalesce(innehallstyp, '') != '' group by 1, 2 order by 1, 2"))) add(str(tema), typ);
      for (const [tema, words] of Object.entries(plan.OP_CATEGORIES)) if (!out.has(tema) || AREA_ONLY.has(tema) || tema === 'utvecklingsinriktning') add(tema, words);
      return out;
    }
    /** The value lists of an ÖP GeoPackage: `innehall_op_<tema>_lookup` → its words (a column innehallstyp_varde, else its first text). */
    async function lookupValues(file) {
      // The GeoPackage reader loads with the group 'plan' (src/boot.js).
      const sqliteImp = await D.ensure(['plan'], () => D.require('io/importers/sqlite'));
      const out = new Map();
      const { engine } = await sqliteImp.openFile(file);
      try {
        const names = rowsOf(await engine.exec("select name from sqlite_master where type = 'table' and name like 'innehall_op_%_lookup'")).map((r) => str(r[0]));
        for (const name of names) {
          const m = /^innehall_op_(.+?)(?:_(?:polygon|line|point|linje|punkt))?_lookup$/i.exec(name);
          if (!m) continue;
          const cols = rowsOf(await engine.exec(`pragma table_info(${q(name)})`)).map((r) => str(r[1]));
          const col = cols.find((c) => /^innehallstyp(_varde)?$/i.test(c)) || cols.find((c) => /varde|value|namn|name/i.test(c));
          if (!col) continue;
          const values = rowsOf(await engine.exec(`select distinct ${q(col)} from ${q(name)} where ${q(col)} is not null limit 500`)).map((r) => str(r[0])).filter((v) => v && !/^\{?[0-9a-f-]{36}\}?$/i.test(v));
          if (values.length) out.set(plan.themeKey(m[1]), values);
        }
      } finally { engine.terminate(); }
      return out;
    }

    return {
      SECTIONS, LINKS, BOOKMARK_NAME, STATEMENT, STATEMENT_UUID, DEFAULT_DOCUMENT, AREA_FIELDS, EDITED,
      validBookmark, bookmarkName, newId, cleanLine, cleanText, bodyOf, composeText, spansHeading, isStatement, checkGeometry, layerFamily, familyOf, tableFor,
      editSection, addSection, deleteSection, link, unlink, addArea, editArea, setGeometry, deleteArea, undo, catalogue,
      STEPS, areaRow, documentFor, tryChanges, applyChanges,
    };
  });
})();
