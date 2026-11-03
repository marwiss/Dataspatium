// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Optional update check against GitHub Releases. It runs only when the user asks (a click in the help
 * dialog), never at start-up, and sends nothing but the request itself. The fetcher is injectable so that
 * tests never touch the network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/updates', [], () => {
    const REPO = 'marwiss/Dataspatium';
    const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
    const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

    /** Parse "v1.2.3" or "1.2.3-fas7" into [1, 2, 3]; null when the string is not a version. */
    function parseVersion(s) {
      const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(s || '').trim());
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    }

    /** Comparator result -1, 0 or 1; pre-release suffixes are ignored, unparsable versions compare equal. */
    function compareVersions(a, b) {
      const pa = parseVersion(a); const pb = parseVersion(b);
      if (!pa || !pb) return 0;
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
      return 0;
    }

    async function defaultFetchJson(url) {
      const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(D.t('updates.err.status', { status: res.status }));
      return res.json();
    }

    /**
     * Compare the running version with the latest GitHub release.
     * @param {{fetchJson?: (url: string) => Promise<any>, current?: string}} [options]
     * @returns {Promise<{current: string, latest: string, url: string, newer: boolean, published: string|null}>}
     */
    async function check(options = {}) {
      const current = options.current || D.version;
      const fetchJson = options.fetchJson || defaultFetchJson;
      let data;
      try { data = await fetchJson(API_URL); } catch (err) {
        throw new Error(D.t('update.err.network', { message: (err && err.message) || err }));
      }
      const latest = String((data && (data.tag_name || data.name)) || '').replace(/^v/, '');
      if (!parseVersion(latest)) throw new Error(D.t('update.err.version'));
      return { current, latest, url: (data && data.html_url) || RELEASES_URL, newer: compareVersions(current, latest) < 0, published: (data && data.published_at) || null };
    }

    return { check, compareVersions, parseVersion, REPO, RELEASES_URL, API_URL };
  });
})();
