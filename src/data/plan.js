// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Digital plans (dataset kind "plan"): Swedish detailed development plans (detaljplaner) per the national
 * specification (Lantmäteriet, Boverket's regulations BFS 2020:5) and comprehensive plans (översiktsplaner) per
 * Boverket's ÖP model. Pure logic: recognise and read the exchange formats, turn them into plan rows (one row per
 * plan area or provision, geometry as GeoJSON text in WGS 84), colour them with Boverket's colour names from
 * data/plan-catalog, and summarise (provisions per area, areas per use, catalogue checks, legend text).
 *
 * Read formats:
 * - NGP reference objects: Lantmäteriet's search API answers (STAC items) with `properties.feature.typ`,
 *   `properties.detaljplan`, `properties.planbestammelse`; also as a flattened API table (`feature.typ` columns).
 * - The national specification's exchange model in GeoJSON (feature:typ detaljplan, anvandningsbestammelse,
 *   egenskapsbestammelse, administrativBestammelse …; `feature:mediatyp application/vnd.lm.detaljplan.v4+json`).
 * - Översiktsplan per the national specification's GeoJSON exchange model (feature:typ oversiktsplan, innehallOP,
 *   beslutOP) and Boverket's GIS database model (GeoPackage with `innehall_op_<tema>_<geometri>` tables).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/plan', ['data/geo', 'data/plan-catalog', 'data/plan-nordic'], (geo, catalog, nordic) => {
    /**
     * Columns of a detaljplan dataset. `etikett` holds a provision's motive; `underkant`/`overkant` a provision's height limits in
     * metres (RH2000) when it is limited in height; `egenskaper` the object's other facts as JSON, so that nothing read is lost.
     */
    const DP_COLUMNS = [
      { name: 'objektid', type: 'text' }, { name: 'objekttyp', type: 'text' }, { name: 'beteckning', type: 'text' }, { name: 'formulering', type: 'text' },
      { name: 'katalogreferens', type: 'text' }, { name: 'kod', type: 'text' }, { name: 'kategori', type: 'text' }, { name: 'underkategori', type: 'text' },
      { name: 'anvandningsform', type: 'text' }, { name: 'varde', type: 'text' }, { name: 'vardetyp', type: 'text' }, { name: 'enhet', type: 'text' },
      { name: 'underkant', type: 'number' }, { name: 'overkant', type: 'number' },
      { name: 'farg', type: 'text' }, { name: 'status', type: 'text' }, { name: 'etikett', type: 'text' }, { name: 'egenskaper', type: 'text' }, { name: 'ordning', type: 'integer' }, { name: 'geometri', type: 'text' },
    ];
    /** Columns of an översiktsplan dataset (`egenskaper` as in DP_COLUMNS). */
    const OP_COLUMNS = [
      { name: 'objektid', type: 'text' }, { name: 'tema', type: 'text' }, { name: 'innehallstyp', type: 'text' }, { name: 'namn', type: 'text' }, { name: 'precisering', type: 'text' },
      { name: 'anvandningsstatus', type: 'text' }, { name: 'kompletterande', type: 'text' }, { name: 'utbyggnadsordning', type: 'text' }, { name: 'planhandelse', type: 'text' },
      { name: 'planhandelse_datum', type: 'text' }, { name: 'beslut', type: 'text' }, { name: 'geometrityp', type: 'text' }, { name: 'egenskaper', type: 'text' }, { name: 'farg', type: 'text' }, { name: 'ordning', type: 'integer' }, { name: 'geometri', type: 'text' },
    ];
    /**
     * The categories of Boverket's ÖP catalogue by the table key of the GIS database model (innehall_op_<key>_…): the exchange
     * model names a value's category (`grupp`) in words, the GeoPackage by key, and the colours and themes go by key.
     */
    const OP_CATEGORIES = {
      plangeometri: 'Plangeometri', omrade: 'Område', utvecklingsinriktning: 'Utvecklingsinriktning', markochvattenanvandning: 'Mark- och vattenanvändning',
      riksintressenop: 'Riksintresse kommunens ställningstagande', riksintressen: 'Riksintressen enligt 3 och 4 kap. MB', miljokvalitetsnormer: 'Miljökvalitetsnormer enligt 5 kap. MB',
      ovrigaforhallandeavvasentligbetydelse: 'Övriga förhållanden av väsentlig betydelse', bostadsforsorjning: 'Bostadsförsörjning', malplanprogram: 'Mål, planer och program',
      lis: 'Landsbygdsutveckling i strandnära läge', sarskiltvardefullabyggnadsverkallmannaplatserochbebyggelseomraden: 'Särskilt värdefulla byggnadsverk, allmänna platser och bebyggelseområden',
      klimatrelateradrisk: 'Klimatrelaterade risker', avvikelsefranregionplan: 'Avvikelse från regionplan', mellankommunalaochregionalaintressen: 'Mellankommunala och regionala intressen',
      lansstyrelsensinvandning: 'Invändningar i länsstyrelsens granskningsyttrande', konsekvenser: 'Konsekvenser',
    };
    /** Object types of detaljplan rows, in drawing order (the plan area first, uses, then outlines on top). */
    const OBJECT_TYPES = ['planomrade', 'anvandning', 'egenskap', 'administrativ', 'overgang', 'annan'];
    const USE_LETTERS = {
      B: 'gul', C: 'brun', D: 'röd', E: 'blågrå', F: 'grå', G: 'grå', H: 'brun', J: 'blågrå', K: 'brun', L: 'grön', M: 'lila', N: 'grön', O: 'orange',
      P: 'grå', R: 'orange', S: 'röd', T: 'grå', U: 'röd', V: 'grå', W: 'blå', Y: 'rosa', Z: 'beige',
      GATA: 'ljusgrå', VÄG: 'ljusgrå', TORG: 'ljusgrå', 'P-PLATS': 'ljusgrå', GCVÄG: 'ljusgrå', GÅNG: 'ljusgrå', CYKEL: 'ljusgrå', PARK: 'ljusgrön', NATUR: 'ljusgrön', SKYDD: 'ljusgrön',
    };
    /** Palette for the themes of an översiktsplan (the ÖP model has no colour standard; these are the app's). */
    const OP_THEME_COLORS = {
      markochvattenanvandning: null, utvecklingsinriktning: '#d7733a', riksintressen: '#9b59b6', riksintressenop: '#8e44ad', lis: '#2e86c1', klimatrelateradrisk: '#c0392b',
      miljokvalitetsnormer: '#16a085', bostadsforsorjning: '#e67e22', mellankommunalaochregionalaintressen: '#7f8c8d', konsekvenser: '#95a5a6', malplanprogram: '#2c3e50',
      lansstyrelsensinvandning: '#b03a2e', avvikelsefranregionplan: '#6c3483', ovrigaforhallandeavvasentligbetydelse: '#5d6d7e', sarskiltvardefullabyggnadsverkallmannaplatserochbebyggelseomraden: '#a04000',
      omrade: '#34495e', plangeometri: '#111111',
    };
    /** Colours of the land and water use types in Boverket's ÖP model (the app's shades). */
    const OP_USE_COLORS = {
      'bostadsbebyggelse': '#f4e07a', 'funktionsblandad bebyggelse': '#e9b86a', 'service': '#c9a47c', 'verksamheter': '#a7b9ca', 'teknisk infrastruktur': '#8e9aa6',
      'grönområde': '#9fd39a', 'natur- och kulturlandskap': '#c9e6b8', 'friluftsliv och rekreation': '#8dc88b', 'jordbruk': '#e8dac0', 'skogsbruk': '#5a9c6e', 'renskötsel': '#d7c3a4',
      'landsbygd': '#efe3c8', 'vatten': '#8fbde7', 'vattenbruk': '#80c3bd', 'fiske': '#6aa5cf', 'sjöfart': '#5f8fbf', 'energiproduktion': '#f1b56e', 'vägtrafik': '#b4b8bd', 'järnväg': '#8c8f94',
      'luftfart': '#c4c7cb', 'annan mark- och vattenanvändning': '#f0b9d0',
    };

    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const lower = (v) => str(v).trim().toLowerCase();
    const uuid = (v) => lower(v).replace(/[{}]/g, '');
    const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
    const parseMaybe = (v) => { if (typeof v !== 'string') return v; const s = v.trim(); if (!/^[[{]/.test(s)) return v; try { return JSON.parse(s); } catch (_e) { return v; } };
    const isGeometry = (g) => !!(g && typeof g === 'object' && typeof g.type === 'string' && (Array.isArray(g.coordinates) || Array.isArray(g.geometries)));
    /**
     * A feature type folded for comparison: lower case, å/ä → a, ö → o, without spaces, underscores or hyphens. The national
     * specification writes `användningsbestämmelse` and `administrativ bestämmelse`; older files and the app's own write ASCII.
     */
    const fold = (v) => lower(v).replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[\s_-]/g, '');
    const typeOf = (feature) => fold(featureType(feature));

    // ---- recognition ------------------------------------------------------------------------------------------
    /** The feature type of an exchange-model or NGP feature: `feature:typ`, `feature.typ` or `feature.typ` nested. */
    function featureType(feature) {
      const p = (feature && feature.properties) || feature || {};
      const nested = asObject(p.feature);
      return lower(p['feature:typ'] || p['feature:type'] || (nested && nested.typ) || p['feature.typ'] || p.featureTyp || '');
    }
    /**
     * Which plan format a parsed JSON document is: 'ngp' (reference objects), 'detaljplan' (national specification
     * GeoJSON), 'oversiktsplan' (ÖP exchange model), or null.
     */
    function detect(data) {
      if (!data || typeof data !== 'object') return null;
      const features = Array.isArray(data.features) ? data.features : (data.type === 'Feature' ? [data] : null);
      // Finland's kaavatietomalli is a JSON document, not a FeatureCollection.
      if (!features || !features.length) return nordic.detect(data) === 'kaavatietomalli' ? 'kaavatietomalli' : null;
      const media = lower(data['feature:mediatyp'] || '');
      if (/detaljplan/.test(media)) return 'detaljplan';
      if (/oversiktsplan/.test(media)) return 'oversiktsplan';
      const types = new Set(features.map(typeOf).filter(Boolean));
      if (features.some((f) => f && f.properties && (asObject(f.properties.detaljplan) || asObject(f.properties.planbestammelse)) && f.properties.stac_version !== undefined) || features.some((f) => f && f.stac_version !== undefined && f.properties && asObject(f.properties.detaljplan))) return 'ngp';
      if (types.has('oversiktsplan') || types.has('innehallop')) return 'oversiktsplan';
      if (types.has('detaljplan') || types.has('anvandningsbestammelse') || types.has('egenskapsbestammelse') || types.has('administrativbestammelse') || types.has('planbestammelse')) return 'detaljplan';
      if (features.some((f) => f && f.properties && asObject(f.properties.detaljplan))) return 'ngp';
      return nordic.detect(data);
    }
    /** The format of an API table (columns of a flattened GeoJSON answer): 'ngp' for NGP reference objects, a Nordic format, or null. */
    function tableFormat(columns) {
      const names = new Set((columns || []).map((c) => normalizeKey(typeof c === 'string' ? c : c.name)));
      if ((names.has('feature.typ') || names.has('detaljplan.objektidentitet')) && (names.has('detaljplan.status') || names.has('planbestammelse.bestammelseformulering') || names.has('detaljplan.beteckning'))) return 'ngp';
      return nordic.detectTable(columns);
    }
    /** True when an API table holds a plan the app can keep as a plan dataset. */
    function detectTable(columns) { return !!tableFormat(columns); }
    const normalizeKey = (k) => lower(k).replace(/[_:]/g, '.');

    // ---- object types and colours -----------------------------------------------------------------------------
    /** Object type of a detaljplan row from a feature type or a catalogue type. */
    function objectType(typ) {
      const t = lower(typ).replace(/[\s_-]/g, '');
      if (/^detaljplan$|planomr|^plan$/.test(t)) return 'planomrade';
      if (/anvandning|användning/.test(t)) return 'anvandning';
      if (/egenskap/.test(t)) return 'egenskap';
      if (/administrativ/.test(t)) return 'administrativ';
      if (/overgang|övergång/.test(t)) return 'overgang';
      return 'annan';
    }
    /** Boverket's colour name for a use designation (B → gul, GATA → ljusgrå …), or ''. */
    function colorNameForDesignation(designation) {
      const key = str(designation).replace(/#/g, '').replace(/\d+$/, '').trim().toUpperCase();
      if (!key) return '';
      if (USE_LETTERS[key]) return USE_LETTERS[key];
      const word = key.split(/[\s:-]/)[0];
      return USE_LETTERS[word] || (/^[A-ZÅÄÖ]{2,}$/.test(key) ? 'ljusgrå' : '');
    }
    /** Fill colour of a detaljplan row (null for outlines only). */
    function fillOf(row) {
      if (row.objekttyp !== 'anvandning') return null;
      return catalog.colorFor(row.farg) || catalog.colorFor(colorNameForDesignation(row.beteckning)) || catalog.COLORS.ljusgrå;
    }
    /** Stroke colour of a detaljplan row. */
    function strokeOf(row) { return catalog.KIND_STROKES[row.objekttyp] || catalog.KIND_STROKES.annan || '#4a4f57'; }
    /** Fill colour of an översiktsplan row: land and water use by type, other themes by theme. */
    function opFillOf(row) {
      if (row.farg) { const named = catalog.colorFor(row.farg); if (named) return named; }
      const tema = lower(row.tema);
      if (tema === 'markochvattenanvandning') return OP_USE_COLORS[lower(row.innehallstyp)] || OP_USE_COLORS['annan mark- och vattenanvändning'];
      return OP_THEME_COLORS[tema] || '#7f8c8d';
    }

    // ---- geometry --------------------------------------------------------------------------------------------
    /** CRS named in exchange-model geometry metadata ("koordinatsystemPlan": "EPSG:3007"), or null. */
    function crsOf(obj) {
      if (!obj || typeof obj !== 'object') return null;
      const direct = obj.koordinatsystemPlan || obj.crs || obj.srid;
      if (direct) return typeof direct === 'object' ? (direct.properties && direct.properties.name) || null : direct;
      for (const v of Object.values(obj)) { if (v && typeof v === 'object') { const found = crsOf(v); if (found) return found; } }
      return null;
    }
    /** Twice the signed area of a ring in plan (x, y), by the shoelace formula. */
    function ringArea(ring) {
      let a = 0;
      for (let i = 0; i + 1 < ring.length; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      return a;
    }
    /** The footprint of a body given by its faces (a MultiPolygon in 3D, Lantmäteriet's `kropp`): the face that covers most in plan, in 2D. */
    function footprint(body) {
      const faces = body && body.type === 'MultiPolygon' ? body.coordinates : body && body.type === 'Polygon' ? [body.coordinates] : [];
      let best = null;
      let bestArea = 0;
      for (const face of faces) {
        const a = Math.abs(ringArea((face && face[0]) || []));
        if (a > bestArea) { bestArea = a; best = face; }
      }
      return best ? { type: 'Polygon', coordinates: best.map((ring) => ring.map((p) => [p[0], p[1]])) } : null;
    }
    /**
     * The geometry of one of Lantmäteriet's geometry descriptions ({typ, position, koordinatsystemPlan, dimension}, geometri 2.0):
     * the position, a body (kropp) as its footprint and several bodies as one multipolygon; null for anything else.
     */
    function described(value) {
      if (!value || typeof value !== 'object' || !isGeometry(value.position)) return null;
      const typ = lower(value.typ);
      if (typ === 'kropp') return footprint(value.position);
      if (typ === 'multikropp') {
        const parts = (value.position.geometries || []).map(footprint).filter(Boolean);
        return parts.length ? { type: 'MultiPolygon', coordinates: parts.map((p) => p.coordinates) } : null;
      }
      return value.position;
    }
    /** All GeoJSON geometries found in a value (the feature's geometry, or geometries nested in the properties). */
    function collectGeometries(value, out = [], depth = 0) {
      if (!value || typeof value !== 'object' || depth > 6) return out;
      if (isGeometry(value)) { out.push(value); return out; }
      const own = described(value);
      if (own) { out.push(own); return out; }
      if (Array.isArray(value)) { for (const v of value) collectGeometries(v, out, depth + 1); return out; }
      for (const [k, v] of Object.entries(value)) if (/geometri|geometry|plangeometri|bestammelsegeometri/i.test(k) && !/metadata|ursprunglig/i.test(k) && v && typeof v === 'object') collectGeometries(v, out, depth + 1);
      return out;
    }
    /** One geometry for a feature: its `geometry`, else the geometries in its properties merged (one multi-geometry per kind). */
    function geometryOf(feature) {
      if (isGeometry(feature && feature.geometry)) return feature.geometry;
      const found = collectGeometries((feature && feature.properties) || {});
      if (!found.length) return null;
      if (found.length === 1) return found[0];
      const merge = (single, multi) => {
        const parts = found.filter((g) => g.type === single || g.type === multi);
        return parts.length === found.length ? { type: multi, coordinates: parts.flatMap((g) => (g.type === single ? [g.coordinates] : g.coordinates)) } : null;
      };
      return merge('Polygon', 'MultiPolygon') || merge('LineString', 'MultiLineString') || merge('Point', 'MultiPoint') || { type: 'GeometryCollection', geometries: found };
    }
    /** Every coordinate's third value in a geometry. */
    function heightsIn(geometry, out = []) {
      if (!geometry || typeof geometry !== 'object') return out;
      if (Array.isArray(geometry.geometries)) { for (const g of geometry.geometries) heightsIn(g, out); return out; }
      const walk = (c) => { if (!Array.isArray(c)) return; if (typeof c[0] === 'number') { if (typeof c[2] === 'number') out.push(c[2]); return; } for (const x of c) walk(x); };
      walk(geometry.coordinates);
      return out;
    }
    /**
     * The height limits of an object in metres (RH2000) from its geometry descriptions in 3D: a body has a lower and an upper
     * limit; a surface with one height limits downwards (`vertikalAvgransning` nedåt, the height is the lower limit) or upwards.
     * @returns {{lower: number|null, upper: number|null}}
     */
    function heightsOf(props) {
      const out = { lower: null, upper: null };
      const descriptions = [];
      for (const key of ['bestammelsegeometri', 'plangeometri', 'geometri']) {
        const v = props && props[key];
        for (const item of Array.isArray(v) ? v : (v ? [v] : [])) { const d = asObject(item) && asObject(item.geometri) ? item.geometri : asObject(item); if (d && d.position) descriptions.push(d); }
      }
      for (const d of descriptions) {
        const z = heightsIn(d.position);
        if (!z.length) continue;
        const lo = Math.min(...z);
        const hi = Math.max(...z);
        if (/kropp/.test(lower(d.typ)) || hi - lo > 1e-6) { out.lower = out.lower === null ? lo : Math.min(out.lower, lo); out.upper = out.upper === null ? hi : Math.max(out.upper, hi); }
        else if (/upp/.test(lower(props.vertikalAvgransning))) out.upper = out.upper === null ? hi : Math.max(out.upper, hi);
        else out.lower = out.lower === null ? lo : Math.min(out.lower, lo);
      }
      return out;
    }
    /** The facts of an object that have no column of their own, as JSON text ('' when there are none). */
    function extrasOf(props, keys) {
      const out = {};
      for (const k of keys) {
        const v = props ? props[k] : undefined;
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
        out[k] = v;
      }
      return Object.keys(out).length ? JSON.stringify(out) : '';
    }
    /** The extra facts kept for a provision and for a plan area (field names as in the national specification). */
    const DP_EXTRAS = ['giltighetstid', 'borjarGallaEfter', 'sekundarEgenskapsgrans', 'vertikalAvgransning', 'reglerarAnvandningsbestammelse', 'reglerarDetaljplan', 'ursprungligBestammelseformulering', 'formuleringsmall', 'anvandbarhet', 'beskrivningAnvandbarhet', 'kvalitetsbeskrivning', 'objektversion', 'versionGiltigFran'];
    const VARIABLE = /\[([^\]:]+):([^\]]+)\]/g;
    /**
     * A provision's formulation with its variables filled in. The catalogue and the national specification write a variable as
     * `[name:type]` (for example `Största lutning är [lutning1:decimaltal]`) and the delivery gives each value in `bestammelsevarde`
     * by its name (`beskrivning`); a planning tool may keep the template that way. A variable without a value is left as it is.
     */
    function filledFormulation(text, values) {
      const s = str(text);
      if (!s.includes('[')) return s;
      const byName = new Map((Array.isArray(values) ? values : [values]).filter(asObject).map((v) => [lower(v.beskrivning), str(v.variabelvarde)]));
      return s.replace(VARIABLE, (whole, name) => { const v = byName.get(lower(name)); return v ? v : whole; });
    }
    /** Several values of a provision (bestammelsevarde, a list in the specification) as one text, with the first's kind and unit. */
    function valuesOf(v) {
      const list = (Array.isArray(v) ? v : [v]).filter(asObject);
      return { varde: list.map((x) => str(x.variabelvarde)).filter(Boolean).join('; '), vardetyp: list.length ? str(list[0].vardetyp) : '', enhet: list.length ? str(list[0].enhet) : '' };
    }
    /**
     * GeoJSON text in WGS 84 of a geometry given in degrees or SWEREF 99 (zone from `crs`), or null; also null when `crs` names a
     * system the app cannot convert (the object is then without a place in the map rather than in the wrong place).
     */
    function geometryText(geometry, crs) {
      if (!isGeometry(geometry)) return null;
      const g = geo.toWgs84(geometry, crs || undefined);
      return g ? JSON.stringify(g) : null;
    }
    /** The height system named in Lantmäteriet's geometry descriptions ("hojdsystem": "EPSG:5613"), or null. */
    function heightSystemOf(obj, depth = 0) {
      if (!obj || typeof obj !== 'object' || depth > 8) return null;
      if (typeof obj.hojdsystem === 'string' && obj.hojdsystem.trim()) return obj.hojdsystem.trim();
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'coordinates' || k === 'position' || !v || typeof v !== 'object') continue;
        const found = heightSystemOf(v, depth + 1);
        if (found) return found;
      }
      return null;
    }

    // ---- NGP reference objects ---------------------------------------------------------------------------------
    /** A plan row from one NGP reference feature (STAC item). */
    function rowFromNgp(feature, index, crs) {
      const p = feature.properties || {};
      const dp = asObject(p.detaljplan) || {};
      const pb = asObject(p.planbestammelse);
      const ft = featureType(feature);
      const typ = pb ? objectType(ft || (pb.kategori ? 'egenskap' : 'anvandning')) : 'planomrade';
      const value = pb && asObject(pb.bestammelsevarde) ? pb.bestammelsevarde : (pb && Array.isArray(pb.bestammelsevarde) ? pb.bestammelsevarde[0] : null);
      const designation = pb ? '' : (dp.beteckning || '');
      return {
        objektid: str(feature.id || dp.objektidentitet || ''), objekttyp: typ,
        beteckning: pb ? '' : str(designation), formulering: pb ? str(pb.bestammelseformulering) : str(dp.namn || p.title || ''),
        katalogreferens: pb ? uuid(pb.planbestammelsekatalogreferens) : '', kod: '', kategori: pb ? str(pb.kategori) : '', underkategori: pb ? str(pb.underkategori) : '',
        anvandningsform: pb ? str(pb.anvandningsform) : '', varde: value ? str(value.variabelvarde) : '', vardetyp: value ? str(value.vardetyp) : '', enhet: value ? str(value.enhet) : '',
        farg: '', status: str(dp.status), etikett: str((asObject(p.feature) || {}).etikett || p.title || ''), ordning: index, geometri: geometryText(geometryOf(feature), crs),
        _plan: dp, _providers: Array.isArray(p.providers) ? p.providers : [],
      };
    }
    /** Plan info from NGP reference rows (the detaljplan block every item carries). */
    function planInfoFromNgp(rows) {
      const withPlan = rows.find((r) => r._plan && (r._plan.objektidentitet || r._plan.beteckning)) || rows[0] || {};
      const dp = withPlan._plan || {};
      const provider = (withPlan._providers || [])[0] || {};
      return {
        slag: 'detaljplan', objektid: str(dp.objektidentitet), beteckning: str(dp.beteckning), namn: str(dp.namn), kommun: str(provider.name), kommunkod: str(provider.kod),
        status: str(dp.status), typ: str(dp.typ), datumPaborjat: str(dp.datumPaborjat), datumLagakraft: str(dp.datumLagakraft), datumStatusforandring: str(dp.datumStatusforandring),
        anvandbarhet: str(dp.anvandbarhet), kvalitet: asObject(dp.kvalitet) || null, format: 'ngp',
      };
    }
    /** Rows and plan info from an NGP FeatureCollection (one plan per collection; several plans → the first plan's info). */
    function fromNgp(data, options = {}) {
      const features = Array.isArray(data.features) ? data.features : [data];
      const crs = options.crs || crsOf(data) || null;
      const rows = features.map((f, i) => rowFromNgp(f, i, crs));
      const plan = planInfoFromNgp(rows);
      plan.crs = crs || '';
      return finish(plan, rows);
    }
    /** Rows and plan info from a flattened API table of NGP reference objects (columns `feature.typ`, `detaljplan.*`, `planbestammelse.*`). */
    function fromReferenceTable(columns, rows, options = {}) {
      const idx = new Map(columns.map((c, i) => [normalizeKey(c), i]));
      const get = (row, key) => { const i = idx.get(key); return i === undefined ? undefined : row[i]; };
      const features = rows.map((row) => {
        const props = { feature: { typ: get(row, 'feature.typ'), etikett: get(row, 'feature.etikett') }, title: get(row, 'title'), detaljplan: {}, planbestammelse: null, providers: parseMaybe(get(row, 'providers')) };
        for (const [key, i] of idx) {
          if (key.startsWith('detaljplan.')) props.detaljplan[key.slice(11)] = row[i];
          else if (key.startsWith('planbestammelse.')) { props.planbestammelse = props.planbestammelse || {}; setPath(props.planbestammelse, key.slice(16), parseMaybe(row[i])); }
        }
        if (props.planbestammelse && !Object.values(props.planbestammelse).some((v) => v !== null && v !== undefined && v !== '')) props.planbestammelse = null;
        const geomText = get(row, 'geometri') || get(row, 'geometry');
        return { id: get(row, 'id'), geometry: geomText ? geo.parseGeometry(geomText) : null, properties: props };
      });
      return fromNgp({ type: 'FeatureCollection', features }, options);
    }
    function setPath(obj, path, value) {
      const parts = path.split('.');
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = asObject(cur[parts[i]]) || {}; cur = cur[parts[i]]; }
      cur[parts[parts.length - 1]] = value;
    }

    // ---- national specification exchange model (GeoJSON) --------------------------------------------------------
    /** Rows and plan info from a detaljplan FeatureCollection in the exchange model. */
    function fromDetaljplan(data, options = {}) {
      const features = Array.isArray(data.features) ? data.features : [data];
      const plans = features.filter((f) => typeOf(f) === 'detaljplan');
      const planFeature = plans[0] || null;
      const pp = (planFeature && planFeature.properties) || {};
      const crs = options.crs || crsOf(pp) || crsOf(data) || null;
      // Detaljplan 4.1 keeps the decisions inside the plan and a provision's motive inside the provision; files written
      // before the app read 4.1 have them as objects of their own, which are still read.
      const decisions = (Array.isArray(pp.beslutsinformation) ? pp.beslutsinformation.filter(asObject) : [])
        .concat(features.filter((f) => typeOf(f) === 'beslutsinformation').map((f) => f.properties || {}));
      const descriptions = new Map(features.filter((f) => typeOf(f) === 'planbestammelsebeskrivning').map((f) => [uuid((f.properties || {}).planbestammelse), str((f.properties || {}).motiv)]));
      const rows = [];
      let order = 0;
      for (const f of plans) {
        const p = f.properties || {};
        const z = heightsOf(p);
        rows.push({ objektid: str(f.id || p.objektidentitet), objekttyp: 'planomrade', beteckning: str(p.beteckning), formulering: str(p.namn), katalogreferens: '', kod: '', kategori: '', underkategori: '', anvandningsform: '', varde: '', vardetyp: '', enhet: '', underkant: z.lower, overkant: z.upper, farg: '', status: str(p.status), etikett: str(p.namn || p.beteckning), egenskaper: extrasOf(p, ['vertikalAvgransning', 'anvandbarhet', 'beskrivningAnvandbarhet', 'kvalitetsbeskrivning', 'objektversion', 'versionGiltigFran']), ordning: order++, geometri: geometryText(geometryOf(f), crsOf(p) || crs) });
      }
      for (const f of features) {
        const ft = typeOf(f);
        if (!/bestammelse/.test(ft) || ft === 'planbestammelsebeskrivning') continue;
        const p = f.properties || {};
        const values = valuesOf(p.bestammelsevarde);
        const own = asObject(p.planbestammelsebeskrivning);
        const motive = descriptions.get(uuid(f.id || p.objektidentitet)) || (own ? str(own.motiv) : '');
        const z = heightsOf(p);
        const template = str(p.bestammelseformulering || p.ursprungligBestammelseformulering || '');
        const text = filledFormulation(template, p.bestammelsevarde);
        const facts = text !== template ? Object.assign({}, p, { formuleringsmall: template }) : p;
        rows.push({
          objektid: str(f.id || p.objektidentitet), objekttyp: objectType(ft), beteckning: str(p.beteckning || p.textbeteckning || ''), formulering: text,
          katalogreferens: uuid(p.planbestammelsekatalogreferens), kod: str(p.bestammelsekod || ''), kategori: str(p.kategori || ''), underkategori: str(p.underkategori || ''), anvandningsform: str(p.anvandningsform || ''),
          varde: values.varde, vardetyp: values.vardetyp, enhet: values.enhet, underkant: z.lower, overkant: z.upper, farg: str(p.farg || ''), status: str(pp.status || ''),
          etikett: motive, egenskaper: extrasOf(facts, DP_EXTRAS.filter((k) => k !== 'ursprungligBestammelseformulering' || str(p[k]) !== str(p.bestammelseformulering))), ordning: order++, geometri: geometryText(geometryOf(f), crsOf(p) || crs),
        });
      }
      // The adoption decision when there is one, else the first.
      const decision = decisions.find((d) => d.datumAntagande || (Array.isArray(d.datumLagakraft) ? d.datumLagakraft.length : d.datumLagakraft)) || decisions[0] || {};
      const lagakraft = Array.isArray(decision.datumLagakraft) ? decision.datumLagakraft[0] : decision.datumLagakraft;
      const description = asObject(pp.planbeskrivning) && asObject(pp.planbeskrivning.planbeskrivning) ? pp.planbeskrivning.planbeskrivning : null;
      const plan = {
        slag: 'detaljplan', objektid: str(pp.objektidentitet || (planFeature && planFeature.id) || ''), beteckning: str(pp.beteckning), namn: str(pp.namn), syfte: str(pp.syfte), kommun: str(pp.kommun), kommunkod: /^\d{4}$/.test(str(pp.kommun)) ? str(pp.kommun) : '',
        status: str(pp.status), typ: str(pp.typ), datumPaborjat: str(decision.datumPaborjat || ''), datumAntagande: str(decision.datumAntagande || ''), datumLagakraft: str(lagakraft || ''),
        datumStatusforandring: str(pp.datumStatusforandring), genomforandetid: str(decision.genomforandetid || ''), genomforandetidStartar: str(decision.genomforandetidStartar || ''), diarienummer: str(decision.diarienummerKommun || ''),
        beslutstyp: str(decision.beslutstyp || ''), instans: str(decision.instansInomKommunen || ''), beslut: decisions.length, planbeskrivning: description ? str(description.namn) : '', anvandbarhet: str(pp.anvandbarhet),
        kvalitet: asObject(pp.kvalitetsbeskrivning) || null, format: 'detaljplan', mediatyp: str(data['feature:mediatyp'] || ''), crs: crs || '',
        hojdsystem: heightSystemOf(data) || '',
      };
      return finish(plan, rows);
    }

    // ---- detaljplan in a GeoPackage (Rita Detaljplan) ---------------------------------------------------------
    /** The area layers of Rita Detaljplan's GeoPackage and the object type of the provisions on them. */
    const DP_AREA_TABLES = { anvandning_yta: 'anvandning', egenskap_yta: 'egenskap', egenskap_linje: 'egenskap', egenskap_punkt: 'egenskap' };
    /** True when a GeoPackage holds a detaljplan in Rita Detaljplan's model: the plan, area layers and a table of provisions. */
    function isDpGeoPackage(tableNames) {
      const names = new Set((tableNames || []).map((n) => lower(n)));
      return names.has('detaljplan') && names.has('bestammelse') && Object.keys(DP_AREA_TABLES).some((n) => names.has(n));
    }
    const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    /**
     * Rows and plan info from a detaljplan GeoPackage in Rita Detaljplan's model (column names as the national specification's
     * fields): `detaljplan` (the plan area), `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` (the areas, lines
     * and points), `bestammelse` (one row per provision and area: `tabell` + `yta`), `beslutsinformation`, `dokument`. The rows are
     * those the delivery file gives, with the designations, colours and motives the plan map carries; areas without a provision
     * yet are kept, so that the map shows what is drawn. `tables` = [{name, columns, rows, crs}] with geometry as GeoJSON text.
     */
    function fromDpTables(tables, options = {}) {
      const byName = (n) => tables.find((t) => lower(t.name) === n);
      const geomOf = (table, i) => {
        const gi = table.columns.findIndex((c) => /^(geom|shape|geometri|geometry)$/i.test(c));
        const text = gi >= 0 ? table.rows[i][gi] : null;
        return text ? geo.parseGeometry(text) : null;
      };
      const crsFor = (table) => options.crs || table.crs || null;
      const rows = [];
      let order = 0;
      const planTable = byName('detaljplan');
      const planRecords = recordsOf(planTable);
      const p = planRecords[0] || {};
      const status = str(p.status);
      const blank = { katalogreferens: '', kod: '', kategori: '', underkategori: '', anvandningsform: '', varde: '', vardetyp: '', enhet: '', underkant: null, overkant: null };
      planRecords.forEach((r, i) => {
        rows.push(Object.assign({}, blank, {
          objektid: str(r.objektidentitet), objekttyp: 'planomrade', beteckning: str(r.beteckning), formulering: str(r.namn), farg: '', status: str(r.status), etikett: str(r.namn || r.beteckning),
          egenskaper: extrasOf({ vertikalAvgransning: r.vertikalavgransning, anvandbarhet: r.anvandbarhet, beskrivningAnvandbarhet: r.beskrivninganvandbarhet, objektversion: r.objektversion, versionGiltigFran: r.versiongiltigfran }, ['vertikalAvgransning', 'anvandbarhet', 'beskrivningAnvandbarhet', 'objektversion', 'versionGiltigFran']),
          ordning: order++, geometri: geometryText(geomOf(planTable, i), crsFor(planTable)),
        }));
      });
      const areas = new Map();
      for (const [name, typ] of Object.entries(DP_AREA_TABLES)) {
        const t = byName(name);
        if (!t) continue;
        recordsOf(t).forEach((r, i) => areas.set(name + ':' + lower(r.objektidentitet), { table: t, typ, record: r, geometry: geomOf(t, i), used: false }));
      }
      const provisions = recordsOf(byName('bestammelse')).map((b, i) => ({ b, i })).sort((x, y) => (num(x.b.ordning) ?? x.i) - (num(y.b.ordning) ?? y.i) || x.i - y.i).map((x) => x.b);
      const extraKeys = ['symbol', 'giltighetstid', 'borjarGallaEfter', 'sekundarEgenskapsgrans', 'vertikalAvgransning', 'reglerarDetaljplan', 'ursprungligBestammelseformulering', 'formuleringsmall', 'anvandbarhet', 'beskrivningAnvandbarhet', 'objektversion', 'versionGiltigFran'];
      for (const b of provisions) {
        const area = areas.get(lower(b.tabell) + ':' + lower(b.yta));
        if (!area) continue; // a provision whose area is gone is not part of the plan, as in the delivery
        area.used = true;
        let list = [];
        try { list = JSON.parse(str(b.bestammelsevarde) || '[]'); } catch (_e) { list = []; /* not JSON: no values */ }
        const values = valuesOf(list);
        const template = str(b.bestammelseformulering);
        const text = filledFormulation(template, list);
        rows.push({
          objektid: str(b.objektidentitet), objekttyp: area.typ, beteckning: str(b.beteckning), formulering: text, katalogreferens: uuid(b.planbestammelsekatalogreferens), kod: str(b.bestammelsekod),
          kategori: '', underkategori: '', anvandningsform: str(b.anvandningsform || area.record.anvandningsform), varde: values.varde, vardetyp: values.vardetyp, enhet: values.enhet,
          underkant: num(b.hojdunderkant), overkant: num(b.hojdoverkant), farg: str(b.farg || (area.typ === 'anvandning' ? area.record.farg : '')), status, etikett: str(b.motiv),
          egenskaper: extrasOf({
            symbol: b.symbol || area.record.symbol, giltighetstid: num(b.giltighetstid), borjarGallaEfter: num(b.borjargallaefter), sekundarEgenskapsgrans: truth(b.sekundaregenskapsgrans), vertikalAvgransning: b.vertikalavgransning,
            reglerarDetaljplan: b.reglerardetaljplan, ursprungligBestammelseformulering: truth(b.avviker) ? b.ursprungligbestammelseformulering : undefined, anvandbarhet: b.anvandbarhet, beskrivningAnvandbarhet: b.beskrivninganvandbarhet,
            formuleringsmall: text !== template ? template : undefined, objektversion: b.objektversion, versionGiltigFran: b.versiongiltigfran,
          }, extraKeys),
          ordning: order++, geometri: geometryText(area.geometry, crsFor(area.table)),
        });
      }
      for (const area of areas.values()) {
        if (area.used) continue;
        const r = area.record;
        rows.push(Object.assign({}, blank, {
          objektid: str(r.objektidentitet), objekttyp: area.typ, beteckning: str(r.beteckning), formulering: '', anvandningsform: str(r.anvandningsform), farg: area.typ === 'anvandning' ? str(r.farg) : '', status, etikett: '',
          egenskaper: extrasOf({ symbol: r.symbol, utanBestammelse: true }, ['symbol', 'utanBestammelse']), ordning: order++, geometri: geometryText(area.geometry, crsFor(area.table)),
        }));
      }
      const decisions = recordsOf(byName('beslutsinformation'));
      const decision = decisions.find((d) => d.datumantagande || d.datumlagakraft) || decisions[0] || {};
      const documents = recordsOf(byName('dokument'));
      const description = documents.find((d) => lower(d.roll) === 'planbeskrivning');
      const kommun = str(p.kommun);
      const plan = {
        slag: 'detaljplan', objektid: str(p.objektidentitet), beteckning: str(p.beteckning), namn: str(p.namn), syfte: str(p.syfte), kommun, kommunkod: /^\d{4}$/.test(kommun) ? kommun : '',
        status, typ: str(p.typ), datumPaborjat: str(decision.datumpaborjat), datumAntagande: str(decision.datumantagande), datumLagakraft: str(decision.datumlagakraft).split(';')[0].trim(),
        datumStatusforandring: str(p.datumstatusforandring), genomforandetid: str(decision.genomforandetid), genomforandetidStartar: str(decision.genomforandetidstartar), diarienummer: str(decision.diarienummerkommun),
        beslutstyp: str(decision.beslutstyp), instans: str(decision.instansinomkommunen), beslut: decisions.length, planbeskrivning: description ? str(description.namn) : '',
        handlingar: documents.map((d) => ({ roll: str(d.roll), namn: str(d.namn), datum: str(d.datum) })).filter((d) => d.namn), anvandbarhet: str(p.anvandbarhet),
        format: 'detaljplan-gpkg', crs: (planTable && planTable.crs) || '',
      };
      return finish(plan, rows);
    }

    // ---- översiktsplan ----------------------------------------------------------------------------------------
    const themeKey = (grupp) => lower(grupp).replace(/[^a-zåäö0-9]/g, '').replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
    /** Category names of the ÖP catalogue (folded) → the GIS database model's table keys. */
    const OP_KEY_OF = new Map(Object.entries(OP_CATEGORIES).map(([key, name]) => [themeKey(name), key]));
    /** The theme key of a category named in words (`grupp`) or already a key. */
    const opTheme = (grupp) => { const k = themeKey(grupp); return OP_KEY_OF.get(k) || k; };
    const catalogValue = (v) => { const o = asObject(v); return o ? str(o.varde) : str(v); };
    const catalogGroup = (v) => { const o = asObject(v); return o ? str(o.grupp) : ''; };
    /** The facts of an innehållsobjekt that have no column of their own (field names as in the specification, catalogue values as their words). */
    function opExtras(p) {
      const plainValue = (v) => (Array.isArray(v) ? v.map(plainValue) : asObject(v) && v.varde !== undefined ? catalogValue(v) : v);
      const keys = ['sambandsniva', 'underErsattning', 'illustrativaGranser', 'vertikalAvgransning', 'presentationsskala', 'datumPaborjat', 'berorAnnatInnehall', 'riksintresse', 'dokument', 'versionGiltigFran'];
      const picked = {};
      for (const k of keys) if (p[k] !== undefined) picked[k] = plainValue(p[k]);
      // A riksintresse's id at the responsible authority (externReferens with avser Riksintresse), as the GeoPackage's objektidentitet_ri.
      const ri = (Array.isArray(p.externReferens) ? p.externReferens : []).find((e) => asObject(e) && /riksintresse/i.test(str(e.avser)));
      if (ri) picked.riksintresse = str(ri.identitet);
      if (Array.isArray(p.dokument)) picked.dokument = p.dokument.length;
      return extrasOf(picked, keys);
    }
    /** The dates of an översiktsplan's decision events (fattat, överklagat, laga kraft) from beslutOP objects or rows. */
    function decisionDates(decisions) {
      const out = {};
      for (const d of decisions) {
        for (const e of Array.isArray(d.handelse) ? d.handelse : (Array.isArray(d.beslutshandelse) ? d.beslutshandelse : [])) {
          const kind = fold(asObject(e) ? (e.handelsetyp || e.typ || catalogValue(e.handelse)) : '');
          const date = asObject(e) ? str(e.datum || e.tidpunkt) : '';
          if (!date) continue;
          if (/lagakraft/.test(kind)) out.datumLagakraft = out.datumLagakraft || date;
          else if (/overklag/.test(kind)) out.datumOverklagat = out.datumOverklagat || date;
          else if (/fattat|antag/.test(kind)) out.datumAntagande = out.datumAntagande || date;
        }
        if (d.diarienummer && !out.diarienummer) out.diarienummer = str(d.diarienummer);
      }
      return out;
    }
    /** Rows and plan info from an översiktsplan FeatureCollection in the exchange model (Översiktsplan 2.0, geometry 2.0.1). */
    function fromOversiktsplanGeoJson(data, options = {}) {
      const features = Array.isArray(data.features) ? data.features : [data];
      const op = features.find((f) => typeOf(f) === 'oversiktsplan');
      const opp = (op && op.properties) || {};
      const crs = options.crs || crsOf(data) || null;
      const rows = [];
      let order = 0;
      for (const f of features) {
        if (typeOf(f) !== 'innehallop') continue;
        const p = f.properties || {};
        const grupp = catalogGroup(p.innehallstyp);
        const geometry = geometryOf(f);
        rows.push({
          objektid: str(f.id || p.objektidentitet), tema: opTheme(grupp) || 'omrade', innehallstyp: catalogValue(p.innehallstyp), namn: str(p.namn), precisering: str(p.precisering),
          anvandningsstatus: catalogValue(p.anvandningsstatus), kompletterande: catalogValue(p.kompletterandeInnehallstyp), utbyggnadsordning: str(p.utbyggnadsordning), planhandelse: catalogValue(p.planhandelse),
          planhandelse_datum: str(p.datumPlanhandelse), beslut: str(p.beslut), geometrityp: geometry ? geometry.type : '', egenskaper: opExtras(p), ordning: order++, geometri: geometryText(geometry, crsOf(p) || crs),
        });
      }
      const decisions = features.filter((f) => typeOf(f) === 'beslutop').map((f) => f.properties || {});
      const plan = Object.assign({ slag: 'oversiktsplan', objektid: str((op && op.id) || opp.objektidentitet || ''), namn: str(opp.planensTitel), kommun: str(opp.kommunnamn), kommunkod: str(opp.kommunkod), status: catalogValue(opp.planhandelse), datumPlanhandelse: str(opp.datumPlanhandelse), datumPaborjat: str(opp.datumPaborjat), digitaltUrsprung: opp.digitaltUrsprung === true || lower(opp.digitaltUrsprung) === 'ja', beslut: decisions.length, format: 'oversiktsplan-geojson', mediatyp: str(data['feature:mediatyp'] || ''), crs: crs || '' }, decisionDates(decisions));
      return finish(plan, rows);
    }
    /**
     * Rows and plan info from the tables of an ÖP-model GeoPackage: `tables` = [{name, columns, rows}] with the
     * geometry already as GeoJSON text (the SQLite importer decodes GeoPackage binaries); `oversiktsplan` table optional.
     */
    /** The rows of a table as objects keyed by lower-case column name. */
    function recordsOf(table) {
      if (!table) return [];
      const names = table.columns.map((c) => lower(c));
      return table.rows.map((r) => { const o = {}; names.forEach((n, i) => { o[n] = r[i]; }); return o; });
    }
    /** A GeoPackage truth value (0/1, 'true'/'false', 'ja'/'nej') as a boolean, or undefined when empty. */
    const truth = (v) => (v === null || v === undefined || v === '' ? undefined : v === true || v === 1 || /^(1|true|ja|yes)$/i.test(String(v)));
    /** Whether a table of the GIS database model holds content: a theme with its geometry suffix, or the plan geometry and areas. */
    const isContentTable = (name) => /^innehall_op_.+_(polygon|line|point)$/i.test(name) || /^innehall_op_(plangeometri|omrade)$/i.test(name);
    function fromOpTables(tables, options = {}) {
      const rows = [];
      let order = 0;
      const byName = (n) => tables.find((t) => lower(t.name) === n);
      // Links (model 0.4): content that touches other content, and the planhandling's sections about an object.
      const touches = new Map();
      for (const r of recordsOf(byName('innehall_op_beror_annat_innehall'))) { const k = str(r.objektidentitet); if (k) touches.set(k, (touches.get(k) || []).concat(str(r.beror_objektidentitet))); }
      const bookmarks = new Map(recordsOf(byName('avsnittsbokmärke') || byName('avsnittsbokmarke')).map((r) => [str(r.avsnittsbokmarke_id), str(r.avsnittsbokmarke_text || r.avsnittsbokmarke_id)]));
      const sections = new Map();
      for (const r of recordsOf(byName('dokumentavsnitt'))) { const k = str(r.objektidentitet); const text = bookmarks.get(str(r.avsnittsbokmarke_id)) || str(r.avsnittsbokmarke_id); if (k && text) sections.set(k, (sections.get(k) || []).concat(text)); }
      for (const table of tables) {
        if (!isContentTable(table.name)) continue;
        const m = /^innehall_op_(.+?)(?:_(polygon|line|point))?$/i.exec(table.name);
        const tema = themeKey(m[1]);
        const gi = table.columns.findIndex((c) => /^(geom|shape|geometri|geometry)$/i.test(c));
        const records = recordsOf(table);
        records.forEach((r, i) => {
          const geomText = gi >= 0 ? table.rows[i][gi] : null;
          const geometry = geomText ? geo.parseGeometry(geomText) : null;
          const id = str(r.objektidentitet);
          const extras = {
            sambandsniva: r.sambandsniva_varde, underErsattning: truth(r.under_ersattning), illustrativaGranser: truth(r.illustrativa_granser), vertikalAvgransning: r.vertikal_avgransning,
            presentationsskala: r.presentationsskala, datumPaborjat: r.datum_paborjat, berorAnnatInnehall: touches.get(id), riksintresse: r.objektidentitet_ri, dokument: sections.get(id), versionGiltigFran: r.versiongiltigfran,
          };
          rows.push({
            objektid: id, tema, innehallstyp: str(r.innehallstyp_varde) || (tema === 'omrade' ? 'Område' : tema === 'plangeometri' ? 'Plangeometri' : ''), namn: str(r.namn), precisering: str(r.precisering),
            anvandningsstatus: str(r.anvandningsstatus), kompletterande: str(r.kompletterandeinnehallstyp), utbyggnadsordning: str(r.utbyggnadsordning), planhandelse: str(r.planhandelse_varde), planhandelse_datum: str(r.planhandelse_datum), beslut: str(r.beslut),
            geometrityp: geometry ? geometry.type : '', egenskaper: extrasOf(extras, Object.keys(extras)), ordning: order++, geometri: geometryText(geometry, options.crs || table.crs || null),
          });
        });
      }
      let plan = { slag: 'oversiktsplan', objektid: '', namn: '', kommun: '', kommunkod: '', status: '', format: 'oversiktsplan-gpkg', crs: String(options.crs || ((tables || []).find((t) => t && t.crs) || {}).crs || '') };
      const r = recordsOf(byName('oversiktsplan'))[0];
      if (r) {
        plan = Object.assign(plan, { objektid: str(r.objektidentitet), namn: str(r.planens_titel), kommun: str(r.kommunnamn), kommunkod: str(r.kommunkod), status: str(r.planhandelse_varde), datumPlanhandelse: str(r.planhandelse_datum), datumPaborjat: str(r.datum_paborjat) });
        const digital = truth(r.digitalt_ursprung);
        if (digital !== undefined) plan.digitaltUrsprung = digital;
      }
      // Decisions (model 0.4): beslut_op with its events in beslut_op_handelse; the plan's own decision first.
      const events = new Map();
      for (const e of recordsOf(byName('beslut_op_handelse'))) { const k = str(e.beslut_op_id); events.set(k, (events.get(k) || []).concat({ handelsetyp: str(e.handelsetyp), datum: str(e.datum) })); }
      const decisions = recordsOf(byName('beslut_op')).map((d) => ({ id: str(d.objektidentitet), diarienummer: str(d.diarienummer), handelse: events.get(str(d.objektidentitet)) || [] }));
      if (decisions.length) {
        const own = decisions.filter((d) => r && d.id && d.id === str(r.beslut));
        Object.assign(plan, decisionDates(own.length ? own : decisions), { beslut: decisions.length });
      }
      return finish(plan, rows);
    }
    /** True when a GeoPackage's table names follow Boverket's ÖP model. */
    function isOpGeoPackage(tableNames) { return (tableNames || []).some((n) => /^innehall_op_/i.test(String(n))); }

    // ---- common ------------------------------------------------------------------------------------------------
    function finish(plan, rows) {
      for (const r of rows) { delete r._plan; delete r._providers; }
      plan.antal = countByType(rows);
      return { plan, rows };
    }
    function countByType(rows) {
      const out = {};
      for (const r of rows) { const k = r.objekttyp || r.tema || 'annan'; out[k] = (out[k] || 0) + 1; }
      return out;
    }
    /** Fill in catalogue facts (code, category, colour, designation) for detaljplan rows that lack them. */
    async function decorate(rows) {
      let cat = null;
      try { cat = await catalog.load(); } catch (_err) { cat = null; }
      for (const r of rows) {
        const entry = cat && r.katalogreferens ? cat.byId.get(r.katalogreferens) : null;
        if (entry) {
          if (!r.kod) r.kod = entry.kod;
          if (!r.kategori) r.kategori = entry.kategori;
          if (!r.underkategori) r.underkategori = entry.underkategori;
          if (!r.anvandningsform) r.anvandningsform = entry.form;
          if (!r.farg) r.farg = entry.farg;
          if (!r.beteckning) r.beteckning = entry.beteckning.replace(/#/g, '').trim();
          if (r.objekttyp === 'annan' && entry.typ) r.objekttyp = objectType(entry.typ);
        }
        // A use without a known reference: the catalogue row with the same formulation gives designation and colour
        // (plan maps write public-space uses in capitals: GATA, PARK), else the formulation itself for public space.
        if (!entry && cat && r.objekttyp === 'anvandning' && !r.beteckning && r.formulering) {
          const want = lower(r.formulering);
          const byText = cat.rows.find((x) => x.typ === 'anvandning' && catalog.isCurrent(x) && lower(x.formulering) === want && (!r.anvandningsform || lower(x.form) === lower(r.anvandningsform)));
          if (byText) { r.beteckning = byText.beteckning.replace(/#/g, '').trim(); if (!r.farg) r.farg = byText.farg; if (!r.kod) r.kod = byText.kod; if (!r.kategori) r.kategori = byText.kategori; }
          else if (/allmän plats/i.test(r.anvandningsform)) r.beteckning = r.formulering.toUpperCase();
        }
        if (!r.farg && r.objekttyp === 'anvandning') r.farg = colorNameForDesignation(r.beteckning) || (r.formulering ? colorNameForFormulation(r.formulering) : '');
        if (r.farg) r.farg = r.farg.charAt(0).toUpperCase() + r.farg.slice(1);
      }
      return rows;
    }
    const FORMULATION_COLORS = [[/bostäder/i, 'Gul'], [/centrum|handel|kontor/i, 'Brun'], [/vård|skola|räddning/i, 'Röd'], [/tekniska|industri/i, 'Blågrå'], [/park|natur|skydd/i, 'Ljusgrön'], [/gata|väg|torg|parkering/i, 'Ljusgrå'], [/vatten/i, 'Blå'], [/besök|tillfällig/i, 'Orange'], [/odling|friluft/i, 'Grön'], [/verksamheter/i, 'Beige'], [/begravning/i, 'Lila']];
    function colorNameForFormulation(text) { const hit = FORMULATION_COLORS.find(([re]) => re.test(text)); return hit ? hit[1] : ''; }

    /** Rows as dataset row arrays in column order. */
    function toRows(rows, columns) { return rows.map((r) => columns.map((c) => (r[c.name] === undefined || r[c.name] === '' ? null : r[c.name]))); }
    /** Row objects from a dataset's rows (arrays) and column names. */
    function fromRows(columns, rows) {
      const names = columns.map((c) => (typeof c === 'string' ? c : c.name));
      return rows.map((r) => { const o = {}; names.forEach((n, i) => { o[n] = r[i] === null || r[i] === undefined ? '' : r[i]; }); return o; });
    }

    // ---- summaries -------------------------------------------------------------------------------------------
    /** Legend entries of a detaljplan: one per use designation with its colour and formulation. */
    function legend(rows) {
      const seen = new Map();
      for (const r of rows) {
        if (r.objekttyp !== 'anvandning') continue;
        const key = (r.beteckning || r.formulering || '?').trim();
        if (!seen.has(key)) seen.set(key, { beteckning: key, formulering: r.formulering, farg: r.farg, color: fillOf(r), count: 0 });
        seen.get(key).count++;
      }
      return Array.from(seen.values()).sort((a, b) => a.beteckning.localeCompare(b.beteckning, 'sv'));
    }
    /** Provisions grouped by object type, each group sorted by designation; the plan area excluded. */
    function grouped(rows) {
      const groups = [];
      for (const typ of OBJECT_TYPES) {
        if (typ === 'planomrade') continue;
        const list = rows.filter((r) => r.objekttyp === typ).sort((a, b) => (a.beteckning || '').localeCompare(b.beteckning || '', 'sv') || (a.formulering || '').localeCompare(b.formulering || '', 'sv'));
        if (list.length) groups.push({ typ, rows: list });
      }
      return groups;
    }
    /** Planar area in square metres of a WGS 84 geometry (projected to SWEREF 99 TM). */
    function areaM2(geometry) {
      if (!geometry) return 0;
      const ringArea = (ring) => { let s = 0; for (let i = 0; i < ring.length - 1; i++) { const a = geo.wgs84ToSweref(ring[i][0], ring[i][1]); const b = geo.wgs84ToSweref(ring[i + 1][0], ring[i + 1][1]); s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
      const polyArea = (poly) => poly.reduce((acc, ring, i) => acc + (i === 0 ? ringArea(ring) : -ringArea(ring)), 0);
      if (geometry.type === 'Polygon') return polyArea(geometry.coordinates);
      if (geometry.type === 'MultiPolygon') return geometry.coordinates.reduce((acc, p) => acc + polyArea(p), 0);
      if (geometry.type === 'GeometryCollection') return (geometry.geometries || []).reduce((acc, g) => acc + areaM2(g), 0);
      return 0;
    }
    /** Area per use designation (detaljplan) or per content type (översiktsplan): [{key, label, color, count, area}]. */
    function areasByUse(rows, slag) {
      const out = new Map();
      for (const r of rows) {
        const isUse = slag === 'oversiktsplan' ? lower(r.tema) === 'markochvattenanvandning' : r.objekttyp === 'anvandning';
        if (!isUse || !r.geometri) continue;
        const key = slag === 'oversiktsplan' ? r.innehallstyp || '?' : (r.beteckning || r.formulering || '?');
        const geometry = geo.parseGeometry(r.geometri);
        if (!out.has(key)) out.set(key, { key, label: slag === 'oversiktsplan' ? key : r.formulering || key, color: slag === 'oversiktsplan' ? opFillOf(r) : fillOf(r), count: 0, area: 0 });
        const e = out.get(key); e.count++; e.area += areaM2(geometry);
      }
      const list = Array.from(out.values()).sort((a, b) => b.area - a.area);
      const total = list.reduce((s, e) => s + e.area, 0);
      for (const e of list) e.share = total ? e.area / total : 0;
      return list;
    }
    /** Catalogue check of a detaljplan: every provision reference resolved, with its state (ok, ersatt, upphord, okand, saknas). */
    async function checkCatalog(rows) {
      const cat = await catalog.load();
      const out = [];
      for (const r of rows) {
        if (r.objekttyp === 'planomrade') continue;
        if (!r.katalogreferens) { out.push({ row: r, state: 'saknas', entry: null }); continue; }
        const entry = cat.byId.get(r.katalogreferens) || null;
        if (!entry) { out.push({ row: r, state: 'okand', entry: null }); continue; }
        const current = catalog.isCurrent(entry);
        const state = current ? 'ok' : (entry.ersattsAv ? 'ersatt' : 'upphord');
        const match = !entry.formulering || !r.formulering || templateMatches(entry.formulering, r.formulering);
        out.push({ row: r, state, entry, replacement: entry.ersattsAv ? cat.byId.get(entry.ersattsAv) || null : null, formulationMatches: match });
      }
      return { items: out, counts: out.reduce((acc, i) => { acc[i.state] = (acc[i.state] || 0) + 1; return acc; }, {}), release: cat.release };
    }
    /** True when a plan's formulation fits the catalogue's template (placeholders in brackets match anything). */
    function templateMatches(template, text) {
      const re = new RegExp('^' + String(template).trim().split(/\[[^\]]*\]/).map((part) => part.trim().replace(/[.*+?^${}()|\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('.+?') + '$', 'i');
      return re.test(String(text).trim());
    }
    /** The plan's provisions as Markdown (the list on a plan map), grouped by object type. */
    function provisionsMarkdown(plan, rows, labels) {
      const lines = [`# ${plan.namn || plan.beteckning || labels.plan}`, ''];
      const facts = [plan.beteckning && `${labels.beteckning}: ${plan.beteckning}`, plan.kommun && `${labels.kommun}: ${plan.kommun}`, plan.status && `${labels.status}: ${plan.status}`, plan.datumLagakraft && `${labels.lagakraft}: ${plan.datumLagakraft}`].filter(Boolean);
      if (facts.length) lines.push(facts.join(' · '), '');
      for (const g of grouped(rows)) {
        lines.push(`## ${labels[g.typ] || g.typ}`, '');
        for (const r of g.rows) lines.push(`- **${r.beteckning || '–'}** ${r.formulering}${r.kategori ? ` *(${r.kategori}${r.underkategori ? ' / ' + r.underkategori : ''})*` : ''}`);
        lines.push('');
      }
      return lines.join('\n');
    }

    return { DP_COLUMNS, OP_COLUMNS, OP_CATEGORIES, OBJECT_TYPES, USE_LETTERS, OP_THEME_COLORS, OP_USE_COLORS, nordic, detect, detectTable, tableFormat, featureType, objectType, colorNameForDesignation, fillOf, strokeOf, opFillOf, geometryOf, geometryText, crsOf, heightsOf, footprint, filledFormulation, fromNgp, fromReferenceTable, fromDetaljplan, fromDpTables, isDpGeoPackage, fromOversiktsplanGeoJson, fromOpTables, isOpGeoPackage, isContentTable, opTheme, decorate, toRows, fromRows, legend, grouped, areaM2, areasByUse, checkCatalog, templateMatches, provisionsMarkdown, themeKey };
  });
})();
