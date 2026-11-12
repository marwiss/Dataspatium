// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The IDS files that come with the app (presets/ids/*.ids, embedded by tools/wrap_local.py so that file:// can read them), for the
 * tool IDS-kontroll in Analysera: every such file is listed by the title in its info, and a chosen one is checked exactly as a
 * file the person picks. Nothing is fetched from the network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/ids-presets', [], () => {
    const PREFIX = 'presets/ids/';
    /** @type {Map<string, string>} name → title */
    const titles = new Map();
    const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    /** The title in an IDS file's info, or ''. @param {string} xml */
    function titleOf(xml) {
      const m = /<(?:[\w-]+:)?title>([\s\S]*?)<\/(?:[\w-]+:)?title>/.exec(String(xml || ''));
      return m ? m[1].replace(/&(amp|lt|gt|quot|apos);/g, (_x, e) => ENTITIES[e]).replace(/\s+/g, ' ').trim() : '';
    }
    /** The asset names of the IDS files that come with the app. @returns {string[]} */
    const names = () => D.assets.names(PREFIX).filter((n) => /\.ids$/i.test(n)).sort();
    /** The file name of an asset name. @param {string} name */
    const fileOf = (name) => String(name).slice(PREFIX.length);
    /**
     * The IDS files with their titles (the file name when a file has none), read once.
     * @returns {Promise<Array<{name: string, file: string, title: string}>>}
     */
    async function list() {
      const out = [];
      for (const name of names()) {
        if (!titles.has(name)) titles.set(name, titleOf(await D.assets.loadText(name)) || fileOf(name));
        out.push({ name, file: fileOf(name), title: titles.get(name) });
      }
      return out;
    }
    /**
     * One IDS file as the tool takes a picked file: its file name and its bytes. @param {string} name an asset name from list()
     * @returns {Promise<{name: string, title: string, text: string, bytes: Uint8Array}>}
     */
    async function load(name) {
      if (!names().includes(name)) throw new Error('Unknown IDS file: ' + name);
      const text = await D.assets.loadText(name);
      return { name: fileOf(name), title: titleOf(text) || fileOf(name), text, bytes: new TextEncoder().encode(text) };
    }
    return { PREFIX, list, load, titleOf };
  });
})();
