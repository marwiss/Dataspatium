// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Archive packages of digital plans (Boverket's specification for long-term preservation, as Rita Detaljplan and Rita
 * Översiktsplan make them): a folder with `metadata/PREMIS.xml` (PREMIS 3.0: every file with its SHA-256 and place),
 * `schemas/` and `content/` (the plan as a GeoPackage and as a delivery file, the plan map and the plan description).
 * Picked as a folder or as a ZIP, the package becomes one plan dataset: the plan read from `content/` (the GeoPackage
 * first), every file of the package kept in `_files`, and the check of the files against PREMIS in `_meta.plan.arkivpaket`.
 * Nothing is fetched: the XML is read with DOMParser, which loads no external entities, and a place outside the package
 * is reported as not checked.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/plan-archive', ['io/importers/detaljplan', 'platform/storage/zip'], (dpImp, zip) => {
    const PREMIS_NS = 'http://www.loc.gov/premis/v3';
    const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
    const PREMIS = /(^|\/)metadata\/premis\.xml$/i;
    const TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xml: 'application/xml', json: 'application/json', gpkg: 'application/geopackage+sqlite3', xsd: 'application/xml', tif: 'image/tiff', tiff: 'image/tiff', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gml: 'application/gml+xml', txt: 'text/plain' };
    const pathOf = (f) => String(/** @type {any} */ (f).dmPath || /** @type {any} */ (f).webkitRelativePath || f.name).replace(/\\/g, '/');
    const typeOf = (name) => TYPES[String(name).split('.').pop().toLowerCase()] || 'application/octet-stream';

    /** True when files picked as a folder hold an archive package (a `metadata/PREMIS.xml` among them). */
    function isPackage(files) { return (files || []).some((f) => PREMIS.test(pathOf(f))); }

    /**
     * The package's files by their path inside the package, and the package's name (its folder).
     * @param {File[]} files @returns {{map: Map<string, File>, root: string}}
     */
    function byPath(files) {
      const premis = files.find((f) => PREMIS.test(pathOf(f)));
      const full = premis ? pathOf(premis) : '';
      const prefix = full.slice(0, full.length - 'metadata/PREMIS.xml'.length);
      const map = new Map();
      for (const f of files) { const p = pathOf(f); if (p.startsWith(prefix)) map.set(p.slice(prefix.length), f); }
      return { map, root: prefix.replace(/\/$/, '').split('/').pop() || '' };
    }

    const decode = (s) => { try { return decodeURIComponent(s); } catch (_e) { return s; } };
    /**
     * The files PREMIS.xml describes: place in the package, original name, digest algorithm, digest and size.
     * @param {string} xml @returns {Array<{location: string, name: string, algorithm: string, digest: string, size: number|null}>}
     */
    function entriesOf(xml) {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error(D.t('plan.archive.err.premis'));
      const out = [];
      for (const obj of Array.from(doc.getElementsByTagNameNS(PREMIS_NS, 'object'))) {
        const type = obj.getAttributeNS(XSI_NS, 'type') || '';
        const text = (name) => { const el = obj.getElementsByTagNameNS(PREMIS_NS, name)[0]; return el ? String(el.textContent || '').trim() : ''; };
        if (!/file$/i.test(type) && !text('messageDigest')) continue; // the plan itself (a representation) and the events have no file
        out.push({ location: decode(text('contentLocationValue')), name: text('originalName'), algorithm: text('messageDigestAlgorithm'), digest: text('messageDigest').toLowerCase(), size: text('size') ? Number(text('size')) : null });
      }
      return out;
    }

    async function sha256(file) {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Each described file checked against its digest: the same, changed, missing, not checked (an algorithm other than
     * SHA-256, no digest, or a place outside the package), and files in the package PREMIS does not describe (the schemas aside).
     * @returns {Promise<{ok: string[], changed: string[], missing: string[], unchecked: string[], extra: string[]}>}
     */
    async function verify(map, entries) {
      const report = { ok: [], changed: [], missing: [], unchecked: [], extra: [] };
      const listed = new Set(['metadata/PREMIS.xml']);
      for (const e of entries) {
        const label = e.location || e.name || '?';
        if (!e.location || e.location.startsWith('/') || e.location.split('/').includes('..')) { report.unchecked.push(label); continue; }
        listed.add(e.location);
        const file = map.get(e.location);
        if (!file) { report.missing.push(label); continue; }
        if (!/^sha-?256$/i.test(e.algorithm) || !e.digest) { report.unchecked.push(label); continue; }
        const same = (await sha256(file)) === e.digest && (e.size === null || e.size === file.size);
        (same ? report.ok : report.changed).push(label);
      }
      for (const p of map.keys()) if (!listed.has(p) && !/^schemas\//i.test(p)) report.extra.push(p);
      return report;
    }

    /** The plan in `content/`: a GeoPackage first (it carries the designations and colours), else a delivery file. */
    function planFileOf(map) {
      const content = Array.from(map.entries()).filter(([p]) => /^content\//i.test(p));
      const gpkg = content.find(([p]) => /\.gpkg$/i.test(p));
      if (gpkg) return gpkg[1];
      const json = content.find(([p]) => /\.(geo)?json$/i.test(p));
      return json ? json[1] : null;
    }

    /** Read a package's plan and check its files, without making a dataset. */
    async function readPackage(files, options = {}, progress) {
      const { map, root } = byPath(files);
      const premis = map.get('metadata/PREMIS.xml');
      if (!premis) throw new Error(D.t('plan.archive.err.premis'));
      const entries = entriesOf(await premis.text());
      if (progress) progress({ step: 'verify', file: root });
      const check = await verify(map, entries);
      const planFile = planFileOf(map);
      if (!planFile) throw new Error(D.t('plan.archive.err.noplan'));
      let parsed;
      if (/\.gpkg$/i.test(planFile.name)) parsed = (await dpImp.readGeoPackage(planFile, Object.assign({}, options, { plan: true }), progress)).parsed;
      else { const r = await dpImp.read(planFile, options); parsed = { plan: r.plan, rows: r.rows, format: r.format }; }
      const arkivpaket = { namn: root, kontrollerat: new Date().toISOString(), planfil: pathOf(planFile).split('/').slice(-2).join('/'), filer: entries.length, stammer: check.ok.length, andrade: check.changed, saknas: check.missing, okontrollerade: check.unchecked, ovriga: check.extra };
      return { map, root, parsed, planFile, arkivpaket };
    }

    /**
     * An archive package picked as a folder (or unpacked from a ZIP) → one plan dataset with the package's files.
     * @param {File[]} files @param {any} [options] @param {string} [name] @param {Function} [progress]
     */
    async function importFiles(files, options = {}, name, progress) {
      const r = await readPackage(files, options, progress);
      const kept = [];
      for (const [p, f] of r.map) kept.push({ name: p, kind: 'original', type: f.type || typeOf(p), bytes: new Uint8Array(await f.arrayBuffer()) });
      const info = Object.assign({}, r.parsed.plan, { arkivpaket: r.arkivpaket });
      return dpImp.createPlanDataset(info, r.parsed.rows, name || info.namn || r.root || D.t('plan.name.default'),
        { kind: 'file', fileName: r.root, format: 'plan-archive', planFormat: info.format || r.parsed.format || '' }, kept);
    }

    /** The files of a ZIP as File objects with their paths (dmPath), for a package zipped as a whole. */
    async function filesOfZip(file) {
      const entries = await zip.readZip(await file.arrayBuffer());
      return Object.entries(entries).filter(([n]) => !n.endsWith('/')).map(([n, bytes]) => {
        const f = new File([bytes], n.split('/').pop() || n, { type: typeOf(n) });
        /** @type {any} */ (f).dmPath = n;
        return f;
      });
    }
    /** True when a ZIP holds an archive package. */
    async function sniff(file) {
      try { return Object.keys(await zip.readZip(await file.arrayBuffer())).some((n) => PREMIS.test(n)); } catch (_err) { return false; }
    }
    /** Preview for Inhämta: the plan's facts, its rows as a table and the check of the files. */
    async function preview(file, options = {}) {
      const r = await readPackage(await filesOfZip(file), options);
      const columns = dpImp.columnsFor(r.parsed.plan);
      const planLogic = D.require('data/plan');
      return { kind: 'plan', format: 'plan-archive', plan: Object.assign({}, r.parsed.plan, { arkivpaket: r.arkivpaket }), planFormat: r.parsed.plan.format, header: true,
        columns: columns.map((c) => c.name), declaredTypes: columns.map((c) => c.type), dataRows: planLogic.toRows(r.parsed.rows, columns).slice(0, options.previewRows || 100), totalRows: r.parsed.rows.length,
        datasetName: r.parsed.plan.namn || r.root || String(file.name).replace(/\.zip$/i, '') };
    }
    /** A ZIP with an archive package → one plan dataset. */
    async function importFile(file, options = {}, name, progress) {
      return importFiles(await filesOfZip(file), options, name || undefined, progress);
    }

    return { id: 'planarchive', kind: 'plan', detect: () => false, isPackage, byPath, entriesOf, verify, planFileOf, readPackage, importFiles, filesOfZip, sniff, preview, importFile };
  });
})();
