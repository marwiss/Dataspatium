// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A new, empty digital comprehensive plan (B-78): a plan dataset (kind plan, slag oversiktsplan) with the columns of Boverket's
 * ÖP model as data/plan-delivery reads it (plan.OP_COLUMNS), the empty side tables `_sections` and `_section_links`, and
 * `_meta.plan` with a new objektidentitet, the name, the municipality, the coordinate system (SWEREF 99 TM or a local SWEREF 99
 * zone) and the description the AI builds from. With a Swedish municipality chosen the plan may get the municipality's boundary
 * as its plan geometry (tema plangeometri), from the boundaries that ship with the app (data/boundaries, SCB's under CC0), so
 * that the map has its extent; nothing is fetched. The plan view, its edit mode, the AI panel and the delivery export take it as
 * they take a delivered plan.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/plan-new', ['data/plan', 'data/plan-edit', 'data/plan-delivery', 'data/dataset-files', 'data/geo', 'data/boundaries'], (plan, planEdit, delivery, dsFiles, geo, boundaries) => {
    /** The coordinate systems offered: SWEREF 99 TM (the default, and the delivery's) and the twelve local zones. */
    const CRS = [3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3015, 3016, 3017, 3018];
    const DEFAULT_CRS = 3006;
    /** The most characters of the description kept with the plan. */
    const MAX_DESCRIPTION = 8000;
    const clean = (v, max = 255) => String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

    /**
     * Sweden's municipalities as the app ships them: name and code, by name.
     * @returns {Promise<Array<{name: string, code: string}>>}
     */
    async function municipalities() {
      const list = await boundaries.features('kommuner');
      return list.map((f) => ({ name: String(f.name), code: String(f.code) })).filter((m) => m.name && m.code).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    }

    /**
     * The settings of a new plan with the defaults filled in, or an error the person can act on.
     * @param {{name?: string, kommun?: string, kommunkod?: string, crs?: string|number, boundary?: boolean, description?: string}} input
     * @returns {{name: string, kommun: string, kommunkod: string, crs: string, boundary: boolean, description: string}}
     */
    function settings(input = {}) {
      const code = input.crs === undefined || input.crs === null || input.crs === '' ? DEFAULT_CRS : geo.crsCode(input.crs);
      if (!code || !CRS.includes(code)) throw new Error(D.t('newplan.err.crs', { crs: String(input.crs) }));
      const kommun = clean(input.kommun);
      const kommunkod = clean(input.kommunkod, 8);
      if (kommunkod && !/^\d{4}$/.test(kommunkod)) throw new Error(D.t('newplan.err.code', { code: kommunkod }));
      const description = String(input.description || '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_DESCRIPTION);
      return {
        name: clean(input.name) || (kommun ? D.t('newplan.default.name.kommun', { kommun }) : D.t('newplan.default.name')),
        kommun, kommunkod, crs: 'EPSG:' + code, boundary: input.boundary !== false && !!kommunkod, description,
      };
    }

    /** The municipality's boundary as the plan's plan geometry, or null when the app has none for the code. */
    async function boundaryRow(s) {
      const hit = (await boundaries.features('kommuner')).find((f) => String(f.code) === s.kommunkod);
      if (!hit || !hit.geometry) return null;
      const g = planEdit.checkGeometry(hit.geometry);
      return { objektid: planEdit.newId(), tema: 'plangeometri', innehallstyp: plan.OP_CATEGORIES.plangeometri, namn: s.kommun || String(hit.name || ''), geometrityp: g.type, geometri: JSON.stringify(g), lager: '', fil: '', ordning: 0 };
    }

    /**
     * Make a new, empty comprehensive plan as a dataset. Asks nothing and fetches nothing.
     * @param {Parameters<typeof settings>[0]} input
     * @returns {Promise<any>} the dataset's meta
     */
    async function create(input) {
      const s = settings(input);
      // The municipality's name from the code when only the code is given.
      if (s.kommunkod && !s.kommun) { const m = (await municipalities()).find((x) => x.code === s.kommunkod); if (m) { s.kommun = m.name; if (!clean(input.name)) s.name = D.t('newplan.default.name.kommun', { kommun: m.name }); } }
      const rows = [];
      if (s.boundary) { const row = await boundaryRow(s); if (row) rows.push(row); }
      const antal = {};
      for (const r of rows) antal[r.tema] = (antal[r.tema] || 0) + 1;
      const info = {
        slag: 'oversiktsplan', objektid: planEdit.newId(), namn: s.name, kommun: s.kommun, kommunkod: s.kommunkod, status: '', datumPaborjat: new Date().toISOString().slice(0, 10),
        digitaltUrsprung: true, format: 'oversiktsplan-ny', crs: s.crs, beskrivning: s.description, antal, lager: [],
      };
      return dsFiles.createDataset({
        name: s.name, kind: 'plan', columns: plan.OP_COLUMNS, rows: plan.toRows(rows, plan.OP_COLUMNS),
        source: { kind: 'new', format: 'oversiktsplan', crs: s.crs, createdAt: new Date().toISOString() },
        description: D.t('newplan.description', { crs: geo.crsText(s.crs) }),
        tables: [{ name: delivery.SECTIONS, columns: delivery.SECTION_COLUMNS, rows: [], index: ['avsnitt'] }, { name: delivery.LINKS, columns: delivery.LINK_COLUMNS, rows: [], index: ['avsnitt', 'objektid'] }],
        meta: { plan: info },
      });
    }

    return { CRS, DEFAULT_CRS, MAX_DESCRIPTION, municipalities, settings, create };
  });
})();
