// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * buildingSMART Data Dictionary (bSDD, decision F41 a): the open read methods of its REST API, for the project profile and the AI's
 * tool search_bsdd. Every call goes through api/http, which asks the person's consent for the host once (purpose api) and never
 * runs before an action of theirs. The answers are normalised to small objects, since the service's forms vary between versions;
 * the base address can be replaced for tests. The service answered empty on 2026-11-11, so CORS from file:// is still unverified.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/bsdd', ['api/http'], (http) => {
    const DEFAULT_BASE = 'https://api.bsdd.buildingsmart.org';
    const HOST = 'api.bsdd.buildingsmart.org';
    let base = DEFAULT_BASE;
    /** Another base address (tests); null restores the service's. @param {string|null} url */
    function setBase(url) { base = String(url || DEFAULT_BASE).replace(/\/+$/, ''); }
    const text = (v) => (v === null || v === undefined ? '' : String(v));

    async function get(path, params = {}, options = {}) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      const qs = q.toString();
      const res = await http.request({ url: base + path + (qs ? '?' + qs : ''), method: 'GET', headers: { Accept: 'application/json' }, signal: options.signal, retries: 0, timeoutMs: 30000 });
      if (!res.ok) throw new Error(D.t('bsdd.err.http', { status: res.status }));
      if (!String(res.text || '').trim()) throw new Error(D.t('bsdd.err.empty'));
      try { return JSON.parse(res.text); } catch (_e) { throw new Error(D.t('bsdd.err.empty')); }
    }
    /** The dictionaries the service lists: uri, name, organisation, version, license. @param {{signal?: AbortSignal}} [options] */
    async function dictionaries(options = {}) {
      const out = await get('/api/Dictionary/v1', { IncludeTestDictionaries: false }, options);
      const list = Array.isArray(out) ? out : (out && (out.dictionaries || out.items)) || [];
      return list.map((d) => ({ uri: text(d.uri), name: text(d.name), organization: text(d.organizationNameOwner || d.organizationCodeOwner), version: text(d.version), license: text(d.license), languages: Array.isArray(d.availableLanguages) ? d.availableLanguages.map(text) : [] })).filter((d) => d.uri);
    }
    /**
     * Classes whose names match a text, in the given dictionaries or all: uri, name, code, description, dictionary.
     * @param {string} query @param {{dictionaries?: string[], limit?: number, signal?: AbortSignal}} [options]
     */
    async function search(query, options = {}) {
      const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
      const params = { SearchText: String(query || '').trim(), TypeFilter: 'Classes', Limit: limit };
      if (options.dictionaries && options.dictionaries.length) params.DictionaryUris = options.dictionaries.join(',');
      const out = (await get('/api/TextSearch/v1', params, options)) || {};
      const dicts = Array.isArray(out.dictionaries) ? out.dictionaries : [];
      const classes = Array.isArray(out.classes) ? out.classes : dicts.flatMap((d) => (d.classes || []).map((c) => Object.assign({ dictionaryName: d.dictionaryName || d.name, dictionaryUri: d.dictionaryUri || d.uri }, c)));
      return classes.slice(0, limit).map((c) => ({ uri: text(c.uri), name: text(c.name), code: text(c.code || c.referenceCode), description: text(c.description || c.definition), dictionary: text(c.dictionaryName), dictionaryUri: text(c.dictionaryUri) })).filter((c) => c.uri);
    }
    /** One class by its uri, with its properties. @param {string} uri @param {{signal?: AbortSignal}} [options] */
    async function classOf(uri, options = {}) {
      const out = (await get('/api/Class/v1', { Uri: uri, IncludeClassProperties: true }, options)) || {};
      return { uri: text(out.uri || uri), name: text(out.name), code: text(out.code || out.referenceCode), definition: text(out.definition || out.description), dictionary: text(out.dictionaryName || (out.dictionary && out.dictionary.name)),
        properties: (Array.isArray(out.classProperties) ? out.classProperties : []).map((p) => ({ name: text(p.name), propertySet: text(p.propertySet), dataType: text(p.dataType), uri: text(p.propertyUri || p.uri) })) };
    }
    return { DEFAULT_BASE, HOST, setBase, dictionaries, search, classOf };
  });
})();
