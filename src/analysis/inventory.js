// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A material inventory from a building model, as a basis for the waste management plan (avfallshanteringsplan) of PBL 10 kap.
 * 8 a § (in force from 2026-07-01; Boverket proposed it as a resurshushållningsplan in rapport 2024:26, proposal 4 and B2). The
 * provision's two points shape the result: 1) the building products that can be reused, here the elements with a type and their
 * product identities; 2) the waste the measure can give rise to, here every element and material with its quantity and its waste
 * fraction under avfallsförordningen (2020:614) 3 kap. 10 § (trä, mineral, metall, glas, plast, gips, or other and to be decided),
 * for high-quality recycling, and the hazardous substances the model itself names, for their safe handling.
 * The elements, materials, layers, quantities and the six layers of a building are the climate declaration's (analysis/climate,
 * read with doors and windows per material); a mass is the file's weight, or the volume times Pset_MaterialCommon.MassDensity.
 * The fraction comes from IfcMaterial.Category first and the material's name second, and the rule that decided is kept; no
 * classification system is read (B-59). A hazardous substance is listed only when a property in the model says so: the app
 * never guesses. Product identities are IFC's own: GlobalTradeItemNumber, Manufacturer and ModelLabel in
 * Pset_ManufacturerTypeInformation (on the type; IFC2X3 has no GTIN), SerialNumber and BarCode in Pset_ManufacturerOccurrence.
 * `gather` reads a model dataset; everything else is a pure function, for the tests.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/inventory', ['data/datasets', 'analysis/climate', 'ui/i18n'], (datasets, climate, i18n) => {
    const t = (k, p) => D.t(k, p);
    /** The waste fractions of avfallsförordningen 3 kap. 10 §, then what the rules leave to the person. */
    const FRACTIONS = ['tra', 'mineral', 'metall', 'glas', 'plast', 'gips', 'ovrigt'];

    /**
     * Word stems per fraction, in the Nordic languages and English, with where in a word they count: `word` the whole word, `edge`
     * at its start or end (compounds name the thing first or last: träpanel, limträ), `any` anywhere (long stems only). The IFC4
     * recommended categories (concrete, steel, aluminium, block, brick, stone, wood, glass, gypsum, plastic) are among them.
     */
    const STEMS = {
      tra: { word: ['lumber', 'clt', 'osb', 'mdf', 'hdf', 'glulam'], edge: ['trä', 'træ', 'wood', 'timber', 'virke', 'faner', 'fanér', 'spån', 'puu', 'timbur'], any: ['plywood', 'limträ', 'kryssfaner', 'träfiber'] },
      mineral: { word: ['block', 'masonry', 'murverk'], edge: ['sten', 'stein', 'stone', 'kakel', 'tegl', 'kivi'], any: ['beton', 'concrete', 'tegel', 'brick', 'klinker', 'clinker', 'keramik', 'ceramic', 'keraami', 'granit', 'marmor', 'marble', 'kalksten', 'limestone', 'skiffer', 'slate', 'murblock', 'tiili', 'steyp'] },
      metall: { word: [], edge: ['stål', 'stál', 'steel', 'järn', 'jern', 'iron', 'zink', 'zinc', 'sink', 'plåt', 'teräs', 'rauta'], any: ['metall', 'metal', 'aluminium', 'aluminum', 'koppar', 'kobber', 'copper', 'mässing', 'messing', 'brass', 'rostfri', 'stainless', 'kupari'] },
      glas: { word: [], edge: ['glas', 'glass', 'gler', 'lasi'], any: ['glazing'] },
      plast: { word: ['pvc', 'pe', 'pp', 'eps', 'xps', 'pur', 'pir', 'hdpe', 'ldpe', 'pex', 'pmma', 'abs'], edge: [], any: ['plast', 'polyeten', 'polyethylen', 'polypropen', 'polypropylen', 'polystyren', 'polystyrene', 'polyuretan', 'polyurethane', 'polykarbonat', 'polycarbonate', 'vinyl', 'akryl', 'acrylic', 'nylon', 'muovi'] },
      gips: { word: [], edge: ['gips', 'gifs', 'gypsum', 'kipsi'], any: ['plasterboard'] },
    };
    /** Words that name no fraction although they hold one's stem: mineral, glass and stone wool, and composites. */
    const EXCLUDED = [
      { rule: 'wool', test: (w) => (w.length >= 6 && /(ull|uld|villa)$/.test(w)) || w.includes('wool') },
      { rule: 'composite', test: (w) => /glasfib|glassfib|fiberglas|fibreglas|fibercement|fibre?cement|komposit|composite/.test(w) },
    ];
    const words = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
    /** The fractions a text names, each with the word that named it, and the first word that excludes a fraction. */
    function scan(text) {
      const list = words(text);
      for (const w of list) for (const ex of EXCLUDED) if (ex.test(w)) return { excluded: { rule: ex.rule, word: w }, found: new Map() };
      const found = new Map();
      for (const w of list) {
        for (const f of Object.keys(STEMS)) {
          const s = STEMS[f];
          if (found.has(f)) continue;
          if (s.word.includes(w) || s.edge.some((x) => w.startsWith(x) || w.endsWith(x)) || s.any.some((x) => w.includes(x))) found.set(f, w);
        }
      }
      return { excluded: null, found };
    }
    const fractionLabel = (f) => t('inventory.fraction.' + f);
    /**
     * The waste fraction of a material and the rule that decided: IfcMaterial.Category when it names one fraction, otherwise the
     * material's name; a word for wool or a composite, several fractions, no word or no material leave it to the person ('ovrigt').
     * @param {string|null|undefined} name @param {string|null|undefined} category
     * @returns {{fraction: string, rule: string, text: string}}
     */
    function fractionOf(name, category) {
      const cat = String(category || '').trim();
      const out = (fraction, rule, params) => ({ fraction, rule, text: t('inventory.rule.' + rule, Object.assign({ fraction: fractionLabel(fraction) }, params)) });
      if (cat) {
        const c = scan(cat);
        if (c.excluded) return out('ovrigt', 'category-' + c.excluded.rule, { category: cat });
        if (c.found.size === 1) return out(Array.from(c.found.keys())[0], 'category', { category: cat });
        if (c.found.size > 1) return out('ovrigt', 'category-several', { category: cat, list: Array.from(c.found.keys()).map(fractionLabel).join(', ') });
      }
      const n = String(name || '').trim();
      if (!n) return out('ovrigt', 'nomaterial', {});
      const s = scan(n);
      if (s.excluded) return out('ovrigt', s.excluded.rule, { name: n, word: s.excluded.word });
      if (s.found.size === 1) { const [f, w] = Array.from(s.found.entries())[0]; return out(f, 'name', { name: n, word: w }); }
      if (s.found.size > 1) return out('ovrigt', 'several', { name: n, list: Array.from(s.found.keys()).map(fractionLabel).join(', ') });
      return out('ovrigt', cat ? 'none-category' : 'none', { name: n, category: cat });
    }

    // ---- hazardous substances: only what the model says ---------------------------------------------------------------
    /** Words in a set's or a property's name that say it is about hazardous substances or hazardous waste. */
    const HAZARD_WORDS = ['hazard', 'farlig', 'svhc', 'asbest', 'pcb', 'toxic', 'giftig', 'dangerous'];
    /** Names that hold such a word but say something else: NonHazardousWaste, FireHazardFactor. */
    const NOT_HAZARD = /^(non|fire)/i;
    const NO = new Set(['', 'false', 'f', '.f.', 'no', 'nej', 'nei', 'ei', 'none', 'ingen', 'inga', 'inget', 'ingenting', '0', '-', 'n/a', 'na']);
    /**
     * Whether a property says the element holds a hazardous substance or gives hazardous waste: its set or its name names such a
     * thing (or it is Pset_Risk and its value does), and its value says yes (true, a number above zero, a text that is not a no).
     * @param {string} set @param {string} name @param {any} value
     */
    function saysHazard(set, name, value) {
      const named = HAZARD_WORDS.some((w) => (String(set || '') + ' ' + String(name || '')).toLowerCase().includes(w)) && !NOT_HAZARD.test(String(name || ''));
      const risk = String(set || '') === 'Pset_Risk' && /hazard|asbest|dust|farlig/i.test(String(value === null || value === undefined ? '' : value));
      if (!named && !risk) return false;
      if (value === true) return true;
      if (value === false || value === null || value === undefined) return false;
      if (typeof value === 'number') return value > 0;
      return !NO.has(String(value).trim().toLowerCase());
    }
    /** The SQL condition that finds the candidates in _properties; saysHazard decides. */
    const HAZARD_SQL = HAZARD_WORDS.map((w) => `uppsattning like '%${w}%' or namn like '%${w}%'`).join(' or ') + " or uppsattning = 'Pset_Risk'";

    // ---- product identities ---------------------------------------------------------------------------------------
    /** IFC's sets for a product's identity, per field: the set and the property (checked against IfcOpenShell's templates). */
    const PRODUCT_FIELDS = {
      gtin: ['Pset_ManufacturerTypeInformation', 'GlobalTradeItemNumber'], manufacturer: ['Pset_ManufacturerTypeInformation', 'Manufacturer'],
      model: ['Pset_ManufacturerTypeInformation', 'ModelLabel'], serial: ['Pset_ManufacturerOccurrence', 'SerialNumber'], barcode: ['Pset_ManufacturerOccurrence', 'BarCode'],
    };
    /**
     * A GTIN checked by GS1's rule: 8, 12, 13 or 14 digits whose last is the check digit. 'ok', 'checkdigit' (wrong check digit),
     * 'format' (not such digits) or null (no GTIN). @param {any} value
     */
    function gtinCheck(value) {
      const s = String(value === null || value === undefined ? '' : value).replace(/[\s-]/g, '');
      if (!s) return null;
      if (!/^\d+$/.test(s) || ![8, 12, 13, 14].includes(s.length)) return 'format';
      let sum = 0;
      for (let i = s.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(s[i]) * w;
      return (10 - (sum % 10)) % 10 === Number(s[s.length - 1]) ? 'ok' : 'checkdigit';
    }

    // ---- the inventory --------------------------------------------------------------------------------------------
    /** Mass density (Pset_MaterialCommon.MassDensity) and hazard properties per IfcMaterial id. @param {any[][]} rows */
    function materialFacts(rows) {
      const density = new Map(); const hazards = new Map();
      for (const [mid, set, name, value] of rows || []) {
        if (set === 'Pset_MaterialCommon' && name === 'MassDensity' && typeof value === 'number' && value > 0) density.set(mid, value);
        if (saysHazard(set, name, value)) { const l = hazards.get(mid) || []; l.push({ set, name, value: String(value), source: 'material' }); hazards.set(mid, l); }
      }
      return { density, hazards };
    }
    /**
     * Every post with its waste fraction and rule, its building layer (the climate rules', or the person's settlement there), its
     * mass (the file's weight, or the volume times the material's mass density, with where it came from) and the hazardous
     * substances its element and material name.
     * @param {{elements: any[], posts: any[], materialProps?: any[][], hazards?: Map<number, any[]>, products?: Map<number, any>}} data from gather
     * @param {{settled?: Record<string, string>|null}} [options]
     * @returns {{elements: any[], rows: any[]}}
     */
    function build(data, options = {}) {
      const decided = climate.decide(data, { settled: options.settled || null });
      const facts = materialFacts(data.materialProps || []);
      const own = data.hazards || new Map();
      const rows = decided.posts.map((p) => {
        const hasMaterial = String(p.key || '').startsWith('m:');
        const f = hasMaterial ? fractionOf(p.name, p.materialCategory) : fractionOf('', null);
        const mid = hasMaterial && p.material !== null && p.material !== undefined ? p.material : null;
        const density = mid !== null && facts.density.has(mid) ? facts.density.get(mid) : null;
        let mass = typeof p.mass === 'number' ? p.mass : null; let massFrom = mass !== null ? 'qto' : null;
        if (mass === null && density !== null && typeof p.volume === 'number') { mass = p.volume * density; massFrom = 'density'; }
        const hazards = (own.get(p.id) || []).concat(mid !== null ? (facts.hazards.get(mid) || []).map((h) => Object.assign({}, h, { material: p.label })) : []);
        return Object.assign({}, p, { hasMaterial, fraction: f.fraction, fractionRule: f.rule, fractionText: f.text, density, mass, massFrom, hazards });
      });
      return { elements: decided.elements, rows };
    }

    // ---- sums and tables ------------------------------------------------------------------------------------------
    const round = climate.round;
    const col = (name, type) => ({ name, type, label: t('inventory.col.' + name) });
    const layerLabel = (n) => (n ? t('climate.layer.' + n) : t('climate.cat.oklar'));
    const add = (a, v) => (typeof v === 'number' && Number.isFinite(v) ? a + v : a);
    function sums(list) {
      const ids = new Set(); let volume = 0; let area = 0; let mass = 0; let noMass = 0; let none = 0;
      for (const r of list) {
        ids.add(r.id); volume = add(volume, r.volume); area = add(area, r.area); mass = add(mass, r.mass);
        if (r.mass === null) noMass++;
        if (r.volume === null && r.area === null && r.mass === null) none++;
      }
      return { elements: ids.size, posts: list.length, volume, area, mass, noMass, none };
    }
    /**
     * The sums per waste fraction, in the ordinance's order, and the total: elements, rows, volume, area, mass and the rows without a
     * mass or any quantity. @param {any[]} rows build().rows
     */
    function summarize(rows) {
      const out = FRACTIONS.map((f) => Object.assign({ fraction: f, label: fractionLabel(f) }, sums(rows.filter((r) => r.fraction === f))));
      out.push(Object.assign({ fraction: 'total', label: t('inventory.fraction.total') }, sums(rows)));
      return out;
    }
    /** The sums per fraction as a table. @param {any[]} rows */
    function fractionTable(rows) {
      return { columns: [col('fraktion', 'text'), col('element', 'integer'), col('poster', 'integer'), col('volym_m3', 'number'), col('area_m2', 'number'), col('massa_kg', 'number'), col('utan_massa', 'integer'), col('utan_mangd', 'integer')],
        rows: summarize(rows).map((s) => [s.label, s.elements, s.posts, round(s.volume), round(s.area, 2), round(s.mass, 1), s.noMass, s.none]) };
    }
    /** The sums per layer of the building and fraction, the layers in order and the fractions in the ordinance's. @param {any[]} rows */
    function layerTable(rows) {
      const out = [];
      for (const layer of climate.LAYERS.concat([null])) {
        for (const f of FRACTIONS) {
          const list = rows.filter((r) => (r.layer || null) === layer && r.fraction === f);
          if (!list.length) continue;
          const s = sums(list);
          out.push([layerLabel(layer), fractionLabel(f), s.elements, s.posts, round(s.volume), round(s.area, 2), round(s.mass, 1), s.noMass]);
        }
      }
      return { columns: [col('skikt', 'text'), col('fraktion', 'text'), col('element', 'integer'), col('poster', 'integer'), col('volym_m3', 'number'), col('area_m2', 'number'), col('massa_kg', 'number'), col('utan_massa', 'integer')], rows: out };
    }
    const hazardText = (list) => (list && list.length ? list.map((h) => `${h.set}.${h.name} = ${h.value}` + (h.material ? ` (${h.material})` : '')).join('; ') : null);
    function sourceText(r) {
      const kind = typeof r.volume === 'number' ? 'volume' : typeof r.area === 'number' ? 'area' : null;
      const source = kind ? (r.sources && r.sources[kind]) || 'qto' : 'none';
      return [t('climate.source.' + source)].concat(source === 'extrusion' ? r.notes || [] : (r.notes || []).filter((n) => n === t('climate.source.shares'))).join(', ');
    }
    /** One row per element and material: the quantities, the fraction with its rule, the layer and the hazards. @param {any[]} rows */
    function elementTable(rows) {
      return {
        columns: [col('id', 'integer'), col('guid', 'text'), col('typ', 'text'), col('namn', 'text'), col('vaning', 'text'), col('typnamn', 'text'), col('material', 'text'), col('materialkategori', 'text'), col('tjocklek_mm', 'number'),
          col('fraktion', 'text'), col('regel', 'text'), col('skikt', 'text'), col('volym_m3', 'number'), col('area_m2', 'number'), col('densitet', 'number'), col('massa_kg', 'number'), col('massans_kalla', 'text'), col('mangdkalla', 'text'), col('farliga_amnen', 'text')],
        rows: rows.map((r) => [r.id, r.guid, r.typ, r.namn, r.vaning, r.typnamn, r.hasMaterial ? r.label : null, r.materialCategory, typeof r.thickness === 'number' ? round(r.thickness * 1000, 1) : null,
          fractionLabel(r.fraction), r.fractionText, layerLabel(r.layer), round(r.volume), round(r.area, 2), r.density, round(r.mass, 1), r.massFrom ? t('inventory.mass.' + r.massFrom) : null, sourceText(r), hazardText(r.hazards)]),
      };
    }
    const hasProduct = (p) => !!p && Object.keys(PRODUCT_FIELDS).some((k) => p[k]);
    /**
     * The building products that can be reused (PBL 10 kap. 8 a § point 1): the elements with a type, those with product data
     * first, each with its layer, materials, fractions, product identities (a GTIN's check digit checked) and hazards.
     * @param {any[]} elements build().elements @param {any[]} rows build().rows @param {Map<number, any>} products gather().products
     */
    function reuseTable(elements, rows, products) {
      const byElement = new Map();
      for (const r of rows) { const l = byElement.get(r.id) || []; l.push(r); byElement.set(r.id, l); }
      const list = elements.filter((e) => e.typnamn).map((e) => ({ e, p: (products && products.get(e.id)) || {}, posts: byElement.get(e.id) || [] }));
      list.sort((a, b) => Number(hasProduct(b.p)) - Number(hasProduct(a.p)) || (a.e.layer || 9) - (b.e.layer || 9) || String(a.e.typ).localeCompare(String(b.e.typ)) || String(a.e.typnamn).localeCompare(String(b.e.typnamn), i18n.locale()) || String(a.e.namn || '').localeCompare(String(b.e.namn || ''), i18n.locale()));
      const uniq = (xs) => Array.from(new Set(xs.filter(Boolean)));
      return {
        columns: [col('id', 'integer'), col('guid', 'text'), col('typ', 'text'), col('namn', 'text'), col('vaning', 'text'), col('typnamn', 'text'), col('skikt', 'text'), col('material', 'text'), col('fraktion', 'text'),
          col('tillverkare', 'text'), col('modell', 'text'), col('gtin', 'text'), col('gtin_kontroll', 'text'), col('serienummer', 'text'), col('streckkod', 'text'), col('farliga_amnen', 'text')],
        rows: list.map(({ e, p, posts }) => {
          const check = gtinCheck(p.gtin);
          const hazards = posts.reduce((all, r) => all.concat(r.hazards.filter((h) => !all.some((x) => x.set === h.set && x.name === h.name && x.material === h.material))), []);
          return [e.id, e.guid, e.typ, e.namn, e.vaning, e.typnamn, layerLabel(e.layer), uniq(posts.filter((r) => r.hasMaterial).map((r) => r.label)).join(', ') || null, uniq(posts.map((r) => fractionLabel(r.fraction))).join(', ') || null,
            p.manufacturer || null, p.model || null, p.gtin || null, check ? t('inventory.gtin.' + check) : null, p.serial || null, p.barcode || null, hazardText(hazards)];
        }),
      };
    }
    /**
     * The hazardous substances and hazardous waste the model names (PBL 10 kap. 8 a § point 2 b), one row per element and
     * property: the element's own, its type's or its material's (also for an element counted in its parts).
     * @param {any[]} elements build().elements @param {any[]} rows build().rows @param {Map<number, any[]>} [own] gather().hazards
     */
    function hazardTable(elements, rows, own) {
      const seen = new Set(); const out = [];
      const push = (e, h) => {
        const key = [e.id, h.set, h.name, h.source, h.material || ''].join('\u0001');
        if (seen.has(key)) return;
        seen.add(key);
        out.push([e.id, e.guid, e.typ, e.namn, e.vaning, t('inventory.source.' + h.source) + (h.material ? ': ' + h.material : ''), h.set, h.name, h.value]);
      };
      const byElement = new Map();
      for (const r of rows) { const l = byElement.get(r.id) || []; l.push(r); byElement.set(r.id, l); }
      for (const e of elements) {
        for (const h of (own && own.get(e.id)) || []) push(e, h);
        for (const r of byElement.get(e.id) || []) for (const h of r.hazards) if (h.source === 'material') push(e, h);
      }
      return { columns: [col('id', 'integer'), col('guid', 'text'), col('typ', 'text'), col('namn', 'text'), col('vaning', 'text'), col('kalla', 'text'), col('uppsattning', 'text'), col('egenskap', 'text'), col('varde', 'text')], rows: out };
    }

    // ---- reading a model dataset ----------------------------------------------------------------------------------
    async function exec(id, sql) {
      const handle = await datasets.ensureOpen(id);
      const res = await handle.engine.exec(sql);
      return res[0] ? res[0].values : [];
    }
    /**
     * The climate declaration's reading of a model dataset (doors and windows per material, with the materials' properties), and
     * per element its product identities and the properties that name hazardous substances (the occurrence's, then its type's).
     * @param {string} id @param {{onProgress?: (share: number) => void}} [options]
     */
    async function gather(id, options = {}) {
      const data = await climate.gather(id, { onProgress: options.onProgress, wholeProducts: false });
      const products = new Map();
      const sets = Array.from(new Set(Object.values(PRODUCT_FIELDS).map((x) => `'${x[0]}'`))).join(', ');
      for (const [eid, set, name, value] of await exec(id, `select id, uppsattning, namn, varde from _properties where uppsattning in (${sets}) order by kalla`)) {
        const field = Object.keys(PRODUCT_FIELDS).find((k) => PRODUCT_FIELDS[k][0] === set && PRODUCT_FIELDS[k][1] === name);
        if (!field || value === null || value === undefined || String(value).trim() === '') continue;
        const p = products.get(eid) || {};
        // 'objekt' sorts before 'typ': the occurrence's value goes first.
        if (p[field] === undefined) p[field] = String(value).trim();
        products.set(eid, p);
      }
      const hazards = new Map();
      for (const [eid, set, name, value, number, source] of await exec(id, `select id, uppsattning, namn, varde, tal, kalla from _properties where ${HAZARD_SQL}`)) {
        const v = typeof number === 'number' ? number : value;
        if (!saysHazard(set, name, v === 'true' ? true : v === 'false' ? false : v)) continue;
        const l = hazards.get(eid) || [];
        l.push({ set, name, value: String(value), source: source === 'objekt' ? 'objekt' : 'typ' });
        hazards.set(eid, l);
      }
      return Object.assign(data, { products, hazards });
    }

    return { FRACTIONS, STEMS, HAZARD_WORDS, PRODUCT_FIELDS, fractionOf, saysHazard, gtinCheck, materialFacts, build, summarize, fractionTable, layerTable, elementTable, reuseTable, hazardTable, gather };
  });
})();
