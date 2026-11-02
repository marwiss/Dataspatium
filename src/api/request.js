// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Build HTTP requests from a connector, an endpoint and parameter values: {name} substitution in
 * paths, query strings, headers and JSON bodies; defaults, templates and typed coercion.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/request', [], () => {
    const PLACEHOLDER = /\{([a-zA-Z0-9_.-]+)\}/g;

    function coerce(param, value) {
      if (value === undefined || value === null) return value;
      switch (param.type) {
        case 'number': { if (value === '') return undefined; const n = Number(String(value).replace(',', '.')); if (!Number.isFinite(n)) throw new Error(`${param.label || param.name} måste vara ett tal.`); return n; }
        case 'boolean': return value === true || value === 'true' || value === 1 || value === '1';
        case 'multi': return Array.isArray(value) ? value.map(String).filter((v) => v !== '') : String(value).split(',').map((s) => s.trim()).filter(Boolean);
        case 'querylines': return typeof value === 'string' ? value : String(value || '');
        default: return typeof value === 'string' ? value : (Array.isArray(value) ? value.join(param.join || ',') : String(value));
      }
    }
    function isEmpty(v) { return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0); }

    /** Substitute {name} placeholders with (optionally encoded) values. Unknown placeholders stay. */
    function substitute(template, values, encode) {
      return String(template).replace(PLACEHOLDER, (m, name) => {
        const v = values[name];
        if (v === undefined || v === null) return m;
        const s = Array.isArray(v) ? v.join(',') : String(v);
        return encode ? encode(s) : s;
      });
    }
    const encodePathValue = (s) => encodeURIComponent(s).replace(/%2C/gi, ',').replace(/%3A/gi, ':');

    /**
     * Apply defaults, coerce types, evaluate templates and check required parameters.
     * @returns {Record<string, any>} values by param name (only params present in the endpoint)
     */
    function normalizeParams(endpoint, input = {}) {
      const values = {};
      const params = endpoint.params || [];
      for (const p of params) {
        if (p.template) continue;
        let v = input[p.name];
        if (isEmpty(v) && p.default !== undefined) v = p.default;
        v = coerce(p, v);
        if (!isEmpty(v)) values[p.name] = v;
        else if (p.required) throw new Error(`Fyll i ${p.label || p.name}.`);
      }
      for (const p of params) if (p.template) {
        const v = substitute(p.template, values, null);
        if (!/\{[a-zA-Z0-9_.-]+\}/.test(v)) values[p.name] = v;
        else if (p.required) throw new Error(`Fyll i ${p.label || p.name}.`);
      }
      return values;
    }

    function deepSubstitute(node, values) {
      if (typeof node === 'string') {
        const whole = node.match(/^\{([a-zA-Z0-9_.-]+)\}$/);
        if (whole) return values[whole[1]] === undefined ? node : values[whole[1]];
        return substitute(node, values, null);
      }
      if (Array.isArray(node)) return node.map((n) => deepSubstitute(n, values));
      if (node && typeof node === 'object') { const out = {}; for (const [k, v] of Object.entries(node)) out[k] = deepSubstitute(v, values); return out; }
      return node;
    }

    /**
     * Build the request.
     * @param {any} connector @param {any} endpoint @param {Record<string, any>} values normalized parameter values
     * @returns {{url: string, method: string, headers: Record<string, string>, body?: string, options: Record<string, any>}}
     */
    function build(connector, endpoint, values) {
      const params = endpoint.params || [];
      const byName = Object.fromEntries(params.map((p) => [p.name, p]));
      const pathValues = {};
      for (const [name, v] of Object.entries(values)) { const p = byName[name]; if (!p || p.in === 'path' || p.in === undefined) pathValues[name] = p && p.raw ? v : encodePathValue(Array.isArray(v) ? v.join(p && p.join ? p.join : ',') : String(v)); }
      const base = String(connector.baseUrl || '').replace(/\/+$/, '');
      // Optional path parameters that were left empty disappear, and the resulting double slashes collapse.
      let path = substitute(endpoint.path || '', pathValues, null).replace(PLACEHOLDER, '').replace(/([^:]|^)\/{2,}/g, '$1/');
      if (path && !path.startsWith('/') && !/^https?:/.test(path)) path = '/' + path;
      const url = new URL(/^https?:|^dataspatium-asset:/.test(path) ? path : base + path);
      const headers = Object.assign({}, connector.headers || {}, endpoint.headers || {});
      const options = {};
      for (const p of params) {
        const v = values[p.name];
        if (isEmpty(v)) continue;
        const where = p.in || (endpoint.path && endpoint.path.includes('{' + p.name + '}') ? 'path' : 'query');
        if (where === 'query') {
          if (p.type === 'querylines') { for (const line of String(v).split(/\r?\n/)) { const m = line.match(/^\s*([^=\s]+)\s*=\s*(.*)$/); if (m) url.searchParams.append(m[1], m[2].trim()); } }
          else if (Array.isArray(v)) { if (p.style === 'repeat') for (const item of v) url.searchParams.append(p.name, String(item)); else url.searchParams.append(p.name, v.join(p.join || ',')); }
          else url.searchParams.append(p.name, typeof v === 'boolean' ? String(v) : String(v));
        } else if (where === 'header') headers[p.name] = Array.isArray(v) ? v.join(',') : String(v);
        else if (where === 'option') options[p.name] = v;
      }
      const req = { url: url.toString(), method: (endpoint.method || 'GET').toUpperCase(), headers, options };
      if (endpoint.body !== undefined && endpoint.body !== null && req.method === 'POST') {
        const bodyType = endpoint.bodyType || 'json';
        if (bodyType === 'json') { req.body = JSON.stringify(deepSubstitute(endpoint.body, values)); headers['Content-Type'] = headers['Content-Type'] || 'application/json'; }
        else if (bodyType === 'form') { const form = new URLSearchParams(); for (const [k, v] of Object.entries(deepSubstitute(endpoint.body, values))) form.set(k, String(v)); req.body = form.toString(); headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded'; }
        else { req.body = substitute(String(endpoint.body), values, null); headers['Content-Type'] = headers['Content-Type'] || 'text/plain'; }
      }
      if (!headers.Accept && !headers.accept) headers.Accept = 'application/json, text/plain, */*';
      return req;
    }

    /** Dataset name from the endpoint's template ("SCB {tableId}") or a fallback. */
    function datasetName(connector, endpoint, values, fallback) {
      const tpl = endpoint.dataset && endpoint.dataset.name;
      if (tpl) { const s = substitute(tpl, values, null).replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim(); if (s) return s; }
      return fallback || `${connector.name}: ${endpoint.name}`;
    }

    return { build, normalizeParams, substitute, coerce, datasetName, encodePathValue };
  });
})();
