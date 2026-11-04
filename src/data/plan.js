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
  D.define('data/plan', ['data/geo', 'data/plan-catalog'], (geo, catalog) => {
    /** Columns of a detaljplan dataset. */
    const DP_COLUMNS = [
      { name: 'objektid', type: 'text' }, { name: 'objekttyp', type: 'text' }, { name: 'beteckning', type: 'text' }, { name: 'formulering', type: 'text' },
      { name: 'katalogreferens', type: 'text' }, { name: 'kod', type: 'text' }, { name: 'kategori', type: 'text' }, { name: 'underkategori', type: 'text' },
      { name: 'anvandningsform', type: 'text' }, { name: 'varde', type: 'text' }, { name: 'vardetyp', type: 'text' }, { name: 'enhet', type: 'text' },
      { name: 'farg', type: 'text' }, { name: 'status', type: 'text' }, { name: 'etikett', type: 'text' }, { name: 'ordning', type: 'integer' }, { name: 'geometri', type: 'text' },
    ];
    /** Columns of an översiktsplan dataset. */
    const OP_COLUMNS = [
      { name: 'objektid', type: 'text' }, { name: 'tema', type: 'text' }, { name: 'innehallstyp', type: 'text' }, { name: 'namn', type: 'text' }, { name: 'precisering', type: 'text' },
      { name: 'anvandningsstatus', type: 'text' }, { name: 'kompletterande', type: 'text' }, { name: 'utbyggnadsordning', type: 'text' }, { name: 'planhandelse', type: 'text' },
      { name: 'planhandelse_datum', type: 'text' }, { name: 'beslut', type: 'text' }, { name: 'geometrityp', type: 'text' }, { name: 'ordning', type: 'integer' }, { name: 'geometri', type: 'text' },
    ];
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
      if (!features || !features.length) return null;
      const media = lower(data['feature:mediatyp'] || '');
      if (/detaljplan/.test(media)) return 'detaljplan';
      if (/oversiktsplan/.test(media)) return 'oversiktsplan';
      const types = new Set(features.map(featureType).filter(Boolean));
      if (features.some((f) => f && f.properties && (asObject(f.properties.detaljplan) || asObject(f.properties.planbestammelse)) && f.properties.stac_version !== undefined) || features.some((f) => f && f.stac_version !== undefined && f.properties && asObject(f.properties.detaljplan))) return 'ngp';
      if (types.has('oversiktsplan') || types.has('innehallop')) return 'oversiktsplan';
      if (types.has('detaljplan') || types.has('anvandningsbestammelse') || types.has('egenskapsbestammelse') || types.has('administrativbestammelse') || types.has('planbestammelse')) return 'detaljplan';
      if (features.some((f) => f && f.properties && asObject(f.properties.detaljplan))) return 'ngp';
      return null;
    }
    /** True when an API table (columns of a flattened GeoJSON answer) holds NGP reference objects. */
    function detectTable(columns) {
      const names = new Set((columns || []).map((c) => normalizeKey(typeof c === 'string' ? c : c.name)));
      return (names.has('feature.typ') || names.has('detaljplan.objektidentitet')) && (names.has('detaljplan.status') || names.has('planbestammelse.bestammelseformulering') || names.has('detaljplan.beteckning'));
    }
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
    /** All GeoJSON geometries found in a value (the feature's geometry, or geometries nested in the properties). */
    function collectGeometries(value, out = [], depth = 0) {
      if (!value || typeof value !== 'object' || depth > 6) return out;
      if (isGeometry(value)) { out.push(value); return out; }
      if (Array.isArray(value)) { for (const v of value) collectGeometries(v, out, depth + 1); return out; }
      for (const [k, v] of Object.entries(value)) if (/geometri|geometry|plangeometri|bestammelsegeometri/i.test(k) && v && typeof v === 'object') collectGeometries(v, out, depth + 1);
      return out;
    }
    /** One geometry for a feature: its `geometry`, else the geometries in its properties merged. */
    function geometryOf(feature) {
      if (isGeometry(feature && feature.geometry)) return feature.geometry;
      const found = collectGeometries((feature && feature.properties) || {});
      if (!found.length) return null;
      if (found.length === 1) return found[0];
      const polys = found.filter((g) => g.type === 'Polygon' || g.type === 'MultiPolygon');
      if (polys.length === found.length) return { type: 'MultiPolygon', coordinates: polys.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)) };
      return { type: 'GeometryCollection', geometries: found };
    }
    /** GeoJSON text in WGS 84 of a geometry given in degrees or SWEREF 99 (zone from `crs`), or null. */
    function geometryText(geometry, crs) {
      if (!isGeometry(geometry)) return null;
      return JSON.stringify(geo.toWgs84(geometry, crs || undefined));
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
      const plans = features.filter((f) => featureType(f) === 'detaljplan');
      const planFeature = plans[0] || null;
      const pp = (planFeature && planFeature.properties) || {};
      const crs = options.crs || crsOf(pp) || crsOf(data) || null;
      const decisions = features.filter((f) => featureType(f) === 'beslutsinformation').map((f) => f.properties || {});
      const descriptions = new Map(features.filter((f) => featureType(f) === 'planbestammelsebeskrivning').map((f) => [uuid((f.properties || {}).planbestammelse), str((f.properties || {}).motiv)]));
      const rows = [];
      let order = 0;
      for (const f of plans) {
        const p = f.properties || {};
        rows.push({ objektid: str(f.id || p.objektidentitet), objekttyp: 'planomrade', beteckning: str(p.beteckning), formulering: str(p.namn), katalogreferens: '', kod: '', kategori: '', underkategori: '', anvandningsform: '', varde: '', vardetyp: '', enhet: '', farg: '', status: str(p.status), etikett: str(p.namn || p.beteckning), ordning: order++, geometri: geometryText(geometryOf(f), crsOf(p) || crs) });
      }
      for (const f of features) {
        const ft = featureType(f);
        if (!/bestammelse/.test(ft) || ft === 'planbestammelsebeskrivning') continue;
        const p = f.properties || {};
        const value = Array.isArray(p.bestammelsevarde) ? p.bestammelsevarde[0] : asObject(p.bestammelsevarde);
        const motive = descriptions.get(uuid(f.id || p.objektidentitet)) || '';
        rows.push({
          objektid: str(f.id || p.objektidentitet), objekttyp: objectType(ft), beteckning: str(p.beteckning || p.textbeteckning || ''), formulering: str(p.bestammelseformulering || p.ursprungligBestammelseformulering || ''),
          katalogreferens: uuid(p.planbestammelsekatalogreferens), kod: str(p.bestammelsekod || ''), kategori: str(p.kategori || ''), underkategori: str(p.underkategori || ''), anvandningsform: str(p.anvandningsform || ''),
          varde: value ? str(value.variabelvarde) : '', vardetyp: value ? str(value.vardetyp) : '', enhet: value ? str(value.enhet) : '', farg: str(p.farg || ''), status: str(pp.status || ''),
          etikett: motive, ordning: order++, geometri: geometryText(geometryOf(f), crsOf(p) || crs),
        });
      }
      const decision = decisions[0] || {};
      const plan = {
        slag: 'detaljplan', objektid: str(pp.objektidentitet || (planFeature && planFeature.id) || ''), beteckning: str(pp.beteckning), namn: str(pp.namn), syfte: str(pp.syfte), kommun: str(pp.kommun), kommunkod: '',
        status: str(pp.status), typ: str(pp.typ), datumPaborjat: str(decision.datumPaborjat || ''), datumAntagande: str(decision.datumAntagande || ''), datumLagakraft: str(Array.isArray(decision.datumLagakraft) ? decision.datumLagakraft[0] : decision.datumLagakraft || ''),
        datumStatusforandring: str(pp.datumStatusforandring), genomforandetid: str(decision.genomforandetid || ''), diarienummer: str(decision.diarienummerKommun || ''), anvandbarhet: str(pp.anvandbarhet),
        kvalitet: asObject(pp.kvalitetsbeskrivning) || null, format: 'detaljplan', mediatyp: str(data['feature:mediatyp'] || ''), crs: crs || '',
      };
      return finish(plan, rows);
    }

    // ---- översiktsplan ----------------------------------------------------------------------------------------
    const themeKey = (grupp) => lower(grupp).replace(/[^a-zåäö0-9]/g, '').replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o');
    const catalogValue = (v) => { const o = asObject(v); return o ? str(o.varde) : str(v); };
    const catalogGroup = (v) => { const o = asObject(v); return o ? str(o.grupp) : ''; };
    /** Rows and plan info from an översiktsplan FeatureCollection in the exchange model. */
    function fromOversiktsplanGeoJson(data, options = {}) {
      const features = Array.isArray(data.features) ? data.features : [data];
      const op = features.find((f) => featureType(f) === 'oversiktsplan');
      const opp = (op && op.properties) || {};
      const crs = options.crs || crsOf(data) || null;
      const rows = [];
      let order = 0;
      for (const f of features) {
        if (featureType(f) !== 'innehallop') continue;
        const p = f.properties || {};
        const grupp = catalogGroup(p.innehallstyp);
        const geometry = geometryOf(f);
        rows.push({
          objektid: str(f.id || p.objektidentitet), tema: themeKey(grupp) || 'omrade', innehallstyp: catalogValue(p.innehallstyp), namn: str(p.namn), precisering: str(p.precisering),
          anvandningsstatus: catalogValue(p.anvandningsstatus), kompletterande: catalogValue(p.kompletterandeInnehallstyp), utbyggnadsordning: str(p.utbyggnadsordning), planhandelse: catalogValue(p.planhandelse),
          planhandelse_datum: str(p.datumPlanhandelse), beslut: str(p.beslut), geometrityp: geometry ? geometry.type : '', ordning: order++, geometri: geometryText(geometry, crsOf(p) || crs),
        });
      }
      const plan = { slag: 'oversiktsplan', objektid: str((op && op.id) || opp.objektidentitet || ''), namn: str(opp.planensTitel), kommun: str(opp.kommunnamn), kommunkod: str(opp.kommunkod), status: catalogValue(opp.planhandelse), datumPlanhandelse: str(opp.datumPlanhandelse), datumPaborjat: str(opp.datumPaborjat), digitaltUrsprung: opp.digitaltUrsprung === true || lower(opp.digitaltUrsprung) === 'ja', format: 'oversiktsplan-geojson', crs: crs || '' };
      return finish(plan, rows);
    }
    /**
     * Rows and plan info from the tables of an ÖP-model GeoPackage: `tables` = [{name, columns, rows}] with the
     * geometry already as GeoJSON text (the SQLite importer decodes GeoPackage binaries); `oversiktsplan` table optional.
     */
    function fromOpTables(tables, options = {}) {
      const rows = [];
      let order = 0;
      for (const table of tables) {
        const m = /^innehall_op_(.+?)(?:_(polygon|line|point))?$/i.exec(table.name);
        if (!m) continue;
        const tema = themeKey(m[1]);
        const col = (name) => table.columns.findIndex((c) => lower(c) === name);
        const gi = table.columns.findIndex((c) => /^(geom|shape|geometri|geometry)$/i.test(c));
        const idx = { id: col('objektidentitet'), typ: col('innehallstyp_varde'), namn: col('namn'), prec: col('precisering'), status: col('anvandningsstatus'), komp: col('kompletterandeinnehallstyp'), utb: col('utbyggnadsordning'), ph: col('planhandelse_varde'), phd: col('planhandelse_datum'), beslut: col('beslut') };
        const get = (row, i) => (i >= 0 ? str(row[i]) : '');
        for (const row of table.rows) {
          const geomText = gi >= 0 ? row[gi] : null;
          const geometry = geomText ? geo.parseGeometry(geomText) : null;
          rows.push({
            objektid: get(row, idx.id), tema: tema === 'omrade' || tema === 'plangeometri' ? tema : tema, innehallstyp: get(row, idx.typ) || (tema === 'omrade' ? 'Område' : tema === 'plangeometri' ? 'Plangeometri' : ''), namn: get(row, idx.namn), precisering: get(row, idx.prec),
            anvandningsstatus: get(row, idx.status), kompletterande: get(row, idx.komp), utbyggnadsordning: get(row, idx.utb), planhandelse: get(row, idx.ph), planhandelse_datum: get(row, idx.phd), beslut: get(row, idx.beslut),
            geometrityp: geometry ? geometry.type : '', ordning: order++, geometri: geometryText(geometry, options.crs || table.crs || null),
          });
        }
      }
      const opTable = tables.find((t) => lower(t.name) === 'oversiktsplan');
      let plan = { slag: 'oversiktsplan', objektid: '', namn: '', kommun: '', kommunkod: '', status: '', format: 'oversiktsplan-gpkg' };
      if (opTable && opTable.rows.length) {
        const col = (name) => opTable.columns.findIndex((c) => lower(c) === name);
        const r = opTable.rows[0];
        const get = (name) => { const i = col(name); return i >= 0 ? str(r[i]) : ''; };
        plan = Object.assign(plan, { objektid: get('objektidentitet'), namn: get('planens_titel'), kommunkod: get('kommunkod'), status: get('planhandelse_varde'), datumPlanhandelse: get('planhandelse_datum'), datumPaborjat: get('datum_paborjat') });
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

    return { DP_COLUMNS, OP_COLUMNS, OBJECT_TYPES, USE_LETTERS, OP_THEME_COLORS, OP_USE_COLORS, detect, detectTable, featureType, objectType, colorNameForDesignation, fillOf, strokeOf, opFillOf, geometryOf, geometryText, crsOf, fromNgp, fromReferenceTable, fromDetaljplan, fromOversiktsplanGeoJson, fromOpTables, isOpGeoPackage, decorate, toRows, fromRows, legend, grouped, areaM2, areasByUse, checkCatalog, templateMatches, provisionsMarkdown, themeKey };
  });
})();
