// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Boverket's climate database (klimatdatabasen, open data under Boverket's terms of use, dnr 5913/2024: free use with Boverket and
 * the climate database named as the source). It is read through the preset boverket-klimatdatabas, so the address lives in one
 * place: the latest version, then every resource of that version in one answer (about 0.9 MB). Nothing is fetched before the
 * person presses the button, and api/http asks the consent for the purpose api and the host api.boverket.se. The answer is kept
 * in the browser in a compact form (per resource: names, unit, density or mass per area, waste factor, Boverket's own category
 * with its code, and GWP-GHG for A1–A3 typical and conservative, A4 and A5.1) with its version. Energy resources (MJ, kWh) are
 * left out: they are not building products.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/klimatdatabas', ['api/connectors', 'api/runner', 'platform/storage/idb'], (connectors, runner, idb) => {
    const CONNECTOR = 'boverket-klimatdatabas';
    const CACHE_KEY = 'klimat:databas';
    /** The units a building product is counted in. */
    const UNITS = ['kg', 'm²'];
    /** @type {any} */ let override = null;

    /** Another connector instead of the preset (tests point it at a virtual address); null restores the preset. @param {any} connector */
    function setConnector(connector) { override = connector || null; }
    async function connector() {
      const c = override || (await connectors.get(CONNECTOR));
      if (!c) throw new Error(D.t('climate.err.noconnector'));
      return c;
    }
    function endpoint(c, id) {
      const ep = (c.endpoints || []).find((e) => e.id === id);
      if (!ep) throw new Error(D.t('climate.err.noconnector'));
      return ep;
    }
    const number = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    /** The value of one module of a resource's GWP-GHG. */
    function moduleValue(r, code) {
      for (const item of Array.isArray(r.DataItems) ? r.DataItems : []) {
        if (!/^GWP/i.test(String(item.PropertyCode || ''))) continue;
        const hit = (Array.isArray(item.DataValueItems) ? item.DataValueItems : []).find((d) => String(d.DataModuleCode || '').trim().toUpperCase() === code);
        if (hit) return number(hit.Value);
      }
      return null;
    }
    /**
     * The database in the form the app keeps: one entry per building product, with the version and publication date.
     * @param {any} data the answer of GetAllResources @param {string} [version]
     * @returns {{version: string, published: string, fetchedAt: string, resources: any[]}}
     */
    function compact(data, version) {
      const list = data && Array.isArray(data.Resources) ? data.Resources : [];
      const resources = [];
      for (const r of list) {
        const unit = String(r.InventoryUnit || '').trim();
        if (!UNITS.includes(unit)) continue;
        const conversion = (field) => { const c = (Array.isArray(r.Conversions) ? r.Conversions : []).find((x) => String(x.Field || '').toLowerCase() === field); return c ? number(c.Value) : null; };
        const category = (Array.isArray(r.Categories) ? r.Categories : []).find((c) => c.ClassificationType === 'Boverket');
        const names = r.Names || {};
        const typical = moduleValue(r, 'A1-A3 TYPICAL'); const conservative = moduleValue(r, 'A1-A3 CONSERVATIVE');
        if (typical === null && conservative === null) continue;
        resources.push({
          id: String(r.ResourceId), name: String(names.SV || r.Name || ''), nameEn: String(names.EN || ''), synonyms: String(r.Synonyms || ''), unit,
          density: conversion('volume'), areal: conversion('area'), waste: number(r.WasteFactor), category: category ? String(category.Text || '') : '', group: category ? String(category.Code || '') : '',
          a1a3: { typical: typical === null ? conservative : typical, conservative: conservative === null ? typical : conservative }, a4: moduleValue(r, 'A4'), a5: moduleValue(r, 'A5.1'),
        });
      }
      return { version: String(version || (data && data.Version) || ''), published: String((data && data.PublishedDate) || ''), fetchedAt: new Date().toISOString(), resources };
    }
    /**
     * Fetch the latest version of the database from Boverket and keep it: only on the person's action, after consent.
     * @param {{signal?: AbortSignal}} [options] @returns {Promise<{version: string, published: string, fetchedAt: string, resources: any[]}>}
     */
    async function fetchLatest(options = {}) {
      const c = await connector();
      const latest = await runner.fetchTable(c, endpoint(c, 'senaste-version'), { culture: 'sv' }, { firstPageOnly: true, signal: options.signal });
      const version = String(((latest.meta && latest.meta.firstData) || {}).Version || '').trim();
      if (!/^\d+(\.\d+)*$/.test(version)) throw new Error(D.t('climate.err.version'));
      const all = await runner.fetchTable(c, endpoint(c, 'resurser'), { version, culture: 'sv' }, { firstPageOnly: true, signal: options.signal });
      const db = compact(all.meta && all.meta.firstData, version);
      if (!db.resources.length) throw new Error(D.t('climate.err.empty'));
      await idb.setSetting(CACHE_KEY, db);
      return db;
    }
    /** The database kept in the browser, or null; never asks the network. */
    async function cached() { return (await idb.getSetting(CACHE_KEY, null)) || null; }
    /** Keep a database (the tests put one there). @param {any} db */
    async function store(db) { await idb.setSetting(CACHE_KEY, db); return db; }
    /** Forget the kept database. */
    async function forget() { await idb.deleteSetting(CACHE_KEY); }

    return { CONNECTOR, setConnector, compact, fetchLatest, cached, store, forget };
  });
})();
