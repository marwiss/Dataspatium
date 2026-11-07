// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Boverket's Planbestämmelsekatalogen (open data; source to be named) as shipped with the app: the compact copy built
 * by tools/plan_catalog.py from Boverket's workbook, embedded gzip+base64 under presets/plan/. Digital detailed plans
 * refer to provisions by the catalogue's UUID (`planbestammelsekatalogreferens`); this module resolves them to text,
 * designation, category, validity and the colour name of the use, and offers search for the provisions panel. The
 * colour names are Boverket's (the general advice to BFS 2020:5); the shades are the app's own.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/plan-catalog', [], () => {
    const ASSET = 'presets/plan/planbestammelsekatalogen.json';
    /** Boverket's colour names for uses → the app's shades (fill colours on the plan map). Uncoloured uses get no fill. */
    const COLORS = {
      'gul': '#f4e07a', 'brun': '#c9a47c', 'röd': '#e58c8c', 'orange': '#f1b56e', 'grön': '#8dc88b', 'ljusgrön': '#c9e6b8',
      'mörkgrön': '#5a9c6e', 'blågrön': '#80c3bd', 'grå': '#b4b8bd', 'ljusgrå': '#dadde1', 'blågrå': '#a7b9ca', 'blå': '#8fbde7',
      'ljusblå': '#c6def2', 'beige': '#e8dac0', 'rosa': '#f0b9d0', 'lila': '#c4a9db', 'cerise': '#e2679f',
    };
    /** Line colours for provision kinds other than use (property and administrative provisions draw as outlines). */
    const KIND_STROKES = { anvandning: '#4a4f57', egenskap: '#1f6fb2', administrativ: '#8a3ffc', overgang: '#777c84', plan: '#111111' };
    const TYPES = ['anvandning', 'egenskap', 'administrativ', 'overgang'];
    /** @type {Promise<any>|null} */ let loading = null;

    /** The parsed catalogue: rows as objects plus indexes by uuid, designation and code. */
    async function load() {
      if (!loading) {
        loading = (async () => {
          const text = await D.assets.loadText(ASSET);
          const raw = JSON.parse(text);
          const fields = raw.fields;
          const rows = raw.rows.map((r) => { const o = {}; fields.forEach((f, i) => { o[f] = r[i]; }); return o; });
          const byId = new Map(); const byDesignation = new Map(); const byCode = new Map();
          for (const row of rows) {
            byId.set(row.uuid, row);
            if (row.kod) byCode.set(row.kod, row);
            const key = designationKey(row.beteckning);
            if (key) { if (!byDesignation.has(key)) byDesignation.set(key, []); byDesignation.get(key).push(row); }
          }
          return { release: raw.release, published: raw.published, source: raw.source, license: raw.license, url: raw.url, counts: raw.counts, rows, byId, byDesignation, byCode };
        })().catch((err) => { loading = null; throw err; });
      }
      return loading;
    }
    /** `B#`, `e1`, `GATA` → `b`, `e`, `gata`: the designation without index digits and the placeholder mark. */
    function designationKey(s) {
      return String(s || '').replace(/#/g, '').replace(/\d+$/, '').trim().toLowerCase();
    }
    /** True when a provision is in force today (no end date, or "Pågående"). */
    function isCurrent(row) { return !row.slut || /pågående/i.test(row.slut); }

    /** @param {string} uuid @returns {Promise<any|null>} */
    async function get(uuid) {
      const cat = await load();
      return cat.byId.get(String(uuid || '').toLowerCase().replace(/[{}]/g, '')) || null;
    }
    /** The provision a reference points at, following "ersätts av" to the current one when asked. */
    async function resolve(uuid, options = {}) {
      const cat = await load();
      let row = cat.byId.get(String(uuid || '').toLowerCase().replace(/[{}]/g, '')) || null;
      const seen = new Set();
      while (options.follow && row && row.ersattsAv && !isCurrent(row) && !seen.has(row.uuid)) { seen.add(row.uuid); row = cat.byId.get(row.ersattsAv) || row; }
      return row;
    }
    /**
     * Provisions with a designation (for plans without catalogue references): `B`, `GATA`, `e1`…, optionally limited to a
     * use form (Kvartersmark, Allmän plats, Vattenområde) and to those in force.
     */
    async function byDesignation(designation, options = {}) {
      const cat = await load();
      let list = cat.byDesignation.get(designationKey(designation)) || [];
      if (options.form) list = list.filter((r) => !r.form || r.form.toLowerCase() === String(options.form).toLowerCase());
      if (options.typ) list = list.filter((r) => r.typ === options.typ);
      if (options.current !== false) { const cur = list.filter(isCurrent); if (cur.length) list = cur; }
      return list;
    }
    /**
     * Free-text search over designation, formulation, category and code.
     * @param {string} query @param {{typ?: string, form?: string, current?: boolean, limit?: number}} [options]
     */
    async function search(query, options = {}) {
      const cat = await load();
      const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
      const out = [];
      for (const r of cat.rows) {
        if (options.typ && r.typ !== options.typ) continue;
        if (options.form && r.form.toLowerCase() !== String(options.form).toLowerCase()) continue;
        if (options.current && !isCurrent(r)) continue;
        if (words.length) {
          const hay = `${r.beteckning} ${r.formulering} ${r.kategori} ${r.underkategori} ${r.kod} ${r.form}`.toLowerCase();
          if (!words.every((w) => hay.includes(w))) continue;
        }
        out.push(r);
        if (out.length >= (options.limit || 200)) break;
      }
      return out;
    }
    /** The fill colour for a colour name from the catalogue (or a use row), or null for uncoloured uses. */
    function colorFor(nameOrRow) {
      const name = nameOrRow && typeof nameOrRow === 'object' ? nameOrRow.farg : nameOrRow;
      return COLORS[String(name || '').trim().toLowerCase()] || null;
    }
    /** Short label of a provision type for lists and legends (i18n key). */
    function typeKey(typ) { return 'plan.type.' + (TYPES.includes(typ) ? typ : 'okand'); }

    return { ASSET, COLORS, KIND_STROKES, TYPES, load, get, resolve, byDesignation, search, colorFor, designationKey, isCurrent, typeKey };
  });
})();
