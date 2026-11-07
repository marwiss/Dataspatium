// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Digital plans from the other Nordic countries, read into the same plan rows as the Swedish ones (data/plan):
 * - Denmark: Plandata.dk (lokalplaner with delområder and byggefelter; kommuneplanrammer as a comprehensive plan),
 *   GeoJSON from the WFS (EPSG:25832 or WGS 84) or as API answers; general use codes (anvgen) colour the areas.
 * - Finland: the national plan data model (kaavatietomalli, Ryhti JSON: plan, planObjects, planRegulationGroups
 *   with planRegulations typed by the code list RY_Kaavamaarayslaji; embedded copy with the map letters).
 * - Iceland: stafrænt deiliskipulag (feature types Skipulag, Lodir, Byggingarreitir, Kvadir, Samgongur) and
 *   stafrænt aðalskipulag (landnotkun classes) from Skipulagsstofnun's services or the GeoPackage template.
 * - Norway: reguleringsplaner and kommuneplaner per the SOSI product specifications (GeoPackage from Geonorge:
 *   RpOmråde, RpArealformålOmråde with the arealformål code list (embedded copy), RpBestemmelseOmråde, hensynssoner).
 * Pure logic: recognise, read, colour (Boverket's colour names so that data/plan draws them), and build the requests
 * that fetch one plan from Plandata or Skipulagsstofnun. Colours follow each country's map practice in broad strokes.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/plan-nordic', ['data/geo'], (geo) => {
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const lower = (v) => str(v).trim().toLowerCase();
    const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
    const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
    const isGeometry = (g) => !!(g && typeof g === 'object' && typeof g.type === 'string' && (Array.isArray(g.coordinates) || Array.isArray(g.geometries)));
    /** Table and column names without diacritics, case and separators: "RpArealformålOmråde" → "rparealformalomrade". */
    const plain = (s) => lower(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/[^a-z0-9]/g, '');
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    /** GeoJSON text in WGS 84, or null (also for a system the app cannot convert: no place rather than a wrong one). */
    const geomText = (geometry, crs) => { if (!isGeometry(geometry)) return null; const g = geo.toWgs84(geometry, crs || undefined); return g ? JSON.stringify(g) : null; };
    const crsOfCollection = (data) => { const c = data && data.crs && data.crs.properties && data.crs.properties.name; return c ? String(c) : null; };

    // ---- Denmark: Plandata.dk ---------------------------------------------------------------------------------
    /** Generel anvendelse (anvgen) of Plandata.dk: code → [name, colour name]. */
    const DK_ANVGEN = {
      11: ['Boligområde', 'gul'], 21: ['Blandet bolig og erhverv', 'beige'], 31: ['Erhvervsområde', 'lila'], 41: ['Centerområde', 'brun'], 51: ['Rekreativt område', 'grön'],
      61: ['Sommerhusområde', 'orange'], 71: ['Område til offentlige formål', 'blå'], 81: ['Tekniske anlæg', 'grå'], 91: ['Landområde', 'ljusgrön'], 96: ['Andet', 'ljusgrå'],
    };
    const DK_STATUS = { KF: 'Kladde til forslag', KV: 'Kladde til vedtagelse', F: 'Forslag', V: 'Vedtaget', A: 'Aflyst' };
    const DK_ZONE = { 1: 'Byzone', 2: 'Landzone', 3: 'Sommerhusområde', 4: 'Byzone/landzone', 5: 'Sommerhusområde/landzone', 6: 'Byzone/sommerhusområde', 7: 'Byzone/landzone/sommerhusområde' };
    const DK_BYGGEFELT = { 1: 'Byggefelt med begrænsende byggeret', 2: 'Byggefelt med delvist begrænsende byggeret', 3: 'Vejledende byggefelt', 4: 'Særligt udpeget byggefelt' };
    const dkDate = (v) => { const s = str(v).replace(/\D/g, ''); return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : str(v).slice(0, 10); };
    /** Which Plandata layer a feature comes from: lokalplan (objektkode 20), delomraade (30 / 30.1), byggefelt (30.4), kommuneplanramme (10). */
    function dkLayer(p) {
      const plantype = str(p.plantype); const objektkode = num(p.objektkode);
      if (plantype === '30.4' || p.byggefelttype !== undefined || p.bftype !== undefined) return 'byggefelt';
      if (objektkode === 30 || /^30\./.test(plantype) || p.delnr !== undefined) return 'delomraade';
      if (objektkode === 10 || /^10\./.test(plantype) || p.komplan_id !== undefined) return 'kommuneplanramme';
      return 'lokalplan';
    }
    function dkUse(p) {
      const code = num(p.anvgen);
      const known = code !== null ? DK_ANVGEN[code] : null;
      return { kod: code === null ? '' : String(code), namn: str(p.anvendelsegenerel) || (known ? known[0] : ''), farg: known ? known[1] : 'ljusgrå' };
    }
    function dkSpecific(p) {
      const out = [];
      for (let i = 1; i <= 10; i++) { const c = p['anvspec' + i]; if (c !== undefined && c !== null && c !== '') out.push(String(c)); }
      return out.join(', ');
    }
    /**
     * Plandata.dk features (one or several layers mixed) → plan rows. Lokalplan polygons become the plan area (and the
     * use area when the plan has no delområder); delområder are uses, byggefelter property provisions.
     * @param {any[]} features GeoJSON features @param {{crs?: string}} [options]
     */
    function fromPlandata(features, options = {}) {
      const crs = options.crs || null;
      const rows = []; let order = 0;
      const byLayer = { lokalplan: [], delomraade: [], byggefelt: [], kommuneplanramme: [] };
      for (const f of features) { const p = (f && f.properties) || {}; byLayer[dkLayer(p)].push(f); }
      if (byLayer.kommuneplanramme.length && !byLayer.lokalplan.length) return fromKommuneplanrammer(byLayer.kommuneplanramme, options);
      const lp = byLayer.lokalplan[0] || null; const lpp = (lp && lp.properties) || {};
      for (const f of byLayer.lokalplan) {
        const p = f.properties || {};
        rows.push(dpRow({ objektid: str(p.planid || f.id), objekttyp: 'planomrade', beteckning: str(p.plannr), formulering: str(p.plannavn), kod: str(p.plantype), kategori: 'Lokalplan', status: DK_STATUS[str(p.status || p.planstatus)] || str(p.status || p.planstatus), etikett: str(p.plannavn), ordning: order++, geometri: geomText(f.geometry, crs) }));
      }
      if (!byLayer.delomraade.length) {
        for (const f of byLayer.lokalplan) {
          const p = f.properties || {}; const use = dkUse(p);
          rows.push(dpRow({ objektid: str(p.planid || f.id) + ':anv', objekttyp: 'anvandning', beteckning: str(p.plannr), formulering: use.namn, kod: use.kod, kategori: dkSpecific(p), anvandningsform: DK_ZONE[num(p.zone)] || str(p.zonestatus), varde: str(p.bebygpct), vardetyp: p.bebygpct ? 'max' : '', enhet: p.bebygpct ? '%' : '', farg: use.farg, status: DK_STATUS[str(p.status)] || str(p.status), etikett: str(p.notanvgen || ''), ordning: order++, geometri: geomText(f.geometry, crs) }));
        }
      }
      for (const f of byLayer.delomraade) {
        const p = f.properties || {}; const use = dkUse(p);
        const limits = [p.maxetager ? `${p.maxetager} etager` : '', p.maxbygnhjd ? `${p.maxbygnhjd} m` : ''].filter(Boolean).join(', ');
        rows.push(dpRow({ objektid: str(p.planid || f.id), objekttyp: 'anvandning', beteckning: str(p.delnr), formulering: use.namn + (limits ? ` (${limits})` : ''), kod: use.kod, kategori: dkSpecific(p), anvandningsform: DK_ZONE[num(p.zone)] || str(p.zonestatus), varde: str(p.bebygpct), vardetyp: p.bebygpct ? 'max' : '', enhet: p.bebygpct ? '%' : '', farg: use.farg, status: DK_STATUS[str(p.status)] || str(p.status), etikett: str(p.sforhold || ''), ordning: order++, geometri: geomText(f.geometry, crs) }));
      }
      for (const f of byLayer.byggefelt) {
        const p = f.properties || {}; const typ = num(p.byggefelttype !== undefined ? p.byggefelttype : p.bftype);
        rows.push(dpRow({ objektid: str(p.planid || f.id), objekttyp: 'egenskap', beteckning: str(p.delnr), formulering: (typ !== null && DK_BYGGEFELT[typ]) || str(p.byggefelttypetekst || 'Byggefelt'), kod: typ === null ? '' : String(typ), kategori: 'Byggefelt', varde: str(p.maxbygnhjd || p.maxetager || ''), enhet: p.maxbygnhjd ? 'm' : (p.maxetager ? 'etager' : ''), status: DK_STATUS[str(p.status)] || str(p.status), ordning: order++, geometri: geomText(f.geometry, crs) }));
      }
      const plan = {
        slag: 'detaljplan', land: 'DK', format: 'plandata', objektid: str(lpp.planid || ''), beteckning: str(lpp.plannr), namn: str(lpp.plannavn), kommun: str(lpp.kommunenavn), kommunkod: str(lpp.komnr),
        status: DK_STATUS[str(lpp.status || lpp.planstatus)] || str(lpp.status || lpp.planstatus), typ: 'Lokalplan', datumPaborjat: dkDate(lpp.datoforsl), datumAntagande: dkDate(lpp.datovedt), datumLagakraft: dkDate(lpp.datoikraft), dokument: str(lpp.doklink), zon: DK_ZONE[num(lpp.zone)] || str(lpp.zonestatus),
      };
      return finish(plan, rows);
    }
    /** Kommuneplanrammer → a comprehensive plan: land and water use per general use, coloured by anvgen. */
    function fromKommuneplanrammer(features, options = {}) {
      const crs = options.crs || null;
      const rows = []; let order = 0;
      for (const f of features) {
        const p = f.properties || {}; const use = dkUse(p);
        rows.push(opRow({ objektid: str(p.planid || f.id), tema: 'markochvattenanvandning', innehallstyp: use.namn || use.kod, namn: [p.plannr, p.plannavn].filter(Boolean).join(' '), precisering: str(p.distrikt), anvandningsstatus: DK_ZONE[num(p.fzone !== undefined ? p.fzone : p.zone)] || str(p.zonestatus), kompletterande: dkSpecific(p), planhandelse: DK_STATUS[str(p.planstatus || p.status)] || str(p.planstatus || p.status), planhandelse_datum: dkDate(p.datoikraft || p.datovedt), beslut: str(p.doklink), farg: use.farg, ordning: order++, geometry: f.geometry, crs }));
      }
      const p0 = (features[0] && features[0].properties) || {};
      const plan = { slag: 'oversiktsplan', land: 'DK', format: 'plandata-kommuneplan', objektid: str(p0.komplan_id || ''), namn: str(p0.plannavn).replace(/\s+\S*$/, '') || 'Kommuneplanrammer', kommun: str(p0.kommunenavn), kommunkod: str(p0.komnr), status: DK_STATUS[str(p0.planstatus || p0.status)] || str(p0.planstatus), datumPlanhandelse: dkDate(p0.datoikraft) };
      return finish(plan, rows);
    }

    // ---- Finland: kaavatietomalli -------------------------------------------------------------------------------
    /** Finnish map colours by the first letters of the regulation type's short name (kaavamerkintä). */
    const FI_LETTER_COLORS = [[/^A/, 'brun'], [/^C/, 'röd'], [/^P/, 'röd'], [/^Y/, 'röd'], [/^K/, 'lila'], [/^T/, 'grå'], [/^V/, 'grön'], [/^R/, 'orange'], [/^L/, 'ljusgrå'], [/^E/, 'grå'], [/^W/, 'blå'], [/^M/, 'ljusgrön'], [/^S/, 'mörkgrön']];
    const FI_WORD_COLORS = [[/asu|pientalo|kerrostalo|kyla|taajama/, 'brun'], [/keskusta/, 'röd'], [/palvelu|julkis|yleis/, 'röd'], [/liike|toimisto|kaupal/, 'lila'], [/tyopaikk|teollisuus|varasto|tuotanto/, 'grå'], [/virkistys|puisto|urheilu|leikki|viher/, 'grön'], [/loma|matkailu/, 'orange'], [/liikenne|katu|tie|rautatie|satama|lento/, 'ljusgrå'], [/erityis|yhdyskunta|energia|jate|hautaus/, 'grå'], [/vesi/, 'blå'], [/maa|metsa|maatalous/, 'ljusgrön'], [/suojelu|luonnon/, 'mörkgrön']];
    let fiCodes = null;
    /** The embedded RY_Kaavamaarayslaji code list: code → {fi, sv, en, kort, niva, over}. */
    async function loadKaavamaarayslaji() {
      if (fiCodes) return fiCodes;
      const text = await D.assets.loadText('presets/plan/fi-kaavamaarayslaji.json');
      const map = new Map();
      for (const c of JSON.parse(text).koodit) map.set(c.kod, c);
      fiCodes = map;
      return map;
    }
    const codeOfUri = (uri) => str(uri).replace(/\/+$/, '').split('/').pop();
    function fiColor(code, short) {
      const s = str(short);
      if (s) { const hit = FI_LETTER_COLORS.find(([re]) => re.test(s)); if (hit) return hit[1]; }
      const c = lower(code).normalize('NFD').replace(/[̀-ͯ]/g, '');
      const w = FI_WORD_COLORS.find(([re]) => re.test(c));
      return w ? w[1] : 'ljusgrå';
    }
    const ISO3 = { fi: 'fin', sv: 'swe', en: 'eng' };
    const localized = (v, lang) => { const o = asObject(v); if (!o) return str(v); return str(o[lang] || o[ISO3[lang] || ''] || o.fin || o.fi || o.swe || o.sv || o.eng || o.en || Object.values(o)[0] || ''); };
    function fiValue(value) {
      const v = asObject(value); if (!v) return { varde: '', vardetyp: '', enhet: '', text: '' };
      const dt = lower(v.dataType);
      if (dt === 'numeric' || dt === 'positivenumeric' || dt === 'decimal' || dt === 'positivedecimal') return { varde: str(v.number), vardetyp: '', enhet: str(v.unitOfMeasure), text: '' };
      if (/range/.test(dt)) return { varde: [v.minimumValue, v.maximumValue].filter((x) => x !== undefined && x !== null).join('–'), vardetyp: v.minimumValue !== undefined && v.maximumValue === undefined ? 'min' : (v.maximumValue !== undefined && v.minimumValue === undefined ? 'max' : ''), enhet: str(v.unitOfMeasure), text: '' };
      if (dt === 'text') return { varde: '', vardetyp: '', enhet: '', text: str(v.text) };
      if (dt === 'localizedtext') return { varde: '', vardetyp: '', enhet: '', text: localized(v.text, 'fin') };
      if (dt === 'code') return { varde: codeOfUri(v.code), vardetyp: '', enhet: '', text: localized(v.title, 'fin') };
      if (dt === 'identifier') return { varde: str(v.value), vardetyp: '', enhet: '', text: '' };
      return { varde: '', vardetyp: '', enhet: '', text: '' };
    }
    /**
     * A plan in the Finnish national plan data model (the Ryhti JSON) → plan rows. Each plan object gets one use row per
     * area-type regulation in its groups and one property row per other regulation; `codes` is the embedded code list.
     * @param {any} data @param {{lang?: string, codes?: Map<string, any>}} [options]
     */
    function fromKaavatietomalli(data, options = {}) {
      const lang = options.lang === 'sv' ? 'sv' : options.lang === 'en' ? 'en' : 'fi';
      const codes = options.codes || new Map();
      const area = asObject(data.geographicalArea) || {};
      const crsOf = (g) => { const o = asObject(g); return o && o.srid ? 'EPSG:' + str(o.srid) : null; };
      const geomOf = (g) => { const o = asObject(g); return o ? (isGeometry(o.geometry) ? o.geometry : (isGeometry(o) ? o : null)) : null; };
      const rows = []; let order = 0;
      const planId = str(data.permanentPlanIdentifier || data.planKey || '');
      rows.push(dpRow({ objektid: planId || 'plan', objekttyp: 'planomrade', beteckning: str(data.permanentPlanIdentifier || ''), formulering: localized(data.name, lang) || str(data.planDescription).slice(0, 120), kategori: fiPlanType(data.planType), status: codeOfUri(data.lifeCycleStatus), etikett: localized(data.name, lang), ordning: order++, geometri: geomText(geomOf(area), crsOf(area)) }));
      const groups = new Map();
      for (const g of (data.planRegulationGroups || [])) groups.set(str(g.planRegulationGroupKey), g);
      const relations = new Map();
      for (const r of (data.planRegulationGroupRelations || [])) { const k = str(r.planObjectKey); if (!relations.has(k)) relations.set(k, []); relations.get(k).push(str(r.planRegulationGroupKey)); }
      const label = (code) => { const c = codes.get(code); return c ? (c[lang] || c.fi || code) : code.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(); };
      for (const obj of (data.planObjects || [])) {
        const key = str(obj.planObjectKey);
        const groupKeys = relations.get(key) || (Array.isArray(obj.planRegulationGroupKeys) ? obj.planRegulationGroupKeys.map(str) : []);
        const geometry = geomText(geomOf(obj.geometry), crsOf(obj.geometry) || crsOf(area));
        const name = localized(obj.name, lang);
        let uses = 0;
        for (const gk of groupKeys) {
          const g = groups.get(gk); if (!g) continue;
          const letter = str(g.letterIdentifier);
          for (const reg of (g.planRegulations || [])) {
            const code = codeOfUri(reg.type); const info = codes.get(code) || null;
            // Area-type regulations (the coloured uses): codes ending in "alue" and codes with a map letter (A, AK, VP, LT …).
            const isArea = /alue$/i.test(code) || !!(info && info.kort && /^[A-ZÅÄÖ][A-ZÅÄÖa-z-]*$/.test(info.kort));
            const v = fiValue(reg.value);
            const short = letter || (info && info.kort) || '';
            if (isArea) {
              uses++;
              rows.push(dpRow({ objektid: `${key}:${str(reg.planRegulationKey)}`, objekttyp: 'anvandning', beteckning: short, formulering: label(code), kod: code, kategori: localized(g.titleOfPlanRegulation, lang), underkategori: (reg.planThemes || []).map(codeOfUri).join(', '), varde: v.varde, vardetyp: v.vardetyp, enhet: v.enhet, farg: fiColor(code, short), status: codeOfUri(reg.lifeCycleStatus || obj.lifeCycleStatus), etikett: name || v.text, ordning: order++, geometri: geometry }));
            } else {
              rows.push(dpRow({ objektid: `${key}:${str(reg.planRegulationKey)}`, objekttyp: 'egenskap', beteckning: str(reg.regulationNumber || ''), formulering: v.text || label(code) + (v.varde ? ` ${v.varde}${v.enhet ? ' ' + v.enhet : ''}` : ''), kod: code, kategori: localized(g.titleOfPlanRegulation, lang), underkategori: (reg.planThemes || []).map(codeOfUri).join(', '), varde: v.varde, vardetyp: v.vardetyp, enhet: v.enhet, status: codeOfUri(reg.lifeCycleStatus || obj.lifeCycleStatus), etikett: name, ordning: order++, geometri: geometry }));
            }
          }
          for (const rec of (g.planRecommendations || [])) rows.push(dpRow({ objektid: `${key}:${str(rec.planRecommendationKey)}`, objekttyp: 'administrativ', beteckning: str(rec.recommendationNumber || ''), formulering: localized(rec.value, lang), kategori: localized(g.titleOfPlanRegulation, lang), status: codeOfUri(rec.lifeCycleStatus), etikett: name, ordning: order++, geometri: geometry }));
        }
        if (!groupKeys.length || (!uses && !rows.some((r) => r.objektid.startsWith(key + ':')))) rows.push(dpRow({ objektid: key, objekttyp: 'annan', beteckning: '', formulering: name || localized(obj.description, lang), status: codeOfUri(obj.lifeCycleStatus), etikett: name, ordning: order++, geometri: geometry }));
      }
      for (const g of (data.generalRegulationGroups || [])) {
        for (const reg of (g.planRegulations || [])) { const code = codeOfUri(reg.type); const v = fiValue(reg.value); rows.push(dpRow({ objektid: `general:${str(reg.planRegulationKey)}`, objekttyp: 'administrativ', beteckning: str(reg.regulationNumber || ''), formulering: v.text || label(code), kod: code, kategori: localized(g.titleOfPlanRegulation, lang), varde: v.varde, enhet: v.enhet, status: codeOfUri(reg.lifeCycleStatus), ordning: order++, geometri: null })); }
      }
      const validity = asObject(data.periodOfValidity) || {};
      const plan = { slag: 'detaljplan', land: 'FI', format: 'kaavatietomalli', objektid: planId, beteckning: str(data.permanentPlanIdentifier || ''), namn: localized(data.name, lang) || str(data.permanentPlanIdentifier || data.planKey), kommun: (Array.isArray(data.administrativeAreaIdentifiers) ? data.administrativeAreaIdentifiers : []).map(codeOfUri).join(', '), kommunkod: '', status: codeOfUri(data.lifeCycleStatus), typ: fiPlanType(data.planType), datumAntagande: str(data.approvalDate), datumLagakraft: str(validity.begin), skala: data.scale ? `1:${data.scale}` : '', syfte: str(data.planDescription) };
      return finish(plan, rows);
    }
    const FI_PLAN_TYPES = { 1: 'Maakuntakaava', 11: 'Kokonaismaakuntakaava', 12: 'Vaihemaakuntakaava', 2: 'Yleiskaava', 21: 'Yleiskaava', 22: 'Vaiheyleiskaava', 23: 'Osayleiskaava', 24: 'Kuntien yhteinen yleiskaava', 25: 'Maanalainen yleiskaava', 3: 'Asemakaava', 31: 'Asemakaava', 32: 'Vaiheasemakaava', 33: 'Ranta-asemakaava', 34: 'Vaiheranta-asemakaava', 35: 'Maanalaisten tilojen asemakaava', 39: 'Asemakaava (ohjeellinen tonttijako)' };
    const fiPlanType = (uri) => { const c = codeOfUri(uri); return FI_PLAN_TYPES[c] || c; };

    // ---- Iceland: stafrænt skipulag -----------------------------------------------------------------------------
    /** Landnotkun classes of aðalskipulag (skipulagsreglugerð 90/2013): code → [name, colour name]. */
    const IS_LANDNOTKUN = {
      'ÍB': ['Íbúðarbyggð', 'gul'], 'M': ['Miðsvæði', 'brun'], 'VÞ': ['Verslun og þjónusta', 'lila'], 'S': ['Samfélagsþjónusta', 'röd'], 'AT': ['Athafnasvæði', 'blågrå'], 'I': ['Iðnaðarsvæði', 'grå'],
      'E': ['Efnistöku- og efnislosunarsvæði', 'grå'], 'F': ['Frístundabyggð', 'orange'], 'AF': ['Afþreyingar- og ferðamannasvæði', 'orange'], 'ÍÞ': ['Íþróttasvæði', 'grön'], 'K': ['Kirkjugarðar og grafreitir', 'grön'],
      'OP': ['Opin svæði', 'ljusgrön'], 'VE': ['Vegir, götur og stígar', 'ljusgrå'], 'FV': ['Flugvellir', 'ljusgrå'], 'H': ['Hafnir', 'blå'], 'L': ['Landbúnaðarsvæði', 'beige'], 'SL': ['Skógræktar- og landgræðslusvæði', 'mörkgrön'],
      'ÓB': ['Óbyggð svæði', 'ljusgrön'], 'V': ['Vötn, ár og sjór', 'blå'], 'SN': ['Sérstök not haf- og vatnssvæða', 'ljusblå'], 'VB': ['Vatnsból', 'blå'], 'ST': ['Strandsvæði', 'ljusblå'], 'VÖ': ['Varnar- og öryggissvæði', 'grå'],
      'SF': ['Skipulagi frestað', 'ljusgrå'], 'JÖ': ['Jökull', 'ljusblå'], 'U': ['Urðun eða sorpförgun', 'grå'],
    };
    const IS_BYGG_COLORS = [[/íbúð/i, 'gul'], [/frístund/i, 'orange'], [/hótel|veitinga/i, 'brun'], [/skóli|samfélags/i, 'röd'], [/verslun/i, 'brun'], [/atvinnu/i, 'lila'], [/iðnað|veitu|virkjan/i, 'blågrå'], [/bílageymsla|djúpgám/i, 'grå'], [/blönduð/i, 'beige'], [/landbún/i, 'beige']];
    const isColorFor = (byggTeg) => { const hit = IS_BYGG_COLORS.find(([re]) => re.test(str(byggTeg))); return hit ? hit[1] : 'ljusgrå'; };
    const isDate = (v) => { if (v === null || v === undefined || v === '') return ''; if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10); return str(v).slice(0, 10); };
    /** Which stafrænt skipulag feature type a feature's properties belong to. */
    function isLayer(p) {
      if (p.flokkur !== undefined) return 'landnotkun';
      if (p.byggTeg !== undefined || p.byggmagn !== undefined && p.haedirOfan !== undefined) return 'byggingarreitir';
      if (p.kvadirTeg !== undefined) return 'kvadir';
      if (p.samgongurTeg !== undefined) return 'samgongur';
      if (p.nytHlutf !== undefined || p.landnr !== undefined) return 'lodir';
      if (p.skipStig !== undefined || p.malsMed !== undefined || p.heitiStj !== undefined) return 'skipulag';
      if (p.akvaedi !== undefined) return 'onnurakvaedi';
      return 'annat';
    }
    /**
     * Features of a stafrænt deiliskipulag (Skipulag, Lóðir, Byggingarreitir, Kvaðir, Samgöngur mixed) → plan rows;
     * features of a stafrænt aðalskipulag (landnotkun, önnur ákvæði) → a comprehensive plan.
     * @param {any[]} features @param {{crs?: string}} [options]
     */
    function fromSkipulag(features, options = {}) {
      const crs = options.crs || null;
      const by = {};
      for (const f of features) { const k = isLayer((f && f.properties) || {}); (by[k] = by[k] || []).push(f); }
      if ((by.landnotkun || []).length && !(by.byggingarreitir || []).length && !(by.lodir || []).length) return fromAdalskipulag(features, options);
      const rows = []; let order = 0;
      const sk = (by.skipulag || [])[0] || null; const skp = (sk && sk.properties) || {};
      for (const f of (by.skipulag || [])) { const p = f.properties || {}; rows.push(dpRow({ objektid: str(p.audkenni || f.id), objekttyp: 'planomrade', beteckning: str(p.skipnr), formulering: str(p.heiti), kod: str(p.malsMed), kategori: str(p.skipStig), status: p.gildirTil ? 'Fallið úr gildi' : 'Í gildi', etikett: str(p.heiti), ordning: order++, geometri: geomText(f.geometry, crs) })); }
      for (const f of (by.byggingarreitir || [])) {
        const p = f.properties || {};
        const facts = [p.haedirOfan ? `${p.haedirOfan} hæðir` : '', p.ibudirFj ? `${p.ibudirFj} íbúðir` : '', p.gistiFj ? `${p.gistiFj} gistirými` : ''].filter(Boolean).join(', ');
        rows.push(dpRow({ objektid: str(f.id || p.OBJECTID || order), objekttyp: 'anvandning', beteckning: str(p.stadfang).trim(), formulering: [str(p.byggTeg), str(p.lysing).trim()].filter(Boolean).join(': ') + (facts ? ` (${facts})` : ''), kod: str(p.byggTeg), kategori: 'Byggingarreitur', varde: str(p.byggmagn || ''), vardetyp: p.byggmagn ? 'max' : '', enhet: p.byggmagn ? 'm²' : '', farg: isColorFor(p.byggTeg), status: p.gildirTil ? 'Fallið úr gildi' : 'Í gildi', etikett: str(p.skilmalar).trim(), ordning: order++, geometri: geomText(f.geometry, crs) }));
      }
      for (const f of (by.samgongur || [])) { const p = f.properties || {}; rows.push(dpRow({ objektid: str(f.id || p.OBJECTID || order), objekttyp: 'anvandning', beteckning: '', formulering: [str(p.samgongurTeg), str(p.lysing).trim()].filter(Boolean).join(': '), kod: str(p.samgongurTeg), kategori: 'Samgöngur', farg: 'ljusgrå', etikett: str(p.skilmalar).trim(), ordning: order++, geometri: geomText(f.geometry, crs) })); }
      for (const f of (by.lodir || [])) { const p = f.properties || {}; const size = num(p.staerd); rows.push(dpRow({ objektid: str(f.id || p.OBJECTID || order), objekttyp: 'egenskap', beteckning: str(p.heiti).trim(), formulering: `Lóð${size ? ` ${size} m²` : ''}${p.nytHlutf ? `, nýtingarhlutfall ${p.nytHlutf}` : ''}${p.ibudirFj ? `, ${p.ibudirFj} íbúðir` : ''}`, kod: str(p.landnr).trim(), kategori: 'Lóð', varde: str(p.nytHlutf || ''), vardetyp: p.nytHlutf ? 'max' : '', etikett: str(p.skilmalar).trim(), ordning: order++, geometri: geomText(f.geometry, crs) })); }
      for (const f of (by.kvadir || [])) { const p = f.properties || {}; rows.push(dpRow({ objektid: str(f.id || p.OBJECTID || order), objekttyp: 'administrativ', beteckning: '', formulering: [str(p.kvadirTeg), str(p.lysing).trim()].filter(Boolean).join(': '), kod: str(p.kvadirTeg), kategori: 'Kvöð', etikett: str(p.skilmalar).trim(), ordning: order++, geometri: geomText(f.geometry, crs) })); }
      for (const f of (by.annat || [])) { const p = f.properties || {}; rows.push(dpRow({ objektid: str(f.id || p.OBJECTID || order), objekttyp: 'annan', formulering: str(p.heiti || p.lysing || ''), ordning: order++, geometri: geomText(f.geometry, crs) })); }
      const plan = { slag: 'detaljplan', land: 'IS', format: 'skipulag', objektid: str(skp.audkenni || ''), beteckning: str(skp.skipnr), namn: str(skp.heiti), kommun: str(skp.heitiStj), kommunkod: str(skp.nrStj), status: skp.gildirTil ? 'Fallið úr gildi' : (skp.gildirFra ? 'Í gildi' : ''), typ: str(skp.skipStig || 'Deiliskipulag'), malsmedferd: str(skp.malsMed), datumLagakraft: isDate(skp.gildirFra), datumUpphord: isDate(skp.gildirTil), dokument: str(skp.skipulagsskjol), lagrum: str(skp.fyrirm).trim() };
      return finish(plan, rows);
    }
    /** Features of a stafrænt aðalskipulag → comprehensive plan rows (land use per class, other provisions as themes). */
    function fromAdalskipulag(features, options = {}) {
      const crs = options.crs || null;
      const rows = []; let order = 0;
      let first = null;
      for (const f of features) {
        const p = f.properties || {};
        const kind = isLayer(p);
        if (kind === 'skipulag') { first = first || p; rows.push(opRow({ objektid: str(p.audkenni || f.id), tema: 'omrade', innehallstyp: 'Skipulagsmörk', namn: str(p.heiti), planhandelse: p.gildirTil ? 'Fallið úr gildi' : 'Í gildi', planhandelse_datum: isDate(p.gildirFra), beslut: str(p.skipulagsskjol), farg: '', ordning: order++, geometry: f.geometry, crs })); continue; }
        first = first || p;
        const code = str(p.flokkur).trim(); const known = IS_LANDNOTKUN[code] || (/^B\d\d$/.test(code) ? ['Blönduð landnotkun', 'beige'] : null);
        if (kind === 'landnotkun') rows.push(opRow({ objektid: str(f.id || p.OBJECTID || order), tema: 'markochvattenanvandning', innehallstyp: known ? known[0] : (code || 'Landnotkun'), namn: [code, p.numer].filter((x) => x !== undefined && x !== null && x !== '').join('') + (p.heiti ? ' ' + str(p.heiti) : ''), precisering: str(p.akvaedi), kompletterande: str(p.lysing), anvandningsstatus: p.ibudirFj ? `${p.ibudirFj} íbúðir` : (p.byggmagn ? `${p.byggmagn} m²` : ''), planhandelse: p.gildirTil ? 'Fallið úr gildi' : 'Í gildi', planhandelse_datum: isDate(p.gildirFra), beslut: str(p.nakvaemni), farg: known ? known[1] : 'ljusgrå', ordning: order++, geometry: f.geometry, crs }));
        else rows.push(opRow({ objektid: str(f.id || p.OBJECTID || order), tema: 'onnurakvaedi', innehallstyp: str(p.heiti || p.flokkur || 'Önnur ákvæði'), namn: str(p.heiti), precisering: str(p.akvaedi || p.lysing), planhandelse: p.gildirTil ? 'Fallið úr gildi' : 'Í gildi', planhandelse_datum: isDate(p.gildirFra), farg: '', ordning: order++, geometry: f.geometry, crs }));
      }
      const p0 = first || {};
      const plan = { slag: 'oversiktsplan', land: 'IS', format: 'skipulag-adal', objektid: str(p0.audkenni || ''), namn: str(p0.heiti || (p0.skipnr ? 'Aðalskipulag ' + p0.skipnr : 'Aðalskipulag')), kommun: str(p0.heitiStj), kommunkod: str(p0.nrStj), status: p0.gildirTil ? 'Fallið úr gildi' : 'Í gildi', datumPlanhandelse: isDate(p0.gildirFra), beteckning: str(p0.skipnr) };
      return finish(plan, rows);
    }

    // ---- Norway: reguleringsplan and kommuneplan (SOSI product specifications) ------------------------------------
    let noCodes = null;
    /** The embedded arealformål code list (RpArealformål): code → name. */
    async function loadArealformal() {
      if (noCodes) return noCodes;
      const text = await D.assets.loadText('presets/plan/no-arealformal.json');
      const j = JSON.parse(text);
      noCodes = new Map(Object.entries(Object.assign({}, j.utgatt || {}, j.koder || {})));
      return noCodes;
    }
    /** Colour name for an arealformål code (SOSI drawing rules in broad strokes). */
    function noColorFor(code) {
      const c = Number(code);
      if (!c) return 'ljusgrå';
      if (c >= 6000) return 'blå';
      if (c >= 5000) return 'ljusgrön';
      if (c >= 4000) return 'mörkgrön';
      if (c >= 3000) return 'grön';
      if (c >= 2000) return 'ljusgrå';
      if (c >= 1800) return 'beige';
      if (c >= 1700) return 'mörkgrön';
      if (c >= 1600) return 'ljusgrön';
      if (c >= 1500) return 'grå';
      if (c >= 1400) return 'grön';
      if (c >= 1300) return 'lila';
      if (c >= 1200) return 'grå';
      if (c >= 1170) return 'orange';
      if (c >= 1160) return 'röd';
      if (c >= 1150) return 'lila';
      if (c >= 1130) return 'brun';
      if (c >= 1120) return 'orange';
      return 'gul';
    }
    /** Which plan object type a Norwegian table (or feature type) is: planomrade, anvandning, egenskap, administrativ, annan, or null when not a plan table. */
    function noTableKind(name) {
      const n = plain(name);
      if (/^(rp|kp|rb)omrade$/.test(n)) return 'planomrade';
      if (/^(rp|kp|rb)(areal)?formalomrade$/.test(n)) return 'anvandning';
      if (/^(rp|kp)bestemmelse(omrade|sone)$/.test(n) || /^rpregulerthoyde$/.test(n)) return 'egenskap';
      if (/^(rp|kp).*sone$/.test(n) || /^rb(bevaring|fare|fornyelse|rekkefolge|restriksjon)omrade$/.test(n)) return 'administrativ';
      if (/^(rp|kp)(juridisk(linje|punkt)|paskrift)$/.test(n)) return 'annan';
      if (/^(rp|kp|rb).*grense$/.test(n)) return 'grense';
      return null;
    }
    /** 'reguleringsplan', 'kommuneplan' or null for a GeoPackage's table names. */
    function noGpkgKind(names) {
      const kinds = (names || []).map((n) => plain(n));
      if (kinds.some((n) => /^rp(areal)?formalomrade$|^rpomrade$/.test(n))) return 'reguleringsplan';
      if (kinds.some((n) => /^kp(areal)?formalomrade$|^kpomrade$/.test(n))) return 'kommuneplan';
      return null;
    }
    /**
     * Tables of a Norwegian plan GeoPackage ([{name, columns, rows, crs}], geometry already GeoJSON text) → plan rows.
     * @param {any[]} tables @param {{codes?: Map<string, string>, crs?: string}} [options]
     */
    function fromNorwegianTables(tables, options = {}) {
      const codes = options.codes || new Map();
      const kp = noGpkgKind(tables.map((t) => t.name)) === 'kommuneplan';
      const rows = []; let order = 0;
      let planInfo = null;
      for (const table of tables) {
        const kind = noTableKind(table.name);
        if (!kind || kind === 'grense') continue;
        const cols = table.columns.map(plain);
        const col = (...names) => { for (const n of names) { const i = cols.indexOf(plain(n)); if (i >= 0) return i; } return -1; };
        const gi = table.columns.findIndex((c) => /^(geom|geometry|shape|omrade|område|posisjon|grense|senterlinje)$/i.test(c));
        const idx = { id: col('lokalid', 'identifikasjon_lokalid', 'objid'), formal: col('arealformal', 'arealformål', 'formal', 'kparealformal', 'rpformal'), felt: col('feltbetegnelse', 'feltnavn'), beskrivelse: col('beskrivelse', 'hensynsonenavn', 'bestemmelseomradenavn', 'tekst', 'informasjon'), planid: col('planidentifikasjon', 'planid', 'arealplanid_planidentifikasjon', 'nasjonalarealplanid_planidentifikasjon'), plannavn: col('plannavn'), plantype: col('plantype'), planstatus: col('planstatus'), ikraft: col('ikrafttredelsesdato', 'vedtaksdato', 'ikrafttredelse'), kommune: col('kommunenummer', 'arealplanid_kommunenummer'), eierform: col('eierform'), hensyn: col('hensynskategori', 'hensynsonetype', 'sonetype', 'bestemmelsehjemmel'), utnytting: col('utnyttingstall', 'utnytting_utnyttingstall'), utnyttingstype: col('utnyttingstype', 'utnytting_utnyttingstype'), hoyde: col('regulerthoyde', 'byggehoyde', 'hoyde'), vertikal: col('vertikalniva') };
        const get = (row, i) => (i >= 0 ? str(row[i]) : '');
        for (const row of table.rows) {
          const geometry = gi >= 0 && row[gi] ? geo.parseGeometry(row[gi]) : null;
          const g = geomText(geometry, options.crs || table.crs || null);
          const code = get(row, idx.formal);
          if (kind === 'planomrade') {
            planInfo = planInfo || { planid: get(row, idx.planid), plannavn: get(row, idx.plannavn), plantype: get(row, idx.plantype), planstatus: get(row, idx.planstatus), ikraft: get(row, idx.ikraft), kommune: get(row, idx.kommune) };
            if (kp) rows.push(opRow({ objektid: get(row, idx.id) || get(row, idx.planid), tema: 'omrade', innehallstyp: 'Planområde', namn: get(row, idx.plannavn), planhandelse: get(row, idx.planstatus), planhandelse_datum: get(row, idx.ikraft), farg: '', ordning: order++, geometry: geometry ? geo.toWgs84(geometry, options.crs || table.crs || undefined) : null }));
            else rows.push(dpRow({ objektid: get(row, idx.id) || get(row, idx.planid), objekttyp: 'planomrade', beteckning: get(row, idx.planid), formulering: get(row, idx.plannavn), kod: get(row, idx.plantype), status: get(row, idx.planstatus), etikett: get(row, idx.plannavn), ordning: order++, geometri: g }));
            continue;
          }
          const name = codes.get(code) || '';
          if (kp) {
            const tema = kind === 'anvandning' ? 'markochvattenanvandning' : (kind === 'administrativ' ? 'hensynssone' : (kind === 'egenskap' ? 'bestemmelsesomrade' : 'annan'));
            rows.push(opRow({ objektid: get(row, idx.id) || String(order), tema, innehallstyp: kind === 'anvandning' ? (name || code) : (get(row, idx.hensyn) || get(row, idx.beskrivelse) || table.name), namn: get(row, idx.felt) || get(row, idx.beskrivelse), precisering: kind === 'anvandning' ? get(row, idx.beskrivelse) : get(row, idx.hensyn), kompletterande: code, planhandelse: planInfo ? planInfo.planstatus : '', planhandelse_datum: planInfo ? planInfo.ikraft : '', farg: kind === 'anvandning' ? noColorFor(code) : '', ordning: order++, geometry: geometry ? geo.toWgs84(geometry, options.crs || table.crs || undefined) : null }));
            continue;
          }
          if (kind === 'anvandning') rows.push(dpRow({ objektid: get(row, idx.id) || String(order), objekttyp: 'anvandning', beteckning: get(row, idx.felt), formulering: name || (code ? `Arealformål ${code}` : table.name), kod: code, kategori: code ? noMainCategory(code) : '', anvandningsform: get(row, idx.eierform), varde: get(row, idx.utnytting), vardetyp: get(row, idx.utnyttingstype), farg: noColorFor(code), etikett: get(row, idx.beskrivelse), ordning: order++, geometri: g }));
          else if (kind === 'egenskap') rows.push(dpRow({ objektid: get(row, idx.id) || String(order), objekttyp: 'egenskap', beteckning: get(row, idx.felt), formulering: get(row, idx.beskrivelse) || (get(row, idx.hoyde) ? `Regulert høyde ${get(row, idx.hoyde)} m` : table.name), kod: get(row, idx.hensyn), kategori: table.name, varde: get(row, idx.hoyde), enhet: get(row, idx.hoyde) ? 'm' : '', ordning: order++, geometri: g }));
          else if (kind === 'administrativ') rows.push(dpRow({ objektid: get(row, idx.id) || String(order), objekttyp: 'administrativ', beteckning: get(row, idx.felt), formulering: get(row, idx.beskrivelse) || get(row, idx.hensyn) || table.name, kod: get(row, idx.hensyn), kategori: table.name, ordning: order++, geometri: g }));
          else rows.push(dpRow({ objektid: get(row, idx.id) || String(order), objekttyp: 'annan', beteckning: '', formulering: get(row, idx.beskrivelse) || table.name, kategori: table.name, ordning: order++, geometri: g }));
        }
      }
      const pi = planInfo || {};
      const plan = kp
        ? { slag: 'oversiktsplan', land: 'NO', format: 'kommuneplan-gpkg', objektid: pi.planid || '', namn: pi.plannavn || 'Kommuneplan', kommunkod: pi.kommune || '', status: pi.planstatus || '', datumPlanhandelse: pi.ikraft || '' }
        : { slag: 'detaljplan', land: 'NO', format: 'reguleringsplan-gpkg', objektid: pi.planid || '', beteckning: pi.planid || '', namn: pi.plannavn || 'Reguleringsplan', kommunkod: pi.kommune || '', status: pi.planstatus || '', typ: pi.plantype || '', datumLagakraft: pi.ikraft || '' };
      // The file's coordinate system, so that the plan view can say when it is one the app cannot convert.
      plan.crs = String(options.crs || (tables.find((t) => t && t.crs) || {}).crs || '');
      return finish(plan, rows);
    }
    const NO_MAIN = { 1: 'Bebyggelse og anlegg', 2: 'Samferdselsanlegg og teknisk infrastruktur', 3: 'Grønnstruktur', 4: 'Forsvaret', 5: 'Landbruks-, natur- og friluftsformål samt reindrift', 6: 'Bruk og vern av sjø og vassdrag' };
    const noMainCategory = (code) => NO_MAIN[Number(String(code).charAt(0))] || '';

    // ---- Icelandic GeoPackage template ------------------------------------------------------------------------
    /** True when a GeoPackage's tables follow the stafrænt deiliskipulag template (Skipulag, Lodir, Byggingarreitir, Kvadir, Samgongur). */
    function isSkipulagGpkg(names) {
      const set = new Set((names || []).map((n) => plain(n).replace(/^.*?(skipulag|lodir|byggingarreitir|kvadir|samgongur)$/, '$1')));
      return set.has('byggingarreitir') || set.has('lodir') || (set.has('skipulag') && (set.has('kvadir') || set.has('samgongur')));
    }
    /** Tables of a stafrænt deiliskipulag GeoPackage → features (the table decides the type) → plan rows. */
    function fromSkipulagTables(tables, options = {}) {
      const features = [];
      for (const table of tables) {
        const n = plain(table.name);
        const kind = /byggingarreitir$/.test(n) ? 'byggingarreitir' : /lodir$/.test(n) ? 'lodir' : /kvadir$/.test(n) ? 'kvadir' : /samgongur$/.test(n) ? 'samgongur' : /landnotkun$/.test(n) ? 'landnotkun' : /skipulag$/.test(n) ? 'skipulag' : null;
        if (!kind) continue;
        const gi = table.columns.findIndex((c) => /^(geom|geometry|shape)$/i.test(c));
        for (const row of table.rows) {
          const props = {};
          table.columns.forEach((c, i) => { if (i !== gi) props[c] = row[i]; });
          // Mark the type for isLayer() when the template's defining field is empty.
          if (kind === 'byggingarreitir' && props.byggTeg === undefined) props.byggTeg = '';
          if (kind === 'lodir' && props.nytHlutf === undefined) props.nytHlutf = null;
          if (kind === 'kvadir' && props.kvadirTeg === undefined) props.kvadirTeg = '';
          if (kind === 'samgongur' && props.samgongurTeg === undefined) props.samgongurTeg = '';
          if (kind === 'skipulag' && props.skipStig === undefined) props.skipStig = 'Deiliskipulag';
          if (kind === 'landnotkun' && props.flokkur === undefined) props.flokkur = '';
          const geometry = gi >= 0 && row[gi] ? geo.parseGeometry(row[gi]) : null;
          features.push({ type: 'Feature', geometry: geometry ? geo.toWgs84(geometry, options.crs || table.crs || 'EPSG:3057') : null, properties: props });
        }
      }
      return fromSkipulag(features, {});
    }

    // ---- recognition --------------------------------------------------------------------------------------------
    /** Nordic plan format of a parsed JSON document: plandata, plandata-kommuneplan, kaavatietomalli, skipulag, skipulag-adal, or null. */
    function detect(data) {
      if (!data || typeof data !== 'object') return null;
      if (Array.isArray(data.planObjects) && (data.planKey || data.geographicalArea || data.planRegulationGroups)) return 'kaavatietomalli';
      const features = Array.isArray(data.features) ? data.features : (data.type === 'Feature' ? [data] : null);
      if (!features || !features.length) return null;
      const props = features.slice(0, 50).map((f) => (f && f.properties) || {});
      if (props.some((p) => p.planid !== undefined && p.komnr !== undefined && (p.anvgen !== undefined || p.plantype !== undefined || p.objektkode !== undefined))) {
        return props.every((p) => dkLayer(p) === 'kommuneplanramme') ? 'plandata-kommuneplan' : 'plandata';
      }
      if (props.some((p) => p.skipnr !== undefined && (p.audkenni !== undefined || p.skipStig !== undefined || p.byggTeg !== undefined || p.flokkur !== undefined))) {
        return props.some((p) => p.flokkur !== undefined) && !props.some((p) => p.byggTeg !== undefined || p.nytHlutf !== undefined) ? 'skipulag-adal' : 'skipulag';
      }
      return null;
    }
    /** Nordic plan format of an API table's columns (flattened GeoJSON properties), or null. */
    function detectTable(columns) {
      const names = new Set((columns || []).map((c) => lower(typeof c === 'string' ? c : c.name)));
      if (names.has('planid') && names.has('komnr') && (names.has('anvgen') || names.has('plantype'))) return names.has('komplan_id') && !names.has('zone') ? 'plandata-kommuneplan' : 'plandata';
      if (names.has('skipnr') && (names.has('audkenni') || names.has('skipstig') || names.has('byggteg') || names.has('flokkur'))) return names.has('flokkur') ? 'skipulag-adal' : 'skipulag';
      return null;
    }
    /** Plan kind of a GeoPackage by its table names: reguleringsplan, kommuneplan, skipulag, or null. */
    function gpkgKind(tableNames) { return noGpkgKind(tableNames) || (isSkipulagGpkg(tableNames) ? 'skipulag' : null); }
    /** Features from an API table (columns + row arrays; geometry as GeoJSON text in a `geometri`/`geometry` column). */
    function featuresFromTable(columns, rows) {
      const names = columns.map((c) => (typeof c === 'string' ? c : c.name));
      const gi = names.findIndex((n) => /^(geometri|geometry|geom)$/i.test(n));
      return rows.map((r, i) => { const props = {}; names.forEach((n, j) => { if (j !== gi) props[n] = r[j]; }); const g = gi >= 0 && r[gi] ? geo.parseGeometry(r[gi]) : null; return { type: 'Feature', id: i, geometry: g, properties: props }; });
    }
    /** Read a recognised Nordic plan: JSON document, GeoJSON features or an API table. */
    async function read(format, data, options = {}) {
      if (format === 'kaavatietomalli') return fromKaavatietomalli(data, Object.assign({ codes: await loadKaavamaarayslaji() }, options));
      const features = Array.isArray(data) ? data : (Array.isArray(data.features) ? data.features : [data]);
      const crs = options.crs || crsOfCollection(data) || null;
      if (format === 'plandata' || format === 'plandata-kommuneplan') return fromPlandata(features, { crs });
      if (format === 'skipulag' || format === 'skipulag-adal') return fromSkipulag(features, { crs });
      throw new Error('unknown plan format ' + format);
    }
    /** Read a plan GeoPackage's tables by kind. */
    async function readTables(kind, tables, options = {}) {
      if (kind === 'reguleringsplan' || kind === 'kommuneplan') return fromNorwegianTables(tables, Object.assign({ codes: await loadArealformal() }, options));
      if (kind === 'skipulag') return fromSkipulagTables(tables, options);
      throw new Error('unknown plan GeoPackage ' + kind);
    }

    // ---- fetching one plan from a service -----------------------------------------------------------------------
    /** The plan-fetch kinds a geodata source can offer (`family.plans`). */
    const FETCH_KINDS = ['plandata', 'skipulag'];
    const q = (s) => encodeURIComponent(String(s));
    /**
     * Requests that fetch one plan from a service: Plandata.dk (lokalplan by planid or plannr, then delområder and
     * byggefelter by lokplan_id) or Skipulagsstofnun (the five deiliskipulag layers by skipnr, or the aðalskipulag
     * layers when `id` starts with "ask:"). Two stages for Plandata when the plan number is given.
     * @param {string} kind @param {string} baseUrl @param {string} id
     * @returns {{stage1: {layer: string, url: string}[], stage2?: (features: any[]) => {layer: string, url: string}[]}}
     */
    function fetchPlanRequests(kind, baseUrl, id) {
      const base = String(baseUrl || '').replace(/\?.*$/, '').replace(/\/+$/, '');
      const key = String(id || '').trim();
      if (kind === 'plandata') {
        const wfs = (layer, cql) => ({ layer, url: `${base}?service=WFS&version=2.0.0&request=GetFeature&typeNames=pdk:${layer}&outputFormat=application/json&srsName=EPSG:4326&count=5000&CQL_FILTER=${q(cql)}` });
        const numeric = /^\d+$/.test(key);
        const lokalplan = wfs('theme_pdk_lokalplan_vedtaget', numeric ? `planid=${key}` : `plannr='${key.replace(/'/g, "''")}'`);
        return { stage1: [lokalplan], stage2: (features) => { const planid = features.map((f) => f.properties && f.properties.planid).find((v) => v !== undefined && v !== null); return planid === undefined ? [] : [wfs('theme_pdk_lokalplandelomraade_vedtaget', `lokplan_id=${planid}`), wfs('theme_pdk_byggefelt_vedtaget', `lokplan_id=${planid}`)]; } };
      }
      if (kind === 'skipulag') {
        const ask = /^ask:/i.test(key); const nr = key.replace(/^ask:/i, '').replace(/'/g, "''");
        const root = /\/rest\/services\/?$/.test(base) ? base : base.replace(/\/rest\/services\/.*$/, '/rest/services');
        const arc = (service, layer) => ({ layer: `${service}/${layer}`, url: `${root}/${service}/${/FeatureServer/.test(service) ? '' : ''}${layer}/query?where=${q(`skipnr='${nr}'`)}&outFields=*&f=geojson&outSR=4326&resultRecordCount=5000` });
        return ask
          ? { stage1: [1, 11, 4, 5, 8].map((l) => arc('Stafraent_adalskipulag/MapServer', l)) }
          : { stage1: [0, 1, 2, 3, 4].map((l) => arc('Stafraent_deiliskipulag/FeatureServer', l)) };
      }
      throw new Error('unknown plan fetch kind ' + kind);
    }
    /**
     * Fetch one plan through `getJson(url)` (the caller's HTTP with consent) and read it.
     * @param {string} kind @param {string} baseUrl @param {string} id @param {(url: string) => Promise<any>} getJson
     */
    async function fetchPlan(kind, baseUrl, id, getJson) {
      const req = fetchPlanRequests(kind, baseUrl, id);
      const collect = async (list) => { const out = []; for (const r of list) { const data = await getJson(r.url); const feats = data && Array.isArray(data.features) ? data.features : []; out.push(...feats); } return out; };
      let features = await collect(req.stage1);
      if (req.stage2) features = features.concat(await collect(req.stage2(features)));
      if (!features.length) throw new Error(D.t('plan.fetch.none'));
      const format = kind === 'plandata' ? 'plandata' : (/^ask:/i.test(String(id)) ? 'skipulag-adal' : 'skipulag');
      return Object.assign({ format }, await read(format, features, { crs: 'EPSG:4326' }));
    }

    // ---- rows ---------------------------------------------------------------------------------------------------
    function dpRow(o) {
      return Object.assign({ objektid: '', objekttyp: 'annan', beteckning: '', formulering: '', katalogreferens: '', kod: '', kategori: '', underkategori: '', anvandningsform: '', varde: '', vardetyp: '', enhet: '', farg: '', status: '', etikett: '', ordning: 0, geometri: null }, o, { farg: o.farg ? cap(o.farg) : '' });
    }
    function opRow(o) {
      const geometry = o.geometry ? (o.crs ? geo.toWgs84(o.geometry, o.crs) : o.geometry) : null;
      return { objektid: str(o.objektid), tema: o.tema || 'omrade', innehallstyp: str(o.innehallstyp), namn: str(o.namn), precisering: str(o.precisering), anvandningsstatus: str(o.anvandningsstatus), kompletterande: str(o.kompletterande), utbyggnadsordning: str(o.utbyggnadsordning), planhandelse: str(o.planhandelse), planhandelse_datum: str(o.planhandelse_datum), beslut: str(o.beslut), geometrityp: geometry ? geometry.type : '', farg: o.farg ? cap(o.farg) : '', ordning: o.ordning || 0, geometri: geometry ? JSON.stringify(geometry) : null };
    }
    function finish(plan, rows) {
      const antal = {};
      for (const r of rows) { const k = r.objekttyp || r.tema || 'annan'; antal[k] = (antal[k] || 0) + 1; }
      plan.antal = antal;
      return { plan, rows };
    }

    return { DK_ANVGEN, DK_STATUS, IS_LANDNOTKUN, FETCH_KINDS, detect, detectTable, gpkgKind, read, readTables, featuresFromTable, fromPlandata, fromKommuneplanrammer, fromKaavatietomalli, fromSkipulag, fromAdalskipulag, fromNorwegianTables, fromSkipulagTables, loadKaavamaarayslaji, loadArealformal, noColorFor, fiColor, fetchPlanRequests, fetchPlan, plain };
  });
})();
