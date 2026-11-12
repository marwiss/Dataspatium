// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * buildingSMART Data Dictionary (bSDD, decision F41 a): the open read methods of its REST API, for the project profile and the AI's
 * tool search_bsdd. Every call goes through api/http, which asks the person's consent for the host once (purpose api) and never
 * runs before an action of theirs. The answers are normalised to small objects, since the service's forms vary between versions;
 * the base address can be replaced for tests. On 2026-11-12 the service answered without CORS headers (no
 * Access-Control-Allow-Origin, for a GET or a preflight, from the origin null or the Pages origin), so a browser may not be allowed
 * to read its answers; the tests answer from a stub.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/bsdd', ['api/http'], (http) => {
    const DEFAULT_BASE = 'https://api.bsdd.buildingsmart.org';
    const HOST = 'api.bsdd.buildingsmart.org';
    /**
     * The dictionaries the AI's search_bsdd may search (decision B-59.1): only those whose licence was read at the licence URL the
     * service gives for it, and that may be used without a fee or an agreement. bSDD's own licence field is not enough, see
     * EXCLUDED_DICTIONARIES. Add an entry only after reading the licence at its licence URL, and write the day it was read.
     */
    const OPEN_DICTIONARIES = Object.freeze([
      { uri: 'https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3', name: 'IFC', version: '4.3', source: 'buildingSMART International', license: 'CC BY-ND 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nd/4.0/legalcode', read: '2026-11-12' },
      { uri: 'https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1', name: 'Uniclass 2015', version: '1', source: 'NBS', license: 'CC BY-ND 4.0', licenseUrl: 'https://technical.buildingsmart.org/services/bsdd/license/', read: '2026-11-12' },
      { uri: 'https://identifier.buildingsmart.org/uri/etim/etim/10.1', name: 'ETIM', version: '10.1', source: 'ETIM International', license: 'ODC-By', licenseUrl: 'https://opendatacommons.org/licenses/by/1-0/', read: '2026-11-12' },
    ].map((d) => Object.freeze(d)));
    /** Dictionaries kept out on purpose, with the reason, so that nobody adds them to OPEN_DICTIONARIES on bSDD's label alone. */
    const EXCLUDED_DICTIONARIES = Object.freeze([
      Object.freeze({ uri: 'https://identifier.buildingsmart.org/uri/molio/cciconstruction/1.0', name: 'CCI Construction', reason: 'bSDD labels it MIT, but its licence URL is Molio\'s restrictive end-user licence' }),
    ]);
    let base = DEFAULT_BASE;
    /** Another base address (tests); null restores the service's. @param {string|null} url */
    function setBase(url) { base = String(url || DEFAULT_BASE).replace(/\/+$/, ''); }
    const text = (v) => (v === null || v === undefined ? '' : String(v));

    /** A GET with query parameters; a list is sent as the parameter repeated, which is how the service reads a list. */
    async function get(path, params = {}, options = {}) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) { for (const item of v) if (item !== undefined && item !== null && item !== '') q.append(k, String(item)); } else if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      }
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
     * Classes whose names match a text, in the given dictionaries or all: uri, name, code, description, dictionary. The service reads
     * the dictionaries as the parameter DictionaryUris repeated; joined by commas it ignored them (2026-11-12).
     * @param {string} query @param {{dictionaries?: string[], limit?: number, signal?: AbortSignal}} [options]
     */
    async function search(query, options = {}) {
      const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
      /** @type {Record<string, any>} */
      const params = { SearchText: String(query || '').trim(), TypeFilter: 'Classes', Limit: limit };
      if (options.dictionaries && options.dictionaries.length) params.DictionaryUris = options.dictionaries.slice();
      const out = (await get('/api/TextSearch/v1', params, options)) || {};
      const dicts = Array.isArray(out.dictionaries) ? out.dictionaries : [];
      const classes = Array.isArray(out.classes) ? out.classes : dicts.flatMap((d) => (d.classes || []).map((c) => Object.assign({ dictionaryName: d.dictionaryName || d.name, dictionaryUri: d.dictionaryUri || d.uri }, c)));
      return classes.slice(0, limit).map((c) => ({ uri: text(c.uri), name: text(c.name), code: text(c.code || c.referenceCode), description: text(c.description || c.definition), dictionary: text(c.dictionaryName), dictionaryUri: text(c.dictionaryUri) })).filter((c) => c.uri);
    }
    /**
     * The open dictionary a class of a search belongs to, or null: its uri lies under the dictionary's, and the dictionary the
     * service names for it, if any, is that one.
     * @param {{uri: string, dictionaryUri?: string}} cls
     */
    function openDictionaryOf(cls) {
      const uri = text(cls && cls.uri);
      const d = OPEN_DICTIONARIES.find((x) => uri.startsWith(x.uri + '/'));
      if (!d || (cls.dictionaryUri && cls.dictionaryUri !== d.uri) || EXCLUDED_DICTIONARIES.some((x) => x.uri === d.uri)) return null;
      return d;
    }
    /** One class by its uri, with its properties. @param {string} uri @param {{signal?: AbortSignal}} [options] */
    async function classOf(uri, options = {}) {
      const out = (await get('/api/Class/v1', { Uri: uri, IncludeClassProperties: true }, options)) || {};
      return { uri: text(out.uri || uri), name: text(out.name), code: text(out.code || out.referenceCode), definition: text(out.definition || out.description), dictionary: text(out.dictionaryName || (out.dictionary && out.dictionary.name)),
        properties: (Array.isArray(out.classProperties) ? out.classProperties : []).map((p) => ({ name: text(p.name), propertySet: text(p.propertySet), dataType: text(p.dataType), uri: text(p.propertyUri || p.uri) })) };
    }
    return { DEFAULT_BASE, HOST, OPEN_DICTIONARIES, EXCLUDED_DICTIONARIES, setBase, dictionaries, search, openDictionaryOf, classOf };
  });
})();
