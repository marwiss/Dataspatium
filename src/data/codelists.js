// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Standard code lists that ship with the app, as value labels: SNI, SSYK, NACE, ISCED, COFOG, NUTS, the Nordic equivalents,
 * countries, and municipalities through the boundaries. The app sees which column holds which list from its values and
 * suggests the labels; a short code is only taken for a list when the column's name agrees. Nothing is fetched.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/codelists', ['data/datasets', 'data/boundaries'], (datasets, boundaries) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const MAX_VALUES = 5000;
    const MIN_WITHOUT_NAME = 8;
    const ISO_ALPHA2 = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
    /**
     * The lists. `hint` is what a column holding the list is usually called; `needsName` means that the codes are so short that
     * the values alone say nothing.
     */
    const LISTS = [
      { id: 'sni2007', name: 'SNI 2007', hint: /sni|naring|näring|bransch|industry/i },
      { id: 'ssyk2012', name: 'SSYK 2012', hint: /ssyk|yrke|occupation/i },
      { id: 'nace', name: 'NACE Rev. 2', hint: /nace|isat|ísat/i, needsName: true },
      { id: 'isced', name: 'ISCED 2011', hint: /isced|utbild/i, needsName: true },
      { id: 'cofog', name: 'COFOG', hint: /cofog|funktion/i, needsName: true },
      { id: 'nuts', name: 'NUTS', hint: /nuts|^geo$/i, needsName: true },
      { id: 'sn2007', name: 'SN2007', hint: /sn2007|naering|næring/i },
      { id: 'styrk08', name: 'STYRK-08', hint: /styrk|yrke/i },
      { id: 'db07', name: 'DB07', hint: /db07|branche/i },
      { id: 'tol2008', name: 'TOL 2008', hint: /tol|toimiala/i },
      { id: 'ammatti2010', name: 'Ammattiluokitus 2010', hint: /ammatti/i },
      { id: 'iso3166', name: 'ISO 3166', hint: /^(land|landskod|country|country_?code|maa|lönd|nation|nationalitet|medborgarskap)$/i, needsName: true, computed: true },
      { id: 'kommuner', name: 'Kommuner (SE)', boundary: 'kommuner', hint: /kommun/i },
      { id: 'lan', name: 'Län (SE)', boundary: 'lan', hint: /^l(ä|a)n/i, needsName: true },
      { id: 'kommuner-no', name: 'Kommuner (NO)', boundary: 'kommuner-no', hint: /kommune/i, needsName: true },
      { id: 'kommuner-dk', name: 'Kommuner (DK)', boundary: 'kommuner-dk', hint: /kommune/i, needsName: true },
      { id: 'kunnat-fi', name: 'Kunnat (FI)', boundary: 'kunnat-fi', hint: /kunta/i, needsName: true },
    ];
    /** @type {Map<string, Promise<{languages: string[], codes: Map<string, string[]>, source: string, license: string}>>} */
    const loaded = new Map();

    /** Country names come from the browser, in the user's language. */
    function countries() {
      const language = D.require('ui/i18n').language();
      let names = null;
      try { names = new Intl.DisplayNames([language], { type: 'region' }); } catch (_err) { names = null; }
      return ISO_ALPHA2.map((code) => [code, names ? names.of(code) || code : code]);
    }
    async function read(list) {
      if (list.computed) return { languages: [D.require('ui/i18n').language()], codes: new Map(countries().map((r) => [r[0], r.slice(1)])), source: 'ISO', license: '' };
      if (list.boundary) {
        const features = await boundaries.features(list.boundary);
        return { languages: ['sv'], codes: new Map(features.filter((f) => f.code).map((f) => [String(f.code), [String(f.name)]])), source: 'presets/geo', license: '' };
      }
      const data = JSON.parse(await D.assets.loadText(`presets/kodlistor/${list.id}.json`));
      return { languages: data.languages, codes: new Map(data.codes.map((r) => [String(r[0]), r.slice(1)])), source: data.source, license: data.license };
    }
    /** @param {string} id */
    function load(id) {
      const list = LISTS.find((x) => x.id === id);
      if (!list) throw new Error('unknown list ' + id);
      // Country names follow the language, so they are made each time.
      if (list.computed) return read(list);
      if (!loaded.has(id)) loaded.set(id, read(list).catch((err) => { loaded.delete(id); throw err; }));
      return loaded.get(id);
    }
    /** The label in the user's language, then English, then whatever there is. */
    function labelFrom(row, languages) {
      const language = D.require('ui/i18n').language();
      for (const want of [language, 'en']) {
        const at = languages.indexOf(want);
        if (at >= 0 && row[at]) return row[at];
      }
      return row.find(Boolean) || '';
    }
    /** A value as a list writes it: municipal codes keep their leading zero even where a column has lost it. */
    function codeIn(codes, value) {
      if (codes.has(value)) return value;
      for (const width of [2, 4]) { const padded = value.padStart(width, '0'); if (codes.has(padded)) return padded; }
      return null;
    }
    async function distinctValues(handle, column) {
      const r = await handle.engine.exec(`select distinct cast(${q(column)} as text) from data where ${q(column)} is not null and ${q(column)} != '' limit ${MAX_VALUES + 1}`);
      return (r[0] ? r[0].values : []).map((row) => String(row[0]));
    }
    /**
     * Which columns look like a known list.
     * @param {string} id @returns {Promise<Array<{column: string, list: string, name: string, coverage: number, values: number}>>}
     */
    async function suggest(id) {
      const handle = await datasets.ensureOpen(id);
      const out = [];
      for (const c of handle.columns) {
        if (c.valueLabels || (c.type !== 'text' && c.type !== 'integer')) continue;
        const values = await distinctValues(handle, c.name);
        if (!values.length || values.length > MAX_VALUES) continue;
        let best = null;
        for (const list of LISTS) {
          const named = list.hint.test(c.name);
          if (list.needsName && !named) continue;
          if (!named && (values.length < MIN_WITHOUT_NAME || c.type !== 'text')) continue;
          const { codes } = await load(list.id);
          const known = values.filter((v) => codeIn(codes, v) !== null).length;
          const coverage = known / values.length;
          if (coverage < (named ? 0.8 : 0.95)) continue;
          const score = coverage + (named ? 1 : 0);
          if (!best || score > best.score) best = { score, column: c.name, list: list.id, name: list.name, coverage, values: values.length };
        }
        if (best) { delete best.score; out.push(best); }
      }
      return out;
    }
    /**
     * The labels for the values a column holds, as the step for value labels takes them.
     * @param {string} id @param {string} column @param {string} listId @returns {Promise<string>} lines of "code = label"
     */
    async function labelLines(id, column, listId) {
      const handle = await datasets.ensureOpen(id);
      const { codes, languages } = await load(listId);
      const lines = [];
      for (const value of await distinctValues(handle, column)) {
        const code = codeIn(codes, value);
        if (code !== null) lines.push(`${value} = ${labelFrom(codes.get(code), languages)}`);
      }
      return lines.join('\n');
    }
    /**
     * Set the labels of a column from a list. One step in the recipe, so it can be undone. The values do not change.
     * @param {string} id @param {string} column @param {string} listId @returns {Promise<{labels: number}>}
     */
    async function apply(id, column, listId) {
      return D.require('data/recipes').apply(id, 'set_value_labels', { column, labels: await labelLines(id, column, listId) });
    }

    return { LISTS, load, suggest, labelLines, apply };
  });
})();
