// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A digital comprehensive plan exported as a delivery (B-73, F65): a ZIP that data/plan-delivery's importDelivery reads back into
 * the same areas, sections and links.
 *
 * - The plan map as a GeoPackage in Boverket's ÖP model 0.4 (underlag/op-leverans.md): a content table per theme and kind of
 *   geometry (`innehall_op_<tema>_<polygon|line|point>`, the area and the plan boundary in tables of their own, a delivered layer
 *   under its own name) with Boverket's column names, in SWEREF 99 TM (EPSG:3006), and the tables `oversiktsplan` (with
 *   `beslut_op` and `beslut_op_handelse` when the plan's decision is known), `dokumentavsnitt` (a row per bookmark and object; the
 *   whole plan is the plan's own objektidentitet), `avsnittsbokmärke`, `dokumentreferens_op` and `innehall_op_beror_annat_innehall`.
 *   UUIDs are written in braces and capitals (TEXT(38)), as the template has them.
 * - The plan description as DOCX, one file per document the sections are in, made with the vendored docx library: each section
 *   is a heading and its paragraphs, wrapped in a Word bookmark named by its avsnitt (from the heading when the section's text
 *   begins with it, else from its first paragraph), the text plain.
 * - The plan's other original files as they came (appendices, underlag, metadata). The plan map it was read from and the delivery's
 *   manifest are left out: the first is replaced, and the second's checksums no longer hold.
 * The dataset is not changed.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/exporters/plan-delivery', ['data/datasets', 'data/dataset-files', 'data/plan', 'data/geo', 'data/plan-edit', 'io/export-kinds', 'docgen/builders-office', 'platform/storage/zip'], (datasets, dsFiles, plan, geo, planEdit, exportKinds, office, zip) => {
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const rowsOf = (r) => (r[0] ? r[0].values : []);
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    /** An id as the GeoPackage template writes it: a UUID in braces and capitals, any other id as it is. */
    const braced = (id) => { const s = plan.normId(id); return UUID.test(s) ? `{${s.toUpperCase()}}` : s; };
    const TEXT = 'text'; const INT = 'integer';
    /** The columns every content table has, from the plan's row. */
    const BASE = [
      ['objektidentitet', TEXT, (r) => braced(r.objektid)], ['oversiktsplan', TEXT, (_r, x) => x.planId], ['innehallstyp_varde', TEXT, (r) => r.innehallstyp],
      ['namn', TEXT, (r) => r.namn], ['precisering', TEXT, (r) => r.precisering], ['anvandningsstatus', TEXT, (r) => r.anvandningsstatus],
      ['kompletterandeinnehallstyp', TEXT, (r) => r.kompletterande], ['utbyggnadsordning', TEXT, (r) => r.utbyggnadsordning],
      ['planhandelse_varde', TEXT, (r) => r.planhandelse], ['planhandelse_datum', TEXT, (r) => r.planhandelse_datum], ['beslut', TEXT, (r) => r.beslut],
    ];
    const truth = (v) => (v === true ? 1 : v === false ? 0 : null);
    /** The columns some content tables have, from the facts the import kept in `egenskaper`; written when a row has them. */
    const EXTRA = [
      ['sambandsniva_varde', TEXT, (e) => e.sambandsniva], ['under_ersattning', INT, (e) => truth(e.underErsattning)], ['illustrativa_granser', INT, (e) => truth(e.illustrativaGranser)],
      ['vertikal_avgransning', TEXT, (e) => e.vertikalAvgransning], ['presentationsskala', TEXT, (e) => e.presentationsskala], ['datum_paborjat', TEXT, (e) => e.datumPaborjat],
      ['objektidentitet_ri', TEXT, (e) => e.riksintresse], ['versiongiltigfran', TEXT, (e) => e.versionGiltigFran],
    ];
    const blank = (v) => (v === null || v === undefined || v === '' ? null : typeof v === 'object' ? JSON.stringify(v) : v);
    /** A file name without the characters file systems refuse. */
    const safe = (name, fallback) => str(name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim() || fallback;
    const stemOf = (name) => str(name).split('/').pop().replace(/\.[^.]+$/, '');
    const unique = (name, used) => { let n = name; for (let k = 2; used.has(n.toLowerCase()); k++) n = name.replace(/(\.[^./]+)?$/, (ext) => ` (${k})${ext}`); used.add(n.toLowerCase()); return n; };

    async function tableIn(engine, name) { return !!Number(rowsOf(await engine.exec("select count(*) from sqlite_master where type = 'table' and name = ?", [name]))[0][0]); }
    const extrasOf = (r) => { try { const e = r.egenskaper ? JSON.parse(r.egenskaper) : {}; return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; } catch (_e) { return {}; } };
    /** The content table a row goes to: its own delivered layer, else its theme's table for its kind of geometry. */
    function tableOf(r, g) {
      if (plan.isContentTable(str(r.lager))) return str(r.lager);
      return planEdit.tableFor(str(r.tema) || 'omrade', planEdit.familyOf(g) || 'polygon', '').lager;
    }
    /** The geometry type a table declares: its rows' one type, else GEOMETRY (any). */
    function declared(rows) {
      const types = new Set(rows.filter((x) => x.geometry).map((x) => x.geometry.type.toUpperCase()));
      return types.size === 1 ? Array.from(types)[0] : 'GEOMETRY';
    }

    /**
     * What the plan holds, read once: its facts, rows, sections, links and files.
     * @param {string} id
     */
    async function read(id) {
      const handle = await datasets.ensureOpen(id);
      const engine = handle.engine;
      const names = handle.columns.map((c) => c.name);
      const rows = plan.fromRows(names, rowsOf(await engine.exec(`select ${names.map((n) => datasets.quoteIdent(n)).join(', ')} from data order by ordning, rowid`)));
      const sections = (await tableIn(engine, planEdit.SECTIONS)) ? rowsOf(await engine.exec(`select avsnitt, coalesce(dokument, ''), coalesce(rubrik, ''), coalesce(text, ''), coalesce(typ, ''), ordning from ${planEdit.SECTIONS} order by ordning, rowid`)).map((r) => ({ avsnitt: str(r[0]), dokument: str(r[1]), rubrik: str(r[2]), text: str(r[3]), typ: str(r[4]), ordning: Number(r[5]) || 0 })) : [];
      const links = (await tableIn(engine, planEdit.LINKS)) ? rowsOf(await engine.exec(`select avsnitt, coalesce(objektid, ''), coalesce(dokument, ''), coalesce(typ, '') from ${planEdit.LINKS} order by rowid`)).map((r) => ({ avsnitt: str(r[0]), objektid: str(r[1]), dokument: str(r[2]), typ: str(r[3]) })) : [];
      return { meta: handle.meta, info: handle.meta.plan || {}, rows, sections, links, files: await dsFiles.list(id) };
    }

    // ---- the GeoPackage -------------------------------------------------------------------------------------
    /**
     * The plan map in Boverket's ÖP model 0.4. @param {any} x what `read` gave, with planId, docs (name → its dokumentreferens id)
     * and docOf (a section → its document's name) @returns {Promise<Uint8Array>}
     */
    async function geoPackage(x) {
      const info = x.info;
      const content = new Map();
      const touches = [];
      for (const r of x.rows) {
        if (str(r.tema) === 'underlag') continue;
        const g = r.geometri ? geo.parseGeometry(r.geometri) : null;
        const table = tableOf(r, g);
        if (!content.has(table)) content.set(table, []);
        const e = extrasOf(r);
        content.get(table).push({ row: r, e, geometry: g && g.type ? g : null });
        for (const other of Array.isArray(e.berorAnnatInnehall) ? e.berorAnnatInnehall : []) if (str(other) && plan.normId(other) !== plan.normId(r.objektid)) touches.push([braced(r.objektid), braced(other)]);
      }
      const used = new Set();
      const titles = new Map((Array.isArray(info.lager) ? info.lager : []).map((l) => [str(l.namn), str(l.titel)]));
      const features = Array.from(content.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([table, list]) => {
        const extra = EXTRA.filter(([, , get]) => list.some((it) => blank(get(it.e)) !== null));
        const columns = BASE.map(([name, type]) => ({ name, type })).concat(extra.map(([name, type]) => ({ name, type })));
        const title = unique(titles.get(table) || table, used);
        return { table, identifier: title, geometryType: declared(list), columns, rows: list.map((it) => ({ geometry: it.geometry, values: BASE.map(([, , get]) => blank(get(it.row, x))).concat(extra.map(([, , get]) => blank(get(it.e)))) })) };
      });
      const attributes = [];
      // The plan, and its decision when it is known (beslut_op with its events: fattat, överklagat, laga kraft).
      const decision = info.diarienummer || info.datumAntagande || info.datumLagakraft || info.datumOverklagat ? braced(planEdit.newId()) : null;
      attributes.push({ table: 'oversiktsplan', columns: ['objektidentitet', 'planens_titel', 'kommunkod', 'kommunnamn', 'planhandelse_varde', 'planhandelse_datum', 'datum_paborjat', 'digitalt_ursprung', 'beslut'].map((name) => ({ name, type: name === 'digitalt_ursprung' ? INT : TEXT })),
        rows: [[x.planId, blank(info.namn || x.meta.name), blank(info.kommunkod), blank(info.kommun), blank(info.status), blank(info.datumPlanhandelse), blank(info.datumPaborjat), truth(info.digitaltUrsprung), decision]] });
      if (decision) {
        attributes.push({ table: 'beslut_op', columns: [{ name: 'objektidentitet' }, { name: 'diarienummer' }], rows: [[decision, blank(info.diarienummer)]] });
        const events = [['fattat', info.datumAntagande], ['överklagat', info.datumOverklagat], ['laga kraft', info.datumLagakraft]].filter((ev) => str(ev[1]));
        attributes.push({ table: 'beslut_op_handelse', columns: [{ name: 'beslut_op_id' }, { name: 'handelsetyp' }, { name: 'datum' }], rows: events.map((ev) => [decision, ev[0], str(ev[1])]) });
      }
      // The links between the plan description's bookmarks and the objects, the bookmarks with their headings, the documents.
      const sectionAt = (l) => x.sections.find((s) => s.avsnitt === l.avsnitt && s.dokument === l.dokument) || x.sections.find((s) => s.avsnitt === l.avsnitt) || null;
      const parts = [];
      for (const l of x.links) {
        const s = sectionAt(l);
        const doc = s ? x.docOf(s) : x.mainDoc;
        parts.push([blank(l.typ || (s ? s.typ : '')), l.avsnitt, x.docs.get(doc) || null, null, l.objektid ? braced(l.objektid) : x.planId]);
      }
      attributes.push({ table: 'dokumentavsnitt', columns: ['avsnittstyp_varde', 'avsnittsbokmarke_id', 'dokumentreferens_id', 'dokument_id', 'objektidentitet'].map((name) => ({ name })), rows: parts });
      const marks = new Map();
      for (const s of x.sections) if (!marks.has(s.avsnitt)) marks.set(s.avsnitt, s.rubrik);
      attributes.push({ table: 'avsnittsbokmärke', key: 'OBJECTID', columns: [{ name: 'avsnittsbokmarke_id' }, { name: 'avsnittsbokmarke_text' }], rows: Array.from(marks.entries()).map(([a, r]) => [a, blank(r)]) });
      attributes.push({ table: 'dokumentreferens_op', key: null, columns: ['namn', 'kortnamn', 'datumangivelse', 'specifik_referens', 'dokumentreferens_id', 'referens_id', 'lank', 'identitet', 'namespace', 'producentens_identitet', 'tidsstampel', 'avser'].map((name) => ({ name })),
        rows: Array.from(x.docs.entries()).map(([name, ref]) => [stemOf(name), null, null, null, ref, null, name, ref, null, ref, null, null]) });
      attributes.push({ table: 'innehall_op_beror_annat_innehall', columns: [{ name: 'objektidentitet' }, { name: 'beror_objektidentitet' }], rows: touches });
      return exportKinds.writeGeoPackage({ srs: 3006, userVersion: 10400, features, attributes });
    }

    // ---- the plan description -----------------------------------------------------------------------------------
    /**
     * A plan description as DOCX: a title, then each section as a heading (Heading 2) and its paragraphs inside a Word bookmark
     * named by the section. A section whose text begins with its heading has the heading inside its bookmark (as it was read);
     * an empty one is an empty paragraph with its bookmark. @param {any} lib the docx library @param {string} title @param {any[]} sections
     * @returns {Promise<Uint8Array>}
     */
    async function docx(lib, title, sections) {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, BookmarkStart, BookmarkEnd, bookmarkUniqueNumericId } = lib;
      const children = [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] })];
      for (const s of sections) {
        const lines = str(s.text).split('\n').filter(Boolean);
        const link = bookmarkUniqueNumericId();
        const start = new BookmarkStart(s.avsnitt, link);
        const end = new BookmarkEnd(link);
        const heading = (inside) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: (inside ? [start] : []).concat(s.rubrik ? [new TextRun(s.rubrik)] : [], inside && lines.length <= 1 ? [end] : []) });
        if (planEdit.spansHeading(s)) {
          children.push(heading(true));
          const body = lines.slice(1);
          body.forEach((text, i) => children.push(new Paragraph({ children: [new TextRun(text)].concat(i === body.length - 1 ? [end] : []), spacing: { after: 140 } })));
        } else {
          children.push(heading(false));
          if (!lines.length) children.push(new Paragraph({ children: [start, end] }));
          lines.forEach((text, i) => children.push(new Paragraph({ children: (i === 0 ? [start] : []).concat([new TextRun(text)], i === lines.length - 1 ? [end] : []), spacing: { after: 140 } })));
        }
      }
      const doc = new Document({
        creator: 'Dataspatium', title,
        styles: { paragraphStyles: [
          { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true }, paragraph: { spacing: { before: 240, after: 160 } } },
          { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true }, paragraph: { spacing: { before: 280, after: 100 } } },
        ] },
        sections: [{ children }],
      });
      return new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
    }

    /**
     * The delivery's files: the GeoPackage, a DOCX per document of the sections and the plan's other original files.
     * @param {string} id
     * @returns {Promise<{files: Array<{name: string, role: string, bytes: Uint8Array}>, title: string}>}
     */
    async function build(id) {
      const x = /** @type {any} */ (await read(id));
      const title = str(x.info.namn) || str(x.meta.name);
      const own = plan.normId(x.info.objektid);
      x.planId = braced(own || planEdit.newId());
      const byRole = (role) => x.files.filter((f) => f.kind === role).map((f) => f.name);
      // The documents: every one the sections are in (a name that is not a Word file's gets its ending), the text document first.
      const counted = new Map();
      for (const s of x.sections) if (s.dokument) counted.set(s.dokument, (counted.get(s.dokument) || 0) + 1);
      const asDocx = (name) => (/\.docx$/i.test(name) ? name : name + '.docx');
      x.mainDoc = asDocx(byRole('textdokument')[0] || Array.from(counted.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || planEdit.DEFAULT_DOCUMENT);
      x.docOf = (s) => asDocx(s.dokument || x.mainDoc);
      const docSections = new Map();
      for (const s of x.sections) { const d = x.docOf(s); if (!docSections.has(d)) docSections.set(d, []); docSections.get(d).push(s); }
      // A dokumentreferens for the text document and for every document a link points into (data/plan-delivery gives a document
      // the role of text document by them, the others are appendices).
      x.docs = new Map();
      const linked = new Set(x.links.map((l) => { const s = x.sections.find((q) => q.avsnitt === l.avsnitt && q.dokument === l.dokument) || x.sections.find((q) => q.avsnitt === l.avsnitt); return s ? x.docOf(s) : x.mainDoc; }));
      const present = new Set(Array.from(docSections.keys()).concat(byRole('textdokument')));
      for (const d of [x.mainDoc].concat(Array.from(docSections.keys()))) if (present.has(d) && (d === x.mainDoc || linked.has(d)) && !x.docs.has(d)) x.docs.set(d, braced(planEdit.newId()));
      const used = new Set();
      const out = [];
      const lib = docSections.size ? await office.ensureDocx() : null;
      for (const [name, list] of docSections) {
        out.push({ name: unique(name, used), role: name === x.mainDoc ? 'textdokument' : 'bilaga', bytes: await docx(lib, name === x.mainDoc ? title : stemOf(name).replace(/_+/g, ' '), list) });
      }
      const maps = byRole('plankarta');
      const gpkgName = unique(maps.length === 1 ? maps[0] : safe(title, 'oversiktsplan') + '.gpkg', used);
      out.unshift({ name: gpkgName, role: 'plankarta', bytes: await geoPackage(x) });
      // The other original files, as they came: the plan map read and the manifest go, and so does the file a plan was read from.
      const planSource = (f) => f.kind === 'original' && /\.(gpkg|sqlite|json|geojson)$/i.test(f.name);
      for (const f of x.files) {
        if (!dsFiles.ORIGINAL_KINDS.includes(f.kind) || f.kind === 'plankarta' || f.kind === 'manifest' || planSource(f) || used.has(f.name.toLowerCase())) continue;
        const got = await dsFiles.read(id, f.name, f.kind);
        if (got) out.push({ name: unique(f.name, used), role: f.kind, bytes: got.bytes });
      }
      return { files: out, title };
    }
    /**
     * The delivery as a ZIP, its files at the top. @param {string} id @returns {Promise<Blob>}
     */
    async function toZip(id) {
      const { files } = await build(id);
      const entries = {};
      for (const f of files) entries[f.name] = f.bytes;
      return zip.createZip(entries);
    }

    return { build, toZip, braced };
  });
})();
