// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Files that a search result points at, such as the assets of a STAC search: a dataset fetched from a connector with
 * `files: {column, hosts}` lists the addresses in that column. A file is fetched with the connector's key only when its
 * host is one the connector names, so the key never goes anywhere else; vector files (also inside a ZIP) are imported as
 * datasets, a GeoPackage as one dataset per layer, and the others (rasters, point clouds) are saved on the computer.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/files', ['api/connectors', 'api/auth', 'api/http', 'data/datasets', 'io/import', 'platform/storage/zip', 'platform/files'], (connectors, auth, http, datasets, importer, zip, platformFiles) => {
    /** Files the app reads as datasets; a ZIP is opened and the same kinds are taken from inside it. */
    const VECTOR = /\.(gpkg|geojson|zip)$/i;
    const INSIDE = /\.(gpkg|geojson)$/i;
    /** At most this many files are fetched at a time. */
    const MAX_FILES = 20;
    const nameOf = (url) => { try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || 'fil'; } catch (_e) { return 'fil'; } };
    const hostOf = (url) => { try { return new URL(url).host; } catch (_e) { return ''; } };

    /**
     * The files a dataset points at, with its connector, or null when the dataset did not come from a connector with files.
     * @param {any} ds dataset metadata
     * @returns {Promise<{connector: any, files: Array<{url: string, name: string, importable: boolean}>}|null>}
     */
    async function of(ds) {
      const source = ds && ds.source;
      if (!source || source.kind !== 'api' || !source.connectorId) return null;
      const connector = await connectors.get(source.connectorId);
      const spec = connector && connector.files;
      if (!spec || !spec.column) return null;
      const index = (await datasets.columns(ds.id)).findIndex((c) => c.name === spec.column);
      if (index < 0) return null;
      const seen = new Set(); const files = [];
      for (const row of await datasets.query(ds.id, { limit: 10000 })) {
        const url = row[index];
        // Real files are on https; the app's own virtual addresses never leave the page (tests and bundled examples).
        if (typeof url !== 'string' || !/^(https|dataspatium-asset):\/\//i.test(url) || seen.has(url)) continue;
        seen.add(url);
        files.push({ url, name: nameOf(url), importable: VECTOR.test(nameOf(url)) });
      }
      return { connector, files };
    }

    /**
     * One file as a File. The connector's key goes along only to the hosts in `files.hosts`.
     * @param {any} connector @param {string} url @param {{signal?: AbortSignal}} [options]
     */
    async function fetchFile(connector, url, options = {}) {
      const hosts = (connector.files && connector.files.hosts) || [];
      let req = { url, method: 'GET', headers: { Accept: '*/*' } };
      if (hosts.includes(hostOf(url))) req = await auth.apply(connector, req, { signal: options.signal });
      const res = await http.request(Object.assign({}, req, { responseType: 'arraybuffer', retries: 1, rateKey: connector.id, signal: options.signal, timeoutMs: 600000 }));
      if (!res.ok) throw http.httpError(res, connector.name);
      return new File([res.buffer], nameOf(url), { type: (res.contentType || '').split(';')[0].trim() || 'application/octet-stream' });
    }

    /** The files to read from one fetched file: itself, or the vector files inside a ZIP. @param {File} file @returns {Promise<File[]>} */
    async function unpack(file) {
      if (!/\.zip$/i.test(file.name)) return [file];
      const entries = await zip.readZip(file);
      return Object.entries(entries)
        .filter(([path, bytes]) => bytes && bytes.byteLength && INSIDE.test(path) && !/(^|\/)(__MACOSX|\.)/.test(path))
        .map(([path, bytes]) => new File([bytes], path.split('/').pop() || path));
    }

    /** A file as datasets: every layer of a GeoPackage, otherwise the file itself. Each remembers the address it came from. */
    async function importOne(file, url, connector) {
      const out = [];
      const base = importer.baseName(file.name);
      if (/\.gpkg$/i.test(file.name)) {
        const info = await D.require('io/importers/sqlite').preview(file, { previewRows: 1 });
        for (const table of info.tables) out.push(await importer.run(file, { table }, null, info.tables.length > 1 ? `${base}: ${table}` : base));
      } else out.push(await importer.run(file, {}, null, base));
      for (const meta of out) await datasets.updateMeta(meta.id, { source: Object.assign({}, meta.source || {}, { url, connectorName: connector.name }) });
      return out;
    }

    /**
     * Fetch the files and import the vector ones as datasets, or save the files on the computer (`save: true`).
     * @param {any} connector @param {Array<{url: string, name: string}>} list
     * @param {{save?: boolean, signal?: AbortSignal, onProgress?: (info: {i: number, n: number, name: string}) => void}} [options]
     * @returns {Promise<{datasets: any[], saved: number, errors: string[]}>}
     */
    async function fetchAll(connector, list, options = {}) {
      const chosen = list.slice(0, MAX_FILES);
      const result = { datasets: [], saved: 0, errors: [] };
      for (let i = 0; i < chosen.length; i++) {
        if (options.signal && options.signal.aborted) break;
        const item = chosen[i];
        if (options.onProgress) options.onProgress({ i: i + 1, n: chosen.length, name: item.name });
        try {
          const file = await fetchFile(connector, item.url, options);
          if (options.save) { platformFiles.download(file, file.name); result.saved++; continue; }
          for (const part of await unpack(file)) result.datasets.push(...(await importOne(part, item.url, connector)));
        } catch (err) { result.errors.push(`${item.name}: ${(err && err.message) || err}`); }
      }
      return result;
    }

    return { of, fetchFile, unpack, fetchAll, MAX_FILES };
  });
})();
