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
    /**
     * The provisions a new detailed plan reaches for first (BFS 2020:5, the catalogue's current ones), by their UUIDs in the copy
     * that ships with the app, so that they work without the network: the uses of kvartersmark, allmän plats and vattenområde, and
     * the property provisions most plans have (prickmark, korsmark, building area, heights, roof angle, plot size, exits, the
     * shore protection lifted). Any other provision of the catalogue is found with `search`.
     */
    const COMMON = {
      anvandning: [
        'f9e056a6-cda8-4b92-a15d-dc70d61dfa36', '5df5c910-50b0-4b57-80a4-d139115c3b73', 'ff8da58c-f23d-4de2-9b84-6f0c9d610a60', '9b78a950-1bb2-4046-98cf-9efbd5868323',
        'f78c4b15-1c4e-41b5-be60-41501d0f9ac7', 'a0f58fd5-a361-4002-a359-03474901c15f', '5856a456-06a8-4612-a987-c9e43cb22682', 'cea1a8c2-7fc9-4fb2-8b6f-944716a4aa55',
        '674b3f0e-d85a-4e8f-9888-6d2d1bb96ebb', '4016b3b7-d199-4e6c-99b4-c535ddf79cdc', '6591927c-27ef-4e64-ada6-613524f885ec', '54b2efa8-1c5b-467c-b125-fbe6c6269b47',
        '7f46c19a-343d-433e-9ff8-59679eed36d8', '2bda2a28-30c0-4e79-9fb1-41564e704ffd', '72d5f850-eae5-4cdc-afff-6bf8e1042d52', '494ba693-e059-4557-8004-2a53363ea080',
      ],
      egenskap: [
        'f63321f7-04a1-4e2c-9ab1-467a2f24a9bb', '9d3a354f-9305-42fb-8500-607c40f1d7cb', '2bd7f01b-ac79-45b4-a24d-093620e7e2f2', '1c38a293-b48c-4572-a4a7-5a5d27697ea1',
        'ee5f8de3-89b0-479a-a5cb-7439d40623e8', '05c9ec9d-65e2-4a64-a711-3fde76f1c4f8', '411d8c8f-2356-4a24-a342-4777592555f6', '1917c314-cc54-4a86-b757-106f1759ada5',
        '623a21a0-5d27-4b55-889f-b0841409894d', '00ddbe3f-9d34-4996-9fb6-1f8ee361c89a',
      ],
    };
    /**
     * The common provisions of a type ('anvandning' or 'egenskap') as catalogue rows, in the order above.
     * @param {string} typ @returns {Promise<any[]>}
     */
    async function common(typ) {
      const cat = await load();
      return (COMMON[typ] || []).map((id) => cat.byId.get(id)).filter(Boolean);
    }
    /** The fill colour for a colour name from the catalogue (or a use row), or null for uncoloured uses. */
    function colorFor(nameOrRow) {
      const name = nameOrRow && typeof nameOrRow === 'object' ? nameOrRow.farg : nameOrRow;
      return COLORS[String(name || '').trim().toLowerCase()] || null;
    }
    /** Short label of a provision type for lists and legends (i18n key). */
    function typeKey(typ) { return 'plan.type.' + (TYPES.includes(typ) ? typ : 'okand'); }

    return { ASSET, COLORS, KIND_STROKES, TYPES, COMMON, load, get, resolve, byDesignation, search, common, colorFor, designationKey, isCurrent, typeKey };
  });
})();
