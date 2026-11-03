// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Minimal GitHub client for keeping the workspace in a repository through the REST API (api.github.com allows calls
 * from the browser). A push writes the changed files as one commit with the Git Data API: blobs, a tree on top of the
 * current one, a commit and a fast-forward of the branch. Files are compared by their git blob hash, so unchanged
 * datasets are not uploaded again. A pull reads the files under the chosen folder at the head of the branch.
 *
 * The token is a fine-grained personal access token with read and write access to the repository's contents. The
 * caller passes it (it is kept by api/secrets, never in clear text) and it is only sent to api.github.com. `fetch`
 * can be replaced, which the tests use for an in-memory GitHub.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/storage/github', [], () => {
    const API = 'https://api.github.com';
    const RAW = 'application/vnd.github.raw+json';
    const MAX_FILE = 100 * 1024 * 1024; // GitHub's limit for one file

    /**
     * Owner and repository from "owner/name", "github.com/owner/name" or a clone address; null when not recognised.
     * @param {string} text
     */
    function parseRepo(text) {
      const m = /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(String(text || '').trim());
      return m ? { owner: m[1], repo: m[2] } : null;
    }
    /** @param {string} p */
    const cleanPath = (p) => String(p || '').split(/[\\/]+/).filter(Boolean).join('/');
    const urlPath = (p) => p.split('/').map(encodeURIComponent).join('/');

    function toBase64(bytes) {
      if (typeof bytes.toBase64 === 'function') return bytes.toBase64();
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
      return btoa(s);
    }

    /**
     * Git's blob hash (SHA-1 of "blob <size>", a zero byte and the content), as GitHub reports it for files.
     * @param {Uint8Array} bytes
     */
    async function blobSha(bytes) {
      const head = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
      const all = new Uint8Array(head.length + bytes.byteLength);
      all.set(head, 0);
      all.set(bytes, head.length);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
      return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    async function failure(res, path) {
      let message = '';
      try { message = String((await res.json()).message || ''); } catch (_e) { /* not JSON */ }
      const key = res.status === 401 ? 'github.err.token'
        : res.status === 403 ? 'github.err.forbidden'
          : res.status === 404 ? 'github.err.notfound'
            : res.status === 422 && /\/git\/refs\//.test(path) ? 'github.err.behind'
              : 'github.err.status';
      const err = /** @type {any} */ (new Error(D.t(key, { status: res.status, message })));
      err.status = res.status;
      err.detail = message;
      return err;
    }

    /** @param {{owner: string, repo: string, token: string, fetch?: Function}} cfg */
    function client(cfg) {
      const doFetch = cfg.fetch || globalThis.fetch.bind(globalThis);
      const base = `${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
      async function request(method, path, body, accept) {
        let res;
        try {
          const headers = { Authorization: `Bearer ${cfg.token}`, Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
          if (body) headers['Content-Type'] = 'application/json';
          res = await doFetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
        } catch (err) {
          D.log('github', 'request failed', err);
          throw new Error(D.t('github.err.network'));
        }
        if (!res.ok) throw await failure(res, path);
        if (accept === RAW) return new Uint8Array(await res.arrayBuffer());
        return res.status === 204 ? null : res.json();
      }
      return { request };
    }

    const refPath = (branch) => `/git/ref/heads/${urlPath(branch)}`;

    /** Head commit of the branch; with `create`, an empty repository gets a first commit and a missing branch is made. */
    async function headOf(api, branch, create) {
      try {
        return (await api.request('GET', refPath(branch))).object.sha;
      } catch (err) {
        if (!create || (err.status !== 404 && err.status !== 409)) throw err;
      }
      const info = await api.request('GET', '');
      let base = null;
      try { base = info.default_branch ? (await api.request('GET', refPath(info.default_branch))).object.sha : null; } catch (err) { if (err.status !== 404 && err.status !== 409) throw err; }
      if (!base) {
        // An empty repository: the contents API makes its first commit (a README at the top).
        await api.request('PUT', '/contents/README.md', { message: D.t('github.init.message'), content: toBase64(new TextEncoder().encode(D.t('github.init.readme') + '\n')), branch });
        return (await api.request('GET', refPath(branch))).object.sha;
      }
      await api.request('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: base });
      return base;
    }

    /** Files under the folder in a tree: relative path -> {sha, size}. */
    async function treeFiles(api, treeSha, folder) {
      const tree = await api.request('GET', `/git/trees/${treeSha}?recursive=1`);
      if (tree.truncated) throw new Error(D.t('github.err.truncated'));
      const prefix = folder ? folder + '/' : '';
      const out = new Map();
      for (const e of tree.tree || []) if (e.type === 'blob' && e.path.startsWith(prefix)) out.set(e.path.slice(prefix.length), { sha: e.sha, size: e.size });
      return out;
    }

    /**
     * Commit files to the branch, under the folder: new and changed files are written and the files under the
     * folder that `managed` claims but that are no longer there are removed. Nothing is committed when nothing
     * changed, or when only `volatile` files (such as a manifest with a time stamp) did.
     * @param {{owner: string, repo: string, branch?: string, path?: string, token: string, fetch?: Function}} cfg
     * @param {Record<string, Uint8Array|string>} files paths relative to the folder
     * @param {string} message
     * @param {{managed?: (path: string) => boolean, volatile?: (path: string) => boolean}} [options]
     * @returns {Promise<{commit: string|null, written: number, removed: number, unchanged: number}>}
     */
    async function push(cfg, files, message, options = {}) {
      const api = client(cfg);
      const folder = cleanPath(cfg.path);
      const branch = cfg.branch || 'main';
      const full = (rel) => (folder ? `${folder}/${rel}` : rel);
      const head = await headOf(api, branch, true);
      const commit = await api.request('GET', `/git/commits/${head}`);
      const remote = await treeFiles(api, commit.tree.sha, folder);
      const tree = [];
      let written = 0; let unchanged = 0; let removed = 0;
      const changed = [];
      for (const [rel, data] of Object.entries(files)) {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        if (bytes.byteLength > MAX_FILE) throw new Error(D.t('github.err.toolarge', { path: rel }));
        const known = remote.get(rel);
        if (known && known.sha === (await blobSha(bytes))) { unchanged++; continue; }
        changed.push([rel, bytes]);
      }
      const gone = Array.from(remote.keys()).filter((rel) => !(rel in files) && (!options.managed || options.managed(rel)));
      if (!gone.length && changed.every(([rel]) => options.volatile && options.volatile(rel))) return { commit: null, written: 0, removed: 0, unchanged: unchanged + changed.length };
      for (const [rel, bytes] of changed) {
        const blob = await api.request('POST', '/git/blobs', { content: toBase64(bytes), encoding: 'base64' });
        tree.push({ path: full(rel), mode: '100644', type: 'blob', sha: blob.sha });
        written++;
      }
      for (const rel of gone) {
        tree.push({ path: full(rel), mode: '100644', type: 'blob', sha: null });
        removed++;
      }
      const newTree = await api.request('POST', '/git/trees', { base_tree: commit.tree.sha, tree });
      const newCommit = await api.request('POST', '/git/commits', { message, tree: newTree.sha, parents: [head] });
      await api.request('PATCH', `/git/refs/heads/${urlPath(branch)}`, { sha: newCommit.sha, force: false });
      return { commit: newCommit.sha, written, removed, unchanged };
    }

    /**
     * The files under the folder at the head of the branch (paths relative to the folder).
     * @param {{owner: string, repo: string, branch?: string, path?: string, token: string, fetch?: Function}} cfg
     * @param {{wanted?: (path: string) => boolean}} [options]
     * @returns {Promise<{commit: string, files: Record<string, Uint8Array>}>}
     */
    async function pull(cfg, options = {}) {
      const api = client(cfg);
      const folder = cleanPath(cfg.path);
      const head = await headOf(api, cfg.branch || 'main', false);
      const commit = await api.request('GET', `/git/commits/${head}`);
      const remote = await treeFiles(api, commit.tree.sha, folder);
      /** @type {Record<string, Uint8Array>} */
      const files = {};
      for (const [rel, e] of remote) {
        if (options.wanted && !options.wanted(rel)) continue;
        files[rel] = await api.request('GET', `/git/blobs/${e.sha}`, null, RAW);
      }
      return { commit: head, files };
    }

    /** Address of a commit or of the folder on github.com, for a link. */
    function webUrl(cfg, commit) {
      const base = `https://github.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
      return commit ? `${base}/commit/${commit}` : `${base}/tree/${urlPath(cfg.branch || 'main')}/${urlPath(cleanPath(cfg.path))}`;
    }

    return { parseRepo, blobSha, push, pull, webUrl, MAX_FILE };
  });
})();
