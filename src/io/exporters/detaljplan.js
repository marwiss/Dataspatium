// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A Swedish detailed plan exported as the national specification's exchange model in GeoJSON (Detaljplan 4.1,
 * `application/vnd.lm.detaljplan.v4+json`), the format data/plan's fromDetaljplan reads, so that a plan made or edited in the app
 * comes back the same (PLAN 12 e):
 *
 * - one feature `detaljplan` with the plan's facts (objektidentitet, kommun as its code, beteckning, namn, syfte, status, typ), its
 *   plan area (`plangeometri`, the rows of the object type planomrade) and its decision (`beslutsinformation`, the dates and the
 *   provisions it decides);
 * - one feature per provision (`användningsbestämmelse`, `egenskapsbestämmelse`, `administrativ bestämmelse`,
 *   `övergångsbestämmelse`) with the catalogue's reference, the formulation (the template with its variables when the row keeps
 *   one, and the values in `bestammelsevarde`), code, category, use form, colour, the motive (`planbestammelsebeskrivning`), the
 *   facts the import kept in `egenskaper`, and the geometry (`bestammelsegeometri`).
 *
 * Geometry is written in the plan's own system (SWEREF 99 TM or a local SWEREF 99 zone, else SWEREF 99 TM) to the millimetre,
 * as Lantmäteriet's geometry descriptions ({typ, position, koordinatsystemPlan, dimension}); a provision limited in height gets
 * its heights in 3D (a body between two heights, else a surface at one) in the plan's height system. The dataset is not changed.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/exporters/detaljplan', ['data/datasets', 'data/plan', 'data/geo'], (datasets, plan, geo) => {
    const MEDIA_TYPE = 'application/vnd.lm.detaljplan.v4+json';
    /** The feature type of each object type, as the national specification writes it. */
    const FEATURE_TYPES = { anvandning: 'användningsbestämmelse', egenskap: 'egenskapsbestämmelse', administrativ: 'administrativ bestämmelse', overgang: 'övergångsbestämmelse' };
    /** Lantmäteriet's names of the kinds of geometry. */
    const GEOMETRY_TYPES = { Point: 'punkt', MultiPoint: 'multipunkt', LineString: 'linje', MultiLineString: 'multilinje', Polygon: 'yta', MultiPolygon: 'multiyta' };
    /** The facts of `egenskaper` written as the provision's own fields (the rest the import reads from other fields). */
    const EXTRA_KEYS = ['giltighetstid', 'borjarGallaEfter', 'sekundarEgenskapsgrans', 'vertikalAvgransning', 'reglerarAnvandningsbestammelse', 'reglerarDetaljplan', 'ursprungligBestammelseformulering', 'anvandbarhet', 'beskrivningAnvandbarhet', 'kvalitetsbeskrivning', 'objektversion', 'versionGiltigFran'];
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const known = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    const factsOf = (r) => { try { const e = r.egenskaper ? JSON.parse(r.egenskaper) : {}; return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; } catch (_e) { return {}; } };
    /** True for a detailed plan this exporter writes: a Swedish one (a Nordic plan has its own model). @param {any} meta */
    const handles = (meta) => !!(meta && meta.kind === 'plan' && meta.plan && meta.plan.slag === 'detaljplan' && (!meta.plan.land || meta.plan.land === 'SE'));

    /** The plan's own system when it is SWEREF 99 TM or a zone, else SWEREF 99 TM. */
    function systemOf(info) {
      const code = geo.crsCode(info && info.crs);
      return code && geo.SWEREF_ZONES[code] ? code : 3006;
    }
    /** A WGS 84 geometry in SWEREF 99 (`code`) to the millimetre, with a third value `z` on every position when given. */
    function projected(g, code, z) {
      const round = (v) => Math.round(v * 1000) / 1000;
      return geo.mapCoordinates(g, (c) => { const p = geo.wgs84ToSweref(c[0], c[1], code); return z === undefined ? [round(p[0]), round(p[1])] : [round(p[0]), round(p[1]), z]; });
    }
    /**
     * A row's geometry as Lantmäteriet's geometry description, in the plan's system; a provision limited in height in 3D: an area
     * between two heights as a body (its floor and its roof), one height as a surface at that height. Null without a geometry.
     */
    function described(row, code, info) {
      const g = geo.parseGeometry(row.geometri);
      if (!g || !GEOMETRY_TYPES[g.type]) return null;
      const crs = 'EPSG:' + code;
      const lo = known(row.underkant) ? Number(row.underkant) : null;
      const hi = known(row.overkant) ? Number(row.overkant) : null;
      const heights = { dimension: 3, hojdsystem: str(info.hojdsystem) || 'EPSG:5613' };
      if (lo !== null && hi !== null && g.type === 'Polygon') {
        const body = { type: 'MultiPolygon', coordinates: [projected(g, code, lo).coordinates, projected(g, code, hi).coordinates] };
        return Object.assign({ typ: 'kropp', position: body, koordinatsystemPlan: crs }, heights);
      }
      const z = lo !== null ? lo : hi !== null ? hi : undefined;
      const position = projected(g, code, z);
      return z === undefined ? { typ: GEOMETRY_TYPES[g.type], position, koordinatsystemPlan: crs, dimension: 2 } : Object.assign({ typ: GEOMETRY_TYPES[g.type], position, koordinatsystemPlan: crs }, heights);
    }
    /**
     * The values of a provision's variables (`bestammelsevarde`): read back from its formulation by its template when the row keeps
     * one (data/plan-edit valuesIn), else its value as it is, with the row's kind of value and unit.
     */
    function valuesOf(row, template) {
      const vardetyp = str(row.vardetyp); const enhet = str(row.enhet);
      const edit = D.require('data/plan-edit');
      if (template) {
        const types = new Map(edit.variablesOf(template).map((v) => [v.name, v.type]));
        return Object.entries(edit.valuesIn(template, row.formulering)).map(([name, v]) => Object.assign({ datatyp: types.get(name) || 'text', variabelvarde: v, beskrivning: name }, vardetyp ? { vardetyp } : {}, enhet ? { enhet } : {}));
      }
      return str(row.varde).split('; ').filter(Boolean).map((v) => Object.assign({ variabelvarde: v }, vardetyp ? { vardetyp } : {}, enhet ? { enhet } : {}));
    }

    /**
     * The plan as a GeoJSON FeatureCollection in the national specification's exchange model.
     * @param {string} id @returns {Promise<any>}
     */
    async function build(id) {
      const meta = await datasets.get(id);
      if (!handles(meta)) throw new Error(D.t('plan.dp.export.err.kind'));
      const info = meta.plan || {};
      const columns = await datasets.columns(id);
      const names = columns.map((c) => c.name);
      const handle = await datasets.ensureOpen(id);
      const r = await handle.engine.exec(`select ${names.map((n) => '"' + n.replace(/"/g, '""') + '"').join(', ')} from data order by ordning, rowid`);
      const rows = plan.fromRows(names, r[0] ? r[0].values : []);
      const areas = rows.filter((x) => x.objekttyp === 'planomrade');
      if (!areas.length) throw new Error(D.t('plan.dp.export.err.boundary'));
      const code = systemOf(info);
      const now = new Date().toISOString();
      const planId = plan.normId(info.objektid) || plan.normId(areas[0].objektid) || D.require('data/plan-edit').newId();
      const own = (row, facts) => ({ objektidentitet: plan.normId(row.objektid), objektversion: facts.objektversion || 1, versionGiltigFran: facts.versionGiltigFran || now });
      const provisions = rows.filter((x) => x.objekttyp !== 'planomrade' && FEATURE_TYPES[x.objekttyp]);
      // The plan: its facts, its plan area and its decision.
      const pf = factsOf(areas[0]);
      const props = Object.assign({ 'feature:typ': 'detaljplan' }, own({ objektid: planId }, pf), {
        kommun: str(info.kommunkod) || str(info.kommun), beteckning: str(info.beteckning), namn: str(info.namn), syfte: str(info.syfte), status: str(info.status), typ: str(info.typ) || 'detaljplan',
      });
      for (const k of ['vertikalAvgransning', 'anvandbarhet', 'beskrivningAnvandbarhet', 'kvalitetsbeskrivning']) if (pf[k] !== undefined) props[k] = pf[k];
      if (info.datumStatusforandring) props.datumStatusforandring = str(info.datumStatusforandring);
      if (info.anvandbarhet && props.anvandbarhet === undefined) props.anvandbarhet = str(info.anvandbarhet);
      const boundary = areas.map((a) => described(a, code, info)).filter(Boolean).map((g) => ({ geometri: g }));
      if (boundary.length) props.plangeometri = boundary;
      const decision = { instansInomKommunen: str(info.instans), diarienummerKommun: str(info.diarienummer), beslutstyp: str(info.beslutstyp), datumPaborjat: str(info.datumPaborjat), datumAntagande: str(info.datumAntagande) };
      for (const k of Object.keys(decision)) if (!decision[k]) delete decision[k];
      if (info.datumLagakraft) decision.datumLagakraft = [str(info.datumLagakraft)];
      if (known(info.genomforandetid)) decision.genomforandetid = Number(info.genomforandetid);
      if (info.genomforandetidStartar) decision.genomforandetidStartar = str(info.genomforandetidStartar);
      if (Object.keys(decision).length) props.beslutsinformation = [Object.assign(decision, { planbestammelse: provisions.map((x) => plan.normId(x.objektid)) })];
      if (info.planbeskrivning) props.planbeskrivning = { planbeskrivning: { namn: str(info.planbeskrivning) } };
      const features = [{ type: 'Feature', id: planId, geometry: null, properties: props }];
      // The provisions.
      for (const row of provisions) {
        const facts = factsOf(row);
        const template = str(facts.formuleringsmall);
        const p = Object.assign({ 'feature:typ': FEATURE_TYPES[row.objekttyp], detaljplan: planId }, own(row, facts));
        if (row.katalogreferens) p.planbestammelsekatalogreferens = str(row.katalogreferens);
        p.bestammelseformulering = template || str(row.formulering);
        for (const [key, col] of [['bestammelsekod', 'kod'], ['beteckning', 'beteckning'], ['kategori', 'kategori'], ['underkategori', 'underkategori'], ['anvandningsform', 'anvandningsform'], ['farg', 'farg']]) if (str(row[col])) p[key] = str(row[col]);
        const values = valuesOf(row, template);
        if (values.length) p.bestammelsevarde = values;
        for (const k of EXTRA_KEYS) if (facts[k] !== undefined && p[k] === undefined) p[k] = facts[k];
        // One height alone limits upwards only when the provision says so (the import reads a surface as a lower limit otherwise).
        if (!known(row.underkant) && known(row.overkant) && p.vertikalAvgransning === undefined) p.vertikalAvgransning = 'uppåt';
        const g = described(row, code, info);
        if (g) p.bestammelsegeometri = [{ geometri: g }];
        if (str(row.etikett)) p.planbestammelsebeskrivning = { motiv: str(row.etikett) };
        features.push({ type: 'Feature', id: plan.normId(row.objektid), geometry: null, properties: p });
      }
      return { type: 'FeatureCollection', 'feature:mediatyp': MEDIA_TYPE, features };
    }
    /** The plan as a .geojson file's contents. @param {string} id @returns {Promise<Blob>} */
    async function toBlob(id) {
      return new Blob([JSON.stringify(await build(id), null, 1)], { type: 'application/geo+json' });
    }

    return { MEDIA_TYPE, FEATURE_TYPES, handles, build, toBlob };
  });
})();
