// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Import from a web address: the response becomes a File named after the URL for the ordinary import
 * wizard, or, when it is a Dataspatium configuration (API connector, chart, dashboard, document template,
 * notebook, recognised by its `format` field), it is added directly. The server must allow CORS; GitHub raw
 * files and Gists do, as do most open data portals. Nothing is fetched without the user's action.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/url-import', [], () => {
    const FORMAT_MODULES = {
      'dataspatium-api/1': { module: 'api/connectors', kind: 'api' },
      'dataspatium-viz/1': { module: 'viz/charts', kind: 'chart' },
      'dataspatium-dash/1': { module: 'viz/dashboards', kind: 'dashboard' },
      'dataspatium-doc/1': { module: 'docgen/documents', kind: 'document' },
      'dataspatium-notebook/1': { module: 'analysis/notebooks', kind: 'notebook' },
    };

    /** A file name from the URL path, with an extension from the content type when the path has none. */
    function fileName(url, contentType) {
      try {
        const u = new URL(url);
        const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
        if (last && /\.[A-Za-z0-9]+$/.test(last)) return last;
        const ct = String(contentType || '').toLowerCase();
        const ext = /json/.test(ct) ? 'json' : /csv/.test(ct) ? 'csv' : /xml/.test(ct) ? 'xml' : /zip/.test(ct) ? 'zip' : /excel|spreadsheet/.test(ct) ? 'xlsx' : /geopackage|sqlite/.test(ct) ? 'gpkg' : 'txt';
        return `${last || u.hostname || D.t('url.file.name')}.${ext}`;
      } catch (_err) { return D.t('url.file.name') + '.txt'; }
    }

    /** Fetch a URL (CORS) and return it as a File. */
    async function fetchFile(url) {
      const clean = String(url || '').trim();
      if (!/^https?:\/\//i.test(clean) && !/^dataspatium-asset:\/\//.test(clean)) throw new Error(D.t('url.err.scheme'));
      let res;
      try { res = await fetch(clean, { mode: 'cors' }); } catch (err) {
        throw new Error(D.t('url.err.fetch', { message: (err && err.message) || err }));
      }
      if (!res.ok) throw new Error(D.t('url.err.status', { status: `${res.status}${res.statusText ? ' ' + res.statusText : ''}` }));
      const type = res.headers.get('content-type') || '';
      const blob = await res.blob();
      return new File([blob], fileName(clean, type), { type: type.split(';')[0].trim() });
    }

    /** The Dataspatium format id of a JSON text, or null for ordinary data. */
    function configFormat(text) {
      try { const obj = JSON.parse(String(text).replace(/^﻿/, '')); return obj && typeof obj.format === 'string' && FORMAT_MODULES[obj.format] ? obj.format : null; } catch (_err) { return null; }
    }

    /** Add a configuration file through its module. */
    async function importConfig(text) {
      const format = configFormat(text);
      if (!format) throw new Error(D.t('url.err.notconfig'));
      const entry = FORMAT_MODULES[format];
      const record = await D.require(entry.module).importJson(text);
      return { format, kind: entry.kind, record };
    }

    return { fetchFile, configFormat, importConfig, fileName, FORMAT_MODULES };
  });
})();
