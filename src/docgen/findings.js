// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The findings of "Kontrollera med AI" (decision F44 a) as documents: the context of the built-in templates Besiktningsrapport and
 * Underhållsplan for a table of findings (ui/bearbeta/ai-check). The findings are grouped by building part, the six layers of a building
 * (Boverket's rapport 2024:26, the same as the climate declaration's, from the IFC class and IsExternal and LoadBearing), and by IFC class,
 * each with its photo (from the table's own files, or an image collection), condition, priority and recommended action, and the building's
 * facts from the model. The year of a measure follows a rule written in the template itself:
 *   {{#underhallsregel}}prioritet: urgent 0, high 1, medium 3, low 5; skick: critical 0, poor 1, fair 3, good 10; intervall: 5{{/underhallsregel}}
 * The year is the inspection's year plus the fewer of the years the priority and the condition give, and the next check comes the
 * interval's years after it; a level may be named by its code or by its word. Mustache renders the tag as nothing, since the context has
 * no value by its name. Every value is literal text for the Markdown (docgen/markdown.literal), so data never becomes markup.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/findings', ['docgen/template', 'docgen/markdown', 'data/datasets'], (template, markdown, datasets) => {
    const t = (k, p) => D.t(k, p);
    /** The built-in templates. */
    const REPORT = 'builtin-besiktning';
    const PLAN = 'builtin-underhall';
    /** The levels, the worst condition and the soonest priority first (the order of the findings in a group). */
    const CONDITIONS = ['critical', 'poor', 'fair', 'good'];
    const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
    const LAYERS = [1, 2, 3, 4, 5, 6];
    /** The rule when the template gives none: years after the inspection per priority and per condition, and years to the next check. */
    const RULE = Object.freeze({ priority: Object.freeze({ urgent: 0, high: 1, medium: 3, low: 5 }), condition: Object.freeze({ critical: 0, poor: 1, fair: 3, good: 10 }), interval: 5 });
    const RE_RULE = /\{\{#underhallsregel\}\}([\s\S]*?)\{\{\/underhallsregel\}\}/;
    /** The building's facts in the order of the list at the top of a document. */
    const FACTS = ['byggnad', 'byggnadsid', 'byggar', 'projekt', 'plats', 'vaningar', 'modell', 'fil', 'schema'];
    const PHOTO_WIDTH = 320;
    const MAX_ROWS = 1000;
    /** Drawn photos, kept while the table is unchanged so that the live preview does not draw them again. */
    const photos = new Map();
    const CACHE_SIZE = 60;
    const lit = markdown.literal;
    const given = (v) => v !== null && v !== undefined && String(v).trim() !== '';

    /** A table of findings saved by the AI panel. @param {any} meta */
    const isFindings = (meta) => !!(meta && meta.source && meta.source.tool === 'ai-check');
    /** Whether a table has the columns of findings. @param {string[]} names */
    const hasFindingColumns = (names) => Array.isArray(names) && names.includes('skick') && names.includes('prioritet');

    const keyOf = (s) => String(s).trim().toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o');
    /** A level by its code or by its word in the language of the app. @returns {string|null} */
    function levelOf(value, which) {
      const codes = which === 'priority' ? PRIORITIES : CONDITIONS;
      const v = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
      if (!v) return null;
      if (codes.includes(v)) return v;
      return codes.find((c) => t(`ai.check.${which}.${c}`).toLowerCase() === v) || null;
    }

    /**
     * The maintenance rule of a template (the tag underhallsregel), over the default: `prioritet` and `skick` list levels with their
     * years, `intervall` gives the years to the next check. A part it cannot read keeps the default.
     * @param {string} body @returns {{priority: Record<string, number>, condition: Record<string, number>, interval: number}}
     */
    function parseRule(body) {
      const rule = { priority: Object.assign({}, RULE.priority), condition: Object.assign({}, RULE.condition), interval: RULE.interval };
      const m = RE_RULE.exec(String(body || ''));
      if (!m) return rule;
      const years = (s) => { const n = /^\D*?(\d{1,3})\b/.exec(String(s)); return n ? Math.min(100, Number(n[1])) : null; };
      for (const part of m[1].split(/;|\n/)) {
        const kv = /^\s*([^:]+?)\s*:\s*([\s\S]*?)\s*$/.exec(part);
        if (!kv) continue;
        const k = keyOf(kv[1]);
        if (k === 'intervall' || k === 'interval') { const n = years(kv[2]); if (n !== null) rule.interval = n; continue; }
        const which = k === 'prioritet' || k === 'priority' ? 'priority' : k === 'skick' || k === 'condition' ? 'condition' : null;
        if (!which) continue;
        for (const entry of kv[2].split(',')) {
          const em = /^\s*(.*?)\s*[:=]?\s*(\d{1,3})\b/.exec(entry);
          const level = em ? levelOf(em[1], which) : null;
          if (level) rule[which][level] = Math.min(100, Number(em[2]));
        }
      }
      return rule;
    }

    /**
     * The year of a finding's measure after the rule: the inspection's year (the finding's date, else this year) plus the fewer of the
     * years its priority and its condition give; the next check the interval's years after. Null without a known level.
     * @param {{priority: Record<string, number>, condition: Record<string, number>, interval: number}} rule
     * @param {{priority?: string|null, condition?: string|null, date?: string|null}} f @param {number} [thisYear]
     * @returns {{year: number|null, next: number|null}}
     */
    function yearOf(rule, f, thisYear = new Date().getFullYear()) {
      const known = [rule.priority[f.priority || ''], rule.condition[f.condition || '']].filter((x) => Number.isFinite(x));
      if (!known.length) return { year: null, next: null };
      const m = /^(\d{4})/.exec(String(f.date || ''));
      const year = (m ? Number(m[1]) : thisYear) + Math.min(...known);
      return { year, next: year + rule.interval };
    }

    /**
     * The layer of a building (1–6) an element belongs to, by the climate declaration's rules (analysis/climate), from its IFC class and
     * the values of IsExternal and LoadBearing when known; null without a class or when the rules cannot say.
     * @param {string|null|undefined} cls @param {{IsExternal?: any, LoadBearing?: any}} [props]
     */
    function layerOf(cls, props = {}) {
      if (!given(cls)) return null;
      const climate = D.require('analysis/climate');
      return climate.classify({ cls: String(cls), external: climate.bool(props.IsExternal), loadBearing: climate.bool(props.LoadBearing) }).layer;
    }

    /** IsExternal and LoadBearing of some elements of a model. @returns {Promise<Map<number, {IsExternal?: any, LoadBearing?: any}>>} */
    async function elementProps(modelId, ids) {
      const out = new Map();
      const wanted = Array.from(new Set((ids || []).map(Number).filter((x) => Number.isInteger(x) && x > 0)));
      if (!modelId || !wanted.length) return out;
      try {
        const engine = (await datasets.ensureOpen(modelId)).engine;
        const r = await engine.exec(`select id, namn, varde from _properties where id in (${wanted.join(', ')}) and namn in ('IsExternal', 'LoadBearing')`);
        for (const [id, name, value] of (r[0] ? r[0].values : [])) {
          const o = out.get(Number(id)) || {};
          o[String(name)] = value;
          out.set(Number(id), o);
        }
      } catch (err) { D.log('findings', 'properties', err); }
      return out;
    }

    /**
     * The building's facts from a model dataset: the names of the building, the project and the site, BuildingID and YearOfConstruction
     * of Pset_BuildingCommon, the storeys, the dataset, the file and the schema. Null when the model is gone.
     * @param {string|null|undefined} modelId @returns {Promise<Record<string, string>|null>}
     */
    async function buildingFacts(modelId) {
      const meta = modelId ? await datasets.get(modelId).catch(() => null) : null;
      if (!meta) return null;
      const m = meta.model || {};
      const src = meta.source || {};
      const storeys = Array.isArray(m.storeys) ? m.storeys.map((s) => (typeof s === 'string' ? s : s && s.name)).filter(Boolean) : [];
      const facts = { byggnad: String(m.building || ''), byggnadsid: '', byggar: '', projekt: String(m.project || (src.cde && src.cde.projectName) || ''), plats: String(m.site || ''),
        vaningar: storeys.join(', '), modell: String(meta.name || ''), fil: String(m.headerName || m.file || src.fileName || ''), schema: String(m.schema || '') };
      try {
        const engine = (await datasets.ensureOpen(modelId)).engine;
        const r = await engine.exec("select p.namn, p.varde from _properties p join data d on d.id = p.id where lower(d.typ) = 'ifcbuilding' and p.namn in ('BuildingID', 'YearOfConstruction') limit 4");
        for (const [name, value] of (r[0] ? r[0].values : [])) if (given(value)) facts[name === 'BuildingID' ? 'byggnadsid' : 'byggar'] = String(value);
      } catch (_err) { /* a model without properties */ }
      return facts;
    }

    /** The element of a row in a few words: class, id and name, or its GlobalId. */
    function elementText(r) {
      const text = [r.ifc_klass, given(r.element_id) ? '#' + r.element_id : '', r.element_namn].filter(given).join(' ');
      return text || (given(r.element_guid) ? String(r.element_guid) : '');
    }

    /** A finding's photo as a picture in the document, drawn once per table version; '' when it cannot be found. */
    async function photoOf(ctx, name, drawn) {
      if (!given(name)) return '';
      const key = `${ctx._datasetId}|${(ctx._meta && ctx._meta.updatedAt) || ''}|${name}`;
      if (!drawn.has(key)) {
        let got = photos.get(key);
        if (!got) {
          got = await template.resolveImage({ name: String(name), opts: { bredd: PHOTO_WIDTH, hojd: 0 } }, ctx);
          if (got && got.png) { photos.set(key, got); while (photos.size > CACHE_SIZE) photos.delete(photos.keys().next().value); }
        }
        drawn.set(key, got && got.png ? (ctx._images.push(got), ctx._images.length - 1) : -1);
      }
      const at = drawn.get(key);
      return at < 0 ? '' : `\n${template.TOKEN}IMAGE:${at}${template.TOKEN}\n`;
    }

    /**
     * The template context of a table of findings: the dataset's own context (docgen/template.buildContext) and the findings one by one
     * (`fynd`), per building part (`byggdelar`), per IFC class (`klasser`), per year (`plan`) and in year order (`tidsplan`), the counts
     * per condition and priority, the building (`byggnad`, `fakta`) and the rule (`regel`).
     * @param {string} datasetId @param {any} [options] as buildContext's @param {string} [body] the template, for its rule
     */
    async function context(datasetId, options = {}, body = '') {
      const ctx = await template.buildContext(datasetId, Object.assign({ maxRows: MAX_ROWS }, options));
      const meta = ctx._meta || {};
      const src = meta.source || {};
      const rule = parseRule(body);
      const thisYear = new Date().getFullYear();
      const facts = src.building || (await buildingFacts(src.from)) || {};
      ctx._images = [];
      const drawn = new Map();
      const found = [];
      for (const [i, r] of (ctx._rows || []).entries()) {
        const priority = levelOf(r.prioritet, 'priority');
        const condition = levelOf(r.skick, 'condition');
        const when = yearOf(rule, { priority, condition, date: r.datum }, thisYear);
        const layer = LAYERS.includes(Number(r.byggdel)) && given(r.byggdel) ? Number(r.byggdel) : layerOf(r.ifc_klass);
        const lat = Number(r.lat); const lon = Number(r.lon);
        found.push({
          nr: String(i + 1), titel: lit(r.titel), beskrivning: lit(r.beskrivning), element: lit(elementText(r)), ifc_klass: lit(r.ifc_klass), element_namn: lit(r.element_namn),
          vaning: lit(r.vaning), guid: lit(r.element_guid), skick: lit(condition ? t('ai.check.condition.' + condition) : r.skick), skick_kod: condition || '',
          prioritet: lit(priority ? t('ai.check.priority.' + priority) : r.prioritet), prioritet_kod: priority || '', atgard: lit(r.atgard), datum: lit(r.datum), foto: lit(r.foto),
          plats: given(r.lat) && given(r.lon) && Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : '',
          byggdel: lit(layer ? t('climate.layer.' + layer) : t('doc.findings.layer.none')), byggdel_nr: layer ? String(layer) : '',
          ar: when.year === null ? '' : String(when.year), nasta_kontroll: when.next === null ? '' : String(when.next), intervall: String(rule.interval),
          bild: await photoOf(ctx, r.foto, drawn),
          _n: i, _layer: layer || null, _class: given(r.ifc_klass) ? String(r.ifc_klass) : '', _year: when.year,
          _p: priority ? PRIORITIES.indexOf(priority) : PRIORITIES.length, _c: condition ? CONDITIONS.indexOf(condition) : CONDITIONS.length,
        });
      }
      const order = (a, b) => a._p - b._p || a._c - b._c || a._n - b._n;
      const group = (keys, pick, name) => keys.map((k) => { const fynd = found.filter((f) => pick(f) === k).sort(order); return fynd.length ? { namn: name(k), nr: k === null ? '' : String(k), antal: template.fmt(fynd.length), fynd } : null; }).filter(Boolean);
      const classes = Array.from(new Set(found.map((f) => f._class).filter(Boolean))).sort((a, b) => a.localeCompare(b)).concat(['']);
      const years = Array.from(new Set(found.map((f) => f._year).filter((y) => y !== null))).sort((a, b) => a - b).concat([null]);
      const count = (codes, key, prefix) => codes.map((c) => ({ kod: c, ord: lit(t(prefix + c)), antal: found.filter((f) => f[key] === c).length })).filter((x) => x.antal).map((x) => Object.assign(x, { antal: template.fmt(x.antal) }));
      const dates = found.map((f) => String(f.datum)).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort();
      const words = (codes, table, prefix) => codes.map((c) => `${t(prefix + c)} ${table[c]}`).join(', ');
      const shown = Object.fromEntries(FACTS.map((k) => [k, lit(facts[k])]));
      return Object.assign(ctx, {
        fynd: found.slice(), antal_fynd: template.fmt(found.length),
        byggdelar: group(LAYERS.concat([null]), (f) => f._layer, (k) => lit(k === null ? t('doc.findings.layer.none') : t('climate.layer.' + k))),
        klasser: group(classes, (f) => f._class, (k) => lit(k || t('doc.findings.class.none'))),
        plan: group(years, (f) => f._year, (k) => (k === null ? lit(t('doc.findings.year.none')) : String(k))).map((g) => Object.assign(g, { ar: g.namn })),
        tidsplan: found.slice().sort((a, b) => Number(a._year === null) - Number(b._year === null) || (a._year || 0) - (b._year || 0) || order(a, b)),
        per_skick: count(CONDITIONS, 'skick_kod', 'ai.check.condition.'), per_prioritet: count(PRIORITIES, 'prioritet_kod', 'ai.check.priority.'),
        besiktningsdatum: !dates.length ? '' : dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`,
        byggnad: Object.assign({ namn: lit(facts.byggnad || facts.projekt || facts.modell || meta.name || '') }, shown),
        fakta: FACTS.filter((k) => given(facts[k])).map((k) => ({ namn: lit(t('doc.findings.fact.' + k)), varde: shown[k] })),
        regel: { prioritet: lit(words(PRIORITIES, rule.priority, 'ai.check.priority.')), skick: lit(words(CONDITIONS, rule.condition, 'ai.check.condition.')), intervall: String(rule.interval) },
      });
    }

    return { REPORT, PLAN, RULE, CONDITIONS, PRIORITIES, FACTS, isFindings, hasFindingColumns, parseRule, yearOf, layerOf, elementProps, buildingFacts, context };
  });
})();
